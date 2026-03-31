from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime

class RankingScoreSchema(BaseModel):
    company: Any  # Can be id string or populated dictionary
    companyName: Optional[str] = None
    score: float
    rank: int
    totalResumes: Optional[int] = None

class ResumeBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    education: Optional[List[Dict[str, Any]]] = []
    skills: Optional[List[str]] = []
    experience: Optional[List[Dict[str, Any]]] = []
    projects: Optional[List[Dict[str, Any]]] = []
    resume_text: str
    file_path: Optional[str] = None

class ResumeCreate(ResumeBase):
    rankings: Optional[List[RankingScoreSchema]] = []

class ResumeInDB(ResumeBase):
    id: str
    rankings: Optional[List[RankingScoreSchema]] = []
    created_at: datetime
    
    class Config:
        from_attributes = True
