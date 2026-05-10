import type { Person } from '../types';

export interface TimelineEntry {
  person: Person;
  birthYear: number;
  deathYear: number;
  birthEstimated: boolean;
  deathEstimated: boolean;
  living: boolean; // true = no known death date and not presumed deceased
  lane: number;
  relation: 'self' | 'ancestor' | 'descendant';
  generation: number; // 0 = self, +1 parent, +2 grandparent, -1 child, -2 grandchild, ...
}

export interface TimelineLayout {
  entries: TimelineEntry[];
  laneCount: number;
  minYear: number;
  maxYear: number;
}

const TYPICAL_LIFESPAN = 75;
const PARENT_AGE_AT_BIRTH = 28;

function extractYear(date: string | undefined): number | null {
  if (!date) return null;
  const m = date.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * Walk the patrilineal chain from rootId upward (root, father, father's father, ...).
 * Returns a map of id -> generation (0 = root, 1 = father, 2 = paternal grandfather, ...).
 */
function patrilinealIds(rootId: string, personMap: Map<string, Person>): Map<string, number> {
  const result = new Map<string, number>();
  const seen = new Set<string>();
  let currentId: string | undefined = rootId;
  let gen = 0;
  while (currentId && !seen.has(currentId) && personMap.has(currentId)) {
    seen.add(currentId);
    result.set(currentId, gen);
    const p = personMap.get(currentId);
    currentId = p?.fatherIds[0];
    gen++;
  }
  return result;
}

interface DateGuess {
  birth: number | null;
  death: number | null;
  birthEstimated: boolean;
  deathEstimated: boolean;
}

/**
 * Estimate missing birth/death years from family context.
 *
 * Iterates a few passes so estimates can propagate through chains
 * (e.g. a great-grandfather with no dates can be estimated from a
 * grandfather who was estimated from a parent).
 */
function estimateDates(
  scope: Set<string>,
  personMap: Map<string, Person>,
): Map<string, DateGuess> {
  const guesses = new Map<string, DateGuess>();

  // Seed from known dates
  for (const id of scope) {
    const p = personMap.get(id);
    if (!p) continue;
    const b = extractYear(p.birthDate);
    const d = extractYear(p.deathDate);
    guesses.set(id, {
      birth: b,
      death: d,
      birthEstimated: false,
      deathEstimated: false,
    });
  }

  // Iterate up to 6 passes to let estimates propagate
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const id of scope) {
      const p = personMap.get(id);
      const g = guesses.get(id);
      if (!p || !g) continue;

      // Estimate birth from parents (parent birth + 28)
      if (g.birth == null) {
        const parentBirths: number[] = [];
        for (const pid of [...p.fatherIds, ...p.motherIds]) {
          const pg = guesses.get(pid);
          if (pg?.birth != null) parentBirths.push(pg.birth + PARENT_AGE_AT_BIRTH);
        }
        // Estimate birth from children (child birth - 28)
        const childBirths: number[] = [];
        for (const cid of p.childIds) {
          const cg = guesses.get(cid);
          if (cg?.birth != null) childBirths.push(cg.birth - PARENT_AGE_AT_BIRTH);
        }
        // Estimate birth from spouse
        const spouseBirths: number[] = [];
        for (const sid of p.spouseIds) {
          const sg = guesses.get(sid);
          if (sg?.birth != null) spouseBirths.push(sg.birth);
        }

        const candidates = [...parentBirths, ...childBirths, ...spouseBirths];
        if (candidates.length > 0) {
          g.birth = Math.round(candidates.reduce((a, b) => a + b, 0) / candidates.length);
          g.birthEstimated = true;
          changed = true;
        }
      }

      // Estimate death from birth + lifespan (only if person doesn't appear to be living)
      if (g.death == null && g.birth != null) {
        const currentYear = new Date().getFullYear();
        const ageNow = currentYear - g.birth;
        // If they'd be older than ~110, they must be deceased — estimate death
        // Otherwise leave death as null (treat as still living, draw to present)
        if (ageNow > 110) {
          g.death = g.birth + TYPICAL_LIFESPAN;
          g.deathEstimated = true;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return guesses;
}

export function buildTimeline(
  rootId: string,
  personMap: Map<string, Person>,
): TimelineLayout {
  const root = personMap.get(rootId);
  if (!root) {
    return { entries: [], laneCount: 0, minYear: 0, maxYear: 0 };
  }

  // Scope = patrilineal chain (root, father, father's father, ...) plus
  // the biological mother of each chain member.
  const patrilineal = patrilinealIds(rootId, personMap);
  const motherOf = new Map<string, string>(); // chain member id -> their biological mother id
  for (const lineId of patrilineal.keys()) {
    const p = personMap.get(lineId);
    if (!p) continue;
    const mid = p.motherIds[0];
    if (mid && personMap.has(mid)) motherOf.set(lineId, mid);
  }

  const scope = new Set<string>([...patrilineal.keys(), ...motherOf.values()]);

  const guesses = estimateDates(scope, personMap);

  const currentYear = new Date().getFullYear();
  const raw: Omit<TimelineEntry, 'lane'>[] = [];

  for (const id of scope) {
    const p = personMap.get(id);
    const g = guesses.get(id);
    if (!p || !g) continue;
    if (g.birth == null) continue; // can't place without any birth signal

    const isRoot = id === rootId;
    const onLine = patrilineal.has(id);
    // 'descendant' is reused as the "mother of a chain member" tag here so
    // existing styling code (mother = pink, father = blue) keeps working.
    const relation: TimelineEntry['relation'] =
      isRoot ? 'self' : onLine ? 'ancestor' : 'descendant';
    // For chain members: their own gen. For mothers: borrow son's gen so they
    // sit alongside him.
    let generation = 0;
    if (onLine) {
      generation = patrilineal.get(id) ?? 0;
    } else {
      // find which chain member this mother belongs to
      for (const [lineId, motherId] of motherOf.entries()) {
        if (motherId === id) {
          generation = patrilineal.get(lineId) ?? 0;
          break;
        }
      }
    }

    raw.push({
      person: p,
      birthYear: g.birth,
      deathYear: g.death ?? currentYear,
      birthEstimated: g.birthEstimated,
      deathEstimated: g.death == null ? false : g.deathEstimated,
      living: g.death == null,
      relation,
      generation,
    });
  }

  if (raw.length === 0) {
    return { entries: [], laneCount: 0, minYear: 0, maxYear: 0 };
  }

  // Fixed left-to-right ordering:
  //   Root, Root's Mother, Father, Father's Mother, Grandfather, Grandfather's Mother, ...
  // For each generation 0..max on the patrilineal chain, emit the chain member
  // first, then their biological mother (who is one generation older but sits
  // visually next to her son).
  const byId = new Map(raw.map(r => [r.person.id, r] as const));
  const chainByGen = new Map<number, string>();
  for (const [id, gen] of patrilineal.entries()) chainByGen.set(gen, id);

  const orderedIds: string[] = [];
  const maxGen = Math.max(...[...patrilineal.values()]);
  for (let gen = 0; gen <= maxGen; gen++) {
    const lineId = chainByGen.get(gen);
    if (!lineId) continue;
    if (byId.has(lineId)) orderedIds.push(lineId);
    const motherId = motherOf.get(lineId);
    if (motherId && byId.has(motherId)) orderedIds.push(motherId);
  }

  const entries: TimelineEntry[] = orderedIds
    .map((id, lane) => {
      const r = byId.get(id);
      if (!r) return null;
      return { ...r, lane };
    })
    .filter((e): e is TimelineEntry => e !== null);

  const laneCount = entries.length;
  const minYear = Math.min(...entries.map(e => e.birthYear));
  const maxYear = Math.max(...entries.map(e => e.deathYear));

  return { entries, laneCount, minYear, maxYear };
}
