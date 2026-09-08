import logging
import os

# Must be the first app import: it sets HF_HOME/TRANSFORMERS_CACHE/OLLAMA_HOST
# env vars before sentence_transformers gets imported anywhere below (see
# app/core/config.py for why the ordering matters).
from app.core import config  # noqa: F401

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import companies, resumes, analytics

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Resume Ranking System API",
    description="Backend for the Resume Ranking System powered by FastAPI and Supabase",
    version="1.0.0"
)

# Configure CORS with environment-specific origins
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
if ENVIRONMENT == "production":
    # In production, allowed origins must be provided via env var (comma-separated).
    # e.g. FRONTEND_ORIGINS="https://app.example.com,https://www.example.com"
    origins_env = os.getenv("FRONTEND_ORIGINS", "")
    allowed_origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]
    if not allowed_origins:
        # Fail at startup rather than silently falling through to the
        # allow_origin_regex below. Without this, a deployment with no
        # FRONTEND_ORIGINS still "works" for *.vercel.app purely by accident,
        # then breaks with opaque CORS errors the moment a custom domain is
        # added - and the misconfiguration is invisible until then.
        raise RuntimeError(
            "FRONTEND_ORIGINS must be set when ENVIRONMENT=production. "
            'Provide a comma-separated list, e.g. FRONTEND_ORIGINS="https://your-app.vercel.app"'
        )
else:
    # In development, allow local frontend origins explicitly
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.(vercel\.app|hf\.space|onrender\.com)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies.router, prefix="/api/companies", tags=["Companies"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["Resumes"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])

@app.get("/")
def root():
    return {"message": "Welcome to the Resume Ranking API"}


@app.get("/warmup", tags=["Ops"])
def warmup():
    """Force every ML model to load, and report whether each one succeeded.

    Pinging `/` keeps a container alive but leaves all three models unloaded,
    because they are lazy-loaded on first *use* - so the next real upload still
    pays the full cold-start cost. A scheduled ping must hit THIS endpoint to
    actually warm the service.

    Doubles as a deployment health check: `cross_encoder: false` here means the
    model failed to load and every match score is silently missing its 30-point
    cross-encoder component.
    """
    import time

    from app.services.embedding_engine import EmbeddingEngine
    from app.services.company_matcher import CompanyMatcher
    from app.services.nlp_model import get_nlp

    started = time.monotonic()
    status = {"embedding_model": False, "cross_encoder": False, "spacy": False}

    try:
        engine = EmbeddingEngine()
        engine._ensure_model()
        status["embedding_model"] = engine._model is not None
    except Exception as e:
        logger.error(f"Warmup: embedding model failed to load: {e}")

    try:
        matcher = CompanyMatcher()
        matcher._ensure_initialized()
        status["cross_encoder"] = matcher._cross_encoder is not None
    except Exception as e:
        logger.error(f"Warmup: cross encoder failed to load: {e}")

    try:
        status["spacy"] = get_nlp() is not None
    except Exception as e:
        logger.error(f"Warmup: spaCy failed to load: {e}")

    all_ready = all(status.values())
    if not all_ready:
        logger.critical(f"Warmup incomplete - degraded scoring likely. Status: {status}")

    return {
        "status": "warm" if all_ready else "degraded",
        "models": status,
        "elapsed_seconds": round(time.monotonic() - started, 2),
    }
