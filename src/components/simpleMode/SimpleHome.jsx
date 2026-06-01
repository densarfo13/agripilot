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

// Voice playback helper. Speaks the daily-plan voice prompt through Web
// Speech if available; falls back silently (fallbackVoiceSafe:true is the
// runtime contract). Records a SimpleVoicePlayed artifact regardless so
// the diagnostic can attest the listen button was used.
function _speakDailyVoicePrompt() {
  try {
    const prompt = tSafe('simple.home.voice.daily',
      'Today, check your plants. Tap Done after each step.');
    // Artifact log first — never depend on speech success.
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const KEY = 'farroway_simple_artifacts';
        const raw = window.localStorage.getItem(KEY);
        const list = (() => { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } })();
        list.push({ kind: 'SimpleVoicePlayed', idempotencyKey: `voice:home:${Date.now()}`, ts: Date.now() });
        const bounded = list.length > 500 ? list.slice(list.length - 500) : list;
        window.localStorage.setItem(KEY, JSON.stringify(bounded));
      }
    } catch { /* swallow */ }
    if (typeof window !== 'undefined' && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function') {
      const utt = new window.SpeechSynthesisUtterance(prompt);
      utt.rate = 0.95;
      window.speechSynthesis.speak(utt);
    }
  } catch { /* swallow — fallback is silent */ }
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

        {/* Listen button — voice-first surface. Reads the daily prompt
            aloud via the Web Speech API when available; falls back
            silently and still records a SimpleVoicePlayed artifact so
            the diagnostic can attest the surface was wired. */}
        <button
          type="button"
          onClick={_speakDailyVoicePrompt}
          style={S.listenBtn}
          data-testid="simple-home-listen"
          aria-label={tSafe('simple.home.listen.aria', 'Listen to today’s action')}
        >
          🔊 {tSafe('simple.home.listen', 'Listen')}
        </button>

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
  // Listen button — voice-first prominence; large tap target; calm chip
  // styling so it reads as an action rather than a chrome element.
  listenBtn: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.15rem',
    minHeight: 46,
    borderRadius: 999,
    border: '1px solid rgba(110,139,97,0.40)',
    background: 'rgba(110,139,97,0.10)',
    color: '#33503A',
    fontSize: '0.95rem',
    fontWeight: 700,
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
