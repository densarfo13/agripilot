/**
 * MonitoringDashboardPage — Admin Monitoring Dashboard v1.
 *
 *   <Route path="/admin/monitoring" element={
 *     <RouteGuard path="/admin/monitoring">
 *       <MonitoringDashboardPage />
 *     </RouteGuard>
 *   } />
 *
 * 13 KPI cards, 4 filter dimensions, red-flag highlighting.
 *
 * Cards
 *   1.  Daily active users (+ WAU sub-line)
 *   2.  New farmers           (today + 7d total)
 *   3.  New backyard growers  (today + 7d total)
 *   4.  Task completion rate  (red flag when < 40%)
 *   5.  Crash count           (red flag when > 0)
 *   6.  Stuck screen count    (red flag when > 0)
 *   7.  Top error screens     (top-5 list)
 *   8.  Language usage        (top-5 list)
 *   9.  User type distribution
 *   10. Buyer activity        (buyer_interest count)
 *   11. Funding views         (funding_viewed count)
 *   12. Upload failures       (red flag on spike)
 *   13. API rate-limit hits   (red flag on spike)
 *
 * Filters
 *   • Window     — Today / 7 days / 30 days
 *   • User type  — All / farmer / backyard / ngo / buyer
 *   • Country    — text input (ISO-3166 alpha-2)
 *   • Region     — text input
 *   • Language   — All / en / fr / sw / ha / tw / hi
 *
 * Source
 *   Server-side: `GET /api/admin/metrics?windowDays=&userType=&country=&region=&language=`
 *     The route is admin-gated and Zod-validated. Returns the
 *     full envelope including `flags{...}` for the red-flag
 *     highlighter.
 *   Local fallback: when the API call fails, the dashboard
 *     re-derives the same shape from `farroway_events`
 *     localStorage so an operator on flaky network still sees
 *     numbers.
 *
 * Strict-rule audit
 *   • Read-only — never mutates the event store.
 *   • Pure presentational + `tSafe` wording.
 *   • Wrapped in RoleRoute at the App.jsx mount so only
 *     admin / platform_admin reaches it.
 *   • Mobile-first responsive grid (auto-fill min 180 px).
 *   • Auto-refresh every 60s.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tSafe } from '../../i18n/tSafe.js';
import { getEvents } from '../../core/eventStore.js';
import api from '../../api/client.js';

const DAY_MS    = 24 * 60 * 60 * 1000;
const WEEK_MS   = 7 * DAY_MS;
const TOP_N     = 5;

// ─── Local snapshot (fallback when API unreachable) ──────
//
// Mirrors the server-side `buildMetrics` shape so the
// dashboard renders the same cards regardless of source.
// Pure function — exported for unit tests.
export function buildSnapshot(events, opts = {}, now = Date.now()) {
  const windowDays = Math.max(1, Math.min(30, Number(opts.windowDays) || 7));
  const sinceMs = now - windowDays * DAY_MS;
  const yesterdayStart = _startOfDay(now) - DAY_MS;
  const yesterdayEnd   = _startOfDay(now);
  const todayStart     = _startOfDay(now);

  const filterUserType = (opts.userType && opts.userType !== 'all') ? String(opts.userType).toLowerCase() : null;
  const filterCountry  = opts.country ? String(opts.country).toUpperCase() : null;
  const filterRegion   = opts.region ? String(opts.region).toLowerCase() : null;
  const filterLanguage = (opts.language && opts.language !== 'all') ? String(opts.language).toLowerCase() : null;

  const usersToday      = new Set();
  const usersYesterday  = new Set();
  const usersWeek       = new Set();

  let taskViewed = 0, taskCompleted = 0, appErrors = 0, screenStuck = 0;
  let buyerInterest = 0, fundingViewed = 0, photoUploaded = 0, locationDenied = 0;
  let uploadFailed = 0, rateLimitHits = 0;

  const errorReasons = Object.create(null);
  const stuckRoutes  = Object.create(null);
  const langCounts   = Object.create(null);
  const userTypes    = { farmer: 0, backyard: 0, ngo: 0, buyer: 0, other: 0 };
  const farmsCreated = { total: 0, today: 0 };
  const growsCreated = { total: 0, today: 0 };

  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const ts   = Number(ev.timestamp || ev.ts || 0);
    if (!Number.isFinite(ts) || ts < sinceMs) continue;
    const name = ev.name || ev.event;
    const p    = ev.payload || {};
    const uid  = (ev.user && ev.user.userId) || ev.userId || p.userId || null;

    if (filterUserType) {
      const evUt = (p.userType || '').toLowerCase();
      if (evUt && evUt !== filterUserType) continue;
    }
    if (filterCountry) {
      const evC = (p.country || '').toUpperCase();
      if (evC && evC !== filterCountry) continue;
    }
    if (filterRegion) {
      const evR = (p.region || '').toLowerCase();
      if (evR && evR !== filterRegion && !evR.includes(filterRegion)) continue;
    }
    if (filterLanguage) {
      const evL = (p.language || p.code || p.to || '').toLowerCase();
      if (evL && evL !== filterLanguage) continue;
    }

    if (uid) {
      usersWeek.add(uid);
      if (ts >= todayStart) usersToday.add(uid);
      else if (ts >= yesterdayStart && ts < yesterdayEnd) usersYesterday.add(uid);
    }

    switch (name) {
      case 'task_viewed':    taskViewed += 1; break;
      case 'task_completed': taskCompleted += 1; break;
      case 'app_error': {
        appErrors += 1;
        const r = p.errorReason || p.route || 'unknown';
        errorReasons[r] = (errorReasons[r] || 0) + 1;
        break;
      }
      case 'screen_stuck': {
        screenStuck += 1;
        const r = p.route || 'unknown';
        stuckRoutes[r] = (stuckRoutes[r] || 0) + 1;
        break;
      }
      case 'buyer_interest':              buyerInterest += 1; break;
      case 'funding_viewed':              fundingViewed += 1; break;
      case 'photo_uploaded':              photoUploaded += 1; break;
      case 'location_permission_denied':  locationDenied += 1; break;
      case 'upload_failed':               uploadFailed  += 1; break;
      case 'rate_limit_hit':              rateLimitHits += 1; break;
      case 'language_changed': {
        const code = p.to || p.code || 'unknown';
        langCounts[code] = (langCounts[code] || 0) + 1;
        break;
      }
      case 'user_type_selected': {
        const t = (p.userType || 'other').toLowerCase();
        if (t === 'farmer' || t === 'backyard' || t === 'ngo' || t === 'buyer') userTypes[t] += 1;
        else userTypes.other += 1;
        break;
      }
      case 'farm_created': {
        farmsCreated.total += 1;
        if (ts >= todayStart) farmsCreated.today += 1;
        break;
      }
      case 'grow_created':
      case 'garden_created': {
        growsCreated.total += 1;
        if (ts >= todayStart) growsCreated.today += 1;
        break;
      }
      default: break;
    }
  }

  function topN(map, n) {
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1]).slice(0, n)
      .map(([key, count]) => ({ key, count }));
  }

  let retained = 0;
  for (const u of usersToday) if (usersYesterday.has(u)) retained += 1;
  const retentionRate = usersYesterday.size > 0 ? retained / usersYesterday.size : null;
  const completionRate = taskViewed > 0 ? taskCompleted / taskViewed : null;

  return {
    windowDays,
    sampleSize:     events.length,
    builtAt:        new Date(now).toISOString(),
    dau:            usersToday.size,
    wau:            usersWeek.size,
    yesterdayUsers: usersYesterday.size,
    retainedUsers:  retained,
    retentionRate,
    taskViewed, taskCompleted, completionRate,
    appErrors, screenStuck,
    buyerInterest, fundingViewed, photoUploaded, locationDenied,
    uploadFailed, rateLimitHits,
    farmsCreated, growsCreated,
    userTypeSplit: userTypes,
    languageUsage: langCounts,
    topErrors:      topN(errorReasons, TOP_N),
    topStuckRoutes: topN(stuckRoutes, TOP_N),
    flags: {
      crashes:        appErrors > 0,
      stuck:          screenStuck > 0,
      lowCompletion:  completionRate != null && completionRate < 0.40,
      rateLimitSpike: rateLimitHits >= 5,
      uploadFailures: uploadFailed >= 5
                       || (photoUploaded > 0 && uploadFailed / Math.max(1, photoUploaded + uploadFailed) > 0.10),
    },
    filters: {
      windowDays,
      userType: filterUserType || 'all',
      country:  filterCountry || null,
      region:   filterRegion || null,
      language: filterLanguage || 'all',
    },
    source: 'local',
  };
}

function _startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function pct(value) {
  if (value == null) return '—';
  return `${(Math.max(0, Math.min(1, value)) * 100).toFixed(1)}%`;
}

function num(value) {
  if (value == null) return '—';
  return Number(value).toLocaleString();
}

// ─── Component ───────────────────────────────────────────
export default function MonitoringDashboardPage() {
  useTranslation();
  const [tick, setTick] = useState(0);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  // Filters — drive both the URL query for the server call
  // and the local-fallback aggregator. Defaults match the
  // server's defaults (windowDays=7, all userTypes/languages).
  const [windowDays, setWindowDays] = useState(7);
  const [userType, setUserType]     = useState('all');
  const [country,  setCountry]      = useState('');
  const [region,   setRegion]       = useState('');
  const [language, setLanguage]     = useState('all');

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = { windowDays };
    if (userType !== 'all') params.userType = userType;
    if (country.trim())     params.country  = country.trim().toUpperCase();
    if (region.trim())      params.region   = region.trim();
    if (language !== 'all') params.language = language;
    try {
      const res = await api.get('/admin/metrics', { params });
      const data = (res && res.data) ? res.data : res;
      setSnapshot({ ...(data || {}), source: 'server' });
    } catch (err) {
      // Fallback to local store. Operator still gets numbers
      // even when the server is unreachable.
      let evs = [];
      try { evs = getEvents({ since: Date.now() - WEEK_MS, limit: 5000 }) || []; }
      catch { evs = []; }
      const local = buildSnapshot(evs, {
        windowDays, userType, country, region, language,
      });
      setSnapshot(local);
      setError(err && err.message ? err.message : 'metrics_fetch_failed');
    } finally {
      setLoading(false);
    }
  }, [windowDays, userType, country, region, language]);

  useEffect(() => { fetchMetrics(); /* on mount + filter change */ }, [fetchMetrics, tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const flags = (snapshot && snapshot.flags) || {};

  if (!snapshot && loading) {
    return (
      <main style={S.page} data-testid="monitoring-dashboard">
        <header style={S.header}>
          <h1 style={S.title}>{tSafe('admin.monitoring.title', 'Soft-launch monitoring')}</h1>
        </header>
        <div style={S.skeleton}>{tSafe('admin.monitoring.loading', 'Loading metrics…')}</div>
      </main>
    );
  }

  return (
    <main style={S.page} data-testid="monitoring-dashboard">
      <header style={S.header}>
        <h1 style={S.title}>
          {tSafe('admin.monitoring.title', 'Soft-launch monitoring')}
        </h1>
        <button
          type="button"
          style={S.refresh}
          onClick={() => setTick((t) => t + 1)}
          data-testid="monitoring-refresh"
        >
          {tSafe('admin.monitoring.refresh', 'Refresh')}
        </button>
      </header>

      <p style={S.sub}>
        {snapshot && snapshot.source === 'server'
          ? tSafe('admin.monitoring.windowLabelServer',
            `${snapshot.windowDays}-day window. Live from server.`)
          : tSafe('admin.monitoring.windowLabelLocal',
            `${snapshot && snapshot.windowDays || 7}-day window. Local fallback (server unreachable).`)}
      </p>

      {/* ─── Filters ───────────────────────────────────── */}
      <section style={S.filters} data-testid="monitoring-filters">
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>{tSafe('admin.monitoring.filter.window', 'Window')}</label>
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            style={S.select}
            data-testid="filter-window"
          >
            <option value={1}>{tSafe('admin.monitoring.window.today',   'Today')}</option>
            <option value={7}>{tSafe('admin.monitoring.window.week',    'Last 7 days')}</option>
            <option value={30}>{tSafe('admin.monitoring.window.month', 'Last 30 days')}</option>
          </select>
        </div>
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>{tSafe('admin.monitoring.filter.userType', 'User type')}</label>
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
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>{tSafe('admin.monitoring.filter.country', 'Country')}</label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. GH"
            style={S.input}
            maxLength={2}
            data-testid="filter-country"
          />
        </div>
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>{tSafe('admin.monitoring.filter.region', 'Region')}</label>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="—"
            style={S.input}
            maxLength={64}
            data-testid="filter-region"
          />
        </div>
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>{tSafe('admin.monitoring.filter.language', 'Language')}</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={S.select}
            data-testid="filter-language"
          >
            <option value="all">{tSafe('admin.monitoring.allLangs', 'All')}</option>
            <option value="en">EN</option>
            <option value="fr">FR</option>
            <option value="sw">SW</option>
            <option value="ha">HA</option>
            <option value="tw">TW</option>
            <option value="hi">HI</option>
          </select>
        </div>
      </section>

      {/* ─── 13 KPI cards ──────────────────────────────── */}
      <section style={S.grid}>
        <KpiCard
          label={tSafe('admin.monitoring.dau', 'Daily active users')}
          value={num(snapshot?.dau)}
          sub={`${tSafe('admin.monitoring.wau', 'WAU')}: ${num(snapshot?.wau)}`}
          testid="kpi-dau"
        />
        <KpiCard
          label={tSafe('admin.monitoring.farmsCreated', 'New farmers')}
          value={num(snapshot?.farmsCreated?.today)}
          sub={`${tSafe('admin.monitoring.weekTotal', '7d:')} ${num(snapshot?.farmsCreated?.total)}`}
          testid="kpi-farms"
        />
        <KpiCard
          label={tSafe('admin.monitoring.growsCreated', 'New backyard growers')}
          value={num(snapshot?.growsCreated?.today)}
          sub={`${tSafe('admin.monitoring.weekTotal', '7d:')} ${num(snapshot?.growsCreated?.total)}`}
          testid="kpi-grows"
        />
        <KpiCard
          label={tSafe('admin.monitoring.completionRate', 'Task completion')}
          value={pct(snapshot?.completionRate)}
          sub={`${num(snapshot?.taskCompleted)} / ${num(snapshot?.taskViewed)}`}
          flag={flags.lowCompletion ? 'warn' : null}
          testid="kpi-completion"
        />
        <KpiCard
          label={tSafe('admin.monitoring.crashes', 'Crashes')}
          value={num(snapshot?.appErrors)}
          sub={snapshot?.topErrors?.[0]
            ? `${tSafe('admin.monitoring.top', 'Top:')} ${snapshot.topErrors[0].key}`
            : tSafe('admin.monitoring.none', 'None')}
          flag={flags.crashes ? 'danger' : null}
          testid="kpi-crashes"
        />
        <KpiCard
          label={tSafe('admin.monitoring.stuck', 'Stuck screens')}
          value={num(snapshot?.screenStuck)}
          sub={snapshot?.topStuckRoutes?.[0]
            ? `${tSafe('admin.monitoring.top', 'Top:')} ${snapshot.topStuckRoutes[0].key}`
            : tSafe('admin.monitoring.none', 'None')}
          flag={flags.stuck ? 'warn' : null}
          testid="kpi-stuck"
        />
        <KpiCard
          label={tSafe('admin.monitoring.buyerInterest', 'Buyer activity')}
          value={num(snapshot?.buyerInterest)}
          sub={tSafe('admin.monitoring.buyerInterestSub', 'buyer_interest events')}
          testid="kpi-buyer"
        />
        <KpiCard
          label={tSafe('admin.monitoring.fundingViewed', 'Funding views')}
          value={num(snapshot?.fundingViewed)}
          sub={tSafe('admin.monitoring.fundingViewedSub', 'funding_viewed events')}
          testid="kpi-funding"
        />
        <KpiCard
          label={tSafe('admin.monitoring.uploadFailed', 'Upload failures')}
          value={num(snapshot?.uploadFailed)}
          sub={`${tSafe('admin.monitoring.uploadOk', 'OK:')} ${num(snapshot?.photoUploaded)}`}
          flag={flags.uploadFailures ? 'danger' : null}
          testid="kpi-uploads"
        />
        <KpiCard
          label={tSafe('admin.monitoring.rateLimitHits', 'API rate-limit hits')}
          value={num(snapshot?.rateLimitHits)}
          sub={tSafe('admin.monitoring.rateLimitHitsSub', 'last window')}
          flag={flags.rateLimitSpike ? 'danger' : null}
          testid="kpi-ratelimit"
        />
        <KpiCard
          label={tSafe('admin.monitoring.userTypeSplit', 'User type split')}
          value={`${snapshot?.userTypeSplit?.farmer || 0} / ${snapshot?.userTypeSplit?.backyard || 0}`}
          sub={`${tSafe('admin.monitoring.farmerVsBackyard', 'farmer / backyard')}  ·  NGO ${snapshot?.userTypeSplit?.ngo || 0}  ·  Buyer ${snapshot?.userTypeSplit?.buyer || 0}`}
          testid="kpi-user-type"
        />
        <KpiCard
          label={tSafe('admin.monitoring.retention', 'Day-over-day retention')}
          value={pct(snapshot?.retentionRate)}
          sub={`${num(snapshot?.retainedUsers)} of ${num(snapshot?.yesterdayUsers)} returned`}
          testid="kpi-retention"
        />
        <KpiCard
          label={tSafe('admin.monitoring.locationDenied', 'Location denied')}
          value={num(snapshot?.locationDenied)}
          sub={tSafe('admin.monitoring.locationDeniedSub', 'permission_denied events')}
          testid="kpi-locdenied"
        />
      </section>

      {/* ─── Top errors / stuck routes ─────────────────── */}
      {snapshot?.topErrors?.length > 0 && (
        <section style={S.section} data-testid="top-errors">
          <h2 style={S.sectionTitle}>
            {tSafe('admin.monitoring.topErrorsHeading', 'Top error screens')}
          </h2>
          <ul style={S.list}>
            {snapshot.topErrors.map((row) => (
              <li key={row.key} style={S.listRow}>
                <span style={S.listLabel}>{row.key}</span>
                <span style={S.listCount}>{num(row.count)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {snapshot?.topStuckRoutes?.length > 0 && (
        <section style={S.section} data-testid="top-stuck">
          <h2 style={S.sectionTitle}>
            {tSafe('admin.monitoring.topStuckHeading', 'Routes where users get stuck')}
          </h2>
          <ul style={S.list}>
            {snapshot.topStuckRoutes.map((row) => (
              <li key={row.key} style={S.listRow}>
                <span style={S.listLabel}>{row.key}</span>
                <span style={S.listCount}>{num(row.count)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── Language usage ────────────────────────────── */}
      {snapshot?.languageUsage && Object.keys(snapshot.languageUsage).length > 0 && (
        <section style={S.section} data-testid="language-usage">
          <h2 style={S.sectionTitle}>
            {tSafe('admin.monitoring.languageHeading', 'Language usage')}
          </h2>
          <ul style={S.list}>
            {Object.entries(snapshot.languageUsage)
              .sort((a, b) => b[1] - a[1])
              .slice(0, TOP_N)
              .map(([code, count]) => (
                <li key={code} style={S.listRow}>
                  <span style={S.listLabel}>{code.toUpperCase()}</span>
                  <span style={S.listCount}>{num(count)}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <footer style={S.footer}>
        {snapshot
          ? tSafe('admin.monitoring.sampleNote',
            `Built from ${snapshot.sampleSize ?? '?'} events · source: ${snapshot.source}`)
          : null}
        {error ? ` · ${tSafe('admin.monitoring.errorBadge', 'fallback active')}` : ''}
      </footer>
    </main>
  );
}

// ─── KPI card component (red-flag aware) ─────────────────
function KpiCard({ label, value, sub, flag, testid }) {
  const cardStyle = {
    ...S.kpi,
    ...(flag === 'danger' ? S.kpiDanger : {}),
    ...(flag === 'warn' ? S.kpiWarn : {}),
  };
  const valueStyle = {
    ...S.kpiValue,
    ...(flag === 'danger' ? { color: '#FCA5A5' } : {}),
    ...(flag === 'warn' ? { color: '#FCD34D' } : {}),
  };
  return (
    <div style={cardStyle} data-testid={testid} data-flag={flag || 'ok'}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={valueStyle}>{value}</div>
      {sub ? <div style={S.kpiSub}>{sub}</div> : null}
      {flag === 'danger' ? <div style={S.kpiFlagBadge}>{'\u26A0\uFE0F'}</div> : null}
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1.25rem 0.875rem 5rem',
    maxWidth: 1080,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 12,
    flexWrap: 'wrap',
  },
  title:  { margin: 0, fontSize: '1.375rem', fontWeight: 800 },
  sub:    { margin: '0 0 14px', color: '#9FB3C8', fontSize: 12 },
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
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 110,
    flex: '1 1 auto',
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#7A8FA6',
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
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#EAF2FF',
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 13,
    minHeight: 40,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 10,
    marginBottom: 18,
  },
  kpi: {
    position: 'relative',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
    minHeight: 96,
  },
  kpiDanger: {
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.40)',
  },
  kpiWarn: {
    background: 'rgba(252,211,77,0.06)',
    border: '1px solid rgba(252,211,77,0.35)',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#9FB3C8',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  kpiValue: { fontSize: 22, fontWeight: 800, lineHeight: 1.1 },
  kpiSub:   { fontSize: 11, color: '#7A8FA6', marginTop: 4 },
  kpiFlagBadge: {
    position: 'absolute',
    top: 8, right: 8,
    fontSize: 14,
  },
  section: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: { margin: '0 0 8px', fontSize: 13, fontWeight: 700 },
  list: {
    listStyle: 'none', margin: 0, padding: 0,
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  listRow: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 12,
    padding: '6px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  listLabel: { color: '#EAF2FF' },
  listCount: { color: '#22C55E', fontWeight: 700 },
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
