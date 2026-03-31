from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

class CompanyBase(BaseModel):
    name: str
    cpi: Optional[float] = 0.0
    skill_set: Optional[List[str]] = []
    internship_role: Optional[str] = None
    visits_iit_patna: Optional[bool] = False
    min_projects: Optional[int] = 0
    project_keywords: Optional[List[str]] = []
    branch: Optional[List[str]] = []
    dsa_required: Optional[bool] = False
    core_skills: Optional[List[str]] = []
    description: Optional[str] = ""

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(CompanyBase):
    name: Optional[str] = None

class CompanyInDB(CompanyBase):
    id: str  # maps to UUID in supabase
    created_at: datetime

    class Config:
        from_attributes = True
