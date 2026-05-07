/**
 * DashboardShell — permanent safe bootstrap wrapper for /today.
 *
 * Two layers of protection:
 *
 * 1. DashboardErrorBoundary (class-based) — catches any React render
 *    crash inside FarmerTodayPage and shows recovery cards. Never
 *    returns null or a blank screen.
 *
 * 2. Render watchdog (useEffect + 2s timer) — if the inner content
 *    still has zero text after 2 seconds (e.g. loading spinner with
 *    empty translation, invisible div, etc.) force-shows the safe
 *    fallback so the 4-second main.jsx watchdog never fires.
 *
 * Structure:
 *   <DashboardShell>
 *     <FarmerTodayPage />   ← or any dashboard child
 *   </DashboardShell>
 *
 * Rules:
 *   • NEVER returns null.
 *   • NEVER blocks children — fallback only fires when content is empty.
 *   • Inline styles only; no external CSS dependency.
 *   • All text is hardcoded ASCII — no translation dependency that
 *     could itself be loading.
 */

import { useEffect, useRef, useState } from 'react';
import DashboardErrorBoundary from './DashboardErrorBoundary.jsx';

// Safe fallback cards — shown when the watchdog detects empty content.
// Mirrors DashboardErrorBoundary's card grid so the farmer always sees
// the same reassuring "here is what we know" layout.
function DashboardFallback() {
  const handleReload = () => {
    try { window.location.reload(); } catch { /* swallow */ }
  };
  return (
    <div style={S.page} data-testid="dashboard-shell-fallback">
      <div style={S.container}>
        <div style={S.header}>
          <span style={S.brandDot} aria-hidden="true" />
          <span style={S.brand}>Farroway</span>
        </div>
        <h1 style={S.title}>Loading your dashboard</h1>
        <p style={S.subtitle}>
          We're getting your farm data ready.
        </p>

        {/* Safe status cards — always visible, no API dependency */}
        <div style={S.cardGrid}>
          <div style={S.card} data-testid="shell-fallback-setup">
            <span style={S.cardIcon} aria-hidden="true">🌱</span>
            <span style={S.cardLabel}>Setup</span>
            <span style={S.cardValue}>Continue setup</span>
            <a href="/profile/setup" style={S.cardLink}>Open →</a>
          </div>
          <div style={S.card} data-testid="shell-fallback-weather">
            <span style={S.cardIcon} aria-hidden="true">🌤️</span>
            <span style={S.cardLabel}>Weather</span>
            <span style={S.cardValue}>Unavailable</span>
            <span style={S.cardNote}>Loading…</span>
          </div>
          <div style={S.card} data-testid="shell-fallback-farm">
            <span style={S.cardIcon} aria-hidden="true">🚜</span>
            <span style={S.cardLabel}>Farm</span>
            <span style={S.cardValue}>No farm added yet</span>
            <a href="/farm/new" style={S.cardLink}>Add farm →</a>
          </div>
          <div style={S.card} data-testid="shell-fallback-tasks">
            <span style={S.cardIcon} aria-hidden="true">✅</span>
            <span style={S.cardLabel}>Tasks</span>
            <span style={S.cardValue}>Tasks loading</span>
            <span style={S.cardNote}>Please wait…</span>
          </div>
        </div>

        <div style={S.btnRow}>
          <button
            type="button"
            onClick={handleReload}
            style={S.btnPrimary}
            data-testid="shell-fallback-reload"
          >
            Reload page
          </button>
          <a href="/profile/setup" style={S.btnGhost} data-testid="shell-fallback-setup-link">
            Setup farm
          </a>
        </div>
      </div>
    </div>
  );
}

export default function DashboardShell({ children }) {
  // showFallback flips to true when the watchdog detects empty content.
  const [showFallback, setShowFallback] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    // 2-second watchdog — fires before the main.jsx 4-second gate.
    // Reads innerText length of the content div; if still zero, the
    // loading chain is stuck and we surface the safe fallback.
    const timer = setTimeout(() => {
      try {
        const el = contentRef.current;
        if (!el) return;
        const textLen = typeof el.innerText === 'string'
          ? el.innerText.trim().length
          : 0;
        const childCount = el.children ? el.children.length : 0;
        if (textLen === 0 && childCount === 0) {
          // eslint-disable-next-line no-console
          console.warn('[FARROWAY_SHELL] Empty content at 2s — showing safe fallback.');
          setShowFallback(true);
        }
      } catch { /* never throw from a watchdog */ }
    }, 2000);
    return () => clearTimeout(timer);
    // Run once on mount only — the watchdog is a one-shot safety net.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showFallback) {
    return <DashboardFallback />;
  }

  return (
    <DashboardErrorBoundary>
      <div ref={contentRef} style={{ minHeight: '100vh' }}>
        {children}
      </div>
    </DashboardErrorBoundary>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '2rem 1rem 4rem',
    boxSizing: 'border-box',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    maxWidth: '28rem',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.25rem',
  },
  brandDot: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#22C55E',
  },
  brand: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#22C55E',
    letterSpacing: '0.02em',
  },
  title: {
    margin: 0,
    fontSize: '1.375rem',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: 0,
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.5,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.625rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.875rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  cardIcon: { fontSize: '1.25rem' },
  cardLabel: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'rgba(255,255,255,0.5)',
  },
  cardValue: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#EAF2FF',
    lineHeight: 1.3,
  },
  cardNote: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.4)',
  },
  cardLink: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#22C55E',
    textDecoration: 'none',
  },
  btnRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginTop: '0.25rem',
  },
  btnPrimary: {
    padding: '0.875rem 1.25rem',
    borderRadius: '12px',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: '46px',
  },
  btnGhost: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.875rem 1.25rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: '46px',
    textDecoration: 'none',
  },
};
