/**
 * InterventionCenter — NGO triage queue.
 * Renders GET /api/v2/ngo/interventions + summary cards.
 */
import { useTranslation } from '../../i18n/index.js';
import useSafeData, { API_ERROR_TYPES } from '../../hooks/useSafeData.js';
import {
  ErrorState, SessionExpiredState, MfaRequiredState, NetworkErrorState,
} from '../../components/admin/AdminState.jsx';

async function getJSON(p) {
  const r = await fetch(p, { credentials: 'include' });
  if (!r.ok) {
    const err = new Error(`failed_${r.status}`);
    err.status   = r.status;
    err.response = { status: r.status };
    throw err;
  }
  return r.json();
}
async function patchJSON(p, body) {
  const r = await fetch(p, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`failed_${r.status}`);
  return r.json();
}

const PRIORITY_COLOR = {
  critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#6F8299',
};

export default function InterventionCenter() {
  const { t } = useTranslation();

  // Combined fetcher for the queue + summary cards. Mutations
  // (markStatus / recompute) call retry() to refresh the page
  // — same UX as the previous load() helper, just plumbed
  // through useSafeData so failures render the right state.
  const {
    data, loading, error, errorType, retry: load,
  } = useSafeData(
    async () => {
      const [items, summary] = await Promise.all([
        getJSON('/api/v2/ngo/interventions'),
        getJSON('/api/v2/ngo/interventions/summary'),
      ]);
      return { items: items.items || [], summary };
    },
    { fallbackData: { items: [], summary: null } },
  );

  async function markStatus(id, status) {
    try {
      await patchJSON(`/api/v2/ngo/interventions/${id}`, { status });
      load();
    } catch (err) { /* toast would go here */ }
  }

  async function recompute() {
    try {
      await fetch('/api/v2/ngo/interventions/recompute', { method: 'POST', credentials: 'include' });
      load();
    } catch { /* ignore */ }
  }

  if (loading) return <Shell><p>{t('common.loading')}</p></Shell>;
  if (error) {
    const status = (typeof error === 'string' && error.match(/failed_(\d+)/));
    const code   = status ? Number(status[1]) : null;
    return (
      <Shell>
        {code === 403 ? (
          <p style={S.err}>{t('ngo.forbidden')}</p>
        ) : errorType === API_ERROR_TYPES.SESSION_EXPIRED ? (
          <SessionExpiredState testId="ngo-interventions-error" />
        ) : errorType === API_ERROR_TYPES.MFA_REQUIRED ? (
          <MfaRequiredState testId="ngo-interventions-error" />
        ) : errorType === API_ERROR_TYPES.NETWORK_ERROR ? (
          <NetworkErrorState onRetry={load} testId="ngo-interventions-error" />
        ) : (
          <ErrorState
            message={t('ngo.error') || 'We could not load interventions. Try again in a moment.'}
            onRetry={load}
            testId="ngo-interventions-error"
          />
        )}
      </Shell>
    );
  }

  const { items = [], summary } = data || {};
  return (
    <Shell>
      <h1 style={S.title}>{t('ngoV2.interventions.title')}</h1>
      <p style={S.subtitle}>{t('ngoV2.interventions.subtitle')}</p>

      <div style={S.grid4}>
        {(['critical', 'high', 'medium', 'low']).map((p) => (
          <div key={p} style={{ ...S.card, borderColor: PRIORITY_COLOR[p] }}>
            <div style={S.cardLabel}>{t(`ngoV2.priority.${p}`)}</div>
            <div style={{ ...S.cardValue, color: PRIORITY_COLOR[p] }}>
              {summary?.byPriority?.[p] ?? 0}
            </div>
          </div>
        ))}
      </div>

      <div style={S.row}>
        <h2 style={S.h2}>{t('ngoV2.interventions.queue')}</h2>
        <button type="button" onClick={recompute} style={S.recomputeBtn}>
          {t('ngoV2.recompute')}
        </button>
      </div>

      {items.length === 0 ? (
        <p style={S.muted}>{t('ngoV2.interventions.empty')}</p>
      ) : (
        <ul style={S.list}>
          {items.map((it) => (
            <li key={it.id} style={S.item}>
              <div style={S.itemHead}>
                <span style={{ ...S.chip, background: PRIORITY_COLOR[it.priority] }}>
                  {t(`ngoV2.priority.${it.priority}`)}
                </span>
                <span style={S.score}>{it.interventionScore}</span>
              </div>
              <div style={S.itemReason}>{it.reason}</div>
              <div style={S.itemAction}>{it.recommendedAction}</div>
              {it.dueAt && (
                <div style={S.itemDue}>{t('ngoV2.dueBy')}: {new Date(it.dueAt).toLocaleDateString()}</div>
              )}
              <div style={S.itemBtns}>
                <button onClick={() => markStatus(it.id, 'in_progress')} style={S.btn}>{t('ngoV2.markInProgress')}</button>
                <button onClick={() => markStatus(it.id, 'resolved')}   style={S.btnOk}>{t('ngoV2.markResolved')}</button>
                <button onClick={() => markStatus(it.id, 'dismissed')}  style={S.btnGhost}>{t('ngoV2.dismiss')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={S.page}>
      <div style={S.container}>{children}</div>
    </div>
  );
}

// Soft Ochre body wash (May 2026 production audit). High-
// leverage page-level chrome flips to the warm palette so this
// route inherits the same surface language as the rest of the
// platform without touching its data + control logic.
const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #F6F1E7 0%, #EFE7D5 100%)', color: '#1F2933', padding: '1rem 0 3rem' },
  container: { maxWidth: '64rem', margin: '0 auto', padding: '0 1rem', color: '#1F2933' },
  title: { fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem', color: '#1F2933' },
  subtitle: { color: '#667085', fontSize: '0.9375rem', margin: '0 0 1rem' },
  h2: { fontSize: '1.0625rem', fontWeight: 800, margin: 0, color: '#1F2933' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.625rem', marginBottom: '1rem' },
  card: { padding: '0.875rem', borderRadius: '14px', background: '#FFF9F0', border: '1px solid rgba(31,41,51,0.08)', boxShadow: '0 1px 0 0 rgba(255,255,255,0.55) inset, 0 8px 18px -10px rgba(80,60,30,0.18)' },
  cardLabel: { fontSize: '0.7rem', color: '#667085', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 },
  cardValue: { fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: '#1F2933' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  recomputeBtn: { padding: '0.55rem 0.85rem', borderRadius: '999px', border: '1px solid rgba(212,163,95,0.42)', background: 'rgba(212,163,95,0.12)', color: '#7A5A28', fontSize: '0.8125rem', fontWeight: 800, cursor: 'pointer' },
  list: { margin: 0, paddingLeft: 0, listStyle: 'none' },
  item: { padding: '0.875rem', borderRadius: '14px', background: '#FFF9F0', border: '1px solid rgba(31,41,51,0.08)', marginBottom: '0.5rem' },
  itemHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' },
  chip: { padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase' },
  score: { fontSize: '1rem', fontWeight: 800, color: '#1F2933' },
  itemReason: { fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1F2933' },
  itemAction: { fontSize: '0.875rem', color: '#667085', marginBottom: '0.375rem' },
  itemDue: { fontSize: '0.75rem', color: '#98A2B3', marginBottom: '0.5rem' },
  itemBtns: { display: 'flex', gap: '0.5rem' },
  btn: { padding: '0.45rem 0.95rem', borderRadius: '999px', border: 'none', background: 'linear-gradient(180deg, #D4A35F 0%, #B9853F 100%)', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer', fontSize: '0.8125rem', boxShadow: '0 8px 18px rgba(185,133,63,0.28)' },
  btnOk: { padding: '0.45rem 0.95rem', borderRadius: '999px', border: 'none', background: 'rgba(94,142,94,0.16)', color: '#3F6A3F', fontWeight: 800, cursor: 'pointer', fontSize: '0.8125rem', borderColor: 'rgba(94,142,94,0.36)' },
  btnGhost: { padding: '0.45rem 0.95rem', borderRadius: '999px', border: '1px solid rgba(31,41,51,0.16)', background: 'transparent', color: '#667085', cursor: 'pointer', fontSize: '0.8125rem' },
  muted: { color: '#9FB3C8', fontSize: '0.875rem' },
  err: { color: '#FCA5A5' },
};
