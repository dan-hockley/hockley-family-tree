import { useState, useMemo, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Person, PersonDetail } from '../types';
import { buildPedigree, NODE_W, NODE_H, type PedigreeEdge } from '../lib/pedigree';
import { useViewport } from '../lib/useViewport';
import PersonNode from './PersonNode';
import PersonSidebar from './PersonSidebar';
import ViewNav from './ViewNav';

interface Props {
  persons: Person[];
  details: Map<string, PersonDetail>;
  rootId: string | null;
  exportDate: string | null;
  onNavigateRoute: (path: string) => void;
  onSetRoot: (personId: string) => void;
  onGoHome: () => void;
}

const r = 10; // corner radius for connector elbows
const CANVAS_MARGIN = 40;
const MOBILE_SCALE = 0.7;

function StarMark({ size = 10, color = '#0a0a0a' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, display: 'block' }}>
      <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill={color} />
    </svg>
  );
}

function ancestorPath(cx: number, cy: number, px: number, py: number): string {
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

function childPath(px: number, py: number, cx: number, cy: number): string {
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

function renderEdge(
  edge: PedigreeEdge,
  nodeMap: Map<string, { x: number; y: number }>,
  patrilinealEdges: Set<string>,
) {
  const a = nodeMap.get(edge.childId);
  const b = nodeMap.get(edge.parentId);
  if (!a || !b) return null;

  const key = `${edge.type}-${edge.childId}-${edge.parentId}`;

  if (edge.type === 'ancestor') {
    const isPatrilineal = patrilinealEdges.has(`${edge.childId}|${edge.parentId}`);
    return (
      <path
        key={key}
        d={ancestorPath(a.x + NODE_W / 2, a.y, b.x + NODE_W / 2, b.y + NODE_H)}
        fill="none"
        stroke={isPatrilineal ? '#666666' : '#c8c8c8'}
        strokeWidth={isPatrilineal ? 1.5 : 1}
      />
    );
  }

  if (edge.type === 'child') {
    return (
      <path
        key={key}
        d={childPath(b.x + NODE_W / 2, b.y + NODE_H, a.x + NODE_W / 2, a.y)}
        fill="none"
        stroke="#666666"
        strokeWidth="1.5"
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

export default function FamilyTree({ persons, details, rootId: rootIdProp, exportDate, onNavigateRoute, onSetRoot, onGoHome }: Props) {
  const personMap = useMemo(() => new Map(persons.map(p => [p.id, p])), [persons]);
  const { isMobile } = useViewport();

  const defaultRoot = useMemo(() => {
    const daniel = persons.find(p =>
      p.givenName?.toLowerCase().includes('daniel') &&
      p.surname?.toLowerCase().includes('hockley')
    );
    return daniel?.id ?? persons[0]?.id ?? '';
  }, [persons]);

  // Resolve the active root from URL (?p=) falling back to Daniel.
  const rootId = useMemo(() => {
    if (rootIdProp && personMap.has(rootIdProp)) return rootIdProp;
    return defaultRoot;
  }, [rootIdProp, personMap, defaultRoot]);

  const [sidebarId, setSidebarId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false); // mobile: toggle search overlay
  const containerRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => {
    if (!rootId) return null;
    return buildPedigree(rootId, personMap, 5);
  }, [rootId, personMap]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    layout?.nodes.forEach(n => m.set(n.id, { x: n.x, y: n.y }));
    return m;
  }, [layout]);

  // Set of (childId|parentId) edges along the patrilineal chain (root → father → father's father …)
  const patrilinealEdges = useMemo(() => {
    const set = new Set<string>();
    if (!rootId) return set;
    let currentId: string | undefined = rootId;
    const seen = new Set<string>();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const person = personMap.get(currentId);
      const fatherId = person?.fatherIds[0];
      if (fatherId && personMap.has(fatherId)) {
        set.add(`${currentId}|${fatherId}`);
        currentId = fatherId;
      } else {
        break;
      }
    }
    return set;
  }, [rootId, personMap]);

  function navigateTo(id: string) {
    setSidebarId(null);
    setSearch('');
    setShowSearch(false);
    setSearchOpen(false);
    onSetRoot(id);
  }

  function handleNodeClick(id: string) {
    if (id === rootId) {
      setSidebarId(prev => prev === id ? null : id);
    } else {
      navigateTo(id);
    }
  }

  // Center the root node in the viewport whenever it changes. Use instant
  // scroll on first mount so the view doesn't animate from the top-left
  // corner; smooth scroll on subsequent re-roots.
  const scale = isMobile ? MOBILE_SCALE : 1;
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (containerRef.current && layout) {
      const el = containerRef.current;
      const rootNode = layout.nodes.find(n => n.id === rootId);
      if (rootNode) {
        const nodeLeft = (rootNode.x + CANVAS_MARGIN) * scale;
        const nodeTop = (rootNode.y + CANVAS_MARGIN) * scale;
        const scrollX = nodeLeft - (el.clientWidth - NODE_W * scale) / 2;
        const scrollY = nodeTop - (el.clientHeight - NODE_H * scale) / 2;
        el.scrollTo({
          left: Math.max(0, scrollX),
          top: Math.max(0, scrollY),
          behavior: didInitialScroll.current ? 'smooth' : 'instant',
        });
        didInitialScroll.current = true;
      }
    }
  }, [rootId, layout, scale]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return persons.filter(p => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [search, persons]);

  const rootPerson = personMap.get(rootId);

  const headerHeight = isMobile ? 44 : 48;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      background: '#ffffff',
      color: '#0a0a0a',
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 14 : 24,
          paddingLeft: isMobile ? 14 : 24,
          paddingRight: isMobile ? 10 : 24,
          flexShrink: 0,
          background: '#0a0a0a',
          borderBottom: '1px solid #222222',
          height: headerHeight,
        }}
      >
        {/* Title — click to return to the tree centered on Daniel */}
        <button
          type="button"
          onClick={onGoHome}
          aria-label="Hockley Family Tree home"
          className="title-btn focus-ring-light"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <StarMark size={isMobile ? 12 : 15} color="#ffffff" />
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            fontSize: isMobile ? 17 : 25,
            letterSpacing: '-0.03em',
            color: '#ffffff',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {isMobile ? 'Hockley' : 'Hockley Family Tree'}
          </span>
        </button>

        {/* View toggle */}
        <ViewNav current="tree" onNavigateRoute={onNavigateRoute} />

        <div style={{ flex: 1 }} />

        {/* Desktop: inline search. Mobile: icon toggle */}
        {isMobile ? (
          <button
            onClick={() => setSearchOpen(o => !o)}
            aria-label="Search"
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #333333',
              background: searchOpen ? '#ffffff' : 'transparent',
              color: searchOpen ? '#0a0a0a' : '#aaaaaa',
              cursor: 'pointer',
              borderRadius: 0,
              padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20 L16 16" />
            </svg>
          </button>
        ) : (
          <div style={{ position: 'relative' }}>
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
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  zIndex: 50,
                  width: 288,
                  overflow: 'hidden',
                  background: '#ffffff',
                  border: '1px solid #d8d8d8',
                  borderRadius: 0,
                  marginTop: 2,
                }}
              >
                {searchResults.map((p, i) => (
                  <button
                    key={p.id}
                    className="search-row"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      borderBottom: i < searchResults.length - 1 ? '1px solid #ececec' : 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      fontFamily: "'Inter', sans-serif",
                      border: 'none',
                    }}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => navigateTo(p.id)}
                  >
                    <span style={{ fontSize: 14, color: '#0a0a0a' }}>{p.name}</span>
                    <span style={{ fontSize: 9, color: '#aaaaaa', letterSpacing: '0.08em' }}>{p.birthDate?.match(/\d{4}/)?.[0] ?? ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Mobile search overlay */}
      {isMobile && searchOpen && (
        <div style={{
          background: '#0a0a0a',
          borderBottom: '1px solid #222222',
          padding: 10,
          flexShrink: 0,
        }}>
          <input
            autoFocus
            style={{
              width: '100%',
              background: '#1a1a1a',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 500,
              padding: '10px 12px',
              border: '1px solid #333333',
              borderRadius: 0,
              outline: 'none',
              fontFamily: "'Inter', sans-serif",
            }}
            placeholder="Search people..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div style={{
              background: '#ffffff',
              border: '1px solid #d8d8d8',
              marginTop: 8,
              maxHeight: '50dvh',
              overflowY: 'auto',
            }}>
              {searchResults.map((p, i) => (
                <button
                  key={p.id}
                  className="search-row"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderBottom: i < searchResults.length - 1 ? '1px solid #ececec' : 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    fontFamily: "'Inter', sans-serif",
                    border: 'none',
                  }}
                  onClick={() => navigateTo(p.id)}
                >
                  <span style={{ fontSize: 14, color: '#0a0a0a' }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: '#aaaaaa', letterSpacing: '0.08em' }}>{p.birthDate?.match(/\d{4}/)?.[0] ?? ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Breadcrumb */}
      {rootPerson && !searchOpen && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isMobile ? '6px 12px' : '6px 24px',
            borderBottom: '1px solid #e8e8e8',
            background: '#ffffff',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#bbbbbb' }}>
            Viewing
          </span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: '#0a0a0a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {rootPerson.name}
            </span>
            {rootPerson.birthDate && (
              <span style={{ fontSize: 9, color: '#aaaaaa', letterSpacing: '0.06em', flexShrink: 0 }}>
                {rootPerson.birthDate.match(/\d{4}/)?.[0]}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Tree canvas */}
      <div
        ref={containerRef}
        className="tree-canvas"
        onMouseDown={e => {
          // Left button only; ignore drags that started on an interactive card
          if (e.button !== 0) return;
          const el = containerRef.current;
          if (!el) return;
          const startX = e.clientX;
          const startY = e.clientY;
          const startScrollLeft = el.scrollLeft;
          const startScrollTop = el.scrollTop;
          let moved = false;
          const onMove = (ev: MouseEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (!moved && Math.abs(dx) + Math.abs(dy) > 4) moved = true;
            if (moved) {
              el.scrollLeft = startScrollLeft - dx;
              el.scrollTop = startScrollTop - dy;
              el.style.cursor = 'grabbing';
            }
          };
          const onUp = (ev: MouseEvent) => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp, true);
            el.style.cursor = '';
            if (moved) {
              // Suppress the trailing click so a drag never navigates
              ev.stopPropagation();
              const swallow = (ce: MouseEvent) => {
                ce.stopPropagation();
                ce.preventDefault();
                window.removeEventListener('click', swallow, true);
              };
              window.addEventListener('click', swallow, true);
            }
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp, true);
        }}
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#ffffff',
          WebkitOverflowScrolling: 'touch',
          cursor: 'grab',
        }}
      >
        {layout && (
          <div
            style={{
              position: 'relative',
              width: (layout.width + CANVAS_MARGIN * 2) * scale,
              height: (layout.height + CANVAS_MARGIN * 2) * scale,
              margin: CANVAS_MARGIN,
            }}
          >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: layout.width + CANVAS_MARGIN * 2,
              height: layout.height + CANVAS_MARGIN * 2,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                width: layout.width + CANVAS_MARGIN * 2,
                height: layout.height + CANVAS_MARGIN * 2,
              }}
              overflow="visible"
            >
              {/* Render light/grey edges first */}
              {layout.edges
                .filter(e => e.type !== 'child' && !patrilinealEdges.has(`${e.childId}|${e.parentId}`))
                .map(edge => renderEdge(edge, nodeMap, patrilinealEdges))}
              {/* Black father-line edges on top: patrilineal chain + child edges */}
              {layout.edges
                .filter(e => e.type === 'child' || patrilinealEdges.has(`${e.childId}|${e.parentId}`))
                .map(edge => renderEdge(edge, nodeMap, patrilinealEdges))}
            </svg>

            <AnimatePresence>
              {layout.nodes.map(node => {
                const d = details.get(node.id);
                const hasNotes = !!d && d.notes.length > 0;
                return (
                  <PersonNode
                    key={node.id}
                    node={node}
                    isRoot={node.id === rootId}
                    hasNotes={hasNotes}
                    onSelect={handleNodeClick}
                    onOpenNotes={id => setSidebarId(id)}
                  />
                );
              })}
            </AnimatePresence>
          </div>
          </div>
        )}

        {!layout && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontSize: 11,
            color: '#aaaaaa',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
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
        isMobile={isMobile}
      />

      {/* Footer — desktop only (legend is decorative noise on mobile) */}
      {!isMobile && (
        <footer
          style={{
            borderTop: '2px solid #0a0a0a',
            background: '#0a0a0a',
            padding: '0 24px',
            height: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            lineHeight: 1,
            flexShrink: 0,
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
          <span style={{
            marginLeft: 'auto',
            fontSize: 7,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#444444',
            fontFamily: "'Inter', sans-serif",
          }}>
            {exportDate ? `Ancestry export · ${exportDate}` : 'Click to navigate'}
          </span>
        </footer>
      )}
    </div>
  );
}
