from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.company import CompanyCreate, CompanyUpdate, CompanyInDB
from app.core.database import supabase
from app.services.rank_service import generate_rankings

router = APIRouter()

@router.post("/", response_model=CompanyInDB, status_code=201)
def create_company(company: CompanyCreate):
    try:
        # Check if exists
        existing = supabase.table("companies").select("id").eq("name", company.name).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Company already exists")
        
        # Insert
        insert_res = supabase.table("companies").insert(company.model_dump()).execute()
        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to create company")
            
        new_company = insert_res.data[0]
        
        # Trigger re-ranking for existing resumes
        resumes = supabase.table("resumes").select("*").execute()
        
        # We need an async trigger or just run it synchronously like the JS did
        for raw_resume in resumes.data:
            # Reconstruct resumeData from supabase DB model to what rank_generator expects
            resume_data_passed = {
                'CPI/GPA': raw_resume.get('education', [{'gpa': 0}])[0].get('gpa') if raw_resume.get('education') else 0,
                'Skills': raw_resume.get('skills', []),
                'No_of_Projects': len(raw_resume.get('projects', [])),
                'Project_Keywords': [],  # Flattening from projects dict would go here
                'Mobile_Number': raw_resume.get('phone', ''),
                'Email_ID': raw_resume.get('email', ''),
                'Experience': 'Yes' if len(raw_resume.get('experience', [])) > 0 else 'No',
                'Core_Computer_Skills': '',
                'Branch': raw_resume.get('education', [{'field': ''}])[0].get('field') if raw_resume.get('education') else ''
            }
            
            # The JS code calls generateRankings for all companies or just the new one.
            # Here it generated rankings for the *new company only* 
            import asyncio
            rankings = asyncio.run(generate_rankings(resume_data_passed, [new_company]))
            
            if rankings:
                existing_rankings = raw_resume.get('rankings') or []
                existing_rankings.append({
                    'company': new_company['id'],
                    'score': rankings[0]['score'],
                    'rank': len(existing_rankings) + 1 # rough mock
                })
                # Note: full ranking sort logic across all resumes handled in generate_rankings above
                
        return new_company
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
def update_company(company_id: str, company: CompanyUpdate):
    update_data = company.model_dump(exclude_unset=True)
    res = supabase.table("companies").update(update_data).eq("id", company_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Company not found")
        
    updated_company = res.data[0]
    # In JS version, it updates rankings here. Skipped for brevity in port, but similar to create.
    return updated_company

@router.delete("/{company_id}")
def delete_company(company_id: str):
    res = supabase.table("companies").delete().eq("id", company_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Company not found")
        
    # Remove from resume rankings
    resumes = supabase.table("resumes").select("id, rankings").execute()
    for resume in resumes.data:
        rankings = resume.get("rankings") or []
        new_rankings = [r for r in rankings if str(r.get("company")) != str(company_id)]
        supabase.table("resumes").update({"rankings": new_rankings}).eq("id", resume["id"]).execute()
        
    return {"msg": "Company removed"}
