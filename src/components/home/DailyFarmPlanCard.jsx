/**
 * DailyFarmPlanCard.jsx — the Home "Today's Farm Plan" top section.
 *
 * Shows the day-to-day operating loop for farmers AND gardeners: the top
 * priority, up to THREE tasks for today, the next milestone and an
 * approximate time-to-harvest. Each task carries Mark Done / Skip / Add Note;
 * the card footer carries Scan Plant + View Full Plan.
 *
 * Hard contract (matches the runtime + the daily-plan gates):
 *   • NEVER blocks Home. The plan is built from a dynamically-imported,
 *     never-throwing runtime inside an effect; a wrapping error boundary
 *     renders null on any failure so the rest of Home is unaffected.
 *   • Works with NO weather, NO GPS and NO scan — it always renders
 *     something useful (a "start your grow plan" prompt for new growers).
 *   • Gardener mode uses garden wording, never farm-only wording.
 *   • Approximate, never exact: it only renders the runtime's strings, which
 *     are already range-based (no exact yield / price / chemical dosage).
 *   • Localized via tSafe (dailyPlan / taskActions / gardenCare namespaces)
 *     with English defaults.
 *   • Actions are recorded through the canonical event logger (extends the
 *     existing Tasks/outcome system — it does not replace it) and mirrored
 *     to the daily-plan outcome log; both writes are guarded and append-only.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { logEvent } from '../../lib/events/eventLogger.js';

const DISCLAIMER = 'Decision support, not a guarantee.';

// ── safe helpers (self-contained; never throw) ───────────────────────────
const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

/** Append a compact, append-only record to the daily-plan outcome log. */
function _recordDailyPlanOutcome(taskId, status, note) {
  _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    // 1. Canonical Tasks/outcome event system (extend, don't replace).
    const canonicalType =
      status === 'done' ? 'task_completed'
      : status === 'skipped' ? 'task_skipped'
      : 'task_feedback';
    _safe(() => logEvent({
      type: canonicalType,
      payload: { source: 'daily_plan', taskId: String(taskId || ''), note: note || null },
    }), null);
    // 2. Mirror to the daily-plan outcome log the new loop reads. Append-only;
    //    no PII (no name, coords, device id) — only the task id + status.
    const KEY = 'farroway_event_log';
    const raw = window.localStorage.getItem(KEY);
    const list = _safe(() => { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }, []);
    list.push({
      type: status === 'done' ? 'TaskCompleted'
        : status === 'skipped' ? 'TaskSkipped' : 'TaskNoteAdded',
      source: 'daily_plan',
      taskId: String(taskId || ''),
      ts: Date.now(),
    });
    // Keep the log bounded (defensive — never let it grow without limit).
    const bounded = list.length > 500 ? list.slice(list.length - 500) : list;
    window.localStorage.setItem(KEY, JSON.stringify(bounded));
  }, undefined);
}

