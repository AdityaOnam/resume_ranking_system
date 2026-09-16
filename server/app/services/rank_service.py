import concurrent.futures
import logging

from app.core.database import supabase
from app.core.config import settings
from app.services.company_matcher import CompanyMatcher

logger = logging.getLogger(__name__)

# Parallelism for the per-resume rankings write-back. Kept modest so a large
# ranking pass doesn't open a burst of connections against Supabase.
RESUME_WRITE_CONCURRENCY = 8


def rank_resumes_for_company(company: dict, resumes: list) -> dict:
    """Score MANY resumes against ONE company in a single batched pass.

    Used when a new company is created and every existing resume must be
    re-scored against it. The previous approach called generate_rankings once
    per resume, which meant per resume: one `resumes` SELECT, one skill-cache
    warm, and one single-pair CrossEncoder predict. This inverts the loop so the
    company's JD is encoded once and all resumes go through the CrossEncoder in
    one batch.

    Ranks are computed per-user, matching generate_rankings' isolation: a
    resume's rank is its position among that same user's resumes only.

    Returns {resume_id: ranking_entry_dict} for resumes that scored.
    """
    matcher = CompanyMatcher()
    matcher._ensure_initialized()
    embedding_engine = matcher._embedding_engine

    jd_text = company.get("jd_text") or company.get("description", "")
    if not jd_text:
        role_text = company.get("role") or company.get("internship_role", "")
        jd_text = f"Role: {role_text}. Skills required: {', '.join(company.get('skill_set') or [])}."

    # Warm the whole skill vocabulary once for the batch, not once per resume.
    vocabulary = [s for s in ((company.get("skill_set") or []) + (company.get("core_skills") or [])) if s]
    prepared = []
    for row in resumes:
        parsed = row.get("parsed_data") or row
        vocabulary.extend(
            s.get("name", "") if isinstance(s, dict) else str(s)
            for s in (parsed.get("skills") or [])
        )
        prepared.append((row, parsed))
    try:
        if vocabulary:
            embedding_engine._warm_skill_cache(vocabulary)
    except Exception as e:
        logger.warning(f"Skill-cache pre-warm failed during company re-rank: {e}")

    # Hard-filter first, and flatten each eligible resume once.
    eligible = []
    results = {}
    for row, parsed in prepared:
        try:
            elig = matcher.check_hard_filters(parsed, company)
            if not elig["eligible"]:
                results[row["id"]] = {
                    "row": row, "score": 0.0, "eligible": False,
                    "eligibility_reasons": elig["reasons"], "breakdown": {},
                }
                continue
            eligible.append((row, parsed, embedding_engine._flatten_resume(parsed)))
        except Exception:
            logger.exception(f"Hard filter failed for resume {row.get('id')}; skipping.")

    # ONE batched CrossEncoder pass across every eligible resume.
    cross_scores = [0.0] * len(eligible)
    if eligible:
        try:
            cross_scores = matcher.batch_cross_encoder_scores_for_resumes(
                jd_text, [enriched for _, _, enriched in eligible]
            )
        except Exception as e:
            logger.error(f"Batched cross-encoder failed during company re-rank: {e}")

    for idx, (row, parsed, enriched) in enumerate(eligible):
        try:
            score_data = matcher.compute_company_score(
                parsed, company, row.get("raw_text") or row.get("resume_text", ""), jd_text,
                enriched_text=enriched, precomputed_cross_encoder=cross_scores[idx],
            )
            results[row["id"]] = {
                "row": row, "score": score_data["score"], "eligible": True,
                "eligibility_reasons": [], "breakdown": score_data["breakdown"],
            }
        except Exception:
            logger.exception(f"Scoring failed for resume {row.get('id')}; skipping.")

    # Rank within each user's own pool (competition ranking: 1,1,3,4).
    by_user = {}
    for resume_id, item in results.items():
        by_user.setdefault(item["row"].get("user_id"), []).append((resume_id, item))

    entries = {}
    for user_id, items in by_user.items():
        items.sort(key=lambda x: x[1]["score"], reverse=True)
        total = len(items)
        current_rank, current_score, seen = 1, items[0][1]["score"], 0
        for idx, (resume_id, item) in enumerate(items):
            if item["score"] < current_score:
                current_rank += seen + 1
                current_score = item["score"]
                seen = 0
            else:
                seen += 1 if idx > 0 else 0
            entries[resume_id] = {
                "company": company["id"],
                "companyName": company.get("name"),
                "score": item["score"],
                "rank": current_rank,
                "totalResumes": total,
                "eligible": item["eligible"],
                "eligibility_reasons": item["eligibility_reasons"],
                "score_breakdown": item["breakdown"],
            }
    return entries


