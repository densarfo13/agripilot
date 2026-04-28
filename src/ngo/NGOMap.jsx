/**
 * NGOMap — NGO-facing map of farms + outbreak clusters.
 *
 *   <NGOMap
 *     farms={farms}            // Array<Farm>
 *     clusters={clusters}      // Array<NgoCluster>
 *     height={420}
 *   />
 *
 * Layout
 *   * Lazy-loaded react-leaflet bundle (existing OutbreakMap)
 *     wrapped in MapErrorBoundary so a chunk-load failure
 *     falls back to the list view automatically — never blocks
 *     the dashboard.
 *   * Below the map: a compact summary line ("X farms with GPS
 *     • Y in regions only") that confirms what the map shows
 *     and what's hidden from it (farms without GPS).
 *
 * Privacy contract (per brief § 10)
 *   * Farm points are only rendered when this component is
 *     mounted inside the NGO dashboard (an authorised
 *     org-user surface). The component itself doesn't enforce
 *     auth — the route-level ProtectedRoute does — but the
 *     popup intentionally shows ONLY crop + risk + last
 *     report timestamp + a recommended action. No farmer name,
 *     no farmer id, no phone number, no exact address.
 *   * Farms without GPS never render a point; they appear in
 *     the dashboard's region table instead.
 *   * The farmer-app NEVER imports NGOMap — only the NGO
 *     dashboard does. The shared contract is the cluster list,
 *     not the farm-point list.
 *
 * Strict-rule audit
 *   * Lazy-loads leaflet via React.lazy on the underlying
 *     OutbreakMap so the dashboard's first paint stays fast.
 *   * MapErrorBoundary catches the chunk-load + runtime errors
 *     and renders the list-fallback supplied as a sibling.
 *   * Defensive: missing / non-array inputs render the list
 *     fallback rather than crashing.
 *   * tSafe friendly: every visible string routes through tSafe
 *     with a calibrated English fallback.
 */

import React, { Suspense, lazy } from 'react';
import { tSafe } from '../i18n/tSafe.js';
import MapErrorBoundary from '../components/MapErrorBoundary.jsx';
import { hasGPS } from '../location/geoUtils.js';

// Lazy-loaded so the leaflet bundle (~150KB gz) only ships when
// the NGO actually opens the map.
const OutbreakMap = lazy(() => import('../components/OutbreakMap.jsx'));

function MapFallback() {
  return (
    <div style={S.fallback} role="status" aria-live="polite"
         data-testid="ngo-map-fallback">
      <span style={S.fallbackIcon} aria-hidden="true">{'\uD83D\uDDFA\uFE0F'}</span>
      <span>{tSafe('ngo.map.unavailable',
        'Map view unavailable. Showing data in the table below.')}</span>
    </div>
  );
}

function MapLoading() {
  return (
    <div style={S.loading} role="status" aria-live="polite"
         data-testid="ngo-map-loading">
      {tSafe('ngo.map.loading', 'Loading map\u2026')}
    </div>
  );
}

export default function NGOMap({
  farms        = [],
  clusters     = [],
  height       = 420,
  emptyMessage = '',
}) {
  const safeFarms    = Array.isArray(farms)    ? farms.filter(Boolean) : [];
  const safeClusters = Array.isArray(clusters) ? clusters.filter(Boolean) : [];

  const farmsWithGps    = safeFarms.filter((f) => hasGPS(f));
  const farmsWithoutGps = safeFarms.length - farmsWithGps.length;

  const hasAnythingToMap =
       safeClusters.some((c) => c.centerLat != null && c.centerLng != null)
    || farmsWithGps.length > 0;

  if (!hasAnythingToMap) {
    return (
      <div style={S.empty} role="status" data-testid="ngo-map-empty">
        <span style={S.emptyIcon} aria-hidden="true">{'\uD83D\uDDFA\uFE0F'}</span>
        <span style={S.emptyText}>
          {emptyMessage
            || tSafe('ngo.map.empty',
                'No farm locations to plot yet. Region table below covers all farms.')}
        </span>
      </div>
    );
  }

  return (
    <section style={S.wrap} data-testid="ngo-map">
      <MapErrorBoundary fallback={<MapFallback />}>
        <Suspense fallback={<MapLoading />}>
          <OutbreakMap
            clusters={safeClusters}
            farms={farmsWithGps}
            height={height}
          />
        </Suspense>
      </MapErrorBoundary>

      <p style={S.summary} data-testid="ngo-map-summary">
        <span>
          {tSafe('ngo.map.farmsWithGps',
            `${farmsWithGps.length} farms with GPS`)
            .replace(/\{count\}/g, String(farmsWithGps.length))}
        </span>
        {farmsWithoutGps > 0 && (
          <>
            {' \u00B7 '}
            <span>
              {tSafe('ngo.map.farmsRegionOnly',
                `${farmsWithoutGps} in regions only`)
                .replace(/\{count\}/g, String(farmsWithoutGps))}
            </span>
          </>
        )}
      </p>
    </section>
  );
}

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  fallback: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '1rem',
    background: 'rgba(252,211,77,0.08)',
    border: '1px solid rgba(252,211,77,0.30)',
    borderRadius: '12px',
    color: '#FCD34D',
    fontSize: '0.9375rem',
  },
  fallbackIcon: { fontSize: '1.125rem', lineHeight: 1, flexShrink: 0 },
  loading: {
    minHeight: '420px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    color: 'rgba(255,255,255,0.65)',
    fontSize: '0.9375rem',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '1rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.18)',
    borderRadius: '12px',
    color: 'rgba(255,255,255,0.65)',
    fontSize: '0.9375rem',
  },
  emptyIcon: { fontSize: '1.125rem', lineHeight: 1, flexShrink: 0 },
  emptyText: { flex: 1, minWidth: 0, overflowWrap: 'break-word' },
  summary: {
    margin: 0,
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.55)',
    overflowWrap: 'break-word',
  },
};
