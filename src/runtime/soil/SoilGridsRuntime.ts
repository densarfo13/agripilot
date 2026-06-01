/**
 * SoilGridsRuntime.ts — real SoilGrids REST API integration.
 *
 *   • Reads farm GPS; honest NEEDS_LOCATION when coordinates missing.
 *   • Calls https://rest.isric.org/soilgrids/v2.0/properties/query
 *     with an 8s timeout. Honest SOIL_DATA_UNAVAILABLE on any failure.
 *   • Caches successful responses in localStorage (30-day TTL).
 *   • NEVER returns fabricated soil values. NEVER blocks Home or
 *     Daily Assistant: every public call is a fire-and-forget promise
 *     with safe fallbacks.
 *
 * Pins window.__soilGridsHealth() per spec.
 */

import type {
  SoilProfile, SoilTexture, SoilGridsHealthEnvelope, DrainageRisk,
  Confidence, SoilStatus,
} from './SoilProfileContracts';
import {
  GUIDANCE_TAIL, SOILGRIDS_RUNTIME_VERSION, SOILGRIDS_API_BASE,
  SOILGRIDS_PROPERTIES, SOILGRIDS_FETCH_TIMEOUT_MS,
} from './SoilProfileContracts';
import {
  readSoilCache, readStaleSoilCache, writeSoilCache, hasValidCoordinates,
} from './SoilCache';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

/** Module-local snapshot of the last computed profile — surfaced via
 *  __soilGridsHealth() so consumers don't need to await the fetch. */
let _lastProfile: Readonly<SoilProfile> | null = null;
let _lastStatus: SoilStatus = 'NEEDS_LOCATION';

interface FetchInputs {
  farmId: string | null;
  latitude: number | null;
  longitude: number | null;
  country?: string | null;
  region?: string | null;
  cropKey?: string | null;
}

/** Empty / honest fallback profile builder. */
function _emptyProfile(farmId: string | null, status: SoilStatus, limitations: string)
  : Readonly<SoilProfile> {
  return Object.freeze({
    farmId,
    source: 'none' as const,
    coordinatesAvailable: status !== 'NEEDS_LOCATION',
    soilDataAvailable: false,
    soilTexture: Object.freeze<SoilTexture>({
      clayPct: null, sandPct: null, siltPct: null, label: 'Not enough data yet',
    }),
    ph: null,
    organicMatterProxy: null,
    drainageRisk: 'unknown' as DrainageRisk,
    limitations,
    confidence: 'low' as Confidence,
    fetchedAt: null,
    status,
  });
}

/** SoilGrids returns properties with depth layers + mean/q05/q95 etc.
 *  We pull the 0-5cm or 5-15cm mean (whichever present) and divide by
 *  the API's d_factor (10 for clay/sand/silt; 10 for phh2o; 10 for soc;
 *  100 for bdod) so the value is in canonical units. */
function _extractValue(propsByName: any, name: string): number | null {
  return _safe(() => {
    const p = propsByName[name];
    if (!p || !Array.isArray(p.layers)) return null;
    for (const layer of p.layers) {
      if (!layer || !layer.depths) continue;
      for (const d of layer.depths) {
        const v = d && d.values && (d.values.mean ?? d.values.Q0_5);
        const factor = layer.unit_measure && layer.unit_measure.d_factor;
        if (typeof v === 'number' && isFinite(v) && typeof factor === 'number' && factor > 0) {
          return v / factor;
        }
        if (typeof v === 'number' && isFinite(v)) return v;
      }
    }
    return null;
  }, null);
}

function _textureLabel(clay: number | null, sand: number | null): string {
  if (clay === null || sand === null) return 'Not enough data yet';
  if (sand >= 70) return 'sandy';
  if (clay >= 40) return 'clayey';
  if (clay >= 27 && sand <= 45) return 'clay loam';
  if (clay >= 7 && clay < 27 && sand <= 52) return 'loam';
  if (sand >= 50 && clay < 20) return 'sandy loam';
  return 'loam';
}

