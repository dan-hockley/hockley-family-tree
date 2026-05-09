import { motion, AnimatePresence } from 'framer-motion';
import type { Person, PersonDetail } from '../types';

interface Props {
  person: Person | null;
  detail: PersonDetail | null;
  personMap: Map<string, Person>;
  onClose: () => void;
  onNavigate: (id: string) => void;
  isMobile?: boolean;
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
    <svg width="8" height="8" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, display: 'block' }}>
      <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill="#ffffff" />
    </svg>
  );
}

function FamilyLink({
  id,
  personMap,
  onNavigate,
  fontSize,
}: {
  id: string;
  personMap: Map<string, Person>;
  onNavigate: (id: string) => void;
  fontSize: number;
}) {
  const p = personMap.get(id);
  if (!p) return null;
  return (
    <button
      onClick={() => onNavigate(id)}
      className="family-link"
      style={{
        fontFamily: "'Inter', sans-serif",
        fontSize,
        fontWeight: 600,
        color: '#0a0a0a',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'right',
      }}
    >
      {p.name}
    </button>
  );
}

function DataRow({
  label,
  children,
  valueSize,
  block = false,
}: {
  label: string;
  children: React.ReactNode;
  valueSize: number;
  block?: boolean;
}) {
  if (block) {
    return (
      <div style={{
        borderBottom: '1px solid #ececec',
        padding: '12px 0 14px',
      }}>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#aaaaaa',
          marginBottom: 8,
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 14,
          fontWeight: 400,
          fontStyle: 'normal',
          color: '#333333',
          textAlign: 'left',
          lineHeight: 1.55,
        }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      borderBottom: '1px solid #ececec',
      padding: '10px 0',
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <span style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: '#aaaaaa',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: valueSize,
        fontWeight: 600,
        color: '#0a0a0a',
        textAlign: 'right',
        minWidth: 0,
      }}>
        {children}
      </span>
    </div>
  );
}

