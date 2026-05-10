import { useState, useMemo, useRef, useEffect } from 'react';
import type { Person, PersonDetail } from '../types';
import { buildTimeline, type TimelineEntry } from '../lib/timeline';
import { useViewport } from '../lib/useViewport';
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

const PX_PER_YEAR_DESKTOP = 6.3;
const PX_PER_YEAR_MOBILE = 4.9;
const AXIS_WIDTH = 59;
const LANE_WIDTH_DESKTOP = 69;
const LANE_WIDTH_MOBILE = 57;
const LANE_GAP = 8;
const TOP_PADDING = 28;
const BOTTOM_PADDING = 28;

const RELATION_COLORS = {
  self:       '#ff1a0e',
  ancestor:   '#0047ff',
  descendant: '#00cc44',
} as const;

function StarMark({ size = 10, color = '#0a0a0a' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, display: 'block' }}>
      <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill={color} />
    </svg>
  );
}

export default function Timeline({ persons, details, rootId: rootIdProp, exportDate, onNavigateRoute, onSetRoot, onGoHome }: Props) {
  const personMap = useMemo(() => new Map(persons.map(p => [p.id, p])), [persons]);
  const { isMobile } = useViewport();

  const defaultRoot = useMemo(() => {
    const daniel = persons.find(p =>
      p.givenName?.toLowerCase().includes('daniel') &&
      p.surname?.toLowerCase().includes('hockley')
    );
    return daniel?.id ?? persons[0]?.id ?? '';
  }, [persons]);

  const rootId = useMemo(() => {
    if (rootIdProp && personMap.has(rootIdProp)) return rootIdProp;
    return defaultRoot;
  }, [rootIdProp, personMap, defaultRoot]);
  const [sidebarId, setSidebarId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const layout = useMemo(() => {
    if (!rootId) return null;
    return buildTimeline(rootId, personMap);
  }, [rootId, personMap]);

  const pxPerYear = isMobile ? PX_PER_YEAR_MOBILE : PX_PER_YEAR_DESKTOP;
  const laneWidth = isMobile ? LANE_WIDTH_MOBILE : LANE_WIDTH_DESKTOP;

  // The timeline runs from maxYear (top) to minYear (bottom).
  // y(year) = TOP_PADDING + (maxYear - year) * pxPerYear
  const maxYear = layout?.maxYear ?? new Date().getFullYear();
  const minYear = layout?.minYear ?? maxYear;
  const totalHeight = (maxYear - minYear) * pxPerYear + TOP_PADDING + BOTTOM_PADDING;

  const yForYear = (year: number) => TOP_PADDING + (maxYear - year) * pxPerYear;

  const containerRef = useRef<HTMLDivElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);
  // Each bar registers its sticky-name DOM node + bar geometry so the scroll
  // handler can set transforms directly without going through React state.
  const stickyRegistry = useRef<Map<string, { node: HTMLDivElement; y: number; height: number }>>(new Map());

  const registerSticky = (id: string, node: HTMLDivElement | null, y: number, height: number) => {
    if (node) stickyRegistry.current.set(id, { node, y, height });
    else stickyRegistry.current.delete(id);
  };

  // When the root changes, the previous bars unmount and re-register, but
  // any stale entries should be cleared first so we never animate leftovers.
  useEffect(() => {
    stickyRegistry.current.clear();
  }, [rootId]);

  // Force the canvas to start at the top on first mount. Re-pin to 0 across
  // a few frames to beat browser scroll restoration / layout shifts from the
  // breadcrumb appearing once data resolves.
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (!containerRef.current || !layout) return;
    const el = containerRef.current;
    if (!didInitialScroll.current) {
      didInitialScroll.current = true;
      const pinTop = () => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      };
      pinTop();
      requestAnimationFrame(pinTop);
      requestAnimationFrame(() => requestAnimationFrame(pinTop));
      return;
    }
    const rootEntry = layout.entries.find(e => e.person.id === rootId);
    if (!rootEntry) return;
    const midYear = (rootEntry.birthYear + rootEntry.deathYear) / 2;
    const targetY = yForYear(midYear);
    el.scrollTo({
      top: Math.max(0, targetY - el.clientHeight / 2),
      behavior: 'smooth',
    });
  }, [rootId, layout, pxPerYear]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drive sticky offsets directly via DOM writes inside the scroll handler so
  // they track the scrollbar exactly, without any React re-render lag.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const NAME_BLOCK_H = 36;
    const PAD = 7;
    const update = () => {
      const sl = el.scrollLeft;
      const st = el.scrollTop;
      const vh = el.clientHeight;
      if (axisRef.current) {
        axisRef.current.style.transform = `translateX(${sl}px)`;
      }
      stickyRegistry.current.forEach(({ node, y, height }) => {
        let offset = 0;
        if (height > NAME_BLOCK_H + PAD * 2) {
          const visTop = st;
          const visBottom = st + vh;
          const barTop = y;
          const barBottom = y + height;
          if (visTop > barTop && visBottom < barBottom) {
            offset = visTop - barTop;
          } else if (visTop > barTop) {
            offset = Math.min(visTop - barTop, height - NAME_BLOCK_H - PAD * 2);
          }
          if (offset < 0) offset = 0;
        }
        node.style.transform = `translateY(${offset}px)`;
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [layout]);

  function navigateRoot(id: string) {
    setSidebarId(null);
    setSearch('');
    setShowSearch(false);
    setSearchOpen(false);
    onSetRoot(id);
  }

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return persons.filter(p => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [search, persons]);

  const rootPerson = personMap.get(rootId);
  const headerHeight = isMobile ? 44 : 48;

  // Decade labels: every 10 years, plus minYear and maxYear if not on a decade
  const decadeYears = useMemo(() => {
    const years = new Set<number>();
    const startDec = Math.ceil(minYear / 10) * 10;
    const endDec = Math.floor(maxYear / 10) * 10;
    for (let y = startDec; y <= endDec; y += 10) years.add(y);
    return [...years].sort((a, b) => a - b);
  }, [minYear, maxYear]);

  const totalLanesWidth = layout ? layout.laneCount * laneWidth + (layout.laneCount - 1) * LANE_GAP : 0;
  const canvasWidth = AXIS_WIDTH + 24 + totalLanesWidth + 24;

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
          gap: isMobile ? 8 : 24,
          paddingLeft: isMobile ? 12 : 24,
          paddingRight: isMobile ? 8 : 24,
          flexShrink: 0,
          background: '#0a0a0a',
          borderBottom: '1px solid #222222',
          height: headerHeight,
        }}
      >
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
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {isMobile ? 'Hockley' : 'Hockley Family Tree'}
          </span>
        </button>

        {/* View toggle */}
        <ViewNav current="timeline" onNavigateRoute={onNavigateRoute} />

        <div style={{ flex: 1 }} />

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
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            />
            {showSearch && searchResults.length > 0 && (
              <div style={{
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
              }}>
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
                    onClick={() => navigateRoot(p.id)}
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
                  onClick={() => navigateRoot(p.id)}
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '6px 12px' : '6px 24px',
          borderBottom: '1px solid #e8e8e8',
          background: '#ffffff',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#bbbbbb' }}>
            Centered on
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

      {/* Timeline canvas */}
      <div
        ref={containerRef}
        className="tree-canvas"
        onMouseDown={e => {
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
        {layout && layout.entries.length > 0 ? (
          <div style={{
            position: 'relative',
            width: canvasWidth,
            height: totalHeight,
            minWidth: '100%',
          }}>
            {/* Year axis */}
            <YearAxis
              axisRef={axisRef}
              minYear={minYear}
              maxYear={maxYear}
              decadeYears={decadeYears}
              yForYear={yForYear}
              totalHeight={totalHeight}
            />

            {/* Bars */}
            <div style={{
              position: 'absolute',
              left: AXIS_WIDTH + 24,
              top: 0,
              right: 0,
              bottom: 0,
            }}>
              {layout.entries.map(entry => {
                const x = entry.lane * (laneWidth + LANE_GAP);
                const yTop = yForYear(entry.deathYear);
                const yBot = yForYear(entry.birthYear);
                const height = Math.max(yBot - yTop, 80);
                return (
                  <PersonBar
                    key={entry.person.id}
                    entry={entry}
                    x={x}
                    y={yTop}
                    width={laneWidth}
                    height={height}
                    isRoot={entry.person.id === rootId}
                    registerSticky={registerSticky}
                  />
                );
              })}
            </div>
          </div>
        ) : (
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
            No timeline data
          </div>
        )}
      </div>

      <PersonSidebar
        person={sidebarId ? personMap.get(sidebarId) ?? null : null}
        detail={sidebarId ? details.get(sidebarId) ?? null : null}
        personMap={personMap}
        onClose={() => setSidebarId(null)}
        onNavigate={navigateRoot}
        isMobile={isMobile}
      />

      {/* Footer legend */}
      {!isMobile && (
        <footer style={{
          borderTop: '2px solid #0a0a0a',
          background: '#0a0a0a',
          padding: '0 24px',
          height: 36,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          lineHeight: 1,
          flexShrink: 0,
        }}>
          <StarMark size={8} color="#ffffff" />
          {[
            { label: 'Ancestors',   color: RELATION_COLORS.ancestor },
            { label: 'Self',        color: RELATION_COLORS.self },
            { label: 'Descendants', color: RELATION_COLORS.descendant },
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
            {exportDate ? `Ancestry export · ${exportDate}` : 'Down = back in time · Hatched = estimated'}
          </span>
        </footer>
      )}
    </div>
  );
}

function YearAxis({
  axisRef, minYear, maxYear, decadeYears, yForYear, totalHeight,
}: {
  axisRef: React.RefObject<HTMLDivElement | null>;
  minYear: number;
  maxYear: number;
  decadeYears: number[];
  yForYear: (y: number) => number;
  totalHeight: number;
}) {
  return (
    <div ref={axisRef} style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: AXIS_WIDTH,
      height: totalHeight,
      background: '#ffffff',
      zIndex: 5,
      willChange: 'transform',
    }}>
      {/* Vertical axis line */}
      <div style={{
        position: 'absolute',
        left: AXIS_WIDTH - 1,
        top: yForYear(maxYear),
        width: 1,
        height: yForYear(minYear) - yForYear(maxYear),
        background: '#0a0a0a',
      }} />

      {/* Year ticks: decades black, single years grey */}
      {Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
        const year = maxYear - i;
        const y = yForYear(year);
        const isDecade = year % 10 === 0;
        return (
          <div
            key={year}
            style={{
              position: 'absolute',
              right: 0,
              top: y,
              width: isDecade ? 14 : 7,
              height: 1,
              background: isDecade ? '#0a0a0a' : '#bbbbbb',
            }}
          />
        );
      })}

      {/* Decade labels */}
      {decadeYears.map(year => {
        const y = yForYear(year);
        if (y < 0 || y > totalHeight) return null;
        return (
          <div
            key={year}
            style={{
              position: 'absolute',
              right: 22,
              top: y - 7,
              fontSize: 11,
              fontWeight: 600,
              color: '#0a0a0a',
              fontFamily: "'Inter', sans-serif",
              letterSpacing: '0.04em',
            }}
          >
            {year}
          </div>
        );
      })}
    </div>
  );
}

