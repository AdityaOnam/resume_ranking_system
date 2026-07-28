# ResumeRanker Client Design System

This document reflects the design tokens actually implemented in
`client/tailwind.config.js` and `client/src/index.css`. Keep it in sync with
those files - this doc previously described an earlier Stitch-generated
palette (blue/slate/Inter) that was never the shipped implementation; treat
the config files as the source of truth if anything here drifts again.

## Colors (single dark theme - no light mode)

| Token | Hex | Usage |
|---|---|---|
| `background` | `#0F1023` | App background |
| `surface` / `surface-container` | `#1A1D3A` | Cards, panels |
| `surface-variant` | `#222543` | Secondary surfaces, chips |
| `surface-container-high` | `#1f2240` | Table headers, elevated rows |
| `surface-container-highest` | `#2a2d52` | Icon badges, skeleton loaders |
| `outline-variant` | `#343753` | Borders |
| `outline` | `#4a4d66` | Muted icons/dividers |
| `primary` | `#6c63ff` | Brand, links, primary actions |
| `secondary` | `#22c55e` | Success/eligible states (named "secondary", used as green) |
| `tertiary` | `#b4a3ff` | Accent, tertiary badges |
| `error` | `#ffb4ab` | Error states |
| `on-surface` | `#f1f3fa` | Primary text |
| `on-surface-variant` | `#a3a6c4` | Muted/secondary text |

Full token list lives in `tailwind.config.js` under `theme.extend.colors` -
prefer those names (`bg-primary`, `text-on-surface-variant`, etc.) over raw
hex or Tailwind's default palette (`slate-*`, `blue-*` do not match this
app's theme).

## Typography

- **Headings:** `font-display` -> Hanken Grotesk
- **Body / mono:** `font-sans` / `font-mono` -> Geist

## Reusable component classes (`client/src/index.css`)

`.card`, `.card-hover`, `.panel` / `.cyber-panel`, `.chip`, `.skill-tag`,
`.nav-link` / `.nav-link-active`, `.btn-primary` / `.btn-ghost`,
`.score-badge-high` / `.score-badge-mid` / `.score-badge-low`.

## Layout shell

`client/src/App.jsx`'s `Shell` renders a full-width `TopBar` always on top.
`Sidebar` only renders on `/ats` and `/leaderboard` routes; `/`, `/upload`,
and `/companies` are top-nav-only pages.

## Vibe & effects

Modern, dark-mode-only, restrained. Subtle borders and quiet shadows/glows -
avoid heavy neon or glassmorphism. Corners use the `borderRadius` scale in
`tailwind.config.js` (`md` 0.5rem, `lg` 1rem, `xl` 1.5rem).
