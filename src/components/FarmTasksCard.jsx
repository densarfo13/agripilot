/**
 * FarmTasksCard — displays rules-based tasks for the current farm.
 *
 * Fetches tasks from GET /api/v2/farm-tasks/:farmId/tasks.
 * Tasks are farm-scoped: clears and re-fetches when currentFarmId changes.
 * Shows priority, dueLabel, reason for each task.
 * Empty state when no tasks exist.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { getFarmTasks, completeTask } from '../lib/api.js';
import { useNetwork } from '../context/NetworkContext.jsx';
import { safeTrackEvent } from '../lib/analytics.js';
import { buildTaskListViewModels, getTaskStateStyle } from '../domain/tasks/index.js';
import { getLocalizedTaskTitle } from '../utils/taskTranslations.js';

const PRIORITY_LABELS = {
  high: 'farmTasks.priorityHigh',
  medium: 'farmTasks.priorityMedium',
  low: 'farmTasks.priorityLow',
};

// Task completion is now server-side via V2FarmTaskCompletion.
// GET returns only pending tasks; POST /:taskId/complete marks done.

export default function FarmTasksCard({ onSetStage, weatherGuidance }) {
  const { currentFarmId, profile } = useProfile();
  const { isOnline } = useNetwork();
  const { t, lang } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true); // start true — fetch fires on mount
  const [fetched, setFetched] = useState(false); // track if we ever fetched successfully
  const [error, setError] = useState(null);
  const [crop, setCrop] = useState('');
  const [stage, setStage] = useState('');
  const [stageIsDefault, setStageIsDefault] = useState(false);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [completing, setCompleting] = useState(null); // taskId currently completing
  const prevFarmIdRef = useRef(null);

  async function handleDone(task) {
    if (!currentFarmId || completing) return;
    setCompleting(task.id);
    safeTrackEvent('task_clicked', { farmId: currentFarmId, taskId: task.id });
    try {
      await completeTask(currentFarmId, task.id, {
        title: task.title,
        priority: task.priority,
        actionType: task.actionType || null,
      });
      // Remove from list optimistically
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setCompletedIds((prev) => new Set([...prev, task.id]));
      safeTrackEvent('task_completed', { farmId: currentFarmId, taskId: task.id, title: task.title });
    } catch (err) {
      // Offline fallback
      if (!navigator.onLine || !err.status) {
        try {
          const { enqueue } = await import('../utils/offlineQueue.js');
          const { getIdempotencyKey } = await import('../lib/idempotency.js');
          await enqueue({
            method: 'POST',
            url: `/api/v2/farm-tasks/${currentFarmId}/tasks/${encodeURIComponent(task.id)}/complete`,
            data: { title: task.title, priority: task.priority, actionType: task.actionType || null },
            entityType: 'task',
            actionType: 'complete',
            idempotencyKey: getIdempotencyKey('task_completion', `${currentFarmId}:${task.id}`),
          });
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
          setCompletedIds((prev) => new Set([...prev, task.id]));
          safeTrackEvent('task_completed_offline', { farmId: currentFarmId, taskId: task.id });
        } catch { /* queue failed — task stays visible */ }
      }
    } finally {
      setCompleting(null);
    }
  }

  const fetchTasks = useCallback(async (farmId) => {
    if (!farmId) return;
    if (!isOnline) {
      // Offline — stop loading spinner, show offline message instead of hanging
      setLoading(false);
      if (!fetched) setError(t('farmTasks.offline'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.log('FarmTasksCard: fetching tasks for farm', farmId);
      const data = await getFarmTasks(farmId);
      console.log('FarmTasksCard: received', (data.tasks || []).length, 'tasks');
      setTasks(data.tasks || []);
      setCrop(data.crop || '');
      setStage(data.stage || '');
      setStageIsDefault(data.stageIsDefault === true);
      setFetched(true);
    } catch (err) {
      console.error('Failed to fetch farm tasks:', err);
      setError(err.message || 'Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [isOnline, fetched, t]);

  // Fetch on mount, when farm changes, OR when coming back online
  useEffect(() => {
    if (!currentFarmId) {
      setLoading(false);
      return;
    }
    if (currentFarmId !== prevFarmIdRef.current) {
      // Farm switched or first mount — clear and fetch
      setTasks([]);
      setFetched(false);
      prevFarmIdRef.current = currentFarmId;
      fetchTasks(currentFarmId);
    } else if (!fetched && isOnline) {
      // Same farm, but we haven't fetched yet (was offline, now online)
      fetchTasks(currentFarmId);
    }
  }, [currentFarmId, isOnline, fetched, fetchTasks]);

  // Don't render if no profile
  if (!profile) return null;

  if (loading) {
    return (
      <div style={S.card}>
        <h3 style={S.title}>{t('farmTasks.title')}</h3>
        <div style={S.loadingText}>{t('farmTasks.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.card}>
        <h3 style={S.title}>{t('farmTasks.title')}</h3>
        <div style={S.errorText}>{error}</div>
        {isOnline && currentFarmId && (
          <button
            type="button"
            onClick={() => fetchTasks(currentFarmId)}
            style={S.retryBtn}
          >
            {t('common.retry')}
          </button>
        )}
      </div>
    );
  }

  // Build view models for all tasks (centralized localization + severity)
  const viewModels = buildTaskListViewModels({ tasks, weatherGuidance, language: lang, t, mode: 'standard' });
  const vmByTaskId = Object.fromEntries(viewModels.map(vm => [vm.taskId, vm]));

  // Server returns only pending tasks; sort by priority
  const highTasks = tasks.filter((t) => t.priority === 'high');
  const otherTasks = tasks.filter((t) => t.priority !== 'high');
  const doneCount = completedIds.size;

  return (
    <div style={S.card} data-testid="farm-tasks-card">
      <div style={S.headerRow}>
        <div>
          <h3 style={S.title}>{t('farmTasks.title')}</h3>
          {crop && stage && (
            <p style={S.subtitle}>{crop} \u2022 {stage.replace(/_/g, ' ')}</p>
          )}
        </div>
        {tasks.length > 0 && (
          <div style={S.countBadge}>{tasks.length} {t('farmTasks.tasks')}</div>
        )}
      </div>

      {stageIsDefault && onSetStage && (
        <div
          style={S.stagePrompt}
          data-testid="stage-prompt"
          onClick={() => {
            safeTrackEvent('farmTasks.stage_prompt_tapped', { farmId: currentFarmId });
            onSetStage();
          }}
        >
          <span style={S.stagePromptIcon}>📊</span>
          <div>
            <div style={S.stagePromptText}>{t('farmTasks.setStagePrompt')}</div>
            <div style={S.stagePromptHint}>{t('farmTasks.setStageHint')}</div>
          </div>
        </div>
      )}

      {tasks.length === 0 && !stageIsDefault && (
        <div style={S.emptyText}>{t('farmTasks.noTasks')}</div>
      )}

      {/* ─── Pending tasks (high first, then others) ─── */}
      <div style={S.taskList}>
        {[...highTasks, ...otherTasks].map((task) => {
          // View model — centralized localization + severity + styling
          const vm = vmByTaskId[task.id];
          const sty = vm ? vm.stateStyle : getTaskStateStyle('normal');
          const showAccent = vm ? vm.severity !== 'normal' : false;

          // Notes are server-side English only — hide for non-English users
          const showNotes = lang === 'en';

          return (
            <div
              key={task.id}
              style={{
                ...S.taskItem,
                ...(showAccent ? { borderLeft: sty.accentBorder } : {}),
              }}
            >
              <div style={S.taskHeader}>
                <div style={S.taskTitleRow}>
                  <button
                    type="button"
                    onClick={() => handleDone(task)}
                    disabled={completing === task.id}
                    style={{
                      ...S.doneBtn,
                      ...(completing === task.id ? { opacity: 0.5 } : {}),
                    }}
                    aria-label="Mark as done"
                    data-testid={`done-btn-${task.id}`}
                  >
                    {completing === task.id
                      ? <span style={S.doneBtnSpinner} />
                      : <span style={S.doneBtnCircle} />}
                  </button>
                  <span style={S.taskTitle}>{vm?.title || getLocalizedTaskTitle(task.id, task.title, lang)}</span>
                </div>
                <div style={S.taskMeta}>
                  <span style={{ ...S.priorityLabel, color: sty.priorityColor }}>
                    {t(PRIORITY_LABELS[task.priority] || PRIORITY_LABELS.low)}
                  </span>
                  <span style={S.dueLabel}>{task.dueLabel}</span>
                </div>
              </div>
              {vm?.descriptionShort && (
                <div style={S.taskDesc}>{vm.descriptionShort}</div>
              )}
              {showNotes && task.reason && (
                <div style={S.taskReason}>
                  <span style={S.reasonIcon}>💡</span>
                  <span>{task.reason}</span>
                </div>
              )}
              {showNotes && task.seasonalNote && (
                <div style={S.seasonalNote}>
                  <span style={S.reasonIcon}>🗓</span>
                  <span>{task.seasonalNote}</span>
                </div>
              )}
              {showNotes && task.weatherNote && (
                <div style={S.weatherNote}>
                  <span style={S.reasonIcon}>🌦</span>
                  <span>{task.weatherNote}</span>
                </div>
              )}
              {showNotes && task.riskNote && (
                <div style={S.riskNote}>
                  <span style={S.reasonIcon}>🐛</span>
                  <span>{task.riskNote}</span>
                </div>
              )}
              {showNotes && task.inputNote && (
                <div style={S.inputNote}>
                  <span style={S.reasonIcon}>🧪</span>
                  <span>{task.inputNote}</span>
                </div>
              )}
              {showNotes && task.harvestNote && (
                <div style={S.harvestNote}>
                  <span style={S.reasonIcon}>🌾</span>
                  <span>{task.harvestNote}</span>
                </div>
              )}
              {showNotes && task.economicsNote && (
                <div style={S.economicsNote}>
                  <span style={S.reasonIcon}>💰</span>
                  <span>{task.economicsNote}</span>
                </div>
              )}
              {showNotes && task.benchmarkNote && (
                <div style={S.benchmarkNote}>
                  <span style={S.reasonIcon}>📈</span>
                  <span>{task.benchmarkNote}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Completed count indicator ─── */}
      {doneCount > 0 && (
        <div style={S.doneSection}>
          <div style={S.doneSectionHeader}>
            <span style={S.doneCheckIcon}>✅</span>
            <span style={S.doneSectionLabel}>
              {doneCount} {doneCount === 1 ? t('farmTasks.taskDone') : t('farmTasks.tasksDone')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1.25rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: 0,
    color: '#fff',
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '0.25rem',
    textTransform: 'capitalize',
  },
  countBadge: {
    fontSize: '0.8125rem',
    color: '#86EFAC',
    fontWeight: 600,
  },
  loadingText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.75rem',
  },
  errorText: {
    fontSize: '0.875rem',
    color: '#FCA5A5',
    marginTop: '0.75rem',
  },
  retryBtn: {
    marginTop: '0.75rem',
    padding: '0.5rem 1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '0.75rem',
  },
  taskList: {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  taskItem: {
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '1rem',
  },
  // taskItemHigh removed — accent border is now computed from PRIORITY_ACCENT
  taskHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  taskTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  doneBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s',
  },
  doneBtnCircle: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: 'transparent',
  },
  doneBtnSpinner: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.2)',
    borderTopColor: '#22C55E',
    animation: 'farroway-spin 0.6s linear infinite',
  },
  taskTitle: {
    fontWeight: 600,
    color: '#fff',
    fontSize: '0.9375rem',
  },
  taskMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
  },
  priorityLabel: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  dueLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.45)',
  },
  taskDesc: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.5rem',
    lineHeight: 1.5,
  },
  taskReason: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    marginTop: '0.5rem',
    fontSize: '0.75rem',
    color: '#FDE68A',
    lineHeight: 1.4,
  },
  reasonIcon: {
    flexShrink: 0,
    fontSize: '0.75rem',
  },
  seasonalNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    marginTop: '0.375rem',
    fontSize: '0.6875rem',
    color: '#93C5FD',
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  weatherNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    marginTop: '0.375rem',
    fontSize: '0.6875rem',
    color: '#86EFAC',
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  riskNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    marginTop: '0.375rem',
    fontSize: '0.6875rem',
    color: '#FCA5A5',
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  inputNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    marginTop: '0.375rem',
    fontSize: '0.6875rem',
    color: '#C4B5FD',
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  harvestNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    marginTop: '0.375rem',
    fontSize: '0.6875rem',
    color: '#FDBA74',
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  economicsNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    marginTop: '0.375rem',
    fontSize: '0.6875rem',
    color: '#86EFAC',
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  benchmarkNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    marginTop: '0.375rem',
    fontSize: '0.6875rem',
    color: '#A5B4FC',
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  stagePrompt: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    marginTop: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    background: 'rgba(250,204,21,0.08)',
    border: '1px solid rgba(250,204,21,0.25)',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  stagePromptIcon: {
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  stagePromptText: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#FDE68A',
  },
  stagePromptHint: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.45)',
    marginTop: '0.125rem',
  },
  // ─── Done section ──────────────
  doneSection: {
    marginTop: '1rem',
    padding: '0.75rem',
    borderRadius: '12px',
    background: 'rgba(34,197,94,0.05)',
    border: '1px solid rgba(34,197,94,0.15)',
  },
  doneSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    marginBottom: '0.5rem',
  },
  doneCheckIcon: {
    fontSize: '0.875rem',
  },
  doneSectionLabel: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#86EFAC',
  },
  doneItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  undoBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: 'none',
    background: '#22C55E',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  undoBtnCheck: {
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  doneTitle: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.35)',
    textDecoration: 'line-through',
  },
};
