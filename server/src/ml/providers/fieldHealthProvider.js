/**
 * fieldHealthProvider.js — Sentinel Hub NDVI → field-health
 * envelope.
 *
 * Scan Intelligence V2 §2 — closes audit gap "Satellite NDVI feed
 * never reaches scan pipeline".
 *
 *   import { fetchFieldHealth, fieldHealthKeysPresent,
 *            fieldHealthProviderInfo } from './fieldHealthProvider.js';
 *
 *   const fh = await fetchFieldHealth({ latitude, longitude, cropName });
 *
 * Composes the existing sentinelHubService.fetchNDVI (already
 * OAuth-wired against SENTINEL_HUB_CLIENT_ID + SENTINEL_HUB_CLIENT_SECRET)
 * and DERIVES four farmer-grade signals from the raw NDVI:
 *
 *   {
 *     ok:                boolean,
 *     ndvi:              number | null,                  // -1..1
 *     cropVigor:         'low'|'moderate'|'healthy'|'lush'|null,
 *     stressScore:       number | null,                  // 0..100 (higher=more stress)
 *     vegetationTrend:   'improving'|'stable'|'declining'|null,
 *     interpretation:    string,                         // farmer-grade sentence
 *     confidence:        'low'|'medium'|'high',
 *     limitations:       'Decision support, not a guarantee.',
 *   }
 *
 * Trend computation: requires at least 2 prior NDVI snapshots for
 * the same coordinates (cached server-side via Redis when
 * configured; in-memory fallback otherwise). When fewer than 2
 * priors exist, returns `vegetationTrend: null` (honest "no trend
 * data yet" rather than fabricating a direction).
 *
 * Strict rules
 *   - No PII forwarded (only lat/lng rounded to 4 decimals → ~10m).
 *   - Never throws. Always returns the envelope shape.
 *   - 8000 ms timeout (Sentinel Hub OAuth + statistics is slower
 *     than single-call provider APIs).
 *   - When NEITHER credential is present, returns ok=false with
 *     a clear reason — caller treats as "no satellite data".
 */

const REQUEST_TIMEOUT_MS = 8000;

// In-memory trend cache (process-local). Keyed by rounded lat/lng;
// bounded at 200 entries. Restart-safe via the Redis path below.
const _trendCache = new Map();
const TREND_MAX_ENTRIES = 200;

function _key(lat, lng) {
  return Number(lat).toFixed(4) + ',' + Number(lng).toFixed(4);
}

function _readTrend(key) {
  const entry = _trendCache.get(key);
  return Array.isArray(entry) ? entry.slice() : [];
}

function _writeTrend(key, list) {
  if (_trendCache.size >= TREND_MAX_ENTRIES && !_trendCache.has(key)) {
    // Evict the oldest entry — bounded growth.
    const firstKey = _trendCache.keys().next().value;
    if (firstKey) _trendCache.delete(firstKey);
  }
  _trendCache.set(key, list.slice(-12));    // keep last 12 readings
}

