/**
 * NextActionCard — single task card for the Home decision screen.
 *
 * Renders ONLY one TaskCard (standard variant). No plan, no status checklist.
 * Decision logic lives in src/engine/decisionEngine.js.
 */
import TaskCard from './farmer/TaskCard.jsx';

const ACTION_ROUTES = {
  onboarding_incomplete: 'setup',
  no_active_farm: 'setup',
  profile_incomplete: 'setup',
  stage_missing: 'stage',
  stage_outdated: 'stage',
  severe_pest: 'task',
  pest_overdue: 'task',
  unread_alert: 'task',
  stale_activity: 'update',
  needs_checkin: 'update',
  daily_task: 'task',
  weather_override: 'task',
  all_done: 'update',
};

export default function NextActionCard({
  decision,
  taskViewModel,
  loading,
  onDoThisNow,
  onSetStage,
  onGoToSetup,
  onAddUpdate,
  t,
  language,
}) {
  if (!decision && !loading) return null;

  const vm = taskViewModel;

  function handleCta() {
    if (!vm) return;
    const route = ACTION_ROUTES[vm.actionKey] || 'task';
    switch (route) {
      case 'setup': return onGoToSetup();
      case 'stage': return onSetStage();
      case 'task': return onDoThisNow();
      case 'update': return onAddUpdate();
    }
  }

  if (loading) {
    return (
      <div style={S.loadingCard}>
        <div style={S.loading}>
          <span style={S.spinner} />
          <span>{t('guided.loading')}</span>
        </div>
      </div>
    );
  }

  if (!vm) return null;

  return (
    <TaskCard
      viewModel={vm}
      variant="standard"
      language={language}
      t={t}
      onCta={handleCta}
    />
  );
}

const S = {
  loadingCard: {
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.04)',
    padding: '1.5rem 1.25rem',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
  },
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
    padding: '1.5rem 0', fontSize: '0.875rem', color: '#6F8299',
  },
  spinner: {
    width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.06)',
    borderTopColor: '#22C55E', borderRadius: '50%', animation: 'farroway-spin 0.8s linear infinite',
  },
};
