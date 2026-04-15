/**
 * AllTasksPage — standalone page at /tasks showing all tasks grouped by priority.
 *
 * Fetches tasks for currentFarmId, groups into High / Medium / Low sections.
 * Supports offline: enqueues completeTask to offlineQueue on failure.
 * Dark theme, inline styles, all text via useTranslation().
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { useNetwork } from '../context/NetworkContext.jsx';
import { getFarmTasks, completeTask } from '../lib/api.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { buildTaskListViewModels, getTaskStateStyle } from '../domain/tasks/index.js';
import { NAV_ICONS, getTaskActionIcon } from '../lib/farmerIcons.js';

const SECTIONS = [
  { key: 'high', labelKey: 'farmTasks.priorityHigh' },
  { key: 'medium', labelKey: 'farmTasks.priorityMedium' },
  { key: 'low', labelKey: 'farmTasks.priorityLow' },
];

const FILTERS = [
  { key: 'today', labelKey: 'allTasks.filterToday', fallback: 'Today' },
  { key: 'upcoming', labelKey: 'allTasks.filterUpcoming', fallback: 'Upcoming' },
  { key: 'completed', labelKey: 'allTasks.filterCompleted', fallback: 'Completed' },
];

export default function AllTasksPage() {
  const navigate = useNavigate();
  const { currentFarmId, profile } = useProfile();
  const { t, lang } = useTranslation();
  const { isOnline } = useNetwork();

  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [filter, setFilter] = useState('today');

  const fetchTasks = useCallback(async () => {
    if (!currentFarmId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFarmTasks(currentFarmId);
      setTasks(data.tasks || []);
      setCompletedTasks([]);
    } catch (err) {
      console.error('AllTasksPage: failed to fetch tasks', err);
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [currentFarmId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function handleComplete(task) {
    if (!currentFarmId || completing) return;
    setCompleting(task.id);
    try {
      await completeTask(currentFarmId, task.id, {
        title: task.title,
        priority: task.priority,
        actionType: task.actionType || null,
      });
      // Optimistic: move to completed list
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setCompletedTasks((prev) => [...prev, { ...task, completedAt: new Date().toISOString() }]);
      safeTrackEvent('task_completed', {
        farmId: currentFarmId,
        taskId: task.id,
        title: task.title,
        source: 'all_tasks_page',
      });
    } catch (err) {
      // Offline fallback
      if (!navigator.onLine || !err.status) {
        try {
          const { enqueue } = await import('../utils/offlineQueue.js');
          await enqueue({
            method: 'POST',
            url: `/api/v2/farm-tasks/${currentFarmId}/tasks/${encodeURIComponent(task.id)}/complete`,
            data: { title: task.title, priority: task.priority, actionType: task.actionType || null },
          });
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
          setCompletedTasks((prev) => [...prev, { ...task, completedAt: new Date().toISOString() }]);
          safeTrackEvent('task_completed_offline', {
            farmId: currentFarmId,
            taskId: task.id,
            source: 'all_tasks_page',
          });
        } catch {
          /* queue failed — task stays visible */
        }
      }
    } finally {
      setCompleting(null);
    }
  }

  // Build view models for all tasks (centralized localization + severity)
  const viewModels = buildTaskListViewModels({ tasks, weatherGuidance: null, language: lang, t, mode: 'standard' });
  const vmByTaskId = Object.fromEntries(viewModels.map(vm => [vm.taskId, vm]));

  // Filter: today = high priority, upcoming = medium+low, completed = locally completed
  const filteredTasks = filter === 'completed' ? [] : filter === 'today'
    ? tasks.filter((t) => t.priority === 'high')
    : tasks.filter((t) => t.priority !== 'high');

  // Group filtered tasks by priority
  const grouped = {
    high: filteredTasks.filter((t) => t.priority === 'high'),
    medium: filteredTasks.filter((t) => t.priority === 'medium'),
    low: filteredTasks.filter((t) => t.priority === 'low'),
  };

  // Filter counts for chips
  const filterCounts = {
    today: tasks.filter((t) => t.priority === 'high').length,
    upcoming: tasks.filter((t) => t.priority !== 'high').length,
    completed: completedTasks.length,
  };

  if (!profile) return null;

  return (
    <div style={S.page} data-testid="all-tasks-page">
      {/* Header */}
      <div style={S.header}>
        <span style={S.pageIcon}>{NAV_ICONS.tasks}</span>
        <h1 style={S.pageTitle}>{t('allTasks.title') || 'All Tasks'}</h1>
      </div>

      {/* Filter row */}
      {!loading && !error && (tasks.length > 0 || completedTasks.length > 0) && (
        <div style={S.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = filterCounts[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                style={{
                  ...S.filterChip,
                  ...(active ? S.filterChipActive : {}),
                }}
                data-testid={`filter-${f.key}`}
              >
                <span>{t(f.labelKey) || f.fallback}</span>
                {count > 0 && (
                  <span style={{
                    ...S.filterCount,
                    ...(active ? S.filterCountActive : {}),
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={S.loadingWrap}>
          <span style={S.spinner} />
          <span style={S.loadingText}>{t('farmTasks.loading') || 'Loading...'}</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={S.errorCard}>
          <p style={S.errorText}>{error}</p>
          {isOnline && (
            <button type="button" onClick={fetchTasks} style={S.retryBtn}>
              {t('common.retry') || 'Retry'}
            </button>
          )}
        </div>
      )}

      {/* Empty state (only when no tasks at all AND no completed) */}
      {!loading && !error && tasks.length === 0 && completedTasks.length === 0 && (
        <div style={S.emptyWrap}>
          <div style={S.emptyIcon}>&#9989;</div>
          <p style={S.emptyText}>{t('allTasks.allCaughtUp') || 'All caught up!'}</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={S.dashboardBtn}
          >
            {t('allTasks.backToDashboard') || 'Back to Dashboard'}
          </button>
        </div>
      )}

      {/* Completed tasks view */}
      {!loading && !error && filter === 'completed' && (
        <div style={S.sections}>
          {completedTasks.length === 0 ? (
            <div style={S.emptyFilterWrap}>
              <p style={S.emptyFilterText}>{t('allTasks.noCompleted') || 'No completed tasks yet'}</p>
            </div>
          ) : (
            completedTasks.map((task) => (
              <div key={task.id} style={S.completedCard}>
                <span style={S.completedCheck}>{'\u2705'}</span>
                <div style={S.taskContent}>
                  <div style={S.taskTopRow}>
                    <span style={S.taskIcon}>{getTaskActionIcon(task.actionType)}</span>
                    <span style={S.completedTitle}>{task.title}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Empty filter state (for today/upcoming with no matching tasks) */}
      {!loading && !error && filter !== 'completed' && filteredTasks.length === 0 && tasks.length > 0 && (
        <div style={S.sections}>
          <div style={S.emptyFilterWrap}>
            <p style={S.emptyFilterText}>
              {filter === 'today'
                ? (t('allTasks.noUrgent') || 'No urgent tasks today')
                : (t('allTasks.noUpcoming') || 'No upcoming tasks')}
            </p>
          </div>
        </div>
      )}

      {/* Task sections */}
      {!loading && !error && filter !== 'completed' && filteredTasks.length > 0 && (
        <div style={S.sections}>
          {SECTIONS.map((section) => {
            const sectionTasks = grouped[section.key];
            if (sectionTasks.length === 0) return null;
            // Get severity-based color from first task's view model (section-level)
            const sampleVm = vmByTaskId[sectionTasks[0]?.id];
            const sectionStyle = sampleVm ? getTaskStateStyle(sampleVm.severity) : getTaskStateStyle('normal');
            const sectionColor = sectionStyle.accentColor;
            return (
              <div key={section.key} style={S.section}>
                <div style={{ ...S.sectionHeader, borderLeftColor: sectionColor }}>
                  <span style={{ ...S.sectionDot, background: sectionColor }} />
                  <span style={{ ...S.sectionLabel, color: sectionColor }}>
                    {t(section.labelKey)} ({sectionTasks.length})
                  </span>
                </div>
                {sectionTasks.map((task) => {
                  const vm = vmByTaskId[task.id];
                  const sty = vm ? vm.stateStyle : getTaskStateStyle('normal');
                  return (
                    <div key={task.id} style={S.taskCard}>
                      <button
                        type="button"
                        onClick={() => handleComplete(task)}
                        disabled={completing === task.id}
                        style={{
                          ...S.doneBtn,
                          ...(completing === task.id ? { opacity: 0.5 } : {}),
                        }}
                        aria-label={t('taskAction.markDone') || 'Mark as done'}
                        data-testid={`done-btn-${task.id}`}
                      >
                        {completing === task.id ? (
                          <span style={S.doneBtnSpinner} />
                        ) : (
                          <span style={S.doneBtnCircle} />
                        )}
                      </button>
                      <div style={S.taskContent}>
                        <div style={S.taskTopRow}>
                          <span style={S.taskIcon}>{getTaskActionIcon(task.actionType)}</span>
                          <span style={S.taskTitle}>{vm?.title || task.title}</span>
                          <span
                            style={{
                              ...S.priorityBadge,
                              color: sty.priorityColor,
                              background: sty.accentBg,
                            }}
                          >
                            {t(SECTIONS.find((s) => s.key === task.priority)?.labelKey || '')}
                          </span>
                        </div>
                        {vm?.descriptionShort && (
                          <p style={S.taskDesc}>{vm.descriptionShort}</p>
                        )}
                        {task.dueLabel && (
                          <span style={S.dueLabel}>{task.dueLabel}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    padding: '0 0 1rem 0',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '1.125rem 1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  pageIcon: {
    fontSize: '1.25rem',
  },
  pageTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    margin: 0,
  },
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '3rem 1rem',
  },
  spinner: {
    display: 'inline-block',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.06)',
    borderTopColor: '#22C55E',
    animation: 'farroway-spin 0.6s linear infinite',
  },
  loadingText: {
    fontSize: '0.875rem',
    color: '#6F8299',
  },
  errorCard: {
    margin: '1.5rem 1.25rem',
    padding: '1.125rem',
    borderRadius: '16px',
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.12)',
  },
  errorText: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#FCA5A5',
  },
  retryBtn: {
    marginTop: '0.75rem',
    padding: '0.5rem 1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.03)',
    color: '#9FB3C8',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1.5rem',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '2.5rem',
    marginBottom: '0.75rem',
  },
  emptyText: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#9FB3C8',
    margin: '0 0 1.25rem 0',
  },
  dashboardBtn: {
    padding: '0.875rem 1.75rem',
    borderRadius: '14px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    WebkitTapHighlightColor: 'transparent',
  },
  sections: {
    padding: '0.75rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    paddingLeft: '0.5rem',
    borderLeft: '3px solid',
    marginBottom: '0.25rem',
  },
  sectionDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  sectionLabel: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  taskCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '1.125rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
    animation: 'farroway-fade-in 0.25s ease-out',
  },
  doneBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    marginTop: '2px',
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
    border: '2px solid rgba(255,255,255,0.08)',
    borderTopColor: '#22C55E',
    animation: 'farroway-spin 0.6s linear infinite',
  },
  taskContent: {
    flex: 1,
    minWidth: 0,
  },
  taskTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  taskIcon: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  taskTitle: {
    fontWeight: 600,
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    flex: 1,
    minWidth: 0,
  },
  priorityBadge: {
    fontSize: '0.625rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    flexShrink: 0,
  },
  taskDesc: {
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    margin: '0.375rem 0 0 0',
    lineHeight: 1.4,
  },
  dueLabel: {
    fontSize: '0.6875rem',
    color: '#6F8299',
    marginTop: '0.25rem',
    display: 'inline-block',
  },
  // ─── Filter row ─────────
  filterRow: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem 0',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  filterChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.4rem 0.875rem',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.03)',
    color: '#6F8299',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    minHeight: '32px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
  },
  filterChipActive: {
    background: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.25)',
    color: '#22C55E',
  },
  filterCount: {
    fontSize: '0.625rem',
    fontWeight: 700,
    background: 'rgba(255,255,255,0.06)',
    color: '#6F8299',
    borderRadius: '6px',
    padding: '1px 5px',
    minWidth: '16px',
    textAlign: 'center',
  },
  filterCountActive: {
    background: 'rgba(34,197,94,0.15)',
    color: '#22C55E',
  },
  // ─── Completed tasks ────
  completedCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  completedCheck: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  completedTitle: {
    fontWeight: 500,
    color: '#6F8299',
    fontSize: '0.875rem',
    flex: 1,
    textDecoration: 'line-through',
    textDecorationColor: 'rgba(255,255,255,0.08)',
  },
  // ─── Empty filter state ─
  emptyFilterWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2.5rem 1rem',
  },
  emptyFilterText: {
    fontSize: '0.875rem',
    color: '#6F8299',
    margin: 0,
    fontWeight: 500,
  },
};
