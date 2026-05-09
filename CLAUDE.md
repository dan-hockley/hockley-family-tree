# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React + Vite web app for visualizing the Hockley family tree. It loads a GEDCOM file exported from Ancestry.com and renders an interactive pedigree viewer. Click any non-root node to navigate to that person; click the root to open a biography sidebar; click the notes pill to open the sidebar without navigating.

Live: deployed to Vercel. Repo: https://github.com/dan-hockley/hockley-family-tree

## Commands

```bash
npm run dev        # start dev server at http://localhost:5174
npm run build      # type-check + production build
npm run lint       # ESLint
```

No tests. No backend. The app is entirely client-side.

## Architecture

**Data flow:**
1. `App.tsx` fetches `/hockley-2024.ged` on mount; shows minimal loading/error screens that match the black/white aesthetic
2. `src/lib/gedcom.ts` parses GEDCOM text into `{ persons: Person[], details: Map<string, PersonDetail> }`
3. `FamilyTree.tsx` owns `rootId`, `sidebarId`, search state, and history; calls `buildPedigree()` on every root change
4. `src/lib/pedigree.ts` computes x/y positions — root row has siblings (left) + root (center) + spouses (right); children row below; ancestors fan upward
5. `FamilyTree.tsx` renders absolutely-positioned `PersonNode` components + SVG connector lines inside a scrollable canvas
6. `PersonSidebar.tsx` slides in from the right when a node is selected, showing full biography from `PersonDetail`

**Layout rows (pedigree.ts):**
- `generation -1` — children of root (row below)
- `generation 0` — siblings | root | spouses (same row); each tagged with `role: 'root' | 'sibling' | 'spouse'`
- `generation 1+` — ancestors fanning upward

**Layout constants (pedigree.ts):**
- `NODE_W = 210`, `NODE_H = 112`, `H_GAP = 24`, `V_GAP = 60`

