/**
 * NGOMap — direct react-leaflet map for the NGO dashboard.
 *
 *   <NGOMap farms={farms} clusters={clusters} />
 *
 * Renders:
 *   * One CircleMarker per farm with lat/lng. Color encodes
 *     riskLevel (green LOW / orange MEDIUM / red HIGH).
 *   * One Circle per cluster with centerLat/centerLng. Radius
 *     scales with reportCount (min 8 km, x 3 km per report).
 *     Color encodes severity.
 *
 * Coexistence with src/ngo/NGOMap.jsx
 *   The earlier NGOMap (commit 81572ef) lazy-loads the leaflet
 *   chunk + wraps it in MapErrorBoundary — heavier, safer for
 *   first-paint-cost-sensitive surfaces. This component is the
 *   spec's lighter direct-import variant: same leaflet bundle,
 *   no Suspense / no boundary, intended for surfaces that have
 *   already paid the chunk cost (e.g. an admin dashboard
 *   loaded behind a deliberate "open dashboard" tap). Either
 *   can be used; nothing imports the other.
 *
 * Strict-rule audit
 *   * Falls back to a calm "Map data unavailable" message when
 *     no GPS farms AND no clusters with coords are passed —
 *     the dashboard's table/list keeps rendering below.
 *   * No farmer PII in popups: crop / region / risk / action.
 *     Phone / name / email never reach this component (the
 *     /ngo/farms endpoint server-side strips them).
 *   * Defensive: missing farm.location / NaN lat-lng / null
 *     cluster.centerLat — every per-row guard returns null so
 *     a single bad entry never crashes the render.
 *   * tSafe friendly for popup labels.
 */

import React, { useMemo } from 'react';
import {
  MapContainer, TileLayer, CircleMarker, Circle, Popup,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { tSafe } from '../i18n/tSafe.js';

const RISK_COLORS = Object.freeze({
  HIGH:   '#EF4444',
  MEDIUM: '#F59E0B',
  LOW:    '#22C55E',
});

function getRiskColor(risk) {
  const k = String(risk || '').toUpperCase();
  return RISK_COLORS[k] || RISK_COLORS.LOW;
}

function _hasFiniteLatLng(loc) {
  if (!loc) return false;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

export default function NGOMap({ farms = [], clusters = [] }) {
  // Filter once + memo so a parent re-render doesn't re-walk
  // the (potentially large) farm list every paint.
  const gpsFarms = useMemo(
    () => (Array.isArray(farms) ? farms : []).filter(
      (f) => f && _hasFiniteLatLng(f.location),
    ),
    [farms],
  );
  const validClusters = useMemo(
    () => (Array.isArray(clusters) ? clusters : []).filter(
      (c) => c
        && Number.isFinite(Number(c.centerLat))
        && Number.isFinite(Number(c.centerLng)),
    ),
    [clusters],
  );

  if (gpsFarms.length === 0 && validClusters.length === 0) {
    return (
      <div style={S.fallback}
           role="status" aria-live="polite"
           data-testid="ngo-map-fallback">
        <span style={S.fallbackIcon} aria-hidden="true">{'\uD83D\uDDFA\uFE0F'}</span>
        <span>
          {tSafe('ngo.map.dataUnavailable',
            'Map data unavailable. Showing region summary.')}
        </span>
      </div>
    );
  }

  // Center on the first GPS farm; fall back to the first
  // cluster centroid; ultimate fallback is a calm
  // West-Africa anchor so the map still shows tiles even
  // with malformed inputs (real org data overrides this on
  // every real render).
  const center = gpsFarms.length > 0
    ? [Number(gpsFarms[0].location.lat),
       Number(gpsFarms[0].location.lng)]
    : validClusters.length > 0
      ? [Number(validClusters[0].centerLat),
         Number(validClusters[0].centerLng)]
      : [6.5, -1.5];

  return (
    <div style={S.wrap} data-testid="ngo-map">
      <MapContainer
        center={center}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {gpsFarms.map((farm) => {
          const lat = Number(farm.location.lat);
          const lng = Number(farm.location.lng);
          const color = getRiskColor(farm.riskLevel);
          const region = (farm.location && farm.location.region) || '';
          return (
            <CircleMarker
              key={String(farm.id || `${lat}-${lng}`)}
              center={[lat, lng]}
              radius={7}
              pathOptions={{
                color, fillColor: color, fillOpacity: 0.8, weight: 1,
              }}
            >
              <Popup>
                <strong>
                  {farm.crop
                    || tSafe('ngo.map.popup.farm', 'Farm')}
                </strong>
                <br />
                {tSafe('ngo.map.popup.region', 'Region')}: {region
                  || tSafe('ngo.map.popup.unknown', 'Unknown')}
                <br />
                {tSafe('ngo.map.popup.risk', 'Risk')}: {String(farm.riskLevel
                  || 'LOW').toUpperCase()}
              </Popup>
            </CircleMarker>
          );
        })}

        {validClusters.map((cluster) => {
          const lat = Number(cluster.centerLat);
          const lng = Number(cluster.centerLng);
          const reportCount = Number(cluster.reportCount) || 1;
          const radius = Math.max(8000, reportCount * 3000);
          const color = getRiskColor(cluster.severity);
          const action = cluster.recommendedAction
            && (cluster.recommendedAction.fallback
              || cluster.recommendedAction.messageKey);
          return (
            <Circle
              key={String(cluster.id || `${lat}-${lng}`)}
              center={[lat, lng]}
              radius={radius}
              pathOptions={{
                color, fillColor: color, fillOpacity: 0.18, weight: 1,
              }}
            >
              <Popup>
                <strong>
                  {String(cluster.issueType || 'risk')} {tSafe(
                    'ngo.map.popup.cluster', 'cluster')}
                </strong>
                <br />
                {tSafe('ngo.map.popup.region', 'Region')}: {cluster.region
                  || tSafe('ngo.map.popup.unknown', 'Unknown')}
                <br />
                {tSafe('ngo.map.popup.reports', 'Reports')}: {reportCount}
                <br />
                {tSafe('ngo.map.popup.severity', 'Severity')}:
                {' '}{String(cluster.severity || 'LOW').toUpperCase()}
                {action && (
                  <>
                    <br />
                    {tSafe('ngo.map.popup.action', 'Action')}: {action}
                  </>
                )}
              </Popup>
            </Circle>
          );
        })}
      </MapContainer>
    </div>
  );
}

export { getRiskColor };

const S = {
  wrap: {
    height: 420,
    borderRadius: 16,
    overflow: 'hidden',
  },
  fallback: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '1.5rem',
    background: '#111A2E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    color: 'rgba(255,255,255,0.75)',
    fontSize: '0.9375rem',
  },
  fallbackIcon: { fontSize: '1.125rem', lineHeight: 1, flexShrink: 0 },
};
