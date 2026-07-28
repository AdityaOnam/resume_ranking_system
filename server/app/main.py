import os

# Must be the first app import: it sets HF_HOME/TRANSFORMERS_CACHE/OLLAMA_HOST
# env vars before sentence_transformers gets imported anywhere below (see
# app/core/config.py for why the ordering matters).
from app.core import config  # noqa: F401

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import companies, resumes, analytics

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
        raise RuntimeError(
            "FRONTEND_ORIGINS environment variable must be set with a comma-separated "
            "list of allowed origins when ENVIRONMENT=production."
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
