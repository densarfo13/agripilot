/**
 * WeeklyReportCard.jsx — Phase 13 weekly farm report.
 *
 *   <WeeklyReportCard adoption={useFarmerAdoption({...})} />
 *
 *   Renders the 6-stat weekly summary from composeWeeklyReport:
 *     • Tasks completed
 *     • Scans performed
 *     • Health score change (with up/down/flat arrow)
 *     • Risk alerts
 *     • Weather events
 *     • Yield forecast change
 *
 *   Self-hides when there's nothing to report (empty week).
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • All copy via tSafe.
 *   • Caller-injected data only.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

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
    fontSize: 12, fontWeight: 700, color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 4,
  },
  headline: {
    fontSize: 15, fontWeight: 700, color: '#1F2933',
    margin: '4px 0 12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 8,
  },
  stat: {
    background: 'rgba(31,41,51,0.03)',
    borderRadius: 10,
    padding: '10px 12px',
  },
  statLabel: {
    fontSize: 11, color: '#64748B',
    fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  statValue: {
    fontSize: 18, fontWeight: 800, color: '#1F2933',
    marginTop: 2,
  },
  delta: (direction) => ({
    fontSize: 12,
    fontWeight: 700,
    marginLeft: 4,
    color: direction === 'up'   ? '#047857'
         : direction === 'down' ? '#991B1B'
         : '#64748B',
  }),
};

function _arrow(direction) {
  if (direction === 'up')   return '▲';
  if (direction === 'down') return '▼';
  return '·';
}

function _Stat({ labelKey, labelDefault, value, suffix, testid }) {
  return (
    <div style={STYLES.stat} data-testid={testid}>
      <div style={STYLES.statLabel}>{tSafe(labelKey, labelDefault)}</div>
      <div style={STYLES.statValue}>{value}{suffix || ''}</div>
    </div>
  );
}

function _Change({ labelKey, labelDefault, change, testid }) {
  if (!_isObj(change)) {
    return (
      <div style={STYLES.stat} data-testid={testid}>
        <div style={STYLES.statLabel}>{tSafe(labelKey, labelDefault)}</div>
        <div style={STYLES.statValue}>
          {tSafe('adoption.weekly.noChange', '—')}
        </div>
      </div>
    );
  }
  return (
    <div style={STYLES.stat} data-testid={testid}>
      <div style={STYLES.statLabel}>{tSafe(labelKey, labelDefault)}</div>
      <div style={STYLES.statValue}>
        {change.to}
        <span style={STYLES.delta(change.direction)}>
          {_arrow(change.direction)}{' '}
          {change.delta > 0 ? '+' : ''}{change.delta}
        </span>
      </div>
    </div>
  );
}

export default function WeeklyReportCard({ adoption }) {
  if (!_isObj(adoption)) return null;
  const w = adoption.weeklyReport;
  if (!_isObj(w)) return null;

  const hasAnyActivity = (
       _num(w.tasksCompleted)      > 0
    || _num(w.scansPerformed)      > 0
    || _num(w.riskAlertCount)      > 0
    || _num(w.weatherEventCount)   > 0
    || _isObj(w.healthScoreChange)
    || _isObj(w.yieldForecastChange)
  );
  if (!hasAnyActivity) return null;

  return (
    <section style={STYLES.card}
      data-testid="weekly-report-card"
      role="region"
      aria-label={tSafe('adoption.weekly.aria', 'Weekly farm report')}
    >
      <div style={STYLES.title}>
        {tSafe('adoption.weekly.title', 'Weekly report')}
      </div>
      <div style={STYLES.headline}>
        {tSafe(w.summary && w.summary.headlineKey,
          (w.summary && w.summary.headlineDefault) || '')}
      </div>

      <div style={STYLES.grid}>
        <_Stat
          labelKey="adoption.weekly.tasks"
          labelDefault="Tasks completed"
          value={w.tasksCompleted}
          testid="weekly-stat-tasks" />
        <_Stat
          labelKey="adoption.weekly.scans"
          labelDefault="Scans"
          value={w.scansPerformed}
          testid="weekly-stat-scans" />
        <_Change
          labelKey="adoption.weekly.healthScore"
          labelDefault="Health score"
          change={w.healthScoreChange}
          testid="weekly-stat-health" />
        <_Stat
          labelKey="adoption.weekly.riskAlerts"
          labelDefault="Risk alerts"
          value={w.riskAlertCount}
          testid="weekly-stat-risk" />
        <_Stat
          labelKey="adoption.weekly.weatherEvents"
          labelDefault="Weather events"
          value={w.weatherEventCount}
          testid="weekly-stat-weather" />
        <_Change
          labelKey="adoption.weekly.yieldForecast"
          labelDefault="Yield forecast"
          change={w.yieldForecastChange}
          testid="weekly-stat-yield" />
      </div>
    </section>
  );
}