**Key constraints:**
- `buildPedigree()` uses `__empty__` placeholder IDs to keep the binary tree symmetric
- Framer Motion `layoutId={person.id}` on each node drives the animated transition when root changes
- `AnimatePresence` in `FamilyTree.tsx` handles enter/exit animations
- Clicking a non-root node navigates; clicking the root node toggles the sidebar; clicking the notes pill opens the sidebar without navigating
- After every root change, `useEffect` scrolls the canvas so the root node is centered in the viewport (uses node x/y, not layout center, so wide rows don't push it off-screen)

## Design system (current)

**Aesthetic:** Swiss/grotesque-inspired, black and white with full-saturation primary accents on generation labels only. All sans-serif (Inter, weights 300–800).

**Generation colors** (in `PersonNode.tsx`, also reflected in footer legend):
- Children: `#00cc44` (green)
- Root: `#ff1a0e` (red, but root has no visible label)
- Parents: `#0047ff` (blue)
- Grandparents: `#8800ff` (purple)
- Great-grandparents: `#00ccff` (cyan)
- Further ancestors: `#ff6600` (orange)

**Card styling:**
- White background, 1px `#d8d8d8` border, no border radius
- Root node: black fill (`#0a0a0a`) with white text
- Drop shadow: `filter: drop-shadow(0 0 30px #cccccc)` on every card
- On hover (non-root): background fills with the generation color, every text/border element inverts to white. Sibling/Spouse cards hover to black.
- `.person-card:active` scales to 0.98 for tap feedback

**Card content (top-down):**
1. Top row: 4-pointed star + generation label in tracked uppercase (color = genColor; for siblings/spouses, label is "Sibling"/"Spouse" in grey; for the root, no label is shown). Notes pill aligned right when person has notes.
2. Given name in 22px / 700 weight Inter
3. Surname in 8px / 700 weight Inter, tracked uppercase
4. Thin rule
5. Born/Lifespan label-value row in tiny tracked caps + 9px value
6. Birth place in tiny uppercase right-aligned

**Notes pill** (top-right of card, only when person has Notes section content):
- Three stacked horizontal bars (6×1 each), 1px gap, 1×2px padding, 1px grey border, 2px radius
- On root card: white border + white bars
- Click stops propagation and calls `onOpenNotes` (opens the sidebar without navigating)

**Connector lines (FamilyTree.tsx):**
- Ancestor edges (non-patrilineal): light grey `#c8c8c8`, 1px
- Sibling edges: dashed light grey, 1px
- Spouse edges: dashed black, 1px
- **Father line (patrilineal chain + child edges below root): dark grey `#666` at 1.5px, rendered last so it sits on top of all other edges**
- The patrilineal chain is computed in FamilyTree.tsx by walking `fatherIds[0]` upward from root; stored as a Set of `"childId|parentId"` strings used by `renderEdge`

**Header (black bar, height 48 desktop / 44 mobile):**
- Star + "Hockley Family Tree" (Inter 800, 25px desktop / 17px "Hockley" mobile)
- Search input (190px) on desktop; on mobile it's an icon button that opens a full-width search overlay
- Back button (history-driven) in dark-bordered outline, inverts to white on hover

**Sidebar:**
- Desktop: 380px, soft drop shadow, no thick black left border
- Mobile: full-screen
- Header: black band with star + "Biography" tracked label + person name (44px / 800 desktop, 32px mobile)
- Body: single ruled list of `DataRow` components (label left, value right, 1px bottom border). `block` variant stacks label above value with 14px / 400 weight body text and `whiteSpace: pre-wrap` for multi-line notes
- Order: Born, Died, **Notes**, Father, Mother, Spouse, Children, Timeline events
- Each Note becomes a `DataRow ... block` so long text reads left-aligned and full width

**Footer (desktop only, hidden on mobile):**
- Black bar with star and color-coded generation labels (Parents blue, Grandparents purple, Gt. Grandparents cyan, Further orange, Children green) + "Click to navigate" caption right-aligned

## Mobile

- `useViewport()` hook (`src/lib/useViewport.ts`) breaks at 640px
- Uses `100dvh` everywhere for proper iOS chrome handling
- `viewport-fit=cover` and `theme-color` meta tags in `index.html`
- Search collapses to icon → full-width overlay
- Sidebar goes full-screen, larger close button (36×36)
- Footer legend hidden
- `WebkitOverflowScrolling: touch` on canvas and sidebar body
- Touch targets ≥36px

## GEDCOM parsing notes

- Single-pass line-by-line parser — no external library
- Captures life events (BIRT, DEAT, BURI, BAPM, MARR, DIV, EMIG, IMMI, NATU, CENS, RESI, EVEN, OCCU, EDUC, GRAD, MILI, PROB, WILL, ADOP, CHR, CONF, FCOM), notes (NOTE/CONT/CONC), and source refs (SOUR)
- `parseDate()` strips qualifiers (ABT, CAL, EST, BEF, AFT) with `~` prefix
- `FAMC` = family as child (parents), `FAMS` = family as spouse (children/partner)
- `decodeEntities()` decodes `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&apos;`, `&nbsp;`, and numeric entities — Ancestry NOTE fields commonly contain HTML-encoded characters
- **CONC vs CONT**: per GEDCOM spec, CONC concatenates with no separator; CONT inserts a newline. Parser respects this. `whiteSpace: pre-wrap` in the sidebar block view renders CONT line breaks
- **Known data quirk**: this Ancestry export's CONC fragments sometimes have a leading space inside a word (e.g. "a" + " n indoor" = "a n indoor"). This is a source-data issue and can't be reliably fixed with a heuristic (would break legitimate cases like "and a" + " great"). Documented; not patched.
- Empty `NAME` fields fall back to `"Unknown"` rather than the raw GEDCOM ID
- GEDCOM has ~10,000 OBJE media refs but no embedded image data — not usable without Ancestry API access

## Deploy

- **Vercel** auto-deploys on push to `main`
- `vercel.json` has SPA rewrite rule (`/(.*) → /`) so direct URLs work
- `index.html` preconnects + preloads Google Fonts (Inter)

## Tech stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin) — used minimally; most styling is inline or in `index.css`
- Framer Motion 12 for layout animations
- No state management library — all state lives in `FamilyTree.tsx`
