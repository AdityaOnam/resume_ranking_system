from app.services.rank_generator import calculate_score
from app.core.database import supabase

def generate_ranking_score(resume_data: dict, company_data: dict) -> float:
    # resume_data is now parsed_data from v2 parser
    
    # Safely extract dictionary values accounting for new v2 formats
    education = resume_data.get('education') or []
    cpi = 0
    branch = ''
    if education and len(education) > 0:
        cpi = education[0].get('gpa') or 0
        branch = education[0].get('field') or ''
        
    skills = resume_data.get('skills') or []
    
    projects_list = resume_data.get('projects') or []
    projects = len(projects_list)
    proj_keywords = []
    for p in projects_list:
        proj_keywords.extend(p.get('technologies', []))
        
    contact = resume_data.get('contact') or {}
    mobile = contact.get('phone') or ""
    email = contact.get('email') or ""
    
    experience_list = resume_data.get('experience') or []
    experience = 1 if len(experience_list) > 0 else 0
    
    core_skills = skills # Using all skills as core since v2 parses precisely

    transformed_resume_data = {
        'CPI': cpi,
        'Skill_Set': list(set(skills)),
        'Projects': projects,
        'Project_Keywords': list(set(proj_keywords)),
        'Mobile': mobile,
        'Email': email,
        'Experience': experience,
        'Core_Skills': list(set(core_skills)),
        'Branch': branch
    }

    transformed_company_data = {
        'Company_Name': company_data.get('name'),
        'CPI': company_data.get('cpi', 0),
        'Skill_Set': company_data.get('skill_set', []),
        'Min_Projects': company_data.get('min_projects', 0),
        'Project_Keywords': company_data.get('project_keywords', []),
        'Branch': company_data.get('branch', []),
        'Core_Skills': company_data.get('core_skills', [])
    }
    
    return calculate_score(transformed_resume_data, transformed_company_data)

async def generate_rankings(resume_data: dict, companies: list) -> list:
    if not companies:
        raise ValueError('No companies provided for ranking')

    rankings = []
    
    # Calculate score against all companies for the new resume
    new_resume_scores = []
    for company in companies:
        if not company.get('id'):
            continue
        try:
            score = generate_ranking_score(resume_data, company)
            new_resume_scores.append({
                'company': company,
                'score': score
            })
        except Exception as e:
            print(f"Error calculating score for company {company.get('name')}: {e}")
            continue

    if not new_resume_scores:
        raise ValueError('Failed to calculate scores for any company')

    company_ids = [c['company']['id'] for c in new_resume_scores]
    
    # Get all existing resumes with their rankings
    res = supabase.table('resumes').select('id, rankings').execute()
    existing_resumes = res.data

    for new_score_item in new_resume_scores:
        company = new_score_item['company']
        new_score = new_score_item['score']
        company_id = company['id']

        company_scores = []
        for resume in existing_resumes:
            r_rankings = resume.get('rankings') or []
            ranking = next((r for r in r_rankings if str(r.get('company')) == str(company_id)), None)
            if ranking:
                company_scores.append({
                    'resume': resume,
                    'score': ranking.get('score', 0)
                })

        # Add new resume to the comparison list
        all_scores = [{'resume': None, 'score': new_score}] + company_scores
        
        # Sort scores descending
        all_scores.sort(key=lambda x: x['score'], reverse=True)

        current_rank = 1
        current_score = all_scores[0]['score'] if all_scores else 0
        skip_count = 0

        for idx, item in enumerate(all_scores):
            if item['score'] < current_score:
                current_rank += skip_count + 1
                current_score = item['score']
                skip_count = 0
            else:
                skip_count += 1 if idx > 0 else 0
            item['rank'] = current_rank

        new_resume_ranking = next((s for s in all_scores if s['resume'] is None), None)
        if new_resume_ranking:
            rankings.append({
                'company': company_id,
                'companyName': company.get('name'),
                'score': new_resume_ranking['score'],
                'rank': new_resume_ranking['rank'],
                'totalResumes': len(all_scores)
            })

        # Update existing resumes with new ranks
        for score_item in all_scores:
            if score_item['resume']:
                r_id = score_item['resume']['id']
                r_rankings = score_item['resume']['rankings']
                for r in r_rankings:
                    if str(r.get('company')) == str(company_id):
                        r['score'] = score_item['score']
                        r['rank'] = score_item['rank']
                        r['totalResumes'] = len(all_scores)
                # Note: Supabase bulk updates are tricky, individual update inside loop:
                supabase.table('resumes').update({'rankings': r_rankings}).eq('id', r_id).execute()

    return rankings
