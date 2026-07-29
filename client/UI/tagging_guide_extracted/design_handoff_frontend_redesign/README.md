# Handoff: ResumeRanker Frontend Redesign (Nocturne)

## Overview
Full visual redesign of the Resume Ranking System frontend on the **Nocturne** design system — dark (default) and light themes. Covers: Landing page (new), Auth (magic link + Google), Upload/Dashboard flow, Companies screen, ATS Dashboard (candidate-centric), and shared nav/profile chrome.

## About the design files
`ResumeRanker.dc.html` in this folder is an **HTML/React design reference**, not production code — a single-file prototype used to explore and lock the visual design and interactions. Do not copy its markup verbatim into the app. The task is to **recreate this design inside the existing codebase** (`Resume-Ranking-System/client`, Create React App + Tailwind + React Router + React Query), matching its existing component structure, routing, and data-fetching patterns.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, and interaction states in the prototype are final — implement pixel-close using the codebase's existing Tailwind setup (extended with the token changes below), not ad-hoc values.

## Critical: theme token migration
The current `tailwind.config.js` hardcodes an indigo/violet Material-style palette (`primary: #6c63ff`, `background: #0F1023`, `surface: #1A1D3A`, etc.). The new design is **Nocturne**: a near-neutral blue-grey ground with a single blurple accent, not the current saturated indigo. Replace the `colors` block with the Nocturne ramps (see `_ds/nocturne-.../styles.css` in the design project, or the token list below) and add a light-mode variant via `darkMode: "class"` (already enabled) — apply `.light`/`.dark` on `<html>` and swap CSS custom properties, same approach as the `data-t="dark"|"light"` attribute in the prototype.

