import { useNetwork } from '../context/NetworkContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { t } from '../lib/i18n.js';

export default function OfflineStatusBadge() {
  const { isOnline } = useNetwork();
  const { syncStatus } = useProfile();
  const { language } = useAppPrefs();

  const isSyncing = syncStatus === 'syncing';
  const label = !isOnline
    ? t(language, 'offlineReady')
    : isSyncing
      ? t(language, 'syncing')
      : null;

  if (isOnline && !isSyncing) return null;

  return (
    <span style={{ ...S.badge, ...(isOnline ? S.syncing : S.offline) }}>
      {label}
    </span>
  );
}

const S = {
  badge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    padding: '0.25rem 0.5rem',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
  },
  offline: {
    background: 'rgba(252,165,165,0.15)',
    color: '#FCA5A5',
    border: '1px solid rgba(252,165,165,0.3)',
  },
  syncing: {
    background: 'rgba(253,230,138,0.15)',
    color: '#FDE68A',
    border: '1px solid rgba(253,230,138,0.3)',
  },
};
