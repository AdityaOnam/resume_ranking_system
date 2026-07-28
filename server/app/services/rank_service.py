from app.core.database import supabase
from app.core.config import settings
from app.services.company_matcher import CompanyMatcher


def generate_rankings(parsed_resume_data: dict, resume_text: str, companies: list, user_id: str) -> list:
    """
    Evaluates a single newly uploaded resume against a list of companies, and
    updates the ranks of that SAME USER's other resumes for each company.

    The ranking pool is scoped to `user_id` - it never reads or mutates another
    user's resumes - matching the isolation already enforced everywhere else in
    the app (GET /resumes/, all of analytics.py).
    """
    if not companies:
        raise ValueError('No companies provided for ranking')
    if not user_id:
        raise ValueError('user_id is required to scope the ranking pool')

    matcher = CompanyMatcher()
    embedding_engine = matcher._embedding_engine
    rankings = []

    # 0. Cheap bi-encoder embedding for this resume, used only to pre-filter
    # which companies are worth running the expensive CrossEncoder against.
    resume_embedding = None
    try:
        resume_embedding = embedding_engine.generate_resume_embedding(parsed_resume_data)
    except Exception as e:
        print(f"Failed to generate resume embedding for pre-filtering, skipping pre-filter: {e}")

    # 1. Hard filter + cheap similarity pass for every company
    candidates = []
    for company in companies:
        if not company.get('id'):
            continue
        try:
            eligibility = matcher.check_hard_filters(parsed_resume_data, company)

            jd_text = company.get("jd_text") or company.get("description", "")
            if not jd_text:
                role_text = company.get("role") or company.get("internship_role", "")
                jd_text = f"Role: {role_text}. Skills required: {', '.join(company.get('skill_set') or [])}."

            similarity = 0.0
            if eligibility["eligible"] and resume_embedding:
                jd_embedding = company.get("jd_embedding") or embedding_engine.generate_job_embedding(jd_text)
                similarity = embedding_engine.compute_similarity(resume_embedding, jd_embedding)

            candidates.append({
                'company': company,
                'jd_text': jd_text,
                'eligible': eligibility["eligible"],
                'eligibility_reasons': eligibility["reasons"],
                'similarity': similarity,
            })
        except Exception as e:
            print(f"Error during hard-filter/pre-filter for company {company.get('name')}: {e}")
            continue

    # 2. Only the top-K most similar ELIGIBLE companies get the expensive
    # CrossEncoder pass; every other eligible company is still scored on the
    # remaining 70 points, just without that component. This is what keeps a
    # single upload from running a transformer cross-encoder pass against
    # every company in the database.
    eligible_sorted = sorted((c for c in candidates if c['eligible']), key=lambda x: x['similarity'], reverse=True)
    top_k_ids = {id(c) for c in eligible_sorted[:settings.RANKING_CROSS_ENCODER_TOP_K]}

    new_resume_scores = []
    for cand in candidates:
        company = cand['company']
        try:
            score_data = {"score": 0, "breakdown": {}}
            if cand['eligible']:
                score_data = matcher.compute_company_score(
                    parsed_resume_data, company, resume_text, cand['jd_text'],
                    skip_cross_encoder=(id(cand) not in top_k_ids),
                )

            new_resume_scores.append({
                'company': company,
                'score': score_data["score"],
                'eligible': cand['eligible'],
                'eligibility_reasons': cand['eligibility_reasons'],
                'breakdown': score_data["breakdown"],
            })
        except Exception as e:
            print(f"Error calculating score for company {company.get('name')}: {e}")
            continue

    if not new_resume_scores:
        raise ValueError('Failed to calculate scores for any company')

    # 3. Re-rank against this user's OTHER existing resumes only
    res = supabase.table('resumes').select('id, rankings').eq('user_id', user_id).execute()
    existing_resumes = res.data or []

    # Batched write state: one full `rankings` write per affected resume (not
    # per company x resume), and one deduped upsert list for the rankings
    # table, flushed once at the end.
    resume_rankings_by_id = {}
    ranking_rows_to_upsert = []

    for new_score_item in new_resume_scores:
        company = new_score_item['company']
        new_score = new_score_item['score']
        company_id = company['id']

        # Collect scores of all of this user's OTHER existing resumes for this company
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

        # Calculate new mathematical ranks (competition ranking, ties share a rank
        # and the next distinct rank skips accordingly, e.g. 1,1,3,4)
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

        # Queue updates for existing resumes whose rank/score actually changed -
        # accumulate every company's changes per resume, and write each resume
        # exactly once at the end instead of once per company.
        for score_item in all_scores:
            resume = score_item['resume']
            if not resume:
                continue
            r_id = resume['id']
            r_rankings = resume_rankings_by_id.get(r_id)
            if r_rankings is None:
                r_rankings = list(resume.get('rankings') or [])
                resume_rankings_by_id[r_id] = r_rankings

            for r in r_rankings:
                if str(r.get('company')) == str(company_id):
                    changed = (
                        r.get('score') != score_item['score']
                        or r.get('rank') != score_item['rank']
                        or r.get('totalResumes') != len(all_scores)
                    )
                    if changed:
                        r['score'] = score_item['score']
                        r['rank'] = score_item['rank']
                        r['totalResumes'] = len(all_scores)
                        ranking_rows_to_upsert.append({
                            "resume_id": r_id,
                            "company_id": company_id,
                            "overall_score": score_item['score'],
                            "rank": score_item['rank'],
                        })
                    break

    # 4. Flush: one write per affected resume, one batched upsert to `rankings`
    for r_id, r_rankings in resume_rankings_by_id.items():
        supabase.table('resumes').update({'rankings': r_rankings}).eq('id', r_id).execute()

    if ranking_rows_to_upsert:
        try:
            for chunk in [ranking_rows_to_upsert[i:i + 100] for i in range(0, len(ranking_rows_to_upsert), 100)]:
                supabase.table('rankings').upsert(chunk).execute()
        except Exception as rank_err:
            print(f"Error batch-updating rankings table: {rank_err}")

    return rankings
