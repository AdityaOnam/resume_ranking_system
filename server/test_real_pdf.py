import asyncio
import sys
import os
import json
import sys

# Force UTF-8 for Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

# Ensure server app is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.resume_parser import ResumeParser
from app.services.ats_scorer import calculate_general_score
from app.services.company_matcher import CompanyMatcher
from app.services.llm_service import LLMService

# Set this to False so we run the actual LLM and Encoders for real outputs
MOCK_HEAVY_MODELS = False

def run_real_pdf_test():
    print("="*60)
    print(" RUNNING REAL PDF PIPELINE TEST")
    print("="*60)

    resume_pdf_path = r"C:\Users\HP\OneDrive\Documents\Aditya_15_06_2026.pdf"
    jd_pdf_path = r"C:\Users\HP\Desktop\temp\Omnissa_Intern_College_Hire_JD.pdf"

    if not os.path.exists(resume_pdf_path):
        print(f" ERROR: Resume not found at {resume_pdf_path}")
        return
    if not os.path.exists(jd_pdf_path):
        print(f" ERROR: JD not found at {jd_pdf_path}")
        return

    print("\n[1/4] Parsing Real Resume PDF...")
    parser = ResumeParser()
    try:
        # 1. Parse Resume
        result = parser.parse(resume_pdf_path)
        parsed_data = result.get("parsed_data", {})
        resume_text = result.get("raw_text", "")
        
        # In case the parser failed
        if not parsed_data or "error" in parsed_data:
            print(f" Parser failed: {parsed_data.get('error')}")
            return
            
    except Exception as e:
        print(f" Parser failed with exception: {e}")
        return

    print("\n✅ FULL PARSED RESUME DATA (Including GitHub):")
    print(json.dumps(parsed_data, indent=2))

    print("\n[2/4] Parsing JD PDF & Constructing Company Profile...")
    try:
        jd_text, _ = parser._extract_text_from_pdf(jd_pdf_path)
    except Exception as e:
        print(f" Failed to read JD PDF: {e}")
        return
        
    print("\n✅ EXTRACTED JD TEXT PREVIEW:")
    print(jd_text[:500] + "...\n[Truncated for brevity]")
        
    company_data = {
        "id": "omnissa-123",
        "name": "Omnissa",
        "internship_role": "Software Engineering Intern",
        "cpi": 7.0,  # Example hard filter
        "branch": ["Computer Science", "Information Technology", "Mathematics & Computing", "Electronics"], 
        "dsa_required": True,
        "skill_set": ["Python", "Java", "C++", "React"], # Extracted conceptually from JD
        "core_skills": ["Data Structures", "Algorithms"],
        "description": jd_text
    }

    print("\n[3/4] Running General ATS Scorer...")
    ats_result = calculate_general_score(parsed_data, resume_text)
    print(f"✅ ATS Score: {ats_result['score']}/100")
    print(f"   Breakdown: {json.dumps(ats_result.get('breakdown', {}), indent=2)}")
    print(f"   Feedback: {json.dumps(ats_result.get('feedback', []), indent=2)}")

    print("\n[4/4] Running Company Matcher (Evaluating fit for Omnissa)...")
    if MOCK_HEAVY_MODELS:
        class MockMatcher(CompanyMatcher):
            def _init_models(self):
                pass
        CompanyMatcher._instance = MockMatcher.__new__(MockMatcher)
        CompanyMatcher._instance.branch_mapping = json.load(open(os.path.join(os.path.dirname(__file__), "data", "branch_mapping.json")))
        matcher = CompanyMatcher._instance
    else:
        matcher = CompanyMatcher()
    
    # Check Hard Filters
    eligibility = matcher.check_hard_filters(parsed_data, company_data)
    print(f" Hard Filters Passed: {eligibility['eligible']}")
    if not eligibility['eligible']:
        print(f"   Reasons: {eligibility['reasons']}")
        
    # Check Soft Score
    if MOCK_HEAVY_MODELS:
        score_data = {"score": 82.5, "breakdown": {"skill_match": 35.0, "cross_encoder": 22.0, "branch_cpi_bonus": 15.0, "project_match": 10.5}}
    else:
        score_data = matcher.compute_company_score(parsed_data, company_data, resume_text, jd_text)
        
    print(f"✅ Soft Match Score: {score_data['score']}/100")
    print(f"   Breakdown: {json.dumps(score_data.get('breakdown', {}), indent=2)}")

    print("\n[5/5] Generating Gap Analysis (Skipped in Mock Mode)")
    if not MOCK_HEAVY_MODELS:
        llm_svc = LLMService()
        gap_analysis = llm_svc.generate_gap_analysis(resume_text, jd_text, score_data)
        print("\n Final Gap Analysis:")
        print("-" * 40)
        print(gap_analysis)
        print("-" * 40)
    else:
        print(" (Gap analysis skipped because MOCK_HEAVY_MODELS = True)")

if __name__ == "__main__":
    run_real_pdf_test()
