/**
 * InterventionCenter — NGO triage queue.
 * Renders GET /api/v2/ngo/interventions + summary cards.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';

async function getJSON(p) {
  const r = await fetch(p, { credentials: 'include' });
  if (!r.ok) throw new Error(`failed_${r.status}`);
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
  const [state, setState] = useState({ loading: true, items: [], summary: null, error: null });

  async function load() {
    try {
      const [items, summary] = await Promise.all([
        getJSON('/api/v2/ngo/interventions'),
        getJSON('/api/v2/ngo/interventions/summary'),
      ]);
      setState({ loading: false, items: items.items, summary, error: null });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }
  useEffect(() => { load(); }, []);

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

  if (state.loading) return <Shell><p>{t('common.loading')}</p></Shell>;
  if (state.error === 'failed_403') return <Shell><p style={S.err}>{t('ngo.forbidden')}</p></Shell>;
  if (state.error) return <Shell><p style={S.err}>{t('ngo.error')}</p></Shell>;

  const { items, summary } = state;
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

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '64rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' },
  subtitle: { color: '#9FB3C8', fontSize: '0.9375rem', margin: '0 0 1rem' },
  h2: { fontSize: '1.0625rem', fontWeight: 700, margin: 0 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.625rem', marginBottom: '1rem' },
  card: { padding: '0.875rem', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid' },
  cardLabel: { fontSize: '0.75rem', color: '#9FB3C8', textTransform: 'uppercase', letterSpacing: '0.04em' },
  cardValue: { fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  recomputeBtn: { padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.8125rem', cursor: 'pointer' },
  list: { margin: 0, paddingLeft: 0, listStyle: 'none' },
  item: { padding: '0.875rem', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.5rem' },
  itemHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' },
  chip: { padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 700, color: '#0B1D34', textTransform: 'uppercase' },
  score: { fontSize: '1rem', fontWeight: 700 },
  itemReason: { fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.25rem' },
  itemAction: { fontSize: '0.875rem', color: '#9FB3C8', marginBottom: '0.375rem' },
  itemDue: { fontSize: '0.75rem', color: '#6F8299', marginBottom: '0.5rem' },
  itemBtns: { display: 'flex', gap: '0.5rem' },
  btn: { padding: '0.375rem 0.75rem', borderRadius: '10px', border: 'none', background: '#0EA5E9', color: '#0B1D34', fontWeight: 700, cursor: 'pointer', fontSize: '0.8125rem' },
  btnOk: { padding: '0.375rem 0.75rem', borderRadius: '10px', border: 'none', background: '#22C55E', color: '#0B1D34', fontWeight: 700, cursor: 'pointer', fontSize: '0.8125rem' },
  btnGhost: { padding: '0.375rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#9FB3C8', cursor: 'pointer', fontSize: '0.8125rem' },
  muted: { color: '#9FB3C8', fontSize: '0.875rem' },
  err: { color: '#FCA5A5' },
};
