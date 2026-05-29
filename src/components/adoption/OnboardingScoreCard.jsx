/**
 * OnboardingScoreCard.jsx — Phase 13 onboarding progress card.
 *
 *   <OnboardingScoreCard adoption={useFarmerAdoption({...})} />
 *
 *   Displays the 5-step onboarding checklist with a progress bar.
 *   Self-hides when onboarding is complete.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • Caller-injected data only — no fetch, no localStorage.
 *   • All copy via tSafe.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);

const STYLES = {
  card: {
    background: '#FFFFFF',
    borderRadius: 14,
    padding: '16px 16px 14px',
    margin: '12px 0',
    border: '1px solid rgba(31,41,51,0.06)',
    boxShadow: '0 1px 2px rgba(31,41,51,0.03)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex', alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  pct: {
    fontSize: 18, fontWeight: 800, color: '#1F2933',
  },
  bar: {
    width: '100%', height: 6,
    background: 'rgba(31,41,51,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  fill: (p) => ({
    width: p + '%',
    height: '100%',
    background: 'linear-gradient(90deg, #16A34A 0%, #22C55E 100%)',
    transition: 'width 250ms ease',
  }),
  steps: {
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  step: (done) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px',
    background: done ? 'rgba(16,185,129,0.06)' : 'rgba(31,41,51,0.03)',
    borderRadius: 8,
    border: done ? '1px solid rgba(16,185,129,0.20)'
                 : '1px solid rgba(31,41,51,0.06)',
  }),
  dot: (done) => ({
    width: 18, height: 18, borderRadius: 9,
    background: done ? '#16A34A' : '#FFFFFF',
    border: done ? '1px solid #16A34A' : '1px solid rgba(31,41,51,0.20)',
    color: '#FFFFFF', fontSize: 12, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  stepLabel: (done) => ({
    flex: 1,
    fontSize: 13,
    color: done ? '#047857' : '#1F2933',
    textDecoration: done ? 'line-through' : 'none',
  }),
  next: {
    marginTop: 10,
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
  },
};

export default function OnboardingScoreCard({ adoption }) {
  if (!_isObj(adoption)) return null;
  const o = adoption.onboarding;
  if (!_isObj(o)) return null;
  if (o.isComplete) return null;

  const steps = _arr(o.steps);
  if (steps.length === 0) return null;

  return (
    <section style={STYLES.card}
      data-testid="onboarding-score-card"
      role="region"
      aria-label={tSafe('adoption.onboarding.aria', 'Onboarding progress')}
    >
      <div style={STYLES.header}>
        <div style={STYLES.title}>
          {tSafe('adoption.onboarding.title', 'Setup progress')}
        </div>
        <div style={STYLES.pct}
          data-testid="onboarding-score-percent">{o.percent}%</div>
      </div>

      <div style={STYLES.bar} role="progressbar"
        aria-valuenow={o.percent} aria-valuemin={0} aria-valuemax={100}>
        <div style={STYLES.fill(o.percent)} />
      </div>

      <div style={STYLES.steps}>
        {steps.map((s) => (
          <div key={s.key} style={STYLES.step(s.done)}
            data-testid={`onboarding-step-${s.key}`}>
            <div style={STYLES.dot(s.done)} aria-hidden="true">
              {s.done ? '✓' : ''}
            </div>
            <div style={STYLES.stepLabel(s.done)}>
              {tSafe(s.labelKey, s.labelDefault)}
            </div>
          </div>
        ))}
      </div>

      {o.nextStep ? (
        <div style={STYLES.next}>
          {tSafe('adoption.onboarding.next', 'Next:')}{' '}
          {tSafe(o.nextStep.labelKey, o.nextStep.labelDefault)}
        </div>
      ) : null}
    </section>
  );
}
