import { useState, useEffect, useCallback } from 'react';
import { loadGedcom } from './lib/gedcom';
import type { Person, PersonDetail } from './types';
import FamilyTree from './components/FamilyTree';
import Timeline from './components/Timeline';
import Biographies from './components/Biographies';
import ErrorBoundary from './components/ErrorBoundary';

const GEDCOM_URL = '/hockley-2024.ged';
const FETCH_TIMEOUT_MS = 30000;

interface LoadState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  persons: Person[];
  details: Map<string, PersonDetail>;
  exportDate: string | null;
}

function readLocation() {
  if (typeof window === 'undefined') return { path: '/', rootId: null as string | null };
  return {
    path: window.location.pathname,
    rootId: new URLSearchParams(window.location.search).get('p'),
  };
}

export default function App() {
  const [state, setState] = useState<LoadState>({
    status: 'loading',
    persons: [],
    details: new Map(),
    exportDate: null,
  });
  const [{ path, rootId }, setLocation] = useState(readLocation());

  const loadData = useCallback(() => {
    setState(s => ({ ...s, status: 'loading', error: undefined }));
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    loadGedcom(GEDCOM_URL, { signal: ctrl.signal })
      .then(({ persons, details, exportDate }) => {
        clearTimeout(timeout);
        setState({ status: 'ready', persons, details, exportDate });
      })
      .catch(err => {
        clearTimeout(timeout);
        const msg = err?.name === 'AbortError'
          ? 'Loading took too long. Check your connection and try again.'
          : String(err?.message ?? err);
        setState(s => ({ ...s, status: 'error', error: msg }));
      });
    return () => { clearTimeout(timeout); ctrl.abort(); };
  }, []);

  useEffect(() => {
    return loadData();
  }, [loadData]);

  useEffect(() => {
    function onPop() { setLocation(readLocation()); }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /**
   * Update the URL. Pass `keepRoot: false` to drop the ?p= param when
   * navigating to a different view fresh (default keeps it so the same
   * person stays focal across views).
   */
  const navigate = useCallback((newPath: string, opts?: { rootId?: string | null; keepRoot?: boolean }) => {
    const current = readLocation();
    const targetPath = newPath ?? current.path;
    const targetRoot = opts?.rootId !== undefined
      ? opts.rootId
      : (opts?.keepRoot === false ? null : current.rootId);

    const params = new URLSearchParams();
    if (targetRoot) params.set('p', targetRoot);
    const search = params.toString();
    const url = search ? `${targetPath}?${search}` : targetPath;

    if (url === window.location.pathname + window.location.search) return;
    window.history.pushState({}, '', url);
    setLocation({ path: targetPath, rootId: targetRoot });
  }, []);

  const navigateRoute = useCallback((newPath: string) => {
    navigate(newPath);
  }, [navigate]);

  // Title click — return to the tree centered on the default root (Daniel).
  const goHome = useCallback(() => {
    navigate('/', { rootId: null });
  }, [navigate]);

  const setRoot = useCallback((personId: string) => {
    navigate(window.location.pathname, { rootId: personId });
  }, [navigate]);

  const openInTree = useCallback((personId: string) => {
    navigate('/', { rootId: personId });
  }, [navigate]);

  if (state.status === 'loading') {
    return <LoadingScreen />;
  }

  if (state.status === 'error') {
    return <ErrorScreen message={state.error ?? 'Failed to load family data.'} onRetry={loadData} />;
  }

  const { persons, details, exportDate } = state;

  let view;
  if (path === '/timeline') {
    view = (
      <Timeline
        persons={persons}
        details={details}
        rootId={rootId}
        exportDate={exportDate}
        onNavigateRoute={navigateRoute}
        onSetRoot={setRoot}
        onGoHome={goHome}
      />
    );
  } else if (path === '/biographies') {
    view = (
      <Biographies
        persons={persons}
        details={details}
        exportDate={exportDate}
        onNavigateRoute={navigateRoute}
        onOpenInTree={openInTree}
        onGoHome={goHome}
      />
    );
  } else {
    view = (
      <FamilyTree
        persons={persons}
        details={details}
        rootId={rootId}
        exportDate={exportDate}
        onNavigateRoute={navigateRoute}
        onSetRoot={setRoot}
        onGoHome={goHome}
      />
    );
  }

  return <ErrorBoundary>{view}</ErrorBoundary>;
}

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100dvh',
      background: '#ffffff',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#aaaaaa',
        }}>
          Loading family records
        </span>
        <div style={{
          width: 80,
          height: 1,
          background: '#ececec',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div className="loading-bar" style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 32,
            height: 1,
            background: '#0a0a0a',
          }} />
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
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
          marginBottom: 10,
        }}>
          Could not load
        </div>
        <div style={{ fontSize: 14, color: '#0a0a0a', marginBottom: 16 }}>
          {message}
        </div>
        <button
          onClick={onRetry}
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#ffffff',
            background: '#0a0a0a',
            border: '1px solid #0a0a0a',
            padding: '10px 18px',
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            borderRadius: 0,
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
