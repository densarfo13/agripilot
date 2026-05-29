/**
 * TodayHeroCard.jsx — Phase 11 home top card.
 *
 *   <TodayHeroCard today={useToday({...})} />
 *
 * What this is
 * ────────────
 *   The single "Good morning + farm health + priority actions +
 *   weather note" card the spec calls out. Self-hides when the
 *   today envelope has insufficient signal.
 *
 *   Strict-rule audit
 *     • Pure render. SSR-safe.
 *     • Caller-owned data. No fetch, no localStorage.
 *     • All copy via tSafe with sensible English defaults.
 *     • Farmer Rule — no raw scores below band level surfaced.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');

const STYLES = {
  card: {
    background: 'linear-gradient(135deg, #15803D 0%, #16A34A 60%, #22C55E 100%)',
    color: '#FFFFFF',
    borderRadius: 18,
    padding: '22px 22px 20px',
    margin: '12px 0 16px',
    boxShadow: '0 8px 20px rgba(21,128,61,0.16)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  greet: {
    fontSize: 22,
    fontWeight: 800,
    margin: '0 0 4px',
    letterSpacing: '-0.01em',
  },
  healthRow: {
    fontSize: 14,
    opacity: 0.95,
    marginBottom: 14,
  },
  healthScore: {
    fontWeight: 800,
    fontSize: 16,
    marginLeft: 6,
  },
  countRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.20)',
    padding: '12px 14px',
    borderRadius: 12,
    marginBottom: 10,
  },
  countBig: {
    fontSize: 26,
    fontWeight: 800,
    minWidth: 32,
    lineHeight: 1,
  },
  countLabel: {
    fontSize: 13,
    opacity: 0.95,
    lineHeight: 1.3,
  },
  weatherRow: {
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.18)',
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 1.45,
    marginBottom: 12,
  },
  hint: {
    fontSize: 12,
    opacity: 0.92,
    fontStyle: 'italic',
  },
};

export default function TodayHeroCard({ today }) {
  if (!_isObj(today)) return null;
  const briefing = today.briefing;
  if (!_isObj(briefing)) return null;
  const greet = _isObj(briefing.greeting) ? briefing.greeting : null;
  const counts = _isObj(briefing.counts) ? briefing.counts : {};
  const priorityCount = (counts.doNow || 0) + (counts.doToday || 0);
  const recoveryCount = counts.recovery || 0;
  const health = today.farmHealth;
  const weatherAction = _arr(today.weatherActions)[0] || null;
  const farmerName = _isObj(today.farmId)
    ? '' : '';  // farmer name comes through briefing.greeting params

  // Build the greeting text. If briefing greeting key+default were
  // resolvable by the caller they could replace; here we render a
  // sensible default that respects the time-of-day greeting.
  const greetingText = (() => {
    const greetDefault = greet && _str(greet.def) || 'Good morning';
    // briefing.greeting carries .key + .def — the briefing line
    // params object would have substituted {name}; we surface the
    // raw greeting plus an optional name from the farm.
    return greetDefault;
  })();

  // If the engine produced no real signal, render nothing rather
  // than an empty card.
  const hasSignal = !!(
    (health && health.score != null) || priorityCount > 0
    || recoveryCount > 0 || weatherAction);
  if (!hasSignal) return null;

  return (
    <section
      style={STYLES.card}
      data-testid="today-hero-card"
      role="region"
      aria-label={tSafe('today.hero.title', 'Today')}
    >
      <h2 style={STYLES.greet}>
        {tSafe(greet ? greet.key : 'today.greet.morning', greetingText)}.
      </h2>

      {health && health.score != null ? (
        <div style={STYLES.healthRow} data-testid="today-hero-health">
          {tSafe('today.hero.farmHealth', 'Farm Health')}:
          <span style={STYLES.healthScore}>{health.score}%</span>
        </div>
      ) : null}

      {priorityCount > 0 ? (
        <div style={STYLES.countRow} data-testid="today-hero-priority-count">
          <div style={STYLES.countBig}>{priorityCount}</div>
          <div style={STYLES.countLabel}>
            <strong>{tSafe('today.hero.todayLabel', 'Today')}:</strong>
            <br />
            {priorityCount === 1
              ? tSafe('today.hero.onePriority', '1 priority action')
              : tSafe('today.hero.priorityActions',
                  priorityCount + ' priority actions',
                  { n: priorityCount })}
          </div>
        </div>
      ) : null}

      {recoveryCount > 0 ? (
        <div style={STYLES.countRow} data-testid="today-hero-recovery-count">
          <div style={STYLES.countBig}>{recoveryCount}</div>
          <div style={STYLES.countLabel}>
            <strong>{tSafe('today.hero.recoveryLabel', 'Catch-up')}:</strong>
            <br />
            {tSafe('today.hero.recoveryBody',
              recoveryCount + ' from earlier',
              { n: recoveryCount })}
          </div>
        </div>
      ) : null}

      {weatherAction ? (
        <div style={STYLES.weatherRow} data-testid="today-hero-weather">
          <strong>
            {tSafe(weatherAction.headlineKey, weatherAction.headlineDefault)}
          </strong>
          <br />
          {tSafe(weatherAction.bodyKey, weatherAction.bodyDefault)}
        </div>
      ) : null}

      {priorityCount > 0 ? (
        <div style={STYLES.hint}>
          {tSafe('today.hero.hint',
            'Complete these before noon.')}
        </div>
      ) : null}
    </section>
  );
}
