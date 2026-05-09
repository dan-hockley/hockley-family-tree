import type { Person, TreeNode } from '../types';

export interface PedigreeEdge {
  childId: string;
  parentId: string;
  type: 'ancestor' | 'child' | 'spouse' | 'sibling';
}

export interface PedigreeLayout {
  nodes: TreeNode[];
  edges: PedigreeEdge[];
  width: number;
  height: number;
}

export const NODE_W = 210;
export const NODE_H = 112;
export const H_GAP = 24;
export const V_GAP = 60;

/**
 * Build a pedigree layout for the given root person.
 *
 * Layout rows (y increases downward):
 *   row -1  children of root (below)
 *   row  0  siblings | root | spouse
 *   row  1  parents
 *   row  2  grandparents
 *   ...up to maxGenerations above root
 *
 * The canvas origin is top-left. Row 0 is offset down by one row
 * so the children row fits beneath it.
 */
export function buildPedigree(
  rootId: string,
  personMap: Map<string, Person>,
  maxGenerations = 5
): PedigreeLayout {
  const root = personMap.get(rootId);

  // ── 1. Ancestor layers (gen 0 = root, gen 1 = parents, …) ──────────────
  const ancestorLayers: string[][] = [[rootId]];

  for (let gen = 0; gen < maxGenerations - 1; gen++) {
    const current = ancestorLayers[gen];
    const next: string[] = [];
    for (const id of current) {
      const person = personMap.get(id);
      if (!person) {
        next.push('__empty__', '__empty__');
        continue;
      }
      next.push(person.fatherIds[0] || '__empty__', person.motherIds[0] || '__empty__');
    }
    if (next.every(id => id === '__empty__')) break;
    ancestorLayers.push(next);
  }

  // ── 2. Sizing ────────────────────────────────────────────────────────────
  const maxAncestorNodes = Math.max(...ancestorLayers.map(l => l.length));

  // Use childIds from the root person's parents to get siblings
  const siblingIds: string[] = root
    ? (() => {
        const parentId = root.fatherIds[0] || root.motherIds[0];
        if (!parentId) return [];
        const parent = personMap.get(parentId);
        if (!parent) return [];
        return parent.childIds.filter(id => id !== rootId);
      })()
    : [];

  const spouseIds: string[] = root ? root.spouseIds.slice(0, 2) : [];
  const childIds: string[] = root ? root.childIds : [];

  // Root row width: siblings + 1 (root) + spouses, all in one row
  const rootRowCount = siblingIds.length + 1 + spouseIds.length;

  const maxNodesInAnyRow = Math.max(maxAncestorNodes, rootRowCount, childIds.length);
  const totalW = maxNodesInAnyRow * (NODE_W + H_GAP) - H_GAP;

  // Height: ancestor rows + root row + children row
  const ancestorRowCount = ancestorLayers.length; // includes gen-0 row
  const extraRows = childIds.length > 0 ? 1 : 0;
  const totalH = (ancestorRowCount + extraRows) * (NODE_H + V_GAP) - V_GAP;

  // ── 3. Y positions ────────────────────────────────────────────────────────
  // Root row sits at: totalH - NODE_H (bottom of ancestor block)
  // If children exist, root row shifts up by one row
  const rootRowY = childIds.length > 0
    ? totalH - NODE_H - (NODE_H + V_GAP)
    : totalH - NODE_H;
  const childRowY = totalH - NODE_H;

  const nodes: TreeNode[] = [];
  const edges: PedigreeEdge[] = [];
  const posMap = new Map<string, { x: number; y: number }>();

  // ── 4. Ancestor layers ────────────────────────────────────────────────────
  ancestorLayers.forEach((layer, genIndex) => {
    // genIndex 0 = root row — we'll place root manually below, skip here
    if (genIndex === 0) return;

    const y = rootRowY - genIndex * (NODE_H + V_GAP);
    const layerW = layer.length * (NODE_W + H_GAP) - H_GAP;
    const startX = (totalW - layerW) / 2;

    layer.forEach((id, nodeIndex) => {
      if (id === '__empty__') return;
      const person = personMap.get(id);
      if (!person) return;
      const x = startX + nodeIndex * (NODE_W + H_GAP);
      posMap.set(id, { x, y });
      nodes.push({ ...person, generation: genIndex, x, y });
    });
  });

  // ── 5. Root row: siblings | root | spouses ────────────────────────────────
  {
    const rowItems = [...siblingIds, rootId, ...spouseIds];
    const rowW = rowItems.length * (NODE_W + H_GAP) - H_GAP;
    const startX = (totalW - rowW) / 2;

    rowItems.forEach((id, i) => {
      const person = personMap.get(id);
      if (!person) return;
      const x = startX + i * (NODE_W + H_GAP);
      const y = rootRowY;
      posMap.set(id, { x, y });

      const isSibling = siblingIds.includes(id);
      const isSpouse = spouseIds.includes(id);
      const role = isSibling ? 'sibling' : isSpouse ? 'spouse' : 'root';
      nodes.push({ ...person, generation: 0, role, x, y });
    });
  }

  // ── 6. Children row ───────────────────────────────────────────────────────
  if (childIds.length > 0) {
    const rowW = childIds.length * (NODE_W + H_GAP) - H_GAP;
    const startX = (totalW - rowW) / 2;

    childIds.forEach((id, i) => {
      const person = personMap.get(id);
      if (!person) return;
      const x = startX + i * (NODE_W + H_GAP);
      posMap.set(id, { x, y: childRowY });
      nodes.push({ ...person, generation: -1, x, y: childRowY });
    });
  }

  // ── 7. Edges ───────────────────────────────────────────────────────────────
  for (const node of nodes) {
    // Ancestor edges (child → parent)
    if (node.generation > 0) {
      for (const parentId of [...node.fatherIds.slice(0, 1), ...node.motherIds.slice(0, 1)]) {
        if (parentId && posMap.has(parentId)) {
          edges.push({ childId: node.id, parentId, type: 'ancestor' });
        }
      }
    }
    // Ancestor edge for root → its parents
    if (node.id === rootId) {
      for (const parentId of [...node.fatherIds.slice(0, 1), ...node.motherIds.slice(0, 1)]) {
        if (parentId && posMap.has(parentId)) {
          edges.push({ childId: node.id, parentId, type: 'ancestor' });
        }
      }
    }
  }

  // Child edges (root → children)
  for (const childId of childIds) {
    if (posMap.has(childId)) {
      edges.push({ childId, parentId: rootId, type: 'child' });
    }
  }

  // Spouse edges (root ↔ spouse, horizontal line)
  for (const spouseId of spouseIds) {
    if (posMap.has(spouseId)) {
      edges.push({ childId: rootId, parentId: spouseId, type: 'spouse' });
    }
  }

  // Sibling edges (sibling ↔ root, horizontal line)
  for (const sibId of siblingIds) {
    if (posMap.has(sibId)) {
      edges.push({ childId: sibId, parentId: rootId, type: 'sibling' });
    }
  }

  return { nodes, edges, width: totalW, height: totalH };
}
