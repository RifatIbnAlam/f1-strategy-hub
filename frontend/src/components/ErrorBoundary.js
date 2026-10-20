import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Keeps one broken view (e.g. an unexpected API payload) from blanking the
 * whole app. Reset by changing `resetKey` (the active view id).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        background: 'var(--panel-bg)', border: '1px solid var(--accent-border)', borderRadius: 12,
        padding: 32, display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <AlertCircle size={20} color="var(--accent)" />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>This view hit an error</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {String(this.state.error.message || this.state.error)}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 12, padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
              background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--text-primary)',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
