/**
 * FundingReadiness — funding decisions queue with decision filter.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';

async function getJSON(p) {
  const r = await fetch(p, { credentials: 'include' });
  if (!r.ok) throw new Error(`failed_${r.status}`);
  return r.json();
}

const DECISION_COLOR = {
  eligible: '#22C55E',
  monitor: '#F59E0B',
  needs_review: '#0EA5E9',
  not_yet_eligible: '#EF4444',
};

export default function FundingReadiness() {
  const { t } = useTranslation();
  const [decision, setDecision] = useState('');
  const [state, setState] = useState({ loading: true, items: [], error: null });

  useEffect(() => {
    (async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const q = decision ? `?decision=${encodeURIComponent(decision)}` : '';
        const data = await getJSON(`/api/v2/ngo/funding-readiness${q}`);
        setState({ loading: false, items: data.items, error: null });
      } catch (err) {
        setState({ loading: false, items: [], error: err.message });
      }
    })();
  }, [decision]);

  async function recompute() {
    await fetch('/api/v2/ngo/funding-readiness/recompute', { method: 'POST', credentials: 'include' });
    setDecision((d) => d ? '' : '');
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <h1 style={S.title}>{t('ngoV2.funding.title')}</h1>
        <p style={S.subtitle}>{t('ngoV2.funding.subtitle')}</p>

        <div style={S.filterRow}>
          <select value={decision} onChange={(e) => setDecision(e.target.value)} style={S.select}>
            <option value="">{t('ngoV2.funding.allDecisions')}</option>
            <option value="eligible">{t('ngoV2.funding.eligible')}</option>
            <option value="monitor">{t('ngoV2.funding.monitor')}</option>
            <option value="needs_review">{t('ngoV2.funding.needsReview')}</option>
            <option value="not_yet_eligible">{t('ngoV2.funding.notYet')}</option>
          </select>
          <button type="button" onClick={recompute} style={S.btn}>{t('ngoV2.recompute')}</button>
        </div>

        {state.loading && <p>{t('common.loading')}</p>}
        {state.error && <p style={S.err}>{state.error === 'failed_403' ? t('ngo.forbidden') : t('ngo.error')}</p>}

        {!state.loading && !state.error && state.items.length === 0 && (
          <p style={S.muted}>{t('ngoV2.funding.empty')}</p>
        )}

        <ul style={S.list}>
          {state.items.map((it) => (
            <li key={it.id} style={S.item}>
              <div style={S.itemHead}>
                <span style={{ ...S.chip, background: DECISION_COLOR[it.decision] || '#9FB3C8' }}>
                  {t(`ngoV2.funding.${it.decision === 'not_yet_eligible' ? 'notYet' : it.decision === 'needs_review' ? 'needsReview' : it.decision}`)}
                </span>
                <span style={S.meta}>
                  {t('ngoV2.scores.health')} {it.healthScore ?? '—'} · {t('ngoV2.scores.verification')} {it.verificationScore ?? '—'}
                </span>
              </div>
              <div style={S.itemReason}>{it.reason}</div>
              {Array.isArray(it.blockers) && it.blockers.length > 0 && (
                <div style={S.blockers}>
                  {it.blockers.map((b) => <span key={b} style={S.blockerTag}>{b}</span>)}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '64rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' },
  subtitle: { color: '#9FB3C8', fontSize: '0.9375rem', margin: '0 0 1rem' },
  filterRow: { display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' },
  select: { padding: '0.5rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem' },
  btn: { padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.8125rem', cursor: 'pointer' },
  list: { margin: 0, paddingLeft: 0, listStyle: 'none' },
  item: { padding: '0.875rem', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.5rem' },
  itemHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' },
  chip: { padding: '0.125rem 0.625rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 700, color: '#0B1D34', textTransform: 'uppercase' },
  meta: { fontSize: '0.75rem', color: '#9FB3C8' },
  itemReason: { fontSize: '0.875rem', marginBottom: '0.25rem' },
  blockers: { display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.375rem' },
  blockerTag: { padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.6875rem', background: 'rgba(239,68,68,0.14)', color: '#FCA5A5' },
  muted: { color: '#9FB3C8', fontSize: '0.875rem' },
  err: { color: '#FCA5A5' },
};