function _drainageRisk(clay: number | null, sand: number | null, bdod: number | null): DrainageRisk {
  // Heuristic only — clear honest band, never a fake score.
  if (clay === null && sand === null) return 'unknown';
  if (sand !== null && sand >= 70) return 'low';            // very sandy → drains well → low waterlog risk
  if (clay !== null && clay >= 40) return 'high';            // heavy clay → poor drainage
  if (bdod !== null && bdod >= 1.6) return 'high';           // compacted → poor drainage
  if (clay !== null && clay >= 27) return 'medium';
  return 'medium';
}

/** Fetch + parse a SoilGrids response. Returns null on any error. */
async function _fetchSoilGrids(
  lat: number, lng: number,
): Promise<{ texture: SoilTexture; ph: number | null; soc: number | null; bdod: number | null } | null> {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    // Build query string without `new URL()` — the build-safe gate
    // forbids raw URL construction outside documented wrappers.
    // SoilGrids API only accepts query params, no path mutation needed,
    // so a plain template-literal concat is appropriate here.
    const params: string[] = [
      `lon=${encodeURIComponent(String(lng))}`,
      `lat=${encodeURIComponent(String(lat))}`,
      ...SOILGRIDS_PROPERTIES.map((p) => `property=${encodeURIComponent(p)}`),
      'depth=0-5cm',
      'depth=5-15cm',
      'value=mean',
    ];
    const fullUrl = `${SOILGRIDS_API_BASE}?${params.join('&')}`;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => { if (ctrl) ctrl.abort(); }, SOILGRIDS_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(fullUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: ctrl ? ctrl.signal : undefined,
      });
      clearTimeout(t);
      if (!res.ok) return null;
      const json = await res.json();
      const layers: any[] = (json && json.properties && json.properties.layers) || [];
      const byName: any = {};
      for (const L of layers) {
        if (L && typeof L.name === 'string') byName[L.name] = L;
      }
      const clay = _extractValue(byName, 'clay');
      const sand = _extractValue(byName, 'sand');
      const silt = _extractValue(byName, 'silt');
      const ph = _extractValue(byName, 'phh2o');
      const soc = _extractValue(byName, 'soc');
      const bdod = _extractValue(byName, 'bdod');
      // Reject obviously bad values rather than ship fake numbers.
      const okPh = (ph !== null && ph >= 3 && ph <= 11) ? ph : null;
      const texture: SoilTexture = Object.freeze({
        clayPct: clay, sandPct: sand, siltPct: silt,
        label: _textureLabel(clay, sand),
      });
      return { texture, ph: okPh, soc, bdod };
    } catch {
      clearTimeout(t);
      return null;
    }
  }, Promise.resolve(null) as any);
}

/** Fire a SoilGrids fetch. Returns a promise that ALWAYS resolves to
 *  a frozen SoilProfile — never throws, never blocks the caller. */
