import { useMemo, useRef, useState } from 'react';
import type { Person, PersonDetail } from '../types';
import { useViewport } from '../lib/useViewport';
import ViewNav from './ViewNav';

interface Props {
  persons: Person[];
  details: Map<string, PersonDetail>;
  exportDate: string | null;
  onNavigateRoute: (path: string) => void;
  onOpenInTree: (personId: string) => void;
}

const CARD_MAX_W = 800;

function StarMark({ size = 10, color = '#0a0a0a' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, display: 'block' }}>
      <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill={color} />
    </svg>
  );
}

// Hierarchy glyph: one square on top, two squares below, connecting lines
function TreeIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" style={{ display: 'block' }}>
      {/* Top square */}
      <rect x="7" y="1.5" width="6" height="6" />
      {/* Bottom-left square */}
      <rect x="1" y="12.5" width="6" height="6" />
      {/* Bottom-right square */}
      <rect x="13" y="12.5" width="6" height="6" />
      {/* Connectors: vertical down from top, horizontal across, vertical up to each child */}
      <path d="M10 7.5 L10 10 L4 10 L4 12.5" />
      <path d="M10 10 L16 10 L16 12.5" />
    </svg>
  );
}

function birthYear(p: Person): number | null {
  const m = p.birthDate?.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
}

export default function Biographies({ persons, details, exportDate, onNavigateRoute, onOpenInTree }: Props) {
  const { isMobile } = useViewport();
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // People with at least one note, reverse chron by birth year
  const entries = useMemo(() => {
    return persons
      .filter(p => (details.get(p.id)?.notes.length ?? 0) > 0)
      .map(p => ({ person: p, detail: details.get(p.id)!, year: birthYear(p) }))
      .sort((a, b) => {
        // Most recent birth first; people without a birth year sink to the bottom
        const ay = a.year ?? -Infinity;
        const by = b.year ?? -Infinity;
        return by - ay;
      });
  }, [persons, details]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return persons.filter(p => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [search, persons]);

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
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 8 : 24,
        paddingLeft: isMobile ? 12 : 24,
        paddingRight: isMobile ? 8 : 24,
        flexShrink: 0,
        background: '#0a0a0a',
        borderBottom: '1px solid #222222',
        height: headerHeight,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
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
        </div>

        <ViewNav current="biographies" onNavigateRoute={onNavigateRoute} />

        <div style={{ flex: 1 }} />

        {isMobile ? (
          <button
            onClick={() => setSearchOpen(o => !o)}
            aria-label="Search"
            style={{
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid #333333',
              background: searchOpen ? '#ffffff' : 'transparent',
              color: searchOpen ? '#0a0a0a' : '#aaaaaa',
              cursor: 'pointer', borderRadius: 0, padding: 0,
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
                background: '#1a1a1a', color: '#ffffff',
                fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
                borderRadius: 0, padding: '5px 10px', width: 190,
                border: '1px solid #333333', outline: 'none', fontFamily: "'Inter', sans-serif",
              }}
              placeholder="Search People"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            />
            {showSearch && searchResults.length > 0 && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', zIndex: 50,
                width: 288, overflow: 'hidden',
                background: '#ffffff', border: '1px solid #d8d8d8', marginTop: 2,
              }}>
                {searchResults.map((p, i) => (
                  <button
                    key={p.id}
                    className="search-row"
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 14px',
                      borderBottom: i < searchResults.length - 1 ? '1px solid #ececec' : 'none',
                      background: 'transparent', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      fontFamily: "'Inter', sans-serif", border: 'none',
                    }}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => onOpenInTree(p.id)}
                  >
                    <span style={{ fontSize: 14, color: '#0a0a0a' }}>{p.name}</span>
                    <span style={{ fontSize: 9, color: '#aaaaaa', letterSpacing: '0.08em' }}>
                      {p.birthDate?.match(/\d{4}/)?.[0] ?? ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Reading column */}
      <div
        ref={containerRef}
        className="tree-canvas"
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#ffffff',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{
          maxWidth: CARD_MAX_W,
          margin: '0 auto',
          padding: isMobile ? '24px 16px 64px' : '40px 24px 96px',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 24 : 40,
        }}>
          {entries.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: 48,
              fontSize: 11,
              color: '#aaaaaa',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              No biographies yet
            </div>
          ) : (
            entries.map(({ person, detail }) => (
              <BiographyCard
                key={person.id}
                person={person}
                detail={detail}
                onOpenInTree={() => onOpenInTree(person.id)}
              />
            ))
          )}
        </div>
      </div>

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
          <span style={{
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#aaaaaa',
            fontFamily: "'Inter', sans-serif",
          }}>
            {entries.length} {entries.length === 1 ? 'biography' : 'biographies'}
          </span>
          <span style={{
            marginLeft: 'auto',
            fontSize: 7,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#444444',
            fontFamily: "'Inter', sans-serif",
          }}>
            {exportDate ? `Ancestry export · ${exportDate}` : 'Click the tree icon to view in tree'}
          </span>
        </footer>
      )}
    </div>
  );
}

function BiographyCard({
  person, detail, onOpenInTree,
}: {
  person: Person;
  detail: PersonDetail;
  onOpenInTree: () => void;
}) {
  const birth = person.birthDate?.match(/\d{4}/)?.[0];
  const death = person.deathDate?.match(/\d{4}/)?.[0];
  const lifespan = birth
    ? (death ? `${birth}–${death}` : `b. ${birth}`)
    : null;
  const place = person.birthPlace?.split(',').slice(-2).join(',').trim();

  return (
    <article
      style={{
        background: '#ffffff',
        border: '1px solid #d8d8d8',
        userSelect: 'none',
        padding: '32px 32px 36px',
        filter: 'drop-shadow(0 0 30px #cccccc)',
      }}
    >
      {/* Top row: star + lifespan + place + tree icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <StarMark size={9} color="#0047ff" />
        {lifespan && (
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#0047ff',
            lineHeight: 1,
          }}>
            {lifespan}
          </span>
        )}
        {place && (
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#aaaaaa',
            lineHeight: 1,
          }}>
            {place}
          </span>
        )}
        <button
          onClick={onOpenInTree}
          aria-label={`Open ${person.name} in tree view`}
          className="bio-tree-btn"
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            borderRadius: 0,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <TreeIcon size={18} />
        </button>
      </div>

      {/* Full name (given + surname inline) */}
      <h2 style={{
        fontFamily: "'Inter', sans-serif",
        fontWeight: 700,
        fontSize: 40,
        letterSpacing: '-0.02em',
        color: '#0a0a0a',
        margin: 0,
        lineHeight: 1.05,
      }}>
        {[person.givenName, person.surname].filter(Boolean).join(' ') || person.name}
      </h2>

      {/* Rule */}
      <div style={{
        borderTop: '1px solid #ececec',
        marginTop: 24,
        marginBottom: 24,
      }} />

      {/* Notes */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {detail.notes.map((note, i) => (
          <p key={i} style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 15,
            lineHeight: 1.55,
            color: '#0a0a0a',
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}>
            {note}
          </p>
        ))}
      </div>
    </article>
  );
}
