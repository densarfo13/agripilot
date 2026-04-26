/**
 * TodaysTasksCard — "Today's Tasks" panel.
 *
 * Reads the daily plan from taskScheduler.getTodayTasks and renders
 * a mobile-first list with one-tap Complete / Skip buttons.
 *
 * Props:
 *   farm     — profile/farm row. Accepts legacy { cropType, country }
 *              shape; the card maps it to the engine's expected keys.
 *   weather  — optional summarizeWeather-shape payload
 *
 * Completion + skip state is persisted by the scheduler so the UI
 * survives refreshes. A new local date triggers automatic
 * regeneration the next time the page renders.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getTodayTasks, markTaskComplete, skipTask,
} from '../lib/dailyTasks/taskScheduler.js';
import { useTranslation } from '../i18n/index.js';
import { tSafe } from '../i18n/tSafe.js';

const TONE_BY_PRIORITY = {
  high:   { border: 'rgba(252,165,165,0.35)', fg: '#FCA5A5', label: 'High' },
  medium: { border: 'rgba(253,224,71,0.35)',  fg: '#FDE68A', label: 'Medium' },
  low:    { border: 'rgba(134,239,172,0.25)', fg: '#86EFAC', label: 'Low' },
};

function normaliseFarm(farm) {
  if (!farm || typeof farm !== 'object') return null;
  return {
    id:                farm.id || farm._id || null,
    // `crop` is canonical (canonicalizeFarmPayload in lib/api.js).
    crop:              farm.crop || null,
    farmType:          farm.farmType || farm.farm_type || 'small_farm',
    cropStage:         farm.cropStage || farm.stage || null,
    countryCode:       farm.countryCode || farm.country || null,
  };
}

export default function TodaysTasksCard({ farm, weather = null } = {}) {
  const { t } = useTranslation();
  const mapped = useMemo(() => normaliseFarm(farm), [farm]);
  const [plan, setPlan] = useState(null);

  // Initial load + refresh when the farm / weather changes.
  useEffect(() => {
    if (!mapped) { setPlan(null); return; }
    setPlan(getTodayTasks({ farm: mapped, weather }));
  }, [mapped, weather]);

  const refresh = useCallback(() => {
    if (!mapped) return;
    setPlan(getTodayTasks({ farm: mapped, weather }));
  }, [mapped, weather]);

  const onComplete = useCallback((taskId) => {
    markTaskComplete(mapped && mapped.id, taskId);
    refresh();
  }, [mapped, refresh]);

  const onSkip = useCallback((taskId) => {
    skipTask(mapped && mapped.id, taskId);
    refresh();
  }, [mapped, refresh]);

  if (!mapped || !plan || !plan.tasks || plan.tasks.length === 0) return null;

  const heading = t('farmer.dailyTasks.title') || 'Today\u2019s tasks';
  const dateStr = plan.date;

  const totalOpen = plan.tasks.filter((x) => x.status === 'pending').length;

  return (
    <div style={S.wrap} data-testid="todays-tasks-panel">
      <div style={S.header}>
        <div>
          <div style={S.title}>{heading}</div>
          <div style={S.date}>{dateStr}</div>
        </div>
        <div style={S.counter}>
          {totalOpen === 0
            ? (t('farmer.dailyTasks.allDone') || 'All done \u2713')
            : `${totalOpen} ${t('farmer.dailyTasks.open') || 'open'}`}
        </div>
      </div>

      <div style={S.stack}>
        {plan.tasks.map((task) => {
          const tone = TONE_BY_PRIORITY[task.priority] || TONE_BY_PRIORITY.medium;
          const done = task.status === 'complete';
          const skipped = task.status === 'skipped';
          return (
            <div
              key={task.id}
              style={{
                ...S.task,
                border: `1px solid ${tone.border}`,
                opacity: done || skipped ? 0.55 : 1,
              }}
              data-testid={`todays-task-${task.templateId}`}
            >
              <div style={S.taskHeader}>
                <span style={{ ...S.priorityPill, color: tone.fg, borderColor: tone.border }}>
                  {tone.label}
                </span>
                {done && <span style={S.status}>{t('farmer.dailyTasks.done') || 'Completed'}</span>}
                {skipped && <span style={S.status}>{t('farmer.dailyTasks.skipped') || 'Skipped'}</span>}
              </div>
              <div style={{ ...S.taskTitle, textDecoration: done ? 'line-through' : 'none' }}>
                {task.title}
              </div>
              {task.description && (
                <div style={S.taskBody}>{task.description}</div>
              )}
              {task.why && (
                <div style={S.why}>
                  <span style={S.whyLabel}>
                    {t('farmer.dailyTasks.why') || 'Why'}:
                  </span>{' '}{task.why}
                </div>
              )}
              {!done && !skipped && (
                <div style={S.actions}>
                  <button
                    type="button"
                    style={S.completeBtn}
                    onClick={() => onComplete(task.id)}
                    data-testid={`todays-task-complete-${task.templateId}`}
                  >
                    {/* Cleanup: route through tSafe + the populated
                        actions.markDone key so a missing
                        farmer.dailyTasks.markDone key cannot leak
                        the English literal in non-English UIs. */}
                    {tSafe('actions.markDone', '')}
                  </button>
                  <button
                    type="button"
                    style={S.skipBtn}
                    onClick={() => onSkip(task.id)}
                    data-testid={`todays-task-skip-${task.templateId}`}
                  >
                    {tSafe('actions.skip', '')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const S = {
  wrap: {
    width: '100%',
    background: '#111D2E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1rem 1.125rem 1.125rem',
    marginTop: '1rem',
    color: '#fff',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: '0.875rem',
  },
  title: { fontSize: '1rem', fontWeight: 700, color: '#E2E8F0' },
  date: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.125rem' },
  counter: {
    fontSize: '0.75rem', color: '#86EFAC',
    border: '1px solid rgba(134,239,172,0.25)',
    padding: '0.25rem 0.5rem', borderRadius: '999px',
    background: 'rgba(134,239,172,0.08)',
    whiteSpace: 'nowrap',
  },
  stack: { display: 'flex', flexDirection: 'column', gap: '0.625rem' },
  task: {
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    padding: '0.75rem 0.875rem',
    display: 'flex', flexDirection: 'column', gap: '0.375rem',
  },
  taskHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  priorityPill: {
    fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.04em', padding: '0.125rem 0.5rem',
    borderRadius: '999px', border: '1px solid',
  },
  status: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' },
  taskTitle: { fontSize: '0.9375rem', fontWeight: 600, color: '#F8FAFC', lineHeight: 1.35 },
  taskBody: { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.45 },
  why: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 },
  whyLabel: { color: 'rgba(255,255,255,0.75)', fontWeight: 600 },
  actions: { display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' },
  completeBtn: {
    background: '#22C55E', color: '#000', border: 'none',
    borderRadius: 10, padding: '0.5rem 0.875rem',
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
  skipBtn: {
    background: 'transparent', color: 'rgba(255,255,255,0.75)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 10, padding: '0.5rem 0.875rem',
    fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
  },
};
