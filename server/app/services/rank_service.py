from app.core.database import supabase
from app.services.company_matcher import CompanyMatcher

async def generate_rankings(parsed_resume_data: dict, resume_text: str, companies: list) -> list:
    """
    Evaluates a single newly uploaded resume against a list of companies.
    Updates the global ranks of all resumes for each company.
    """
    if not companies:
        raise ValueError('No companies provided for ranking')

    matcher = CompanyMatcher()
    rankings = []
    
    # 1. Calculate Score for this new resume against all companies
    new_resume_scores = []
    for company in companies:
        if not company.get('id'):
            continue
        try:
            # 1a. Hard Filter
            eligibility = matcher.check_hard_filters(parsed_resume_data, company)
            
            # 1b. Soft Scoring (only if eligible, else 0)
            score_data = {"score": 0, "breakdown": {}}
            if eligibility["eligible"]:
                jd_text = company.get("description", "")
                if not jd_text:
                    jd_text = f"Role: {company.get('internship_role', '')}. Skills required: {', '.join(company.get('skill_set', []))}."
                score_data = matcher.compute_company_score(parsed_resume_data, company, resume_text, jd_text)
                
            new_resume_scores.append({
                'company': company,
                'score': score_data["score"],
                'eligible': eligibility["eligible"],
                'eligibility_reasons': eligibility["reasons"],
                'breakdown': score_data["breakdown"]
            })
        except Exception as e:
            print(f"Error calculating score for company {company.get('name')}: {e}")
            continue

    if not new_resume_scores:
        raise ValueError('Failed to calculate scores for any company')

    # 2. Re-rank against all existing resumes in DB
    res = supabase.table('resumes').select('id, rankings').execute()
    existing_resumes = res.data

    for new_score_item in new_resume_scores:
        company = new_score_item['company']
        new_score = new_score_item['score']
        company_id = company['id']

        # Collect scores of all EXISTING resumes for this specific company
        company_scores = []
        for resume in existing_resumes:
            r_rankings = resume.get('rankings') or []
            ranking = next((r for r in r_rankings if str(r.get('company')) == str(company_id)), None)
            if ranking:
                company_scores.append({
                    'resume': resume,
                    'score': ranking.get('score', 0)
                })

        # Add the NEW resume to the comparison pool
        all_scores = [{'resume': None, 'score': new_score}] + company_scores
        
        # Sort descending by score
        all_scores.sort(key=lambda x: x['score'], reverse=True)

        # Calculate new mathematical ranks (handling ties)
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

        # Extract the NEW resume's rank to return to the frontend
        new_resume_ranking = next((s for s in all_scores if s['resume'] is None), None)
        if new_resume_ranking:
            rankings.append({
                'company': company_id,
                'companyName': company.get('name'),
                'score': new_resume_ranking['score'],
                'rank': new_resume_ranking['rank'],
                'totalResumes': len(all_scores),
                'eligible': new_score_item['eligible'],
                'eligibility_reasons': new_score_item['eligibility_reasons'],
                'score_breakdown': new_score_item['breakdown']
            })

        # Update EXISTING resumes in Supabase with their potentially dropped rank
        for score_item in all_scores:
            if score_item['resume']:
                r_id = score_item['resume']['id']
                r_rankings = score_item['resume']['rankings']
                for r in r_rankings:
                    if str(r.get('company')) == str(company_id):
                        r['score'] = score_item['score']
                        r['rank'] = score_item['rank']
                        r['totalResumes'] = len(all_scores)
                        # We don't overwrite their eligible status here as we didn't recompute it, 
                        # we just adjusted their rank.
                
                # Execute individual update
                supabase.table('resumes').update({'rankings': r_rankings}).eq('id', r_id).execute()

    return rankings
