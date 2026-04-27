/**
 * MainTaskCard — single-task headline card for the optimised
 * Today page.
 *
 *   <MainTaskCard task="Check soil moisture today" reason="..." />
 *
 * Strict-rule audit
 *   * shows ONE task (the prop is a single string)
 *   * no clutter: kicker + h1 + optional 1-line reason
 *   * loads instantly: pure presentational, no I/O
 *   * low literacy friendly: large icon, big bold title
 *   * inline styles match the codebase (no Tailwind dep)
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';

export default function MainTaskCard({
  task     = '',
  reason   = '',
  icon     = '\uD83C\uDF31',     // sprout
}) {
  return (
    <section style={S.card} data-testid="main-task-card">
      <div style={S.kickerRow}>
        <span style={S.icon} aria-hidden="true">{icon}</span>
        <span style={S.kicker}>
          {tSafe('today.todaysTask', 'Today\u2019s task')}
        </span>
      </div>
      <h1 style={S.title} data-testid="main-task-title">
        {task || tSafe('today.fallbackTask', 'Check your farm today')}
      </h1>
      {reason && (
        <p style={S.reason} data-testid="main-task-reason">
          {reason}
        </p>
      )}
    </section>
  );
}

const S = {
  card: {
    background: 'linear-gradient(135deg, #166534 0%, #14532D 100%)',
    border: '1px solid rgba(34,197,94,0.45)',
    borderRadius: '20px',
    padding: '1.25rem 1.25rem 1.5rem',
    color: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
    boxShadow: '0 12px 32px rgba(0,0,0,0.30)',
  },
  kickerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  icon: {
    fontSize: '1.75rem',
    lineHeight: 1,
  },
  kicker: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#86EFAC',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.2,
    letterSpacing: '0.005em',
  },
  reason: {
    margin: 0,
    fontSize: '0.9375rem',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.45,
  },
};