// ── styles (self-contained — no dependency on Home's S object) ────────────
const ST = {
  card: {
    background: 'linear-gradient(180deg, rgba(110,139,97,0.10) 0%, rgba(110,139,97,0.03) 100%)',
    border: '1px solid rgba(110,139,97,0.28)',
    borderRadius: '18px',
    padding: '1.25rem 1.15rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    boxShadow: '0 1px 0 0 rgba(255,255,255,0.5) inset, 0 14px 28px -14px rgba(70,100,70,0.20)',
  },
  label: {
    margin: 0, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.62)',
  },
  priority: { margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#2C3A26', lineHeight: 1.3 },
  taskRow: {
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
    padding: '0.75rem 0.85rem', borderRadius: '13px',
    background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(110,139,97,0.16)',
  },
  taskRowDone: { opacity: 0.55 },
  taskTitle: { margin: 0, fontSize: '0.96875rem', fontWeight: 700, color: '#2C3A26', lineHeight: 1.3 },
  taskBody: { margin: 0, fontSize: '0.84rem', color: 'rgba(50,60,45,0.78)', lineHeight: 1.5 },
  badge: (urg) => ({
    alignSelf: 'flex-start', fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.05em',
    textTransform: 'uppercase', padding: '0.18rem 0.5rem', borderRadius: '999px',
    color: urg === 'critical' ? '#7A2E12' : urg === 'recommended' ? '#5A4A12' : '#33503A',
    background: urg === 'critical' ? 'rgba(196,84,38,0.16)'
      : urg === 'recommended' ? 'rgba(185,133,63,0.16)' : 'rgba(110,139,97,0.16)',
  }),
  actionRow: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.15rem' },
  miniBtn: {
    border: '1px solid rgba(110,139,97,0.34)', background: 'rgba(255,255,255,0.7)',
    borderRadius: '999px', padding: '0.45rem 0.8rem', fontSize: '0.8rem', fontWeight: 700,
    color: '#33503A', cursor: 'pointer', minHeight: 38,
  },
  meta: { margin: 0, fontSize: '0.82rem', color: 'rgba(50,60,45,0.72)', lineHeight: 1.5 },
  metaStrong: { fontWeight: 700, color: '#2C3A26' },
  footer: { display: 'flex', flexWrap: 'wrap', gap: '0.55rem', marginTop: '0.25rem' },
  btnPrimary: {
    flex: '1 1 auto', minWidth: 130, padding: '0.8rem 1.2rem', border: 'none',
    borderRadius: '999px', background: 'linear-gradient(180deg,#B9853F 0%,#A4742F 100%)',
    color: '#FFF', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', minHeight: 46,
    boxShadow: '0 10px 24px rgba(185,133,63,0.30)',
  },
  btnGhost: {
    flex: '1 1 auto', minWidth: 130, padding: '0.8rem 1.2rem',
    border: '1px solid rgba(110,139,97,0.34)', borderRadius: '999px',
    background: 'rgba(255,255,255,0.65)', color: '#33503A', fontSize: '0.9rem',
    fontWeight: 700, cursor: 'pointer', minHeight: 46,
  },
  disclaimer: { margin: '0.1rem 0 0', fontSize: '0.7rem', color: 'rgba(60,72,55,0.55)', fontStyle: 'italic' },
};

