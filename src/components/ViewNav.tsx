interface Props {
  current: 'tree' | 'timeline' | 'biographies';
  onNavigateRoute: (path: string) => void;
}

const ITEMS: { key: Props['current']; label: string; path: string }[] = [
  { key: 'tree',         label: 'Tree',         path: '/'            },
  { key: 'timeline',     label: 'Timeline',     path: '/timeline'    },
  { key: 'biographies',  label: 'Biographies',  path: '/biographies' },
];

export default function ViewNav({ current, onNavigateRoute }: Props) {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      {ITEMS.map(({ key, label, path }) => {
        const active = key === current;
        return (
          <button
            key={key}
            type="button"
            className="view-nav-btn focus-ring-light"
            onClick={() => { if (!active) onNavigateRoute(path); }}
            aria-current={active ? 'page' : undefined}
            disabled={active}
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: active ? '#ffffff' : '#aaaaaa',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: active ? 'default' : 'pointer',
              fontFamily: "'Inter', sans-serif",
              lineHeight: 1,
            }}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
