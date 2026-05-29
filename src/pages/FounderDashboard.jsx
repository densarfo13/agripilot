/**
 * FounderDashboard.jsx — internal-only adoption + engagement +
 * quality + plant-intelligence dashboard.
 *
 *   <Route path="/internal/founder" element={<FounderDashboard />} />
 *
 * What this is
 * ────────────
 *   The /internal/founder surface the spec calls for. Reads
 *   LOCAL aggregate signals only — no farmer private details
 *   beyond aggregate counts. Real backend metrics belong to a
 *   separate sprint.
 *
 *   Gated by an internal flag — `localStorage.farroway_internal
 *   === '1'` OR `?internal=1` query param. Non-internal users
 *   see a "Not authorized" notice without an admin error.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • Read-only against localStorage.
 *   • Aggregate counts only — no PII.
 *   • No secrets surfaced.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import {
  universalPlantRuntime,
} from '../runtime/plants/index';
import { PLANT_CATEGORIES } from '../modules/plants/plantCategories';

function _read(key, fallback) {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage && window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch { return fallback; }
}

function _isInternal() {
  try {
    if (typeof window === 'undefined') return false;
    const ls = window.localStorage;
    if (ls && ls.getItem('farroway_internal') === '1') return true;
    const params = new URLSearchParams(window.location.search);
    return params.get('internal') === '1';
  } catch { return false; }
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#E2E8F0',
    padding: '24px 16px 96px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  inner: { maxWidth: 960, margin: '0 auto' },
  title: { margin: '0 0 4px', fontSize: 24, fontWeight: 800,
           letterSpacing: '-0.01em', color: '#FFFFFF' },
  sub: { margin: '0 0 18px', fontSize: 13, color: '#94A3B8',
         lineHeight: 1.5 },
  section: { margin: '20px 0 8px', fontSize: 11, fontWeight: 700,
             color: '#94A3B8', textTransform: 'uppercase',
             letterSpacing: '0.08em' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 10,
  },
  tile: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  tileLabel: { fontSize: 11, fontWeight: 700, color: '#94A3B8',
               textTransform: 'uppercase', letterSpacing: '0.06em' },
  tileValue: { fontSize: 22, fontWeight: 800, color: '#FFFFFF',
               marginTop: 4 },
  notAuth: {
    maxWidth: 480, margin: '40px auto', padding: '24px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, textAlign: 'center',
  },
  cta: {
    appearance: 'none', border: 'none',
    background: '#C8944D', color: '#FFFFFF',
    padding: '10px 18px', borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', marginTop: 10,
  },
};

function Tile({ label, value, testid, emptyHint }) {
  // Honest rendering — never invent a number when the source
  // is missing. Render an em-dash with an optional tooltip.
  const shown = (value === null || value === undefined || value === '')
    ? '—' : value;
  return (
    <div style={S.tile} data-testid={testid}
      title={shown === '—' ? (emptyHint
        || 'Not enough data yet — needs backend wiring') : undefined}>
      <div style={S.tileLabel}>{label}</div>
      <div style={S.tileValue}>{shown}</div>
    </div>
  );
}

export default function FounderDashboard() {
  const navigate = useNavigate();
  const internal = _isInternal();

  const metrics = useMemo(() => {
    if (!internal) return null;
    const plants = _read('farroway_managed_plants', []);
    const events = _read('farroway_event_log', []);
    const sessions = _read('farroway_session_log', []);
    const offlineQueue = _read('farroway_offline_queue', []);
    const farms = _read('farroway_farms', []);
    const gardens = _read('farroway_gardens', []);
    const scanHistory = _read('farroway_scan_history_v1', []);

    const r = universalPlantRuntime({ plants, events });
    const summary = r && r.summary;
    const sections = summary ? summary.sections : [];

    const scansCompleted = Array.isArray(events)
      ? events.filter((e) => e && (e.eventType === 'scan_completed'
                              || e.eventType === 'scan_needs_review')).length
      : 0;
    const scansNeedsReview = Array.isArray(events)
      ? events.filter((e) => e && e.eventType === 'scan_needs_review').length
      : 0;
    const tasksCompleted = Array.isArray(events)
      ? events.filter((e) => e && e.eventType === 'task_completed').length
      : 0;
    const plantsFromScans = Array.isArray(plants)
      ? plants.filter((p) => Array.isArray(p && p.history)
          && p.history.some((h) => h && h.kind === 'registered_from_scan')).length
      : 0;
    const dailyBriefingOpens = _read('farroway_briefing_open_count', 0) || 0;
    const scanSuccessRate = scansCompleted === 0 ? 0
      : Math.round(((scansCompleted - scansNeedsReview) / scansCompleted) * 100);

    const categoryDistribution = PLANT_CATEGORIES.map((c) => {
      const found = sections && sections.find((s) => s.category === c);
      return { category: c, count: found ? found.count : 0 };
    });
    const avgHealth = summary && summary.avgHealthOverall != null
      ? summary.avgHealthOverall : null;

    const topCreated = (Array.isArray(plants) ? plants.slice() : [])
      .reduce((acc, p) => {
        if (!p || !p.commonName) return acc;
        acc[p.commonName] = (acc[p.commonName] || 0) + 1;
        return acc;
      }, {});
    const topPlants = Object.keys(topCreated)
      .map((k) => ({ name: k, count: topCreated[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      adoption: {
        // Gap-fix §10 — DO NOT invent traction. Real user count
        // needs backend wiring; local-only dashboards can't
        // honestly report platform users from one device.
        users:    null,
        farms:    Array.isArray(farms) ? farms.length : 0,
        gardens:  Array.isArray(gardens) ? gardens.length : 0,
        plantsCreated: Array.isArray(plants) ? plants.length : 0,
      },
      engagement: {
        scansCompleted,
        plantsFromScans,
        tasksCompleted,
        dailyBriefingOpens,
      },
      quality: {
        scanSuccessRate,
        scanNeedsReviewCount: scansNeedsReview,
        offlineQueueDepth: Array.isArray(offlineQueue) ? offlineQueue.length : 0,
        sessionCount: Array.isArray(sessions) ? sessions.length : 0,
        scanHistoryCount: Array.isArray(scanHistory) ? scanHistory.length : 0,
      },
      plantIntelligence: {
        categoryDistribution,
        avgHealth,
        topPlants,
      },
    };
  }, [internal]);

  if (!internal) {
    return (
      <main style={S.page} data-testid="founder-dashboard-page" data-state="not-authorized">
        <div style={S.notAuth}>
          <h1 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800,
                       color: '#FFFFFF' }}>
            {tSafe('founder.notAuth.title', 'Internal only')}
          </h1>
          <p style={{ fontSize: 13, color: '#94A3B8',
                      lineHeight: 1.5, margin: 0 }}>
            {tSafe('founder.notAuth.body',
              'This dashboard is internal. Set farroway_internal=1 in '
              + 'localStorage or append ?internal=1 to the URL if you have '
              + 'authorization.')}
          </p>
          <button type="button" style={S.cta} onClick={() => navigate('/')}>
            {tSafe('founder.notAuth.cta', 'Back to Home')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={S.page} data-testid="founder-dashboard-page" data-state="authorized">
      <div style={S.inner}>
        <h1 style={S.title}>
          {tSafe('founder.title', 'Founder Dashboard')}
        </h1>
        <p style={S.sub}>
          {tSafe('founder.subtitle',
            'Local aggregate metrics from this device. Production-tier '
            + 'metrics require backend wiring.')}
        </p>

        <div style={S.section}>{tSafe('founder.adoption', 'Adoption')}</div>
        <div style={S.grid}>
          <Tile testid="founder-adoption-users" value={metrics.adoption.users}
            label={tSafe('founder.users', 'Users')} />
          <Tile testid="founder-adoption-farms" value={metrics.adoption.farms}
            label={tSafe('founder.farms', 'Farms')} />
          <Tile testid="founder-adoption-gardens" value={metrics.adoption.gardens}
            label={tSafe('founder.gardens', 'Gardens')} />
          <Tile testid="founder-adoption-plants" value={metrics.adoption.plantsCreated}
            label={tSafe('founder.plantsCreated', 'Plants')} />
        </div>

        <div style={S.section}>{tSafe('founder.engagement', 'Engagement')}</div>
        <div style={S.grid}>
          <Tile testid="founder-engagement-scans" value={metrics.engagement.scansCompleted}
            label={tSafe('founder.scansCompleted', 'Scans completed')} />
          <Tile testid="founder-engagement-from-scans" value={metrics.engagement.plantsFromScans}
            label={tSafe('founder.plantsFromScans', 'Plants from scans')} />
          <Tile testid="founder-engagement-tasks" value={metrics.engagement.tasksCompleted}
            label={tSafe('founder.tasksCompleted', 'Tasks completed')} />
          <Tile testid="founder-engagement-briefing" value={metrics.engagement.dailyBriefingOpens}
            label={tSafe('founder.briefingOpens', 'Briefing opens')} />
        </div>

        <div style={S.section}>{tSafe('founder.quality', 'Quality')}</div>
        <div style={S.grid}>
          <Tile testid="founder-quality-success" value={metrics.quality.scanSuccessRate + '%'}
            label={tSafe('founder.scanSuccess', 'Scan success rate')} />
          <Tile testid="founder-quality-needs-review" value={metrics.quality.scanNeedsReviewCount}
            label={tSafe('founder.scanNeedsReview', 'Needs review')} />
          <Tile testid="founder-quality-offline-queue" value={metrics.quality.offlineQueueDepth}
            label={tSafe('founder.offlineQueue', 'Offline queue')} />
          <Tile testid="founder-quality-sessions" value={metrics.quality.sessionCount}
            label={tSafe('founder.sessions', 'Sessions')} />
          <Tile testid="founder-quality-scan-history" value={metrics.quality.scanHistoryCount}
            label={tSafe('founder.scanHistory', 'Scan history')} />
        </div>

        <div style={S.section}>{tSafe('founder.plantIntel', 'Plant intelligence')}</div>
        <div style={S.grid}>
          {metrics.plantIntelligence.categoryDistribution.map((c) => (
            <Tile
              key={c.category}
              testid={`founder-plant-${c.category}`}
              value={c.count}
              label={c.category}
            />
          ))}
          <Tile testid="founder-plant-avg-health"
            value={metrics.plantIntelligence.avgHealth == null ? '—'
                    : metrics.plantIntelligence.avgHealth}
            label={tSafe('founder.avgHealth', 'Avg health')} />
        </div>

        {metrics.plantIntelligence.topPlants.length > 0 ? (
          <>
            <div style={S.section}>{tSafe('founder.topPlants', 'Top plants')}</div>
            <div style={S.grid}>
              {metrics.plantIntelligence.topPlants.map((p) => (
                <Tile key={p.name}
                  testid={`founder-top-plant-${p.name}`}
                  value={p.count}
                  label={p.name} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
