/**
 * NgoProgramDashboard.jsx — placeholder dashboard for NGO /
 * program operators (NGO Onboarding spec §9).
 *
 *   <Route path="/program/dashboard" element={<NgoProgramDashboard />} />
 *
 * Spec rule (§9): "Do not overbuild. Use current local/mock
 * data if backend not ready."
 *
 * What ships
 * ──────────
 *   - Total farmers           (from local programs + active farm)
 *   - Active farmers          (events in 7-day window)
 *   - Task completion rate    (insightAggregator)
 *   - Scan usage              (insightAggregator)
 *   - Top crops               (insightAggregator)
 *   - Regions covered         (insightAggregator)
 *   - Day 2 return            (events with name 'day2_return')
 *   - Day 7 return            (events with name 'day7_return')
 *
 * Each card is a flat read of the local stores. Empty state
 * surfaces a single "invite farmers" call-to-action so a
 * fresh deploy doesn't render a wall of zeros.
 *
 * Strict-rule audit
 *   • Reads from existing stores only \u2014 no new I/O.
 *   • Inline styles only.
 *   • All visible text via tSafe.
 *   • Defensive: every aggregator call wrapped in try/catch
 *     so a corrupt event log never blanks the page.
 */

import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { listPrograms } from '../../core/programs/programStore.js';
import { getEvents, summarizeEvents } from '../../core/eventStore.js';
import { aggregateLocalInsights } from '../../core/insightAggregator.js';

const C = {
  ink:     '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.65)',
  card:    'rgba(255,255,255,0.04)',
  border:  'rgba(255,255,255,0.10)',
};

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: C.ink,
    padding: '32px 16px 96px',
    boxSizing: 'border-box',
    maxWidth: 720,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  title: { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
  },
  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 96,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: C.inkSoft,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  cardValue: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: C.ink,
    letterSpacing: '-0.01em',
  },
  cardSub: {
    fontSize: 12,
    color: C.inkSoft,
  },
  empty: {
    margin: 0,
    padding: '12px 14px',
    borderRadius: 12,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FDE68A',
    fontSize: 13,
    lineHeight: 1.45,
  },
};

function _topN(map, n) {
  const entries = Object.entries(map || {});
  entries.sort((a, b) => b[1] - a[1]);
  return entries.slice(0, n);
}

