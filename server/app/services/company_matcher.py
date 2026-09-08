import json
import os
import logging
import math
from typing import Dict, Any, List, Optional, Sequence
from app.core.config import settings

logger = logging.getLogger(__name__)


def _sigmoid(logit: float) -> float:
    """Numerically stable logistic function (plain 1/(1+exp(-x)) overflows for large negative x)."""
    if logit >= 0:
        return 1.0 / (1.0 + math.exp(-logit))
    exp_logit = math.exp(logit)
    return exp_logit / (1.0 + exp_logit)

_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")

def _load_branch_mapping() -> Dict[str, List[str]]:
    path = os.path.join(_DATA_DIR, "branch_mapping.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning(f"branch_mapping.json not found at {path}, using empty map.")
        return {}

BRANCH_MAPPING = _load_branch_mapping()

class CompanyMatcher:
    """
    Singleton service for handling company specific matching (Hard Filters, Soft Scoring, Cross-Encoder).
    """
    _instance = None
    _cross_encoder = None
    _embedding_engine = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CompanyMatcher, cls).__new__(cls)
        return cls._instance

    def _ensure_initialized(self):
        """Lazily load models on first use."""
        if self._embedding_engine is not None:
            return
        from sentence_transformers.cross_encoder import CrossEncoder
        from app.services.embedding_engine import EmbeddingEngine
        self._embedding_engine = EmbeddingEngine()
        model_name = settings.CROSS_ENCODER_MODEL_NAME
        logger.info(f"Loading CrossEncoder model: {model_name} (cache: {settings.MODEL_CACHE_DIR})...")
        try:
            self._cross_encoder = CrossEncoder(model_name, cache_folder=settings.MODEL_CACHE_DIR)
            logger.info("CrossEncoder loaded successfully.")
        except Exception as e:
            # Non-fatal so uploads still complete, but this must not pass quietly:
            # without the CrossEncoder every candidate silently forfeits the full
            # 30-point semantic component, which looks like "bad scores" rather
            # than a broken deployment.
            logger.critical(
                f"SCORING DEGRADED: failed to load CrossEncoder {model_name} from "
                f"cache '{settings.MODEL_CACHE_DIR}': {e}. All match scores will be "
                "missing the 30-point cross-encoder component until this is fixed."
            )
            self._cross_encoder = None

    # --- HARD FILTERS ---

    def check_hard_filters(self, candidate_data: Dict[str, Any], company_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Binary Pass/Fail gates based on strict company requirements.
        Returns {"eligible": bool, "reasons": []}
        """
        reasons = []
        eligible = True

        # 1. CPI/GPA Cutoff
        company_cpi = float(company_data.get("min_gpa") or company_data.get("cpi", 0.0))
        
        education_list = candidate_data.get("education", [])
        candidate_cpi = 0.0
        if education_list:
            try:
                candidate_cpi = float(education_list[0].get("gpa") or 0.0)
            except (ValueError, TypeError):
                candidate_cpi = 0.0

        if company_cpi > 0 and candidate_cpi < company_cpi:
            eligible = False
            reasons.append(f"CPI {candidate_cpi} does not meet the minimum requirement of {company_cpi}.")

        # 2. Branch Eligibility
        company_branches = company_data.get("required_branches") or company_data.get("branch", [])
        if company_branches:
            allowed_branches = set()
            for cb in company_branches:
                cb_lower = cb.lower()
                found_bucket = False
                for bucket, members in BRANCH_MAPPING.items():
                    if cb_lower in [m.lower() for m in members]:
                        for m in members:
                            allowed_branches.add(m.lower())
                        found_bucket = True
                        break
                if not found_bucket:
                    allowed_branches.add(cb_lower)
            
            candidate_branch = ""
            if education_list:
                candidate_branch = (education_list[0].get("field") or "").lower()
                if not candidate_branch:
                    candidate_branch = (education_list[0].get("degree") or "").lower()

            if not candidate_branch or not any(b in candidate_branch for b in allowed_branches):
                eligible = False
                reasons.append(f"Branch '{candidate_branch}' is not in the allowed list: {', '.join(company_branches)}.")

        # 3. DSA Required
        dsa_required = company_data.get("dsa_required", False)
        if dsa_required:
            candidate_skills = [
                s.get("name", "").lower() if isinstance(s, dict) else str(s).lower()
                for s in (candidate_data.get("skills") or [])
            ]
            dsa_keywords = ["data structures", "algorithms", "dsa", "competitive programming", "problem solving"]
            has_dsa = any(k in s for k in dsa_keywords for s in candidate_skills)
            if not has_dsa:
                eligible = False
                reasons.append("Missing required Data Structures & Algorithms (DSA) skills.")

        return {
            "eligible": eligible,
            "reasons": reasons
        }

    # --- SOFT SCORING ---

    def compute_company_score(self, candidate_data: Dict[str, Any], company_data: Dict[str, Any],
                              resume_text: str, jd_text: str, skip_cross_encoder: bool = False,
                              enriched_text: Optional[str] = None,
                              precomputed_cross_encoder: Optional[float] = None) -> Dict[str, Any]:
        """
        Calculates the 100-point soft score for an eligible candidate.
        `skip_cross_encoder` lets callers bypass the expensive CrossEncoder pass
        (e.g. for companies a cheap bi-encoder pre-filter ranked as unlikely
        matches) - the other 70 points are still computed normally.

        `enriched_text` lets a caller pass the flattened resume in rather than
        having it rebuilt here; it depends only on the candidate, so rebuilding
        it per-company was pure waste.
        `precomputed_cross_encoder` lets a caller supply the 0-30 cross-encoder
        component from one batched predict() covering every company at once
        (see score_companies_batch), instead of a separate single-pair call here.
        """
        self._ensure_initialized()
        score = 0.0
        breakdown = {}

        # Safe extraction (skills/skill_set/core_skills may be explicitly null in
        # the DB, not just absent — `.get(key, default)` only falls back when the
        # *key* is missing, so a null value would otherwise raise TypeError here
        # and silently drop this company from the candidate's entire ranking pass).
        candidate_skills = [
            s.get("name", "").lower() if isinstance(s, dict) else str(s).lower()
            for s in (candidate_data.get("skills") or [])
        ]
        # Remove empties
        candidate_skills = [s for s in candidate_skills if s]
        # Dedupe (a skill listed in both skill_set and core_skills would otherwise
        # be double-counted in the denominator below, deflating the match score)
        company_skills = list({
            s.lower() for s in (company_data.get("skill_set") or []) + (company_data.get("core_skills") or [])
        })

        # Flatten candidate project tech
        candidate_proj_tech = []
        for p in (candidate_data.get("projects") or []):
            candidate_proj_tech.extend([t.lower() for t in (p.get("technologies") or [])])
        company_proj_tech = [t.lower() for t in (company_data.get("project_keywords") or [])]

        # NOTE: this was previously undefined here (only ever set inside
        # check_hard_filters, a separate method) - every call to this method for
        # an eligible candidate raised NameError at the "Academic Excellence"
        # section below, which the caller's broad except silently swallowed by
        # dropping the whole company from the candidate's rankings. That means
        # eligible companies were never actually being scored.
        education_list = candidate_data.get("education") or []

        # 1. Skill Overlap (30 points)
        skill_score = 0.0
        if company_skills:
            exact_matches = set(candidate_skills).intersection(set(company_skills))
            exact_score = min(20.0, (len(exact_matches) / max(1, len(company_skills))) * 20.0)

            # Semantic similarity for unmatched skills.
            # Vectorized: one matrix multiply instead of an O(reqs x candidates)
            # nested loop of scalar cosine calls. Sorted only for determinism -
            # the sum below is order-independent, so scores are unchanged.
            unmatched_reqs = sorted(set(company_skills) - exact_matches)
            semantic_score = 0.0
            if unmatched_reqs and candidate_skills:
                best_sims = self._embedding_engine.best_skill_similarities(unmatched_reqs, candidate_skills)
                # Threshold for semantic match, same 0.6 cutoff as before
                match_sum = float(best_sims[best_sims > 0.6].sum())
                semantic_score = min(10.0, (match_sum / len(unmatched_reqs)) * 10.0)
            
            skill_score = exact_score + semantic_score
        else:
            skill_score = 30.0 # Free points if JD specifies no skills
            
        score += skill_score
        breakdown["skill_overlap"] = skill_score

        # 2. Cross-Encoder Match (30 points)
        cross_encoder_score = 0.0
        if precomputed_cross_encoder is not None:
            # Already computed by a batched pass covering every company at once.
            cross_encoder_score = precomputed_cross_encoder
        elif not skip_cross_encoder and self._cross_encoder and jd_text:
            try:
                # raw_text lacks the GitHub stats and Bayesian merge results,
                # so we use the flattened parsed JSON instead of raw_text.
                if enriched_text is None:
                    enriched_text = self._embedding_engine._flatten_resume(candidate_data)
                if enriched_text:
                    # predict expects a list of pairs: [[text1, text2]]
                    logit = float(self._cross_encoder.predict([[jd_text, enriched_text]])[0])
                    cross_encoder_score = _sigmoid(logit) * 30.0
            except Exception as e:
                logger.error(f"Cross encoder error: {e}")

        score += cross_encoder_score
        breakdown["cross_encoder"] = cross_encoder_score

        # 3. Academic Excellence & Branch Affinity (15 points)
        academic_score = 0.0
        
        # CPI Surplus (10 pts)
        company_cpi = float(company_data.get("min_gpa") or company_data.get("cpi", 0.0))
        candidate_cpi = 0.0
        if education_list:
            try:
                candidate_cpi = float(education_list[0].get("gpa") or 0.0)
            except (ValueError, TypeError):
                candidate_cpi = 0.0
        
        if company_cpi > 0 and candidate_cpi >= company_cpi:
            surplus_ratio = (candidate_cpi - company_cpi) / (10.0 - company_cpi + 0.001)
            academic_score += min(10.0, surplus_ratio * 10.0)
            
        # Branch Preference (5 pts)
        branch_score = 0.0
        candidate_branch = (education_list[0].get("field") or "").lower() if education_list else ""
        if candidate_branch:
            # Simple heuristic: if JD seems software oriented, reward CS/IT explicitly
            software_keywords = ["sde", "software", "web", "frontend", "backend", "fullstack", "data"]
            jd_desc = (company_data.get("jd_text") or company_data.get("description") or "").lower()
            jd_role = (company_data.get("role") or company_data.get("internship_role") or "").lower()
            
            is_software_role = any(kw in jd_desc or kw in jd_role for kw in software_keywords)
            cs_keywords = ["computer science", "cse", "it", "information technology", "m&c"]
            is_cs_branch = any(kw in candidate_branch for kw in cs_keywords)
            
            if is_software_role and is_cs_branch:
                branch_score = 5.0
            else:
                branch_score = 2.0 # Passed hard filter but not the *ideal* branch
                
        academic_score += branch_score
        score += academic_score
        breakdown["academic_branch_bonus"] = academic_score

        # 4. Project Relevance (15 points)
        proj_score = 0.0
        if company_proj_tech:
            exact_p_matches = set(candidate_proj_tech).intersection(set(company_proj_tech))
            proj_score = min(15.0, (len(exact_p_matches) / len(company_proj_tech)) * 15.0)
        else:
            proj_score = 15.0
            
        score += proj_score
        breakdown["project_relevance"] = proj_score

        # 5. Experience Relevance (10 points)
        exp_score = 0.0
        experiences = candidate_data.get("experience", [])
        if experiences:
            exp_score += 5.0 # Baseline for having experience
            # Could add semantic matching of exp text vs JD here for remaining 5
            exp_score += 5.0 
            
        score += exp_score
        breakdown["experience_relevance"] = exp_score

        return {
            "score": round(score, 2),
            "breakdown": {k: round(v, 2) for k, v in breakdown.items()}
        }

    def batch_cross_encoder_scores(self, jd_texts: Sequence[str], enriched_text: str) -> List[float]:
        """Run ONE batched CrossEncoder pass over every (jd, resume) pair.

        Previously each company triggered its own single-pair predict() call, so
        the model's fixed per-call overhead was paid N times. Batching matters
        far more in production than locally: Cloud Run gives the container a
        single vCPU, so there are no spare cores to absorb that overhead.

        Returns a 0-30 point contribution per input jd_text, aligned by index.
        """
        self._ensure_initialized()
        if not self._cross_encoder or not enriched_text or not jd_texts:
            return [0.0] * len(jd_texts)

        pairs = [[jd or "", enriched_text] for jd in jd_texts]
        try:
            logits = self._cross_encoder.predict(pairs, batch_size=32)
        except Exception as e:
            logger.error(f"Batched cross encoder error: {e}")
            return [0.0] * len(jd_texts)

        scores = []
        for idx, jd in enumerate(jd_texts):
            if not jd:
                scores.append(0.0)
                continue
            try:
                scores.append(_sigmoid(float(logits[idx])) * 30.0)
            except (IndexError, TypeError, ValueError):
                scores.append(0.0)
        return scores

    def batch_cross_encoder_scores_for_resumes(self, jd_text: str, enriched_texts: Sequence[str]) -> List[float]:
        """One batched CrossEncoder pass: a single JD against MANY resumes.

        The transpose of batch_cross_encoder_scores, for the company-creation
        re-rank path where the company is fixed and the resumes vary.

        Returns a 0-30 point contribution per resume, aligned by index.
        """
        self._ensure_initialized()
        if not self._cross_encoder or not jd_text or not enriched_texts:
            return [0.0] * len(enriched_texts)

        pairs = [[jd_text, enriched or ""] for enriched in enriched_texts]
        try:
            logits = self._cross_encoder.predict(pairs, batch_size=32)
        except Exception as e:
            logger.error(f"Batched cross encoder (per-resume) error: {e}")
            return [0.0] * len(enriched_texts)

        scores = []
        for idx, enriched in enumerate(enriched_texts):
            if not enriched:
                scores.append(0.0)
                continue
            try:
                scores.append(_sigmoid(float(logits[idx])) * 30.0)
            except (IndexError, TypeError, ValueError):
                scores.append(0.0)
        return scores

    # --- PIPELINES ---

    def match_resumes_to_company(self, company_data: Dict[str, Any], all_resumes: List[Dict[str, Any]], top_k: int = 20) -> List[Dict[str, Any]]:
        self._ensure_initialized()
        """
        Full 2-stage retrieval and ranking pipeline.
        """
        results = []
        
        # Create a JD text string if not provided natively
        jd_text = company_data.get("jd_text") or company_data.get("description", "")
        if not jd_text:
            role_text = company_data.get("role") or company_data.get("internship_role", "")
            jd_text = f"Role: {role_text}. Skills required: {', '.join(company_data.get('skill_set', []))}."
            
        jd_embedding = self._embedding_engine.generate_job_embedding(jd_text)

        # Stage 1: Filter & Bi-Encoder
        stage1_passed = []
        for resume in all_resumes:
            parsed_data = resume.get("parsed_data", {})
            if not parsed_data:
                # Support old schema fallback where data was top level
                if "skills" in resume or "Skills" in resume:
                    parsed_data = resume
            
            # Hard Filter
            eligibility = self.check_hard_filters(parsed_data, company_data)
            if not eligibility["eligible"]:
                results.append({
                    "resume_id": resume.get("id"),
                    "eligible": False,
                    "eligibility_reasons": eligibility["reasons"],
                    "match_score": 0,
                    "rank": 999
                })
                continue
                
            # Bi-Encoder (Cosine Sim)
            resume_emb = resume.get("embedding")
            similarity = 0
            if resume_emb and jd_embedding:
                similarity = self._embedding_engine.compute_similarity(resume_emb, jd_embedding)
                
            stage1_passed.append({
                "resume": resume,
                "parsed_data": parsed_data,
                "similarity": similarity
            })

        # Sort by fast vector similarity and slice Top K
        stage1_passed.sort(key=lambda x: x["similarity"], reverse=True)
        top_candidates = stage1_passed[:top_k]
        
        # Fast fail others
        for dropped in stage1_passed[top_k:]:
            results.append({
                "resume_id": dropped["resume"].get("id"),
                "eligible": True,
                "eligibility_reasons": [],
                "match_score": 0, # Could do a fast approximation here
                "rank": 999
            })

        # Stage 2: Cross-Encoder & Soft Scoring
        scored_candidates = []
        for cand in top_candidates:
            res_obj = cand["resume"]
            p_data = cand["parsed_data"]
            res_text = res_obj.get("raw_text") or res_obj.get("resume_text", "")
            
            score_data = self.compute_company_score(p_data, company_data, res_text, jd_text)
            scored_candidates.append({
                "resume_id": res_obj.get("id"),
                "eligible": True,
                "eligibility_reasons": [],
                "match_score": score_data["score"],
                "score_breakdown": score_data["breakdown"]
            })
            
        # Final Sort
        scored_candidates.sort(key=lambda x: x["match_score"], reverse=True)
        
        # Assign Ranks
        for idx, sc in enumerate(scored_candidates):
            sc["rank"] = idx + 1
            
        results.extend(scored_candidates)
        return results