### Core tokens
- Background (dark): `#161826` · Background (light): near-white neutral-100
- Text (dark): `#e9e9ed` · Text (light): near-black neutral-900
- Accent (single, mono-scheme): `#9184d9` — use as outline/line/glow, never as a flood fill
- Surface (dark): `#1d1f2c` · borders: `#2e3140` (dark) / neutral-200/300 (light)
- Font: Inter for both heading and body, heading capped at weight 500 (never bolder)
- Radius: 8px base (`--radius-md`); large cards 12–16px
- Buttons: **outlined**, not solid-filled, except the primary CTA which uses accent fill with dark text (`#14121f`) per the prototype's hero/CTA buttons
- Focus: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` everywhere — no browser default ring

Pull exact hex/OKLCH ramp values from the Nocturne stylesheet rather than re-deriving them.

## Screens

### 1. Landing page (new — `/` when logged out)
Currently `/` routes straight to `Dashboard`. Add a public landing route shown when unauthenticated; redirect to Dashboard/Upload once logged in (mirrors the prototype's `loggedIn` gate).

- **Slim brand row**: logo mark (two chevrons) + "ResumeRanker" wordmark, 3D-tilted logo (`perspective` + `rotateX/rotateY` on the SVG), "Sign in" outline button, right-aligned. No horizontal nav until logged in.
- **Hero**: two-column grid (~1.05fr / 1fr). Left: eyebrow label with a short accent rule, H1 (52px, -0.03em tracking, max 14ch), supporting paragraph (max 46ch, muted), primary CTA ("Sign in to get started" → accent-filled button with arrow icon), a stat row (resumes scored / companies indexed / median turnaround — **count up from 0 on mount**, ~1.2s ease-out), and a live activity ticker line (rotating status strings, animated fade in/up/out every ~3s, small pulsing accent dot).
- **Right hero panel — interactive 3D card stack**: a `perspective: 1500px` stage containing 4 absolutely-positioned "match" cards (company, role, score ring, 3 scored sub-metrics with bars, one-line note) arranged in a depth stack (front card full opacity/scale, back cards progressively smaller/more transparent/offset down-right). A row of company-name chip buttons above the stack switches the front card (each pick re-orders the stack and re-animates the ring/bars in). **Mouse-move tilt**: track cursor position over the stage and continuously rotateX/rotateY the whole stack toward it via a `requestAnimationFrame` lerp (~0.09 factor per frame) — not a CSS `transition`, so it stays smooth regardless of pointer speed; on mouse-leave, lerp back to centered. Front card gets a layered shadow + subtle top-left glass highlight gradient; a soft accent radial-gradient glow sits behind the stack (no blur filters — keep it cheap to render).
- **3 feature cards** below the hero (upload-once, ATS scoring, gap feedback), each with a 3D hover tilt (`translateY` + slight `rotateX` via `perspective(800px)`) and border/shadow lift on hover.
- **Closing CTA band**: tinted full-width strip, heading + "Sign in to get started" button.

### 2. Auth (`/login`, `/signup`)
Centered card, magic-link email step and a "sent" confirmation step, Google OAuth button below an "OR" divider. Same card chrome (surface, border, shadow) as elsewhere.

### 3. Upload / Dashboard (`/`, `/upload` when logged in)
Two-column: left is the upload copy + dropzone (click or drag-drop, keyboard-activatable) with format/size/privacy hints; right is a "Pipeline" card showing 4 sequential steps (Upload → Parse → Embed → Rank) that animate through pending → active (pulsing dot) → done (check icon, progress bar fill) automatically once a file is dropped, with a "View ranking" CTA on completion and a manual reset.

### 4. Companies (`/companies`)
Filterable company directory (search, branch, DSA, min-CPI filters) with a JD detail dialog per company. (Structure unchanged from existing `CompaniesShowcase`; restyle to Nocturne tokens.)

### 5. ATS Dashboard (`/ats`) — candidate-centric
Per-candidate view (not company-leaderboard): score trend vs. version history, category breakdown vs. benchmark, all-companies eligibility table with fix-it reasons, upload history, and an AI-insights panel. **Leaderboard page/route should be removed** from nav once this ships (kept in code for now per existing route, but no longer linked from primary nav).

### 6. Shared chrome
Top bar: logo + wordmark, nav (Upload / Companies / ATS Dashboard) with active-state underline, notifications bell, profile avatar → dropdown (name/email, current ATS + best-match stat tiles, sign-out). Sidebar shown only on `/ats` (and legacy `/leaderboard`) per current `App.jsx` logic — fine to keep.

## Interactions & behavior details
- Card-stack pick: click any non-front card or its chip → promotes it to front; ring sweep and bar widths animate from the previous card's values to the new one's over ~600ms ease.
- Ticker rotates every 3s, alternating two keyframe variants (`rr-tick` / `rr-tick2`) so consecutive messages don't animate identically.
- Stat counters ease with a cubic-out curve over ~1.2s on mount only (not on re-render).
- All hover/press states are theme-token driven — no hardcoded blues; keyboard focus always shows the accent ring.

## State needed
- `loggedIn`, `screen`/route (landing/auth/upload/result/companies/ats)
- Upload pipeline step (0–4) + filename + drag state
- Landing hero: selected card index, previous index + transition progress (for the score/bar tween), mount-intro progress (for counters), ticker index, smoothed pointer x/y + raw target x/y (for the rAF tilt)
- Companies: search/branch/DSA/min-CPI filters + pagination
- ATS: selected resume version, active tab

## Design tokens reference
See the Nocturne stylesheet for exact values (`--color-*`, `--font-*`, `--space-*`, `--radius-*`, `--shadow-*`). Do not hand-roll new colors; derive any missing shade from the existing OKLCH ramps.

## Assets
- Logo: two-chevron mark (inline SVG in the prototype, `stroke` in accent + muted colors — no raster asset needed)
- Company logos: existing PNGs already in the codebase's asset set (`Nvidia.png`, `Google.png`, etc.) — reuse as-is
- Icons: Phosphor Icons (`ph ph-*` classes), loaded via the `@phosphor-icons/web` package/CDN as in the prototype

## Files in this bundle
- `ResumeRanker.dc.html` — the full design reference (all screens, both themes, all interaction logic)
- This `README.md`

## Reference: existing codebase structure (for the implementer)
- `client/src/App.jsx` — routes/shell; add the landing route + logged-out gate here
- `client/src/pages/AuthPage.jsx`, `ATSDashboard.jsx`, `ResumeResultPage.jsx`, `Leaderboard.jsx`
- `client/src/components/Dashboard/`, `components/Company/`, `components/common/Header.jsx` (TopBar/Sidebar), `components/ui/`
- `client/tailwind.config.js` — swap the `colors` block for Nocturne tokens; keep `darkMode: "class"`
- `client/src/index.css` — global resets / font loading
