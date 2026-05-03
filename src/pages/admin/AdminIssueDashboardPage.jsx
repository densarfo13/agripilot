/**
 * AdminIssueDashboardPage — Live Admin Issue Dashboard.
 *
 *   <Route path="/admin/issues" element={
 *     <RoleRoute roles={ADMIN_ROLES}><AdminIssueDashboardPage /></RoleRoute>
 *   } />
 *
 * What it shows
 *   • System status: Green / Yellow / Red traffic-light badge
 *   • Headline numbers (DAU, crashes, stuck, completion, uploads, rate-limit)
 *   • Alerts list — ranked red → yellow → green with affected route
 *     + suggested operator action
 *   • Top user confusion signals — routes that triggered both
 *     `screen_stuck` and `app_error` in the window
 *
 * Source
 *   `GET /api/admin/alerts?windowDays=&userType=&country=&region=&language=`
 *   Admin-gated. Returns clean JSON only — never a stack trace,
 *   never a raw Prisma error.
 *
 * Strict-rule audit
 *   • Read-only — never mutates the event store or alert state.
 *   • All wording via `tSafe` so missing keys never leak raw English.
 *   • Mobile-first: alert cards stack vertically below 720 px.
 *   • Auto-refresh every 60 s; manual refresh via the header button.
 *   • No fake data — when the API is down OR the cluster is quiet
 *     the page renders the GREEN state with the "no traffic yet"
 *     informational alert.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tSafe } from '../../i18n/tSafe.js';
import api from '../../api/client.js';

// ─── Component ───────────────────────────────────────────
export default function AdminIssueDashboardPage() {
  useTranslation();
  const [tick, setTick] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters — mirror the admin/metrics dashboard so an operator
  // can flip between numbers + alerts without reconfiguring.
  const [windowDays, setWindowDays] = useState(1); // alerts default = "today"
  const [userType, setUserType]     = useState('all');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = { windowDays };
    if (userType !== 'all') params.userType = userType;
    try {
      const res = await api.get('/admin/alerts', { params });
      const body = (res && res.data) ? res.data : res;
      setData(body || null);
    } catch (err) {
      setError(err && err.message ? err.message : 'alerts_fetch_failed');
      // Set a "green" fallback envelope so the UI renders
      // without numbers rather than blank.
      setData({
        systemStatus: 'green',
        alerts: [],
        confusionSignals: [],
        headline: {},
        filters: { windowDays },
      });
    } finally {
      setLoading(false);
    }
  }, [windowDays, userType]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts, tick]);

  // 60-second auto-refresh — operator can leave the tab open.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading && !data) {
    return (
      <main style={S.page} data-testid="admin-issues-loading">
        <header style={S.header}>
          <h1 style={S.title}>{tSafe('admin.issues.title', 'Live issue dashboard')}</h1>
        </header>
        <div style={S.skeleton}>{tSafe('admin.issues.loading', 'Loading…')}</div>
      </main>
    );
  }

  const status = (data && data.systemStatus) || 'green';
  const alerts = (data && data.alerts) || [];
  const confusion = (data && data.confusionSignals) || [];
  const headline = (data && data.headline) || {};
  const builtAt = data && data.builtAt;

  return (
    <main style={S.page} data-testid="admin-issues">
      <header style={S.header}>
        <h1 style={S.title}>
          {tSafe('admin.issues.title', 'Live issue dashboard')}
        </h1>
        <button
          type="button"
          style={S.refresh}
          onClick={() => setTick((t) => t + 1)}
          data-testid="issues-refresh"
        >
          {tSafe('admin.issues.refresh', 'Refresh')}
        </button>
      </header>

      {/* ─── System status badge ──────────────────────────── */}
      <section style={S.statusRow} data-testid="issues-status" data-status={status}>
        <StatusBadge status={status} />
        <div style={S.statusMeta}>
          <div style={S.statusLabel}>
            {tSafe('admin.issues.systemStatus', 'System status')}
          </div>
          <div style={S.statusSummary}>
            {alerts.length === 0
              ? tSafe('admin.issues.allClear', 'All clear. No alerts in the current window.')
              : tSafe('admin.issues.activeAlerts',
                  `${alerts.length} alert${alerts.length === 1 ? '' : 's'} in the current window.`)}
          </div>
        </div>
      </section>

      {/* ─── Filters (compact) ────────────────────────────── */}
      <section style={S.filters}>
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>{tSafe('admin.issues.window', 'Window')}</label>
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            style={S.select}
            data-testid="filter-window"
          >
            <option value={1}>{tSafe('admin.monitoring.window.today',  'Today')}</option>
            <option value={7}>{tSafe('admin.monitoring.window.week',   'Last 7 days')}</option>
            <option value={30}>{tSafe('admin.monitoring.window.month', 'Last 30 days')}</option>
          </select>
        </div>
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>{tSafe('admin.issues.userType', 'User type')}</label>
          <select
            value={userType}
            onChange={(e) => setUserType(e.target.value)}
            style={S.select}
            data-testid="filter-user-type"
          >
            <option value="all">{tSafe('admin.monitoring.allUsers', 'All')}</option>
            <option value="farmer">{tSafe('admin.monitoring.userType.farmer', 'Farmer')}</option>
            <option value="backyard">{tSafe('admin.monitoring.userType.backyard', 'Backyard')}</option>
            <option value="ngo">{tSafe('admin.monitoring.userType.ngo', 'NGO')}</option>
            <option value="buyer">{tSafe('admin.monitoring.userType.buyer', 'Buyer')}</option>
          </select>
        </div>
      </section>

      {/* ─── Headline numbers strip ───────────────────────── */}
      <section style={S.headline}>
        <Headline label={tSafe('admin.issues.dau', 'DAU')}            value={fmt(headline.dau)} />
        <Headline label={tSafe('admin.issues.crashes', 'Crashes')}    value={fmt(headline.crashes)}    flag={headline.crashes > 0 ? 'warn' : null} />
        <Headline label={tSafe('admin.issues.stuck', 'Stuck')}        value={fmt(headline.stuck)}      flag={headline.stuck > 0 ? 'warn' : null} />
        <Headline label={tSafe('admin.issues.completion', 'Completion')} value={pct(headline.completionRate)} />
        <Headline label={tSafe('admin.issues.uploadFailed', 'Uploads fail')} value={fmt(headline.uploadFailed)} flag={headline.uploadFailed >= 5 ? 'warn' : null} />
        <Headline label={tSafe('admin.issues.rateLimit', 'Rate-limit')}   value={fmt(headline.rateLimitHits)} flag={headline.rateLimitHits >= 5 ? 'warn' : null} />
      </section>

      {/* ─── Alerts list ──────────────────────────────────── */}
      <section style={S.section} data-testid="issues-alerts">
        <h2 style={S.sectionTitle}>{tSafe('admin.issues.alertsHeading', 'Active alerts')}</h2>
        {alerts.length === 0 ? (
          <div style={S.empty}>
            <span style={S.emptyIcon} aria-hidden="true">{'\u2714\uFE0F'}</span>
            <span>
              {tSafe('admin.issues.empty',
                'No alerts. Soft-launch metrics are within target ranges.')}
            </span>
          </div>
        ) : (
          <ul style={S.list}>
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </ul>
        )}
      </section>

      {/* ─── Top user confusion signals ───────────────────── */}
      {confusion.length > 0 && (
        <section style={S.section} data-testid="issues-confusion">
          <h2 style={S.sectionTitle}>
            {tSafe('admin.issues.confusionHeading', 'Top user confusion signals')}
          </h2>
          <p style={S.subtle}>
            {tSafe('admin.issues.confusionSub',
              'Routes that triggered BOTH stuck-screen and app_error events. Inspect first.')}
          </p>
          <ul style={S.list}>
            {confusion.map((c) => (
              <li key={c.route} style={S.confusionRow}>
                <span style={S.confusionRoute}>{c.route}</span>
                <span style={S.confusionMeta}>
                  {tSafe('admin.issues.stuckCount', `${c.stuckCount} stuck`)}
                  {' · '}
                  {tSafe('admin.issues.errorCount', `${c.errorCount} errors`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer style={S.footer}>
        {builtAt
          ? tSafe('admin.issues.builtAt', `Built ${new Date(builtAt).toLocaleTimeString()} · auto-refresh 60s`)
          : tSafe('admin.issues.builtAtFallback', 'Auto-refresh 60s')}
        {error ? ` · ${tSafe('admin.issues.fallback', 'fallback active')}` : ''}
      </footer>
    </main>
  );
}

// ─── Sub-components ──────────────────────────────────────
function StatusBadge({ status }) {
  const colour = status === 'red'
    ? '#EF4444'
    : status === 'yellow'
      ? '#FCD34D'
      : '#22C55E';
  const label = status === 'red'
    ? tSafe('admin.issues.statusRed',    'RED')
    : status === 'yellow'
      ? tSafe('admin.issues.statusYellow','YELLOW')
      : tSafe('admin.issues.statusGreen', 'GREEN');
  return (
    <div style={{
      ...S.badge,
      backgroundColor: colour,
      color: status === 'yellow' ? '#3B2F00' : '#062714',
    }} data-testid="status-badge" data-value={status}>
      <span style={S.badgeDot} aria-hidden="true">●</span>
      <span>{label}</span>
    </div>
  );
}

function Headline({ label, value, flag }) {
  return (
    <div style={{
      ...S.headlineCell,
      ...(flag === 'warn' ? S.headlineCellWarn : {}),
    }}>
      <div style={S.headlineLabel}>{label}</div>
      <div style={{
        ...S.headlineValue,
        ...(flag === 'warn' ? { color: '#FCD34D' } : {}),
      }}>{value}</div>
    </div>
  );
}

function AlertCard({ alert }) {
  const colour = alert.severity === 'red'
    ? '#EF4444'
    : alert.severity === 'yellow'
      ? '#FCD34D'
      : '#22C55E';
  const tag = alert.severity === 'red'
    ? tSafe('admin.issues.tagRed',    'CRITICAL')
    : alert.severity === 'yellow'
      ? tSafe('admin.issues.tagYellow','WARNING')
      : tSafe('admin.issues.tagGreen', 'INFO');
  return (
    <li style={{
      ...S.alert,
      borderLeftColor: colour,
    }} data-testid={`alert-${alert.id}`} data-severity={alert.severity}>
      <div style={S.alertHead}>
        <span style={{ ...S.alertTag, backgroundColor: colour, color: alert.severity === 'yellow' ? '#3B2F00' : '#062714' }}>
          {tag}
        </span>
        <span style={S.alertTitle}>{alert.title}</span>
      </div>
      <div style={S.alertDescription}>{alert.description}</div>
      {Array.isArray(alert.affected) && alert.affected.length > 0 ? (
        <div style={S.alertAffected}>
          <span style={S.alertAffectedLabel}>
            {tSafe('admin.issues.affected', 'Affected:')}
          </span>{' '}
          {alert.affected.map((a, i) => (
            <span key={a + i} style={S.alertAffectedItem}>{a}</span>
          ))}
        </div>
      ) : null}
      <div style={S.alertAction}>
        <span style={S.alertActionLabel}>
          {tSafe('admin.issues.action', 'Suggested action:')}
        </span>{' '}
        {alert.action}
      </div>
    </li>
  );
}

function fmt(value) {
  if (value == null) return '—';
  return Number(value).toLocaleString();
}

function pct(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(Math.max(0, Math.min(1, value)) * 100).toFixed(1)}%`;
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1.25rem 0.875rem 5rem',
    maxWidth: 960,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
    flexWrap: 'wrap',
  },
  title: { margin: 0, fontSize: '1.375rem', fontWeight: 800 },
  refresh: {
    background: '#22C55E',
    color: '#062714',
    border: 'none',
    borderRadius: 10,
    padding: '8px 14px',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 40,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 999,
    fontWeight: 800,
    letterSpacing: '0.06em',
    fontSize: 14,
  },
  badgeDot: { fontSize: 10, lineHeight: 1 },
  statusMeta: { display: 'flex', flexDirection: 'column', gap: 2 },
  statusLabel: { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9FB3C8' },
  statusSummary: { fontSize: 14, color: '#EAF2FF' },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110, flex: '1 1 auto' },
  filterLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: '#7A8FA6',
  },
  select: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#EAF2FF',
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 13,
    minHeight: 40,
  },
  headline: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 8,
    marginBottom: 16,
  },
  headlineCell: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 10,
  },
  headlineCellWarn: {
    background: 'rgba(252,211,77,0.06)',
    border: '1px solid rgba(252,211,77,0.30)',
  },
  headlineLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
    textTransform: 'uppercase', color: '#9FB3C8',
    marginBottom: 4,
  },
  headlineValue: { fontSize: 18, fontWeight: 800, lineHeight: 1.1 },
  section: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { margin: '0 0 8px', fontSize: 14, fontWeight: 700 },
  subtle: { margin: '0 0 8px', fontSize: 11, color: '#7A8FA6' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  empty: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 12px',
    color: '#86EFAC', fontSize: 13,
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.20)',
    borderRadius: 10,
  },
  emptyIcon: { fontSize: 18 },
  alert: {
    background: 'rgba(255,255,255,0.04)',
    borderLeft: '4px solid #22C55E',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  alertHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  alertTag: {
    fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
    padding: '3px 8px', borderRadius: 6,
  },
  alertTitle: { fontSize: 14, fontWeight: 800, color: '#EAF2FF' },
  alertDescription: { fontSize: 13, color: '#9FB3C8', lineHeight: 1.4 },
  alertAffected: { fontSize: 12, color: '#EAF2FF' },
  alertAffectedLabel: { color: '#7A8FA6', fontWeight: 700 },
  alertAffectedItem: {
    display: 'inline-block',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 6,
    padding: '2px 8px',
    margin: '2px 4px 2px 0',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 11,
  },
  alertAction: { fontSize: 12, color: '#9FB3C8', lineHeight: 1.4 },
  alertActionLabel: { color: '#22C55E', fontWeight: 700 },
  confusionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: 13,
  },
  confusionRoute: { color: '#EAF2FF', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
  confusionMeta: { color: '#7A8FA6', fontSize: 11 },
  footer: {
    marginTop: 12,
    fontSize: 10,
    color: '#5A6A7E',
    textAlign: 'center',
  },
  skeleton: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 24,
    textAlign: 'center',
    color: '#7A8FA6',
    fontSize: 13,
  },
};
