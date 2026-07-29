# Deployment Transition Plan: Vercel (frontend) + Hugging Face Spaces (backend + transformers) + Gemini API (LLM)

Audience: whoever is executing this migration. You should not need to ask the
original author clarifying questions — everything discovered from the current
codebase is written down here, including exact file paths to change.

## 0. Current state (what we're moving away from)

- **Frontend**: `client/` — Create React App (craco), calls the backend via
  axios (`client/src/services/api.js`), talks to Supabase Auth directly with
  the client-safe anon key (`client/src/contexts/AuthContext.jsx`).
- **Backend**: `server/` — FastAPI (`server/app/main.py`), Supabase (service
  role key) for persistence, spaCy + sentence-transformers (bi-encoder) +
  CrossEncoder for matching, and **Ollama running a local `llama3.2:1b`
  model** for resume/JD parsing and gap-analysis text (`server/app/services/llm_service.py`).
- **Storage**: uploaded resumes are written to local disk at `server/uploads/`
  (`UPLOAD_DIR = "uploads/"` in `server/app/api/endpoints/resumes.py`), and
  the path is stored in the `resumes.file_path` DB column.
- **Deployment today**: none of this is deployed anywhere yet — everything
  runs locally. There is no existing Vercel/HF config to migrate off of; this
  is a first deployment, not a re-platforming.

## 1. Target architecture

```
Browser
  │  (HTTPS, Bearer JWT from Supabase Auth)
  ▼
Vercel (client/ — static React build)
  │  REACT_APP_API_URI = https://<space>.hf.space/api
  ▼
Hugging Face Space (Docker SDK, server/ — FastAPI)
  ├── spaCy / sentence-transformers / CrossEncoder  (in-process, same container)
  ├── Supabase client (service role key)  ──────────────► Supabase (Postgres + Auth + Storage)
  └── Gemini API client (GEMINI_API_KEY) ──────────────► Google Gemini API
```

Key decision: backend + transformer models stay in **one** Space/container.
They already run in-process (`EmbeddingEngine`, `CompanyMatcher` are Python
objects called directly by `rank_service.py`, not separate services), so
splitting them into two deployments would only add network hops and
serialization cost for no isolation benefit. Keep them together.

## 2. Segregation assessment — direct answer

**Yes, the system is sufficiently segregated to do this 3-way split safely,
with three gaps to close first (items 2a–2c below are launch-blocking; 2d is
recommended hardening, not blocking).**

What's already correct:
- The frontend never holds a secret that matters. It only has the Supabase
  **anon** key + URL (`REACT_APP_SUPABASE_URL`/`REACT_APP_SUPABASE_ANON_KEY`),
  which are meant to be public — Supabase enforces access via the JWT, not
  secrecy of the anon key.
- The backend is the only holder of `SUPABASE_SERVICE_ROLE_KEY` (full DB
  access, bypasses RLS) and, after this migration, `GEMINI_API_KEY`. Neither
  currently appears in any committed file — `.env` is gitignored repo-wide
  and only `.env.example` templates are tracked (verified via `git ls-files`).
- Every request is authenticated server-side per-call:
  `app/core/security.py` calls `supabase.auth.get_user(token)` against
  Supabase itself — it does not trust a client-supplied user id. This means
  the backend can move to any host without changing the trust model.
- CORS is already environment-gated (`app/main.py`): production mode refuses
  to start without an explicit `FRONTEND_ORIGINS` allowlist. This is exactly
  the mechanism you'll use to lock the backend down to the Vercel domain.

Gaps to close as part of this transition (details in Phase 2/3 below):

- **2a — Upload storage is local disk, which does not survive on a hosted
  Space.** `server/uploads/` is a relative path on the container's
  filesystem. Hugging Face Spaces containers rebuild/restart (redeploys,
  crashes, and on the free CPU tier, sleep-on-idle) and are not guaranteed to
  preserve local disk across that — files silently disappear while the DB
  still points at them. This must move to Supabase Storage before going live
  (Phase 2). This is a correctness bug the split exposes, not a security one.
- **2b — No Postgres Row-Level Security.** Grepping every file in
  `server/migrations/` for `POLICY`/`ROW LEVEL SECURITY` finds nothing.
  User-data isolation (a resume belonging to user A must never be readable by
  user B) is enforced entirely in application code via
  `.eq("user_id", current_user.id)` filters in `resumes.py`, using a service
  key that bypasses RLS entirely. Today this is fine — the filters are
  present and correct everywhere they need to be — but it means there is no
  database-level backstop: one future endpoint that forgets the filter leaks
  data across tenants with no second line of defense. This is not blocking
  for this deployment (nothing about moving hosts makes it worse), but flag
  it to whoever owns Supabase as follow-up hardening.
