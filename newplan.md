Resume Analyzer v2.0 — Final Implementation Plan
Overview
A dual-pipeline resume analysis platform that provides:

ATS Score — Is your resume well-structured? (format, action words, missing sections)
Company-Specific Score — How well does your resume match a job description? (semantic matching)
Best-Fit Companies — Which companies from our database match your profile best?
User Rankings — Where do you stand against other users for each company?
Gap Analysis — Exactly what's lacking and how to fix it (for both ATS and company-specific)
LLM Explanations — Natural language feedback powered by local Llama 3.1
Architecture
┌──────────────────────────────────────────────────┐
│              FRONTEND (React + Tailwind)          │
│                                                    │
│  Upload │ ATS Report │ Company Match │ Rankings   │
└────────────────────┬─────────────────────────────┘
                     │ REST API (axios)
┌────────────────────▼─────────────────────────────┐
│              BACKEND (FastAPI — Python)            │
│                                                    │
│  ┌──────────────┐    ┌─────────────────────────┐ │
│  │ ATS Pipeline  │    │ Company Pipeline         │ │
│  │ (rule-based)  │    │ Stage 1: Bi-Encoder     │ │
│  │               │    │ Stage 2: Cross-Encoder  │ │
│  │ Format checks │    │ Stage 3: Calibration    │ │
│  │ Action words  │    │                         │ │
│  │ Completeness  │    │ + Skill Tier Matching   │ │
│  └──────────────┘    └─────────────────────────┘ │
│                                                    │
│  ┌─────────────────────────────────────────────┐ │
│  │ Shared: Resume Parser │ Embedding Engine     │ │
│  │         LLM Service   │ Ranking Service      │ │
│  └─────────────────────────────────────────────┘ │
└────────────────────┬─────────────────────────────┘
                     │ SQL + pgvector
┌────────────────────▼─────────────────────────────┐
│              SUPABASE                              │
│  PostgreSQL + pgvector │ Storage (PDFs) │ Auth    │
└──────────────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│              OLLAMA (Local LLM)                    │
│  Llama 3.1 8B — generates natural language        │
│  explanations and gap suggestions                 │
└──────────────────────────────────────────────────┘
Requirements
Hardware
Resource	Minimum	Notes
RAM	5-6 GB available	Enough for all models + Ollama
Disk Space	~7 GB total	Models + Ollama + dependencies
CPU	Any modern CPU	All inference runs on CPU
GPU	Not required	Optional: speeds up batch processing
Software to Install
Software	Version	Purpose	Install Command / Link
Python	3.10+	Backend runtime	https://python.org
Node.js	18+	Frontend build	https://nodejs.org
Ollama	Latest	Local LLM runtime	https://ollama.ai → install → ollama pull llama3.1:8b
Git	Latest	Version control	https://git-scm.com
Supabase Account (Free Tier)
What You Get	Limit
Database (PostgreSQL)	500 MB
File Storage	1 GB
Auth Users	50,000
Cost	$0
Sign up at https://supabase.com → Create project → Get SUPABASE_URL and SUPABASE_SERVICE_KEY from Settings → API.

AI Models (Auto-Download on First Run)
Model	Size	Purpose	RAM Usage
all-MiniLM-L6-v2	80 MB	Sentence embeddings (bi-encoder)	~200 MB
cross-encoder/ms-marco-MiniLM-L-6-v2	130 MB	Re-ranking (cross-encoder)	~300 MB
spaCy en_core_web_sm	12 MB	NLP text processing	~50 MB
Llama 3.1 8B (via Ollama)	4.7 GB	Natural language explanations	~5 GB
[!NOTE] All HuggingFace models auto-download on first use. No API keys needed. Ollama runs as a separate local server.

Python Dependencies (server/requirements.txt)
# Core Backend
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
python-multipart>=0.0.6
supabase>=2.0.0
python-dotenv>=1.0.0
pydantic>=2.0.0
numpy>=1.24.0

# AI / NLP
sentence-transformers>=2.2.0
spacy>=3.7.0
PyPDF2>=3.0.0
python-docx>=1.1.0

# JD Import (Excel, CSV, PDF)
pandas>=2.0.0
openpyxl>=3.1.0

# LLM
ollama>=0.1.0
Frontend Dependencies (client/package.json)
react, react-dom, react-router-dom
tailwindcss, postcss, autoprefixer
axios
recharts
framer-motion
lucide-react
@supabase/supabase-js
Database Schema
Run these in Supabase SQL Editor (Dashboard → SQL Editor → New Query):

