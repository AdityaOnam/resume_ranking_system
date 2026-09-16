import logging
from typing import List, Dict, Any, Sequence

import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)


def _as_vector(value: Any) -> Any:
    """Coerce a stored embedding into a float32 numpy array.

    pgvector columns come back from PostgREST as a JSON *string*
    ("[0.1,0.2,...]"), not a list. The previous pure-Python cosine compared
    len(str) against len(list), silently returned 0.0 for every company, and so
    the bi-encoder pre-filter that decides which companies deserve the expensive
    CrossEncoder pass was ranking on all-zero scores.
    """
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            import json
            value = json.loads(text)
        except (ValueError, TypeError):
            return None
    try:
        arr = np.asarray(value, dtype=np.float32)
    except (ValueError, TypeError):
        return None
    if arr.ndim != 1 or arr.size == 0:
        return None
    return arr

class EmbeddingEngine:
    """
    Singleton service for generating semantic embeddings.
    Model name and cache location are configurable via .env
    (EMBEDDING_MODEL_NAME / MODEL_CACHE_DIR) so this works unmodified
    across machines/deployments.
    """
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EmbeddingEngine, cls).__new__(cls)
            cls._instance._skill_embedding_cache: Dict[str, List[float]] = {}
        return cls._instance

    def _ensure_model(self):
        """Lazily load the model on first use so uvicorn can bind its port immediately."""
        if self._model is not None:
            return
        from sentence_transformers import SentenceTransformer
        model_name = settings.EMBEDDING_MODEL_NAME
        logger.info(f"Loading SentenceTransformer model: {model_name} (cache: {settings.MODEL_CACHE_DIR})...")
        try:
            self._model = SentenceTransformer(model_name, cache_folder=settings.MODEL_CACHE_DIR)
            logger.info("Model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            raise

    def generate_resume_embedding(self, parsed_data: Dict[str, Any]) -> List[float]:
        """
        Converts the parsed JSON resume into a dense 384D vector.
        """
        flattened_text = self._flatten_resume(parsed_data)
        return self._embed_text(flattened_text)

    def generate_job_embedding(self, job_description: str) -> List[float]:
        """
        Converts a raw job description string into a dense 384D vector.
        """
        # Minor preprocessing: remove excessive newlines/whitespace
        cleaned_jd = " ".join(job_description.split())
        return self._embed_text(cleaned_jd)

    def _embed_text(self, text: str) -> List[float]:
        """Core method to generate the embedding."""
        if not text or not text.strip():
            logger.warning("Empty text provided for embedding, returning zero vector.")
            return [0.0] * 384

        self._ensure_model()
        try:
            # Generate the embedding. The model handles tokenization internally.
            # convert_to_numpy=False is fine since we immediately convert to a standard Python list
            # list() converts the numpy array to standard Python floats for JSON serialization
            embedding = self._model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return [0.0] * 384

    def compute_similarity(self, vec_a: Any, vec_b: Any) -> float:
        """
        Computes cosine similarity between two vectors.
        Returns a float between -1.0 and 1.0 (1.0 being perfectly identical).

        Accepts lists, numpy arrays, or the JSON-string form pgvector returns.
        """
        a = _as_vector(vec_a)
        b = _as_vector(vec_b)
        if a is None or b is None or a.shape != b.shape:
            return 0.0

        norm_a = float(np.linalg.norm(a))
        norm_b = float(np.linalg.norm(b))
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0

        return float(np.dot(a, b) / (norm_a * norm_b))

    def _warm_skill_cache(self, skills: Sequence[str]) -> None:
        """Encode every not-yet-cached skill string in ONE batched model call.

        Encoding one string at a time costs ~10x more than batching (measured:
        0.82s vs 0.08s for 100 skills), and the per-call overhead dominates on
        the single vCPU the API runs on in production.
        """
        pending = []
        seen = set()
        for skill in skills:
            key = (skill or "").strip().lower()
            if not key or key in self._skill_embedding_cache or key in seen:
                continue
            seen.add(key)
            pending.append(key)

        if not pending:
            return

        self._ensure_model()
        try:
            vectors = self._model.encode(pending, convert_to_numpy=True, batch_size=64)
        except Exception as e:
            logger.error(f"Batch skill encoding failed, falling back to per-skill: {e}")
            for key in pending:
                self._skill_embedding_cache[key] = np.asarray(self._embed_text(key), dtype=np.float32)
            return

        for key, vec in zip(pending, vectors):
            self._skill_embedding_cache[key] = np.asarray(vec, dtype=np.float32)

    def _get_skill_embedding(self, skill: str):
        """
        Returns a cached embedding for a skill string. Skill vocabularies are small
        and reused heavily across companies/resumes, so caching avoids re-running the
        model for the same string on every comparison.
        """
        key = (skill or "").strip().lower()
        cached = self._skill_embedding_cache.get(key)
        if cached is not None:
            return cached
        embedding = np.asarray(self._embed_text(skill), dtype=np.float32)
        self._skill_embedding_cache[key] = embedding
        return embedding

    def _skill_matrix(self, skills: Sequence[str]) -> Any:
        """L2-normalized matrix of skill embeddings, shape (len(skills), dim)."""
        self._warm_skill_cache(skills)
        rows = [self._get_skill_embedding(s) for s in skills]
        matrix = np.vstack(rows).astype(np.float32)
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0.0] = 1.0
        return matrix / norms

    def best_skill_similarities(self, required_skills: Sequence[str],
                                candidate_skills: Sequence[str]) -> Any:
        """For each required skill, the best cosine similarity against any candidate skill.

        Replaces an O(required x candidate) nested loop of scalar comparisons with
        a single matrix multiply. At 138 companies this was ~55,000 pure-Python
        cosine calls (~45us each) per upload; it is now a handful of BLAS ops.
        """
        if not required_skills or not candidate_skills:
            return np.zeros(len(required_skills), dtype=np.float32)

        required_matrix = self._skill_matrix(list(required_skills))
        candidate_matrix = self._skill_matrix(list(candidate_skills))
        return (required_matrix @ candidate_matrix.T).max(axis=1)

    def compute_skill_similarity(self, skill_a: str, skill_b: str) -> float:
        """
        Computes semantic similarity between two skill strings, using cached embeddings.
        """
        vec_a = self._get_skill_embedding(skill_a)
        vec_b = self._get_skill_embedding(skill_b)
        return self.compute_similarity(vec_a, vec_b)

    def _flatten_resume(self, parsed_data: Dict[str, Any]) -> str:
        """
        Converts structured resume data into a rich textual representation 
        optimized for semantic embedding models.
        """
        parts = []

        # 1. Skills (Highest weight/priority, so put them near the beginning)
        skills = parsed_data.get("skills", [])
        if skills:
            clean_skills = []
            for s in skills:
                if isinstance(s, dict):
                    # resume_parser's Bayesian skill merge outputs {"name": ..., "confidence": ..., "sources": ...} dicts
                    val = s.get("name") or s.get("skill") or (list(s.values())[0] if s.values() else "")
                    if val: clean_skills.append(str(val))
                else:
                    clean_skills.append(str(s))
            if clean_skills:
                parts.append(f"Skills: {', '.join(clean_skills)}.")

        # 2. Experience
        experiences = parsed_data.get("experience", [])
        if experiences:
            exp_texts = []
            for exp in experiences:
                role = exp.get("role", "")
                company = exp.get("company", "")
                desc = exp.get("description", "")
                
                header = f"{role} at {company}" if role and company else role or company
                if header:
                    exp_texts.append(f"{header}. {desc}".strip())
            
            if exp_texts:
                parts.append(f"Experience: {' '.join(exp_texts)}")

        # 3. Projects
        projects = parsed_data.get("projects", [])
        if projects:
            proj_texts = []
            for proj in projects:
                title = proj.get("title", "")
                techs = proj.get("technologies", [])
                desc = proj.get("description", "")
                
                clean_techs = []
                for t in techs:
                    if isinstance(t, dict):
                        val = t.get("name") or t.get("technology") or (list(t.values())[0] if t.values() else "")
                        if val: clean_techs.append(str(val))
                    else:
                        clean_techs.append(str(t))

                tech_str = f"using {', '.join(clean_techs)}" if clean_techs else ""
                header = f"{title} {tech_str}".strip()
                if header:
                    proj_texts.append(f"{header}. {desc}".strip())
                    
            if proj_texts:
                parts.append(f"Projects: {' '.join(proj_texts)}")

        # 4. Education
        education = parsed_data.get("education", [])
        if education:
            edu_texts = []
            for edu in education:
                degree = edu.get("degree", "")
                field = edu.get("field", "")
                inst = edu.get("institution", "")
                
                header = f"{degree} in {field}" if degree and field else degree or field
                if header and inst:
                    edu_texts.append(f"{header} from {inst}")
                elif header:
                    edu_texts.append(header)
                    
            if edu_texts:
                parts.append(f"Education: {', '.join(edu_texts)}.")

        # Combine all parts into a single dense string
        flattened = " ".join(parts)
        # Clean up any accidental double spaces
        return " ".join(flattened.split())
