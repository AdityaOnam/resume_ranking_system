import logging
import math
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
from app.core.config import settings

logger = logging.getLogger(__name__)

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
            cls._instance._initialize_model()
        return cls._instance

    def _initialize_model(self):
        """Loads the SentenceTransformer model into memory."""
        model_name = settings.EMBEDDING_MODEL_NAME
        logger.info(f"Loading SentenceTransformer model: {model_name} (cache: {settings.MODEL_CACHE_DIR})...")
        try:
            self._model = SentenceTransformer(model_name, cache_folder=settings.MODEL_CACHE_DIR)
            logger.info("Model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            raise
        self._skill_embedding_cache: Dict[str, List[float]] = {}

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

        try:
            # Generate the embedding. The model handles tokenization internally.
            # convert_to_numpy=False is fine since we immediately convert to a standard Python list
            # list() converts the numpy array to standard Python floats for JSON serialization
            embedding = self._model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return [0.0] * 384

    def compute_similarity(self, vec_a: List[float], vec_b: List[float]) -> float:
        """
        Computes cosine similarity between two vectors.
        Returns a float between -1.0 and 1.0 (1.0 being perfectly identical).
        """
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return dot_product / (norm_a * norm_b)

    def _get_skill_embedding(self, skill: str) -> List[float]:
        """
        Returns a cached embedding for a skill string. Skill vocabularies are small
        and reused heavily across companies/resumes, so caching avoids re-running the
        model for the same string on every comparison.
        """
        key = (skill or "").strip().lower()
        cached = self._skill_embedding_cache.get(key)
        if cached is not None:
            return cached
        embedding = self._embed_text(skill)
        self._skill_embedding_cache[key] = embedding
        return embedding

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
