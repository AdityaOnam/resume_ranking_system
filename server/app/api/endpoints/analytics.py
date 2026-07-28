from fastapi import APIRouter, Depends
from app.core.database import supabase
from app.core.security import get_current_user, User
import json

router = APIRouter()

def _parse_json_field(value):
    if value is None: return []
    if isinstance(value, list): return value
    if isinstance(value, str):
        try: return json.loads(value)
        except: return []
    return []

@router.get("/missing-skills")
def get_missing_skills(current_user: User = Depends(get_current_user)):
    """
    For every company, get its required_skills.
    For every resume (belonging to this user), get its skills.
    For each required skill: count how many resumes DON'T have it.
    Return top 15 most-missing skills with missing count and % missing.
    """
    resumes_res = supabase.table("resumes").select("skills").eq("user_id", current_user.id).execute()
    companies_res = supabase.table("companies").select("skill_set, name").execute()
    
    resumes = resumes_res.data or []
    companies = companies_res.data or []
    
    # Normalize all resume skill names to lowercase set
    resume_skill_sets = []
    for r in resumes:
        skills = _parse_json_field(r.get("skills"))
        names = set()
        for s in skills:
            if isinstance(s, dict): names.add(s.get("name", "").lower().strip())
            elif isinstance(s, str): names.add(s.lower().strip())
        resume_skill_sets.append(names)
    
    # Collect all required skills from all companies
    all_required = {}  # skill_name -> set of company names that require it
    for c in companies:
        req = _parse_json_field(c.get("skill_set"))
        for skill in req:
            skill_lower = skill.lower().strip()
            if skill_lower not in all_required:
                all_required[skill_lower] = {"companies": [], "display": skill}
            all_required[skill_lower]["companies"].append(c.get("name", ""))
    
    total_resumes = len(resume_skill_sets)
    if total_resumes == 0:
        return []
    
    # For each required skill, count resumes missing it
    result = []
    for skill_lower, meta in all_required.items():
        missing_count = sum(1 for rs in resume_skill_sets if skill_lower not in rs)
        result.append({
            "skill": meta["display"],
            "missing_count": missing_count,
            "missing_pct": round((missing_count / total_resumes) * 100, 1),
            "required_by": len(meta["companies"]),
            "companies": meta["companies"][:5]
        })
    
    result.sort(key=lambda x: x["missing_pct"], reverse=True)
    return result[:15]

@router.get("/company-demand")
def get_company_demand(current_user: User = Depends(get_current_user)):
    """
    Aggregate all required_skills across all companies.
    Returns top 20 most-demanded skills with demand count.
    """
    companies_res = supabase.table("companies").select("name, skill_set").execute()
    companies = companies_res.data or []
    
    skill_demand = {}
    for c in companies:
        req = _parse_json_field(c.get("skill_set"))
        for skill in req:
            s = skill.strip()
            skill_demand[s] = skill_demand.get(s, 0) + 1
    
    sorted_demand = sorted(skill_demand.items(), key=lambda x: x[1], reverse=True)
    return [{"skill": k, "count": v, "companies": v} for k, v in sorted_demand[:20]]

