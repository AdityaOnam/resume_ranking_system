import os
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_MODEL_CACHE_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "models", "cache"
)

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # Direct-Postgres password, used ONLY by the standalone maintenance scripts
    # in server/ (they connect via psycopg2 rather than PostgREST). The FastAPI
    # app itself never needs this, so it is NOT required in the Cloud Run
    # environment - only in a local .env for running those scripts.
    SUPABASE_DB_PASSWORD: str = ""
    SUPABASE_DB_HOST: str = ""

    # Optional GitHub API token used by github_service for resume enrichment.
    # Unauthenticated requests are capped at 60/hour; any token - even one with
    # no scopes at all, which is all that public repo reads require - raises
    # that to 5000/hour. Read via Settings (not os.environ) so a local .env
    # entry works the same way it does for every other secret here.
    GITHUB_TOKEN: str = ""

    # ML model configuration. Override any of these per machine/deployment via
    # .env instead of editing code — e.g. a GPU box can point OLLAMA_HOST at a
    # remote Ollama instance, or a locked-down prod box can point
    # MODEL_CACHE_DIR at a volume pre-seeded with the models (no internet
    # access needed at runtime).
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    CROSS_ENCODER_MODEL_NAME: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    OLLAMA_MODEL_NAME: str = "llama3.2:1b"
    OLLAMA_HOST: str = "http://127.0.0.1:11434"
    # Measured empirically: llama3.2:1b on CPU takes ~53s for a single ATS
    # feedback generation with ZERO contention - 60s left no real safety
    # margin and was observed timing out on actual uploads.
    OLLAMA_TIMEOUT_SECONDS: float = 150.0
    
    # LLM Provider Configuration
    # "groq" (cloud, default), "gemini" (cloud), or "ollama" (local server).
    # Defaults to groq because the deployed environment has no local LLM: an
    # "ollama" default silently fails there with no reachable Ollama host.
    LLM_PROVIDER: str = "groq"

    GEMINI_API_KEYS: str = ""
    GEMINI_MODEL_NAME: str = "gemini-2.0-flash"
    GEMINI_TIMEOUT_SECONDS: float = 60.0

    # Groq. GROQ_API_KEYS accepts a comma-separated list and rotates on rate
    # limits, exactly like GEMINI_API_KEYS; GROQ_API_KEY (singular) is still
    # honoured for backwards compatibility.
    #
    # Keep GROQ_MODEL_NAME on a CURRENT production model - Groq decommissions
    # older ones, and a retired id fails with a 404 that llm_service catches and
    # turns into a fallback string, so the feature silently degrades instead of
    # erroring. The entire llama-3.x chat family has already been retired this
    # way. Verified working against the live API (text + JSON mode):
    # openai/gpt-oss-120b and openai/gpt-oss-20b.
    GROQ_API_KEY: str = ""
    GROQ_API_KEYS: str = ""
    GROQ_MODEL_NAME: str = "openai/gpt-oss-120b"
    GROQ_TIMEOUT_SECONDS: float = 60.0
    
    MODEL_CACHE_DIR: str = _DEFAULT_MODEL_CACHE_DIR

    # Ranking pipeline: only the top-K most similar ELIGIBLE companies (by cheap
    # bi-encoder cosine similarity) get the expensive CrossEncoder pass; the rest
    # are still scored on every other dimension, just without that component.
    RANKING_CROSS_ENCODER_TOP_K: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()


def get_pg_connection_kwargs() -> dict:
    """psycopg2 connection kwargs for direct-Postgres access.

    Used ONLY by the standalone maintenance scripts in server/ - the API itself
    talks to Supabase over PostgREST and never needs the database password.
    These credentials were previously hardcoded in three separate scripts and
    committed to git; they now come from the environment like every other
    secret.
    """
    if not settings.SUPABASE_DB_PASSWORD:
        raise RuntimeError(
            "SUPABASE_DB_PASSWORD is not set. Add it to server/.env to run this script. "
            "It is only needed for direct-Postgres maintenance scripts, never by the API."
        )

    host = settings.SUPABASE_DB_HOST
    if not host:
        # Derive db.<project-ref>.supabase.co from https://<project-ref>.supabase.co
        project_ref = settings.SUPABASE_URL.replace("https://", "").replace("http://", "").split(".")[0]
        if not project_ref:
            raise RuntimeError("Cannot derive the database host: set SUPABASE_DB_HOST explicitly.")
        host = f"db.{project_ref}.supabase.co"

    return {
        "host": host,
        "port": 5432,
        "dbname": "postgres",
        "user": "postgres",
        "password": settings.SUPABASE_DB_PASSWORD,
    }

# huggingface_hub/transformers resolve their on-disk cache location from these
# env vars the FIRST time they're imported anywhere in the process - not when
# a model is actually loaded. That import happens transitively as soon as
# `sentence_transformers` is imported (embedding_engine.py / company_matcher.py).
# So this block must run before those imports, which is why app/main.py imports
# this module before anything else. Do not move this logic later in the file
# or into a function called on-demand - by then it's too late.
os.makedirs(settings.MODEL_CACHE_DIR, exist_ok=True)
os.environ.setdefault("HF_HOME", settings.MODEL_CACHE_DIR)
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", settings.MODEL_CACHE_DIR)
os.environ.setdefault("TRANSFORMERS_CACHE", settings.MODEL_CACHE_DIR)
os.environ.setdefault("OLLAMA_HOST", settings.OLLAMA_HOST)
