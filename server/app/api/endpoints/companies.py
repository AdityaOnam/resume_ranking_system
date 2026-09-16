from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from typing import List
import logging
from app.models.company import CompanyCreate, CompanyUpdate, CompanyInDB
from app.core.database import supabase
from app.services.rank_service import generate_rankings, rank_resumes_for_company
from app.services.llm_service import get_llm_service
from pydantic import BaseModel
import asyncio
import concurrent.futures
from app.core.security import get_current_user, User
from app.services.embedding_engine import EmbeddingEngine

logger = logging.getLogger(__name__)

class JDParseRequest(BaseModel):
    text: str


embedding_engine = EmbeddingEngine()

router = APIRouter()

@router.post("/parse-jd")
def parse_job_description(req: JDParseRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Job description text is required")
        
    try:
        parsed_data = get_llm_service().extract_job_description_data(req.text)
        if not parsed_data:
            raise HTTPException(status_code=500, detail="Failed to parse job description")
        return parsed_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _rerank_resumes_for_new_company(new_company: dict):
    """Re-scores existing resumes against a newly created company in the background,
    so company creation doesn't block on one CrossEncoder/embedding pass per resume.

    Ranking pool is scoped per-user (see rank_service.generate_rankings), so this
    calls generate_rankings once per resume with that resume's own user_id - it
    only ever touches other resumes belonging to the same user.

    Companies are global, so every user's resumes must be re-scored here - the
    unfiltered fetch is intentional. What is NOT intentional is pulling every
    column: this used to `select("*")`, dragging each resume's full raw_text,
    parsed_data and 384-dim embedding across the wire for a pass that needs a
    handful of fields."""
    resumes = supabase.table("resumes").select(
        "id, user_id, parsed_data, raw_text, resume_text, rankings, embedding, "
        "skills, education, experience, projects"
    ).execute()

    company_id = new_company["id"]
    rows = [r for r in (resumes.data or []) if r.get("user_id")]
    skipped = len(resumes.data or []) - len(rows)
    if skipped:
        logger.warning(f"Skipping {skipped} resume(s) with no user_id during re-rank.")
    if not rows:
        return

    # Score every resume against this one company in a single batched pass:
    # the JD is encoded once and all resumes go through the CrossEncoder
    # together, instead of one generate_rankings call (and one DB SELECT, and
    # one single-pair predict) per resume.
    try:
        entries = await asyncio.to_thread(rank_resumes_for_company, new_company, rows)
    except Exception:
        logger.exception(f"Batched re-rank failed for new company {company_id}.")
        return

    ranking_rows_to_upsert = []
    resume_updates = []

    for raw_resume in rows:
        entry = entries.get(raw_resume["id"])
        if not entry:
            continue

        # Replace any existing entry for this company rather than blindly
        # appending - re-running this for the same company would otherwise
        # leave duplicate rankings on the row.
        existing_rankings = raw_resume.get("rankings") or []
        for idx, existing in enumerate(existing_rankings):
            if str(existing.get("company")) == str(company_id):
                existing_rankings[idx] = entry
                break
        else:
            existing_rankings.append(entry)

        resume_updates.append((raw_resume["id"], existing_rankings))
        ranking_rows_to_upsert.append({
            "resume_id": raw_resume["id"],
            "company_id": company_id,
            "overall_score": entry["score"],
            "rank": entry["rank"],
            "dimension_scores": entry["score_breakdown"],
        })

    def _write(item):
        resume_id, payload = item
        try:
            supabase.table("resumes").update({"rankings": payload}).eq("id", resume_id).execute()
        except Exception as e:
            logger.error(f"Failed to update rankings for resume {resume_id}: {e}")

    if resume_updates:
        await asyncio.to_thread(
            lambda: list(
                concurrent.futures.ThreadPoolExecutor(max_workers=8).map(_write, resume_updates)
            )
        )

    if ranking_rows_to_upsert:
        try:
            for chunk in [ranking_rows_to_upsert[i:i + 100] for i in range(0, len(ranking_rows_to_upsert), 100)]:
                supabase.table("rankings").upsert(chunk, on_conflict="resume_id,company_id").execute()
        except Exception as rank_e:
            logger.error(f"Failed to batch-write to rankings table: {rank_e}")

@router.post("/", response_model=CompanyInDB, status_code=201)
def create_company(company: CompanyCreate, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    try:
        # Check if exists
        existing = supabase.table("companies").select("id").eq("name", company.name).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Company already exists")

        # Insert with uploaded_by
        company_data = company.model_dump()
        company_data["uploaded_by"] = current_user.id
        if "created_by" in company_data:
            del company_data["created_by"]
            
        if company_data.get("jd_text"):
            try:
                company_data["jd_embedding"] = embedding_engine.generate_job_embedding(company_data["jd_text"])
            except Exception as e:
                logger.error(f"Failed to generate embedding for company {company.name}: {e}")
        insert_res = supabase.table("companies").insert(company_data).execute()
        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to create company")

        new_company = insert_res.data[0]

        # Re-ranking existing resumes against the new company is heavy (one embedding/
        # CrossEncoder pass per resume) - offload it so the request returns immediately.
        background_tasks.add_task(_rerank_resumes_for_new_company, new_company)

        return new_company
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[CompanyInDB])
def get_companies():
    res = supabase.table("companies").select("*").order("name").execute()
    return res.data

@router.get("/{company_id}", response_model=CompanyInDB)
def get_company_by_id(company_id: str):
    res = supabase.table("companies").select("*").eq("id", company_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Company not found")
    return res.data[0]

@router.put("/{company_id}", response_model=CompanyInDB)
def update_company(company_id: str, company: CompanyUpdate, current_user: User = Depends(get_current_user)):
    raise HTTPException(status_code=403, detail="Users do not have permission to modify companies.")

@router.delete("/{company_id}")
def delete_company(company_id: str, current_user: User = Depends(get_current_user)):
    raise HTTPException(status_code=403, detail="Users do not have permission to delete companies.")
