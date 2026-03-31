from app.services.rank_generator import calculate_score
from app.core.database import supabase

def generate_ranking_score(resume_data: dict, company_data: dict) -> float:
    # Safely extract dictionary values accounting for varied formats
    cpi = resume_data.get('CPI/GPA') or resume_data.get('CPI') or 0
    skills = resume_data.get('Skills') or resume_data.get('Skill_Set') or []
    projects = resume_data.get('No_of_Projects') or resume_data.get('Projects') or 0
    proj_keywords = resume_data.get('Project_Keywords') or []
    mobile = resume_data.get('Mobile_Number') or resume_data.get('Mobile') or ""
    email = resume_data.get('Email_ID') or resume_data.get('Email') or ""
    experience_raw = resume_data.get('Experience', 'No')
    experience = 1 if experience_raw == 'Yes' else 0
    
    core_skills_raw = resume_data.get('Core_Computer_Skills', '')
    core_skills = [s.strip() for s in core_skills_raw.split(',')] if core_skills_raw else []
    branch = resume_data.get('Branch') or ''

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
