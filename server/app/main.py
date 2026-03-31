import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import companies, resumes

app = FastAPI(
    title="Resume Ranking System API",
    description="Backend for the Resume Ranking System powered by FastAPI and Supabase",
    version="1.0.0"
)

# Configure CORS with environment-specific origins
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
if ENVIRONMENT == "production":
    # In production, specify allowed origins explicitly
    allowed_origins = [
        "https://your-vercel-domain.vercel.app",
        "https://your-custom-domain.com",
    ]
else:
    # In development, allow all origins
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies.router, prefix="/api/companies", tags=["Companies"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["Resumes"])

@app.get("/")
def root():
    return {"message": "Welcome to the Resume Ranking API"}
