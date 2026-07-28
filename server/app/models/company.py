from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

class CompanyBase(BaseModel):
    name: str
    role: Optional[str] = None
    jd_text: Optional[str] = ""
    skill_set: Optional[List[str]] = []
    core_skills: Optional[List[str]] = []
    project_keywords: Optional[List[str]] = []
    
    # Old legacy fields kept for backward compat if needed
    cpi: Optional[float] = 0.0
    branch: Optional[List[str]] = []
    min_projects: Optional[int] = 0
    dsa_required: Optional[bool] = False
    internship_role: Optional[str] = None
    visits_iit_patna: Optional[bool] = False
    
    # New Fields
    min_gpa: Optional[float] = 0.0
    required_branches: Optional[List[str]] = []
    skill_tiers: Optional[dict] = {"required": [], "preferred": [], "bonus": []}
    weight_skills: Optional[float] = 0.35
    weight_education: Optional[float] = 0.25
    weight_projects: Optional[float] = 0.25
    weight_experience: Optional[float] = 0.15
    source: Optional[str] = "database"

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(CompanyBase):
    name: Optional[str] = None

class CompanyInDB(CompanyBase):
    id: str  # maps to UUID in supabase
    created_at: datetime

    class Config:
        from_attributes = True
