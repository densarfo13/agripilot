/**
 * FarmerAnalyticsCards — Phase 7D read-only analytics grid.
 *
 * Spec coverage (Phase 7D §basic farmer cards)
 *   1. Tasks completed this week
 *   2. Listings created (device-local)
 *   3. Buyer interests received
 *   4. Saved funding opportunities
 *   5. Crop progress status
 *
 * Data: read from localStorage via farmerAnalytics.js on mount.
 *       No network calls — renders correctly offline.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Never throws — each metric read is wrapped in independent
 *     try/catch inside farmerAnalytics.js; the component also
 *     guards the setState path.
 *   • Missing data → 0 or "—" — never a crash.
 *   • Hooks called unconditionally (passes lint:hooks).
 */

import { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import {
  getTasksCompletedThisWeek,
  getListingsCreated,
  getInterestsReceived,
  getSavedFundingCount,
  getCropProgressStatus,
} from '../../lib/farmerAnalytics.js';

// ─── Styles ──────────────────────────────────────────────────

const S = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
    gap: 10,
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    minWidth: 0,
  },
  skeleton: {
    opacity: 0.35,
  },
  label: {
    margin: 0,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  value: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.1,
  },
  valueSm: {
    margin: 0,
    fontSize: 17,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.3,
    wordBreak: 'break-word',
  },
  sub: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.4,
  },
};

// ─── MetricCard ───────────────────────────────────────────────

function MetricCard({ label, value, valueLarge = true, sub, testId }) {
  return (
    <div style={S.card} data-testid={testId}>
      <p style={S.label}>{label}</p>
      <p style={valueLarge ? S.value : S.valueSm}>{value}</p>
      {sub ? <p style={S.sub}>{sub}</p> : null}
    </div>
  );
}

// ─── FarmerAnalyticsCards ─────────────────────────────────────

/**
 * @param {{ style?: object }} [props]
 *   style — optional override merged onto the grid wrapper.
 */
export default function FarmerAnalyticsCards({ style }) {
  // Hook must be unconditional — called before any early return.
  useTranslation();

  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    // Read all stores once on mount. Each metric wrapped in its own
    // try/catch so a corrupt key can't zero its siblings.
    let tasksThisWeek    = 0;
    let listingsCreated  = 0;
    let interestsReceived = 0;
    let savedFunding     = 0;
    let cropProgress     = null;

    try { tasksThisWeek     = getTasksCompletedThisWeek(); } catch { /* 0 */ }
    try { listingsCreated   = getListingsCreated();         } catch { /* 0 */ }
    try { interestsReceived = getInterestsReceived();       } catch { /* 0 */ }
    try { savedFunding      = getSavedFundingCount();       } catch { /* 0 */ }
    try { cropProgress      = getCropProgressStatus();      } catch { /* null */ }

    try {
      setMetrics({
        tasksThisWeek,
        listingsCreated,
        interestsReceived,
        savedFunding,
        cropProgress,
      });
    } catch { /* guard against unmount race */ }
  }, []); // read once; metrics are snapshots, not live feeds

  // ── Skeleton ──────────────────────────────────────────────
  if (!metrics) {
    return (
      <div style={{ ...S.grid, ...(style || {}) }} aria-busy="true" aria-label="Loading analytics">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ ...S.card, ...S.skeleton }}>
            <p style={S.label}>{tStrict('analytics.loading', 'Loading…')}</p>
            <p style={S.value}>—</p>
          </div>
        ))}
      </div>
    );
  }

  // ── Crop display string ───────────────────────────────────
  const cropRaw = metrics.cropProgress?.crop || '';
  const cropDisplay = cropRaw
    ? cropRaw.charAt(0).toUpperCase() + cropRaw.slice(1)
    : null;

  const cropSub = metrics.cropProgress?.stage
    ? metrics.cropProgress.stage.charAt(0).toUpperCase()
        + metrics.cropProgress.stage.slice(1)
    : cropDisplay
      ? tStrict('analytics.stageUnknown', 'Stage not set')
      : tStrict('analytics.noFarmSetUp',  'Set up a farm to see crop status');

  return (
    <div style={{ ...S.grid, ...(style || {}) }}>
      {/* 1. Tasks completed this week */}
      <MetricCard
        testId="analytics-tasks-week"
        label={tStrict('analytics.tasksThisWeek', 'Tasks this week')}
        value={metrics.tasksThisWeek}
        sub={tStrict('analytics.markedDone', 'marked done')}
      />

      {/* 2. Listings created */}
      <MetricCard
        testId="analytics-listings"
        label={tStrict('analytics.listingsCreated', 'Listings created')}
        value={metrics.listingsCreated}
        sub={tStrict('analytics.onThisDevice', 'on this device')}
      />

      {/* 3. Buyer interests received */}
      <MetricCard
        testId="analytics-interests"
        label={tStrict('analytics.buyerInterests', 'Buyer interests')}
        value={metrics.interestsReceived}
        sub={tStrict('analytics.interestsReceived', 'received')}
      />

      {/* 4. Saved funding opportunities */}
      <MetricCard
        testId="analytics-funding"
        label={tStrict('analytics.savedFunding', 'Saved funding')}
        value={metrics.savedFunding}
        sub={tStrict('analytics.opportunities', 'opportunities bookmarked')}
      />

      {/* 5. Crop progress status */}
      <MetricCard
        testId="analytics-crop"
        label={tStrict('analytics.cropProgress', 'Crop progress')}
        value={cropDisplay || tStrict('analytics.noCrop', '—')}
        valueLarge={false}
        sub={cropSub}
      />
    </div>
  );
}
