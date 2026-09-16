# Resume Ranking System: Deployment & Migration Documentation

**Date:** July 2026
**Target Architecture:** Vercel (Frontend) + Render.com (Backend) + Supabase (Database & Storage)

---

## 1. Executive Summary

This document details the architectural changes made to the Resume Ranking System to transition it from a purely local development environment (relying on local disk storage and local Ollama inference) to a scalable, cloud-ready production environment.

The major upgrades include:
1.  **Dual LLM Provider System:** Abstracting the LLM layer to support both local Ollama inference and cloud-based Google Gemini inference with multi-key rate-limit rotation.
2.  **Cloud File Storage Migration:** Moving away from ephemeral local file system uploads (`uploads/`) to permanent, secure Supabase Storage.
3.  **Containerization:** Preparing the backend to run on Render.com by baking required NLP models directly into a Docker image to prevent slow cold-starts.
4.  **CORS & Vercel Compatibility:** Updating network security rules to seamlessly integrate with Vercel's preview deployment ecosystem.

---

## 2. Architectural Changes

### A. The LLM Service Abstraction (`llm_service.py`)
Previously, the backend was hardcoded to use the `ollama` Python client. For cloud deployment, local Ollama inference is impractical, so we integrated Google's Gemini API while keeping the codebase backward-compatible for open-source users who want to run locally with Ollama.

*   **Implementation:** Created a unified `LLMService` facade that routes requests to either `_OllamaBackend` or `_GeminiBackend` based on the `LLM_PROVIDER` environment variable.
*   **Model Upgrade:** The default model was upgraded to `gemini-3.5-flash` for blazing-fast inference.
*   **Fault Tolerance:** Implemented a multi-key rotation system for Gemini. By providing a comma-separated list of keys in `GEMINI_API_KEYS`, the system automatically catches `HTTP 429 Resource Exhausted` errors and silently retries the request using the next available key.

### B. Supabase Storage Migration (`resumes.py`)
Cloud containers (Render, HF Spaces, etc.) are ephemeral; any files saved to the local disk are lost when the container sleeps or restarts. 

*   **Implementation:** Upload endpoints were rewritten to pipe file bytes directly into a Supabase Storage bucket named `resumes`. 
*   **Background Processing:** The background worker (`process_resume_background`) now downloads the PDF from Supabase to a temporary file (`tempfile.NamedTemporaryFile`), runs the `spacy`/`sentence-transformers` models over it, extracts the text, and immediately deletes the temporary file.

### C. Docker Containerization (`Dockerfile` & `.dockerignore`)
To deploy the FastAPI server to Render.com (or any Docker-based host), we created a specialized `Dockerfile`.

*   **Pre-baking Models:** To ensure the backend boots up quickly and doesn't time out downloading massive binaries on every wake-up, the Dockerfile includes specific `RUN` commands that download `sentence-transformers` (`all-MiniLM-L6-v2`, `ms-marco-MiniLM-L-6-v2`) and the `spaCy` `en_core_web_sm` model directly into the image layer at build time.

### D. CORS and Vercel Routing (`main.py` & `vercel.json`)
*   **Backend CORS:** Configured `allow_origin_regex` to dynamically accept requests from any `*.vercel.app`, `*.hf.space`, or `*.onrender.com` domain. This ensures that every preview branch pushed to GitHub automatically gets a working frontend environment without needing to manually whitelist URLs.
*   **Frontend Routing:** Added a `vercel.json` file in the `client/` directory with a rewrite rule (`"source": "/(.*)", "destination": "/index.html"`) so that React Router can handle client-side routing correctly on Vercel without triggering 404 errors on refresh.

---

## 3. Environment Variable Configuration

To support the new architecture, the following configuration parameters were added:

### Backend (`server/.env`)
```ini
# LLM Selection ("ollama" or "gemini")
LLM_PROVIDER=gemini

# Comma-separated Gemini Keys
GEMINI_API_KEYS=AIzaSy...key1,AIzaSy...key2
GEMINI_MODEL_NAME=gemini-3.5-flash
GEMINI_TIMEOUT_SECONDS=60

# Production CORS config (only exact domains, preview domains handled automatically by regex)
ENVIRONMENT=production
FRONTEND_ORIGINS=https://your-main-app.vercel.app
```

---

## 4. Deployment Playbook

### Step 1: Prepare Supabase
1.  Navigate to your Supabase Dashboard -> **Storage**.
2.  Create a new **Private** bucket exactly named `resumes`.

### Step 2: Deploy Backend to Render.com
1.  Create a new **Web Service** on Render, connect your GitHub repo.
2.  Set **Root Directory** to `server` and **Runtime** to `Docker`.
3.  Add environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_PROVIDER=gemini`, `GEMINI_API_KEYS`, `ENVIRONMENT=production`.
4.  Deploy. The Docker build will take ~5-10 minutes the first time.

### Step 3: Deploy Frontend to Vercel
1.  Import your GitHub repository into Vercel, set **Root Directory** to `client`.
2.  Add `REACT_APP_API_URI=https://your-render-url.onrender.com/api`, `REACT_APP_SUPABASE_URL`, and `REACT_APP_SUPABASE_ANON_KEY` to your Vercel Environment Variables.
3.  Deploy.

---
*End of Document*