-- Step 1: Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT,
    email TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Resumes table
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    file_path TEXT,
    raw_text TEXT,
    parsed_data JSONB,
    embedding VECTOR(384),
    ats_score INTEGER,
    ats_report JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT,
    jd_text TEXT NOT NULL,
    jd_parsed JSONB,
    jd_embedding VECTOR(384),
    skill_tiers JSONB DEFAULT '{"required":[],"preferred":[],"bonus":[]}',
    weight_skills FLOAT DEFAULT 0.35,
    weight_education FLOAT DEFAULT 0.25,
    weight_projects FLOAT DEFAULT 0.25,
    weight_experience FLOAT DEFAULT 0.15,
    min_gpa FLOAT,
    required_branches TEXT[],
    source TEXT DEFAULT 'database',
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Rankings table
CREATE TABLE rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    bi_encoder_score FLOAT,
    cross_encoder_score FLOAT,
    overall_score FLOAT,
    dimension_scores JSONB,
    skill_gap JSONB,
    gap_report JSONB,
    llm_explanation TEXT,
    rank INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(resume_id, company_id)
);

-- Step 6: Vector similarity indexes
CREATE INDEX ON resumes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON companies USING ivfflat (jd_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON rankings (company_id, overall_score DESC);

-- Step 7: Supabase Storage bucket (run in dashboard, not SQL)
-- Go to Storage → New Bucket → Name: "resumes" → Public: OFF
Project Structure
resume-analyzer-v2/
│
├── server/
│   ├── main.py                      # FastAPI app, CORS, startup
│   ├── config.py                    # Supabase URL/key, model paths
│   ├── .env                         # Environment variables
│   ├── requirements.txt
│   │
│   ├── routers/
│   │   ├── resumes.py               # Upload, parse, ATS endpoints
│   │   ├── analysis.py              # Company match, recommendations
│   │   ├── companies.py             # Company CRUD, bulk import
│   │   └── rankings.py              # Leaderboard endpoints
│   │
│   ├── analyzers/
│   │   ├── ats_analyzer.py          # Rule-based ATS scoring
│   │   ├── company_matcher.py       # 3-stage ML scoring pipeline
│   │   ├── resume_parser.py         # PDF/DOCX → structured JSON
│   │   └── embedding_engine.py      # Sentence-BERT wrapper
│   │
│   ├── services/
│   │   ├── supabase_service.py      # All database operations
│   │   ├── ranking_service.py       # Rank computation + updates
│   │   └── llm_service.py           # Ollama Llama 3.1 client
│   │
│   ├── models/
│   │   └── schemas.py               # Pydantic request/response models
│   │
│   └── data/
│       ├── action_words.json        # Strong/weak verb lists
│       ├── skill_taxonomy.json      # 500+ tech skills hierarchy
│       └── ats_rules.json           # ATS scoring config
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Upload/
│   │   │   │   ├── ResumeUpload.jsx
│   │   │   │   └── JDInput.jsx
│   │   │   ├── ATS/
│   │   │   │   ├── ATSScoreCard.jsx
│   │   │   │   └── ATSGapReport.jsx
│   │   │   ├── CompanyMatch/
│   │   │   │   ├── ScoreBreakdown.jsx
│   │   │   │   ├── SkillGapTable.jsx
│   │   │   │   └── LLMExplanation.jsx
│   │   │   ├── Recommendations/
│   │   │   │   └── BestFitCompanies.jsx
│   │   │   ├── Rankings/
│   │   │   │   └── Leaderboard.jsx
│   │   │   ├── common/
│   │   │   │   ├── Header.jsx
│   │   │   │   └── Footer.jsx
│   │   │   └── ui/
│   │   │       ├── RadarChart.jsx
│   │   │       ├── ProgressBar.jsx
│   │   │       └── ScoreBadge.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── AnalyzePage.jsx
│   │   │   ├── CompaniesPage.jsx
│   │   │   └── RankingsPage.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── tailwind.config.js
│
└── README.md
Implementation Steps
Phase 1: Environment & Supabase Setup
Goal: Project skeleton running, database ready, all dependencies installed.

Step 1.1 — Create project directory
Create resume-analyzer-v2/ with server/ and client/ subdirectories
Create all subdirectories as shown in the project structure above
Step 1.2 — Backend setup
Create server/requirements.txt with all Python dependencies
Create virtual environment: python -m venv venv
Activate and install: pip install -r requirements.txt
Download spaCy model: python -m spacy download en_core_web_sm
Step 1.3 — Environment variables
Create server/.env:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
Step 1.4 — Supabase database
Create Supabase project at supabase.com
Run all SQL from the "Database Schema" section above in the SQL Editor
Create a storage bucket named resumes (private)
Step 1.5 — Ollama setup
Install Ollama from https://ollama.ai
Run ollama pull llama3.1:8b (one-time, ~4.7GB download)
Start server: ollama serve (runs on port 11434)
Step 1.6 — FastAPI skeleton
Create server/main.py with FastAPI app, CORS middleware, health check endpoint
Create server/config.py with Supabase client initialization
Verify: uvicorn main:app --reload --port 8000 → http://localhost:8000/docs shows Swagger UI
Step 1.7 — Frontend skeleton
Initialize React app: npx -y create-vite@latest ./ -- --template react
Install Tailwind CSS and configure
Install dependencies: axios, recharts, framer-motion, lucide-react, react-router-dom
Verify: npm run dev → React app running on localhost:5173
Phase 2: Resume Parser & Embedding Engine
Goal: Upload a PDF/DOCX → extract structured data → generate embedding → store in Supabase.

Step 2.1 — Resume parser (server/analyzers/resume_parser.py)
Build the ResumeParser class that:

Extracts text from PDF (PyPDF2) and DOCX (python-docx)
Uses spaCy NER + regex patterns to extract:
Contact: name, email, phone, LinkedIn
Education: degree, institution, GPA, branch, year
Skills: programming languages, frameworks, tools (matched against skill taxonomy)
Experience: company, role, duration, description bullets
Projects: title, description, technologies used
Returns structured JSON (parsed_data)
Step 2.2 — Skill taxonomy (server/data/skill_taxonomy.json)
Create a hierarchical JSON of ~500 tech skills:

{
  "languages": ["Python", "Java", "C++", "JavaScript", "Go", "Rust", ...],
  "frameworks": ["React", "Angular", "Django", "FastAPI", "Flask", "Spring", ...],
  "ml_ai": ["TensorFlow", "PyTorch", "scikit-learn", "Keras", "OpenCV", ...],
  "databases": ["PostgreSQL", "MongoDB", "Redis", "MySQL", "Supabase", ...],
  "devops": ["Docker", "Kubernetes", "AWS", "GCP", "Azure", "CI/CD", ...],
  "tools": ["Git", "Linux", "Jira", "Figma", ...]
}
Used for: skill extraction from resume text, skill matching with JDs.

Step 2.3 — Embedding engine (server/analyzers/embedding_engine.py)
Build the EmbeddingEngine class:

Loads all-MiniLM-L6-v2 on startup (lazy loading, singleton pattern)
embed(text: str) → list[float] — embeds a single text into 384-dim vector
embed_batch(texts: list[str]) → list[list[float]] — batch embedding
cosine_similarity(vec1, vec2) → float — similarity score between two vectors
Step 2.4 — Supabase service (server/services/supabase_service.py)
Build database operations:

store_resume(user_id, file_path, raw_text, parsed_data, embedding) → insert into resumes
get_resume(resume_id) → fetch resume with all fields
store_company(name, role, jd_text, jd_embedding, skill_tiers, ...) → insert into companies
vector_search_companies(embedding, limit=10) → pgvector nearest-neighbor query
store_ranking(resume_id, company_id, scores, ...) → insert/update ranking
Step 2.5 — Upload endpoint (server/routers/resumes.py)
POST /api/resumes/upload — accepts PDF/DOCX file
Saves file to Supabase Storage
Calls ResumeParser.parse() → structured data
Calls EmbeddingEngine.embed() → 384-dim vector
Stores everything in Supabase resumes table
Returns: {id, parsed_data, message: "Resume parsed successfully"}
Step 2.6 — Test
Upload a real resume PDF
Verify in Supabase dashboard: resumes table has a new row with parsed_data (JSON) and embedding (384-dim vector)
Phase 3: ATS Scoring Pipeline
Goal: Analyze resume structure/format and return a detailed score with actionable feedback.

Step 3.1 — Action words data (server/data/action_words.json)
{
  "strong": ["Engineered", "Architected", "Optimized", "Implemented", "Designed",
             "Developed", "Automated", "Deployed", "Integrated", "Scaled",
             "Reduced", "Increased", "Accelerated", "Streamlined", "Led", ...],
  "weak": ["Worked on", "Helped", "Did", "Was responsible for", "Assisted",
           "Participated", "Was involved in", "Contributed to", ...]
}
~200 strong verbs, ~50 weak verbs.

Step 3.2 — ATS analyzer (server/analyzers/ats_analyzer.py)
Build the ATSAnalyzer class with 8 scoring functions:

Method	Points	Logic
check_contact_info()	/10	Regex for email, phone, name, LinkedIn URL
check_sections()	/20	Detect presence of Education, Experience, Skills, Projects headings
check_action_words()	/15	Count bullet points starting with strong vs weak verbs
check_quantification()	/15	Regex for numbers, percentages, metrics in experience bullets
check_formatting()	/15	Page count (1-2 ideal), bullet point usage, line length consistency
check_keyword_density()	/10	Technical keyword count, not overly stuffed
check_readability()	/10	Average sentence length, no overly long paragraphs
check_red_flags()	/5	Detect "References available", photos mentioned, excessive personal info
Each method returns:

{
    "score": 12,        # out of max for this category
    "max": 15,
    "issues": [
        {
            "severity": "high",      # high / medium / low
            "message": "5 bullet points start with weak verbs",
            "examples": ["Worked on backend API", "Helped with testing"],
            "suggestion": "Replace with: 'Engineered backend API', 'Automated testing pipeline'"
        }
    ]
}
Main method analyze(parsed_data, raw_text) → ATSReport:

{
    "total_score": 72,
    "grade": "B",          # A: 85+, B: 70-84, C: 55-69, D: <55
    "categories": { ... }, # all 8 category results
    "top_issues": [ ... ], # sorted by severity (high first)
    "summary": "Your resume scores 72/100. Main issues: weak action words and missing quantification."
}
Step 3.3 — ATS endpoint (server/routers/resumes.py)
GET /api/resumes/{id}/ats → returns full ATS report
Also: on upload, automatically compute and cache ATS score in resumes.ats_score and resumes.ats_report
Step 3.4 — Test
Upload a resume with known weak points
Verify ATS report catches: missing sections, weak verbs, no metrics
Upload a strong resume → verify score is 80+
Phase 4: Company-Specific Scoring Pipeline
Goal: Three-stage ML pipeline that scores a resume against a JD and explains where it falls short.

Step 4.1 — Company CRUD endpoints (server/routers/companies.py)
POST /api/companies — add company with JD text, auto-embed JD
GET /api/companies — list all companies
GET /api/companies/{id} — company details
PUT /api/companies/{id} — update company (re-embeds JD)
DELETE /api/companies/{id} — delete company + its rankings
Step 4.2 — JD bulk import (server/routers/companies.py)
POST /api/companies/bulk-upload — accepts CSV, Excel (.xlsx), or multiple PDFs
For CSV/Excel: reads columns name, role, jd_text (+ optional min_gpa, required_branches, skill_tiers)
Uses pandas + openpyxl for reading
For PDF: extracts text from each PDF, uses filename as company name
Uses PyPDF2 for extraction
For each JD: parse → extract skill_tiers (using spaCy + skill_taxonomy) → embed → store
Step 4.3 — Company matcher (server/analyzers/company_matcher.py)
Build the CompanyMatcher class implementing the three-stage pipeline:

Stage 1 — Bi-Encoder Score (fast):

def bi_encoder_score(resume_embedding, jd_embedding):
    return cosine_similarity(resume_embedding, jd_embedding)
    # Returns: 0.0 to 1.0
Stage 2 — Cross-Encoder Score (precise):

from sentence_transformers import CrossEncoder
cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def cross_encoder_score(resume_text, jd_text):
    return cross_encoder.predict([(resume_text, jd_text)])[0]
    # Returns: 0.0 to 1.0 (reads both texts together for nuanced matching)
Stage 3 — Calibration (business logic):

def calibrate(resume_parsed, company, bi_score, cross_score):
    # Per-dimension scores
    skill_score = compute_skill_match(resume_parsed["skills"], company.skill_tiers)
    education_score = compute_education_match(resume_parsed["education"], company)
    project_score = compute_project_relevance(resume_parsed["projects"], company.jd_embedding)
    experience_score = compute_experience_relevance(resume_parsed["experience"], company.jd_embedding)

    # Weighted component score
    component = (
        skill_score * company.weight_skills +
        education_score * company.weight_education +
        project_score * company.weight_projects +
        experience_score * company.weight_experience
    )

    # Hard filter penalties
    penalty = 1.0
    if resume_gpa < company.min_gpa:
        penalty *= (resume_gpa / company.min_gpa)
    if resume_branch not in company.required_branches:
        penalty *= 0.5

    # Fusion
    final = (cross_score * 0.5 + component * 0.5) * penalty * 100
    return final, dimension_scores, skill_gap
Skill matching with tiers:

def compute_skill_match(resume_skills, skill_tiers):
    # For each required/preferred/bonus skill:
    #   - Exact match → full credit
    #   - Embedding similarity > 0.7 → partial credit (e.g., "React" ≈ "React Native")
    #   - No match → marked as missing
    # Required missing = big penalty
    # Preferred missing = small penalty
    # Bonus present = extra points
Skill gap output:

{
    "matched": [
        {"skill": "Python", "tier": "required", "similarity": 0.96, "matched_with": "Python"},
        {"skill": "ML", "tier": "required", "similarity": 0.91, "matched_with": "Machine Learning"}
    ],
    "missing": [
        {"skill": "Kubernetes", "tier": "required"},
        {"skill": "GCP", "tier": "preferred"}
    ],
    "partial": [
        {"skill": "AWS", "tier": "preferred", "similarity": 0.68, "matched_with": "cloud computing"}
    ]
}
Step 4.4 — Analysis endpoints (server/routers/analysis.py)
POST /api/analyze/company/{company_id} — score a resume against a DB company
Body: {resume_id}
Returns: overall score, dimension scores, skill gap, gap report
Stores result in rankings table
POST /api/analyze/custom-jd — score against a user-pasted JD (not stored in companies table)
Body: {resume_id, jd_text}
Returns: same scoring output, but the JD is temporary
Step 4.5 — Test
Add 3 companies with different JDs (one ML-focused, one web-dev, one finance)
Upload a Python/ML resume
Score against all 3 → verify ML company scores highest, finance scores lowest
Verify skill gap correctly shows "missing" skills for each company
Phase 5: Recommendations, Rankings & LLM Explanations
Goal: Find best-fit companies, rank users, generate natural language feedback.

Step 5.1 — Company recommendations (server/routers/analysis.py)
GET /api/analyze/{resume_id}/recommendations
Uses pgvector nearest-neighbor search:
SELECT id, name, role, 1 - (jd_embedding <=> $1) AS match_score
FROM companies
ORDER BY jd_embedding <=> $1
LIMIT 10;
Groups results by alignment level:
🎯 High (80%+), 📊 Medium (60-80%), ⚠️ Lower (<60%)
For each recommended company, run a quick bi-encoder score to get dimension breakdown
Step 5.2 — Ranking service (server/services/ranking_service.py)
Build ranking computation:

compute_rankings_for_company(company_id):

Fetch all resumes from DB
For each resume: compute overall score against this company (uses cached scores if available, recomputes if not)
Sort by score → assign ranks → update rankings.rank
compute_rankings_for_resume(resume_id):

Fetch all companies from DB
Score resume against each company
Store all scores in rankings table
Triggered when:

New resume uploaded → score against all companies
New company added → score all resumes against it
Company updated → re-score all resumes
Step 5.3 — Ranking endpoints (server/routers/rankings.py)
GET /api/rankings/company/{company_id} — leaderboard for a company
Returns: list of {user_name, score, rank, total_candidates}
GET /api/rankings/user/{resume_id} — user's ranks across all companies
Returns: list of {company_name, role, score, rank, total_candidates}
Step 5.4 — LLM service (server/services/llm_service.py)
Build Ollama integration:

import ollama

class LLMService:
    def __init__(self):
        self.available = self._check_ollama()

    def _check_ollama(self):
        try:
            ollama.list()
            return True
        except:
            return False

    def generate_explanation(self, resume_parsed, company, scores, skill_gap):
        if not self.available:
            return self._template_fallback(scores, skill_gap)

        prompt = f"""You are a career advisor. Analyze this candidate's fit for the role.

Resume Summary:
- Skills: {resume_parsed['skills']}
- Experience: {resume_parsed['experience']}
- Projects: {resume_parsed['projects']}
- Education: {resume_parsed['education']}

Company: {company['name']} — {company['role']}
Job Description: {company['jd_text'][:500]}

Scores: Skills {scores['skill_match']}/100, Education {scores['education']}/100,
        Projects {scores['projects']}/100, Experience {scores['experience']}/100

Matched Skills: {skill_gap['matched']}
Missing Skills: {skill_gap['missing']}

In 3-4 sentences, explain why this candidate scored {scores['overall']}/100
and give 2-3 specific suggestions to improve their fit."""

        response = ollama.chat(model='llama3.1:8b', messages=[
            {'role': 'user', 'content': prompt}
        ])
        return response['message']['content']

    def _template_fallback(self, scores, skill_gap):
        # Template-based feedback when Ollama is offline
        missing = [s['skill'] for s in skill_gap.get('missing', [])]
        msg = f"Overall score: {scores['overall']}/100. "
        if missing:
            msg += f"Key missing skills: {', '.join(missing[:3])}. "
        if scores['experience'] < 50:
            msg += "Experience relevance is low — highlight relevant work. "
        return msg
Graceful fallback: if Ollama is not running, returns template-based feedback instead
LLM explanation is stored in rankings.llm_explanation and cached (not re-generated on every request)
Step 5.5 — Explanation endpoint
GET /api/analyze/{resume_id}/explain/{company_id} → returns LLM-generated explanation
If cached in rankings.llm_explanation, returns cached version
If not cached, generates on-demand → stores → returns
Step 5.6 — Test
Upload 3 different resumes (ML person, web dev person, generic)
Add 5 companies
Check recommendations for each resume → verify ML person gets ML companies first
Check leaderboard for a company → verify ML person ranks higher for ML companies
Check LLM explanation → verify it mentions specific skills and gaps
Phase 6: React Frontend
Goal: Complete UI with 4 tabs — ATS, Company Match, Recommendations, Rankings.

[!NOTE] The frontend will be built using React + Tailwind CSS. Since this is not your primary expertise, you can use AI-assisted development (vibe coding). In interviews, you can honestly say: "I used AI tools to accelerate the frontend development while I focused on the ML pipeline architecture."

Step 6.1 — React + Tailwind setup
Initialize with Vite: npx -y create-vite@latest ./ -- --template react
Install and configure Tailwind CSS
Install all frontend dependencies
Set up React Router with 4 pages
Create base layout (Header, Footer, main content area)
Set up axios instance pointing to http://localhost:8000/api
Step 6.2 — Home Page (HomePage.jsx)
Hero section with app description
CTA buttons: "Analyze Your Resume" and "Browse Companies"
Quick stats (number of companies in DB, number of resumes analyzed)
Clean, modern dark-themed design
Step 6.3 — Upload Flow (AnalyzePage.jsx)
Step 1: Upload resume (drag-and-drop PDF/DOCX)
Step 2: See parsed confirmation (name, skills, education, experience detected)
Step 3: Choose analysis mode:
"Check ATS Score" → runs ATS pipeline
"Match Against Company" → pick from DB or paste custom JD
"Find Best Companies" → runs recommendations
Step 4: Results in 4 tabs (see below)
Step 6.4 — ATS Tab (ATSScoreCard.jsx, ATSGapReport.jsx)
Circular progress ring showing score (e.g., 72/100) with grade letter
Color-coded: green (85+), yellow (70-84), orange (55-69), red (<55)
Category breakdown: 8 horizontal progress bars
Issue list sorted by severity:
🔴 High priority issues (red)
🟡 Medium priority (yellow)
🟢 What's good (green checkmarks)
Each issue has: problem description, specific examples from resume, actionable suggestion
Step 6.5 — Company Match Tab (ScoreBreakdown.jsx, SkillGapTable.jsx, LLMExplanation.jsx)
Company selector dropdown (from DB) or "Paste Custom JD" textarea
Overall score display (large number + rank among candidates)
Radar chart (Recharts): 4 dimensions — Skills, Education, Projects, Experience
Score breakdown bars: each dimension with score and weight shown
Skill gap table:
✅ Matched skills (green, with similarity score)
⚠️ Partial matches (yellow)
❌ Missing skills (red)
Grouped by tier: Required → Preferred → Bonus
LLM explanation box: natural language paragraph from Llama 3.1
Where you're lacking: bullet list of specific, actionable improvements
Step 6.6 — Recommendations Tab (BestFitCompanies.jsx)
Sorted list of best-fit companies from the database
Each card shows: company name, role, match percentage, top matching skills, top missing skills
Grouped by alignment: 🎯 High / 📊 Medium / ⚠️ Lower
Click any company → jumps to Company Match tab with that company selected
Step 6.7 — Rankings Tab (Leaderboard.jsx)
Company selector dropdown
Leaderboard table: Rank, Name (anonymized for other users), Score, Date
Current user highlighted
"Your rank: #3 out of 47 candidates"
Also: "Your ranks across all companies" table showing rank per company
Step 6.8 — Companies Page (CompaniesPage.jsx)
Grid of all companies in the database
Each card: company name, role, number of candidates scored
"Add Company" button → form for manual JD entry
"Bulk Import" button → upload CSV/Excel/PDFs
Search and filter functionality
Step 6.9 — Polish
Framer Motion animations on page transitions and score reveals
Responsive design (mobile-friendly)
Dark theme with modern gradient accents
Loading skeletons while API calls are in progress
Error handling with user-friendly messages
Toast notifications for success/error states
API Summary (All Endpoints)
Method	Endpoint	Description
POST	/api/resumes/upload	Upload + parse + embed + ATS score
GET	/api/resumes/{id}	Get resume details
GET	/api/resumes/{id}/ats	Detailed ATS report
DELETE	/api/resumes/{id}	Delete resume
POST	/api/analyze/company/{company_id}	Score resume vs company (3-stage)
POST	/api/analyze/custom-jd	Score resume vs pasted JD
GET	/api/analyze/{resume_id}/recommendations	Best-fit companies
GET	/api/analyze/{resume_id}/explain/{company_id}	LLM explanation
POST	/api/companies	Add company
GET	/api/companies	List companies
GET	/api/companies/{id}	Company details
PUT	/api/companies/{id}	Update company
DELETE	/api/companies/{id}	Delete company
POST	/api/companies/bulk-upload	Import JDs (CSV/Excel/PDF)
GET	/api/rankings/company/{company_id}	Leaderboard for company
GET	/api/rankings/user/{resume_id}	User's rank across companies
What Goes On Your Resume
Resume Analyzer v2.0 — AI-Powered Resume Scoring & Matching Platform
• Built dual-pipeline analysis system: rule-based ATS scoring (8 format/
  structure checks) + semantic company-specific matching using two-stage 
  retrieval (bi-encoder recall + cross-encoder re-ranking)
• Implemented vector similarity search with pgvector (PostgreSQL) for instant
  company recommendations across 100+ job descriptions
• Designed three-tier skill gap analysis (required/preferred/bonus) with 
  per-dimension explainability and LLM-generated feedback using Llama 3.1
• Architected candidate ranking system with configurable company-specific 
  weights and real-time score updates
• Tech: Python, FastAPI, Sentence-Transformers, Cross-Encoders, spaCy, 
  Ollama (Llama 3.1), React, Supabase (PostgreSQL + pgvector), Tailwind CSS
Suggestions
Start with Phase 1-3 first — once ATS + company matching works end-to-end, you have a demo-able MVP. Recommendations, rankings, LLM, and frontend polish come after.

Load your JD dataset early (Phase 4, Step 4.2) — the more companies in the database, the more impressive the recommendations and rankings look.

Keep Ollama optional — the system works perfectly with template-based feedback. Ollama makes it look better but shouldn't be a blocker.

For interviews, focus on the backend — the ML pipeline (bi-encoder → cross-encoder → calibration) is the impressive part. Frontend is just presentation. Be ready to explain:

Why bi-encoder + cross-encoder (speed vs accuracy tradeoff)
How cosine similarity works (inner product / norms from Linear Algebra)
Why pgvector instead of a separate vector DB (architectural simplicity)
How ATS and company-specific scores differ fundamentally
For deployment later:

Frontend → Vercel (free)
Backend → Railway or Render (free tier)
Supabase → already cloud-hosted
Ollama → won't work in cloud free tiers (need GPU). Use template fallback or switch to a small cloud LLM API.
Add a few sample resumes to the system before any demo so the Rankings tab has data to show.

Your biggest interview edge: you can connect every technical decision to a course you've taken — cosine similarity (Linear Algebra), optimization of scoring weights (Optimization Techniques), graph-based skill taxonomy (Discrete Math), two-stage retrieval (Algorithms), vector indexing (DBMS). No other candidate will have this depth of understanding.