# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React + Vite web app for visualizing the Hockley family tree. It loads a GEDCOM file exported from Ancestry.com and renders three views of the same data:

- **Tree** (`/`) — interactive pedigree centered on a person, with siblings, spouse, children, and ancestors fanning upward
- **Timeline** (`/timeline`) — vertical timeline of the patrilineal Hockley line plus the biological mother of each chain member, ordered Root → Mother → Father → Father's Mother → Grandfather …
- **Biographies** (`/biographies`) — reverse-chronological reading view of every person who has notes, in 800px-wide cards. Each card has a small tree-icon button that re-roots the tree on that person.

Live: deployed to Vercel. Repo: https://github.com/dan-hockley/hockley-family-tree

## Commands

```bash
npm run dev        # start dev server at http://localhost:5173
npm run build      # type-check + production build
npm run lint       # ESLint
```

No tests. No backend. The app is entirely client-side.

## Routing & state

URL is the source of truth for which person is focal:

- `path` chooses the view: `/`, `/timeline`, `/biographies`
- `?p=<personId>` is the active root. Missing → defaults to Daniel.
- `App.tsx` reads `window.location` on mount and on `popstate`; `navigate()` writes both at once via `pushState`. Browser back/forward and shareable links both work.
- Each view receives `rootId`, `onSetRoot`, `onNavigateRoute`, `onGoHome`, `exportDate` from App.
- Title click → `onGoHome()` clears `?p=` and goes to `/`.

`<ViewNav>` is the shared header nav (Tree / Timeline / Biographies). Each item is a real `<button>` with `aria-current="page"` on the active view. Disabled when active.

`<ErrorBoundary>` wraps the rendered view so a crash in one component shows a recoverable panel with reload, instead of a white screen.

## Data flow

1. `App.tsx` `loadGedcom('/hockley-2024.ged', { signal })` with a 30s AbortController timeout. On failure shows a retry button.
2. `src/lib/gedcom.ts` parses GEDCOM text into `{ persons: Person[], details: Map<string, PersonDetail>, exportDate: string | null }`. The export date is pulled from the `HEAD.DATE` record and shown in each view's footer.
3. Each view builds its own layout from `persons` + `personMap`:
   - `src/lib/pedigree.ts` → `buildPedigree(rootId, ...)` for the tree
   - `src/lib/timeline.ts` → `buildTimeline(rootId, ...)` for the timeline (patrilineal chain + biological mothers, with date estimation for missing birth/death years)
4. Sidebar (`PersonSidebar.tsx`) is shared by Tree and Timeline; renders the full biography from `PersonDetail`.

## Tree view (`FamilyTree.tsx`)

- Layout rows (in `pedigree.ts`):
  - `generation -1` — children of root (row below)
  - `generation 0` — siblings | root | spouses (same row); each tagged with `role: 'root' | 'sibling' | 'spouse'`
  - `generation 1+` — ancestors fanning upward
- Layout constants: `NODE_W = 210`, `NODE_H = 112`, `H_GAP = 24`, `V_GAP = 60`
- `buildPedigree()` uses `__empty__` placeholders to keep the binary tree symmetric
- Framer Motion `layoutId={person.id}` drives the animated transition when root changes
- Click-and-drag panning on the canvas; clicks that didn't drag still navigate. A 4px move threshold separates drag from click. The drag handler swallows the trailing click via a one-shot `window` capture-phase listener so panning never re-roots.
- Initial scroll is **instant** (no smooth animation); subsequent re-roots are smooth.
- `PersonNode` is `tabIndex=0`, role="button", responds to Enter/Space, has a blue focus ring.

## Timeline view (`Timeline.tsx`)

