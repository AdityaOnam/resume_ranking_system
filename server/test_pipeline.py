import asyncio
import sys
import os
import json
from pprint import pprint

# Ensure server app is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.resume_parser import ResumeParser
from app.services.ats_scorer import calculate_general_score
from app.services.company_matcher import CompanyMatcher
from app.services.llm_service import LLMService

# Set this to True to bypass loading heavy AI models (prevents RAM crashes)
MOCK_HEAVY_MODELS = True

def run_test():
    print("="*60)
    print(" RUNNING END-TO-END PIPELINE TEST")
    print("="*60)

    # 1. DUMMY DATA
    resume_text = """
    JOHN DOE
    john.doe@email.com | 555-123-4567 | github.com/johndoe | linkedin.com/in/johndoe

    EDUCATION
    B.Tech in Computer Science and Engineering
    IIT Patna, 2021 - 2025
    CPI: 9.2

    SKILLS
    Python, React, Node.js, PostgreSQL, Docker, AWS, Data Structures, Algorithms, TypeScript, React Native

    EXPERIENCE
    Software Engineer Intern at TechCorp
    May 2024 - Aug 2024
    - Developed a scalable microservice architecture using Python and Docker, improving system performance by 40%.
    - Optimized PostgreSQL queries to reduce latency by 200ms across 5 core endpoints.
    - Led a team of 3 interns to deliver a new real-time dashboard using React.

    PROJECTS
    E-Commerce Platform
    - Built a full-stack application using React, Node.js, and PostgreSQL.
    - Implemented secure JWT authentication and Stripe payment integration.
    - Deployed on AWS EC2, handling 500+ daily active users.
    """

    company_data = {
        "id": "123-abc",
        "name": "Google",
        "internship_role": "Software Engineering Intern",
        "cpi": 8.0,
        "branch": ["Computer Science", "Electrical"],
        "dsa_required": True,
        "skill_set": ["Python", "C++", "System Design"],
        "core_skills": ["Data Structures", "Algorithms"],
        "description": "Join our Core Search team to build distributed systems. You will work on optimizing backend services using Python and C++, handling petabytes of data daily."
    }

    # 2. RUN PARSER (Simulates Heuristics + LLM + GitHub)
    print("\n[1/4] Running Parser (Extracting structured data)...")
    parser = ResumeParser()
    try:
        # We bypass file IO and test the internal logic directly
        parsed_result = parser.parse_text(resume_text) if hasattr(parser, 'parse_text') else None
        
        # If parse_text isn't exposed natively, we just call the internal parts
        if not parsed_result:
            sections, section_order = parser._split_into_sections(resume_text)
            contact = parser._extract_contact(resume_text, sections, [])
            education = parser._extract_education(resume_text, sections)
            skills = parser._extract_skills(resume_text, sections)
            experience = parser._extract_experience(resume_text, sections)
            projects = parser._extract_projects(resume_text, sections)
            
            # Simulate LLM extraction
            llm_data = {}
            if not MOCK_HEAVY_MODELS:
                llm_svc = LLMService()
                llm_data = llm_svc.extract_resume_data(resume_text) or {}
            else:
                llm_data = {"skills": ["System Design"]}
            
            parsed_data = {
                "contact": contact,
                "education": llm_data.get("education") or education,
                "skills": list(set(skills + llm_data.get("skills", []))),
                "experience": llm_data.get("experience") or experience,
                "projects": llm_data.get("projects") or projects,
                "section_order": section_order
            }
    except Exception as e:
        print(f"[ERROR] Parser failed: {e}")
        return

    print("[SUCCESS] Parsed Data generated:")
    print(f"   Name: {parsed_data['contact'].get('name')}")
    print(f"   Education: {parsed_data['education']}")

    # 3. RUN ATS SCORER
    print("\n[2/4] Running General ATS Scorer (Evaluating Resume Quality)...")
    ats_result = calculate_general_score(parsed_data, resume_text)
    print(f"[SUCCESS] ATS Score: {ats_result['score']}/100")
    print(f"   Breakdown: {ats_result['breakdown']}")
    for fb in ats_result['feedback']:
        print(f"   Feedback: {fb}")

    # 4. RUN COMPANY MATCHER (Bi-Encoder + Cross-Encoder)
    print("\n[3/4] Running Company Matcher (Evaluating fit for Google SDE)...")
    
    if MOCK_HEAVY_MODELS:
        # Mock the heavy models inside the matcher instance before it runs
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
    print(f"[SUCCESS] Hard Filters Passed: {eligibility['eligible']}")
    if not eligibility['eligible']:
        print(f"   Reasons: {eligibility['reasons']}")
        
    # Check Soft Score
    if MOCK_HEAVY_MODELS:
        score_data = {"score": 85.5, "breakdown": {"skill_match": 35.0, "cross_encoder": 25.0, "branch_cpi_bonus": 15.0, "project_match": 10.5}}
    else:
        score_data = matcher.compute_company_score(parsed_data, company_data, resume_text, company_data["description"])
        
    print(f"✅ Soft Match Score: {score_data['score']}/100")
    print(f"   Breakdown: {score_data['breakdown']}")

    # 5. RUN GAP ANALYSIS (LLM Stage 3)
    print("\n[4/4] Running Stage 3 LLM Gap Analysis (Generating recruiter insights)...")
    
    if MOCK_HEAVY_MODELS:
        gap_analysis = "Based on the candidate's resume, they have a strong background in Python and React, which aligns well with the JD. However, they lack experience in C++, which is required for the Core Search team."
    else:
        llm_svc = LLMService()
        gap_analysis = llm_svc.generate_gap_analysis(resume_text, company_data["description"], score_data)
    
    print("\n[SUCCESS] Final Gap Analysis:")
    print("-" * 40)
    print(gap_analysis)
    print("-" * 40)

if __name__ == "__main__":
    run_test()
