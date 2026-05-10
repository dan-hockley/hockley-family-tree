import { useState, useEffect } from 'react';
import { loadGedcom } from './lib/gedcom';
import type { Person, PersonDetail } from './types';
import FamilyTree from './components/FamilyTree';
import Timeline from './components/Timeline';

export default function App() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [details, setDetails] = useState<Map<string, PersonDetail>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    loadGedcom('/hockley-2024.ged')
      .then(({ persons, details }) => {
        setPersons(persons);
        setDetails(details);
        setLoading(false);
      })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, []);

  useEffect(() => {
    function onPop() { setPath(window.location.pathname); }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigateRoute(newPath: string) {
    if (newPath === path) return;
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        background: '#ffffff',
        fontFamily: "'Inter', sans-serif",
      }}>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#aaaaaa',
        }}>
          Loading
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        background: '#ffffff',
        padding: 24,
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#ff1a0e',
            marginBottom: 8,
          }}>
            Error
          </div>
          <div style={{
            fontSize: 14,
            color: '#0a0a0a',
            marginBottom: 12,
          }}>
            Failed to load family data.
          </div>
          <div style={{
            fontSize: 11,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: '#888888',
            background: '#f5f5f5',
            padding: 12,
            border: '1px solid #d8d8d8',
            wordBreak: 'break-word',
          }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (path === '/timeline') {
    return <Timeline persons={persons} details={details} onNavigateRoute={navigateRoute} />;
  }

  return <FamilyTree persons={persons} details={details} onNavigateRoute={navigateRoute} />;
}
