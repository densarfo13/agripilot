/**
 * TodaysPriorityCard — V2 daily plan surface for the habit system.
 *
 * Spec coverage (Daily habit system §2, §3, §5, §6)
 *   §2 "Today's priority" — 1 main action + 1-2 optional
 *   §3 Completion feedback — task-specific success message
 *   §5 Progress tracking — % completion + N of M tasks done
 *   §6 Connect to value — surfaces each task's `why` so the
 *                         action's outcome is visible at-tap
 *
 * Behaviour
 *   • Reuses the existing `useDailyEngagement` hook + the engine's
 *     output. The first task is the priority; the next 1-2 are
 *     optional. Anything beyond is dropped.
 *   • Reads completion state from `engagementHistory` so a
 *     refresh restores the user's progress.
 *   • Marking a task done fires:
 *       - `markTaskCompleted` (existing flow → bumps streak +
 *         emits `farroway:engagement_changed`)
 *       - `engagement_task_completed` analytics
 *       - `daily_priority_complete` (when the priority row is
 *         the one completed)
 *       - a value-aware toast ("Watering done — your tomatoes
 *         will hold through the heat") instead of the generic
 *         "Great job" line
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Never throws.
 *   • Self-suppresses behind the `dailyHabit` flag (parent gate).
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import useDailyEngagement from '../../hooks/useDailyEngagement.js';
import { getRecentCompletions } from '../../engine/engagementHistory.js';
import { useToast, ToastContainer } from '../intelligence/Toast.jsx';

function _readActiveFarm() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_active_farm');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

function _todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const S = {
  card: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '14px 16px 16px',
    color: '#EAF2FF',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  headRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#86EFAC',
  },
  progressLine: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.78)',
  },
  bar: {
    height: 6,
    background: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: '#22C55E',
    borderRadius: 999,
    transition: 'width 220ms ease-out',
  },
  priorityRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '14px 14px',
    borderRadius: 14,
    background: 'linear-gradient(135deg, rgba(34,197,94,0.20), rgba(34,197,94,0.10))',
    border: '1px solid #22C55E',
    boxShadow: '0 4px 18px rgba(34,197,94,0.18)',
  },
  priorityRowDone: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    boxShadow: 'none',
  },
  optionalRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  rowDone: { opacity: 0.55 },
  badge: {
    flex: '0 0 auto',
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: '#22C55E',
    color: '#0B1D34',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 800,
  },
  badgeOptional: {
    background: 'rgba(255,255,255,0.10)',
    color: '#fff',
    width: 26,
    height: 26,
    fontSize: 12,
  },
  body: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
  priorityLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#86EFAC',
  },
  title: { fontSize: 16, fontWeight: 800, color: '#fff' },
  titleOptional: { fontSize: 14, fontWeight: 700, color: '#fff' },
  why: { fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.45 },
  cta: {
    appearance: 'none',
    border: 'none',
    padding: '8px 14px',
    borderRadius: 10,
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
  },
  ctaOptional: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
  },
  ctaDone: {
    background: 'rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.55)',
    cursor: 'default',
  },
};

export default function TodaysPriorityCard({ farm, weather = null, style } = {}) {
  useTranslation();
  const navigate = useNavigate();
  const { toasts, showToast, dismissToast } = useToast();

  const activeFarm = useMemo(() => farm || _readActiveFarm(), [farm]);

  const plant   = (activeFarm?.crop || activeFarm?.plantId || '').toString();
  const country = activeFarm?.country || '';
  const region  = activeFarm?.region  || '';
  const stage   = activeFarm?.cropStage || null;
  const plantingStatus = activeFarm?.plantingStatus || null;

  const { plan, completeTask } = useDailyEngagement({
    plant, country, region, stage, plantingStatus, weather,
    farmId: activeFarm?.id || null,
  });

  // Today's completion set drives the row dim + the % bar. The
  // hook re-runs when the engagement-history change event fires.
  const completedToday = useMemo(() => {
    try {
      const today = _todayISO();
      const recent = getRecentCompletions(2) || [];
      return new Set(
        recent
          .filter((r) => String(r?.completedAt || '').slice(0, 10) === today)
          .map((r) => r.taskId),
      );
    } catch { return new Set(); }
  }, [plan]);

  // Visual session-state for instant feedback (the hook below
  // re-renders on the canonical event, but the toast + dim shouldn't
  // wait one render).
  const [doneIds, setDoneIds] = useState(() => new Set());

  const tasks = (plan && Array.isArray(plan.tasks)) ? plan.tasks : [];
  const priorityTask = tasks[0] || null;
  // Spec §2: 1 main + 1-2 optional. Hard cap at 2 optional rows.
  const optionalTasks = tasks.slice(1, 3);

  const totalCount = (priorityTask ? 1 : 0) + optionalTasks.length;
  const doneCount  = tasks.slice(0, 1 + optionalTasks.length)
    .filter((t) => completedToday.has(t.id) || doneIds.has(t.id)).length;
  const pctDone = totalCount > 0
    ? Math.round((doneCount / totalCount) * 100)
    : 0;

  const handleMarkDone = useCallback((task, isPriority) => {
    if (!task) return;
    try { completeTask(task); } catch { /* swallow */ }
    setDoneIds((prev) => {
      const next = new Set(prev);
      next.add(task.id);
      return next;
    });
    try {
      trackEvent('engagement_task_completed', { taskId: task.id, kind: task.kind });
      if (isPriority) {
        trackEvent('daily_priority_complete', {
          taskId: task.id,
          kind:   task.kind,
        });
      }
    } catch { /* swallow */ }

    // Spec §3: success message reinforces the value of the action
    // taken. Falls back to the engine's `why` text, then to the
    // generic "on track" line.
    const valueLine = task.why
      || tStrict('engagement.success.toast', 'Great job! You\u2019re on track \uD83C\uDF31');
    try { showToast(valueLine, 'success'); }
    catch { /* swallow */ }
  }, [completeTask, showToast]);

  const handleScanRoute = useCallback((task) => {
    handleMarkDone(task, false);
    try { navigate('/scan'); }
    catch {
      try { navigate('/scan-crop'); } catch { /* swallow */ }
    }
  }, [handleMarkDone, navigate]);

  if (!priorityTask) return null;

  const priorityDone = completedToday.has(priorityTask.id) || doneIds.has(priorityTask.id);
  const priorityIsScan = priorityTask.kind === 'scan';
  const priorityTitle  = priorityTask.titleKey
    ? tStrict(priorityTask.titleKey, priorityTask.title || priorityTask.id)
    : (priorityTask.title || priorityTask.id);
  const priorityWhy = priorityTask.whyKey
    ? tStrict(priorityTask.whyKey, priorityTask.why || '')
    : (priorityTask.why || '');

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="todays-priority-card"
    >
      <div style={S.headRow}>
        <span style={S.eyebrow}>
          {tStrict('habit.title', 'Today\u2019s priority')}
        </span>
        <span style={S.progressLine}>
          {tStrict('habit.progress', '{done}/{total} done')
            .replace('{done}',  String(doneCount))
            .replace('{total}', String(totalCount))}
        </span>
      </div>
      <div style={S.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pctDone}>
        <div style={{ ...S.barFill, width: `${pctDone}%` }} />
      </div>

      <div
        style={{ ...S.priorityRow, ...(priorityDone ? S.priorityRowDone : null) }}
        data-testid="todays-priority-main"
        data-done={priorityDone ? 'true' : 'false'}
      >
        <span style={S.badge}>
          {priorityDone ? '\u2714' : '1'}
        </span>
        <span style={S.body}>
          <span style={S.priorityLabel}>
            {tStrict('habit.priorityTag', 'Priority')}
          </span>
          <span style={S.title}>{priorityTitle}</span>
          {priorityWhy ? <span style={S.why}>{priorityWhy}</span> : null}
        </span>
        <button
          type="button"
          onClick={priorityDone
            ? undefined
            : (priorityIsScan
                ? () => handleScanRoute(priorityTask)
                : () => handleMarkDone(priorityTask, true))}
          disabled={priorityDone}
          style={{ ...S.cta, ...(priorityDone ? S.ctaDone : null) }}
          data-testid="todays-priority-main-cta"
        >
          {priorityDone
            ? tStrict('engagement.task.done', 'Done')
            : (priorityIsScan
                ? tStrict('engagement.task.scan', 'Scan')
                : tStrict('habit.priorityCta', 'Do it'))}
        </button>
      </div>

      {optionalTasks.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ ...S.eyebrow, color: 'rgba(255,255,255,0.55)' }}>
            {tStrict('habit.optionalTag', 'Optional today')}
          </span>
          {optionalTasks.map((task) => {
            const done = completedToday.has(task.id) || doneIds.has(task.id);
            const isScan = task.kind === 'scan';
            const titleStr = task.titleKey
              ? tStrict(task.titleKey, task.title || task.id)
              : (task.title || task.id);
            const whyStr = task.whyKey
              ? tStrict(task.whyKey, task.why || '')
              : (task.why || '');
            return (
              <div
                key={task.id}
                style={{ ...S.optionalRow, ...(done ? S.rowDone : null) }}
                data-testid={`todays-optional-${task.id}`}
                data-done={done ? 'true' : 'false'}
              >
                <span style={{ ...S.badge, ...S.badgeOptional }}>
                  {done ? '\u2714' : (isScan ? '\uD83D\uDCF7' : '+')}
                </span>
                <span style={S.body}>
                  <span style={S.titleOptional}>{titleStr}</span>
                  {whyStr ? <span style={S.why}>{whyStr}</span> : null}
                </span>
                <button
                  type="button"
                  onClick={done
                    ? undefined
                    : (isScan
                        ? () => handleScanRoute(task)
                        : () => handleMarkDone(task, false))}
                  disabled={done}
                  style={{ ...S.ctaOptional, ...(done ? S.ctaDone : null) }}
                  data-testid={`todays-optional-cta-${task.id}`}
                >
                  {done
                    ? tStrict('engagement.task.done', 'Done')
                    : (isScan
                        ? tStrict('engagement.task.scan', 'Scan')
                        : tStrict('engagement.task.markDone', 'Mark done'))}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </section>
  );
}
