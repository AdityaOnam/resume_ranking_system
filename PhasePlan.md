# Project Task Division & Development Plan

## Team Structure

### 👨‍💻 Person 1 - Full Stack Development
Responsible for:
- Frontend
- Backend
- Database
- Deployment
- Integration

### 🤖 Person 2 - AI / Machine Learning
Responsible for:
- Resume Parsing
- ATS Engine
- Company Matching
- Recommendation System
- Ranking Logic
- LLM Integration

---

# Development Order

## Phase 1 - Project Setup

### Person 1
- Setup Git repository
- Setup FastAPI project
- Setup React + Tailwind
- Configure Supabase
- Design PostgreSQL database
- Create storage buckets
- Configure authentication
- Setup API structure

### Person 2
- Setup Python environment
- Install AI dependencies
  - spaCy
  - Sentence Transformers
  - PyMuPDF
  - python-docx
- Download required models
- Setup project structure

---

# Phase 2 - Resume Upload

### Person 1
- Build Resume Upload API
- Store files in Supabase Storage
- Save metadata in Database
- Create Upload UI

### Person 2
- Build Resume Parser
- Parse PDF files
- Parse DOCX files
- Extract:
  - Contact
  - Skills
  - Education
  - Experience
  - Projects
- Return structured JSON

---

# Phase 3 - Resume Analysis

### Person 1
- Connect Upload API with Parser
- Store parsed resume data
- Create Resume APIs

### Person 2
- Generate Embeddings
- Skill Extraction
- Build Skill Taxonomy
- Cosine Similarity Engine

---

# Phase 4 - ATS Engine

### Person 1
- Create ATS API
- Build ATS Dashboard UI

### Person 2
Implement ATS scoring:

- Contact Information
- Resume Sections
- Formatting
- Keywords
- Action Verbs
- Quantification
- Readability
- Red Flags

Generate:

- ATS Score
- ATS Report
- Suggestions

---

# Phase 5 - Company Management

### Person 1
- Company CRUD APIs
- Company Dashboard
- Bulk Upload Companies

### Person 2
- Parse Job Descriptions
- Generate Company Embeddings
- Skill Categorization

---

# Phase 6 - Company Matching

### Person 1
- APIs for Matching Results
- Matching Dashboard UI

### Person 2
Implement:

- Bi-Encoder Similarity
- Cross-Encoder Reranking
- Skill Matching
- Calibration
- Final Match Score

---

# Phase 7 - Recommendation Engine

### Person 1
- Recommendation APIs
- Recommendation UI

### Person 2
Implement:

- Vector Search
- Best Company Recommendation
- Score Normalization

---

# Phase 8 - Ranking System

### Person 1
- Ranking APIs
- Leaderboard UI

### Person 2
Implement:

- Candidate Ranking
- Ranking Score
- Ranking Updates

---

# Phase 9 - AI Explanation

### Person 1
- Display AI Results
- Integrate AI APIs

### Person 2
Implement:

- Ollama Integration
- Prompt Engineering
- Resume Feedback
- Skill Gap Analysis
- Improvement Suggestions

---

# Phase 10 - Testing & Deployment

### Person 1
- Authentication Testing
- Frontend Testing
- API Testing
- Deployment
- Bug Fixes

### Person 2
- Parser Testing
- ATS Validation
- Matching Evaluation
- Recommendation Testing
- AI Optimization

---

# Responsibility Matrix

| Module | Person 1 | Person 2 |
|---------|----------|----------|
| React Frontend | ✅ | |
| FastAPI Backend | ✅ | |
| PostgreSQL Database | ✅ | |
| Supabase Storage | ✅ | |
| Authentication | ✅ | |
| Resume Upload | ✅ | |
| Resume Parser | | ✅ |
| Embeddings | | ✅ |
| ATS Engine | | ✅ |
| Company Matching | | ✅ |
| Recommendation Engine | | ✅ |
| Ranking Algorithm | | ✅ |
| Ollama / LLM | | ✅ |
| AI Testing | | ✅ |
| Deployment | ✅ | Assist |

---

# Project Milestones

- ✅ Project Setup
- ✅ Resume Upload
- ✅ Resume Parsing
- ✅ ATS Scoring
- ✅ Company Management
- ✅ Company Matching
- ✅ Recommendation Engine
- ✅ Candidate Ranking
- ✅ AI Explanations
- ✅ Frontend Completion
- ✅ Final Integration
- ✅ Testing
- ✅ Deployment