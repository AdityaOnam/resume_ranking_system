# ResumeRanker Frontend — Work Order

Self-contained execution spec. Assume zero prior context from any other conversation. Work through the tasks in priority order (Task 1 → Task 9). Each task has exact files, the current buggy state, the required fix, and acceptance criteria you can verify yourself without asking the user anything. Do not stop to ask clarifying questions — every decision needed to execute is already made below.

## Repo orientation (read this first)

- Monorepo: `client/` = React 18 + CRACO + Tailwind (CRA, not Vite). `server/` = FastAPI + Supabase (Postgres/PostgREST).
- Design system: single dark theme only (no light mode exists). Tokens live in `client/tailwind.config.js` (`background #0F1023`, `surface #1A1D3A`, `surface-variant #222543`, `primary #6c63ff`, `secondary #22c55e` (used as a success/green color despite the name), `error #ffb4ab`, `outline-variant #343753`, `on-surface #f1f3fa`, `on-surface-variant #a3a6c4`). Reusable component classes are in `client/src/index.css`: `.card`, `.panel`/`.cyber-panel`, `.chip`, `.skill-tag`, `.nav-link`/`.nav-link-active`, `.btn-primary`/`.btn-ghost`, `.score-badge-high`/`.score-badge-mid`/`.score-badge-low`. **Always prefer these classes/tokens over inline hex or Tailwind's default color palette (`slate-*`, `blue-*`, etc. do not match this app's theme).**
- Layout shell: `client/src/App.jsx` renders `TopBar` (always visible) + conditionally `Sidebar` (only on `/ats` routes). `/` and `/upload` render `Dashboard`, `/companies` renders `CompaniesShowcase`, `/resumes/:id` renders `ResumeResultPage` → `CandidateProfile`.
- Backend runs on port 8000 (`cd server && uvicorn app.main:app --reload --port 8000`), frontend on port 3000 (`cd client && npm start`), CRA proxies `/api/*` to the backend via `client/package.json`'s `"proxy"` field. Frontend API calls live in `client/src/services/api.js` — always add new endpoints there, never hardcode URLs in components.
- Backend Company model (`server/app/models/company.py`) uses **snake_case**: `name`, `cpi`, `skill_set`, `internship_role`, `visits_iit_patna`, `min_projects`, `project_keywords`, `branch`, `dsa_required`, `core_skills`, `description`, `id`, `created_at`. Do not invent camelCase field names.
- Verify your work by starting both servers and using a browser/devtools — don't just eyeball the JSX.

---

## Task 1 — Fix and wire up `FeaturesSection.jsx` (P0, quick)

**File:** `client/src/components/Dashboard/FeaturesSection.jsx` (currently fully built but never imported anywhere — dead code).

**Current bugs to fix:**
- Uses light-mode Tailwind classes throughout (`bg-white dark:bg-slate-800`, `text-slate-900 dark:text-white`, `bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400`, etc.) that don't exist in this app's theme and will render as a jarring light card in an otherwise all-dark UI.
- Uses `font-heading` which is not a defined font family in `tailwind.config.js` (the config only defines `font-display` (Hanken Grotesk) and default sans/mono (Geist)). This class currently does nothing.

