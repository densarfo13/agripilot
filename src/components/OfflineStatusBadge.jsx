import { useNetwork } from '../context/NetworkContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';

function formatTime(timestamp) {
  if (!timestamp) return 'Not yet';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Not yet';
  return date.toLocaleString();
}

export default function OfflineStatusBadge() {
  const { isOnline } = useNetwork();
  const { syncStatus, syncMeta } = useProfile();
  const { t } = useTranslation();

  return (
    <div style={S.wrapper}>
      <div style={S.label}>Connection</div>
      <div style={S.status}>{isOnline ? 'Online' : t('offline.savedLocally')}</div>
      {(syncMeta?.pendingCount || 0) > 0 && (
        <div style={S.detail}>{t('offline.pendingSync', { count: syncMeta.pendingCount })}</div>
      )}
      <div style={S.detail}>Last saved online: {formatTime(syncMeta?.lastSyncedAt)}</div>

      {!isOnline && (
        <div style={S.queued}>{t('offline.willSync')}</div>
      )}
      {syncStatus === 'syncing' && (
        <div style={S.detail}>{t('offline.syncing')}</div>
      )}
      {syncStatus === 'queued' && isOnline && (
        <div style={S.queued}>{t('offline.savedLocally')}</div>
      )}
      {syncStatus === 'failed' && (
        <div style={S.failed}>
          {syncMeta?.lastError || t('offline.failed')}
        </div>
      )}
    </div>
  );
}

const S = {
  wrapper: {
    borderRadius: '12px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '0.75rem',
    minWidth: '180px',
  },
  label: {
    fontSize: '0.6875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'rgba(255,255,255,0.5)',
  },
  status: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#86EFAC',
  },
  detail: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.25rem',
  },
  queued: {
    fontSize: '0.6875rem',
    color: '#FDE68A',
    marginTop: '0.25rem',
  },
  failed: {
    fontSize: '0.6875rem',
    color: '#FCA5A5',
    marginTop: '0.25rem',
  },
};
