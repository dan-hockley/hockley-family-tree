import { useState, useMemo, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Person, PersonDetail } from '../types';
import { buildPedigree, NODE_W, NODE_H, type PedigreeEdge } from '../lib/pedigree';
import PersonNode from './PersonNode';
import PersonSidebar from './PersonSidebar';

interface Props {
  persons: Person[];
  details: Map<string, PersonDetail>;
}

const r = 10; // corner radius for all connector elbows

function StarMark({ size = 10, color = '#0a0a0a' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, display: 'block' }}>
      <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill={color} />
    </svg>
  );
}

function ancestorPath(
  cx: number, cy: number, // child top-center
  px: number, py: number  // parent bottom-center
): string {
  const midY = (cy + py) / 2;
  const dx = px - cx;
  if (Math.abs(dx) < 1) return `M ${cx} ${cy} L ${px} ${py}`;
  const turnDir = dx > 0 ? 1 : -1;
  return [
    `M ${cx} ${cy}`,
    `L ${cx} ${midY + r}`,
    `A ${r} ${r} 0 0 ${turnDir > 0 ? 1 : 0} ${cx + turnDir * r} ${midY}`,
    `L ${px - turnDir * r} ${midY}`,
    `A ${r} ${r} 0 0 ${turnDir > 0 ? 0 : 1} ${px} ${midY - r}`,
    `L ${px} ${py}`,
  ].join(' ');
}

function childPath(
  px: number, py: number, // parent (root) bottom-center
  cx: number, cy: number  // child top-center
): string {
  // Downward — mirror of ancestorPath
  const midY = (py + cy) / 2;
  const dx = cx - px;
  if (Math.abs(dx) < 1) return `M ${px} ${py} L ${cx} ${cy}`;
  const turnDir = dx > 0 ? 1 : -1;
  return [
    `M ${px} ${py}`,
    `L ${px} ${midY - r}`,
    `A ${r} ${r} 0 0 ${turnDir > 0 ? 0 : 1} ${px + turnDir * r} ${midY}`,
    `L ${cx - turnDir * r} ${midY}`,
    `A ${r} ${r} 0 0 ${turnDir > 0 ? 1 : 0} ${cx} ${midY + r}`,
    `L ${cx} ${cy}`,
  ].join(' ');
}

function renderEdge(edge: PedigreeEdge, nodeMap: Map<string, { x: number; y: number }>) {
  const a = nodeMap.get(edge.childId);
  const b = nodeMap.get(edge.parentId);
  if (!a || !b) return null;

  const key = `${edge.type}-${edge.childId}-${edge.parentId}`;

  if (edge.type === 'ancestor') {
    return (
      <path
        key={key}
        d={ancestorPath(a.x + NODE_W / 2, a.y, b.x + NODE_W / 2, b.y + NODE_H)}
        fill="none"
        stroke="#c8c8c8"
        strokeWidth="1"
      />
    );
  }

  if (edge.type === 'child') {
    return (
      <path
        key={key}
        d={childPath(b.x + NODE_W / 2, b.y + NODE_H, a.x + NODE_W / 2, a.y)}
        fill="none"
        stroke="#c8c8c8"
        strokeWidth="1"
      />
    );
  }

  if (edge.type === 'spouse') {
    const ax = a.x + NODE_W;
    const ay = a.y + NODE_H / 2;
    const bx = b.x;
    const by = b.y + NODE_H / 2;
    const gap = bx - ax;
    const mid = ax + gap / 2;
    return (
      <path
        key={key}
        d={`M ${ax} ${ay} L ${mid - r} ${ay} A ${r} ${r} 0 0 1 ${mid} ${ay + r} L ${mid} ${by - r} A ${r} ${r} 0 0 0 ${mid + r} ${by} L ${bx} ${by}`}
        fill="none"
        stroke="#0a0a0a"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
    );
  }

  if (edge.type === 'sibling') {
    const ax = a.x + NODE_W;
    const ay = a.y + NODE_H / 2;
    const bx = b.x;
    const by = b.y + NODE_H / 2;
    return (
      <line
        key={key}
        x1={ax} y1={ay} x2={bx} y2={by}
        stroke="#d8d8d8"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
    );
  }

  return null;
}

