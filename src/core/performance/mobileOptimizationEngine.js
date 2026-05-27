/**
 * mobileOptimizationEngine.js — Low-end device optimization (spec §6).
 *
 *   import {
 *     detectDeviceTier, getOptimizationProfile,
 *     shouldReduceMotion, shouldThrottleImages,
 *     suggestedImageMaxEdge, suggestedAnimationStyle,
 *     installLowEndHints, TIER,
 *   } from 'src/core/performance/mobileOptimizationEngine.js';
 *
 *   const tier = detectDeviceTier();
 *   const profile = getOptimizationProfile();
 *   if (profile.heavyAnimationsAllowed === false) { ... }
 *
 * What this is
 * ────────────
 *   Read-only heuristic that classifies the device into one of four
 *   tiers (high / mid / low / very_low) using ONLY browser-exposed
 *   signals — never throws on missing fields. Surfaces use the
 *   resulting `OptimizationProfile` to decide:
 *
 *     • image max-edge for the scan capture pipeline
 *     • whether to enable parallax / large animations
 *     • whether to defer non-critical work
 *     • whether to compress more aggressively before upload
 *
 *   Composes with existing scan + UI primitives — does NOT rewrite
 *   any image pipeline. The scan capture surface reads this profile
 *   and passes the max-edge hint into `imageNormalization.js`.
 *
 *   Signals used (all optional, all defensive):
 *     • navigator.deviceMemory            — RAM in GB
 *     • navigator.hardwareConcurrency     — CPU cores
 *     • navigator.connection.effectiveType — 4g / 3g / 2g / slow-2g
 *     • navigator.connection.saveData     — Save-Data hint
 *     • navigator.getBattery() (async)    — battery level + charging
 *     • prefers-reduced-motion media query
 *
 *   Tier rules (worst signal wins):
 *     very_low : deviceMemory ≤ 1.5 OR slow-2g OR Save-Data ON
 *     low      : deviceMemory ≤ 3 OR cores ≤ 2 OR 2g
 *     mid      : deviceMemory ≤ 6 OR 3g
 *     high     : otherwise
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Battery probe wrapped in async safe call — no top-level await.
 *   • Idempotent — install hooks once via installLowEndHints().
 */

export const TIER = Object.freeze({
  HIGH:      'high',
  MID:       'mid',
  LOW:       'low',
  VERY_LOW:  'very_low',
});

const _TIER_RANK = Object.freeze({
  high: 0, mid: 1, low: 2, very_low: 3,
});

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _worseOf(a, b) {
  return (_TIER_RANK[a] || 0) >= (_TIER_RANK[b] || 0) ? a : b;
}

function _readNav() {
  if (typeof navigator === 'undefined') return null;
  return navigator;
}

function _prefersReducedMotion() {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  }, false);
}

// ─── Public: device tier detection ──────────────────────────

/**
 * Classify the device into a tier from available signals.
 * Returns `TIER.MID` when no signals are readable (safe middle ground).
 */
export function detectDeviceTier(opts) {
  return _safe(() => {
    const o = _isObj(opts) ? opts : {};
    // Honor an explicit `navigator: null` — caller is signalling "no
    // signals available, give me a safe default" (this is the
    // documented SSR / locked-down environment behavior).
    const explicitNull = ('navigator' in o) && o.navigator === null;
    const nav = explicitNull ? null : (o.navigator || _readNav());
    if (!nav) return TIER.MID;

    let tier = null;          // begin "unknown"
    const upgrade = (next) => { tier = tier == null ? next : _worseOf(tier, next); };

    // RAM
    const ram = _num(nav.deviceMemory);
    if (ram != null) {
      if (ram <= 1.5) upgrade(TIER.VERY_LOW);
      else if (ram <= 3) upgrade(TIER.LOW);
      else if (ram <= 6) upgrade(TIER.MID);
      else upgrade(TIER.HIGH);
    }

    // Cores
    const cores = _num(nav.hardwareConcurrency);
    if (cores != null) {
      if (cores <= 2) upgrade(TIER.LOW);
      else if (cores <= 4) upgrade(TIER.MID);
      else upgrade(TIER.HIGH);
    }

    // Network
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (_isObj(conn)) {
      const et = typeof conn.effectiveType === 'string' ? conn.effectiveType : '';
      if (et === 'slow-2g')      upgrade(TIER.VERY_LOW);
      else if (et === '2g')      upgrade(TIER.LOW);
      else if (et === '3g')      upgrade(TIER.MID);
      else if (et === '4g')      upgrade(TIER.HIGH);
      if (conn.saveData === true) upgrade(TIER.VERY_LOW);
    }

    // If nothing contributed, return the safe middle ground.
    return tier || TIER.MID;
  }, TIER.MID);
}