def generate_rankings(parsed_resume_data: dict, resume_text: str, companies: list, user_id: str,
                      resume_embedding: list = None) -> list:
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
    matcher._ensure_initialized()
    embedding_engine = matcher._embedding_engine
    rankings = []

    # 0. Cheap bi-encoder embedding for this resume, used only to pre-filter
    # which companies are worth running the expensive CrossEncoder against.
    # The caller may pass one in (the upload path already needs this exact
    # vector to persist on the resume row) so we don't encode the same resume
    # twice per upload.
    if resume_embedding is None:
        try:
            resume_embedding = embedding_engine.generate_resume_embedding(parsed_resume_data)
        except Exception as e:
            print(f"Failed to generate resume embedding for pre-filtering, skipping pre-filter: {e}")

    # The flattened resume text is candidate-only - identical for every company -
    # so build it once here instead of rebuilding it inside the scoring loop.
    try:
        enriched_text = embedding_engine._flatten_resume(parsed_resume_data)
    except Exception as e:
        print(f"Failed to flatten resume for cross-encoder: {e}")
        enriched_text = ""

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
            # `is not None` rather than truthiness: a numpy array raises
            # "truth value is ambiguous" under `if arr:`.
            if eligibility["eligible"] and resume_embedding is not None:
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

    # 1b. Warm the skill-embedding cache for the ENTIRE vocabulary in one
    # batched model call, before any per-company scoring runs.
    #
    # Without this, each company batches only its own ~5 skills, so a cold cache
    # means ~138 separate encode() calls instead of one - and the cache is a
    # per-process dict, so it starts cold on every Cloud Run cold start, which
    # with min-instances=0 is most uploads. Measured: 1.64s -> 0.31s locally,
    # and the gap widens on the single vCPU used in production.
    #
    # This supersedes persisting per-company skill vectors in the database: same
    # saving, no schema change, no backfill, and nothing to go stale when a
    # company's skill list is edited.
    try:
        vocabulary = [
            s for cand in candidates if cand['eligible']
            for s in ((cand['company'].get('skill_set') or []) + (cand['company'].get('core_skills') or []))
            if s
        ]
        vocabulary.extend(
            s.get("name", "") if isinstance(s, dict) else str(s)
            for s in (parsed_resume_data.get("skills") or [])
        )
        if vocabulary:
            embedding_engine._warm_skill_cache(vocabulary)
    except Exception as e:
        print(f"Skill-cache pre-warm failed (scoring will still work, just slower): {e}")

    # 2. Only the top-K most similar ELIGIBLE companies get the expensive
    # CrossEncoder pass; every other eligible company is still scored on the
    # remaining 70 points, just without that component. This is what keeps a
    # single upload from running a transformer cross-encoder pass against
    # every company in the database.
    eligible_sorted = sorted((c for c in candidates if c['eligible']), key=lambda x: x['similarity'], reverse=True)
    top_k = eligible_sorted[:settings.RANKING_CROSS_ENCODER_TOP_K]
    top_k_ids = {id(c) for c in top_k}

    # Run ONE batched CrossEncoder pass for all top-K companies rather than a
    # separate single-pair predict() per company.
    cross_encoder_by_id = {}
    if top_k and enriched_text:
        try:
            batched = matcher.batch_cross_encoder_scores([c['jd_text'] for c in top_k], enriched_text)
            cross_encoder_by_id = {id(c): score for c, score in zip(top_k, batched)}
        except Exception as e:
            print(f"Batched cross-encoder pass failed, falling back to per-company: {e}")

    new_resume_scores = []
    for cand in candidates:
        company = cand['company']
        try:
            score_data = {"score": 0, "breakdown": {}}
            if cand['eligible']:
                is_top_k = id(cand) in top_k_ids
                score_data = matcher.compute_company_score(
                    parsed_resume_data, company, resume_text, cand['jd_text'],
                    skip_cross_encoder=not is_top_k,
                    enriched_text=enriched_text or None,
                    precomputed_cross_encoder=cross_encoder_by_id.get(id(cand)),
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
    #
    # These updates were previously issued strictly one after another, each
    # blocking on a full HTTPS round-trip to Supabase. That made upload latency
    # scale with how many resumes the user had already uploaded - the dominant
    # cost for heavy users. Running them on a small thread pool keeps exact
    # UPDATE semantics (an upsert would rewrite whole rows) while collapsing N
    # sequential round-trips into N/8.
    def _write_resume_rankings(item):
        r_id, r_rankings = item
        try:
            supabase.table('resumes').update({'rankings': r_rankings}).eq('id', r_id).execute()
        except Exception as e:
            print(f"Failed to update rankings for resume {r_id}: {e}")

    if resume_rankings_by_id:
        items = list(resume_rankings_by_id.items())
        if len(items) == 1:
            _write_resume_rankings(items[0])
        else:
            with concurrent.futures.ThreadPoolExecutor(max_workers=RESUME_WRITE_CONCURRENCY) as pool:
                list(pool.map(_write_resume_rankings, items))

    if ranking_rows_to_upsert:
        try:
            for chunk in [ranking_rows_to_upsert[i:i + 100] for i in range(0, len(ranking_rows_to_upsert), 100)]:
                supabase.table('rankings').upsert(chunk, on_conflict="resume_id,company_id").execute()
        except Exception as rank_err:
            print(f"Error batch-updating rankings table: {rank_err}")

    return rankings