export default function FamilyTree({ persons, details }: Props) {
  const personMap = useMemo(() => new Map(persons.map(p => [p.id, p])), [persons]);

  const defaultRoot = useMemo(() => {
    const daniel = persons.find(p =>
      p.givenName?.toLowerCase().includes('daniel') &&
      p.surname?.toLowerCase().includes('hockley')
    );
    return daniel?.id ?? persons[0]?.id ?? '';
  }, [persons]);

  const [rootId, setRootId] = useState<string>(defaultRoot);
  const [sidebarId, setSidebarId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<string[]>([]);

  const layout = useMemo(() => {
    if (!rootId) return null;
    return buildPedigree(rootId, personMap, 5);
  }, [rootId, personMap]);

  // Node position map for edge rendering
  const nodeMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    layout?.nodes.forEach(n => m.set(n.id, { x: n.x, y: n.y }));
    return m;
  }, [layout]);

  function navigateTo(id: string) {
    setSidebarId(null);
    setHistory(h => [...h, rootId]);
    setRootId(id);
  }

  function navigateBack() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setSidebarId(null);
    setRootId(prev);
  }

  function handleNodeClick(id: string) {
    if (id === rootId) {
      setSidebarId(prev => prev === id ? null : id);
    } else {
      navigateTo(id);
    }
  }

  useEffect(() => {
    if (containerRef.current && layout) {
      const el = containerRef.current;
      const rootNode = layout.nodes.find(n => n.id === rootId);
      if (rootNode) {
        // Center the root node in the viewport (nodes have 40px canvas margin)
        const nodeLeft = rootNode.x + 40;
        const nodeTop = rootNode.y + 40;
        const scrollX = nodeLeft - (el.clientWidth - NODE_W) / 2;
        const scrollY = nodeTop - (el.clientHeight - NODE_H) / 2;
        el.scrollTo({ left: Math.max(0, scrollX), top: Math.max(0, scrollY), behavior: 'smooth' });
      }
    }
  }, [rootId, layout]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return persons.filter(p => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [search, persons]);

  const rootPerson = personMap.get(rootId);

  return (
    <div className="flex flex-col h-screen" style={{ background: '#ffffff', color: '#0a0a0a', fontFamily: "'Inter', sans-serif" }}>

      {/* Header — black bar */}
      <header
        className="flex items-center gap-8 px-6 shrink-0"
        style={{
          background: '#0a0a0a',
          borderBottom: '1px solid #222222',
          height: 48,
        }}
      >
        {/* Star + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StarMark size={15} color="#ffffff" />
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            fontSize: 25,
            letterSpacing: '-0.03em',
            color: '#ffffff',
            lineHeight: 1,
          }}>
            Hockley Family Tree
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div className="relative">
          <input
            style={{
              background: '#1a1a1a',
              color: '#ffffff',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              borderRadius: 0,
              padding: '5px 10px',
              width: 190,
              border: '1px solid #333333',
              outline: 'none',
              fontFamily: "'Inter', sans-serif",
            }}
            placeholder="Search People"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSearch(true); }}
            onFocus={e => { setShowSearch(true); (e.target as HTMLInputElement).style.borderColor = '#666666'; }}
            onBlur={e => { setTimeout(() => setShowSearch(false), 200); (e.target as HTMLInputElement).style.borderColor = '#333333'; }}
          />
          {showSearch && searchResults.length > 0 && (
            <div
              className="absolute right-0 top-full z-50 w-72 overflow-hidden"
              style={{
                background: '#ffffff',
                border: '1px solid #d8d8d8',
                borderRadius: 0,
                marginTop: 2,
              }}
            >
              {searchResults.map((p, i) => (
                <button
                  key={p.id}
                  className="w-full text-left"
                  style={{
                    padding: '10px 14px',
                    borderBottom: i < searchResults.length - 1 ? '1px solid #ececec' : 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => { navigateTo(p.id); setSearch(''); setShowSearch(false); }}
                >
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#0a0a0a' }}>{p.name}</span>
                  <span style={{ fontSize: 9, color: '#aaaaaa', letterSpacing: '0.08em' }}>{p.birthDate?.match(/\d{4}/)?.[0] ?? ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <button
            onClick={navigateBack}
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#aaaaaa',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              border: '1px solid #333333',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              borderRadius: 0,
            }}
            onMouseEnter={e => { (e.currentTarget.style.background = '#ffffff'); (e.currentTarget.style.color = '#0a0a0a'); (e.currentTarget.style.borderColor = '#ffffff'); }}
            onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = '#aaaaaa'); (e.currentTarget.style.borderColor = '#333333'); }}
          >
            ← Back
          </button>
        )}
      </header>

      {/* Breadcrumb — label/value row like the reference */}
      {rootPerson && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 24px',
            borderBottom: '1px solid #e8e8e8',
            background: '#ffffff',
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#bbbbbb' }}>
            Viewing
          </span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#0a0a0a' }}>
              {rootPerson.name}
            </span>
            {rootPerson.birthDate && (
              <span style={{ fontSize: 9, color: '#aaaaaa', letterSpacing: '0.06em' }}>
                {rootPerson.birthDate.match(/\d{4}/)?.[0]}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Tree canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ background: '#ffffff' }}
      >
        {layout && (
          <div
            className="relative"
            style={{ width: layout.width + 80, height: layout.height + 80, margin: '40px' }}
          >
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: layout.width + 80, height: layout.height + 80 }}
              overflow="visible"
            >
              {layout.edges.map(edge => renderEdge(edge, nodeMap))}
            </svg>

            <AnimatePresence>
              {layout.nodes.map(node => (
                <PersonNode
                  key={node.id}
                  node={node}
                  isRoot={node.id === rootId}
                  onSelect={handleNodeClick}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {!layout && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 11, color: '#aaaaaa', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            No data
          </div>
        )}
      </div>

      <PersonSidebar
        person={sidebarId ? personMap.get(sidebarId) ?? null : null}
        detail={sidebarId ? details.get(sidebarId) ?? null : null}
        personMap={personMap}
        onClose={() => setSidebarId(null)}
        onNavigate={navigateTo}
      />

      {/* Footer — black bar, star mark, generation legend as label rows */}
      <footer
        style={{
          borderTop: '2px solid #0a0a0a',
          background: '#0a0a0a',
          padding: '0 24px',
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 20,
          lineHeight: 1,
        }}
      >
        <StarMark size={8} color="#ffffff" />
        {[
          { label: 'Parents',          color: '#0047ff' },
          { label: 'Grandparents',     color: '#8800ff' },
          { label: 'Gt. Grandparents', color: '#00ccff' },
          { label: 'Further',          color: '#ff6600' },
          { label: 'Children',         color: '#00cc44' },
        ].map(({ label, color }) => (
          <span key={label} style={{
            fontSize: 7,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color,
            fontFamily: "'Inter', sans-serif",
          }}>
            {label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 7, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#444444', fontFamily: "'Inter', sans-serif" }}>
          Click to navigate
        </span>
      </footer>
    </div>
  );
}
