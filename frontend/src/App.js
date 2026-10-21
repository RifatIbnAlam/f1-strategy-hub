import React, { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import StrategySimulator from './components/StrategySimulator';
import DriverComparison from './components/DriverComparison';
import TelemetryViewer from './components/TelemetryViewer';
import ChampionshipHistory from './components/ChampionshipHistory';
import RaceFlow from './components/RaceFlow';
import UndercutAnalyzer from './components/UndercutAnalyzer';
import TeamOps from './components/TeamOps';
import ErrorBoundary from './components/ErrorBoundary';
import SnapshotBanner from './components/SnapshotBanner';
import {
  LayoutDashboard,
  GitCompare,
  Timer,
  Activity,
  Trophy,
  TrendingUp,
  ArrowDownUp,
  Wrench,
  Github,
  Menu,
  Moon,
  Sun,
  X,
} from 'lucide-react';

/* ─── Global Styles ─────────────────────────────────────────────────────────── */
const globalStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --app-bg: #0a0a12;
    --app-bg-elevated: #13132b;
    --app-bg-alt: #1a1a2e;
    --app-sidebar-bg: linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%);
    --panel-bg: linear-gradient(135deg, #13132b 0%, #1a1a2e 100%);
    --panel-solid: #13132b;
    --panel-border: rgba(255,255,255,0.06);
    --text-primary: #f6f7fb;
    --text-secondary: #c9ced8;
    --text-muted: #9399ad;
    --text-soft: #767d91;
    --input-bg: #0a0a12;
    --input-border: #33384a;
    --tooltip-bg: #1a1a2e;
    --surface-hover: rgba(255,255,255,0.08);
    --accent: #e10600;
    --accent-soft: rgba(225, 6, 0, 0.12);
    --accent-border: rgba(225, 6, 0, 0.18);
    --shadow-soft: 0 22px 50px rgba(0, 0, 0, 0.25);
    /* Text-safe variants: brand red and status colours tuned for contrast
       on this theme's panels (small text needs ~4.5:1). */
    --accent-text: #ff5249;
    --positive: #34d399;
    --positive-soft: rgba(52, 211, 153, 0.12);
    --warning: #f5c518;
    /* How much of a team colour survives when it's used for text; the rest
       is mixed toward --text-primary so every team stays readable. */
    --tone-strength: 82%;
  }
  [data-theme='light'] {
    --app-bg: #f4f0e8;
    --app-bg-elevated: #fffaf2;
    --app-bg-alt: #efe6d8;
    --app-sidebar-bg: linear-gradient(180deg, #fffaf2 0%, #f1e7d9 100%);
    --panel-bg: linear-gradient(135deg, #fffaf2 0%, #f6ecdf 100%);
    --panel-solid: #fffaf2;
    --panel-border: rgba(74, 51, 28, 0.14);
    --text-primary: #221a12;
    --text-secondary: #463425;
    --text-muted: #6b5038;
    --text-soft: #836343;
    --input-bg: #fff8ef;
    --input-border: #d8c6b1;
    --tooltip-bg: #fffaf2;
    --surface-hover: rgba(74, 51, 28, 0.10);
    --accent: #d33b0d;
    --accent-soft: rgba(211, 59, 13, 0.10);
    --accent-border: rgba(211, 59, 13, 0.18);
    --shadow-soft: 0 20px 45px rgba(98, 72, 40, 0.10);
    --accent-text: #b0300c;
    --positive: #0f7a46;
    --positive-soft: rgba(15, 122, 70, 0.10);
    --warning: #8a5a00;
    --tone-strength: 52%;
  }
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: var(--app-bg);
    color: var(--text-primary);
    overflow-x: hidden;
    transition: background 0.25s ease, color 0.25s ease;
  }
  /* Long <option> labels otherwise set a select's min width and push the page wider than a phone screen */
  select { max-width: 100%; min-width: 0; text-overflow: ellipsis; }
  a, button, input, select {
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--app-bg-alt); }
  ::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 3px; }
  ::selection { background: var(--accent); color: #fff; }

  /* Printing a strategy brief: only the brief, in dark-on-white. */
  @media print {
    body * { visibility: hidden; }
    .print-area, .print-area * { visibility: visible; color: #111 !important; }
    .print-area { position: absolute; left: 0; top: 0; width: 100%; border: none !important; background: #fff !important; box-shadow: none !important; }
    .no-print { display: none !important; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes slideIn {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 5px rgba(225, 6, 0, 0.3); }
    50% { box-shadow: 0 0 20px rgba(225, 6, 0, 0.6); }
  }
  .app-shell {
    display: flex;
    min-height: 100vh;
    background:
      radial-gradient(circle at top left, rgba(225, 6, 0, 0.07), transparent 28%),
      radial-gradient(circle at top right, rgba(39, 244, 210, 0.08), transparent 22%),
      var(--app-bg);
  }
  .app-sidebar {
    width: 240px;
    background: var(--app-sidebar-bg);
    border-right: 1px solid var(--accent-border);
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 100;
    transition: transform 0.3s ease;
    box-shadow: var(--shadow-soft);
  }
  .app-main {
    margin-left: 240px;
    flex: 1;
    min-width: 0;
    padding: 88px 32px 32px;
    min-height: 100vh;
    animation: fadeIn 0.3s ease;
  }
  .app-toolbar {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 220;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .toolbar-button {
    border: 1px solid var(--panel-border);
    background: var(--panel-bg);
    color: var(--text-primary);
    border-radius: 999px;
    padding: 10px 14px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: var(--shadow-soft);
    backdrop-filter: blur(12px);
  }
  .toolbar-button:hover {
    background: var(--surface-hover);
  }
  .mobile-overlay {
    display: none;
  }
  @media (max-width: 960px) {
    .app-sidebar {
      transform: translateX(-100%);
      width: min(82vw, 280px);
    }
    .app-sidebar.open {
      transform: translateX(0);
    }
    .app-main {
      margin-left: 0;
      padding: 88px 16px 24px;
    }
    .mobile-overlay {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(7, 10, 20, 0.48);
      backdrop-filter: blur(2px);
      z-index: 90;
    }
  }
`;

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'strategy', label: 'Strategy Sim', icon: Timer },
  { id: 'comparison', label: 'Driver Compare', icon: GitCompare },
  { id: 'telemetry', label: 'Telemetry', icon: Activity },
  { id: 'raceflow', label: 'Race Flow', icon: TrendingUp },
  { id: 'undercut', label: 'Pit Battles', icon: ArrowDownUp },
  { id: 'ops', label: 'Team Ops', icon: Wrench },
  { id: 'history', label: 'Championships', icon: Trophy },
];

// localStorage can throw (private mode, blocked storage); the theme is only a
// convenience, so fail quietly.
const storage = {
  get: (key) => { try { return window.localStorage.getItem(key); } catch (_) { return null; } },
  set: (key, value) => { try { window.localStorage.setItem(key, value); } catch (_) { /* ignore */ } },
};

// Hash routing (#/strategy) keeps views linkable and works on GitHub Pages
// without server-side rewrites.
const viewFromHash = () => {
  const id = window.location.hash.replace(/^#\/?/, '');
  return VIEWS.some(v => v.id === id) ? id : 'dashboard';
};

/* ─── Logo ──────────────────────────────────────────────────────────────────
 * A car line cutting under another: the undercut. Same mark as the favicon. */
const LogoMark = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff"
    strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h9" opacity="0.55" />
    <path d="M3 16h7c3 0 4-8 7-8h4" />
  </svg>
);

/* ─── App Component ─────────────────────────────────────────────────────────── */
export default function App() {
  const [activeView, setActiveViewState] = useState(viewFromHash);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const savedTheme = storage.get('f1-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 960);

  const setActiveView = (id) => {
    window.location.hash = id === 'dashboard' ? '' : `/${id}`;
    setActiveViewState(id);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const onHashChange = () => setActiveViewState(viewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const view = VIEWS.find(v => v.id === activeView);
    document.title = activeView === 'dashboard' ? 'Undercut · F1 Strategy Analytics' : `${view.label} · Undercut`;
  }, [activeView]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    storage.set('f1-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 960;
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false);
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const renderView = () => {
    switch (activeView) {
      case 'strategy': return <StrategySimulator />;
      case 'comparison': return <DriverComparison />;
      case 'telemetry': return <TelemetryViewer />;
      case 'raceflow': return <RaceFlow />;
      case 'undercut': return <UndercutAnalyzer />;
      case 'ops': return <TeamOps />;
      case 'history': return <ChampionshipHistory />;
      default: return <Dashboard />;
    }
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div className="app-shell">
        {isMobile && mobileMenuOpen && (
          <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
        )}

        <div className="app-toolbar">
          <button
            className="toolbar-button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
          </button>
          {isMobile && (
            <button
              className="toolbar-button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
        </div>

        {/* ── Sidebar ── */}
        <nav className={`app-sidebar${mobileMenuOpen ? ' open' : ''}`}>
          {/* Logo */}
          <div style={{
            padding: '24px 20px',
            borderBottom: '1px solid var(--accent-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40,
                background: 'linear-gradient(135deg, var(--accent) 0%, #ff6333 100%)',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(225, 6, 0, 0.4)',
              }}>
                <LogoMark size={22} />
              </div>
              <div>
                <div style={{
                  fontSize: 18, fontWeight: 900, color: 'var(--text-primary)',
                  letterSpacing: '1.5px', fontStyle: 'italic',
                }}>UNDERCUT</div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--accent-text)',
                  letterSpacing: '1px', whiteSpace: 'nowrap',
                }}>F1 STRATEGY ANALYTICS</div>
              </div>
            </div>
          </div>

          {/* Nav Items */}
          <div style={{ padding: '16px 12px', flex: 1 }}>
            {VIEWS.map(view => {
              const Icon = view.icon;
              const isActive = activeView === view.id;
              return (
                <button
                  key={view.id}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => { setActiveView(view.id); setMobileMenuOpen(false); }}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    marginBottom: 4,
                    background: isActive
                      ? 'linear-gradient(90deg, var(--accent-soft) 0%, transparent 100%)'
                      : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                    borderRadius: '0 8px 8px 0',
                    cursor: 'pointer',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--surface-hover)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }
                  }}
                >
                  <Icon size={18} />
                  {view.label}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--accent-border)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-soft)', marginBottom: 8 }}>
              POWERED BY
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>OpenF1 API</span>
              <span>Jolpica F1 API</span>
              <span>FastF1 Python</span>
            </div>
            <a
              href="https://github.com/RifatIbnAlam/f1-strategy-hub"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginTop: 16,
                padding: '8px 12px',
                background: 'var(--surface-hover)',
                borderRadius: 6,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontSize: 12,
                transition: 'all 0.2s ease',
              }}
            >
              <Github size={14} /> View on GitHub
            </a>
          </div>
        </nav>

        {/* ── Main Content ── */}
        <main className="app-main">
          <SnapshotBanner />
          <ErrorBoundary resetKey={activeView}>
            {renderView()}
          </ErrorBoundary>
        </main>
      </div>
    </>
  );
}
