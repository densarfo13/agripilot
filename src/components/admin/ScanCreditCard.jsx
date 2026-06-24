/**
 * ScanCreditCard.jsx — admin dashboard card for Kindwise scan credits.
 *
 * Renders remaining credits for plant.id / crop.health / insect.id with
 * a per-provider alert badge (<100 low · <50 warning · <20 critical),
 * daily burn rate, and estimated days remaining. Reads
 * GET /api/admin/scan-credits (server polls usage_info, cached 30 min).
 *
 * Honesty: an unconfigured/unreachable provider shows "Not configured" /
 * "Unknown" — never a fake 0. Pure render, never throws.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _token() {
  return _safe(() => (typeof localStorage !== 'undefined'
    ? localStorage.getItem('farroway_token') : null), null);
}

async function _fetchCredits(refresh) {
  const tok = _token();
  const res = await fetch('/api/admin/scan-credits' + (refresh ? '?refresh=1' : ''), {
    method: 'GET',
    credentials: 'include',
    headers: tok ? { Authorization: 'Bearer ' + tok } : {},
  });
  if (!res || !res.ok) throw new Error('http_' + (res ? res.status : 'none'));
  return res.json();
}

const ALERT = {
  ok:           { color: '#2f7a3a', bg: 'rgba(47,122,58,0.10)',  label: 'Healthy' },
  low:          { color: '#9a6a00', bg: 'rgba(154,106,0,0.12)',  label: 'Low (<100)' },
  warning:      { color: '#c0590f', bg: 'rgba(192,89,15,0.12)',  label: 'Warning (<50)' },
  critical:     { color: '#a13a3a', bg: 'rgba(161,58,58,0.14)',  label: 'Critical (<20)' },
  unknown:      { color: '#5a6472', bg: 'rgba(90,100,114,0.10)', label: 'Unknown' },
  unconfigured: { color: '#5a6472', bg: 'rgba(90,100,114,0.08)', label: 'Not configured' },
};
function _alert(level) { return ALERT[level] || ALERT.unknown; }

function _remainingText(p) {
  if (!p.configured) return tSafe('scanCredits.notConfigured', 'Not configured');
  if (p.remaining == null) return tSafe('scanCredits.unknown', 'Unknown');
  return String(p.remaining) + ' ' + tSafe('scanCredits.credits', 'credits');
}

function ScanCreditCardInner() {
  const [data, setData]   = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy]   = React.useState(false);

  const load = React.useCallback((refresh) => {
    setBusy(true);
    _fetchCredits(refresh)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e && e.message ? e.message : 'load_failed'))
      .finally(() => setBusy(false));
  }, []);

  React.useEffect(() => { load(false); }, [load]);

  const providers = _safe(() => (data && Array.isArray(data.providers) ? data.providers : []), []);
  const worst = _safe(() => (data && data.worstAlert) || 'unknown', 'unknown');

  return (
    <section style={S.card} data-testid="scan-credit-card" data-worst-alert={worst}>
      <header style={S.head}>
        <div>
          <p style={S.eyebrow}>{tSafe('scanCredits.eyebrow', 'Scan Credits')}</p>
          <h3 style={S.title}>{tSafe('scanCredits.title', 'Kindwise API Credits')}</h3>
        </div>
        <button type="button" style={S.btn} disabled={busy}
          onClick={() => load(true)} data-testid="scan-credit-refresh">
          {busy ? tSafe('scanCredits.checking', 'Checking…') : tSafe('scanCredits.refresh', 'Refresh')}
        </button>
      </header>

      {error ? (
        <p style={S.error} data-testid="scan-credit-error">
          {tSafe('scanCredits.error', 'Could not load credits.')} ({error})
        </p>
      ) : null}

      {!data && !error ? (
        <p style={S.muted}>{tSafe('scanCredits.loading', 'Loading credit status…')}</p>
      ) : null}

      {providers.map((p) => {
        const a = _alert(p.alertLevel);
        return (
          <div key={p.id} style={S.row} data-testid={'scan-credit-row-' + p.id}
            data-alert={p.alertLevel}>
            <div style={S.rowTop}>
              <span style={S.provName}>{p.label || p.id}</span>
              <span style={{ ...S.badge, color: a.color, background: a.bg }}>{a.label}</span>
            </div>
            <div style={S.rowMid}>
              <span style={{ ...S.remaining, color: a.color }}>{_remainingText(p)}</span>
              {p.limit != null ? (
                <span style={S.limit}>{tSafe('scanCredits.of', 'of')} {p.limit}</span>
              ) : null}
            </div>
            <div style={S.rowSub}>
              <span>{tSafe('scanCredits.burn', 'Daily burn')}: {p.dailyBurn == null ? '—' : p.dailyBurn}</span>
              <span>{tSafe('scanCredits.daysLeft', 'Days left')}: {p.daysRemaining == null ? '—' : p.daysRemaining}</span>
              {p.error ? <span style={S.errNote}>{p.error}</span> : null}
            </div>
          </div>
        );
      })}

      {data ? (
        <p style={S.foot}>
          {tSafe('scanCredits.foot', 'Thresholds: <100 low · <50 warning · <20 critical. Burn = credits/day; days left = remaining ÷ burn.')}
          {data.historyPoints != null ? ' · ' + data.historyPoints + ' ' + tSafe('scanCredits.points', 'samples') : ''}
        </p>
      ) : null}
    </section>
  );
}

export default class ScanCreditCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <ScanCreditCardInner {...this.props} />; } catch { return null; }
  }
}

const S = {
  card: { border: '1px solid rgba(60,72,55,0.12)', borderRadius: 12,
    background: 'rgba(255,255,255,0.9)', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'system-ui' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  eyebrow: { margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)' },
  title: { margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: '#1F2933' },
  btn: { minHeight: 34, padding: '0 14px', borderRadius: 8, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  error: { margin: 0, fontSize: 12, color: '#a13a3a' },
  errNote: { color: '#a13a3a' },
  muted: { margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.6)' },
  row: { display: 'flex', flexDirection: 'column', gap: 4,
    padding: '10px 0', borderTop: '1px solid rgba(60,72,55,0.06)' },
  rowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  provName: { fontSize: 14, fontWeight: 700, color: '#1F2933' },
  badge: { fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999 },
  rowMid: { display: 'flex', alignItems: 'baseline', gap: 8 },
  remaining: { fontSize: 18, fontWeight: 800 },
  limit: { fontSize: 12, color: 'rgba(60,72,55,0.6)' },
  rowSub: { display: 'flex', gap: 14, fontSize: 11, color: 'rgba(60,72,55,0.65)', flexWrap: 'wrap' },
  foot: { margin: '4px 0 0', fontSize: 10, color: 'rgba(60,72,55,0.5)', lineHeight: 1.4 },
};