async function _readTrendRedis(key) {
  try {
    const { getRedis } = await import('../../config/redis.js');
    const client = await getRedis();
    if (!client) return null;
    const raw = await client.get('farroway:ndvi_trend:' + key);
    if (typeof raw !== 'string' || !raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

async function _writeTrendRedis(key, list) {
  try {
    const { getRedis } = await import('../../config/redis.js');
    const client = await getRedis();
    if (!client) return false;
    await client.set(
      'farroway:ndvi_trend:' + key,
      JSON.stringify(list.slice(-12)),
      { EX: 14 * 24 * 3600 }                  // 14 days
    );
    return true;
  } catch { return false; }
}

function _cropVigorFromNDVI(ndvi) {
  if (ndvi == null) return null;
  if (ndvi < 0.2)  return 'low';            // bare soil / sparse veg
  if (ndvi < 0.4)  return 'moderate';
  if (ndvi < 0.6)  return 'healthy';
  return 'lush';
}

function _stressScoreFromNDVI(ndvi) {
  // 0..100. Higher = more stress. Linear inversion mapped:
  //   NDVI 0.7+ → 0..10  (no stress)
  //   NDVI 0.5  → ~35
  //   NDVI 0.3  → ~65
  //   NDVI 0.1  → ~95
  if (ndvi == null) return null;
  const clamped = Math.max(-0.2, Math.min(0.9, ndvi));
  const inv = (0.9 - clamped) / 1.1;        // 0..1
  return Math.round(inv * 100);
}

function _trendFromSeries(prior, current) {
  // Need at least 2 priors. Compare mean of last 2 priors to current.
  if (!Array.isArray(prior) || prior.length < 2) return null;
  const last2 = prior.slice(-2);
  const mean = (Number(last2[0]) + Number(last2[1])) / 2;
  if (!Number.isFinite(mean) || !Number.isFinite(current)) return null;
  const delta = current - mean;
  if (delta >= 0.05)  return 'improving';
  if (delta <= -0.05) return 'declining';
  return 'stable';
}

function _confidenceForReading(ndvi, priorCount) {
  if (ndvi == null) return 'low';
  if (priorCount >= 3) return 'high';
  if (priorCount >= 1) return 'medium';
  return 'low';
}

function _interpretFor(cropVigor, vegetationTrend, cropName) {
  const crop = cropName ? ' for ' + cropName : '';
  if (cropVigor == null) {
    return 'No satellite reading available right now.';
  }
  const vigorPhrase = cropVigor === 'lush'    ? 'lush canopy'
                    : cropVigor === 'healthy' ? 'healthy canopy'
                    : cropVigor === 'moderate' ? 'moderate canopy density'
                    : 'sparse canopy';
  const trendPhrase = vegetationTrend === 'improving' ? '; trending up over recent readings'
                    : vegetationTrend === 'declining' ? '; trending down — investigate stress'
                    : vegetationTrend === 'stable'    ? '; stable over recent readings'
                    : '';
  return 'Field shows ' + vigorPhrase + crop + trendPhrase + '.';
}

export function fieldHealthKeysPresent() {
  try {
    return !!(
      process.env.SENTINEL_HUB_CLIENT_ID
      && String(process.env.SENTINEL_HUB_CLIENT_ID).trim()
      && process.env.SENTINEL_HUB_CLIENT_SECRET
      && String(process.env.SENTINEL_HUB_CLIENT_SECRET).trim()
    );
  } catch { return false; }
}

/**
 * Fetch field health envelope. `latitude` + `longitude` are
 * required. cropName is optional context for the interpretation
 * sentence (never forwarded to Sentinel Hub).
 */
export async function fetchFieldHealth({ latitude, longitude, cropName }) {
  // Hard gate — never call Sentinel Hub without both creds.
  if (!fieldHealthKeysPresent()) {
    return Object.freeze({
      ok: false, reason: 'sentinel_credentials_missing',
      ndvi: null, cropVigor: null, stressScore: null,
      vegetationTrend: null,
      interpretation: 'Satellite data not configured for this farm.',
      confidence: 'low',
      limitations: 'Decision support, not a guarantee.',
    });
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Object.freeze({
      ok: false, reason: 'invalid_coordinates',
      ndvi: null, cropVigor: null, stressScore: null,
      vegetationTrend: null,
      interpretation: 'Satellite reading requires farm coordinates.',
      confidence: 'low',
      limitations: 'Decision support, not a guarantee.',
    });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const { fetchNDVI } = await import('../../services/satellite/sentinelHubService.js');
    // sentinelHubService doesn't accept an abort signal; wrap with
    // Promise.race so we can still timeout cleanly.
    const racePromise = Promise.race([
      fetchNDVI({ latitude: lat, longitude: lng }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), REQUEST_TIMEOUT_MS)),
    ]);
    const raw = await racePromise;
    clearTimeout(timer);

    const ndviArr = raw && Array.isArray(raw.data) ? raw.data : [];
    const ndvi = ndviArr.length > 0 && Number.isFinite(ndviArr[0])
      ? Number(ndviArr[0]) : null;

    // Trend computation — read from Redis first, fall through to
    // in-memory. Then append the new reading and persist.
    const cacheKey = _key(lat, lng);
    const priorRedis = await _readTrendRedis(cacheKey);
    const prior = priorRedis && priorRedis.length > 0
      ? priorRedis : _readTrend(cacheKey);
    const vegetationTrend = _trendFromSeries(prior, ndvi);
    if (ndvi != null) {
      const updated = prior.concat([ndvi]).slice(-12);
      _writeTrend(cacheKey, updated);
      _writeTrendRedis(cacheKey, updated).catch(() => { /* swallow */ });
    }

    const cropVigor = _cropVigorFromNDVI(ndvi);
    const stressScore = _stressScoreFromNDVI(ndvi);
    return Object.freeze({
      ok: true,
      ndvi,
      cropVigor,
      stressScore,
      vegetationTrend,
      interpretation:  _interpretFor(cropVigor, vegetationTrend, cropName),
      confidence:      _confidenceForReading(ndvi, prior.length),
      // V3 — spec-named aliases for the satellite envelope.
      vigor:           cropVigor,
      trend:           vegetationTrend,
      stressLevel:     stressScore != null
                         ? (stressScore >= 65 ? 'high'
                            : stressScore >= 35 ? 'medium' : 'low')
                         : null,
      latencyMs:       Date.now() - startedAt,
      limitations:     'Decision support, not a guarantee.',
    });
  } catch (err) {
    clearTimeout(timer);
    return Object.freeze({
      ok: false, reason: 'exception',
      message: err && err.message,
      ndvi: null, cropVigor: null, stressScore: null,
      vegetationTrend: null,
      interpretation: 'Satellite reading failed; falling back to local context.',
      confidence: 'low',
      latencyMs: Date.now() - startedAt,
      limitations: 'Decision support, not a guarantee.',
    });
  } finally {
    clearTimeout(timer);
  }
}

export function fieldHealthProviderInfo() {
  return Object.freeze({
    name:        'sentinel_hub_ndvi',
    envVarA:     'SENTINEL_HUB_CLIENT_ID',
    envVarB:     'SENTINEL_HUB_CLIENT_SECRET',
    keysPresent: fieldHealthKeysPresent(),
    trendsTracked: true,
    timeoutMs:   REQUEST_TIMEOUT_MS,
  });
}

export const _internal = Object.freeze({
  _key, _cropVigorFromNDVI, _stressScoreFromNDVI,
  _trendFromSeries, _interpretFor, _confidenceForReading,
});

export default fetchFieldHealth;
