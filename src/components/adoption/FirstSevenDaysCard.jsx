/**
 * FirstSevenDaysCard.jsx — Phase 13 7-day guided arc.
 *
 *   <FirstSevenDaysCard adoption={useFarmerAdoption({...})} />
 *
 *   7 milestones rendered as a horizontal day-strip with state
 *   chips. Self-hides when:
 *     • envelope is missing
 *     • all milestones are done (the first week is over)
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • All copy via tSafe.
 *   • Caller-injected data only.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);

const STATE_STYLE = {
  done:   {
    background: 'rgba(16,185,129,0.10)',
    border:     '1px solid rgba(16,185,129,0.30)',
    color:      '#047857',
  },
  active: {
    background: 'rgba(245,158,11,0.10)',
    border:     '1px solid rgba(245,158,11,0.30)',
    color:      '#92400E',
  },
  locked: {
    background: 'rgba(148,163,184,0.06)',
    border:     '1px dashed rgba(148,163,184,0.40)',
    color:      '#64748B',
  },
};

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
  title: {
    fontSize: 12,
    fontWeight: 700,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 10,
  },
  strip: {
    display: 'flex', gap: 6, flexWrap: 'wrap',
  },
  cell: (state) => ({
    flex: '1 0 auto',
    minWidth: 88,
    padding: '10px 8px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'center',
    ...STATE_STYLE[state],
  }),
  cellDay: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    opacity: 0.7,
    marginBottom: 2,
  },
  next: {
    marginTop: 10,
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
  },
};

export default function FirstSevenDaysCard({ adoption }) {
  if (!_isObj(adoption)) return null;
  const fw = adoption.firstSevenDays;
  if (!_isObj(fw)) return null;
  if (fw.isComplete) return null;

  const milestones = _arr(fw.milestones);
  if (milestones.length === 0) return null;

  return (
    <section style={STYLES.card}
      data-testid="first-seven-days-card"
      role="region"
      aria-label={tSafe('adoption.firstWeek.aria', 'Your first week')}
    >
      <div style={STYLES.title}>
        {tSafe('adoption.firstWeek.title', 'Your first week')}
      </div>
      <div style={STYLES.strip}>
        {milestones.map((m) => (
          <div key={m.day} style={STYLES.cell(m.state)}
            data-testid={`first-week-day-${m.day}`}>
            <div style={STYLES.cellDay}>
              {tSafe('adoption.firstWeek.dayLabel', 'Day') + ' ' + m.day}
            </div>
            <div>{tSafe(m.labelKey, m.labelDefault)}</div>
          </div>
        ))}
      </div>
      {fw.nextMilestone ? (
        <div style={STYLES.next}>
          {tSafe('adoption.firstWeek.next', 'Next:')}{' '}
          {tSafe(fw.nextMilestone.labelKey, fw.nextMilestone.labelDefault)}
        </div>
      ) : null}
    </section>
  );
}
