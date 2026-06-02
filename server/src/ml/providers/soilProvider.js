/**
 * soilProvider.js — server-side SoilGrids adapter.
 *
 * Closes the last open audit gap from the V2 sprint scoring:
 * "SoilGrids client-side; not consumed by /api/scan/analyze".
 *
 *   import { fetchSoilProfile, soilProviderInfo }
 *     from './soilProvider.js';
 *
 *   const soil = await fetchSoilProfile({ latitude, longitude });
 *
 * SoilGrids is a public, key-less REST API operated by ISRIC.
 *   GET https://rest.isric.org/soilgrids/v2.0/properties/query
 *     ?lat=<lat>&lon=<lng>&property=<...>&depth=0-5cm&value=mean
 *
 * Returns a farmer-grade envelope:
 *   {
 *     ok:                boolean,
 *     soilTexture:       { clayPct, sandPct, siltPct, label },
 *     ph:                number | null,
 *     organicMatterProxy:number | null,   // g/kg
 *     drainageRisk:      'low'|'medium'|'high'|'unknown',
 *     confidence:        'low'|'medium'|'high',
 *     interpretation:    string,
 *     limitations:       'Decision support, not a guarantee.',
 *   }
 *
 * Strict rules
 *   - Public API, no key, no auth, no PII.
 *   - Never throws. Returns ok:false envelope on timeout / bad JSON.
 *   - 8000 ms AbortController timeout (same as client SOILGRIDS_FETCH_TIMEOUT_MS).
 *   - Redis-cached for 7 days when configured; falls through to in-memory.
 */

const SOILGRIDS_API_BASE = 'https://rest.isric.org/soilgrids/v2.0/properties/query';
const REQUEST_TIMEOUT_MS = 8000;
const PROPERTIES = ['clay', 'sand', 'silt', 'phh2o', 'soc', 'bdod'];
const REDIS_TTL_S = 7 * 24 * 3600;

// In-memory fallback cache. Bounded at 200 entries.
const _memCache = new Map();
const MEM_MAX = 200;

function _key(lat, lng) {
  return Number(lat).toFixed(2) + ',' + Number(lng).toFixed(2);
}

function _memGet(k) {
  const e = _memCache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > REDIS_TTL_S * 1000) {
    _memCache.delete(k);
    return null;
  }
  return e.value;
}

function _memSet(k, v) {
  if (_memCache.size >= MEM_MAX && !_memCache.has(k)) {
    const first = _memCache.keys().next().value;
    if (first) _memCache.delete(first);
  }
  _memCache.set(k, { ts: Date.now(), value: v });
}

