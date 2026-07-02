import logging
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

class EmbeddingEngine:
    """
    Singleton service for generating semantic embeddings.
    Uses 'all-MiniLM-L6-v2' to produce 384-dimensional vectors.
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
        model_name = "all-MiniLM-L6-v2"
        logger.info(f"Loading SentenceTransformer model: {model_name}...")
        try:
            self._model = SentenceTransformer(model_name)
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

        try:
            # Generate the embedding. The model handles tokenization internally.
            # convert_to_numpy=False is fine since we immediately convert to a standard Python list
            # list() converts the numpy array to standard Python floats for JSON serialization
            embedding = self._model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return [0.0] * 384

    def _flatten_resume(self, parsed_data: Dict[str, Any]) -> str:
        """
        Converts structured resume data into a rich textual representation 
        optimized for semantic embedding models.
        """
        parts = []

        # 1. Skills (Highest weight/priority, so put them near the beginning)
        skills = parsed_data.get("skills", [])
        if skills:
            parts.append(f"Skills: {', '.join(skills)}.")

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
                
                tech_str = f"using {', '.join(techs)}" if techs else ""
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
