/**
 * unifiedIntelligence.js — the single read-only orchestrator that
 * connects Farroway's existing intelligence engines into ONE call
 * (Intelligence Unification Upgrade, Phase 7 — the pipeline).
 *
 *   import { getUnifiedIntelligence } from 'src/core/intelligence/unifiedIntelligence.js';
 *   const intel = getUnifiedIntelligence();
 *   //  → { geo, farm, weather, intelligence, context,
 *   //      connectivity, readAt, errors }
 *
 * Why a facade and NOT a new engine / new provider
 * ─────────────────────────────────────────────────
 *   The unification spec asks for ONE intelligence system powering
 *   language, region, crops, weather, tasks, scans, alerts. Every
 *   piece of that ALREADY EXISTS as a tested module:
 *
 *     • src/lib/farmContextEngine.js       → getFarmContext()
 *         active farm, crop, cropStage, location, experience mode
 *     • src/lib/farmIntelligenceSnapshot.js → getFarmIntelligence()
 *         scan history, weather cache, health score, risks,
 *         briefing, next-best-action, progress
 *     • src/lib/intelligence/contextEngine.js → computeContextIntelligence()
 *         deterministic today-task / alert / recommendation rules
 *     • src/lib/regions.js                 → resolveRegion()
 *         country/crop → regional cluster
 *
 *   The genuine gap was never "missing intelligence" — it was that
 *   these engines were DISCONNECTED. computeContextIntelligence()
 *   needs a hand-assembled `ctx`, and nothing built that ctx from
 *   the real farm context + weather + region + language. So screens
 *   each wired their own partial slice, which is why some are
 *   region-aware and others static.
 *
 *   This module is the wiring. It runs the pipeline in order:
 *
 *     LOCATION → REGION → WEATHER → CROP → TASK/ALERT → UNIFIED
 *
 *   It creates NO new state and NO new React provider — adding a
 *   12th context provider would duplicate ProfileContext /
 *   WeatherContext / ForecastContext. Screens adopt this facade
 *   incrementally; anyone still reading the engines directly is
 *   unaffected.
 *
 * Strict-rule audit
 *   • Pure (modulo storage reads). No fetches, no React, no writes.
 *   • SSR-safe — every storage / navigator access is guarded.
 *   • Never throws. Every engine call is isolated; a failing
 *     engine is recorded in `errors[]` and the rest still resolve.
 *   • Returns a stable shape so consumers can destructure safely.
 *   • No PII logged. No raw API output. No hardcoded UI copy —
 *     the `context` block carries translation-ready keys from
 *     contextEngine.js (titleKey / reasonKey where available).
 */

import { getFarmContext }            from '../../lib/farmContextEngine.js';
import { getFarmIntelligence }       from '../../lib/farmIntelligenceSnapshot.js';
import { computeContextIntelligence } from '../../lib/intelligence/contextEngine.js';
import { resolveRegion }             from '../../lib/regions.js';

/** Run a producer in isolation — a thrown error becomes `fallback`
 *  plus an entry in `errors`. Keeps one bad engine from sinking the
 *  whole snapshot. */
function _isolate(label, fn, fallback, errors) {
  try {
    const v = fn();
    return (v === undefined) ? fallback : v;
  } catch (e) {
    try { errors.push({ source: label, message: String((e && e.message) || e) }); }
    catch { /* swallow */ }
    return fallback;
  }
}

/** Active UI language. Canonical key first, legacy mirror second.
 *  Mirrors src/i18n/i18next.js + devConsoleAudit.js. */
function _readLanguage() {
  try {
    if (typeof localStorage === 'undefined') return 'en';
    return localStorage.getItem('farroway_language')
        || localStorage.getItem('farroway:lang')
        || 'en';
  } catch { return 'en'; }
}

/** Online/offline — drives the offline-fallback branch (Phase 9). */
function _readConnectivity() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine ? 'online' : 'offline';
    }
  } catch { /* swallow */ }
  return 'online';
}

/** First non-empty string field on an object. */
function _pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Normalise whatever the weather cache stored into the small
 *  shape contextEngine.computeContextIntelligence() expects.
 *  The cache shape varies by provider, so every field is probed
 *  defensively and missing values fall back to null / 'unknown'. */
function _deriveWeather(weather) {
  if (!weather || typeof weather !== 'object') {
    return { weatherType: 'unknown', temp: null, rainChance: null };
  }
  const rawType = _pick(weather, ['weatherType', 'type', 'condition', 'summary']);
  const temp = [weather.temp, weather.tempC, weather.currentTempC, weather.temperature]
    .find((v) => typeof v === 'number' && isFinite(v));
  const rain = [weather.rainChance, weather.precipChance, weather.pop, weather.rainProbability]
    .find((v) => typeof v === 'number' && isFinite(v));
  return {
    weatherType: rawType ? rawType.toLowerCase() : 'unknown',
    temp:        (typeof temp === 'number') ? temp : null,
    rainChance:  (typeof rain === 'number') ? rain : null,
  };
}

