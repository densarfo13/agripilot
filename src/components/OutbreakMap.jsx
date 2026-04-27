/**
 * OutbreakMap — react-leaflet host for the NGO control panel.
 *
 *   <OutbreakMap clusters={clusters} height={400} />
 *
 * Renders one circle per cluster, sized + coloured by severity.
 * Clicking a circle pops up { issueType, reportCount, severity,
 * region }. The component is HEAVY (leaflet bundle + its CSS)
 * so it MUST be code-split by callers via React.lazy. See
 * NgoControlPanel.jsx for the lazy boundary + Suspense
 * fallback.
 *
 * Strict-rule audit:
 *   * works on low-end devices: clusters capped to MAX_CLUSTERS,
 *     circle radius is constant per severity (no per-zoom heavy
 *     work), no animation
 *   * never blocks UI: caller wraps this in Suspense + a
 *     MapErrorBoundary so chunk-load + leaflet runtime errors
 *     stay contained
 *   * defensive on every cluster: missing lat/lng entries are
 *     filtered out before any leaflet API call so a single
 *     bad row never crashes the map
 */

import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { tSafe } from '../i18n/tSafe.js';

export const MAX_CLUSTERS = 50;

const SEV_STYLE = Object.freeze({
  high:   { color: '#EF4444', radius: 20000, weight: 2 },
  medium: { color: '#F59E0B', radius: 12000, weight: 2 },
  low:    { color: '#3B82F6', radius:  8000, weight: 1 },
});

function _isLatLng(lat, lng) {
  const a = Number(lat), b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a < -90 || a > 90)   return false;
  if (b < -180 || b > 180) return false;
  return true;
}

function _normSeverity(s) {
  const x = String(s || '').toLowerCase();
  if (x === 'high' || x === 'medium' || x === 'low') return x;
  return 'low';
}

function _centerOf(circles) {
  if (!circles.length) return [0, 0];
  // Average lat/lng. Leaflet handles wraparound fine at the
  // small ranges we use; not worth pulling in geo.centroid.
  let lat = 0, lng = 0;
  for (const c of circles) { lat += c.lat; lng += c.lng; }
  return [lat / circles.length, lng / circles.length];
}

export default function OutbreakMap({
  clusters = [],
  height   = 400,
  defaultCenter = [6.5, -1.5],     // Ghana - matches the pilot region
  defaultZoom   = 6,
}) {
  // Filter + cap once per render. Sort by severity desc + count
  // desc so the top-50 cap shows the highest-impact circles
  // first.
  const drawable = useMemo(() => {
    if (!Array.isArray(clusters)) return [];
    const sevRank = { high: 3, medium: 2, low: 1 };
    return clusters
      .filter((c) => c && _isLatLng(c.lat, c.lng))
      .map((c) => ({
        id:          String(c.id || `${c.lat},${c.lng}`),
        lat:         Number(c.lat),
        lng:         Number(c.lng),
        severity:    _normSeverity(c.severity),
        reportCount: Number.isFinite(Number(c.reportCount)) ? Number(c.reportCount) : 0,
        issueType:   String(c.issueType || ''),
        region:      String(c.region || ''),
      }))
      .sort((a, b) => (
        (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0)
        || b.reportCount - a.reportCount
      ))
      .slice(0, MAX_CLUSTERS);
  }, [clusters]);

  const center = useMemo(() => (
    drawable.length ? _centerOf(drawable) : defaultCenter
  ), [drawable, defaultCenter]);

  // Hard-cap a runaway parent that passed style with a tiny
  // height into us; leaflet renders nothing useful below ~120px.
  const safeHeight = Math.max(160, Number(height) || 400);

  // Belt-and-braces: leaflet's icon defaults try to load PNGs
  // from /images that we don't ship. Strip the default-icon
  // shim once on mount to avoid a 404 + a console warn. The
  // circle markers we use don't need the icon; this keeps the
  // console clean for the rest of the page.
  useEffect(() => {
    try {
      if (L && L.Icon && L.Icon.Default) {
        // eslint-disable-next-line no-underscore-dangle
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({});
      }
    } catch { /* swallow */ }
  }, []);

  return (
    <div style={{ ...S.wrap, height: safeHeight }} data-testid="outbreak-map">
      <MapContainer
        center={center}
        zoom={defaultZoom}
        scrollWheelZoom={false}
        style={S.map}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {drawable.map((c) => {
          const style = SEV_STYLE[c.severity] || SEV_STYLE.low;
          return (
            <Circle
              key={c.id}
              center={[c.lat, c.lng]}
              radius={style.radius}
              pathOptions={{
                color:       style.color,
                weight:      style.weight,
                fillColor:   style.color,
                fillOpacity: 0.15,
              }}
            >
              <Popup>
                <div style={S.popup}>
                  <strong style={S.popupTitle}>
                    {c.region || tSafe('outbreak.unknownRegion', 'Unknown region')}
                  </strong>
                  <div style={S.popupRow}>
                    {tSafe(`outbreak.issue${c.issueType[0]?.toUpperCase()}${c.issueType.slice(1)}`, c.issueType)}
                  </div>
                  <div style={S.popupRow}>
                    <strong>{c.reportCount}</strong>{' '}
                    {tSafe('outbreak.reportCount', 'reports')}
                  </div>
                  <div style={S.popupSev}>
                    {tSafe(`outbreak.severity${c.severity[0].toUpperCase()}${c.severity.slice(1)}`, c.severity)}
                  </div>
                </div>
              </Popup>
            </Circle>
          );
        })}
      </MapContainer>
    </div>
  );
}

const S = {
  wrap: {
    width: '100%',
    borderRadius: '16px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#0F2034',
  },
  map: { width: '100%', height: '100%' },
  popup: { display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '160px' },
  popupTitle: { fontSize: '0.9375rem', fontWeight: 800, color: '#0B1D34' },
  popupRow:   { fontSize: '0.8125rem', color: '#0B1D34' },
  popupSev:   { fontSize: '0.75rem', fontWeight: 800, color: '#EF4444', textTransform: 'uppercase' },
};
