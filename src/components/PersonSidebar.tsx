import { motion, AnimatePresence } from 'framer-motion';
import type { Person, PersonDetail } from '../types';

interface Props {
  person: Person | null;
  detail: PersonDetail | null;
  personMap: Map<string, Person>;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

const EVENT_LABELS: Record<string, string> = {
  BIRT: 'Birth', DEAT: 'Death', BURI: 'Burial', BAPM: 'Baptism',
  MARR: 'Marriage', DIV: 'Divorce', EMIG: 'Emigration', IMMI: 'Immigration',
  NATU: 'Naturalization', CENS: 'Census', RESI: 'Residence', EVEN: 'Event',
  OCCU: 'Occupation', EDUC: 'Education', GRAD: 'Graduation', MILI: 'Military service',
  PROB: 'Probate', WILL: 'Will', ADOP: 'Adoption', CHR: 'Christening',
  CONF: 'Confirmation', FCOM: 'First communion',
};

function eventLabel(type: string, description?: string) {
  return description || EVENT_LABELS[type] || type;
}

function Star() {
  return (
    <svg width="8" height="8" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, display: 'inline-block' }}>
      <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill="#ffffff" />
    </svg>
  );
}

function FamilyLink({ id, personMap, onNavigate }: { id: string; personMap: Map<string, Person>; onNavigate: (id: string) => void }) {
  const p = personMap.get(id);
  if (!p) return null;
  return (
    <button
      onClick={() => onNavigate(id)}
      style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 20,
        fontWeight: 600,
        color: '#0a0a0a',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
        textDecoration: 'underline',
        textDecorationColor: '#d8d8d8',
        textUnderlineOffset: 3,
      }}
      onMouseEnter={e => (e.currentTarget.style.textDecorationColor = '#0a0a0a')}
      onMouseLeave={e => (e.currentTarget.style.textDecorationColor = '#d8d8d8')}
    >
      {p.name}
    </button>
  );
}

// Label + value row with bottom rule — like the "Place / WETZLAR, GERMANY +" rows in the reference
function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid #ececec', padding: '9px 0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#aaaaaa', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 600, color: '#0a0a0a', textAlign: 'right' }}>
        {children}
      </span>
    </div>
  );
}

export default function PersonSidebar({ person, detail, personMap, onClose, onNavigate }: Props) {
  return (
    <AnimatePresence>
      {person && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20"
            onClick={onClose}
          />

          <motion.aside
            key="sidebar"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              height: '100%',
              width: 380,
              background: '#ffffff',
              borderLeft: '2px solid #0a0a0a',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {/* Header — black band */}
            <div
              style={{
                background: '#0a0a0a',
                borderBottom: '1px solid #1a1a1a',
                padding: '20px 20px 18px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Star + label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Star />
                    <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                      Biography
                    </span>
                  </div>
                  <h2 style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 44,
                    fontWeight: 800,
                    color: '#ffffff',
                    margin: 0,
                    lineHeight: 1.0,
                    letterSpacing: '-0.03em',
                  }}>
                    {person.name}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    color: 'rgba(255,255,255,0.4)',
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.15)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    lineHeight: 1,
                    padding: '5px 8px',
                    flexShrink: 0,
                    letterSpacing: '0.06em',
                    marginLeft: 12,
                    marginTop: 2,
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onMouseEnter={e => { (e.currentTarget.style.color = '#ffffff'); (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'); }}
                  onMouseLeave={e => { (e.currentTarget.style.color = 'rgba(255,255,255,0.4)'); (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'); }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Body — single flat list, one rule style only */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
              <div style={{ marginTop: 8 }}>

                {person.birthDate && (
                  <DataRow label="Born">
                    <span>{person.birthDate}</span>
                    {person.birthPlace && <span style={{ display: 'block', fontSize: 10, color: '#aaaaaa', marginTop: 1 }}>{person.birthPlace}</span>}
                  </DataRow>
                )}
                {person.deathDate && (
                  <DataRow label="Died">
                    <span>{person.deathDate}</span>
                    {person.deathPlace && <span style={{ display: 'block', fontSize: 10, color: '#aaaaaa', marginTop: 1 }}>{person.deathPlace}</span>}
                  </DataRow>
                )}
                {person.fatherIds.map(id => (
                  <DataRow key={id} label="Father">
                    <FamilyLink id={id} personMap={personMap} onNavigate={id => { onClose(); onNavigate(id); }} />
                  </DataRow>
                ))}
                {person.motherIds.map(id => (
                  <DataRow key={id} label="Mother">
                    <FamilyLink id={id} personMap={personMap} onNavigate={id => { onClose(); onNavigate(id); }} />
                  </DataRow>
                ))}
                {person.spouseIds.map(id => (
                  <DataRow key={id} label="Spouse">
                    <FamilyLink id={id} personMap={personMap} onNavigate={id => { onClose(); onNavigate(id); }} />
                  </DataRow>
                ))}
                {person.childIds.length > 0 && (
                  <DataRow label="Children">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                      {person.childIds.map(id => (
                        <FamilyLink key={id} id={id} personMap={personMap} onNavigate={id => { onClose(); onNavigate(id); }} />
                      ))}
                    </div>
                  </DataRow>
                )}
                {detail && detail.events.map((ev, i) => (
                  <DataRow key={i} label={eventLabel(ev.type, ev.description)}>
                    <span>{ev.date ?? ''}</span>
                    {ev.place && <span style={{ display: 'block', fontSize: 10, color: '#aaaaaa', marginTop: 1 }}>{ev.place}</span>}
                    {ev.notes?.map((n, j) => (
                      <span key={j} style={{ display: 'block', fontSize: 10, color: '#888888', fontStyle: 'italic', marginTop: 2 }}>{n}</span>
                    ))}
                  </DataRow>
                ))}
                {detail && detail.notes.map((n, i) => (
                  <DataRow key={i} label="Note">
                    <span style={{ fontStyle: 'italic', color: '#555555' }}>{n}</span>
                  </DataRow>
                ))}

              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
