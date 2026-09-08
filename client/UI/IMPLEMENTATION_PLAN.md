# ResumeRanker Frontend Redesign — Implementation Plan (Nocturne)

**Source design:** `client/UI/tagging_guide_extracted/design_handoff_frontend_redesign/ResumeRanker.dc.html` + its `README.md` (same folder). That HTML is a **design reference only** — an interactive prototype used to lock colors/spacing/interactions. **Do not copy its markup.** Recreate the same visual result inside the real app at `client/` (Create React App + Tailwind + React Router v7 + React Query v5 + Axios + Supabase Auth), reusing its existing components, hooks, and API calls wherever they already do the right thing.

This document is phase-ordered so each phase can be handed off, built, and reviewed independently. Do not start a phase whose dependencies (earlier phases) aren't merged — later phases assume the tokens/icons/chrome from Phase 0–1 already exist.

---

## 0. Decisions already made (do not re-litigate these)

1. **`/ats` is replaced, not merged.** The current `ATSDashboard.jsx` is an admin/cohort-style page (candidates table + funnel/segmentation/matrix analytics). Every one of its underlying API calls is already scoped to `current_user.id` server-side (verified in `server/app/api/endpoints/analytics.py` and `resumes.py`) — so "candidates" in the old page was always really just *this account's own resume upload history*, dressed up as a multi-person cohort view. The new design's single-user framing is actually the more honest fit for the data, not a regression. The old page is retired; see the panel-by-panel audit in Phase 7 for exactly what survives vs. gets deleted.
2. **Leaderboard stays unlinked, code untouched.** `Leaderboard.jsx` and `/leaderboard` keep existing as-is (README's explicit instruction) — just no longer in the nav. Do not restyle or delete it in this pass.
3. **Icons: swap Material Symbols → Phosphor, using `react-icons/pi`.** The design prototype loads Phosphor from a CDN script (`<i class="ph ph-*">`), which only works because it's a static HTML demo. The app already has `react-icons` (`^5.3.0`) as a dependency, which bundles the full Phosphor set under `react-icons/pi` (e.g. `import { PiCloudArrowUp } from 'react-icons/pi'`). **No new dependency needed.** Use that instead of adding `@phosphor-icons/react` or a CDN script. See the icon map at the end of this doc.
4. **Font: Inter, both heading and body**, heading weight capped at 500. Replaces the current Geist (body) / Hanken Grotesk (heading) pairing.
5. **Theme tokens: Nocturne**, replacing the current indigo/violet tailwind palette. Dark is default; a light variant is added via the existing `darkMode: "class"` setup (already enabled, just unused for a second theme today).
6. **Backend is otherwise untouched** except one optional micro-addition noted in Phase 7 (Upload History filenames) — everything else the design needs already exists as a working endpoint.
7. **Auth is JWT-based (Supabase-issued).** The frontend (`client/src/services/api.js`) attaches `Authorization: Bearer <access_token>` from the Supabase session on every request; the backend (`server/app/core/security.py`, `get_current_user`) verifies that Bearer token via `supabase.auth.get_user(token)` and every existing endpoint depends on it (`Depends(get_current_user)`) to scope data to `current_user.id`. Nothing in this plan changes that mechanism — no session/cookie work, no new auth middleware. The one new endpoint this plan calls for (Phase 7.2, point 3) must follow the exact same `Depends(get_current_user)` pattern as every other endpoint in `server/app/api/endpoints/`, even though its query itself needs to read across users (see that section for the scoping nuance that implies).

If anything below turns out to conflict with something you find in the actual code once you're in a file, the actual code wins — flag the discrepancy rather than silently guessing.

---

## Phase 0 — Design tokens, fonts, global CSS foundation

**Goal:** every later phase can just use Tailwind classes / CSS vars and get Nocturne for free.

**Files:**
- `client/tailwind.config.js`
- `client/src/index.css`
- `client/public/index.html`

**Tasks:**
1. In `public/index.html`:
   - Replace the Geist/Hanken Grotesk `<link>` with Inter: `family=Inter:wght@400;500;600`.
   - Remove the Material Symbols font `<link>` (being replaced by `react-icons/pi`).
   - Update `<meta name="theme-color">` to the new Nocturne dark background hex.
2. In `tailwind.config.js`, replace the entire `colors` block with Nocturne tokens. Pull exact values from the design's embedded `<style>` block (`ResumeRanker.dc.html` lines ~18–47) — it defines `--rr-*` custom properties per theme (`.rr` = dark defaults, `.rr[data-t="light"]` = light overrides), sourced from an external Nocturne stylesheet the prototype references but doesn't ship in this bundle. Concretely:
   - Background (dark) `#161826` / Background (light) near-white neutral-100
   - Surface (dark) `#1d1f2c`, surface-2 slightly lower contrast
   - Text (dark) `#e9e9ed` / Text (light) near-black neutral-900
   - Accent (single, mono-scheme) `#9184d9` (dark) / `#79 6cbf`-ish darker variant for light-mode text contrast (see prototype's `--color-accent-600`/`-700` usage) — treat accent as **outline/line/glow only**, never a large flood fill (the one exception is the primary CTA button, which fills solid with `#14121f` text on top).
   - Borders: `#2e3140` (dark) / neutral-200/300 (light)
   - Keep the existing `success`/`error` semantic colors (score badges, tier colors) — the design doesn't redefine them, and several components (score coloring in `CandidateProfile.jsx`, `ATSDashboard.jsx`) depend on that channel independent of the Nocturne restyle.
   - Add these as new token names (e.g. `bg`, `surface`, `surface-2`, `line`, `line-strong`, `text`, `muted`, `accent`, `accent-text`, `tint`, `tint-strong`) rather than overloading the old `primary`/`surface` names in place — a rename-in-place risks silently breaking any component not touched in this pass. Once every phase below is done and verified, do a final cleanup pass removing any now-unused old token names.
   - `borderRadius`: base 8px (`radius-md`), large cards 12–16px (`radius-lg`) — already close to current config (`md: 0.5rem` = 8px ✅, `lg: 1rem` = 16px ✅); just confirm the new component code uses `rounded-lg`/`rounded-md` consistently instead of ad-hoc `rounded-xl`/`rounded-2xl` sizes that don't map to the design's radius scale.
   - `fontFamily.sans` and `fontFamily.display` → both `["Inter", "sans-serif"]` (single font). Cap heading `font-weight` at 500 in component classes (never `font-bold`/700 on headings going forward in touched files).
3. In `index.css`:
   - Update `body` font-family to Inter.
   - Add a light-theme block that overrides the same custom properties (or Tailwind `dark:` variants — pick whichever pattern fits how components will consume it; recommend CSS custom properties on `:root`/`.dark`/`.light`, mirroring the prototype's `.rr[data-t="light"]` approach, so JS-driven inline styles and Tailwind utilities both read the same source of truth).
   - Add global `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` and remove reliance on browser default focus rings, per README.
   - Keep `.card`, `.panel`, `.chip`, `.skill-tag`, `.nav-link`/`.nav-link-active`, `.btn-primary`/`.btn-ghost`, `.score-badge-*` class names (don't rename them — many components reference them) but repoint their `@apply`'d colors at the new tokens.
   - Remove the `.material-symbols-outlined` block (dead once Phase 0–7 finish the icon swap); keep it until the last phase touches the last Material Symbols usage, then delete.
4. Add a theme toggle mechanism: a `<button>` that flips `class="dark"` ↔ `class="light"` on `<html>` (or toggles a `data-theme` attribute) and persists the choice (localStorage). This is currently hardcoded (`<html class="dark">` in `index.html`). Land the toggle *state* here (a small hook, e.g. `client/src/hooks/useTheme.js`) even though the *button UI* itself lives in the TopBar (Phase 1) — keeps the mechanism decoupled from where it's rendered.

**Acceptance:** app still builds and renders (will look broken/half-migrated — that's expected until Phase 1+ update component markup to use the new tokens). No console errors from missing Tailwind classes.

---

## Phase 1 — Shared chrome: TopBar, Sidebar, routing gate

**Files:**
- `client/src/components/common/Header.jsx` (exports `TopBar`, `Sidebar`)
- `client/src/App.jsx`
- `client/src/pages/AuthPage.jsx` (route wiring only in this phase; visual restyle is Phase 3)
- New: `client/src/pages/LandingPage.jsx` (stub for now; built in Phase 2)

**Tasks:**
1. **`App.jsx` — add the logged-out landing gate.**
   Currently `/` and `/upload` both render `<ProtectedRoute><Dashboard/></ProtectedRoute>`, and `ProtectedRoute` presumably redirects unauthenticated users straight to `/login` (check `components/common/ProtectedRoute.jsx` for the exact behavior before changing it). The design wants: `/` shows a **public marketing landing page** when logged out, and redirects to the Dashboard/Upload flow once logged in — i.e. `/` behaves differently depending on auth state instead of just gating.
   - Change the `/` route to something like: render `<LandingPage/>` when `!user`, else `<Dashboard/>` (a small wrapper component or inline check using `useAuth()`).
   - `/upload` keeps working as the authed-only alias it is today (`ProtectedRoute` + `Dashboard`).
   - Confirm `Sidebar` visibility logic (`showSidebar = pathname.startsWith('/ats') || pathname.startsWith('/leaderboard')`) is untouched — README explicitly says keep this even though the design's `/ats` reference mockup doesn't show a sidebar in its own layout. Restyle the `Sidebar` component's tokens (Phase 0 classes) but don't remove it or change when it renders.
2. **`TopBar` (`Header.jsx`) restyle + new features**, matching `ResumeRanker.dc.html` lines 64–135:
   - Nav item set: **Upload / Companies / ATS Dashboard** only — drop `Leaderboard` from the visible `links` array (keep the route in `App.jsx` per decision #2 above; just stop listing it here).
   - Add a **theme toggle button** (uses the `useTheme` hook from Phase 0) next to the profile/notification cluster — pill-shaped, icon + label ("Light"/"Dark"), per the prototype.
   - Notifications bell + dropdown: the existing `TopBar` has a bell icon with a static red dot but **no dropdown panel or data**. Add a small dropdown (mirrors prototype's notification list — icon, text, relative time) backed by static/derived data for now unless a real notifications endpoint already exists (check `server/app/api/endpoints/` — if none exists, this is UI-only scaffolding, not wired to a real backend feed; say so in the PR).
   - Profile dropdown: the current `ProfileModal` in `Header.jsx` is a centered modal overlay; the design wants an **anchored dropdown** below the avatar (top-right corner, ~280px wide) with a gradient header strip, avatar, name/email, a 2-up stat grid (Current ATS / Best match), and sign-out. Reuse the existing data-fetching (`getResumes` + the `latestAts`/`bestAts`/`topMatchName` derivation already in `ProfileModal`) but change the container/positioning from a fixed-center modal to an absolutely-positioned dropdown anchored to `#user-avatar-btn` (that id already exists on the avatar button — reuse it for the anchor + outside-click-to-close logic).
   - Logo: replace the current `R`-in-a-box logo mark with the two-chevron SVG mark from the prototype (inline SVG, `stroke` in accent + muted, no raster asset — copy the `<svg>` from `ResumeRanker.dc.html` line 67).
   - Swap every `material-symbols-outlined` icon in this file for the matching `react-icons/pi` component (see icon map at the end of this doc): cloud-upload → `PiCloudArrowUp`, business → `PiBuildings`, analytics → `PiChartLine`, notifications → `PiBell`, logout → `PiSignOut`, menu/close → `PiList`/`PiX`.
3. **Public/private nav split.** When logged out, `TopBar` shows only the logo + "Sign in" button (no nav links) per the landing page spec — but when logged in on `/companies` or other non-landing routes, the full nav shows. Concretely: hide the `<nav>` links block when `!user`, matching prototype's `hidden="{{ hideLoggedOut }}"` / `hidden="{{ hideLoggedIn }}"` split (lines 70–134).

**Acceptance:** Logged-out visit to `/` shows a stub landing page (full build in Phase 2) with slim top bar (no nav links); logged-in nav shows Upload/Companies/ATS Dashboard with working theme toggle, notification dropdown, and anchored profile dropdown; `/leaderboard` still loads if visited directly.

---

## Phase 2 — Landing page (new)

**Files:** new `client/src/pages/LandingPage.jsx` (+ maybe a `client/src/components/Landing/` folder if you split it into subcomponents — recommended given the complexity below).

This is the single most interaction-heavy screen in the redesign. Build it in this order so you have working checkpoints:

1. **Static layout first** (no animation): hero two-column grid (`1.05fr 1fr`), H1/paragraph/CTA/stat row on the left, a *static* (non-tilting, single-card) preview on the right, 3 feature cards below, closing CTA band. Get spacing/type/colors right against the prototype (`ResumeRanker.dc.html` lines 137–239) before adding motion.
2. **Stat counters**: count up from 0 on mount only (not on re-render), ~1.2s cubic-out ease. Reference implementation: `componentDidMount`/`landingVals()` in the prototype's script (lines 1053–1060, 1106–1130) — `ei = ease(min(1, intro))`, `Math.round(1284 * ei)` etc. Port this as a `useEffect` + `requestAnimationFrame` loop in a function component (a custom hook like `useCountUp(target, durationMs)` is a clean shape, since you need it for 3 stats).
3. **Ticker line**: rotates every 3s through a list of status strings, alternating two keyframe animations (`rr-tick`/`rr-tick2`, prototype lines 52–54) so consecutive messages don't animate identically — a `setInterval` bumping an index + alternating a CSS class/animation-name.
4. **3D card stack + mouse tilt** (the hard part): a `perspective: 1500px` stage with 4 absolutely-positioned "match" cards in a depth stack (front full-opacity, back cards smaller/faded/offset), a row of company chip buttons that switch the front card, and continuous mouse-tracked tilt.
   - Tilt: on `mousemove` over the stage, compute normalized cursor position (0–1) and store as a *target*; run a `requestAnimationFrame` loop that lerps the *current* rotation toward that target at a fixed ~0.09 factor per frame (prototype lines 1025–1051 — `onStage`/`offStage`/`runTiltLoop`), stopping the rAF loop once the delta is negligible. This must **not** be a CSS `transition` — it needs to track pointer speed smoothly regardless of how fast the mouse moves, which only an rAF lerp gives you. On `mouseleave`, lerp back to centered (target = 0.5, 0.5).
   - Card switch: clicking a non-front card or its chip promotes it to front; the score ring value and the 3 metric bars animate from the *previous* card's values to the new card's values over ~600ms ease (prototype's `pickLand`/`landingVals`, lines 1064–1112 — note the `ease-out-cubic` `1 - (1-t)^3` easing function reused for both the intro counters and this transition).
   - Depth/perspective offsets, front-card shadow + glass highlight gradient, and the ambient background glow behind the stack are all styling details already spelled out in the README (no blur filters — keep it cheap to render).
5. **Feature card hover tilt**: `perspective(800px) rotateX(5deg) translateY(-6px)` + border/shadow lift on `:hover` — this one *can* be a plain CSS `transition` (it's a fixed on/off state, not continuous tracking), unlike the hero stack.
6. Wire the "Sign in to get started" / "Sign in" CTAs to `navigate('/login')`.

**Suggested state shape** (mirrors README's "State needed" section): selected card index, previous index + transition progress, mount-intro progress, ticker index, smoothed pointer x/y + raw target x/y. A single `useState` object or a few `useRef`s for the non-rendering rAF-only values (raw target x/y don't need to trigger re-renders themselves) both work — pick whichever is easier to keep readable.

**Acceptance:** Loads at `/` only when logged out; tilt feels smooth at any mouse speed (not stepped/jittery); switching cards animates the ring/bars; counters only animate once on first mount; no layout shift/CLS from the animations.

---

## Phase 3 — Auth page restyle

**Files:** `client/src/pages/AuthPage.jsx`

This page's *logic* is already fully correct and shouldn't change — magic-link email step, "sent" confirmation step, Google OAuth button, all wired through `useAuth()` (`sendMagicLink`, `signInWithGoogle`) in `client/src/contexts/AuthContext.jsx`. This phase is **visual only**:

- Swap the `framer-motion` fade/slide-up entrance for the design's plainer static card if the prototype doesn't show an entrance animation for this screen (it doesn't — keep it simple, or keep the existing subtle fade-in, either is fine, just don't add new motion).
- Match card chrome: bordered surface, `radius-lg`, shadow, centered, ~420px max-width (`ResumeRanker.dc.html` lines 241–271).
- Icon swap: `mail`/`mark_email_read`/`progress_activity` (Material Symbols) → `PiEnvelopeSimple`/`PiEnvelopeOpen`/spinner (react-icons has `PiSpinnerGap` or similar — or keep a simple CSS spin animation on any icon).
- Keep the existing Google "G" SVG logo markup as-is (already matches the prototype's SVG almost exactly — both are the standard 4-color Google mark).

**Acceptance:** Visually matches the auth card in the design at both the email-entry and link-sent steps; magic link + Google sign-in both still function (manually test both paths — Google will redirect away, so at minimum confirm no console errors before redirect).

---

## Phase 4 — Upload / Dashboard restyle

**Files:** `client/src/components/Dashboard/Dashboard.jsx`, `FeaturesSection.jsx`, `PopularCompanies.jsx`

The existing `Dashboard.jsx` already has essentially the right *behavior* — drag/drop or click-to-browse dropzone, `handleFile` → `uploadResume` → poll `getUploadStatus` → step through pending/active/done states → navigate to `/resumes/:id` on completion. Don't touch that logic. This phase is restyling the same states into the design's two-column layout + "Pipeline" card:

1. Left column: eyebrow label, H1 (max ~15ch), supporting paragraph, dropzone with the format/size/privacy hint row (`ResumeRanker.dc.html` lines 275–299) — the current dropzone already shows format hints, just restyle to match (icons via `react-icons/pi`: `PiFilePdf`, `PiHardDrives`, `PiLockSimple`).
2. Right column: rename the visual concept from "Status Stepper" to the design's "Pipeline" card chrome — header with a live label, 4 steps (Upload → Parse → Embed → Rank) each with a dot/rail/icon + progress bar fill, a footer with a "View ranking" CTA (only visible once done) and a manual "Reset" action. The current `uploadStep` state (0–4) + `getStepStatus()` already map cleanly onto pending/active/done per step — this is a markup/class change, not a state-machine change. Add the missing "Reset" button (`setUploadStep(0)`, `setUploadedFile(null)`, `setUploadStatus('idle')`) and "View ranking" button (navigate to the resume result — likely already happens automatically via the existing post-completion `navigate()` call, so this button may just be a redundant manual trigger for the same URL once `uploadStatus === 'done'`).
3. Stats row (Resumes analysed / Companies indexed / Active rankings) — already exists as `StatCard`s pulling from `getResumes`/`getCompanies`; just restyle to the design's 3-column bordered-strip layout (lines 329–345).
4. "How it works" 3-card section and "Popular companies" grid — cross-check against the existing `FeaturesSection.jsx` and `PopularCompanies.jsx`; these likely already cover this content and just need token/class updates, not new components. Read both files before deciding whether to restyle in place or rebuild — don't duplicate functionality that already exists.

**Acceptance:** Upload flow behaves identically to today (same states, same navigation), restyled to match the Pipeline-card design; Reset and View Ranking controls both work.

---

## Phase 5 — Resume Result page restyle

**Files:** `client/src/pages/CandidateProfile.jsx`, `client/src/pages/ResumeResultPage.jsx`, `client/src/components/ATS/ATSScoreCard.jsx`, `client/src/components/CompanyMatch/ScoreBreakdown.jsx`, `client/src/components/CompanyMatch/SkillGapTable.jsx`

Good news: this is the design's "Result" screen (`ResumeRanker.dc.html` lines 400–594 — score header, category bars, "what to fix first", skills chips, Experience/Education/Projects tabs, expandable match-ranking table) and it maps almost 1:1 onto the **already-built** `CandidateProfile.jsx` (score card, tabs, skills, ranking rows with expandable breakdown — same shape, same data). This phase is a restyle + a couple of small structural nudges, not a rebuild:

- Header row: back button, name, email/filename/"analysed X ago" meta line, "Vector stored" badge, export/delete actions — check `CandidateProfile.jsx`'s current header against lines 402–419 and adjust spacing/tokens.
- Score card: big number + `/100 ATS`, category bars, "what to fix first" numbered feedback list — likely already exists via `ATSScoreCard`/`ScoreBreakdown`; confirm and restyle rather than re-deriving.
- Right column stat card (skills extracted count / eligible companies count / best match mini-card) + AI analysis panel.
- Skills chips row, Experience/Education/Projects tabbed panel.
- Match ranking table with expandable per-row breakdown (`SkillGapTable.jsx` likely already does this) — restyle the row/expand chevron interaction to match lines 551–592, keep the click-to-expand behavior.
- Icon swap throughout (`mail`→`PiEnvelopeSimple`, `description`/`file-pdf`→`PiFilePdf`, `history`→`PiClockCounterClockwise`, `check_circle`→`PiCheckCircle`, `download`→`PiDownloadSimple`, `delete`→`PiTrash`, `chevron_right`/caret→`PiCaretDown`, etc).
- The delete-resume flow (`useMutation` + `window.confirm`) already exists in `CandidateProfile.jsx` — don't touch it, just restyle the trigger button.

**Acceptance:** `/resumes/:id` (and the identical slide-out panel usage from the old ATS dashboard, if any survives — check Phase 7 for whether `CandidateProfile` is still rendered as a slide-out anywhere after that page is rebuilt) visually matches the design's Result screen; delete/export controls still function.

---

## Phase 6 — Companies page restyle

**Files:** `client/src/components/Company/CompaniesShowcase.jsx`, `AddCompanyModal.jsx`, `logoMap.json` (untouched — reuse as-is)

README explicitly says: **structure unchanged, restyle to Nocturne tokens.** Confirmed by reading `CompaniesShowcase.jsx` — it already does company-logo resolution via `logoMap.json`, skill chips, GPA display, campus-visit badge. Design reference is `ResumeRanker.dc.html` lines 596–677 (filter bar: search + branch/DSA/min-GPA selects + clear button, result-count line, 3-col company card grid, empty state, pager) and lines 851–883 (Add company/JD modal).

- Restyle the filter bar, cards, empty state, and pager to match tokens/spacing.
- `AddCompanyModal.jsx`: restyle to match the design's dialog chrome (header, 2-col form grid, JD textarea, DSA checkbox, footer actions) — confirm its current fields already match the design's (name, role, min GPA, JD text, DSA checkbox) before adding/removing any.
- Icon swap: `search`→`PiMagnifyingGlass`, `add`/`plus`→`PiPlus`, `verified`→`PiSealCheck`, pagination chevrons→`PiCaretLeft`/`PiCaretRight`.

**Acceptance:** Filtering, pagination, and the add-company dialog all behave exactly as today, restyled to Nocturne.

---

## Phase 7 — ATS Dashboard rebuild (candidate-centric)

**Files:** `client/src/pages/ATSDashboard.jsx` (rewritten), `client/src/components/Dashboard/AnalyticsPanels.jsx` (pruned — see audit below), `client/src/services/analyticsApi.js` (unchanged — all needed endpoints already exist), optionally `server/app/api/endpoints/analytics.py` + `resumes.py` + `server/migrations/` (one small optional addition, see step 4).

### 7.1 — Panel-by-panel audit (what survives from the old page)

Every component in `AnalyticsPanels.jsx` was already scoped to the current user's own resumes server-side — so "cohort" framing was cosmetic even before this redesign. Per your instruction to drop what's redundant or low-value and keep what isn't:

| Component | Backed by | Verdict | Why |
|---|---|---|---|
| `PlacementReadiness` | client-side calc on `candidates` prop | **Delete** | Cohort readiness index over what's really one person's own resumes; superseded by the new page's KPI row. |
| `HiringFunnel` | client-side calc | **Delete** | Funnel framing (Uploaded→Parsed→...) doesn't mean anything over 1–2 of your own resume versions. |
| `TopSkills` | client-side calc | **Delete** | Redundant with the Result page's own "Extracted skills" chips; not in the new design. |
| `CandidateSegmentation` | client-side calc | **Delete** | A tier donut over your own resume(s) is degenerate for a single person. |
| `CompanySuccessMatrix` | client-side calc | **Delete** | Redundant with the new "All companies" eligibility table + the Companies page itself. |
| `CompanyEligibilityDist` | client-side calc | **Delete** | Same issue as segmentation — a distribution over one person's uploads. |
| `ResumeQualityBreakdown` | client-side calc | **Delete** | Superseded by the new design's "Category vs. top-decile resumes" benchmark chart, which is a real per-user comparison instead of a cohort fail-rate. |
| `DepartmentComparison` | `GET /analytics/department-comparison` | **Delete** | Only ever renders when a user's own uploads span >1 branch — practically dead, and not in the design. |
| `MissingSkills` | `GET /analytics/missing-skills` | **Keep — merge** | Maps directly onto the design's "Skills that unlock companies" section (missing-skill bars + "required by N cos"). Reuse the API call as-is, restyle the UI. |
| `AiInsights` | `GET /analytics/insights` | **Keep — merge** | Exact match for the design's "AI insights on your latest version" panel. Reuse as-is, restyle. |
| `AtsTrendChart` | `GET /analytics/ats-history` | **Keep — merge, reshape** | This *is* the data for the design's "Your score across versions" SVG chart (line + target-bar dashed reference + area fill). Currently rendered as a simple bar/point chart grouped by week — needs to become the SVG polyline/polygon treatment from `ResumeRanker.dc.html` lines 710–731, but the underlying weekly-grouping logic can be reused almost as-is. |
| `VersionComparison` | `GET /analytics/version-comparison` | **Delete** | Redundant with the new design's "Upload history" list (simpler: label/date/file/score) and the trend chart already covers progression — the "by-email, multi-candidate" framing here doesn't fit the single-user page either. |
| `CompanyDemand` | `GET /analytics/company-demand` | **Keep, as a bonus panel** | Genuinely useful, non-redundant (skills the *market* wants, distinct from *your* missing skills) and not duplicated by anything else on the page. Not in the design mockup, so place it clearly as an additional panel below the designed sections rather than shoehorning it into the mockup's layout. |

After this prune, delete the now-dead client-side-only exports (`PlacementReadiness`, `HiringFunnel`, `TopSkills`, `CandidateSegmentation`, `CompanySuccessMatrix`, `CompanyEligibilityDist`, `ResumeQualityBreakdown`) and the now-dead backend caller for `DepartmentComparison`/`VersionComparison` (leave `getDepartmentComparison`/`getVersionComparison` exports in `analyticsApi.js` alone unless you're sure nothing else calls them — grep first).

### 7.2 — New page structure (`ATSDashboard.jsx` rewrite)

Per `ResumeRanker.dc.html` lines 679–847:
1. Header: "Your ATS dashboard" + subtitle (name · filename · scope note), a version switcher (v1/v2/v3/Latest pill group) and an "Export report" button.
2. 5-up KPI strip (background-line-grid bordered cells) — labels/values/deltas/sub-copy; source from whatever combination of `getResumes()` (current/best ATS, eligible-company count) and `getAtsHistory()` (delta vs. previous version) is available.
3. Two-column: "Your score across versions" (SVG trend, from `AtsTrendChart`'s data) + "Category vs. top-decile resumes" (benchmark chart — this is **new**, no existing component computes "top-decile" cross-user comparison; you'll need a small new aggregate, either client-side over `getResumes()` if that endpoint happens to already return other users' data — it doesn't, it's user-scoped — **so this needs a new backend endpoint** returning, per ATS category, the current user's score and the top-decile threshold across all resumes system-wide. Like every other endpoint, it still sits behind `Depends(get_current_user)` (JWT auth per decision #7) — the caller must be authenticated — it's only the *query* that reads across all users' `ats_breakdown` rows to compute the percentile, not the *access control*, which stays per-request-user as normal. This is the one place in this phase where new backend work beyond the optional filename addition is required; flag it back for confirmation before building if that scope surprises you, since everywhere else in this plan the backend was already sufficient).
4. "All companies" table with All/Eligible/Blocked filter tabs, per-row match bar + status + blocker text — derive from the current resume's `rankings` (same data `CandidateProfile.jsx` already parses via `parseJson(candidate.rankings)`).
5. Two-column: "Skills that unlock companies" (= restyled `MissingSkills`) + "Fix these next" (numbered action list with projected ATS gain — likely derivable from `ats_breakdown` gaps, similar spirit to the existing feedback list on the Result page; reuse that logic rather than re-deriving from scratch if it already exists there).
6. Two-column: "Upload history" (list: label, date, filename, score) + "AI insights" (restyled `AiInsights`).
7. Bonus: append the kept `CompanyDemand` panel below section 6, clearly separated (e.g. its own bordered section with a small "Market signal" label) since it isn't part of the original mockup.

### 7.3 — Optional backend micro-task: real filenames in Upload History

`ats_history` (see `server/migrations/004_create_ats_history.sql`) stores `user_id, resume_id, name, email, ats_score, created_at` — no original filename, and neither does `resumes` (only a generated `uploads/<uuid>.ext` `file_path`, per `process_resume_background` in `resumes.py`). The design's Upload History rows show a real filename (`Aditya_Resume_v2.pdf`). Two options, pick whichever is less friction:
- **(a) Ship without it**: synthesize "v1", "v2", "v3", "Latest" labels + date only, skip the filename column/shorten the row. Zero backend changes.
- **(b) Add it properly**: add an `original_filename` column to `resumes` (set from `original_filename` already available in `upload_resume()`, `resumes.py` line ~310) and mirror it onto the `ats_history` insert (`resumes.py` line ~280) + the `get_ats_history`/`get_resume_by_id` selects (`analytics.py` line ~205). Small, additive, no migration risk since it's a nullable new column.

Recommend (b) since it's genuinely small, but (a) is a legitimate scope-cut if time-boxed.

**Acceptance:** `/ats` shows only the current user's own data, in the new single-column narrative (trend → benchmark → companies → gaps → history → insights), nothing references "candidates" as a plural cohort anymore; old admin-analytics panels are gone from the bundle (check the build doesn't still import them anywhere).

---

## Phase 8 — Light theme pass

Once all pages are rebuilt against the Nocturne dark tokens (Phases 1–7), do one dedicated pass clicking the Phase-0 theme toggle on every page and fixing any contrast issues, since a component built and eyeballed only in dark mode will have real gaps in light mode (inline hex fallbacks, hardcoded `rgba(255,255,255,...)` overlays that assume a dark backdrop, etc. — grep for raw hex/`rgba(` in touched files as a first pass instead of only visual spot-checking).

---

## Phase 9 — Final QA pass

1. Full click-through: logged-out landing → sign in (magic link, and Google if you have test creds) → upload a resume end-to-end → result page → companies filters/pagination → ATS dashboard version switcher → sign out.
2. Both themes, both via the toggle and via a hard page reload (confirm the choice persists — Phase 0's localStorage piece).
3. Confirm no leftover `material-symbols-outlined` classes or Material Symbols font link remain anywhere (`grep -r material-symbols client/src`).
4. Confirm no dead imports from the deleted `AnalyticsPanels.jsx` exports (build will fail loudly if so — but double check nothing silently no-ops).
5. Confirm `/leaderboard` still loads directly (unlinked, not broken).
6. Run whatever test suite exists (`npm test` in `client/`) and fix any snapshot/assertions broken by the restyle.

---

## Icon reference (Material Symbols name → `react-icons/pi` component)

Non-exhaustive starting map covering everything in the design's `ph ph-*` usage. Verify each against the installed `react-icons` version's actual export list before relying on it — Phosphor's naming in `react-icons/pi` doesn't always match the raw Phosphor class 1:1, and some icons may only exist with a weight suffix (e.g. `PiTrophyDuotone`); default/regular weight has no suffix.

| Design (`ph-*`) | Likely `react-icons/pi` export |
|---|---|
| cloud-arrow-up | `PiCloudArrowUp` |
| buildings | `PiBuildings` |
| chart-line | `PiChartLine` |
| bell | `PiBell` |
| sign-out | `PiSignOut` |
| arrow-right / arrow-left | `PiArrowRight` / `PiArrowLeft` |
| file-magnifying-glass | `PiFileMagnifyingGlass` |
| sparkle | `PiSparkle` |
| envelope-open / envelope-simple | `PiEnvelopeOpen` / `PiEnvelopeSimple` |
| file-arrow-up / upload-simple | `PiFileArrowUp` / `PiUploadSimple` |
| file-pdf | `PiFilePdf` |
| hard-drives | `PiHardDrives` |
| lock-simple | `PiLockSimple` |
| arrow-counter-clockwise | `PiArrowCounterClockwise` |
| graph | `PiGraph` |
| ranking | `PiRanking` (fallback: `PiTrophy` or `PiListNumbers` if not present) |
| clock-counter-clockwise | `PiClockCounterClockwise` |
| check-circle / check | `PiCheckCircle` / `PiCheck` |
| download-simple / export | `PiDownloadSimple` / `PiExport` |
| trash | `PiTrash` |
| caret-down / caret-left / caret-right | `PiCaretDown` / `PiCaretLeft` / `PiCaretRight` |
| plus | `PiPlus` |
| magnifying-glass | `PiMagnifyingGlass` |
| x | `PiX` |
| minus | `PiMinus` |
| trophy | `PiTrophy` |
| file-text | `PiFileText` |
| seal-check | `PiSealCheck` |
| trend-up | `PiTrendUp` |
| warning-circle | `PiWarningCircle` |
| sun / moon | `PiSun` / `PiMoon` |
| query (search-like) | `PiMagnifyingGlass` (Phosphor's literal "Query" glyph may not exist in `react-icons/pi` — use this as a semantic substitute) |

---

## Handoff notes for whoever implements this (e.g. via Antigravity)

- Work phase by phase, in order — each phase lists an acceptance check; don't move on until it passes.
- Every phase above names the exact files to touch. If a phase's description implies a file that doesn't exist yet, that's called out explicitly (e.g. `LandingPage.jsx`, `useTheme.js`) — everything else is an edit to an existing file, not a new one.
- Where this plan says "restyle, don't rebuild," resist the urge to rewrite working logic — the fastest path to a broken app in this kind of pass is treating a visual reskin as a rewrite.
- Flag back anything in Phase 7.2 point 3 (the top-decile benchmark, the one spot needing genuinely new backend work) before spending time on it, since it's the one item in this whole plan that isn't just "restyle existing behavior."
