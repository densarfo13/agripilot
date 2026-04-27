/**
 * QuickStart — one-screen, frictionless onboarding for low-
 * literacy farmers.
 *
 *   "Welcome to Farroway"
 *   [globe icon]                          (top-right)
 *   --------------------------------------------------------
 *           [ START FARMING (big green button) ]
 *
 * One tap creates a default farm, marks onboarding done, persists
 * the auto-detected country, and lands the user on /tasks. No
 * dropdowns. No multi-step wizard. Voice gets fired ONCE on the
 * /tasks page right after the navigate so the farmer hears today's
 * task without having to read.
 *
 * Strict rules respected:
 *   * Existing OnboardingV3 / FastOnboarding routes stay intact.
 *   * Reduces steps to ONE explicit tap.
 *   * Inline styles match the codebase (no Tailwind dep).
 *   * Defends against every async failure: country detection /
 *     farm save / language save - all wrapped, all swallow.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { startFarmingNow } from '../../utils/quickOnboarding.js';
import QuickLanguageModal from '../../components/QuickLanguageModal.jsx';

export default function QuickStart() {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const [langOpen, setLangOpen] = useState(false);

  async function handleStart() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await startFarmingNow({ language: lang });
      navigate('/tasks', { replace: true });
    } catch {
      // startFarmingNow itself swallows everything; if we got here
      // something truly unexpected happened. Show a small retry hint
      // and leave the user on the welcome screen.
      setError(tSafe('quickStart.error.retry',
        'Something didn\u2019t work. Tap again to try.'));
      setBusy(false);
    }
  }

  return (
    <main style={S.page} data-testid="quick-start-page">
      {/* Top bar - just the language icon */}
      <header style={S.topBar}>
        <button
          type="button"
          onClick={() => setLangOpen(true)}
          style={S.langBtn}
          aria-label={tSafe('quickStart.changeLanguage', 'Change language')}
          data-testid="quick-start-lang"
        >
          <span style={S.langIcon} aria-hidden="true">{'\uD83C\uDF0D'}</span>
        </button>
      </header>

      {/* Main column */}
      <section style={S.main}>
        <div style={S.brandRow}>
          <span style={S.brandLogo} aria-hidden="true">{'\uD83C\uDF31'}</span>
          <span style={S.brandName}>Farroway</span>
        </div>
        <h1 style={S.h1}>
          {tSafe('quickStart.welcome', 'Welcome to Farroway')}
        </h1>
        <p style={S.lede}>
          {tSafe('quickStart.lede',
            'One tap to start. We\u2019ll handle the setup.')}
        </p>

        <button
          type="button"
          onClick={handleStart}
          disabled={busy}
          style={{ ...S.cta, ...(busy ? S.ctaBusy : null) }}
          aria-busy={busy}
          data-testid="quick-start-cta"
        >
          {busy
            ? tSafe('quickStart.starting', 'Starting\u2026')
            : tSafe('quickStart.cta', 'Start farming')}
        </button>

        {error && (
          <p style={S.error} role="status" aria-live="polite">
            {error}
          </p>
        )}
      </section>

      <QuickLanguageModal
        open={langOpen}
        onClose={() => setLangOpen(false)}
        currentLang={lang}
      />
    </main>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '0.875rem 1rem 0',
  },
  langBtn: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#EAF2FF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
  },
  langIcon: { fontSize: '1.5rem', lineHeight: 1 },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.25rem',
    padding: '2rem 1.5rem 4rem',
    textAlign: 'center',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  brandLogo: { fontSize: '2rem', lineHeight: 1 },
  brandName: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#22C55E',
    letterSpacing: '0.02em',
  },
  h1: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 800,
    color: '#F8FAFC',
    lineHeight: 1.15,
  },
  lede: {
    margin: 0,
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.5,
    maxWidth: '24rem',
  },
  cta: {
    marginTop: '1rem',
    width: '100%',
    maxWidth: '22rem',
    padding: '1.125rem 1.25rem',
    minHeight: '64px',
    borderRadius: '20px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '1.125rem',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 10px 28px rgba(34,197,94,0.25)',
    WebkitTapHighlightColor: 'transparent',
    transition: 'transform 0.08s ease, opacity 0.15s ease',
  },
  ctaBusy: {
    opacity: 0.7,
    cursor: 'wait',
  },
  error: {
    margin: '0.5rem 0 0',
    fontSize: '0.875rem',
    color: '#FCA5A5',
    maxWidth: '22rem',
  },
};
