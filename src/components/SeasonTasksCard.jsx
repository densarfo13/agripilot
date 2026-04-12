import { useMemo } from 'react';
import { useSeason } from '../context/SeasonContext.jsx';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
}

export default function SeasonTasksCard() {
  const { season, seasonLoading, markTaskComplete } = useSeason();

  const pendingTasks = useMemo(() => {
    return (season?.tasks || []).filter((task) => task.status !== 'completed');
  }, [season]);

  if (seasonLoading) {
    return (
      <div style={S.card}>
        <div style={S.loadingText}>Loading season tasks...</div>
      </div>
    );
  }

  if (!season) {
    return (
      <div style={S.card}>
        <h3 style={S.title}>🌱 Today's Tasks</h3>
        <p style={S.emptyText}>Start a season to begin receiving daily farming tasks.</p>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <div>
          <h3 style={S.title}>🌱 Today's Tasks</h3>
          <p style={S.subtitle}>Crop: {season.cropType} • Stage: {season.stage}</p>
        </div>
        <div style={S.pendingBadge}>{pendingTasks.length} pending</div>
      </div>

      <div style={S.taskList}>
        {(season.tasks || []).length === 0 && (
          <div style={S.emptyText}>No tasks yet.</div>
        )}

        {(season.tasks || []).map((task) => {
          const completed = task.status === 'completed';

          return (
            <div key={task.id} style={S.taskItem}>
              <div style={S.taskContent}>
                <div>
                  <div style={completed ? S.taskTitleCompleted : S.taskTitle}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div style={S.taskDesc}>{task.description}</div>
                  )}
                  <div style={S.taskDue}>Due: {formatDate(task.dueDate)}</div>
                </div>

                {!completed ? (
                  <button onClick={() => markTaskComplete(task.id)} style={S.doneBtn}>
                    Mark Done
                  </button>
                ) : (
                  <div style={S.completedLabel}>Completed</div>
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
  taskDue: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.45)',
    marginTop: '0.5rem',
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
  completedLabel: {
    fontSize: '0.875rem',
    color: '#86EFAC',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};