- Scope: patrilineal chain (root → father → father's father …) + the biological mother of each chain member.
- Order left to right is fixed by genealogy, not by date: `[Root, Root's Mother, Father, Father's Mother, Grandfather, Grandfather's Mother, …]`.
- Top of canvas = present, scrolling down = past.
- Each person is a vertical bar spanning birth → death. Living people draw to the current year and show "present" instead of a death year. Estimated dates show with a `~` prefix and a hatched fill.
- Date estimation in `timeline.ts`: missing birth = avg of (parent birth + 28, child birth − 28, spouse birth). Missing death = birth + 75 only if the person would otherwise be older than 110.
- Father bars are blue (`#0047ff`), mother bars are pink (`#ff3399`). All bars have a 7px color stripe at the top matching the text color. Bars are non-interactive — this is a reading view.
- Min bar height is 80px so just-born people still render the name + lifespan readably.
- Year axis sticks to the left edge during horizontal scroll. Each bar's name block sticks within the visible portion of its bar during vertical scroll. Both stick effects are driven by direct DOM `transform` writes inside the canvas scroll handler — no React state, no re-render lag.
- Decade ticks + vertical axis line are black; per-year ticks are grey.
- Click-and-drag panning works on this canvas too (same drag-suppression pattern).

## Biographies view (`Biographies.tsx`)

- Lists every person where `details.get(id).notes.length > 0`, sorted by birth year descending. People with no birth year sink to the bottom.
- Single 800px-wide column, one card per row, top-down scroll.
- Card is non-clickable; each card has a small grey hierarchy-icon button (`TreeIcon` glyph: one square on top, two below, with connectors) that turns blue on hover. Clicking it routes to `/?p=<id>` so the tree opens centered on that person.
- Search dropdown also routes to `/?p=<id>`.
- Card header: blue lifespan + place; given+surname inline at 40px / 700 weight; rule; notes section with `whiteSpace: pre-wrap` so paragraph breaks render.

## GEDCOM parser (`src/lib/gedcom.ts`)

- Single-pass line parser, no external library. Handles this specific Ancestry export's quirks well; replacing it with a library would be a regression.
- Captures life events (BIRT, DEAT, BURI, BAPM, MARR, DIV, EMIG, IMMI, NATU, CENS, RESI, EVEN, OCCU, EDUC, GRAD, MILI, PROB, WILL, ADOP, CHR, CONF, FCOM), notes (NOTE/CONT/CONC), source refs (SOUR), and the `HEAD.DATE` export timestamp.
- `parseDate()` strips qualifiers (ABT, CAL, EST, BEF, AFT) with `~` prefix.
- `decodeEntities()` decodes `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&apos;`, `&nbsp;`, numeric entities, AND strips Ancestry's `[[...]]` wiki-style wrappers around whole notes.
- `isSourceCitationNoise()` drops notes that are just "Person Source" placeholders (alone or repeated). Real biographical notes containing the word "Source:" mid-sentence are kept.
- **CONC vs CONT**: per GEDCOM spec, CONC concatenates with no separator; CONT inserts a newline. Parser respects this. `whiteSpace: pre-wrap` in the sidebar block view renders CONT line breaks.
- **Known data quirk**: some CONC fragments have leading space mid-word (e.g. "a" + " n indoor" → "a n indoor"). Source-data issue, not reliably fixable.
- GEDCOM has ~10,000 OBJE media refs but no embedded image data — not usable without Ancestry API access.

## Updating the family data

Replace `public/hockley-2024.ged` with a fresh GEDCOM export from Ancestry. Keep the same filename — the fetch URL is hardcoded. Vercel cache is `max-age=300, stale-while-revalidate=604800`, so the new file appears within 5 minutes of deploy.

## Loading & error states

- Loading: black "LOADING FAMILY RECORDS" wordmark + sweeping bar, animated via CSS `@keyframes loading-sweep`.
- Fetch timeout: 30s. AbortError → friendly retry message.
- Network/parse failure: explicit error screen with "Try again" button that re-runs `loadGedcom`.
- Render crash: `<ErrorBoundary>` shows the error message + a "Reload app" button.

## Design system

Swiss/grotesque-inspired, black and white with full-saturation primary accents. All sans-serif (Inter, weights 300–800).

**Tree generation colors** (in `PersonNode.tsx`, also in tree footer legend):
- Children: `#00cc44` (green)
- Root: `#ff1a0e` (red, no visible label)
- Parents: `#0047ff` (blue)
- Grandparents: `#8800ff` (purple)
- Great-grandparents: `#00ccff` (cyan)
- Further ancestors: `#ff6600` (orange)

**Timeline colors:**
- Father (root + patrilineal chain): `#0047ff` (blue)
- Mother (biological mothers of chain members): `#ff3399` (pink)

**Card styling (tree nodes):**
- White background, 1px `#d8d8d8` border, no border radius
- Root: black fill (`#0a0a0a`) with white text, 3px black top border
- Drop shadow: `box-shadow: 0 0 30px #cccccc` (was `filter: drop-shadow`, switched because iOS Chrome rendered hard rectangular artifacts inside the panning canvas)
- Hover (non-root): background fills with the generation color, text/border invert to white. Sibling/Spouse cards hover to black.
- `.person-card:active` scales to 0.98 for tap feedback

**Connectors (tree):**
- Ancestor edges (non-patrilineal): light grey `#c8c8c8`, 1px
- Sibling edges: dashed light grey, 1px
- Spouse edges: dashed black, 1px
- Father line (patrilineal chain + child edges below root): dark grey `#666` at 1.5px, rendered last so it sits on top of all other edges

**Header (black bar, 48px desktop / 44px mobile):**
- Title: star + "Hockley Family Tree" — clickable, returns to tree centered on Daniel
- Nav: Tree / Timeline / Biographies, active in white, inactive grey, hover lightens to white
- Search input (190px desktop) or icon-toggle overlay (mobile)

**Sidebar (`PersonSidebar.tsx`):**
- Desktop: 380px, soft drop shadow
- Mobile: full-screen
- Header: black band with star + "Biography" + person name (44px / 800 desktop, 32px mobile)
- Body: ruled `DataRow` list (Born, Died, Notes, Father, Mother, Spouse, Children, Timeline events). `block` variant stacks label above value with 14px / 400 weight body text and `whiteSpace: pre-wrap`.

**Footer (desktop only):**
- Tree: legend (Parents blue, Grandparents purple, Gt. Grandparents cyan, Further orange, Children green) + "Ancestry export · YYYY-MM-DD" if available, otherwise "Click to navigate"
- Timeline: same export-date footer
- Biographies: bio count + export date

## Mobile

- `useViewport()` hook (`src/lib/useViewport.ts`) breaks at 640px
- Uses `100dvh` everywhere for proper iOS chrome handling
- `viewport-fit=cover` and `theme-color` meta tags in `index.html`
- Search collapses to icon → full-width overlay
- Sidebar goes full-screen, larger close button (36×36)
- Footer legend hidden
- `WebkitOverflowScrolling: touch` on canvas and sidebar body
- Touch targets ≥36px

## Deploy

- Vercel auto-deploys on push to `main`
- `vercel.json`: SPA rewrite (`/(.*) → /`) + Cache-Control `max-age=300, stale-while-revalidate=604800` and `Content-Type: text/plain` on `/hockley-2024.ged` (lets Vercel gzip it and skip re-download on repeat visits).
- Browser scroll restoration is disabled in `main.tsx` so route changes don't fight our manual scroll positioning.

## Tech stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin) — used minimally; most styling is inline or in `index.css`
- Framer Motion 12 for layout animations
- No state management library — `useState` in App + the three views is enough
