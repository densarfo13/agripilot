/**
 * BuyerNotificationsPage — notification feed scoped to the logged-in
 * buyer. Uses the same /api/notifications endpoint as the farmer
 * page; the backend only returns rows where user_id matches the
 * caller, so there's no cross-role leak.
 *
 * Types a buyer typically sees:
 *   interest_accepted  — route to MyInterestsPage (contact reveal)
 *   interest_declined  — route to MyInterestsPage (history)
 *   new_matching_listing — (future) route to the listing
 *
 * Route: /buyer/notifications
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { listNotifications, markNotificationRead } from '../../hooks/useMarket.js';
import { getCropDisplayName } from '../../utils/getCropDisplayName.js';
import { tSafe } from '../../i18n/tSafe.js';

const TYPE_ICON = {
  interest_accepted:   '\u2705',       // ✅
  interest_declined:   '\u26A0\uFE0F', // ⚠️
  listing_interest:    '\uD83D\uDCE7', // 📧
  new_matching_listing:'\uD83C\uDF3E', // 🌾
};

export default function BuyerNotificationsPage() {
  const { t, language } = useAppSettings();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, notifications: [], unread: 0, error: null });

  async function reload() {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await listNotifications();
      setState({
        loading: false,
        notifications: r?.notifications || [],
        unread: r?.unread || 0,
        error: null,
      });
    } catch (err) {
      setState({ loading: false, notifications: [], unread: 0, error: err?.code || 'error' });
    }
  }

  useEffect(() => { reload(); }, []);

  async function handleOpen(n) {
    if (!n.isRead) {
      try { await markNotificationRead(n.id); } catch { /* noop */ }
    }
    // Route by type:
    //   - interest_* → "My interests" (where the contact reveal lives)
    //   - new_matching_listing → direct listing detail
    if (n.type === 'interest_accepted' || n.type === 'interest_declined') {
      navigate('/buyer/interests');
    } else if (n.type === 'new_matching_listing' && n.metadata?.listingId) {
      navigate(`/market/listings/${n.metadata.listingId}`);
    }
    reload();
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <header style={S.header}>
          <h1 style={S.title}>{tSafe('notifications.title', '')}</h1>
          {state.unread > 0 && (
            <span style={S.badge}>
              {t('notifications.unread', { count: state.unread }) || `${state.unread} new`}
            </span>
          )}
        </header>

        {state.loading && <p style={S.muted}>{t('common.loading')}</p>}
        {state.error && <p style={S.err}>{tSafe('notifications.error', '')}</p>}

        {!state.loading && state.notifications.length === 0 && (
          <div style={S.empty}>
            <div style={S.emptyIcon}>{'\uD83D\uDD14'}</div>
            <p style={S.emptyBody}>{tSafe('notifications.empty', '')}</p>
          </div>
        )}

        <ul style={S.list}>
          {state.notifications.map((n) => {
            const cropKey = n.metadata?.cropKey;
            const cropLabel = cropKey ? getCropDisplayName(cropKey, language, { bilingual: 'auto' }) : '';
            const title = t(n.title, { crop: cropLabel }) || n.title;
            const message = t(n.message, { crop: cropLabel, ...(n.metadata || {}) }) || n.message;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleOpen(n)}
                  style={{ ...S.item, ...(!n.isRead ? S.itemUnread : null) }}
                  data-testid={`buyer-notif-${n.id}`}
                >
                  <span style={S.icon}>{TYPE_ICON[n.type] || '\uD83D\uDCF0'}</span>
                  <span style={S.body}>
                    <span style={S.itemTitle}>{title}</span>
                    <span style={S.itemMsg}>{message}</span>
                  </span>
                  {!n.isRead && <span style={S.dot} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '36rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: 0 },
  badge: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    background: 'rgba(14,165,233,0.14)', color: '#0EA5E9',
    fontSize: '0.75rem', fontWeight: 700,
  },
  muted: { color: '#9FB3C8' },
  err: { color: '#FCA5A5' },
  empty: {
    padding: '1.5rem', borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center',
  },
  emptyIcon: { fontSize: '1.75rem' },
  emptyBody: { fontSize: '0.875rem', color: '#9FB3C8', margin: '0.375rem 0 0' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  item: {
    display: 'flex', gap: '0.625rem', alignItems: 'flex-start',
    width: '100%', padding: '0.75rem 0.875rem',
    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.03)', color: '#EAF2FF',
    cursor: 'pointer', textAlign: 'left', minHeight: '56px',
  },
  itemUnread: { background: 'rgba(14,165,233,0.08)', borderColor: 'rgba(14,165,233,0.22)' },
  icon: { fontSize: '1.25rem', lineHeight: 1 },
  body: { display: 'flex', flexDirection: 'column', gap: '0.125rem', flex: 1 },
  itemTitle: { fontSize: '0.9375rem', fontWeight: 700 },
  itemMsg: { fontSize: '0.8125rem', color: '#9FB3C8', lineHeight: 1.4 },
  dot: {
    width: '8px', height: '8px', borderRadius: '50%',
    background: '#0EA5E9', flexShrink: 0, marginTop: '0.375rem',
  },
};
