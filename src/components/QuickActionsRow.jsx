/**
 * QuickActionsRow — 4-tile quick action grid (farmer-friendly labels)
 */
export default function QuickActionsRow({ onAddUpdate, onMyFarm, onAllTasks, onCheckPests, taskCount, t }) {
  return (
    <div style={S.quickSection}>
      <div style={S.quickTitle}>{t('dashboard.quickActions')}</div>
      <div style={S.quickGrid}>
        <button onClick={onAddUpdate} style={S.quickTile} data-testid="add-update-btn">
          <span style={S.quickIcon}>{'\uD83D\uDCF8'}</span>
          <span style={S.quickLabel}>{t('dashboard.addUpdate')}</span>
        </button>
        <button onClick={onCheckPests} style={S.quickTile} data-testid="check-pests-btn">
          <span style={S.quickIcon}>{'\uD83D\uDC1B'}</span>
          <span style={S.quickLabel}>{t('dashboard.checkPests')}</span>
        </button>
        <button onClick={onMyFarm} style={S.quickTile}>
          <span style={S.quickIcon}>{'\uD83C\uDFE1'}</span>
          <span style={S.quickLabel}>{t('dashboard.myFarm')}</span>
        </button>
        <button onClick={onAllTasks} style={S.quickTile}>
          <span style={S.quickIcon}>{'\uD83D\uDCCB'}</span>
          <span style={S.quickLabel}>{t('dashboard.allTasks')}</span>
          {taskCount > 0 && (
            <span style={S.quickBadge}>{taskCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}

const S = {
  quickSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  quickTitle: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    paddingLeft: '0.25rem',
  },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.625rem',
  },
  quickTile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
    padding: '1rem 0.5rem',
    borderRadius: '14px',
    background: '#1B2330',
    border: '2px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    minHeight: '80px',
    position: 'relative',
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s, background 0.15s',
  },
  quickIcon: {
    fontSize: '1.5rem',
  },
  quickLabel: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    textAlign: 'center',
  },
  quickBadge: {
    position: 'absolute',
    top: '6px',
    right: '8px',
    fontSize: '0.625rem',
    fontWeight: 700,
    color: '#fff',
    background: '#EF4444',
    borderRadius: '8px',
    padding: '1px 5px',
    minWidth: '16px',
    textAlign: 'center',
  },
};