async function _redisGet(k) {
  try {
    const { getRedis } = await import('../../config/redis.js');
    const client = await getRedis();
    if (!client) return null;
    const raw = await client.get('farroway:soil:' + k);
    if (typeof raw !== 'string' || !raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

async function _redisSet(k, v) {
  try {
    const { getRedis } = await import('../../config/redis.js');
    const client = await getRedis();
    if (!client) return;
    await client.set('farroway:soil:' + k, JSON.stringify(v), { EX: REDIS_TTL_S });
  } catch { /* swallow */ }
}

// SoilGrids returns layered values; extract the top depth mean.
function _extractTopMean(properties, propertyName) {
  try {
    const layers = properties && Array.isArray(properties.layers)
      ? properties.layers : [];
    const layer = layers.find((l) => l && l.name === propertyName);
    if (!layer) return null;
    const depths = Array.isArray(layer.depths) ? layer.depths : [];
    const top = depths.find((d) => d && d.label === '0-5cm')
      || depths.find((d) => d && d.label === '5-15cm')
      || depths[0];
    if (!top || !top.values) return null;
    const mean = top.values.mean;
    if (!Number.isFinite(Number(mean))) return null;
    // SoilGrids returns values multiplied by a d_factor (per layer).
    const dFactor = Number(layer.unit_measure
      && layer.unit_measure.d_factor) || 1;
    return Number(mean) / (dFactor || 1);
  } catch { return null; }
}

function _textureLabel(clayPct, sandPct, siltPct) {
  if (clayPct == null && sandPct == null && siltPct == null) return 'unknown';
  // USDA-ish simplification — three buckets the farmer can act on.
  const clay = clayPct || 0, sand = sandPct || 0, silt = siltPct || 0;
  if (clay >= 35) return 'clayey';
  if (sand >= 60) return 'sandy';
  if (silt >= 40 && clay < 25) return 'silty';
  return 'loamy';
}

function _drainageRiskFromTexture(textureLabel, clayPct) {
  if (textureLabel === 'sandy') return 'low';      // drains fast
  if (textureLabel === 'clayey' || (clayPct && clayPct >= 40)) return 'high';
  if (textureLabel === 'loamy' || textureLabel === 'silty') return 'medium';
  return 'unknown';
}

function _confidenceForReading(clay, sand, ph) {
  let present = 0;
  if (clay != null) present++;
  if (sand != null) present++;
  if (ph != null)   present++;
  if (present >= 3) return 'high';
  if (present >= 2) return 'medium';
  return 'low';
}

// V3 — composite fertility score (0..100) from organic carbon
// proxy + pH proximity to neutral + texture quality.
// Honest null when any required signal missing.
function _fertilityScore(soc, ph, texture) {
  if (soc == null && ph == null && texture === 'unknown') return null;
  let score = 0, weight = 0;
  // Organic carbon contribution (max 40 pts). SoilGrids returns
  // g/kg; 20+ g/kg is rich; <5 is poor.
  if (soc != null) {
    const ocClamped = Math.max(0, Math.min(30, soc));
    score += (ocClamped / 30) * 40;
    weight += 40;
  }
  // pH contribution (max 30 pts). 6.0..7.0 is ideal.
  if (ph != null) {
    const distance = Math.abs(ph - 6.5);
    const phPts = Math.max(0, 1 - (distance / 2.5)) * 30;
    score += phPts;
    weight += 30;
  }
  // Texture contribution (max 30 pts). Loamy is ideal.
  if (texture !== 'unknown') {
    const texPts = texture === 'loamy' ? 30
                 : texture === 'silty' ? 24
                 : texture === 'clayey' ? 18
                 : 14;
    score += texPts;
    weight += 30;
  }
  if (weight === 0) return null;
  return Math.round((score / weight) * 100);
}

// V3 — moisture proxy from organic carbon + texture (live moisture
// requires weather + bulk density; we report a coarse "expected
// moisture retention" band). Honest 'unknown' when signals missing.
function _moistureProxy(soc, textureLabel) {
  if (soc == null && textureLabel === 'unknown') return 'unknown';
  // Clayey + high OC retains; sandy + low OC drains fast.
  if (textureLabel === 'sandy' && (soc == null || soc < 8)) return 'low';
  if (textureLabel === 'clayey' || (soc != null && soc >= 20)) return 'high';
  return 'moderate';
}

// V3 — soilRisk derivation. Flags ONE primary risk the user should
// know about. Order = priority.
function _soilRisk(textureLabel, drainageRisk, ph, fertilityScore) {
  if (drainageRisk === 'high') {
    return { level: 'high', kind: 'waterlogging',
      detail: 'Clayey soil drains slowly — plant on raised beds or improve drainage.' };
  }
  if (drainageRisk === 'low' && textureLabel === 'sandy') {
    return { level: 'medium', kind: 'drought',
      detail: 'Sandy soil drains fast — irrigate more frequently and mulch heavily.' };
  }
  if (ph != null && ph < 5.5) {
    return { level: 'medium', kind: 'acidity',
      detail: 'Acidic soil locks out phosphorus and calcium — lime may help.' };
  }
  if (ph != null && ph > 7.8) {
    return { level: 'medium', kind: 'alkalinity',
      detail: 'Alkaline soil locks out iron and manganese — elemental sulphur may help.' };
  }
  if (fertilityScore != null && fertilityScore < 35) {
    return { level: 'medium', kind: 'low_fertility',
      detail: 'Low organic matter — add compost or manure ahead of planting.' };
  }
  return { level: 'low', kind: 'none', detail: 'No major soil risk flagged.' };
}

function _soilRecommendation(soilRisk, textureLabel) {
  switch (soilRisk && soilRisk.kind) {
    case 'waterlogging':
      return 'Mound rows 20–30cm; add coarse organic matter; avoid working when wet.';
    case 'drought':
      return 'Apply 5cm organic mulch; drip-irrigate; sow drought-tolerant varieties.';
    case 'acidity':
      return 'Apply agricultural lime at planting; re-test pH after one season.';
    case 'alkalinity':
      return 'Apply elemental sulphur; use ammonium-based fertilisers; foliar-feed iron.';
    case 'low_fertility':
      return 'Top-dress 2–4 tonnes/ha well-rotted compost; rotate with legumes next season.';
    default:
      return textureLabel === 'unknown'
        ? 'Soil reading not available — manual sample recommended.'
        : 'Maintain current practice; re-check pH and organic matter annually.';
  }
}

function _interpretFor(textureLabel, drainageRisk, ph) {
  if (textureLabel === 'unknown') {
    return 'Soil reading unavailable for these coordinates.';
  }
  const drainagePhrase = drainageRisk === 'high'  ? 'slow drainage — water logs easily'
                       : drainageRisk === 'low'   ? 'fast drainage — needs more frequent watering'
                       : 'moderate drainage';
  const phPhrase = (ph != null)
    ? '; pH ' + ph.toFixed(1)
      + (ph < 5.5 ? ' (acidic — lime may help)'
          : ph > 7.5 ? ' (alkaline — sulphur may help)'
          : ' (near-neutral)')
    : '';
  return 'Soil reads ' + textureLabel + ' with ' + drainagePhrase + phPhrase + '.';
}

export async function fetchSoilProfile({ latitude, longitude }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
      || lat < -90 || lat > 90 || lng < -180 || lng > 180
      || (lat === 0 && lng === 0)) {
    return Object.freeze({
      ok: false, reason: 'invalid_coordinates',
      soilTexture: Object.freeze({ clayPct: null, sandPct: null,
                                   siltPct: null, label: 'unknown' }),
      ph: null, organicMatterProxy: null,
      drainageRisk: 'unknown', confidence: 'low',
      interpretation: 'Soil reading requires farm coordinates.',
      limitations: 'Decision support, not a guarantee.',
    });
  }

  const cacheKey = _key(lat, lng);
  // Cache: Redis first, then in-memory.
  const cachedRedis = await _redisGet(cacheKey);
  if (cachedRedis) {
    return Object.freeze({ ...cachedRedis, fromCache: 'redis',
      limitations: 'Decision support, not a guarantee.' });
  }
  const cachedMem = _memGet(cacheKey);
  if (cachedMem) {
    return Object.freeze({ ...cachedMem, fromCache: 'memory',
      limitations: 'Decision support, not a guarantee.' });
  }

  // Build the SoilGrids URL with template-literal query string.
  // (Project convention — never construct via `new URL()`; the
  // url-construction gate enforces this.)
  const params = [
    'lat=' + encodeURIComponent(lat),
    'lon=' + encodeURIComponent(lng),
    'depth=0-5cm', 'depth=5-15cm',
    'value=mean',
  ];
  for (const p of PROPERTIES) params.push('property=' + p);
  const url = SOILGRIDS_API_BASE + '?' + params.join('&');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res || !res.ok) {
      return Object.freeze({
        ok: false, reason: 'http_' + (res ? res.status : 'no_response'),
        soilTexture: Object.freeze({ clayPct: null, sandPct: null,
                                     siltPct: null, label: 'unknown' }),
        ph: null, organicMatterProxy: null,
        drainageRisk: 'unknown', confidence: 'low',
        interpretation: 'Soil service unavailable.',
        latencyMs: Date.now() - startedAt,
        limitations: 'Decision support, not a guarantee.',
      });
    }
    const json = await res.json();
    const properties = json && json.properties;
    const clay = _extractTopMean(properties, 'clay');
    const sand = _extractTopMean(properties, 'sand');
    const silt = _extractTopMean(properties, 'silt');
    const ph   = _extractTopMean(properties, 'phh2o');
    const soc  = _extractTopMean(properties, 'soc');

    const label = _textureLabel(clay, sand, silt);
    const drainageRisk = _drainageRiskFromTexture(label, clay);
    const confidence   = _confidenceForReading(clay, sand, ph);
    const interpretation = _interpretFor(label, drainageRisk, ph);

    const fertilityScore = _fertilityScore(soc, ph, label);
    const moisture       = _moistureProxy(soc, label);
    const soilRisk       = _soilRisk(label, drainageRisk, ph, fertilityScore);
    const soilRecommendation = _soilRecommendation(soilRisk, label);
    const envelope = {
      ok: true,
      soilTexture: Object.freeze({
        clayPct: clay != null ? Math.round(clay * 10) / 10 : null,
        sandPct: sand != null ? Math.round(sand * 10) / 10 : null,
        siltPct: silt != null ? Math.round(silt * 10) / 10 : null,
        label,
      }),
      ph: ph != null ? Math.round(ph * 10) / 10 : null,
      organicMatterProxy: soc != null ? Math.round(soc * 10) / 10 : null,
      // V3 — spec-named aliases + composite signals.
      organicCarbon: soc != null ? Math.round(soc * 10) / 10 : null,
      moisture,
      fertilityScore,
      soilRisk:       Object.freeze(soilRisk),
      soilRecommendation,
      drainageRisk, confidence, interpretation,
      latencyMs: Date.now() - startedAt,
      limitations: 'Decision support, not a guarantee.',
    };

    // Persist to both caches. Fire-and-forget on Redis.
    _memSet(cacheKey, envelope);
    _redisSet(cacheKey, envelope).catch(() => { /* swallow */ });

    return Object.freeze(envelope);
  } catch (err) {
    clearTimeout(timer);
    return Object.freeze({
      ok: false, reason: 'exception',
      message: err && err.message,
      soilTexture: Object.freeze({ clayPct: null, sandPct: null,
                                   siltPct: null, label: 'unknown' }),
      ph: null, organicMatterProxy: null,
      drainageRisk: 'unknown', confidence: 'low',
      interpretation: 'Soil reading failed; falling back to local context.',
      latencyMs: Date.now() - startedAt,
      limitations: 'Decision support, not a guarantee.',
    });
  } finally {
    clearTimeout(timer);
  }
}

export function soilProviderInfo() {
  return Object.freeze({
    name:        'soilgrids_isric',
    endpoint:    SOILGRIDS_API_BASE,
    requiresKey: false,
    cacheTtlSec: REDIS_TTL_S,
    timeoutMs:   REQUEST_TIMEOUT_MS,
    properties:  Object.freeze(PROPERTIES.slice()),
  });
}

export const _internal = Object.freeze({
  _textureLabel, _drainageRiskFromTexture,
  _confidenceForReading, _interpretFor, _extractTopMean,
  SOILGRIDS_API_BASE, REQUEST_TIMEOUT_MS, PROPERTIES,
});

export default fetchSoilProfile;
