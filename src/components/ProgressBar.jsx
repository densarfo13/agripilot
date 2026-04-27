/**
 * ProgressBar — small footer chip on the Today screen.
 *
 *   <ProgressBar streak={5} tasksDone={2} />
 *
 * Two short chips side-by-side: flame + streak count, check +
 * tasks-done count. Never expands beyond two lines so the
 * Today screen stays tight.
 *
 * Strict-rule audit
 *   * loads instantly: pure presentational
 *   * low-literacy friendly: emoji + number, minimal text
 *   * works offline (caller passes raw numbers)
 *   * inline styles match the codebase
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';

export default function ProgressBar({
  streak    = 0,
  tasksDone = 0,
}) {
  const s = Number.isFinite(Number(streak))    ? Math.max(0, Math.floor(Number(streak)))    : 0;
  const t = Number.isFinite(Number(tasksDone)) ? Math.max(0, Math.floor(Number(tasksDone))) : 0;

  return (
    <div style={S.row} data-testid="progress-bar">
      <span style={S.chip}>
        <span style={S.icon} aria-hidden="true">{s > 0 ? '\uD83D\uDD25' : '\uD83C\uDF31'}</span>
        <strong style={S.value}>{s}</strong>{' '}
        <span style={S.label}>
          {tSafe('today.progress.streak', 'day streak')}
        </span>
      </span>
      <span style={S.chip}>
        <span style={S.icon} aria-hidden="true">{'\u2714\uFE0F'}</span>
        <strong style={S.value}>{t}</strong>{' '}
        <span style={S.label}>
          {tSafe('today.progress.tasksToday', 'tasks today')}
        </span>
      </span>
    </div>
  );
}

const S = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.85)',
    fontSize: '0.8125rem',
  },
  icon: { fontSize: '1rem', lineHeight: 1 },
  value: { color: '#EAF2FF', fontWeight: 800 },
  label: { color: 'rgba(255,255,255,0.65)' },
};
