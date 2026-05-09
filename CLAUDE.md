# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React + Vite web app for visualizing the Hockley family tree. It loads a GEDCOM file exported from Ancestry.com and renders an interactive pedigree viewer. Click any node to navigate to that person's ancestors with animated transitions. Click the root node (center) to open a biography sidebar.

## Commands

```bash
npm run dev        # start dev server at http://localhost:5174
npm run build      # type-check + production build
npm run lint       # ESLint
```

No tests. No backend. The app is entirely client-side.

## Architecture

**Data flow:**
1. `App.tsx` fetches `/hockley-2024.ged` (served as a static asset from `public/`) on mount
2. `src/lib/gedcom.ts` parses the raw GEDCOM text into `{ persons: Person[], details: Map<string, PersonDetail> }` — resolves all FAM records and captures life events, notes, and source citations
3. `FamilyTree.tsx` owns `rootId` and `sidebarId` state; calls `buildPedigree()` on every root change
4. `src/lib/pedigree.ts` computes x/y positions — root row has siblings (left) + root (center) + spouses (right); children row below; ancestors fan upward
5. `FamilyTree.tsx` renders absolutely-positioned `PersonNode` components + SVG connector lines inside a scrollable canvas
6. `PersonSidebar.tsx` slides in from the right when the root node is clicked, showing full biography from `PersonDetail`

**Layout rows (pedigree.ts):**
- `generation -1` — children of root (row below, teal nodes)
- `generation 0` — siblings | root | spouses (same row, indigo nodes)
- `generation 1+` — ancestors fanning upward (violet → purple → fuchsia → pink)

**Key constraints:**
- `buildPedigree()` uses `__empty__` placeholder IDs to keep the binary tree symmetric — nodes render at predictable positions even when a parent is unknown
- `NODE_W = 180`, `NODE_H = 104`, `H_GAP = 24`, `V_GAP = 60` are the layout constants in `pedigree.ts` — changing them affects all spacing
- Framer Motion `layoutId={person.id}` on each node drives the animated transition when root changes
- `AnimatePresence` in `FamilyTree.tsx` handles enter/exit animations for nodes
- Clicking a non-root node navigates to it; clicking the root node opens/closes the sidebar
- All node clicks go through `handleNodeClick` in `FamilyTree.tsx` — `PersonNode` calls `onSelect` unconditionally

**Connector lines (FamilyTree.tsx):**
- Ancestor edges: slate, rounded-elbow routing (straight up → corner → horizontal → corner → straight up)
- Child edges: teal, downward elbow routing (mirror of ancestor)
- Spouse edges: dashed purple, horizontal with decorative S-bend
- Sibling edges: dashed slate, straight horizontal

**GEDCOM parsing notes:**
- Parser does a single-pass line-by-line parse — no external GEDCOM library used
- Now captures life events (RESI, EVEN, CENS, OCCU, etc.), notes (NOTE/CONT/CONC), and source refs (SOUR)
- Returns `details: Map<string, PersonDetail>` alongside `persons: Person[]`
- Dates come in inconsistent formats from Ancestry (`06/Oct/1949`, `2 MAR 1984`, `ABOUT 1820`, etc.) — `parseDate()` strips qualifiers (ABT, CAL, EST, BEF, AFT) with `~` prefix
- `FAMC` = family as child (points to parents), `FAMS` = family as spouse (points to children/partner)
- GEDCOM has ~10,000 OBJE media refs but no embedded image data — Ancestry OIDs only, not usable without API access

## Tech stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed)
- Framer Motion 12 for layout animations
- No state management library — all state lives in `FamilyTree.tsx`