// ─── Public: optimization profile ───────────────────────────

/**
 * Build a profile of capability/throttle flags the UI + scan
 * pipeline read. Stable shape — never null.
 */
export function getOptimizationProfile(opts) {
  return _safe(() => {
    const tier = detectDeviceTier(opts);
    const reducedMotion = _prefersReducedMotion();
    const isLowEnd = tier === TIER.LOW || tier === TIER.VERY_LOW;
    const isVeryLow = tier === TIER.VERY_LOW;
    return Object.freeze({
      tier,
      reducedMotion,
      // Image pipeline hints
      imageMaxEdgePx:     isVeryLow ? 1280 : isLowEnd ? 1600 : 2048,
      imageJpegQuality:   isVeryLow ? 0.62 : isLowEnd ? 0.72 : 0.82,
      heavyAnimationsAllowed: !isLowEnd && !reducedMotion,
      parallaxAllowed:        !isLowEnd && !reducedMotion,
      offlineFirstRender:     isLowEnd,
      batterySaverHint:       isLowEnd,
      // Background work
      deferNonCriticalWork:   isLowEnd,
      maxConcurrentUploads:   isVeryLow ? 1 : isLowEnd ? 1 : 2,
      // Telemetry sample rate (0..1)
      telemetrySampleRate:    isVeryLow ? 0.10 : isLowEnd ? 0.25 : 1.0,
    });
  }, Object.freeze({
    tier: TIER.MID,
    reducedMotion: false,
    imageMaxEdgePx: 2048,
    imageJpegQuality: 0.82,
    heavyAnimationsAllowed: true,
    parallaxAllowed: true,
    offlineFirstRender: false,
    batterySaverHint: false,
    deferNonCriticalWork: false,
    maxConcurrentUploads: 2,
    telemetrySampleRate: 1.0,
  }));
}

// ─── Public: convenience predicates ─────────────────────────

export function shouldReduceMotion(opts) {
  return getOptimizationProfile(opts).heavyAnimationsAllowed === false;
}

export function shouldThrottleImages(opts) {
  const p = getOptimizationProfile(opts);
  return p.tier === TIER.LOW || p.tier === TIER.VERY_LOW;
}

export function suggestedImageMaxEdge(opts) {
  return getOptimizationProfile(opts).imageMaxEdgePx;
}

export function suggestedAnimationStyle(opts) {
  const p = getOptimizationProfile(opts);
  if (p.tier === TIER.VERY_LOW) return 'static';
  if (p.tier === TIER.LOW)      return 'minimal';
  if (p.reducedMotion)          return 'minimal';
  if (p.tier === TIER.MID)      return 'standard';
  return 'rich';
}

// ─── Public: battery probe + low-end hints ──────────────────

/**
 * Probe battery asynchronously; returns null if unavailable. Used
 * by surfaces that want to gate heavy work on a sufficient charge.
 */
export async function probeBatteryState() {
  return _safe(async () => {
    if (typeof navigator === 'undefined') return null;
    if (typeof navigator.getBattery !== 'function') return null;
    const battery = await navigator.getBattery();
    if (!battery) return null;
    return Object.freeze({
      level:    _num(battery.level),
      charging: !!battery.charging,
      lowBattery: _num(battery.level) != null && battery.level <= 0.20 && !battery.charging,
    });
  }, null);
}

/**
 * Install lightweight class names + CSS hints on the body so global
 * styles can react to low-end devices without each surface having
 * to call this engine. Idempotent.
 */
export function installLowEndHints() {
  return _safe(() => {
    if (typeof document === 'undefined' || !document.body) return false;
    const profile = getOptimizationProfile();
    const cls = document.body.classList;
    // Remove prior tier classes first.
    cls.remove('farroway-tier-high', 'farroway-tier-mid',
               'farroway-tier-low', 'farroway-tier-very_low');
    cls.add('farroway-tier-' + profile.tier);
    if (profile.reducedMotion)         cls.add('farroway-reduced-motion');
    if (profile.batterySaverHint)      cls.add('farroway-battery-saver');
    if (profile.deferNonCriticalWork)  cls.add('farroway-defer-work');
    return true;
  }, false);
}

export const _internal = Object.freeze({
  _worseOf, _prefersReducedMotion, _TIER_RANK,
});

const _module = {
  TIER,
  detectDeviceTier, getOptimizationProfile,
  shouldReduceMotion, shouldThrottleImages,
  suggestedImageMaxEdge, suggestedAnimationStyle,
  probeBatteryState, installLowEndHints,
  _internal,
};
export default _module;
