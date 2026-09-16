from fastapi import APIRouter, File, UploadFile, HTTPException, BackgroundTasks
from typing import List
import os
import uuid
import datetime
import logging
import tempfile
from app.models.resume import ResumeCreate, ResumeInDB, RankingScoreSchema
from app.core.database import supabase
from app.services.resume_parser import ResumeParser
from app.services.rank_service import generate_rankings
from app.services.embedding_engine import EmbeddingEngine
from app.services.ats_scorer import calculate_general_score, generate_gap_analysis
import asyncio
from app.core.security import get_current_user, User
from fastapi import Depends

logger = logging.getLogger(__name__)

router = APIRouter()
parser = ResumeParser()
embedding_engine = EmbeddingEngine()

STORAGE_BUCKET = "resumes"
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10MB

# Job status is persisted in the "jobs" table (see server/migrations/001_create_jobs_table.sql)
# rather than kept in memory, so it survives server restarts and works across multiple workers.

def _create_job(job_id: str, user_id: str):
    supabase.table("jobs").insert({
        "id": job_id,
        "status": "processing",
        "step": "Initializing...",
        "user_id": user_id
    }).execute()

def _update_job(job_id: str, **fields):
    fields["updated_at"] = datetime.datetime.utcnow().isoformat()
    supabase.table("jobs").update(fields).eq("id", job_id).execute()

def _get_job(job_id: str):
    res = supabase.table("jobs").select("*").eq("id", job_id).execute()
    return res.data[0] if res.data else None

def format_education(parsed_resume):
    branch = parsed_resume.get("Branch")
    if not branch:
        return []
    return [{
        "degree": "B.Tech",
        "field": branch,
        "institution": "Institution",
        "gpa": parsed_resume.get("CPI/GPA", None),
        "year": datetime.datetime.now().year
    }]

def format_projects(parsed_resume):
    project_count = parsed_resume.get("No_of_Projects", 0)
    project_keywords = parsed_resume.get("Project_Keywords", [])
    if project_count == 0:
        return []
    
    projects = []
    keywords = project_keywords if isinstance(project_keywords, list) else []
    
    for i in range(project_count):
        subset_start = int(i * len(keywords) / project_count)
        subset_end = int((i + 1) * len(keywords) / project_count)
        project_keyword_subset = keywords[subset_start:subset_end]
        
        projects.append({
            "title": f"Project {i + 1}",
            "description": ", ".join(project_keyword_subset),
            "technologies": project_keyword_subset
        })
    return projects

# ---------------------------------------------------------------------------
# Supabase Storage helpers
# ---------------------------------------------------------------------------

def _upload_to_storage(file_bytes: bytes, storage_key: str, content_type: str):
    """Upload raw bytes to the Supabase Storage bucket."""
    supabase.storage.from_(STORAGE_BUCKET).upload(
        path=storage_key,
        file=file_bytes,
        file_options={"content-type": content_type},
    )

def _download_from_storage(storage_key: str) -> bytes:
    """Download a file from Supabase Storage and return its bytes."""
    return supabase.storage.from_(STORAGE_BUCKET).download(storage_key)

def _delete_from_storage(storage_key: str):
    """Delete a file from Supabase Storage."""
    try:
        supabase.storage.from_(STORAGE_BUCKET).remove([storage_key])
    except Exception as e:
        logger.warning(f"Failed to delete '{storage_key}' from storage: {e}")


@router.get("/", response_model=List[dict])
def get_resumes(current_user: User = Depends(get_current_user)):
    # Deliberately excludes raw_text and parsed_data: this is a list endpoint
    # feeding dashboards/leaderboards, and shipping every resume's full extracted
    # text plus its entire parsed JSON on every page load is a large payload for
    # data the client never reads. Fetch a single resume via GET /{resume_id}
    # (which still selects *) when the full document is actually needed.
    # ats_report is also omitted: it duplicates ats_feedback/ats_breakdown/
    # ats_gap_analysis, which are already selected individually, and no client
    # code reads it. GET /{resume_id} still selects * for the detail view.
    res = supabase.table("resumes").select(
        "id, name, email, skills, rankings, created_at, "
        "ats_score, ats_breakdown, ats_feedback, ats_gap_analysis, original_filename"
    ).eq("user_id", current_user.id).order("created_at", desc=True).execute()
    return res.data