/**
 * Build the unified intelligence snapshot.
 *
 * @param {object}  [options]
 * @param {string}  [options.farmerName]   forwarded to the briefing composer
 * @param {number}  [options.nowMs]        injectable clock for tests
 * @param {object}  [options.weatherOverride]  injectable weather for tests/SSR
 * @returns {{
 *   geo: { country: ?string, region: ?string, regionCluster: ?string, language: string },
 *   farm: { crop: ?string, cropStage: ?string, farmType: ?string, mode: string,
 *           hasFarm: boolean, hasGarden: boolean },
 *   weather: object|null,
 *   intelligence: object,
 *   context: object,
 *   connectivity: 'online'|'offline',
 *   readAt: number,
 *   errors: Array<{source:string,message:string}>
 * }}
 */
export function getUnifiedIntelligence(options) {
  const opts   = (options && typeof options === 'object') ? options : {};
  const nowMs  = (typeof opts.nowMs === 'number') ? opts.nowMs : Date.now();
  const errors = [];

  // ── 1. LOCATION — canonical farm context ────────────────────
  const farmCtx = _isolate('farmContext', getFarmContext, {
    farm: null, crop: null, cropStage: null, location: null,
    experience: 'farm', farmType: null, hasFarm: false, hasGarden: false,
  }, errors);

  const farm     = (farmCtx && farmCtx.farm) || null;
  const crop     = farmCtx ? farmCtx.crop : null;
  const cropStage = farmCtx ? farmCtx.cropStage : null;
  const mode     = (farmCtx && farmCtx.experience === 'garden') ? 'garden' : 'farm';
  const country  = _pick(farm, ['country']) || _pick(farmCtx && farmCtx.location, ['country']);
  const region   = _pick(farm, ['region', 'district', 'state'])
                 || _pick(farmCtx && farmCtx.location, ['region']);

  // ── 2. REGION — country/crop → regional cluster ─────────────
  const regionCluster = _isolate('region',
    () => resolveRegion({ country, crop }) || null, null, errors);

  // ── 3. LANGUAGE + CONNECTIVITY ──────────────────────────────
  const language     = _readLanguage();
  const connectivity = _readConnectivity();

  // ── 4. WEATHER + farm intelligence (scans, health, risks) ───
  const intel = _isolate('farmIntelligence',
    () => getFarmIntelligence({
      cropName:        crop || undefined,
      farmerName:      opts.farmerName,
      nowMs,
      weatherOverride: opts.weatherOverride,
    }),
    { scanHistory: [], scanTasks: [], weather: null, healthScore: null,
      risks: [], briefing: null, nextBestAction: null, progress: null,
      latestScan: null, errors: [] },
    errors);

  if (intel && Array.isArray(intel.errors)) {
    for (const e of intel.errors) errors.push(e);
  }

  const weather   = intel ? intel.weather : null;
  const wx        = _deriveWeather(weather);
  const latestScan = intel ? intel.latestScan : null;

  // ── 5. TASK / ALERT — deterministic context rules ───────────
  //    This is where the loops converge: the ctx is assembled
  //    from REAL location + weather + crop + scan data, not a
  //    hand-built object, so today's task is genuinely adaptive.
  const context = _isolate('contextIntelligence',
    () => computeContextIntelligence({
      mode,
      weatherType:        wx.weatherType,
      temp:               wx.temp,
      rainChance:         wx.rainChance,
      crop,
      cropStage,
      region:             region || regionCluster,
      recentScanCategory: latestScan
        ? (latestScan.category || latestScan.noticed || null)
        : null,
    }),
    null, errors);

  return {
    geo: {
      country:       country || null,
      region:        region  || null,
      regionCluster: regionCluster || null,
      language,
    },
    farm: {
      crop:      crop || null,
      cropStage: cropStage || null,
      farmType:  (farmCtx && farmCtx.farmType) || null,
      mode,
      hasFarm:   !!(farmCtx && farmCtx.hasFarm),
      hasGarden: !!(farmCtx && farmCtx.hasGarden),
    },
    weather: weather || null,
    intelligence: {
      healthScore:    intel ? intel.healthScore : null,
      risks:          intel && Array.isArray(intel.risks) ? intel.risks : [],
      scanHistory:    intel && Array.isArray(intel.scanHistory) ? intel.scanHistory : [],
      latestScan:     latestScan || null,
      briefing:       intel ? intel.briefing : null,
      nextBestAction: intel ? intel.nextBestAction : null,
      progress:       intel ? intel.progress : null,
    },
    context: context || null,
    connectivity,
    readAt: nowMs,
    errors,
  };
}

export default { getUnifiedIntelligence };
