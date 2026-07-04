import re
import spacy
from typing import Dict, Any, List
import logging
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)

# Re-use the existing spacy model loaded in resume_parser
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    import subprocess, sys
    subprocess.run([sys.executable, "-m", "spacy", "download", "en_core_web_sm"], check=True)
    nlp = spacy.load("en_core_web_sm")

def calculate_general_score(parsed_data: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
    """
    Calculates a general, absolute ATS score (0-100) based on resume quality.
    Evaluates contact info, section ordering, quantifiable metrics, action verbs, and keyword density.
    """
    score = 0.0
    breakdown = {}
    feedback = []

    # 1. Contact Info Completeness (15 points max)
    contact = parsed_data.get("contact", {})
    contact_score = 0
    if contact.get("email"): contact_score += 5
    else: feedback.append("Missing email address.")
    
    if contact.get("phone"): contact_score += 5
    else: feedback.append("Missing phone number.")
    
    if contact.get("linkedin") or contact.get("github"): contact_score += 5
    else: feedback.append("Missing LinkedIn or GitHub profile link.")
    
    score += contact_score
    breakdown["contact_info"] = contact_score

    # 2. Formatting & Section Ordering (20 points max)
    format_score = 20
    section_order = parsed_data.get("section_order", [])
    
    # Check if standard sections exist
    has_edu = "education" in section_order
    has_exp = "experience" in section_order
    has_skills = "skills" in section_order
    has_proj = "projects" in section_order
    
    missing_sections = []
    if not has_edu: missing_sections.append("Education")
    if not has_exp and not has_proj: missing_sections.append("Experience/Projects")
    if not has_skills: missing_sections.append("Skills")
    
    if missing_sections:
        penalty = len(missing_sections) * 5
        format_score -= penalty
        feedback.append(f"Missing critical sections: {', '.join(missing_sections)}.")
    
    # Check relative positioning (Education should ideally be near the top, usually before experience/projects for students)
    if section_order:
        try:
            edu_idx = section_order.index("education") if has_edu else -1
            exp_idx = section_order.index("experience") if has_exp else 999
            proj_idx = section_order.index("projects") if has_proj else 999
            
            # If education is placed very low (after experience AND projects), penalize
            if edu_idx > exp_idx and edu_idx > proj_idx:
                format_score -= 5
                feedback.append("Consider moving Education higher up if you are a student or recent graduate.")
        except ValueError:
            pass
            
    # Cap at 0
    format_score = max(0, format_score)
    score += format_score
    breakdown["formatting_and_ordering"] = format_score

    # NLP Analysis prep: Analyze descriptions from Experience and Projects
    descriptions = []
    for exp in parsed_data.get("experience", []):
        if exp.get("description"): descriptions.append(exp["description"])
    for proj in parsed_data.get("projects", []):
        if proj.get("description"): descriptions.append(proj["description"])
        
    combined_desc_text = " \n ".join(descriptions)
    
    # Fallback to raw text if no structured descriptions found
    analysis_text = combined_desc_text if len(combined_desc_text.strip()) > 50 else raw_text

    # 3. Quantifiable Metrics (25 points max)
    # Looking for numbers, percentages, money symbols (e.g., 20%, $5M, 100x, 50+)
    metric_score = 0
    number_matches = re.findall(r'\b\d+(?:%|k|m|b|x|\+)?\b|\$\d+', analysis_text, re.IGNORECASE)
    
    # Ignore dates/years (roughly 1990-2030)
    valid_metrics = [m for m in number_matches if not re.match(r'^(19|20)\d{2}$', m)]
    
    if len(valid_metrics) >= 5:
        metric_score = 25
        feedback.append("Excellent use of quantifiable metrics. This gives recruiters a strong understanding of your impact.")
    else:
        metric_score = len(valid_metrics) * 5
        feedback.append(f"Found few quantifiable metrics ({len(valid_metrics)}). Try to quantify your impact (e.g., 'increased performance by 20%').")
        
    score += metric_score
    breakdown["quantifiable_metrics"] = metric_score

    # 4. Action Verbs (25 points max)
    action_verb_score = 0
    if len(analysis_text.strip()) > 0:
        doc = nlp(analysis_text)
        # Find root verbs or past tense verbs
        action_verbs = [token.lemma_.lower() for token in doc if token.pos_ == "VERB" and (token.dep_ == "ROOT" or token.tag_ in ["VBD", "VBN"])]
        
        # We look for a healthy variety of strong action verbs
        unique_verbs = set(action_verbs)
        
        if len(unique_verbs) >= 10:
            action_verb_score = 25
        else:
            action_verb_score = int((len(unique_verbs) / 10) * 25)
            feedback.append(f"Use more strong, varied action verbs (found {len(unique_verbs)}). Start bullet points with words like 'Developed', 'Led', 'Optimized'.")
    else:
        feedback.append("Not enough description text found to evaluate action verbs.")
        
    score += action_verb_score
    breakdown["action_verbs"] = action_verb_score

    # 5. Keyword Density (15 points max)
    # Check if the extracted skills are actually mentioned in the experience/project descriptions
    keyword_score = 0
    skills = parsed_data.get("skills", [])
    if skills and len(analysis_text.strip()) > 0:
        analysis_text_lower = analysis_text.lower()
        applied_skills = 0
        all_skill_names = [s.get("name", "").lower() if isinstance(s, dict) else str(s).lower() for s in skills]
        has_dsa = any(k in s for k in ["data structures", "algorithms", "competitive programming"] for s in all_skill_names)

        for skill_entry in skills:
            skill_name = skill_entry.get("name", "") if isinstance(skill_entry, dict) else str(skill_entry)
            if not skill_name: continue
            
            skill_lower = skill_name.lower()
            if skill_lower in analysis_text_lower:
                applied_skills += 1
            # Special case: C++, C, or Java often don't have project proof if used purely for DSA
            elif has_dsa and skill_lower in ["c++", "c", "java", "python"]:
                applied_skills += 1
                
        density_ratio = applied_skills / len(skills)
        if density_ratio >= 0.7:
            keyword_score = 15
        elif density_ratio >= 0.4:
            keyword_score = 10
            feedback.append("Ensure you elaborate on how you used your listed skills within your experience/projects descriptions.")
        else:
            keyword_score = 5
            feedback.append("Many of your listed skills are not mentioned in your project/experience descriptions. Contextualize your skills.")
    elif skills:
         keyword_score = 5
         feedback.append("Could not verify skill usage due to missing descriptions.")
    else:
         keyword_score = 0
         feedback.append("No skills detected.")
         
    score += keyword_score
    breakdown["keyword_density"] = keyword_score

    result = {
        "score": int(score),
        "breakdown": breakdown,
        "feedback": feedback
    }

    # Generate LLM Gap Analysis
    llm = LLMService()
    gap_analysis = llm.generate_general_ats_feedback(raw_text, result)
    result["gap_analysis"] = gap_analysis

    return result
