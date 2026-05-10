import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to console for local debugging; nothing to send anywhere.
    console.error('App crashed', error, info);
  }

  reset = () => {
    this.setState({ error: null });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
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
        <div style={{ maxWidth: 520, textAlign: 'center' }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#ff1a0e',
            marginBottom: 10,
          }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 14, color: '#0a0a0a', marginBottom: 16 }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </div>
          <div style={{
            fontSize: 11,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: '#888888',
            background: '#f5f5f5',
            padding: 12,
            border: '1px solid #d8d8d8',
            wordBreak: 'break-word',
            marginBottom: 16,
            textAlign: 'left',
          }}>
            {this.state.error.message || String(this.state.error)}
          </div>
          <button
            onClick={this.reset}
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
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
