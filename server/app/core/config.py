import os
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_MODEL_CACHE_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "models", "cache"
)

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str

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
    MODEL_CACHE_DIR: str = _DEFAULT_MODEL_CACHE_DIR

    # Ranking pipeline: only the top-K most similar ELIGIBLE companies (by cheap
    # bi-encoder cosine similarity) get the expensive CrossEncoder pass; the rest
    # are still scored on every other dimension, just without that component.
    RANKING_CROSS_ENCODER_TOP_K: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

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
