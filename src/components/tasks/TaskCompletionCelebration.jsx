/**
 * TaskCompletionCelebration — calm "you've done enough today"
 * surface that replaces the legacy "Back to Home" empty state on
 * the Tasks page when the user is caught up.
 *
 *   <TaskCompletionCelebration
 *     mode="farm"
 *     completedCount={2}
 *     weather={liveWeather}
 *     tomorrowPreview="Check lower leaves after rainfall."
 *     onCta={() => navigate('/home')}
 *   />
 *
 * Spec contract (May 2026 Tasks refinement)
 *   §3 — small completion celebration area (NOT a giant bar)
 *   §4 — empty state with subtle weather glow, minimal text
 *   §5 — CTA reinforces tomorrow's daily-habit loop
 *   §6 — one weather-aware reassurance only
 *   §7 — restrained environmental atmosphere (CSS only)
 *   §9 — Farm vs Garden differentiation
 *   §11 — small tomorrow preview line
 *
 * Visual structure
 *   ┌─────────────────────────────────────────────┐
 *   │            ⬤ leaf glyph (green halo)        │
 *   │                                             │
 *   │     2 tasks completed today                 │
 *   │                                             │
 *   │  Your crops are prepared for tonight's rain.│
 *   │                                             │
 *   │  Tomorrow:                                  │
 *   │  Check lower leaves after rainfall.         │
 *   │                                             │
 *   │       [ See tomorrow's outlook → ]          │
 *   └─────────────────────────────────────────────┘
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Inline styles only. CSS pulse animation defined inline
 *     via @keyframes already present in src/index.css.
 *   • All visible text via tSafe with English fallbacks.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';

// Pick ONE weather-aware reassurance line based on the current
// weather context. Pure function; returns a single localised
// sentence so the celebration card never stacks signals.
function _resolveReassurance(weather, isGarden) {
  const w = (weather && typeof weather === 'object') ? weather : {};
  const cond = String(w.condition || '').toLowerCase();
  const rainPct = Number(w.rainChance);
  const temp = Number(w.temp);

  // Rain-prepared (most contextual)
  if (cond.includes('rain') || (Number.isFinite(rainPct) && rainPct >= 60)) {
    return isGarden
      ? tSafe('tasks.weatherPreparedRainGarden', 'Your plants are prepared for tonight’s rain.')
      : tSafe('tasks.weatherPreparedRainFarm',   'Your crops are prepared for tonight’s rain.');
  }
  // Heat-prepared
  if (Number.isFinite(temp) && temp >= 32) {
    return isGarden
      ? tSafe('tasks.weatherPreparedHeatGarden', 'Watering completed before peak heat.')
      : tSafe('tasks.weatherPreparedHeatFarm',   'Field checks done before midday heat.');
  }
  // Generic (default)
  return isGarden
    ? tSafe('tasks.everythingLooksGood', 'Your plants are doing well today.')
    : tSafe('tasks.readyForTomorrow',    'Your fields are ready for tomorrow.');
}

function _completionLine(count, isGarden) {
  if (count >= 2) {
    return tSafe(
      'tasks.completedTodayN',
      `${count} tasks completed today`,
    ).replace(/\{count\}/g, String(count));
  }
  if (count === 1) {
    return tSafe('tasks.completedTodayOne', '1 task completed today');
  }
  return isGarden
    ? tSafe('tasks.allCaughtUpGarden', 'You’re all caught up.')
    : tSafe('tasks.allCaughtUpFarm',   'You’re all caught up.');
}

function _leafIcon() {
  // Soft Ochre + growth-green leaf — radial halo created by the
  // wrapper, glyph itself stays calm and crisp.
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <path d="M17 31V17" stroke="#3F6A3F" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M17 19c-4-1-7-4-7-9 4 0 7 2 7.5 5"
            fill="rgba(94,142,94,0.22)" stroke="#5E8E5E" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 17c4-1 7-4 7-9-4 0-7 2-7.5 5"
            fill="rgba(94,142,94,0.34)" stroke="#5E8E5E" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function TaskCompletionCelebration({
  mode = 'farm',
  completedCount = 0,
  weather = null,
  tomorrowPreview = '',
  onCta = null,
  testId = 'tasks-completion-celebration',
}) {
  const isGarden = mode === 'garden';
  const completionLine  = _completionLine(completedCount, isGarden);
  const reassurance     = _resolveReassurance(weather, isGarden);
  const tomorrowLabel   = tSafe('tasks.tomorrow',           'Tomorrow');
  const tomorrowFb      = isGarden
    ? tSafe('tasks.quickCheckTomorrowGarden', 'Quick care check recommended in the morning.')
    : tSafe('tasks.quickCheckTomorrow',       'Quick moisture check recommended in the morning.');
  const tomorrowText    = (tomorrowPreview && String(tomorrowPreview).trim())
    ? String(tomorrowPreview).trim()
    : tomorrowFb;
  const ctaLabel        = tSafe('tasks.tomorrowOutlook', 'See tomorrow’s outlook');

  return (
    <section
      style={S.card}
      data-testid={testId}
      data-mode={isGarden ? 'garden' : 'farm'}
    >
      {/* Halo + leaf glyph — calm pulse via global @keyframes
          farroway-pulse (0.5s) so the surface gently breathes
          without becoming a celebration loop. */}
      <span
        style={S.haloOuter}
        aria-hidden="true"
        className="ff-completion-halo"
      >
        <span style={S.haloInner}>{_leafIcon()}</span>
      </span>

      <p style={S.completionLine}>
        <span aria-hidden="true" style={S.checkMark}>✓</span>
        {completionLine}
      </p>

      <p style={S.reassurance}>{reassurance}</p>

      <div style={S.tomorrowBlock}>
        <span style={S.tomorrowLabel}>{tomorrowLabel}</span>
        <span style={S.tomorrowText}>{tomorrowText}</span>
      </div>

      {typeof onCta === 'function' ? (
        <button
          type="button"
          onClick={onCta}
          style={S.cta}
          className="ff-tap"
          data-testid="tasks-completion-cta"
        >
          <span>{ctaLabel}</span>
          <span aria-hidden="true" style={S.ctaArrow}>{'→'}</span>
        </button>
      ) : null}
    </section>
  );
}

