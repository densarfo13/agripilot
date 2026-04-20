import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { calculateFarmScore } from '../lib/farmScore.js';
import { useSeason } from '../context/SeasonContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { getLocalizedTaskTitle } from '../utils/taskTranslations.js';
import { resolveProfileCompletionRoute, routeToUrl } from '../core/multiFarm/index.js';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
}

function getUrgencyKey(task) {
  const due = new Date(task.dueDate);
  const now = new Date();
  if (Number.isNaN(due.getTime())) return 'tasks.doSoon';
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'tasks.doToday';
  if (diffDays <= 2) return 'tasks.doSoon';
  return 'tasks.checkLater';
}

export default function SeasonTasksCard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { season, seasonLoading, markTaskComplete } = useSeason();
  const { t, lang } = useTranslation();
  const [completingId, setCompletingId] = useState(null);
  const [taskError, setTaskError] = useState(null);

  const score = calculateFarmScore(profile || {});

  const pendingTasks = useMemo(() => {
    return (season?.tasks || []).filter((task) => task.status !== 'completed');
  }, [season]);

  if (seasonLoading) {
    return (
      <div style={S.card}>
        <div style={S.loadingText}>{t('tasks.loading')}</div>
      </div>
    );
  }

  if (!season && !score.isReady) {
    return (
      <div style={S.card}>
        <h3 style={S.title}>{t('tasks.title')}</h3>
        <p style={S.emptyText}>{t('tasks.setupFirst')}</p>
        <button
          onClick={() => {
            const dest = resolveProfileCompletionRoute({
              profile, farms: [], reason: 'complete_profile',
            });
            navigate(routeToUrl(dest));
          }}
          style={S.setupBtn}
        >
          {t('dashboard.completeSetup')}
        </button>
      </div>
    );
  }

  if (!season) {
    return (
      <div style={S.card}>
        <h3 style={S.title}>{t('tasks.title')}</h3>
        <p style={S.emptyText}>{t('tasks.startSeason')}</p>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <div>
          <h3 style={S.title}>{t('tasks.title')}</h3>
          <p style={S.subtitle}>Crop: {season.cropType} \u2022 Stage: {season.stage}</p>
        </div>
        <div style={S.pendingBadge}>{pendingTasks.length} {t('tasks.pending')}</div>
      </div>

      <div style={S.taskList}>
        {(season.tasks || []).length === 0 && (
          <div style={S.emptyText}>{t('tasks.noTasks')}</div>
        )}

        {(season.tasks || []).map((task) => {
          const completed = task.status === 'completed';
          const urgency = t(getUrgencyKey(task));

          return (
            <div key={task.id} style={S.taskItem}>
              <div style={S.taskContent}>
                <div>
                  <div style={completed ? S.taskTitleCompleted : S.taskTitle}>
                    {getLocalizedTaskTitle(task.id, task.title, lang)}
                  </div>
                  {lang === 'en' && task.description && (
                    <div style={S.taskDesc}>{task.description}</div>
                  )}
                  <div style={S.taskMeta}>
                    <span style={S.taskDue}>{t('tasks.due')} {formatDate(task.dueDate)}</span>
                    {!completed && (
                      <span style={S.urgencyLabel}>{urgency}</span>
                    )}
                  </div>
                </div>

                {!completed ? (
                  <div>
                    <button
                      onClick={async () => {
                        if (completingId === task.id) return;
                        setCompletingId(task.id);
                        setTaskError(null);
                        try {
                          await markTaskComplete(task.id);
                        } catch (err) {
                          setTaskError(task.id);
                        } finally {
                          setCompletingId(null);
                        }
                      }}
                      disabled={completingId === task.id}
                      style={{ ...S.doneBtn, ...(completingId === task.id ? S.doneBtnDisabled : {}) }}
                    >
                      {completingId === task.id ? t('common.saving') : t('tasks.markDone')}
                    </button>
                    {taskError === task.id && (
                      <div style={S.taskErrorMsg}>{t('tasks.completeFailed')}</div>
                    )}
                  </div>
                ) : (
                  <div style={S.completedLabel}>{t('tasks.completed')}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
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
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.25rem',
  },
  pendingBadge: {
    fontSize: '0.875rem',
    color: '#86EFAC',
    fontWeight: 600,
  },
  loadingText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.7)',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.7)',
    marginTop: '0.5rem',
  },
  taskList: {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  taskItem: {
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '1rem',
  },
  taskContent: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  taskTitle: {
    fontWeight: 600,
    color: '#fff',
  },
  taskTitleCompleted: {
    fontWeight: 600,
    color: '#86EFAC',
  },
  taskDesc: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.65)',
    marginTop: '0.25rem',
  },
  taskMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginTop: '0.5rem',
    flexWrap: 'wrap',
  },
  taskDue: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.45)',
  },
  urgencyLabel: {
    fontSize: '0.75rem',
    color: '#FDE68A',
    fontWeight: 600,
  },
  doneBtn: {
    borderRadius: '12px',
    background: '#22C55E',
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#000',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  doneBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  completedLabel: {
    fontSize: '0.875rem',
    color: '#86EFAC',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  taskErrorMsg: {
    marginTop: '0.35rem',
    fontSize: '0.75rem',
    color: '#FCA5A5',
  },
  setupBtn: {
    marginTop: '0.75rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '0.625rem 1rem',
    fontWeight: 600,
    color: '#fff',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
};
