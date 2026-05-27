/**
 * farmBoundaryReadiness.js — preparation layer for future NDVI /
 * moisture / satellite enrichment / risk zoning.
 *
 *   import { assessFarmBoundary }
 *     from 'src/core/location/farmBoundaryReadiness.js';
 *
 *   const v = assessFarmBoundary({
 *     polygon, centroid, sizeAcres, sizeUnit, lat, lng,
 *     satelliteProviderAvailable,
 *   });
 *
 *   v = {
 *     boundaryReady,              — true if usable polygon OR (centroid + size)
 *     polygonAvailable,           — true if polygon points present
 *     centroid,                   — { lat, lng } | null
 *     acreageEstimate,            — number | null
 *     satelliteReady,             — boundaryReady AND providerAvailable
 *     engineVersion:'farm-boundary-readiness-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   NO POLYGON UI. NO MAP RENDERING. Just a structural probe so
 *   downstream NDVI / moisture / yield engines know whether the
 *   farm has enough geometric grounding to make spatial claims.
 *
 *   A farm is "boundaryReady" when EITHER:
 *     1. it has a polygon of 3+ {lat,lng} points, OR
 *     2. it has both a centroid AND an acreage estimate.
 *
 *   satelliteReady = boundaryReady AND a satellite provider is
 *   currently available (passed in — no I/O here).
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • No fetches, no geo libraries — caller does the heavy lifting
 *     if/when satellite is wired.
 */

const ENGINE_VERSION = 'farm-boundary-readiness-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _isValidPoint(p) {
  return _isObj(p) && _num(p.lat) != null && _num(p.lng) != null;
}

function _polygonAcreage(polygon) {
  // Simple shoelace area on lat/lng treated as planar — coarse
  // approximation, used only as a hint when the caller didn't
  // supply sizeAcres. NOT meant for legal / precise area work.
  if (!Array.isArray(polygon) || polygon.length < 3) return null;
  let area = 0;
  for (let i = 0, n = polygon.length; i < n; i++) {
    const a = polygon[i], b = polygon[(i + 1) % n];
    if (!_isValidPoint(a) || !_isValidPoint(b)) return null;
    area += (a.lng * b.lat) - (b.lng * a.lat);
  }
  const sqDegrees = Math.abs(area) / 2;
  // 1 sq degree ≈ 4828 sq miles at the equator (gross). Convert
  // to acres (1 sq mi = 640 acres). Caller treats as estimate.
  const sqMiles = sqDegrees * 4828;
  return Math.round(sqMiles * 640);
}

function _centroid(polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) return null;
  let sumLat = 0, sumLng = 0, count = 0;
  for (const p of polygon) {
    if (!_isValidPoint(p)) continue;
    sumLat += p.lat; sumLng += p.lng; count += 1;
  }
  if (count === 0) return null;
  return Object.freeze({
    lat: sumLat / count,
    lng: sumLng / count,
  });
}

function _normalizeAcres(sizeAcres, sizeUnit) {
  const v = _num(sizeAcres);
  if (v == null) return null;
  const unit = typeof sizeUnit === 'string' ? sizeUnit.toLowerCase() : 'acres';
  if (unit === 'hectares' || unit === 'ha') return v * 2.471;
  if (unit === 'sqm' || unit === 'm2')      return v / 4046.86;
  return v;
}

/**
 * Assess whether the farm has enough geometric grounding for
 * satellite / NDVI enrichment. Always returns frozen; never throws.
 */
export function assessFarmBoundary(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const polygon = Array.isArray(safe.polygon) ? safe.polygon : null;
    const polygonValid = polygon && polygon.length >= 3
      && polygon.every(_isValidPoint);
    const polygonCentroid = polygonValid ? _centroid(polygon) : null;
    const explicitCentroid = (_num(safe.lat) != null && _num(safe.lng) != null)
      ? Object.freeze({ lat: safe.lat, lng: safe.lng }) : null;
    const callerCentroid = _isObj(safe.centroid)
      && _num(safe.centroid.lat) != null
      && _num(safe.centroid.lng) != null
      ? Object.freeze({ lat: safe.centroid.lat, lng: safe.centroid.lng })
      : null;
    const centroid = polygonCentroid || callerCentroid || explicitCentroid;

    const explicitAcres = _normalizeAcres(safe.sizeAcres, safe.sizeUnit);
    const polygonAcres  = polygonValid ? _polygonAcreage(polygon) : null;
    const acreageEstimate = explicitAcres != null ? explicitAcres : polygonAcres;

    const boundaryReady = !!polygonValid
      || (!!centroid && acreageEstimate != null && acreageEstimate > 0);

    const providerAvailable = !!safe.satelliteProviderAvailable;
    const satelliteReady = boundaryReady && providerAvailable;

    return Object.freeze({
      engineVersion:     ENGINE_VERSION,
      boundaryReady,
      polygonAvailable:  !!polygonValid,
      centroid,
      acreageEstimate:   acreageEstimate != null ? Math.round(acreageEstimate) : null,
      satelliteReady,
      generatedAt:       Date.now(),
    });
  }, Object.freeze({
    engineVersion:     ENGINE_VERSION,
    boundaryReady:     false,
    polygonAvailable:  false,
    centroid:          null,
    acreageEstimate:   null,
    satelliteReady:    false,
    generatedAt:       Date.now(),
  }));
}

export const _internal = Object.freeze({
  _isValidPoint, _polygonAcreage, _centroid, _normalizeAcres, ENGINE_VERSION,
});

const _module = { assessFarmBoundary, _internal };
export default _module;
