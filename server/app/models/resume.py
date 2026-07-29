from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime

class RankingScoreSchema(BaseModel):
    company: Any  # Can be id string or populated dictionary
    companyName: Optional[str] = None
    companyRole: Optional[str] = None
    score: float
    rank: int
    totalResumes: Optional[int] = None
    eligible: Optional[bool] = None
    eligibility_reasons: Optional[List[str]] = []
    score_breakdown: Optional[Dict[str, float]] = {}

class ResumeBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    education: Optional[List[Dict[str, Any]]] = []
    # Parser output is {"name", "confidence", "sources"} per skill (see
    # resume_parser.py final_skills) - every consumer already handles that
    # shape defensively (isinstance(s, dict) checks in company_matcher.py,
    # analytics.py), but this was still typed as List[str], which makes
    # GET /resumes/{id} (response_model=ResumeInDB) raise a Pydantic
    # ValidationError - a 500 - for every resume parsed under the current parser.
    skills: Optional[List[Dict[str, Any]]] = []
    experience: Optional[List[Dict[str, Any]]] = []
    projects: Optional[List[Dict[str, Any]]] = []
    resume_text: str
    raw_text: Optional[str] = None
    file_path: Optional[str] = None
    original_filename: Optional[str] = None
    ats_score: Optional[int] = None
    ats_feedback: Optional[List[str]] = []
    ats_breakdown: Optional[Dict[str, float]] = {}
    ats_gap_analysis: Optional[str] = ""
    ats_report: Optional[Dict[str, Any]] = {}
    parsed_data: Optional[Dict[str, Any]] = {}
    is_active: Optional[bool] = True

class ResumeCreate(ResumeBase):
    rankings: Optional[List[RankingScoreSchema]] = []

class ResumeInDB(ResumeBase):
    id: str
    rankings: Optional[List[RankingScoreSchema]] = []
    created_at: datetime
    
    class Config:
        from_attributes = True
