# Master Implementation Log

*This document serves as a historical log of all backend/ML architecture completed by Person 2, and explicitly maps out the corresponding integration work required from Person 1.*

---

## 1. Environment & ML Dependencies (Completed)
*   **What was built:** Configured the Python backend environment. Installed and configured complex ML dependencies including `PyMuPDF` (for layout-aware PDF text extraction), `python-docx` (for Word documents), `spacy` (with `en_core_web_sm` model for NLP), `sentence-transformers` (for embeddings), and `ollama` (for local LLM integration).
*   **Person 1 Corresponding Work:** Ensure the FastAPI server runner (`main.py` and Uvicorn) is configured and running properly in this environment.

## 2. Skill Taxonomy (Completed)
*   **What was built:** Created `data/skill_taxonomy.json`, a hierarchical database of over 500 standardized skills across 14 categories. 

## 3. Advanced Resume Parser Engine (Completed)
*   **What was built:** Developed `services/resume_parser.py`. This engine replaces basic parsing with a multi-layered approach:
    *   Extracts raw text and embedded hyperlinks from PDFs and DOCX files.
    *   Uses fast NLP heuristics and Regex to slice the document into sections and accurately extract contact info, education (with GPA normalization), and skills.
*   **Person 1 Corresponding Work:** 
    *   Build a React Frontend component allowing users to upload resumes.
    *   Build a FastAPI endpoint (e.g., `POST /api/resumes/upload`) that receives the file, uploads the raw file to Supabase Storage, and passes the local file path to `ResumeParser.parse(file_path)`.

## 4. Local LLM Integration (Completed)
*   **What was built:** Developed `services/llm_service.py` to connect to a local **Llama 3.1 (8B)** model via Ollama. This service is instructed to output strict JSON to perfectly format complex, unstructured paragraphs like "Work Experience" and "Projects" that regex struggles with. It automatically utilizes available GPU hardware.

## 5. GitHub API Cross-Referencing (Completed)
*   **What was built:** Developed `services/github_service.py`. If the parser detects a GitHub URL in the resume, this service fetches all public repositories, calculates a byte-weighted percentage of programming languages used, fuzzy-matches the resume's projects to actual repos, and extracts hidden skills directly from the `README.md` files.

## 6. Parsing Orchestration & Merging (Completed)
*   **What was built:** Updated `resume_parser.py` to intelligently merge the heuristic data, LLM data, and GitHub data into a single "Master Candidate Profile" JSON object. It prefers Regex for exact contact info but defers to the LLM for descriptive text.
*   **Person 1 Corresponding Work:** Define the exact Supabase database schema for the `resumes` table, ensuring it has a `JSONB` column to store this Master Candidate Profile.

## 7. Semantic Embedding Engine (Completed)
*   **What was built:** Developed `services/embedding_engine.py` using a Singleton pattern to load the `all-MiniLM-L6-v2` SentenceTransformer model into memory. 
    *   Implemented a flattener that converts the Master Candidate Profile JSON into a dense semantic string.
    *   Generates a highly accurate **384-dimensional mathematical vector** representing the candidate.
*   **Person 1 Corresponding Work:** 
    *   Configure the Supabase database with the `pgvector` extension.
    *   Ensure the vector column is configured to exactly **384 dimensions** (e.g., `embedding vector(384)`).
    *   Build the FastAPI endpoint that takes the final JSON and the 384D Vector and executes the SQL `INSERT` into Supabase.