const S = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '0.65rem',
    padding: '2rem 1.5rem 1.65rem',
    borderRadius: T.radiusCard,
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
    margin: '1rem 1.25rem',
  },
  // Outer halo + inner glyph wrapper — gives the leaf a soft
  // green ring of light without needing a JS animation loop.
  haloOuter: {
    width: 78, height: 78,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(94,142,94,0.20) 0%, rgba(94,142,94,0.04) 60%, rgba(94,142,94,0) 100%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.15rem',
  },
  haloInner: {
    width: 56, height: 56,
    borderRadius: '50%',
    background: T.greenSoft,
    border: `1px solid ${T.greenBorder}`,
    boxShadow: '0 0 0 4px rgba(94,142,94,0.06)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionLine: {
    margin: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1.1rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: T.ink,
  },
  checkMark: {
    color: '#3F6A3F',
    fontSize: '1.2rem',
    lineHeight: 1,
    fontWeight: 800,
  },
  reassurance: {
    margin: '0.1rem 0 0',
    fontSize: '0.92rem',
    fontWeight: 600,
    color: T.greenInk,
    lineHeight: 1.45,
    maxWidth: 320,
  },
  tomorrowBlock: {
    marginTop: '0.4rem',
    padding: '0.75rem 0.9rem',
    background: T.ochreSoft,
    border: `1px solid ${T.ochreBorder}`,
    borderRadius: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    alignItems: 'flex-start',
    textAlign: 'left',
    width: '100%',
    maxWidth: 380,
  },
  tomorrowLabel: {
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: T.ochreInk,
  },
  tomorrowText: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: T.ink,
    lineHeight: 1.45,
  },
  cta: {
    marginTop: '0.4rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.85rem 1.4rem',
    borderRadius: 999,
    border: 'none',
    background: 'linear-gradient(180deg, #D4A35F 0%, #B9853F 100%)',
    color: '#FFFFFF',
    fontSize: '0.95rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 46,
    boxShadow: '0 10px 24px rgba(185,133,63,0.32)',
    fontFamily: 'inherit',
    letterSpacing: '0.005em',
  },
  ctaArrow: {
    fontSize: '1.05rem',
    fontWeight: 800,
    lineHeight: 1,
  },
};