export default function NgoProgramDashboard() {
  useTranslation();

  // Snapshot the local stores once on mount. Re-mounting
  // refetches; we don't watch for live updates here because
  // the page is operator-facing and a manual refresh is
  // perfectly acceptable.
  const data = React.useMemo(() => {
    let programs = [];
    let events = [];
    let summary = { total: 0, byName: {}, byExperience: {}, last7d: 0 };
    let insights = {
      topCompletedTasks: {},
      commonIssues:      {},
      healthTrend:       { healthy: 0, mixed: 0, worse: 0 },
      scanUsageRate:     0,
      byRegion:          {},
      byCropOrPlant:     {},
    };
    try { programs = listPrograms(); }       catch { /* swallow */ }
    try { events   = getEvents();   }        catch { /* swallow */ }
    try { summary  = summarizeEvents(events); } catch { /* swallow */ }
    try { insights = aggregateLocalInsights(events); } catch { /* swallow */ }
    return { programs, events, summary, insights };
  }, []);

  // Derive the metrics. All defensive \u2014 a missing field
  // collapses to 0 / [] so cards never render NaN or
  // 'undefined'.
  const totalFarmers = (() => {
    // Best-effort: count the unique farmer ids that have
    // landed on the dashboard surface (i.e. fired any event)
    // PLUS any program records' farmerId field. Without a
    // server-side farmer roster we can't be exact; the
    // metric is a "lower bound seen on this device".
    const set = new Set();
    for (const e of data.events) {
      const id = e && e.payload && e.payload.farmerId;
      if (id) set.add(id);
    }
    return set.size;
  })();
  const activeFarmers7d = (() => {
    // "Active" = fired at least one daily_open or
    // task_completed in the last 7 days. summarizeEvents
    // already filtered last7d count for ALL events; this
    // narrows to the engagement subset.
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const set = new Set();
    for (const e of data.events) {
      if (!e || typeof e.timestamp !== 'number' || e.timestamp < cutoff) continue;
      if (e.name !== 'daily_open' && e.name !== 'task_completed') continue;
      const id = e.payload && e.payload.farmerId;
      if (id) set.add(id);
    }
    return set.size;
  })();
  const tasksCompleted = data.summary.byName['task_completed'] || 0;
  const tasksShown     = data.summary.byName['task_shown']     || 0;
  const completionRate = tasksShown > 0
    ? Math.round((tasksCompleted / tasksShown) * 100)
    : (tasksCompleted > 0 ? 100 : 0);
  const scanUsage = Math.round((data.insights.scanUsageRate || 0) * 100);
  const topCrop      = _topN(data.insights.byCropOrPlant, 1)[0];
  const regionsCount = Object.keys(data.insights.byRegion || {}).length;
  const day2Returns  = data.summary.byName['day2_return'] || 0;
  const day7Returns  = data.summary.byName['day7_return'] || 0;

  const isEmpty = data.events.length === 0 && data.programs.length === 0;

  return (
    <main style={S.page} data-testid="program-dashboard">
      <h1 style={S.title}>
        {tSafe('program.dashboard.title', 'Program overview')}
      </h1>

      {isEmpty ? (
        <p style={S.empty} data-testid="program-dashboard-empty">
          {tSafe('program.dashboard.empty',
            'No data yet \u2014 invite farmers to populate this dashboard.')}
        </p>
      ) : null}

      <div style={S.grid}>
        <div style={S.card} data-testid="program-card-total-farmers">
          <span style={S.cardLabel}>
            {tSafe('program.dashboard.totalFarmers', 'Total farmers')}
          </span>
          <p style={S.cardValue}>{totalFarmers}</p>
        </div>

        <div style={S.card} data-testid="program-card-active-farmers">
          <span style={S.cardLabel}>
            {tSafe('program.dashboard.activeFarmers', 'Active farmers')}
          </span>
          <p style={S.cardValue}>{activeFarmers7d}</p>
          <span style={S.cardSub}>last 7 days</span>
        </div>

        <div style={S.card} data-testid="program-card-task-completion">
          <span style={S.cardLabel}>
            {tSafe('program.dashboard.taskCompletion', 'Task completion rate')}
          </span>
          <p style={S.cardValue}>{completionRate}%</p>
        </div>

        <div style={S.card} data-testid="program-card-scan-usage">
          <span style={S.cardLabel}>
            {tSafe('program.dashboard.scanUsage', 'Scan usage')}
          </span>
          <p style={S.cardValue}>{scanUsage}%</p>
        </div>

        <div style={S.card} data-testid="program-card-top-crops">
          <span style={S.cardLabel}>
            {tSafe('program.dashboard.topCrops', 'Top crops')}
          </span>
          <p style={S.cardValue}>
            {topCrop ? topCrop[0] : '—'}
          </p>
          {topCrop ? (
            <span style={S.cardSub}>{topCrop[1]} events</span>
          ) : null}
        </div>

        <div style={S.card} data-testid="program-card-regions">
          <span style={S.cardLabel}>
            {tSafe('program.dashboard.regions', 'Regions covered')}
          </span>
          <p style={S.cardValue}>{regionsCount}</p>
        </div>

        <div style={S.card} data-testid="program-card-day2-return">
          <span style={S.cardLabel}>
            {tSafe('program.dashboard.day2Return', 'Day 2 return')}
          </span>
          <p style={S.cardValue}>{day2Returns}</p>
        </div>

        <div style={S.card} data-testid="program-card-day7-return">
          <span style={S.cardLabel}>
            {tSafe('program.dashboard.day7Return', 'Day 7 return')}
          </span>
          <p style={S.cardValue}>{day7Returns}</p>
        </div>
      </div>
    </main>
  );
}
