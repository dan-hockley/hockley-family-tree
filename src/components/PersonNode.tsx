import { motion } from 'framer-motion';
import type { TreeNode } from '../types';

interface Props {
  node: TreeNode;
  isRoot: boolean;
  onSelect: (id: string) => void;
}

const GENERATION_COLORS: Record<number, string> = {
  '-1': '#00cc44',   // children — green
  0:    '#ff1a0e',   // root — red
  1:    '#0047ff',   // parents — blue
  2:    '#8800ff',   // grandparents — purple
  3:    '#00ccff',   // great-grandparents — cyan
  4:    '#ff6600',   // further — orange
};

const GENERATION_LABELS: Record<number, string> = {
  '-1': 'Child',
  0:    'Root',
  1:    'Parent',
  2:    'Grandparent',
  3:    'Gt. Grandparent',
  4:    'Ancestor',
};

function formatYear(date: string | undefined): string | null {
  if (!date) return null;
  const m = date.match(/\d{4}/);
  return m ? m[0] : null;
}

// 4-pointed star SVG mark
function Star({ size = 10, color = '#0a0a0a' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z"
        fill={color}
      />
    </svg>
  );
}

export default function PersonNode({ node, isRoot, onSelect }: Props) {
  const colorKey = Math.min(node.generation, 4);
  const genColor = GENERATION_COLORS[colorKey] ?? '#d41ad4';
  const genLabel = GENERATION_LABELS[colorKey] ?? 'Ancestor';
  const birthYear = formatYear(node.birthDate);
  const deathYear = formatYear(node.deathDate);
  const lifespan = birthYear ? (deathYear ? `${birthYear}–${deathYear}` : `b. ${birthYear}`) : null;

  return (
    <motion.div
      layoutId={node.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onClick={() => onSelect(node.id)}
      className="absolute cursor-pointer select-none"
      style={{ width: 210, left: node.x, top: node.y }}
    >
      <div
        style={{
          background: isRoot ? '#0a0a0a' : '#ffffff',
          border: `1px solid ${isRoot ? '#0a0a0a' : '#d8d8d8'}`,
          borderTop: isRoot ? '3px solid #0a0a0a' : '1px solid #d8d8d8',
          borderRadius: 0,
          padding: '10px 12px 10px',
          transition: 'border-color 0.12s',
        }}
        onMouseEnter={e => {
          if (!isRoot) (e.currentTarget as HTMLElement).style.borderColor = '#0a0a0a';
        }}
        onMouseLeave={e => {
          if (!isRoot) (e.currentTarget as HTMLElement).style.borderColor = '#d8d8d8';
        }}
      >
        {/* Top row: star + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
          <Star size={7} color={isRoot ? '#ffffff' : '#0a0a0a'} />
          {node.generation === 0 ? (
            node.role === 'sibling' || node.role === 'spouse' ? (
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#aaaaaa',
                lineHeight: 1,
              }}>
                {node.role === 'sibling' ? 'Sibling' : 'Spouse'}
              </span>
            ) : null
          ) : (
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: genColor,
              lineHeight: 1,
            }}>
              {genLabel}
            </span>
          )}
        </div>

        {/* Given name */}
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 22,
            color: isRoot ? '#ffffff' : '#0a0a0a',
            lineHeight: 1.1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.02em',
          }}
        >
          {node.givenName || node.name}
        </div>

        {/* Surname — light tracked caps */}
        {node.surname && (
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 300,
              fontSize: 8,
              color: isRoot ? 'rgba(255,255,255,0.55)' : '#888888',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              marginTop: 3,
            }}
          >
            {node.surname}
          </div>
        )}

        {/* Rule */}
        {lifespan && (
          <div style={{ borderTop: `1px solid ${isRoot ? 'rgba(255,255,255,0.15)' : '#ececec'}`, marginTop: 8 }} />
        )}

        {/* Date row — label + value like the reference */}
        {lifespan && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 7,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: isRoot ? 'rgba(255,255,255,0.35)' : '#bbbbbb',
            }}>
              {birthYear && deathYear ? 'Lifespan' : 'Born'}
            </span>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9,
              fontWeight: 500,
              color: isRoot ? 'rgba(255,255,255,0.75)' : '#444444',
              letterSpacing: '0.04em',
            }}>
              {lifespan}
            </span>
          </div>
        )}

        {node.birthPlace && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 7,
              color: isRoot ? 'rgba(255,255,255,0.3)' : '#cccccc',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 120,
            }}>
              {node.birthPlace.split(',').slice(-2).join(',').trim()}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