function PersonBar({
  entry, x, y, width, height, isRoot, registerSticky,
}: {
  entry: TimelineEntry;
  x: number;
  y: number;
  width: number;
  height: number;
  isRoot: boolean;
  registerSticky: (id: string, node: HTMLDivElement | null, y: number, height: number) => void;
}) {
  // "Father" = root + every ancestor on the patrilineal chain.
  // Spouses are tagged as 'descendant' in this layout (they're partners of chain members).
  const isFather = isRoot || entry.relation === 'ancestor';
  const FATHER_BLUE = '#0047ff';
  const MOTHER_PINK = '#ff3399';

  // Estimated dates get a hatched fill via background gradient
  const estimated = entry.birthEstimated || entry.deathEstimated;

  const baseBg = '#ffffff';
  const baseBorder = '#d8d8d8';
  const textColor = isFather ? FATHER_BLUE : MOTHER_PINK;

  const hatchOverlay = estimated ? {
    backgroundImage: 'repeating-linear-gradient(135deg, transparent 0px, transparent 5px, rgba(0,0,0,0.06) 5px, rgba(0,0,0,0.06) 6px)',
  } : {};

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        background: baseBg,
        border: `1px solid ${baseBorder}`,
        userSelect: 'none',
        padding: '15px 8px 8px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        overflow: 'hidden',
        ...hatchOverlay,
      }}
    >
      {/* 7px color stripe at the top of the bar — absolutely positioned so it
          doesn't change the bar's geometry or push the column wider/taller. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 7,
          background: textColor,
          pointerEvents: 'none',
        }}
      />
      {/* Sticky header block: name + surname (transform driven directly via DOM in scroll handler) */}
      <div
        ref={node => registerSticky(entry.person.id, node, y, height)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          willChange: 'transform',
        }}
      >
        {/* Full name (given + surname inline) */}
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          fontSize: 10,
          color: textColor,
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          wordBreak: 'break-word',
        }}>
          {[entry.person.givenName, entry.person.surname].filter(Boolean).join(' ') || entry.person.name}
        </div>
      </div>

      {/* Lifespan + estimated marker */}
      {height > 42 && (
        <div style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 7,
            fontWeight: 500,
            color: textColor,
            letterSpacing: '0.04em',
          }}>
            {entry.birthEstimated ? '~' : ''}{entry.birthYear}
            {' – '}
            {entry.living ? 'present' : `${entry.deathEstimated ? '~' : ''}${entry.deathYear}`}
          </div>
          {estimated && (
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#aaaaaa',
            }}>
              {entry.birthEstimated && entry.deathEstimated ? 'Estimated dates' :
                entry.birthEstimated ? 'Estimated birth' : 'Estimated death'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