@router.get("/status/{job_id}")
def get_status(job_id: str, current_user: User = Depends(get_current_user)):
    job = _get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("user_id") and job.get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/{resume_id}", response_model=ResumeInDB)
def get_resume_by_id(resume_id: str, current_user: User = Depends(get_current_user)):
    res = supabase.table("resumes").select("*").eq("id", resume_id).eq("user_id", current_user.id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    resume = res.data[0]
    
    # Populate company names from supabase in the rankings (bulk fetch to fix N+1 problem)
    rankings = resume.get("rankings", [])
    if rankings:
        company_ids = [r.get("company") for r in rankings if r.get("company")]
        if company_ids:
            # Fetch all matching companies in one query
            c_res = supabase.table("companies").select("id, name").in_("id", company_ids).execute()
            company_map = {c["id"]: c["name"] for c in c_res.data} if c_res.data else {}
            
            for r in rankings:
                comp_id = r.get("company")
                # Handle cases where it was saved securely as dict already
                if isinstance(comp_id, dict):
                    comp_id = comp_id.get("id") or comp_id.get("_id")
                    
                if comp_id and comp_id in company_map:
                    r["company"] = {
                        "_id": comp_id,
                        "name": company_map[comp_id]
                    }
                    r["companyName"] = company_map[comp_id]
                
    resume["rankings"] = rankings
    return resume

@router.delete("/{resume_id}")
def delete_resume(resume_id: str, current_user: User = Depends(get_current_user)):
    # Fetch file_path first, ensure it belongs to the user
    res = supabase.table("resumes").select("file_path").eq("id", resume_id).eq("user_id", current_user.id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Resume not found")

    storage_key = res.data[0].get("file_path")
    if storage_key:
        _delete_from_storage(storage_key)

    del_res = supabase.table("resumes").delete().eq("id", resume_id).execute()
    return {"msg": "Resume deleted"}

def _strip_null_bytes(value):
    """Postgres text columns reject \\x00; some PDF text extraction leaves stray
    null bytes behind, which otherwise crashes the Supabase insert/update."""
    if isinstance(value, str):
        return value.replace("\x00", "")
    if isinstance(value, dict):
        return {k: _strip_null_bytes(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_strip_null_bytes(v) for v in value]
    return value

def _do_parse(file_path: str):
    return parser.parse(file_path)

def _do_embed(mapped_resume: dict):
    return embedding_engine.generate_resume_embedding(mapped_resume)

def _do_ats(parsed_data: dict, resume_text: str, include_gap_analysis: bool = True):
    return calculate_general_score(parsed_data, resume_text, include_gap_analysis)

async def process_resume_background(job_id: str, storage_key: str, filename: str, user_id: str):
    tmp_path = None
    # Declared before the try so the finally block can always reach it, even if
    # the pipeline fails before the task is created.
    gap_analysis_task = None
    try:
        _update_job(job_id, step="Downloading resume from storage...")
        file_bytes = _download_from_storage(storage_key)

        ext = os.path.splitext(filename)[1].lower()
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        tmp_file.write(file_bytes)
        tmp_file.close()
        tmp_path = tmp_file.name

        _update_job(job_id, step="Parsing resume with AI...")
        # Run blocking LLM call in a thread so FastAPI can still serve other requests
        result = await asyncio.to_thread(_do_parse, tmp_path)
        parsed_resume_data = result.get("parsed_data", {})
        resume_text = result.get("raw_text", "")
        contact_info = parsed_resume_data.get("contact", {})

        if not contact_info.get("email"):
            logger.warning(f"Failed to extract email from resume {filename}, using fallback.")
            # Don't fail the entire upload if email isn't found. Use a fallback so it can still be processed.
            contact_info["email"] = f"unknown_{uuid.uuid4().hex[:8]}@resume.local"

        _update_job(job_id, step="Calculating ATS Score...")
        try:
            # Deterministic part only - the LLM gap analysis is kicked off below
            # and awaited after ranking, so its 2-5s of network wait overlaps
            # with the embedding/matching work instead of stalling the pipeline.
            ats_result = await asyncio.to_thread(_do_ats, parsed_resume_data, resume_text, False)
            ats_score = ats_result["score"]
            ats_feedback = ats_result["feedback"]
            ats_breakdown = ats_result.get("breakdown", {})
            gap_analysis_task = asyncio.create_task(
                asyncio.to_thread(generate_gap_analysis, resume_text, ats_result)
            )
        except Exception:
            logger.exception(f"ATS scoring failed for job {job_id}")
            ats_score = 0
            ats_feedback = []
            ats_breakdown = {}
        ats_gap_analysis = ""

        # Embed once, up front: the same vector is needed both to pre-filter
        # companies during ranking and to persist on the resume row. It used to
        # be computed twice per upload.
        _update_job(job_id, step="Generating Embeddings...")
        resume_embedding = None
        try:
            # _flatten_resume reads skills/experience/projects/education, which
            # parsed_resume_data carries under the same keys mapped_resume does.
            resume_embedding = await asyncio.to_thread(_do_embed, parsed_resume_data)
        except Exception:
            logger.exception(f"Embedding generation failed for job {job_id}")

        _update_job(job_id, step="Matching Companies...")
        # Select only the columns the ranking pass actually reads. `select("*")`
        # also pulled every company's full jd_text and 384-dim jd_embedding as
        # JSON on every single upload.
        # NB: there is no `description` column on companies - the scoring code's
        # company_data.get("description") fallbacks refer to LLM-parsed JD dicts,
        # not this table. Naming it here makes PostgREST reject the whole query.
        companies_res = supabase.table("companies").select(
            "id, name, role, internship_role, jd_text, jd_embedding, "
            "skill_set, core_skills, project_keywords, min_gpa, cpi, "
            "required_branches, branch, dsa_required, min_projects"
        ).execute()
        companies = companies_res.data
        rankings = []
        if companies:
            try:
                rankings = await asyncio.to_thread(
                    generate_rankings, parsed_resume_data, resume_text, companies, user_id, resume_embedding
                )
            except Exception:
                logger.exception(f"Ranking generation failed for job {job_id}")

        # Collect the LLM gap analysis that has been running alongside ranking.
        if gap_analysis_task is not None:
            try:
                ats_gap_analysis = await gap_analysis_task
            except Exception:
                logger.exception(f"Gap analysis task failed for job {job_id}")
                ats_gap_analysis = ""

        name_from_file = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ")
        final_name = contact_info.get("name") or name_from_file

        mapped_resume = {
            "name": final_name,
            "email": contact_info.get("email"),
            "phone": contact_info.get("phone") or "",
            "original_filename": filename,
            "education": parsed_resume_data.get("education", []),
            "skills": parsed_resume_data.get("skills", []),
            "experience": parsed_resume_data.get("experience", []),
            "projects": parsed_resume_data.get("projects", []),
            "resume_text": resume_text,
            "raw_text": resume_text,
            "parsed_data": parsed_resume_data,
            "file_path": storage_key,
            "rankings": rankings,
            "ats_score": ats_score,
            "ats_feedback": ats_feedback,
            "ats_breakdown": ats_breakdown,
            "ats_gap_analysis": ats_gap_analysis,
            "ats_report": {
                "feedback": ats_feedback,
                "breakdown": ats_breakdown,
                "gap_analysis": ats_gap_analysis
            },
            "user_id": user_id,
        }

        # Reuse the vector computed before the ranking pass rather than encoding
        # the same resume a second time.
        if resume_embedding is not None:
            mapped_resume["embedding"] = resume_embedding

        db_resume = _strip_null_bytes(mapped_resume)

        _update_job(job_id, step="Saving to Database...")
        existing = supabase.table("resumes").select("id, file_path").eq("email", mapped_resume["email"]).eq("user_id", user_id).execute()

        resume_id = ""
        if existing.data:
            resume_id = existing.data[0]["id"]
            old_storage_key = existing.data[0]["file_path"]
            if old_storage_key and old_storage_key != storage_key:
                _delete_from_storage(old_storage_key)
            supabase.table("resumes").update(db_resume).eq("id", resume_id).execute()
        else:
            ins_res = supabase.table("resumes").insert(db_resume).execute()
            if ins_res.data:
                resume_id = ins_res.data[0]["id"]
                
        if resume_id and rankings:
            rankings_to_insert = []
            for r in rankings:
                comp_id = r.get("company")
                if isinstance(comp_id, dict):
                    comp_id = comp_id.get("id") or comp_id.get("_id")
                
                rankings_to_insert.append({
                    "resume_id": resume_id,
                    "company_id": comp_id,
                    "overall_score": r.get("score"),
                    "rank": r.get("rank"),
                    "dimension_scores": {
                        **r.get("score_breakdown", {}),
                        "eligible": r.get("eligible", True),
                        "eligibility_reasons": r.get("eligibility_reasons", [])
                    }
                })
            try:
                for chunk in [rankings_to_insert[i:i+100] for i in range(0, len(rankings_to_insert), 100)]:
                    supabase.table("rankings").upsert(chunk, on_conflict="resume_id,company_id").execute()
            except Exception as rank_err:
                logger.error(f"Failed to write rankings for resume {resume_id}: {rank_err}")

        try:
            supabase.table("ats_history").insert({
                "user_id": user_id,
                "resume_id": resume_id,
                "name": mapped_resume["name"],
                "email": mapped_resume["email"],
                "ats_score": ats_score,
                "original_filename": filename,
            }).execute()
        except Exception as hist_err:
            logger.warning(f"Failed to write ATS history for job {job_id}: {hist_err}")

        _update_job(
            job_id,
            status="completed",
            step="Done",
            resume_id=resume_id,
            resume={
                "id": resume_id,
                "name": mapped_resume["name"],
                "email": mapped_resume["email"],
                "rankings": rankings,
                "ats_score": ats_score,
                "ats_feedback": ats_feedback
            }
        )
    except Exception as e:
        logger.exception(f"Resume processing failed for job {job_id}")
        _update_job(job_id, status="error", error=str(e))
    finally:
        # If the pipeline errored before the gap-analysis task was awaited, cancel
        # it so it doesn't linger as an un-retrieved task.
        if gap_analysis_task is not None and not gap_analysis_task.done():
            gap_analysis_task.cancel()

        # Always clean up the temp file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

@router.post("/")
async def upload_resume(background_tasks: BackgroundTasks, resume: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    original_filename = os.path.basename(resume.filename or "")
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Only PDF and DOCX are supported.",
        )

    # Read the entire file into memory (capped at MAX_UPLOAD_SIZE_BYTES)
    file_bytes = b""
    chunk_size = 1024 * 1024
    total_size = 0
    while chunk := await resume.read(chunk_size):
        total_size += len(chunk)
        if total_size > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds the 10MB size limit.")
        file_bytes += chunk

    # Upload to Supabase Storage under a unique key
    storage_key = f"{current_user.id}/{uuid.uuid4()}{ext}"
    content_type = "application/pdf" if ext == ".pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    try:
        _upload_to_storage(file_bytes, storage_key, content_type)
    except Exception as e:
        logger.error(f"Failed to upload to Supabase Storage: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload resume to storage.")

    job_id = str(uuid.uuid4())
    _create_job(job_id, current_user.id)

    background_tasks.add_task(process_resume_background, job_id, storage_key, original_filename, current_user.id)
    return {"msg": "Processing started", "job_id": job_id}