**Required fix:**
1. Replace the card wrapper classes with `cyber-panel` (or `card card-hover`) instead of the hardcoded `bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 border ...` block.
2. Replace `text-slate-900 dark:text-white` → `text-on-surface`; `text-slate-600 dark:text-slate-300` → `text-on-surface-variant`.
3. Replace `font-heading` → `font-display`.
4. Replace the `colorMap` (blue/purple/amber Tailwind classes) with a scheme using the existing tokens, e.g. icon container `className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-5"` for all three (simplest — matches how icon containers are styled elsewhere in `Dashboard.jsx`'s `StatCard`), or vary using `primary`/`secondary`/`tertiary` if you want each card to look distinct.
5. Keep the `framer-motion` stagger animation — it's fine as-is.

**Wire it in:** In `client/src/components/Dashboard/Dashboard.jsx`, import `FeaturesSection` and render it below the existing "Stats Row" grid (after the closing `</div>` of the 3-column stats grid, still inside the `max-w-6xl mx-auto` wrapper).

**Acceptance criteria:** Navigate to `/` in the browser. Below the stats cards, a "How It Works" section with 3 cards (Upload Resume / AI Analysis / Get Ranked) renders using the same dark surface/border styling as the rest of the page — no white cards, no console errors, no unstyled/missing-font text.

---

## Task 2 — Fix and wire up `PopularCompanies.jsx` (P0, moderate)

**File:** `client/src/components/Dashboard/PopularCompanies.jsx` (currently fully built but never imported anywhere).

**Current bugs to fix (all confirmed by reading the actual backend model, not guessed):**
1. **Wrong field names.** The component reads `company.internshipRole`, `company.visitsIITPatna`, `company.skillSet` — none of these exist. The real API returns `internship_role`, `visits_iit_patna`, `skill_set` (see repo orientation above). Fix every reference.
2. **Dynamic Tailwind class names don't work.** Line ~112 builds classes like `` bg-${getColorClass(1)}-100 `` and `` text-${getColorClass(index)}-400 `` at runtime. Tailwind's compiler statically scans source for complete class name strings — it cannot see these interpolated names, so **none of these classes exist in the production CSS build** and the icon badges silently render unstyled. Replace with a static lookup object, e.g.:
   ```js
   const ICON_STYLES = ['bg-primary/10 text-primary', 'bg-secondary/10 text-secondary', 'bg-tertiary/10 text-tertiary'];
   // usage: className={`w-12 h-12 ${ICON_STYLES[index % ICON_STYLES.length]} rounded-lg flex items-center justify-center mr-4`}
   ```
3. **Light-mode classes throughout** (`bg-white dark:bg-slate-800`, `text-slate-900 dark:text-white`, `text-slate-500 dark:text-slate-400`, `bg-primary-100 dark:bg-primary-900/30`, `font-heading`) — same issue and same fix pattern as Task 1: swap for `cyber-panel`/`card`, `text-on-surface`, `text-on-surface-variant`, `font-display`.
4. **`console.log(displayedCompanies)` on line 58** — remove this debug statement.
5. **Unused/confusing state**: `const [, setError] = useState(null);` and `const [showAll, ] = useState(false);` — `error` is set but never rendered anywhere (no error UI), and `showAll` is always `false` with no setter ever called, so "View All Companies" always links out instead of the button ever expanding in place. Either:
   - (a) Simplest: remove the unused `error` state entirely (or add a one-line error message render like `{error && <p className="text-error text-sm text-center">{error}</p>}`), and remove `showAll` state since it's dead — always show the 6-item slice and rely on the existing "View All Companies" link to `/companies` for the rest.
6. **`Skeleton` import path** — verify `../ui/skeleton` resolves correctly relative to `components/Dashboard/` (it should — `components/ui/skeleton.jsx` exists). The `Skeleton` component itself also uses `bg-gray-200 dark:bg-gray-700` — replace with `bg-surface-variant` to match the theme, or leave it (it's a shared low-priority utility, lower priority than the two files above).

**Wire it in:** Import into `Dashboard.jsx` and render directly below `FeaturesSection` from Task 1.

**Acceptance criteria:** Navigate to `/`. Below "How It Works", a "Popular Companies" section shows up to 6 real companies fetched from `GET /api/companies/` with correct role/CPI/skills/branch data (cross-check against `psql`/Supabase directly if unsure), styled consistently dark, no console errors, no `console.log` output, and a working "View All Companies" link to `/companies`.

---

## Task 3 — Mobile navigation (P0, the actual usability blocker)

**Files:** `client/src/components/common/Header.jsx` (exports `Sidebar` and `TopBar`), `client/src/App.jsx`.

**Problem:** `TopBar`'s nav (`<nav className="hidden md:flex ...">`) and `Sidebar` (`<aside className="hidden md:flex ...">`) both vanish below the `md` breakpoint (768px) with zero replacement. A phone-width user sees only the logo and icon buttons — no way to navigate to Upload/Companies/ATS at all.

**Required fix:**
1. Add a hamburger `IconButton` in `TopBar`, visible only below `md` (`className="md:hidden ..."`), e.g. material icon `menu`.
2. Add local state `const [mobileNavOpen, setMobileNavOpen] = useState(false)` in `TopBar` (or lift to `App.jsx`'s `Shell` component if `Sidebar` also needs to respond to it on `/ats`).
3. On click, render a slide-over/drawer (fixed inset-0 overlay + a panel sliding from the left, `w-64`, dark background `bg-surface-container-low`, matching `Sidebar`'s existing styling) containing the same nav items as both `TopBar`'s `links` array and `Sidebar`'s `navItems` array (dedupe into one shared list if convenient).
4. Close the drawer on nav-item click (call `navigate` then `setMobileNavOpen(false)`) and on backdrop click.
5. Do not change desktop behavior (`md:` and above) at all.

**Acceptance criteria:** Resize the browser (or use device emulation) to width 375px. A hamburger button is visible and clicking it opens a drawer with links to Upload, Companies, and ATS Dashboard that actually navigate and close the drawer. At width ≥768px, behavior is unchanged from today.

---

## Task 4 — Fix fake ATS Dashboard pagination (P1)

**File:** `client/src/pages/ATSDashboard.jsx`.

**Problem:** The "1 2 3" page-number buttons (in the table footer) have no `onClick` and no effect on what rows render — `filtered.map(...)` always renders every matching candidate regardless of which "page" button is clicked.

**Required fix (client-side pagination, since `GET /api/resumes/` has no server-side pagination params yet):**
1. Add `const [page, setPage] = useState(1);` and a `PAGE_SIZE = 10` constant (or similar).
2. Compute `const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));` and `const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);`. Render `pageRows` instead of `filtered` in the table body.
3. Reset `page` to `1` whenever `search` changes (add to the `onChange` handler or a `useEffect` keyed on `search`).
4. Replace the hardcoded `{[1, 2, 3].map(...)}` with a loop over `Array.from({ length: totalPages })`, wire each button's `onClick={() => setPage(p)}`, and highlight the active page using the existing conditional class pattern (`p === page ? 'bg-primary text-white ...' : '...'`).
5. Update the footer text (`{filtered.length} of {candidates.length} candidates`) to also show current page, e.g. `Page {page} of {totalPages} — {filtered.length} of {candidates.length} candidates`.

**Acceptance criteria:** With more than 10 resumes in the database, the ATS Dashboard shows only 10 rows per page, page buttons are clickable and change the visible rows, and searching resets to page 1.

---

## Task 5 — Adopt `react-query` for data fetching (P1)

**Context:** `@tanstack/react-query` is already listed in `client/package.json` dependencies but is not used anywhere in the codebase — every component does its own `useState`/`useEffect`/`try-catch` around calls in `client/src/services/api.js`.

**Required fix:**
1. In `client/src/index.js` (or `App.jsx`, wherever the root render happens), wrap the app in a `QueryClientProvider` with a `new QueryClient()`.
2. Convert these fetches to `useQuery`:
   - `Dashboard.jsx`: `getResumes()` and `getCompanies()` (currently a manual `Promise.all` in a `useEffect`).
   - `ATSDashboard.jsx`: `getResumes()`.
   - `CandidateProfile.jsx` (or `ResumeResultPage.jsx`, wherever `getResumeById(id)` is called): convert to `useQuery(['resume', id], () => getResumeById(id))`.
   - `PopularCompanies.jsx` (from Task 2): `getCompanies()`.
3. Convert the upload mutation (`uploadResume` in `Dashboard.jsx`'s `handleFile`) to `useMutation` if convenient, but this is lower priority than the read-side queries above since it has custom polling logic that doesn't map as cleanly to react-query primitives — don't force it if it adds complexity, the read-side conversions matter more.
4. Keep loading/error UI behavior equivalent to today (skeleton loaders, error messages) — react-query's `isLoading`/`isError`/`error` fields map directly to the existing conditional render patterns.

**Acceptance criteria:** Navigating between `/`, `/ats`, and back re-uses cached data instantly (no loading flicker on the second visit within the default cache window) while still refetching on a real page reload. No behavior regression in error states (kill the backend temporarily and confirm error UI still shows).

---

## Task 6 — Fix `generate_rankings` blocking the event loop (P1, backend)

**File:** `server/app/services/rank_service.py`, and callers in `server/app/api/endpoints/resumes.py` and `server/app/api/endpoints/companies.py`.

**Problem:** `generate_rankings` in `rank_service.py` is declared `async def generate_rankings(...)` but contains **no `await` anywhere in its body** — it's synchronous CPU-bound work (CrossEncoder transformer inference across every company) wearing `async` syntax. Because nothing inside it actually yields to the event loop, calling `await generate_rankings(...)` from within a FastAPI async request handler **fully blocks the single event loop for the entire computation** (confirmed empirically: one upload against 138 companies took ~90 seconds during which other endpoints were unresponsive).

**Required fix:**
1. In `rank_service.py`, change `async def generate_rankings(...)` to plain `def generate_rankings(...)` (remove `async` — it was never doing real async work).
2. In `resumes.py`'s `process_resume_background`, change:
   ```python
   rankings = await generate_rankings(parsed_resume_data, resume_text, companies)
   ```
   to:
   ```python
   rankings = await asyncio.to_thread(generate_rankings, parsed_resume_data, resume_text, companies)
   ```
   (matches the existing pattern already used for `_do_parse`/`_do_embed`/`_do_ats` in the same file — `asyncio` is already imported there).
3. In `companies.py`'s `_rerank_resumes_for_new_company` (the background task that re-ranks existing resumes when a new company is added), change:
   ```python
   rankings = await generate_rankings(resume_data_passed, resume_text, [new_company])
   ```
   to:
   ```python
   rankings = await asyncio.to_thread(generate_rankings, resume_data_passed, resume_text, [new_company])
   ```
   Add `import asyncio` at the top of `companies.py` if not already present.

**Acceptance criteria:** Start an upload that will take a while (many companies), and while it's processing, hit `GET /api/resumes/` or `GET /api/companies/` from a separate terminal/tab — it should respond immediately instead of waiting for the upload's ranking pass to finish. (Verify with `curl` from two terminals, or the FastAPI `/docs` Swagger UI in a second tab.)

---

## Task 7 — Accessibility pass (P2)

**Files:** `client/src/pages/CandidateProfile.jsx`, `client/src/pages/ATSDashboard.jsx`, `client/src/components/common/Header.jsx`.

**Required fixes:**
1. In `CandidateProfile.jsx`'s ranking table, the expand/collapse chevron (`<span className="material-symbols-outlined ...">expand_more</span>`) is inside a `<tr onClick={...}>` with no keyboard/screen-reader affordance. Add `role="button"`, `tabIndex={0}`, `aria-expanded={isExpanded}`, and an `onKeyDown` handler that triggers the same toggle on Enter/Space.
2. In `ATSDashboard.jsx`, the row-chevron (`chevron_right` icon) has the same issue — same fix pattern (the whole `<tr onClick={...}>` needs `role="button" tabIndex={0} aria-expanded aria-label="View candidate details"` plus keyboard handling).
3. In `Header.jsx`, the "Notifications" button already has `aria-label="Notifications"` — good, keep the pattern. Audit any other icon-only `<button>` (e.g. the visual-only theme toggle from earlier, table row action buttons) and ensure every one has an `aria-label` describing its action, not just an icon.
4. Skill tags in `CandidateProfile.jsx` use color/opacity alone to imply confidence in some designs — if you add any future confidence-tier styling, always pair it with text (e.g. a tooltip or a small percentage label), never color alone.

**Acceptance criteria:** Tab through the ranking table and candidate table using only the keyboard — every interactive row/button is reachable and operable (Enter/Space activates it), and a screen reader (or the browser's accessibility inspector) announces a meaningful label for every icon-only control, not raw icon-font text like "expand_more".

---

## Task 8 — New feature: cross-candidate Leaderboard (P2, optional, pick this one if doing new feature work)

This was previously an empty stub file (`components/Rankings/Leaderboard.jsx`, deleted as dead code) representing a real, useful, and currently-buildable feature — unlike the LLM-explanation idea (blocked on re-enabling disabled LLM extraction) or a fuller ATS gap report (lower value, largely duplicates the existing ATS Score card), this one needs no backend changes at all.

**Goal:** A view where a user picks a company and sees every candidate ranked against it, instead of the current per-candidate-only view.

**Data available today:** `GET /api/resumes/` returns every resume including its `rankings` array (`{company, companyName, score, rank, eligible, ...}` per company). `GET /api/companies/` returns the company list.

**Required implementation:**
1. New page `client/src/pages/LeaderboardPage.jsx`: a company picker (dropdown or searchable list, reuse `getCompanies()`) plus a table.
2. On company selection, fetch all resumes (`getResumes()` — note: today's list endpoint only selects `id, name, email, skills, rankings, created_at, ats_score, ats_breakdown, ats_feedback`, which is sufficient), then client-side: for each resume, find the ranking entry matching the selected company's id, filter out resumes with no ranking entry for that company, sort by `score` descending, and render a table: Rank | Candidate Name | Email | Score | Eligible.
3. Add a route `/leaderboard` in `App.jsx` and a nav link in both `TopBar` and `Sidebar` (and the Task 3 mobile drawer, if built).
4. Style using existing table patterns from `CandidateProfile.jsx`'s "AI Match Ranking" table (`cyber-panel !p-0 overflow-hidden`, same header/row classes) for visual consistency.

**Acceptance criteria:** Selecting a company (e.g. "Amazon") shows every candidate who has a ranking entry for that company, sorted best-to-worst, with visibly correct scores matching what each candidate's own `/resumes/:id` page shows for that same company.

---

## Task 9 — Make LLM-generated suggestions actually appear in the results page (P1)

**Context, confirmed by direct code inspection:** Right now the candidate results page (`CandidateProfile.jsx` → `ATSScoreCard.jsx`) shows an ATS score, a 5-category breakdown, and a feedback list — but **none of it is LLM-generated**. It's 100% rule-based:
- `server/app/services/resume_parser.py` lines ~248-251: the LLM structured-extraction call is commented out and replaced with `llm_data = {}`. Every field shown on the results page (skills, education, experience, projects) comes from regex/spaCy heuristics only.
- `server/app/services/ats_scorer.py` line ~166: `"gap_analysis": []` is hardcoded — explicitly disabled with the comment "too slow on CPU".
- `server/app/services/llm_service.py` already has two fully-implemented, currently-uncalled methods that produce exactly the missing content: `generate_general_ats_feedback(resume_text, score_data) -> str` (a 2-3 paragraph narrative critique of the whole resume) and `generate_gap_analysis(resume_text, jd_text, match_result) -> str` (a narrative explanation of fit for one specific company/JD).
- The only LLM call wired into the app anywhere today is `companies.py`'s `/parse-jd` endpoint (used by "Add Company" → "Auto-Fill with AI") — unrelated to candidate results.

This task re-enables the disabled paths and gets the output all the way to the UI. Do all four subtasks — enabling generation without displaying it, or displaying a field that's never populated, are both incomplete.

### 9a — Re-enable LLM resume field extraction

**File:** `server/app/services/resume_parser.py`.
1. Add back `from app.services.llm_service import LLMService` at the top (it was removed as an unused import when this was disabled — restoring it is correct now that it's used again).
2. Replace:
   ```python
   # llm_svc = LLMService()
   # llm_data = llm_svc.extract_resume_data(raw_text) or {}
   llm_data = {}
   ```
   with:
   ```python
   llm_svc = LLMService()
   llm_data = llm_svc.extract_resume_data(raw_text) or {}
   ```
3. This runs inside `_do_parse`, which `resumes.py` already executes via `asyncio.to_thread(_do_parse, file_path)` — so it won't block the event loop. It will, however, make each upload slower (an extra local LLM call via Ollama). That's an accepted tradeoff of this task, not a bug — do not try to also parallelize it further unless uploads become unacceptably slow in testing.
4. **Prerequisite you must verify, not assume:** Ollama must actually be installed and running locally with the `llama3.2:1b` model pulled (`ollama pull llama3.2:1b`), since `llm_service.py` hardcodes that model name. If Ollama isn't running, `extract_resume_data` will hit its internal exception handler and return `None`/empty — the code already degrades gracefully (`or {}`), so this won't crash, but confirm at least one real upload during testing that the LLM path is actually executing (check server logs for Ollama-related log lines, or temporarily log `llm_data` before it's used).

### 9b — Re-enable LLM ATS gap analysis and persist it

**File:** `server/app/services/ats_scorer.py`.
1. Add back `from app.services.llm_service import LLMService` at the top.
2. `generate_general_ats_feedback` returns a **string** (a paragraph), not a list — so `gap_analysis` must change type from a list to a string. Replace:
   ```python
   result = {
       "score": int(score),
       "breakdown": breakdown,
       "feedback": feedback,
       "gap_analysis": []  # LLM gap analysis disabled (too slow on CPU)
   }
   ```
   with:
   ```python
   llm_svc = LLMService()
   try:
       gap_analysis = llm_svc.generate_general_ats_feedback(
           raw_text, {"score": int(score), "breakdown": breakdown, "feedback": feedback}
       )
   except Exception:
       logger.exception("Failed to generate LLM gap analysis, falling back to empty.")
       gap_analysis = ""

   result = {
       "score": int(score),
       "breakdown": breakdown,
       "feedback": feedback,
       "gap_analysis": gap_analysis,
   }
   ```
   (`generate_general_ats_feedback` already has its own internal try/except that returns a fallback string on error, so the outer `try/except` here is just an extra safety net — keep both.)

**File:** `server/app/api/endpoints/resumes.py`.
3. In `process_resume_background`, where `ats_result` is unpacked (search for `ats_breakdown = ats_result.get("breakdown", {})`), add a line to also capture the gap analysis:
   ```python
   ats_gap_analysis = ats_result.get("gap_analysis", "")
   ```
   and in the `except Exception:` fallback branch right below it, add `ats_gap_analysis = ""` alongside the existing `ats_score = 0` / `ats_feedback = []` / `ats_breakdown = {}` fallbacks.
4. Add `"ats_gap_analysis": ats_gap_analysis,` to the `mapped_resume` dict (same place `"ats_score"`, `"ats_feedback"`, `"ats_breakdown"` are already added).
5. Add `ats_gap_analysis` to the `select(...)` column list in `get_resumes()` (the `GET /api/resumes/` list endpoint) alongside the other `ats_*` fields already added there.

**New migration:** create `server/migrations/003_add_ats_gap_analysis.sql`:
```sql
alter table resumes add column if not exists ats_gap_analysis text default '';
```
Apply it against the Supabase project the same way the existing migrations were applied (Supabase SQL editor, or direct `psql` if you have the DB connection string), then run `NOTIFY pgrst, 'reload schema';` afterward so PostgREST picks up the new column immediately — skipping this step causes `Could not find the column 'ats_gap_analysis' in the schema cache` errors on the next insert/update even though the column exists in Postgres.

**File:** `server/app/models/resume.py`.
6. Add `ats_gap_analysis: Optional[str] = ""` to `ResumeBase` (same place `ats_score`/`ats_feedback`/`ats_breakdown` were added) — without this, FastAPI's `response_model=ResumeInDB` will silently strip the field from every API response even though it's saved in the database.

### 9c — Display it in the UI

**File:** `client/src/components/ATS/ATSScoreCard.jsx`.
1. Accept a new prop `gapAnalysis` (pass `candidate.ats_gap_analysis` from `CandidateProfile.jsx` alongside the existing `score`/`breakdown`/`feedback` props).
2. Render it as a new section below the existing "Feedback" list, e.g.:
   ```jsx
   {gapAnalysis && (
     <div className="pt-4 border-t border-outline-variant/40 flex flex-col gap-2">
       <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
         <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
         AI Analysis
       </h3>
       <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">{gapAnalysis}</p>
     </div>
   )}
   ```
3. If `gapAnalysis` is empty/undefined (LLM disabled, Ollama not running, or an older resume uploaded before this migration), render nothing for this section — don't show an empty box or a "not available" placeholder here specifically, since the rest of the card already works fine without it and this is a bonus section, not a required one.

### 9d — Optional stretch: per-company LLM match explanation

Not required to close this task, but directly relevant and uses the same LLM plumbing: `llm_service.py`'s `generate_gap_analysis(resume_text, jd_text, match_result)` produces a narrative for one specific company/JD match (as opposed to 9a-9c's whole-resume narrative). This is exactly the previously-deleted `LLMExplanation.jsx` idea from the earlier feature-gaps notes. If you build this, call it from the ranking-table expand row in `CandidateProfile.jsx` (the same place `ScoreBreakdown`/`SkillGapTable` render today) — likely on-demand (a button "Explain this match" that calls a new backend endpoint, e.g. `POST /api/resumes/{id}/rankings/{company_id}/explain`) rather than eagerly for all 100+ companies on every upload, since each call is a real LLM invocation and doing it for every ranking row on every upload would multiply upload time by the number of companies.

**Acceptance criteria for Task 9 (9a-9c, required):** Upload a new resume with Ollama running. On the resulting `/resumes/:id` page, the ATS Score card shows a new "AI Analysis" paragraph below the existing feedback bullets, written in natural language (not a bullet list), and this text is also present when re-fetching the same resume later (confirms it's persisted, not just held in the upload response). Uploading with Ollama stopped/unavailable degrades gracefully — the page still renders fully, just without the AI Analysis section, no crash or 500.

---

## Execution notes

- Do the tasks in order — later tasks assume earlier ones exist (e.g. Task 5's react-query conversion touches the same fetch calls Task 1/2 wire up).
- After each task, actually run the app (`npm start` in `client/`, `uvicorn app.main:app --reload --port 8000` in `server/`) and check the browser console for errors before moving to the next task.
- Don't reintroduce anything from the "already fixed, don't undo" list: hardcoded `127.0.0.1:*` URLs, the in-memory job-status dict (now a Supabase `jobs` table), unsanitized upload filenames, or duplicate upload/result-page components.