export default function PersonSidebar({
  person,
  detail,
  personMap,
  onClose,
  onNavigate,
  isMobile = false,
}: Props) {
  const sidebarWidth = isMobile ? '100%' : 380;
  const headerNameSize = isMobile ? 32 : 44;
  const valueSize = isMobile ? 16 : 18;
  const linkSize = isMobile ? 16 : 20;

  return (
    <AnimatePresence>
      {person && (
        <>
          {/* Backdrop — fades in on desktop, hidden on mobile (sidebar fills screen) */}
          {!isMobile && (
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.2)',
                zIndex: 20,
              }}
            />
          )}

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
              height: '100dvh',
              width: sidebarWidth,
              maxWidth: '100vw',
              background: '#ffffff',
              borderLeft: isMobile ? 'none' : '2px solid #0a0a0a',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: "'Inter', sans-serif",
              boxShadow: isMobile ? 'none' : '-12px 0 32px rgba(0,0,0,0.08)',
            }}
          >
            {/* Header — black band */}
            <div
              style={{
                background: '#0a0a0a',
                borderBottom: '1px solid #1a1a1a',
                padding: isMobile ? '16px 16px 14px' : '20px 20px 18px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Star />
                    <span style={{
                      fontSize: 7,
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.4)',
                    }}>
                      Biography
                    </span>
                  </div>
                  <h2 style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: headerNameSize,
                    fontWeight: 800,
                    color: '#ffffff',
                    margin: 0,
                    lineHeight: 1.0,
                    letterSpacing: '-0.03em',
                    wordBreak: 'break-word',
                  }}>
                    {person.name}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="close-btn"
                  aria-label="Close"
                  style={{
                    color: 'rgba(255,255,255,0.4)',
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.15)',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: 'pointer',
                    lineHeight: 1,
                    width: isMobile ? 36 : 30,
                    height: isMobile ? 36 : 30,
                    flexShrink: 0,
                    fontFamily: "'Inter', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Body — single ruled list */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: isMobile ? '0 16px 24px' : '0 20px 24px',
              WebkitOverflowScrolling: 'touch',
            }}>
              <div style={{ marginTop: 8 }}>
                {person.birthDate && (
                  <DataRow label="Born" valueSize={valueSize}>
                    <span>{person.birthDate}</span>
                    {person.birthPlace && (
                      <span style={{ display: 'block', fontSize: 10, color: '#aaaaaa', marginTop: 2, fontWeight: 400 }}>
                        {person.birthPlace}
                      </span>
                    )}
                  </DataRow>
                )}
                {person.deathDate && (
                  <DataRow label="Died" valueSize={valueSize}>
                    <span>{person.deathDate}</span>
                    {person.deathPlace && (
                      <span style={{ display: 'block', fontSize: 10, color: '#aaaaaa', marginTop: 2, fontWeight: 400 }}>
                        {person.deathPlace}
                      </span>
                    )}
                  </DataRow>
                )}
                {person.fatherIds.map(id => (
                  <DataRow key={`f-${id}`} label="Father" valueSize={valueSize}>
                    <FamilyLink id={id} personMap={personMap} onNavigate={(id) => { onClose(); onNavigate(id); }} fontSize={linkSize} />
                  </DataRow>
                ))}
                {person.motherIds.map(id => (
                  <DataRow key={`m-${id}`} label="Mother" valueSize={valueSize}>
                    <FamilyLink id={id} personMap={personMap} onNavigate={(id) => { onClose(); onNavigate(id); }} fontSize={linkSize} />
                  </DataRow>
                ))}
                {person.spouseIds.map(id => (
                  <DataRow key={`s-${id}`} label="Spouse" valueSize={valueSize}>
                    <FamilyLink id={id} personMap={personMap} onNavigate={(id) => { onClose(); onNavigate(id); }} fontSize={linkSize} />
                  </DataRow>
                ))}
                {person.childIds.length > 0 && (
                  <DataRow label="Children" valueSize={valueSize}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                      {person.childIds.map(id => (
                        <FamilyLink key={id} id={id} personMap={personMap} onNavigate={(id) => { onClose(); onNavigate(id); }} fontSize={linkSize} />
                      ))}
                    </div>
                  </DataRow>
                )}
                {detail && detail.events.map((ev, i) => {
                  const labelText = eventLabel(ev.type, ev.description);
                  const isLongDescription = labelText.length > 28;
                  if (isLongDescription) {
                    return (
                      <DataRow key={`e-${i}`} label={ev.type} valueSize={valueSize} block>
                        <div style={{ fontWeight: 600, marginBottom: ev.date || ev.place ? 6 : 0 }}>
                          {labelText}
                        </div>
                        {(ev.date || ev.place) && (
                          <div style={{ fontSize: 11, color: '#888888', letterSpacing: '0.04em' }}>
                            {ev.date}{ev.date && ev.place ? ' · ' : ''}{ev.place}
                          </div>
                        )}
                        {ev.notes?.map((n, j) => (
                          <div key={j} style={{ marginTop: 8, fontSize: 13, color: '#444444', fontStyle: 'italic' }}>
                            {n}
                          </div>
                        ))}
                      </DataRow>
                    );
                  }
                  return (
                    <DataRow key={`e-${i}`} label={labelText} valueSize={valueSize}>
                      <span>{ev.date ?? ''}</span>
                      {ev.place && (
                        <span style={{ display: 'block', fontSize: 10, color: '#aaaaaa', marginTop: 2, fontWeight: 400 }}>
                          {ev.place}
                        </span>
                      )}
                      {ev.notes?.map((n, j) => (
                        <span key={j} style={{ display: 'block', fontSize: 10, color: '#888888', fontStyle: 'italic', marginTop: 2, fontWeight: 400 }}>
                          {n}
                        </span>
                      ))}
                    </DataRow>
                  );
                })}
                {detail && detail.notes.map((n, i) => (
                  <DataRow key={`n-${i}`} label="Note" valueSize={valueSize} block>
                    {n}
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
