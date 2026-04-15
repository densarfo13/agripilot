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

const PRIORITY_COLORS = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#6B7280',
};

const PRIORITY_BG = {
  high: 'rgba(239,68,68,0.12)',
  medium: 'rgba(245,158,11,0.12)',
  low: 'rgba(107,114,128,0.12)',
};

const SECTIONS = [
  { key: 'high', labelKey: 'farmTasks.priorityHigh', color: '#EF4444' },
  { key: 'medium', labelKey: 'farmTasks.priorityMedium', color: '#F59E0B' },
  { key: 'low', labelKey: 'farmTasks.priorityLow', color: '#6B7280' },
];

export default function AllTasksPage() {
  const navigate = useNavigate();
  const { currentFarmId, profile } = useProfile();
  const { t } = useTranslation();
  const { isOnline } = useNetwork();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completing, setCompleting] = useState(null);

  const fetchTasks = useCallback(async () => {
    if (!currentFarmId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFarmTasks(currentFarmId);
      setTasks(data.tasks || []);
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
      // Optimistic removal
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
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

  // Group tasks by priority
  const grouped = {
    high: tasks.filter((t) => t.priority === 'high'),
    medium: tasks.filter((t) => t.priority === 'medium'),
    low: tasks.filter((t) => t.priority === 'low'),
  };

  if (!profile) return null;

  return (
    <div style={S.page} data-testid="all-tasks-page">
      {/* Header */}
      <div style={S.header}>
        <button type="button" onClick={() => navigate('/dashboard')} style={S.backBtn}>
          <span style={S.backArrow}>&larr;</span>
        </button>
        <h1 style={S.pageTitle}>{t('allTasks.title') || 'All Tasks'}</h1>
      </div>

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

      {/* Empty state */}
      {!loading && !error && tasks.length === 0 && (
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

      {/* Task sections */}
      {!loading && !error && tasks.length > 0 && (
        <div style={S.sections}>
          {SECTIONS.map((section) => {
            const sectionTasks = grouped[section.key];
            if (sectionTasks.length === 0) return null;
            return (
              <div key={section.key} style={S.section}>
                <div style={{ ...S.sectionHeader, borderLeftColor: section.color }}>
                  <span style={{ ...S.sectionDot, background: section.color }} />
                  <span style={{ ...S.sectionLabel, color: section.color }}>
                    {t(section.labelKey)} ({sectionTasks.length})
                  </span>
                </div>
                {sectionTasks.map((task) => (
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
                        <span style={S.taskTitle}>{task.title}</span>
                        <span
                          style={{
                            ...S.priorityBadge,
                            color: PRIORITY_COLORS[task.priority],
                            background: PRIORITY_BG[task.priority],
                          }}
                        >
                          {t(SECTIONS.find((s) => s.key === task.priority)?.labelKey || '')}
                        </span>
                      </div>
                      {task.description && (
                        <p style={S.taskDesc}>{task.description}</p>
                      )}
                      {task.dueLabel && (
                        <span style={S.dueLabel}>{task.dueLabel}</span>
                      )}
                    </div>
                  </div>
                ))}
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
    background: '#0F172A',
    padding: '0 0 2rem 0',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    position: 'sticky',
    top: 0,
    background: '#0F172A',
    zIndex: 50,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    padding: 0,
  },
  backArrow: {
    color: '#fff',
    fontSize: '1.125rem',
  },
  pageTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fff',
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
    border: '2px solid rgba(255,255,255,0.2)',
    borderTopColor: '#22C55E',
    animation: 'farroway-spin 0.6s linear infinite',
  },
  loadingText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
  },
  errorCard: {
    margin: '1.5rem 1.25rem',
    padding: '1rem',
    borderRadius: '12px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
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
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
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
    color: 'rgba(255,255,255,0.7)',
    margin: '0 0 1.25rem 0',
  },
  dashboardBtn: {
    padding: '0.75rem 1.5rem',
    borderRadius: '12px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
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
    padding: '1rem',
    borderRadius: '12px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.08)',
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
    border: '2px solid rgba(255,255,255,0.2)',
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
  taskTitle: {
    fontWeight: 600,
    color: '#fff',
    fontSize: '0.9375rem',
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
    color: 'rgba(255,255,255,0.5)',
    margin: '0.375rem 0 0 0',
    lineHeight: 1.4,
  },
  dueLabel: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.35)',
    marginTop: '0.25rem',
    display: 'inline-block',
  },
};
