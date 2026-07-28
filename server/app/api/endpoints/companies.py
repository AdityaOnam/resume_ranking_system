from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from typing import List
import logging
from app.models.company import CompanyCreate, CompanyUpdate, CompanyInDB
from app.core.database import supabase
from app.services.rank_service import generate_rankings
from app.services.llm_service import LLMService
from pydantic import BaseModel
import asyncio
from app.core.security import get_current_user, User
from app.services.embedding_engine import EmbeddingEngine

logger = logging.getLogger(__name__)

class JDParseRequest(BaseModel):
    text: str

llm_service = LLMService()
embedding_engine = EmbeddingEngine()

router = APIRouter()

@router.post("/parse-jd")
def parse_job_description(req: JDParseRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Job description text is required")
        
    try:
        parsed_data = llm_service.extract_job_description_data(req.text)
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
    only ever touches other resumes belonging to the same user."""
    resumes = supabase.table("resumes").select("*").execute()
    for raw_resume in resumes.data or []:
        try:
            user_id = raw_resume.get("user_id")
            if not user_id:
                logger.warning(f"Skipping resume {raw_resume.get('id')} with no user_id during re-rank.")
                continue

            # We already have parsed_data in the DB model for new resumes
            # Fallback to the raw resume if parsed_data is not strictly separated
            resume_data_passed = raw_resume.get("parsed_data") or raw_resume
            resume_text = raw_resume.get("raw_text") or raw_resume.get("resume_text", "")

            rankings = await asyncio.to_thread(generate_rankings, resume_data_passed, resume_text, [new_company], user_id)

            if rankings:
                r = rankings[0]
                existing_rankings = raw_resume.get('rankings') or []
                existing_rankings.append({
                    'company': new_company['id'],
                    'companyName': new_company.get('name'),
                    'score': r['score'],
                    # Use the rank generate_rankings actually computed (this
                    # resume's position among the user's other resumes for this
                    # company) - NOT len(existing_rankings), which is just this
                    # resume's count of other company rankings and unrelated to
                    # its standing for the new company.
                    'rank': r['rank'],
                    'totalResumes': r.get('totalResumes'),
                    'eligible': r.get('eligible', True),
                    'eligibility_reasons': r.get('eligibility_reasons', []),
                    'score_breakdown': r.get('score_breakdown', {})
                })
                supabase.table("resumes").update({"rankings": existing_rankings}).eq("id", raw_resume["id"]).execute()

                try:
                    supabase.table("rankings").upsert({
                        "resume_id": raw_resume["id"],
                        "company_id": new_company["id"],
                        "overall_score": r["score"],
                        "rank": r["rank"],
                        "dimension_scores": r.get("score_breakdown", {}),
                    }).execute()
                except Exception as rank_e:
                    logger.error(f"Failed to write to rankings table: {rank_e}")
        except Exception:
            logger.exception(
                f"Failed to re-rank resume {raw_resume.get('id')} for new company {new_company.get('id')}, skipping."
            )
            continue

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