// ── inner card (functional) ───────────────────────────────────────────────
function DailyFarmPlanCardInner() {
  const navigate = useNavigate();
  const [plan, setPlan] = React.useState(null);
  const [acted, setActed] = React.useState({}); // { taskId: 'done' | 'skipped' }

  React.useEffect(() => {
    let alive = true;
    // Dynamically import the never-throwing runtime so a failure here cannot
    // break the Home bundle/render. buildDailyPlan() reads localStorage +
    // optional probes and always returns a frozen plan.
    import('../../runtime/dailyPlan/DailyFarmPlanRuntime')
      .then((m) => {
        const built = _safe(() => m.buildDailyPlan({}), null);
        if (alive && built) setPlan(built);
      })
      .catch(() => { /* never block Home */ });
    return () => { alive = false; };
  }, []);

  const isGarden = !!plan && plan.growerType === 'gardener';
  const headLabel = isGarden
    ? tSafe('dailyPlan.titleGarden', "Today's Garden Plan")
    : tSafe('dailyPlan.title', "Today's Farm Plan");

  // Defensive: even before the plan resolves, render the heading + a gentle
  // prompt so the section never appears empty and never blocks.
  const tasks = _safe(() => (Array.isArray(plan && plan.tasks) ? plan.tasks.slice(0, 3) : []), []);

  const onAction = (task, status) => {
    _safe(() => {
      let note = null;
      if (status === 'note') {
        note = _safe(() => (typeof window !== 'undefined' && window.prompt
          ? window.prompt(tSafe('taskActions.addNote', 'Add note')) : null), null);
        if (note == null) return; // cancelled
      }
      _recordDailyPlanOutcome(task && task.id, status === 'note' ? 'note' : status, note);
      if (status === 'done' || status === 'skipped') {
        setActed((prev) => ({ ...(prev || {}), [task && task.id]: status }));
      }
    }, undefined);
  };

  const goScan = () => _safe(() => navigate('/scan'), undefined);
  const goFullPlan = () => _safe(() => navigate('/tasks'), undefined);

  return (
    <section style={ST.card} data-testid="home-daily-farm-plan" data-grower={isGarden ? 'gardener' : 'farmer'}>
      <p style={ST.label}>{headLabel}</p>

      {/* Top priority — always present (runtime guarantees a string). */}
      <h2 style={ST.priority}>
        {_safe(() => plan && plan.topPriority, '') ||
          (isGarden
            ? tSafe('dailyPlan.startGrowPlan', 'Start your grow plan')
            : tSafe('dailyPlan.startGrowPlan', 'Start your grow plan'))}
      </h2>

      {/* Up to three tasks for today. */}
      {tasks.map((t, i) => {
        const status = acted[t && t.id];
        return (
          <div
            key={(t && t.id) || i}
            style={{ ...ST.taskRow, ...(status ? ST.taskRowDone : null) }}
            data-testid="daily-plan-task"
          >
            <span style={ST.badge(t && t.urgency)}>
              {t && t.urgency === 'critical' ? tSafe('dailyPlan.criticalToday', 'Critical today')
                : t && t.urgency === 'recommended' ? tSafe('dailyPlan.recommendedWeek', 'Recommended this week')
                : tSafe('dailyPlan.watchMonitor', 'Watch / monitor')}
            </span>
            <p style={ST.taskTitle}>
              {t && t.titleKey ? tSafe(t.titleKey, t.title) : (t && t.title) || ''}
            </p>
            {t && t.explanation ? <p style={ST.taskBody}>{t.explanation}</p> : null}
            <div style={ST.actionRow}>
              <button type="button" style={ST.miniBtn} className="ff-tap"
                disabled={!!status} onClick={() => onAction(t, 'done')}
                data-testid="daily-plan-mark-done">
                {status === 'done' ? '✓ ' : ''}{tSafe('taskActions.markDone', 'Mark done')}
              </button>
              <button type="button" style={ST.miniBtn} className="ff-tap"
                disabled={!!status} onClick={() => onAction(t, 'skipped')}
                data-testid="daily-plan-skip">
                {status === 'skipped' ? '— ' : ''}{tSafe('taskActions.skip', 'Skip')}
              </button>
              <button type="button" style={ST.miniBtn} className="ff-tap"
                onClick={() => onAction(t, 'note')} data-testid="daily-plan-add-note">
                {tSafe('taskActions.addNote', 'Add note')}
              </button>
            </div>
          </div>
        );
      })}

      {/* Milestone + approximate time to harvest (approximate, never exact). */}
      {plan && plan.nextMilestone ? (
        <p style={ST.meta}>
          <span style={ST.metaStrong}>{tSafe('dailyPlan.nextMilestone', 'Next milestone')}: </span>
          {plan.nextMilestone}
        </p>
      ) : null}
      {plan && plan.timeframeToHarvest ? (
        <p style={ST.meta}>
          <span style={ST.metaStrong}>{tSafe('dailyPlan.timeframeToHarvest', 'Approximate time to harvest')}: </span>
          {plan.timeframeToHarvest}
        </p>
      ) : null}

      {/* Footer actions — Scan Plant + View Full Plan. */}
      <div style={ST.footer}>
        <button type="button" style={ST.btnPrimary} className="ff-tap"
          onClick={goScan} data-testid="daily-plan-scan">
          {tSafe('taskActions.scanPlant', 'Scan plant')}
        </button>
        <button type="button" style={ST.btnGhost} className="ff-tap"
          onClick={goFullPlan} data-testid="daily-plan-view-full">
          {tSafe('dailyPlan.viewFullPlan', 'View full plan')}
        </button>
      </div>

      <p style={ST.disclaimer}>{DISCLAIMER}</p>
    </section>
  );
}

// ── error boundary: any failure renders null so Home is never blocked ──────
export default class DailyFarmPlanCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — never block Home */ }
  render() {
    if (this.state.failed) return null;
    try { return <DailyFarmPlanCardInner />; } catch { return null; }
  }
}
