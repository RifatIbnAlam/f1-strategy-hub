import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import StrategySimulator from './components/StrategySimulator';
import DriverComparison from './components/DriverComparison';
import TelemetryViewer from './components/TelemetryViewer';
import ChampionshipHistory from './components/ChampionshipHistory';
import {
  LayoutDashboard,
  GitCompare,
  Timer,
  Activity,
  Trophy,
  Github,
  Gauge,
  Menu,
  X,
} from 'lucide-react';

/* ─── Global Styles ─────────────────────────────────────────────────────────── */
const globalStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: #0a0a12;
    color: #e0e0e0;
    overflow-x: hidden;
  }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #1a1a2e; }
  ::-webkit-scrollbar-thumb { background: #e10600; border-radius: 3px; }
  ::selection { background: #e10600; color: #fff; }

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
`;

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'strategy', label: 'Strategy Sim', icon: Timer },
  { id: 'comparison', label: 'Driver Compare', icon: GitCompare },
  { id: 'telemetry', label: 'Telemetry', icon: Activity },
  { id: 'history', label: 'Championships', icon: Trophy },
];

/* ─── App Component ─────────────────────────────────────────────────────────── */
export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderView = () => {
    switch (activeView) {
      case 'strategy': return <StrategySimulator />;
      case 'comparison': return <DriverComparison />;
      case 'telemetry': return <TelemetryViewer />;
      case 'history': return <ChampionshipHistory />;
      default: return <Dashboard />;
    }
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* ── Sidebar ── */}
        <nav style={{
          width: mobileMenuOpen ? 240 : 240,
          background: 'linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%)',
          borderRight: '1px solid rgba(225, 6, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: 100,
          transition: 'transform 0.3s ease',
          transform: mobileMenuOpen ? 'translateX(0)' : undefined,
        }}>
          {/* Logo */}
          <div style={{
            padding: '24px 20px',
            borderBottom: '1px solid rgba(225, 6, 0, 0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40,
                background: 'linear-gradient(135deg, #e10600 0%, #ff3333 100%)',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(225, 6, 0, 0.4)',
              }}>
                <Gauge size={22} color="#fff" />
              </div>
              <div>
                <div style={{
                  fontSize: 16, fontWeight: 800, color: '#fff',
                  letterSpacing: '-0.5px',
                }}>F1 STRATEGY</div>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: '#e10600',
                  letterSpacing: '2px',
                }}>ANALYTICS HUB</div>
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
                  onClick={() => { setActiveView(view.id); setMobileMenuOpen(false); }}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    marginBottom: 4,
                    background: isActive
                      ? 'linear-gradient(90deg, rgba(225, 6, 0, 0.15) 0%, transparent 100%)'
                      : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '3px solid #e10600' : '3px solid transparent',
                    borderRadius: '0 8px 8px 0',
                    cursor: 'pointer',
                    color: isActive ? '#fff' : '#888',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.target.style.background = 'rgba(255,255,255,0.05)';
                      e.target.style.color = '#ccc';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.target.style.background = 'transparent';
                      e.target.style.color = '#888';
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
            borderTop: '1px solid rgba(225, 6, 0, 0.1)',
          }}>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>
              POWERED BY
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#777' }}>
              <span>OpenF1 API</span>
              <span>Jolpica F1 API</span>
              <span>FastF1 Python</span>
            </div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginTop: 16,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 6,
                color: '#aaa',
                textDecoration: 'none',
                fontSize: 12,
                transition: 'all 0.2s ease',
              }}
            >
              <Github size={14} /> View on GitHub
            </a>
          </div>
        </nav>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            position: 'fixed', top: 16, right: 16,
            zIndex: 200,
            background: '#1a1a2e',
            border: '1px solid rgba(225, 6, 0, 0.3)',
            borderRadius: 8,
            padding: 8,
            cursor: 'pointer',
            color: '#fff',
            display: 'none', // Show with media query if needed
          }}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* ── Main Content ── */}
        <main style={{
          marginLeft: 240,
          flex: 1,
          padding: '24px 32px',
          minHeight: '100vh',
          animation: 'fadeIn 0.3s ease',
        }}>
          {renderView()}
        </main>
      </div>
    </>
  );
}
