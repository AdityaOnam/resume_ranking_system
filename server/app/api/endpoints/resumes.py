from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import List
import os
import shutil
import uuid
import datetime
import traceback
from app.models.resume import ResumeCreate, ResumeInDB, RankingScoreSchema
from app.core.database import supabase
from app.services.resume_parser import EnhancedResumeParser
from app.services.rank_service import generate_rankings
import asyncio

router = APIRouter()
parser = EnhancedResumeParser()

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

@router.get("/", response_model=List[dict])
def get_resumes():
    res = supabase.table("resumes").select("id, name, email, skills, rankings, created_at").order("created_at", desc=True).execute()
    return res.data

@router.get("/{resume_id}", response_model=ResumeInDB)
def get_resume_by_id(resume_id: str):
    res = supabase.table("resumes").select("*").eq("id", resume_id).execute()
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
def delete_resume(resume_id: str):
    # Fetch file_path first
    res = supabase.table("resumes").select("file_path").eq("id", resume_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    file_path = res.data[0].get("file_path")
    if file_path and os.path.exists(file_path):
        os.unlink(file_path)
        
    del_res = supabase.table("resumes").delete().eq("id", resume_id).execute()
    return {"msg": "Resume deleted"}

@router.post("/")
async def upload_resume(resume: UploadFile = File(...)):
    try:
        # Save file to uploads temp dir
        upload_dir = "uploads/"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, f"{uuid.uuid4()}-{resume.filename}")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(resume.file, buffer)
            
        # Parse resume native python
        try:
            resume_text = parser.extract_text_from_pdf(file_path)
            parsed_resume_data = {
                "Email_ID": parser.extract_email(resume_text),
                "Mobile_Number": parser.extract_mobile_number(resume_text),
                "CPI/GPA": parser.extract_gpa(resume_text),
                "Branch": parser.extract_branch(resume_text),
                "Skills": parser.extract_skills(resume_text),
                "No_of_Projects": parser.count_projects(resume_text),
                "Project_Keywords": parser.extract_project_keywords(resume_text),
                "Experience": parser.has_experience(resume_text),
                "resumeText": resume_text
            }
        except Exception as e:
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to parse resume: {e}")
            
        if not parsed_resume_data.get("Email_ID"):
            if os.path.exists(file_path): os.unlink(file_path)
            raise HTTPException(status_code=400, detail="Failed to extract email from resume")

        # Fetch companies
        companies_res = supabase.table("companies").select("*").execute()
        companies = companies_res.data
        if not companies:
            if os.path.exists(file_path): os.unlink(file_path)
            raise HTTPException(status_code=404, detail="No companies found in the database")

        # Generate rankings natively!
        rankings = await generate_rankings(parsed_resume_data, companies)

        name_from_file = os.path.splitext(resume.filename)[0].replace("_", " ").replace("-", " ")

        mapped_resume = {
            "name": name_from_file,
            "email": parsed_resume_data["Email_ID"],
            "phone": parsed_resume_data["Mobile_Number"] or "",
            "education": format_education(parsed_resume_data),
            "skills": parsed_resume_data["Skills"] or [],
            "experience": [{
                "title": "Experience",
                "company": "Unknown",
                "description": "Experience mentioned",
                "start_date": str(datetime.datetime.now()),
                "end_date": str(datetime.datetime.now())
            }] if parsed_resume_data["Experience"] == 'Yes' else [],
            "projects": format_projects(parsed_resume_data),
            "resume_text": resume_text,
            "file_path": file_path,
            "rankings": rankings
        }

        # Check existing
        existing = supabase.table("resumes").select("id, file_path").eq("email", mapped_resume["email"]).execute()
        is_update = False
        resume_id = ""

        if existing.data:
            is_update = True
            resume_id = existing.data[0]["id"]
            old_path = existing.data[0]["file_path"]
            
            if old_path and old_path != file_path and os.path.exists(old_path):
                os.unlink(old_path)
                
            # Update
            upd_res = supabase.table("resumes").update(mapped_resume).eq("id", resume_id).execute()
        else:
            # Create
            ins_res = supabase.table("resumes").insert(mapped_resume).execute()
            if ins_res.data:
                resume_id = ins_res.data[0]["id"]

        response_payload = {
            "msg": "Resume updated successfully" if is_update else "Resume uploaded and processed successfully",
            "resume": {
                "id": resume_id,
                "name": mapped_resume["name"],
                "email": mapped_resume["email"],
                "rankings": rankings
            }
        }
        
        return response_payload
    except HTTPException as he:
        raise he
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
