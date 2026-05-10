import { useState } from 'react';
import { motion } from 'framer-motion';
import type { TreeNode } from '../types';
import { NODE_W } from '../lib/pedigree';
import { computeAge } from '../lib/age';

interface Props {
  node: TreeNode;
  isRoot: boolean;
  hasNotes?: boolean;
  onSelect: (id: string) => void;
  onOpenNotes?: (id: string) => void;
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

function Star({ size = 10, color = '#0a0a0a' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, display: 'block' }}>
      <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill={color} />
    </svg>
  );
}

export default function PersonNode({ node, isRoot, hasNotes, onSelect, onOpenNotes }: Props) {
  const [hovered, setHovered] = useState(false);
  const colorKey = Math.min(node.generation, 4);
  const genColor = GENERATION_COLORS[colorKey] ?? GENERATION_COLORS[4];
  const genLabel = GENERATION_LABELS[colorKey] ?? 'Ancestor';
  const birthYear = formatYear(node.birthDate);
  const deathYear = formatYear(node.deathDate);
  const age = computeAge(node);
  const baseLifespan = birthYear ? (deathYear ? `${birthYear}–${deathYear}` : `b. ${birthYear}`) : null;
  const lifespan = baseLifespan && age ? `${baseLifespan} · a. ${age.value}` : baseLifespan;

  const showLabel = node.generation !== 0 || node.role === 'sibling' || node.role === 'spouse';
  let labelText: string | null = null;
  let labelColor = '#aaaaaa';
  let hoverColor = '#0a0a0a';
  if (node.generation === 0) {
    if (node.role === 'sibling') labelText = 'Sibling';
    else if (node.role === 'spouse') labelText = 'Spouse';
    // Sibling/Spouse hover stays black
  } else {
    labelText = genLabel;
    labelColor = genColor;
    hoverColor = genColor;
  }

  // When hovered (not root), swap to filled color with white text
  const filled = isRoot || hovered;
  const fillBg = isRoot ? '#0a0a0a' : hoverColor;

  return (
    <motion.div
      layoutId={node.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onClick={() => onSelect(node.id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(node.id);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`person-card focus-ring ${isRoot ? 'is-root' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${node.name}${node.birthDate ? `, born ${node.birthDate}` : ''}`}
      style={{
        position: 'absolute',
        cursor: 'pointer',
        userSelect: 'none',
        width: NODE_W,
        left: node.x,
        top: node.y,
        background: filled ? fillBg : '#ffffff',
        border: `1px solid ${filled ? fillBg : '#d8d8d8'}`,
        borderTop: isRoot
          ? '3px solid #0a0a0a'
          : (hovered ? `1px solid ${fillBg}` : '1px solid #d8d8d8'),
        borderRadius: 0,
        padding: '10px 12px',
        boxShadow: '0 0 30px #cccccc',
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      {/* Top row: star + label + (optional) notes indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7, minHeight: 8 }}>
        <Star size={7} color={filled ? '#ffffff' : '#0a0a0a'} />
        {showLabel && labelText && (
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: filled ? '#ffffff' : labelColor,
            lineHeight: 1,
          }}>
            {labelText}
          </span>
        )}
        {hasNotes && (
          <button
            onClick={e => {
              e.stopPropagation();
              onOpenNotes?.(node.id);
            }}
            onMouseDown={e => e.stopPropagation()}
            aria-label="View notes"
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              padding: '1px 2px',
              border: `1px solid ${filled ? 'rgba(255,255,255,0.55)' : '#bbbbbb'}`,
              borderRadius: 2,
              background: 'transparent',
              cursor: 'pointer',
              lineHeight: 0,
            }}
          >
            {[0, 1, 2].map(i => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 1,
                  background: filled ? '#ffffff' : '#999999',
                  display: 'block',
                }}
              />
            ))}
          </button>
        )}
      </div>

      {/* Given name */}
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          fontSize: 22,
          color: filled ? '#ffffff' : '#0a0a0a',
          lineHeight: 1.25,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.02em',
        }}
      >
        {node.givenName || node.name}
      </div>

      {/* Surname */}
      {node.surname && (
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 8,
            color: filled ? 'rgba(255,255,255,0.75)' : '#888888',
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

      {/* Rule + date row */}
      {lifespan && (
        <>
          <div style={{
            borderTop: `1px solid ${filled ? 'rgba(255,255,255,0.25)' : '#ececec'}`,
            marginTop: 8,
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 7,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: filled ? 'rgba(255,255,255,0.55)' : '#bbbbbb',
            }}>
              {birthYear && deathYear ? 'Lifespan' : 'Born'}
            </span>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9,
              fontWeight: 500,
              color: filled ? '#ffffff' : '#444444',
              letterSpacing: '0.04em',
            }}>
              {lifespan}
            </span>
          </div>
        </>
      )}

      {node.birthPlace && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 7,
            color: filled ? 'rgba(255,255,255,0.55)' : '#cccccc',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 130,
          }}>
            {node.birthPlace.split(',').slice(-2).join(',').trim()}
          </span>
        </div>
      )}
    </motion.div>
  );
}