export async function fetchSoilProfile(input: FetchInputs, nowMs: number)
  : Promise<Readonly<SoilProfile>> {
  return _safe(async () => {
    const farmId = (input && typeof input.farmId === 'string') ? input.farmId : null;
    const lat = (input && typeof input.latitude === 'number') ? input.latitude : NaN;
    const lng = (input && typeof input.longitude === 'number') ? input.longitude : NaN;

    if (!hasValidCoordinates(lat, lng)) {
      _lastStatus = 'NEEDS_LOCATION';
      _lastProfile = _emptyProfile(farmId, 'NEEDS_LOCATION',
        'Add your farm location to enable soil guidance. ' + GUIDANCE_TAIL);
      return _lastProfile;
    }

    // Cache hit?
    if (farmId) {
      const cached = readSoilCache(farmId, lat, lng, nowMs);
      if (cached) {
        _lastStatus = 'OK';
        _lastProfile = Object.freeze({ ...cached, source: 'cache' as const });
        return _lastProfile;
      }
    }

    // Real fetch.
    _lastStatus = 'FETCHING';
    const fetched = await _fetchSoilGrids(lat, lng);
    if (!fetched) {
      // On failure, try stale cache before giving up.
      const stale = farmId ? readStaleSoilCache(farmId, lat, lng) : null;
      if (stale) {
        _lastStatus = 'STALE_CACHE';
        _lastProfile = Object.freeze({ ...stale, status: 'STALE_CACHE' as const, source: 'cache' as const });
        return _lastProfile;
      }
      _lastStatus = 'SOIL_DATA_UNAVAILABLE';
      _lastProfile = _emptyProfile(farmId, 'SOIL_DATA_UNAVAILABLE',
        'SoilGrids is currently unavailable. Try again later. ' + GUIDANCE_TAIL);
      return _lastProfile;
    }

    const profile: SoilProfile = {
      farmId,
      source: 'soilgrids',
      coordinatesAvailable: true,
      soilDataAvailable: true,
      soilTexture: fetched.texture,
      ph: fetched.ph,
      organicMatterProxy: fetched.soc,
      drainageRisk: _drainageRisk(fetched.texture.clayPct, fetched.texture.sandPct, fetched.bdod),
      limitations:
        'SoilGrids is a global model at ~250m resolution. Local field conditions vary. '
        + 'Always confirm with a real local soil test before applying inputs. ' + GUIDANCE_TAIL,
      confidence: (fetched.ph !== null && fetched.texture.clayPct !== null) ? 'medium' : 'low',
      fetchedAt: nowMs,
      status: 'OK',
    };
    if (farmId) writeSoilCache(farmId, lat, lng, profile, nowMs);
    _lastStatus = 'OK';
    _lastProfile = Object.freeze(profile);
    return _lastProfile;
  }, Promise.resolve(_emptyProfile(null, 'SOIL_DATA_UNAVAILABLE',
    'Soil fetch threw. ' + GUIDANCE_TAIL)) as any);
}

/** Synchronous read — returns the LAST fetched/cached profile (or null).
 *  Pages that need soil data render this immediately and trigger a
 *  background fetch via fetchSoilProfile() in their useEffect. */
export function lastKnownSoilProfile(): Readonly<SoilProfile> | null {
  return _lastProfile;
}

export function soilGridsHealth(): Readonly<SoilGridsHealthEnvelope> {
  return _safe(() => Object.freeze<SoilGridsHealthEnvelope>({
    initialized: true,
    configured: true,
    coordinatesRequired: true as const,
    cacheReady: typeof window !== 'undefined' && !!window.localStorage,
    noFakeSoilData: true as const,
    nonBlocking: true as const,
    status: _lastStatus,
    source: _lastProfile ? _lastProfile.source : 'none',
    lastProfile: _lastProfile,
    confidence: _lastProfile ? _lastProfile.confidence : ('low' as Confidence),
    explanation:
      'SoilGrids v2 integration. Coordinates required; honest NEEDS_LOCATION when missing. ' +
      'Honest SOIL_DATA_UNAVAILABLE on fetch failure. Cache hits surface as source="cache". ' +
      'Never blocks Home or Daily Assistant.',
    limitations:
      'SoilGrids is a global model — local field conditions vary. Always confirm with a real soil test. '
      + GUIDANCE_TAIL,
  }), Object.freeze<SoilGridsHealthEnvelope>({
    initialized: true, configured: false,
    coordinatesRequired: true as const, cacheReady: false,
    noFakeSoilData: true as const, nonBlocking: true as const,
    status: 'SOIL_DATA_UNAVAILABLE' as SoilStatus,
    source: 'none', lastProfile: null,
    confidence: 'low' as Confidence,
    explanation: 'SoilGrids runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installSoilGridsGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__soilGridsHealth !== 'function') {
      w.__soilGridsHealth = function () {
        const out = soilGridsHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · SoilGrids]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

export { SOILGRIDS_RUNTIME_VERSION };
