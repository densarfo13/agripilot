/**
 * FarmerValueCard — small "your impact" surface for the farmer.
 *
 * Renders the local computeFarmValue output as a clear,
 * encouraging card. Pure presentational: takes a farmId prop and
 * does the read inline. Uses inline styles to match the rest of
 * the codebase (no Tailwind dependency).
 *
 * Strict rules respected:
 *   * never crashes on missing data - computeFarmValue defends
 *     against everything upstream
 *   * UI not blocked - sync read from the localStorage mirror
 *   * additive: nothing else needs to change to mount this
 */

import React from 'react';
import { computeFarmValue } from '../metrics/valueEngine.js';
import { tSafe } from '../i18n/tSafe.js';

export default function FarmerValueCard({ farmId = null }) {
  const v = computeFarmValue(farmId);

  return (
    <section style={S.card} data-testid="farmer-value-card">
      <h3 style={S.title}>
        {tSafe('farroway.value.title', 'Your impact')}
      </h3>
      <ul style={S.list}>
        <li style={S.row}>
          <span style={S.label}>{tSafe('farroway.value.tasksCompleted', 'Tasks completed')}</span>
          <strong style={S.num}>{v.tasksCompleted}</strong>
        </li>
        <li style={S.row}>
          <span style={S.label}>{tSafe('farroway.value.engagement', 'Engagement')}</span>
          <strong style={S.num}>{v.engagementScore}%</strong>
        </li>
        <li style={S.row}>
          <span style={S.label}>{tSafe('farroway.value.yieldUplift', 'Yield improvement')}</span>
          <strong style={S.num}>+{v.estimatedYieldImpact}%</strong>
        </li>
      </ul>
    </section>
  );
}

const S = {
  card: {
    background: 'linear-gradient(135deg, #166534 0%, #14532D 100%)',
    border: '1px solid rgba(34,197,94,0.35)',
    borderRadius: '20px',
    padding: '1rem 1.125rem',
    color: '#EAF2FF',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  title: {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#DCFCE7',
    letterSpacing: '0.02em',
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
  },
  label: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.85)',
  },
  num: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#fff',
  },
};