- **2c — CORS allowlist is exact-string, and Vercel preview deployments get a
  new URL per branch/PR** (`https://<project>-git-<branch>-<team>.vercel.app`).
  An exact-match `FRONTEND_ORIGINS` list will work for the production domain
  but will reject every preview deployment. Decide up front (Phase 5) whether
  preview deployments need to talk to the real backend — if yes, you need a
  suffix-matching CORS check instead of a flat list; if no (recommended:
  point previews at nothing or a separate staging Space), the flat list is
  fine and simpler.
- **2d — Gemini key handling is net-new**, since nothing calls an external
  LLM API today (Ollama was local-only, no API key involved). Treat
  `GEMINI_API_KEY` with the same care as `SUPABASE_SERVICE_ROLE_KEY`: only as
  an HF Space **secret** (Settings → Variables and secrets), never in the
  Docker image, never in a client env var, never logged. `llm_service.py`
  already logs errors (`logger.error(f"...: {e}")`) — when you rewrite it,
  make sure exception messages from the Gemini SDK don't get logged in a way
  that could leak the key (the SDK doesn't put the key in exception text by
  default, but don't `str(e)` a raw request object either).

Bottom line: the boundaries are drawn in the right places (secrets, auth,
CORS). The two things that actually need engineering work before cutover are
the upload storage move (2a, functional bug) and the Ollama→Gemini swap
(this is the whole point of the migration, not a gap). 2b/2c are judgment
calls to make explicitly, not silent risks.

## 3. Phase-by-phase plan

### Phase 1 — Replace Ollama with Gemini in `llm_service.py`

Four call sites depend on `LLMService`, all outside this file — don't change
their signatures:
- `server/app/services/ats_scorer.py:163` → `generate_general_ats_feedback(...)`
- `server/app/api/endpoints/companies.py:29` → `extract_job_description_data(...)`
- `server/app/services/resume_parser.py` and its callers use
  `extract_resume_data(...)` and `generate_gap_analysis(...)` indirectly via
  the same class.

All four already call into `LLMService` inside a `try/except` at the call
site and degrade gracefully (empty string / `None` on failure) — keep that
contract identical so callers don't need touching.

Changes to `server/app/services/llm_service.py`:
1. Swap `import ollama` for the Gemini SDK (`google-genai`, the current
   Google GenAI SDK — not the older deprecated `google-generativeai` package).
2. Replace `self._client = ollama.Client(...)` with a Gemini client
   constructed from `settings.GEMINI_API_KEY`.
3. For `extract_resume_data` and `extract_job_description_data` (which rely
   on Ollama's `format='json'` to force structured output), use Gemini's
   structured output equivalent: `generation_config={"response_mime_type": "application/json"}`
   (optionally with a `response_schema` matching the dict shapes already
   documented in the docstrings/prompts — the prompts themselves don't need
   to change, only the call mechanics).
4. For `generate_gap_analysis` and `generate_general_ats_feedback` (plain
   text output), a standard `generate_content` call is enough.
5. Pick a Gemini model and put it behind an env var the same way Ollama's
   model name was configurable (`GEMINI_MODEL_NAME`, default e.g.
   `gemini-2.5-flash` — cheap/fast, appropriate for this JSON-extraction and
   short-feedback workload; don't default to a Pro-tier model for this).
6. Keep a timeout, the way `OLLAMA_TIMEOUT_SECONDS` was forwarded to the
   ollama client — the Gemini SDK accepts a per-request timeout; wire it to a
   new `GEMINI_TIMEOUT_SECONDS` setting so a hung request can't stall the
   `asyncio.to_thread` worker forever (same reasoning as the existing code
   comment in `llm_service.py` about why the Ollama timeout exists).

Changes to `server/app/core/config.py`:
- Remove `OLLAMA_MODEL_NAME` / `OLLAMA_HOST` / `OLLAMA_TIMEOUT_SECONDS` (and
  the `os.environ.setdefault("OLLAMA_HOST", ...)` line at the bottom of the
  file — that line becomes dead code).
- Add `GEMINI_API_KEY: str` (required, no default — fail fast at startup if
  missing, same pattern as `SUPABASE_SERVICE_ROLE_KEY`), `GEMINI_MODEL_NAME`,
  `GEMINI_TIMEOUT_SECONDS`.

Changes to `server/requirements.txt`:
- Remove `ollama>=0.1.0`.
- Add `google-genai`.

Changes to `server/.env.example`: replace the `OLLAMA_*` block with
`GEMINI_API_KEY=` / `GEMINI_MODEL_NAME=` documentation, following the same
comment style already used for `EMBEDDING_MODEL_NAME` etc.

Local verification before moving to Phase 2: run the backend locally against
a real `GEMINI_API_KEY` and re-run whatever the team already uses to sanity
check parsing (`server/test_pipeline.py`, `server/test_real_pdf.py` exist for
this) — confirm resume upload → parse → embed → rank → ATS feedback still
produces sane output end-to-end with Gemini instead of Ollama.

### Phase 2 — Move resume file storage off local disk (blocking, see 2a)

`server/app/api/endpoints/resumes.py` currently:
- writes uploads to `UPLOAD_DIR = "uploads/"` (`upload_resume`)
- reads them back for parsing (`_do_parse(file_path)`)
- deletes them by local path (`delete_resume`, with a path-traversal guard
  via `os.path.commonpath` — keep that same defensive check)

Replace local disk with **Supabase Storage** (already in the stack, no new
vendor):
1. Create a private Supabase Storage bucket (e.g. `resumes`).
2. In `upload_resume`, instead of writing to local disk, upload the file
   bytes to that bucket under a per-user or UUID-based key, and store the
   storage key (not a filesystem path) in `resumes.file_path`.
3. In the background job (`process_resume_background`), parsing needs the
   raw bytes — either download from Storage to a temp file
   (`tempfile.NamedTemporaryFile`) before calling `parser.parse(file_path)`,
   or refactor `ResumeParser.parse` to accept bytes directly if that's a
   smaller change (check `resume_parser.py`'s entry point before deciding).
4. In `delete_resume`, replace `os.unlink` with a Storage delete call using
   the stored key.
5. Delete the `MAX_UPLOAD_SIZE_BYTES` streaming-to-disk loop's disk write,
   but keep the 10MB cap check — just check size against the buffered bytes
   before the Storage upload call.
6. `server/uploads/` and its `.gitkeep`/gitignore entry
   (`/server/uploads/*` in root `.gitignore`) can be deleted once this ships.

Do this **before** deploying to HF Spaces — deploying with local-disk uploads
first and fixing it after means real user uploads will vanish in production
between now and the fix.

### Phase 3 — Containerize the backend for Hugging Face Spaces

HF Spaces needs the **Docker** SDK (not Gradio/Streamlit) since this is a
plain FastAPI app. Create `server/Dockerfile`:

- Base: a slim Python image matching whatever Python version the venv
  currently uses (check `server/venv/pyvenv.cfg` for the exact version to
  pin).
- `pip install -r requirements.txt`.
- **Bake the ML models into the image at build time** rather than
  downloading on first request: run
  `python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"`
  and the equivalent for the CrossEncoder, and
  `python -m spacy download en_core_web_sm`, all as `RUN` steps, with
  `HF_HOME`/`TRANSFORMERS_CACHE` pointed at a path that ends up inside the
  image (matching `MODEL_CACHE_DIR`). Rationale: HF Spaces' free-tier
  filesystem is not guaranteed persistent storage — without paying for the
  "Persistent Storage" add-on, a rebuild/restart can lose anything written
  to disk at runtime, which would otherwise mean a slow ~176MB re-download
  (per the existing `du -sh server/assets/models` measurement) on every cold
  start. Baking into the image avoids that entirely and is the standard
  pattern for HF Docker Spaces running sentence-transformers models.
- Expose port `7860` (the port HF Spaces' Docker SDK expects by convention)
  and run `uvicorn app.main:app --host 0.0.0.0 --port 7860`.
- Do **not** copy `.env`, `server/uploads/`, or `server/venv/` into the image
  (add a `.dockerignore` mirroring the root `.gitignore` exclusions).

Set these as **HF Space secrets** (Settings → Variables and secrets, not
plain "Variables" — secrets aren't shown in the Space's public config):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`,
`ENVIRONMENT=production`, `FRONTEND_ORIGINS` (the Vercel production URL,
comma-separated if there's a custom domain + the vercel.app one).

### Phase 4 — Deploy backend, verify standalone

1. Push `server/` to the HF Space repo (Spaces are themselves git repos).
2. Watch the build logs for the model-baking `RUN` steps completing.
3. Hit `https://<space>.hf.space/` (should return the root welcome JSON from
   `main.py`) and `https://<space>.hf.space/docs` (FastAPI's auto docs) to
   confirm the container is up before wiring the frontend to it.
4. Do one authenticated smoke test with a real Supabase JWT (e.g. via curl
   with a token obtained from a local Supabase Auth login) against
   `/api/resumes/` to confirm the full DB + auth path works from the new
   host, independent of the frontend.

### Phase 5 — Deploy frontend to Vercel

1. Vercel project root: `client/`. Build command/output are whatever CRA's
   defaults are (`npm run build` → `build/`) — craco doesn't change this.
2. Vercel env vars (Project Settings → Environment Variables):
   - `REACT_APP_API_URI = https://<space>.hf.space/api` — this **must** be
     the full absolute URL now. The current default fallback in
     `client/src/services/api.js` (`'/api'`) assumed same-origin serving,
     which no longer holds once frontend and backend are on different
     domains — don't rely on the fallback, set this explicitly.
   - `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` — same values
     as local dev, safe to expose (see segregation assessment above).
3. Because CRA is a client-side-routed SPA, add `client/vercel.json` with a
   catch-all rewrite to `index.html` so deep links (e.g. a refresh on
   `/dashboard`) don't 404:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
4. Decide the Phase-2c question now: if preview deployments (per-PR Vercel
   URLs) need to hit the real backend, implement suffix matching in
   `app/main.py`'s CORS origin check for `*.vercel.app`; otherwise leave the
   allowlist to just the production domain and accept that preview builds
   will get CORS errors calling the API (frontend-only UI review still works).

### Phase 6 — Wire together and test end-to-end

1. Confirm `FRONTEND_ORIGINS` on the Space matches the exact Vercel
   production URL (scheme + host, no trailing slash).
2. From the deployed frontend: sign in, upload a resume, confirm the job
   status polling (`GET /api/resumes/status/{job_id}`) completes, confirm
   Gemini-produced parsed data and gap analysis show up, confirm ranking
   against companies works, confirm delete removes the Supabase Storage
   object (Phase 2) rather than erroring on a missing local path.
3. Watch HF Space logs during this test for the model load time and first
   Gemini call latency — first request after an idle period on the free CPU
   tier will be slower (container wake) in addition to whatever Gemini's
   latency is; make sure the frontend's job-polling UI already tolerates
   this (it's designed around background jobs + polling already, so it
   should, but verify the timeout/retry values in `client/src/services/api.js`
   callers are generous enough).

### Phase 7 — Cutover and rollback

- Keep local `.env`-based dev running throughout — nothing here changes the
  local dev path except that `llm_service.py` now needs a
  `GEMINI_API_KEY` in local `.env` too once Phase 1 lands (Ollama stops being
  an option for anyone after that commit merges, including local dev).
- Rollback path: since this is a first production deployment (not replacing
  a live system), "rollback" mainly means reverting the Space to the
  previous build or pointing Vercel back at a previous deployment via its
  deployment history — no data migration is involved, so this is low-risk
  either direction.

## 4. Env var reference (where each secret/config lives after migration)

| Variable | Lives in | Notes |
|---|---|---|
| `SUPABASE_URL` | HF Space secret | also fine as a plain var, not sensitive by itself |
| `SUPABASE_SERVICE_ROLE_KEY` | HF Space secret **only** | never in client, never in image |
| `GEMINI_API_KEY` | HF Space secret **only** | net-new; never in client, never in image |
| `GEMINI_MODEL_NAME`, `GEMINI_TIMEOUT_SECONDS` | HF Space variable | non-secret config |
| `ENVIRONMENT=production` | HF Space variable | required or `main.py` refuses to start |
| `FRONTEND_ORIGINS` | HF Space variable | exact Vercel origin(s), comma-separated |
| `EMBEDDING_MODEL_NAME`, `CROSS_ENCODER_MODEL_NAME`, `MODEL_CACHE_DIR`, `RANKING_CROSS_ENCODER_TOP_K` | HF Space variable or Dockerfile default | unchanged from today |
| `REACT_APP_API_URI` | Vercel env var | full absolute HF Space URL, not `/api` |
| `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` | Vercel env var | public by design |

## 5. Summary of code changes required (file list)

- `server/app/services/llm_service.py` — Ollama → Gemini client (Phase 1)
- `server/app/core/config.py` — drop `OLLAMA_*` settings, add `GEMINI_*` (Phase 1)
- `server/requirements.txt` — drop `ollama`, add `google-genai` (Phase 1)
- `server/.env.example` — document new Gemini vars (Phase 1)
- `server/app/api/endpoints/resumes.py` — Supabase Storage instead of local disk (Phase 2)
- `server/Dockerfile` (new), `server/.dockerignore` (new) — Phase 3
- `client/vercel.json` (new) — SPA rewrite rule (Phase 5)
- No changes needed to: `security.py`, `database.py`, `main.py`'s CORS logic
  (unless preview-URL matching is added per 2c), `embedding_engine.py`,
  `company_matcher.py`, `nlp_model.py`, or any client component code.
