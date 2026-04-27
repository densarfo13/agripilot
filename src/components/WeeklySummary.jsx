/**
 * WeeklySummary — supportive 7-day recap for the farmer.
 *
 *   <WeeklySummary />
 *
 * Layout (top -> bottom):
 *   1. Title         (this week)
 *   2. Three numbers (tasks completed / farm checks / reports)
 *   3. Streak        (current streak in days)
 *   4. Message       (supportive one-liner — never shame-based)
 *
 * Strict-rule audit
 *   * Supportive, NEVER shame-based: copy is "Good work. Keep
 *     checking your crops." or "You checked your farm 4 times
 *     this week." — no "you missed", no "behind", no "failed".
 *   * Honest numbers only: every figure comes from
 *     computeRoiMetrics() which is a literal count of farmer-
 *     driven actions. No imputed "yield uplift", no projected
 *     impact.
 *   * Works offline: every read is local (eventLogger, labels,
 *     outbreakStore, streak).
 *   * tSafe friendly: every visible string routes through
 *     tSafe so non-English locales don't leak.
 *   * Never crashes: computeRoiMetrics has try/catch around
 *     every store read; this component then guards each render
 *     against missing fields.
 *   * Quiet zero-state: no week of data → renders the same
 *     card with "Welcome — start by checking your farm today."
 *     so the surface is never blank.
 */

import React, { useMemo } from 'react';
import { tSafe } from '../i18n/tSafe.js';
import { getStreak } from '../utils/streak.js';
import { computeRoiMetrics } from '../metrics/roiMetrics.js';

function _safeStreak() {
  try {
    const s = getStreak();
    if (s && Number.isFinite(s.current)) return s.current;
    if (Number.isFinite(s)) return s;
    return 0;
  } catch { return 0; }
}

function _pickMessage(m) {
  if (!m) {
    return {
      key:      'weekly.message.welcome',
      fallback: 'Welcome \u2014 start by checking your farm today.',
    };
  }
  if (m.checksThisWeek === 0) {
    return {
      key:      'weekly.message.welcome',
      fallback: 'Welcome \u2014 start by checking your farm today.',
    };
  }
  if (m.checksThisWeek >= 5) {
    return {
      key:      'weekly.message.strong',
      fallback: 'Excellent. You checked your farm most days this week.',
    };
  }
  if (m.checksThisWeek >= 3) {
    return {
      key:      'weekly.message.steady',
      fallback: 'Good work. Keep checking your crops.',
    };
  }
  return {
    key:      'weekly.message.encourage',
    fallback: 'Nice start. Try one quick check tomorrow.',
  };
}

export default function WeeklySummary() {
  const metrics = useMemo(() => {
    try { return computeRoiMetrics({ windowDays: 7 }); }
    catch { return null; }
  }, []);

  const streak  = _safeStreak();
  const m       = metrics || {
    tasksCompleted: 0, checksThisWeek: 0,
    pestReports: 0, droughtReports: 0,
  };
  const reportsTotal = (m.pestReports || 0) + (m.droughtReports || 0);
  const message      = _pickMessage(metrics);

  // Honest count line — interpolates the actual count so the
  // farmer sees their week reflected back in their own number.
  const countLine = tSafe('weekly.checksLine', '')
    || `You checked your farm ${m.checksThisWeek} times this week.`;
  const countLineRendered = countLine.replace(
    /\{count\}/g, String(m.checksThisWeek),
  );

  return (
    <section style={S.card} data-testid="weekly-summary">
      <h3 style={S.title}>
        {tSafe('weekly.title', 'This week')}
      </h3>

      <div style={S.grid}>
        <Stat
          label={tSafe('weekly.tasks', 'Tasks done')}
          value={m.tasksCompleted}
          testId="weekly-tasks"
        />
        <Stat
          label={tSafe('weekly.checks', 'Farm checks')}
          value={m.checksThisWeek}
          testId="weekly-checks"
        />
        <Stat
          label={tSafe('weekly.reports', 'Reports')}
          value={reportsTotal}
          testId="weekly-reports"
        />
      </div>

      {streak > 0 && (
        <div style={S.streakRow} data-testid="weekly-streak">
          <span style={S.streakIcon} aria-hidden="true">{'\uD83D\uDD25'}</span>
          <span>
            {tSafe('weekly.streak',
              `${streak} day streak`).replace(/\{days\}/g, String(streak))
              || `${streak} day streak`}
          </span>
        </div>
      )}

      <p style={S.checksLine} data-testid="weekly-checks-line">
        {countLineRendered}
      </p>
      <p style={S.message} data-testid="weekly-message">
        {tSafe(message.key, message.fallback)}
      </p>
    </section>
  );
}

function Stat({ label, value, testId }) {
  return (
    <div style={S.stat} data-testid={testId}>
      <div style={S.statValue}>{Number.isFinite(value) ? value : 0}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

const S = {
  card: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '1rem 1.125rem 1.25rem',
    color: '#EAF2FF',
    margin: '0.75rem 0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  title: {
    margin: 0,
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#86EFAC',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem',
  },
  stat: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '0.75rem 0.5rem',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.25rem',
  },
  streakRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#FCD34D',
    fontSize: '0.875rem',
    fontWeight: 700,
  },
  streakIcon: { fontSize: '1.125rem', lineHeight: 1 },
  checksLine: {
    margin: 0,
    fontSize: '0.9375rem',
    color: '#EAF2FF',
    lineHeight: 1.45,
  },
  message: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 1.45,
  },
};