@router.get("/insights")
def get_ai_insights(current_user: User = Depends(get_current_user)):
    """
    Deterministic template-based insights. No LLM call.
    Computes key stats and returns 5-6 insight strings.
    """
    resumes_res = supabase.table("resumes").select("ats_score, ats_breakdown, skills, rankings, experience, education").eq("user_id", current_user.id).execute()
    companies_res = supabase.table("companies").select("name, skill_set").execute()
    
    resumes = resumes_res.data or []
    companies = companies_res.data or []
    insights = []
    
    if not resumes:
        return {"insights": ["Upload resumes to see AI-generated insights."]}
    
    total = len(resumes)
    
    # Insight 1: Quantifiable metrics
    low_metrics = sum(1 for r in resumes if (r.get("ats_breakdown") or {}).get("quantifiable_metrics", 25) < 12)
    if low_metrics > 0:
        pct = round((low_metrics / total) * 100)
        insights.append(f"{pct}% of resumes lack measurable achievements. Encourage students to quantify their impact (e.g., 'improved performance by 20%').")
    
    # Insight 2: Top missing skill vs company demand
    resume_skill_sets = []
    for r in resumes:
        skills = _parse_json_field(r.get("skills"))
        names = set()
        for s in skills:
            if isinstance(s, dict): names.add(s.get("name", "").lower())
            elif isinstance(s, str): names.add(s.lower())
        resume_skill_sets.append(names)
    
    all_required = {}
    for c in companies:
        req = _parse_json_field(c.get("skill_set"))
        for skill in req:
            s = skill.lower().strip()
            all_required[s] = all_required.get(s, 0) + 1
    
    if all_required and resume_skill_sets:
        for skill_lower, demand_count in sorted(all_required.items(), key=lambda x: x[1], reverse=True)[:5]:
            have_count = sum(1 for rs in resume_skill_sets if skill_lower in rs)
            have_pct = round((have_count / total) * 100)
            req_pct = round((demand_count / len(companies)) * 100)
            if have_pct < 30 and req_pct > 30:
                display = skill_lower.title()
                insights.append(f"{display} appears in only {have_pct}% of resumes, but is required by {req_pct}% of companies.")
                break
    
    # Insight 3: Experience vs ATS
    with_exp = [r for r in resumes if _parse_json_field(r.get("experience"))]
    without_exp = [r for r in resumes if not _parse_json_field(r.get("experience"))]
    if with_exp and without_exp:
        avg_with = round(sum(r.get("ats_score", 0) for r in with_exp) / len(with_exp))
        avg_without = round(sum(r.get("ats_score", 0) for r in without_exp) / len(without_exp))
        diff = avg_with - avg_without
        if diff > 5:
            insights.append(f"Candidates with work experience score {diff} points higher on ATS on average ({avg_with} vs {avg_without}).")
    
    # Insight 4: Action verbs
    low_verbs = sum(1 for r in resumes if (r.get("ats_breakdown") or {}).get("action_verbs", 25) < 12)
    if low_verbs > total * 0.3:
        pct = round((low_verbs / total) * 100)
        insights.append(f"{pct}% of resumes use weak or passive language. Coach students to start bullet points with strong action verbs.")
    
    # Insight 5: Formatting
    low_format = sum(1 for r in resumes if (r.get("ats_breakdown") or {}).get("formatting_and_ordering", 20) < 12)
    if low_format > 0:
        pct = round((low_format / total) * 100)
        insights.append(f"Formatting issues detected in {pct}% of resumes — missing standard sections or poor section ordering.")
    
    # Insight 6: Overall average
    avg_ats = round(sum(r.get("ats_score", 0) for r in resumes) / total)
    eligible_count = sum(1 for r in resumes if any(x.get("eligible") for x in _parse_json_field(r.get("rankings"))))
    eligible_pct = round((eligible_count / total) * 100)
    insights.append(f"Average ATS score is {avg_ats}/100. {eligible_pct}% of candidates qualify for at least one company.")
    
    return {"insights": insights[:6]}

@router.get("/department-comparison")
def get_department_comparison(current_user: User = Depends(get_current_user)):
    """
    Group resumes by education field/branch, compute avg ATS per group.
    """
    resumes_res = supabase.table("resumes").select("ats_score, education").eq("user_id", current_user.id).execute()
    resumes = resumes_res.data or []
    
    dept_scores = {}
    for r in resumes:
        edu = _parse_json_field(r.get("education"))
        field = None
        for e in edu:
            field = e.get("field") or e.get("degree")
            if field: break
        dept = (field or "Unknown").strip()[:30]  # cap length
        if dept not in dept_scores:
            dept_scores[dept] = []
        dept_scores[dept].append(r.get("ats_score") or 0)
    
    result = []
    for dept, scores in dept_scores.items():
        result.append({
            "department": dept,
            "avg_ats": round(sum(scores) / len(scores), 1),
            "count": len(scores)
        })
    
    return sorted(result, key=lambda x: x["avg_ats"], reverse=True)

@router.get("/ats-history")
def get_ats_history(current_user: User = Depends(get_current_user)):
    """
    Returns the ATS score history for the current user, grouped by week.
    Used for the ATS trend chart.
    """
    res = supabase.table("ats_history") \
        .select("ats_score, created_at, name, email") \
        .eq("user_id", current_user.id) \
        .order("created_at", desc=False) \
        .execute()
    return res.data or []

@router.get("/version-comparison")
def get_version_comparison(current_user: User = Depends(get_current_user)):
    """
    Returns per-candidate ATS score progression (for candidates who uploaded multiple times).
    Grouped by email, returns list of {name, email, versions: [{ats_score, created_at}]}
    """
    res = supabase.table("ats_history") \
        .select("ats_score, created_at, name, email") \
        .eq("user_id", current_user.id) \
        .order("created_at", desc=True) \
        .execute()
    
    by_email = {}
    for row in (res.data or []):
        email = row["email"]
        if email not in by_email:
            by_email[email] = {"name": row["name"], "email": email, "versions": []}
        by_email[email]["versions"].append({"ats_score": row["ats_score"], "created_at": row["created_at"]})
    
    # Only return candidates with multiple versions
    multi = [v for v in by_email.values() if len(v["versions"]) > 1]
    return sorted(multi, key=lambda x: len(x["versions"]), reverse=True)
