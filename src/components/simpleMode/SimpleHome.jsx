/**
 * SimpleHome.jsx — full-screen Home renderer for Simple Mode.
 *
 * Renders ONLY: greeting + header actions (bell + menu) + Today's Action
 * (1 primary SimpleActionCard + up to 2 secondaries). No immersive hero,
 * no streak chip, no progress row, no analytics, no weather card. The
 * goal is an obvious visual difference from Standard Home.
 *
 * Home.jsx branches into this component when `useSimpleMode().enabled`
 * is true and skips the standard render entirely — there is no shared
 * renderer (per the differentiation spec).
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import NotificationBell from '../NotificationBell.jsx';
import SimpleModeHomeSection from './SimpleModeHomeSection.jsx';

function _greeting() {
  try {
    const h = new Date().getHours();
    if (h < 12) return tSafe('home.greeting.morning', 'Good morning');
    if (h < 18) return tSafe('home.greeting.afternoon', 'Good afternoon');
    return tSafe('home.greeting.evening', 'Good evening');
  } catch { return tSafe('home.greeting.default', 'Welcome'); }
}

function SimpleHomeInner() {
  return (
    <div style={S.page} data-testid="simple-home" data-renderer="simple">
      <div style={S.shell}>
        <header style={S.header}>
          <div>
            <p style={S.greeting}>{_greeting()}.</p>
            <h1 style={S.title}>{tSafe('simple.home.eyebrow', "Today's Action")}</h1>
          </div>
          <div style={S.headerActions} data-testid="home-header-actions">
            <NotificationBell ariaLabel="Notifications" testId="simple-home-bell" />
            <Link
              to="/settings"
              aria-label="Menu"
              style={S.menuBtn}
              data-testid="simple-home-menu"
            >
              <span aria-hidden="true">☰</span>
            </Link>
          </div>
        </header>

        {/* Today's Action — 1 primary + up to 2 secondaries. Self-contained
            and error-boundary-guarded internally. */}
        <SimpleModeHomeSection />

        <p style={S.footnote}>
          {tSafe('simple.home.footnote',
            'Big buttons. Short steps. Tap Done when you finish.')}
        </p>
      </div>
    </div>
  );
}

// Error boundary — never let a render fault drop the user to a blank screen.
export default class SimpleHome extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) {
      return (
        <main style={S.page} data-testid="simple-home-fallback">
          <div style={S.shell}>
            <h1 style={S.title}>{tSafe('simple.home.fallback.title', "Today's Action")}</h1>
            <p style={S.footnote}>
              {tSafe('simple.home.fallback.body',
                'Open the app menu to see your plan.')}
            </p>
          </div>
        </main>
      );
    }
    try { return <SimpleHomeInner />; } catch { return null; }
  }
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#FAF7F0',
    color: '#2C3A26',
    fontFamily: 'system-ui',
    padding: '20px 16px 96px',
  },
  shell: {
    maxWidth: 560,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  greeting: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: 'rgba(60,72,55,0.72)',
  },
  title: {
    margin: '0.25rem 0 0',
    fontSize: '1.75rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  headerActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    flexShrink: 0,
  },
  menuBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'rgba(110,139,97,0.10)',
    border: '1px solid rgba(110,139,97,0.30)',
    color: '#33503A',
    fontSize: '1.05rem',
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  footnote: {
    margin: '1.2rem 0 0',
    fontSize: '0.84rem',
    color: 'rgba(60,72,55,0.62)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
};
