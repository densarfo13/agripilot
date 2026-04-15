/**
 * NextActionCard — pure presentation component for guided farmer actions.
 *
 * Receives a DecisionResult from useFarmDecision hook.
 * Renders: primary action card + today's plan + farm status bar.
 * No decision logic — that lives in src/engine/decisionEngine.js.
 */
import { RISK_COLORS } from '../engine/decisionTypes.js';

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
  all_done: 'update',
};

export default function NextActionCard({
  decision,
  loading,
  onDoThisNow,
  onSetStage,
  onGoToSetup,
  onAddUpdate,
  t,
}) {
  if (!decision && !loading) return null;

  const action = decision?.primaryAction;
  const plan = decision?.todaysPlan || [];
  const status = decision?.farmStatus;

  function handleCta() {
    if (!action) return;
    const route = ACTION_ROUTES[action.key] || 'task';
    switch (route) {
      case 'setup': return onGoToSetup();
      case 'stage': return onSetStage();
      case 'task': return onDoThisNow();
      case 'update': return onAddUpdate();
    }
  }

  // Urgency detection
  const isUrgent = action && (action.priority === 'critical' || action.priority === 'high');
  const isOverdue = action && (action.key === 'stage_outdated' || action.key === 'stale_activity' || action.key === 'needs_checkin');

  return (
    <div style={S.wrapper}>
      {/* ═══ PRIMARY ACTION CARD ═══ */}
      <div style={{ ...S.card, ...(action?.isAlert ? S.cardAlert : {}), ...(isOverdue && !action?.isAlert ? S.cardOverdue : {}) }}>
        {loading ? (
          <div style={S.loading}>
            <span style={S.spinner} />
            <span>{t('guided.loading')}</span>
          </div>
        ) : action ? (
          <>
            {/* Urgency badge */}
            {(isUrgent || isOverdue) && (
              <div style={isUrgent ? S.urgentBadge : S.overdueBadge}>
                {isUrgent ? t('retention.urgent') : t('retention.overdue')}
              </div>
            )}

            <div style={S.actionRow}>
              <div style={{ ...S.iconCircle, background: action.iconBg }}>
                <span style={S.iconEmoji}>{action.icon}</span>
              </div>
              <div style={S.actionText}>
                <div style={S.actionTitle}>{action.title}</div>
                <div style={S.actionReason}>{action.reason}</div>
              </div>
            </div>

            {action.stageInfo && (
              <div style={S.stageChip}>
                <span>{action.stageInfo.emoji}</span>
                <span>{action.stageInfo.label}</span>
                {action.stageInfo.daysSinceUpdate > 1 && (
                  <span style={S.stageAge}>
                    {t('guided.daysAgo', { days: action.stageInfo.daysSinceUpdate })}
                  </span>
                )}
              </div>
            )}

            <button onClick={handleCta} style={
              action.key === 'all_done' ? S.ctaSecondary
              : action.isAlert ? S.ctaAlert
              : S.cta
            } data-testid="next-action-cta">
              {action.cta}
            </button>

            {action.next && (
              <div style={S.nextHint}>
                <span style={S.nextIcon}>{'\u2192'}</span>
                <span>{action.next}</span>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* ═══ TODAY'S PLAN + COMPLETION COUNTER ═══ */}
      {!loading && plan.length > 1 && (
        <div style={S.planSection}>
          <div style={S.planHeader}>
            <span style={S.planTitle}>{t('guided.todaysPlan')}</span>
            {status && status.progress > 0 && (
              <span style={S.completionBadge}>{status.progress}%</span>
            )}
          </div>
          <div style={S.planList}>
            {plan.map((step, i) => (
              <div key={i} style={{ ...S.planStep, ...(step.active ? S.planStepActive : {}) }}>
                <span style={S.planStepNum}>{i + 1}</span>
                <span style={S.planStepIcon}>{step.icon}</span>
                <span style={{ ...S.planStepLabel, ...(step.active ? S.planStepLabelActive : {}) }}>
                  {step.label}
                </span>
                {step.active && <span style={S.planStepNow}>{t('guided.now')}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ FARM STATUS CHECKLIST ═══ */}
      {!loading && status && status.checks.length > 0 && (
        <div style={{ ...S.statusBar, background: RISK_COLORS[status.riskLevel]?.bg || RISK_COLORS.none.bg,
          borderColor: RISK_COLORS[status.riskLevel]?.border || RISK_COLORS.none.border }}>
          <div style={S.statusHeader}>
            <span style={{ ...S.statusLabel, color: RISK_COLORS[status.riskLevel]?.text || '#86EFAC' }}>
              {status.label}
            </span>
          </div>
          <div style={S.checklist}>
            {status.checks.map((c, i) => (
              <div key={i} style={S.checkItem}>
                <span style={S.checkIcon}>{c.icon}</span>
                <span style={{ ...S.checkLabel, ...(c.ok ? S.checkLabelDone : {}) }}>{c.label}</span>
              </div>
            ))}
          </div>
          {status.lastUpdate != null && (
            <div style={S.lastUpdated}>
              {status.lastUpdate === 0
                ? t('retention.updatedToday') || 'Updated today'
                : t('retention.lastUpdated', { days: status.lastUpdate })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  card: {
    borderRadius: '18px', background: '#1B2330', padding: '1.5rem 1.25rem',
    border: '2px solid rgba(34,197,94,0.3)', boxShadow: '0 4px 24px rgba(34,197,94,0.08)',
  },
  cardAlert: { border: '2px solid rgba(239,68,68,0.4)', boxShadow: '0 4px 24px rgba(239,68,68,0.1)' },
  cardOverdue: { border: '2px solid rgba(250,204,21,0.35)', boxShadow: '0 4px 24px rgba(250,204,21,0.06)' },
  urgentBadge: {
    display: 'inline-block', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: '#FCA5A5', background: 'rgba(239,68,68,0.12)',
    padding: '0.2rem 0.5rem', borderRadius: '6px', marginBottom: '0.625rem',
  },
  overdueBadge: {
    display: 'inline-block', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: '#FCD34D', background: 'rgba(250,204,21,0.12)',
    padding: '0.2rem 0.5rem', borderRadius: '6px', marginBottom: '0.625rem',
  },
  actionRow: { display: 'flex', alignItems: 'flex-start', gap: '0.875rem' },
  iconCircle: {
    width: '56px', height: '56px', borderRadius: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconEmoji: { fontSize: '1.75rem', lineHeight: 1 },
  actionText: { flex: 1, minWidth: 0 },
  actionTitle: { fontSize: '1.125rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 },
  actionReason: { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginTop: '0.25rem' },
  stageChip: {
    display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.75rem',
    padding: '0.375rem 0.75rem', borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600,
  },
  stageAge: { fontSize: '0.6875rem', color: '#FCD34D', fontWeight: 500, marginLeft: '0.25rem' },
  cta: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
    marginTop: '1.25rem', padding: '1rem',
    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)', color: '#fff',
    border: 'none', borderRadius: '14px', fontSize: '1.0625rem', fontWeight: 800,
    cursor: 'pointer', minHeight: '56px', boxShadow: '0 4px 16px rgba(22,163,74,0.25)',
    WebkitTapHighlightColor: 'transparent',
  },
  ctaAlert: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
    marginTop: '1.25rem', padding: '1rem',
    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', color: '#fff',
    border: 'none', borderRadius: '14px', fontSize: '1.0625rem', fontWeight: 800,
    cursor: 'pointer', minHeight: '56px', boxShadow: '0 4px 16px rgba(239,68,68,0.25)',
    WebkitTapHighlightColor: 'transparent',
  },
  ctaSecondary: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
    marginTop: '1.25rem', padding: '0.875rem', background: 'transparent', color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.3)', borderRadius: '14px', fontSize: '0.9375rem',
    fontWeight: 700, cursor: 'pointer', minHeight: '52px', WebkitTapHighlightColor: 'transparent',
  },
  nextHint: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem',
    padding: '0.5rem 0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)',
    fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4,
  },
  nextIcon: { color: '#22C55E', fontWeight: 700, flexShrink: 0 },
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
    padding: '1.5rem 0', fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)',
  },
  spinner: {
    width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.1)',
    borderTopColor: '#22C55E', borderRadius: '50%', animation: 'farroway-spin 0.8s linear infinite',
  },
  // ─── Plan ────────────────
  planSection: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  planHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '0.25rem',
  },
  planTitle: {
    fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '0.25rem',
  },
  completionBadge: {
    fontSize: '0.625rem', fontWeight: 700, color: '#86EFAC',
    background: 'rgba(34,197,94,0.12)', padding: '0.15rem 0.4rem', borderRadius: '6px',
  },
  planList: {
    borderRadius: '14px', background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  planStep: {
    display: 'flex', alignItems: 'center', gap: '0.625rem',
    padding: '0.625rem 0.875rem', borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  planStepActive: { background: 'rgba(34,197,94,0.06)' },
  planStepNum: {
    width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', flexShrink: 0,
  },
  planStepIcon: { fontSize: '1rem', flexShrink: 0 },
  planStepLabel: {
    flex: 1, fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  planStepLabelActive: { color: '#fff', fontWeight: 700 },
  planStepNow: {
    fontSize: '0.625rem', fontWeight: 700, color: '#22C55E',
    textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
  },
  // ─── Farm Status ─────────
  statusBar: {
    borderRadius: '14px', padding: '0.75rem 1rem',
    border: '1px solid', display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  statusHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { fontSize: '0.8125rem', fontWeight: 700 },
  statusProgress: { fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)' },
  statusTrack: {
    height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  statusFill: { height: '100%', borderRadius: '2px', transition: 'width 0.3s ease', minWidth: '4px' },
  statusChecks: {
    display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.75rem', marginTop: '0.125rem',
  },
  checklist: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  checkItem: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  checkIcon: { fontSize: '0.875rem', flexShrink: 0, width: '1.25rem', textAlign: 'center' },
  checkLabel: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 },
  checkLabelDone: { color: 'rgba(255,255,255,0.65)', textDecoration: 'line-through', textDecorationColor: 'rgba(255,255,255,0.2)' },
  lastUpdated: {
    fontSize: '0.625rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.25rem', textAlign: 'right',
  },
};
