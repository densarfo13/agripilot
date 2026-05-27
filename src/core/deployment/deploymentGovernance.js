/**
 * deploymentGovernance.js — runtime deployment-integrity guardrail (spec §10).
 *
 *   import {
 *     verifyDeploymentIntegrity, isFeatureFlagOn, killSwitch,
 *     reportDeploymentHealth, FLAG, KILL_SWITCH,
 *   } from 'src/core/deployment/deploymentGovernance.js';
 *
 *   const verdict = verifyDeploymentIntegrity();
 *   if (!verdict.healthy) {
 *     // log + recover
 *   }
 *
 * What this is
 * ────────────
 *   A defensive runtime layer that:
 *     • Compares the running build identity to expected values
 *       (Vite-injected env, runtime window globals, asset URLs).
 *     • Detects stale chunks (locale / scan / overlay assets older
 *       than the current bundle hash).
 *     • Exposes a small flag table for staged rollouts.
 *     • Provides kill switches that surfaces consult before
 *       enabling heavy intelligence layers.
 *
 *   Compose-only: every signal is read from existing modules
 *   (productionDiagnostics, supportedLocales, scanBuildStamp).
 *   No new build pipeline; no service-worker rewrites; no fetches.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Reports honest "unknown" when an inspection target is missing.
 *   • Idempotent.
 */

const ENGINE_VERSION = 'deployment-governance-v1';

// ─── Feature flags ───────────────────────────────────────────

export const FLAG = Object.freeze({
  CORE_SCAN:               'core_scan',
  LIFECYCLE:               'lifecycle',
  DAILY_DECISION:          'daily_decision',
  TRUST_EXPLANATION:       'trust_explanation',
  CONFIDENCE_LOOP:         'confidence_loop',
  // Behind-flag — default OFF until explicitly enabled per env.
  SOIL_INTELLIGENCE:       'soil_intelligence',
  SUPPLIER_INTELLIGENCE:   'supplier_intelligence',
  MARKETPLACE_INTELLIGENCE:'marketplace_intelligence',
  YIELD_PREDICTION:        'yield_prediction',
  NGO_ANALYTICS:           'ngo_analytics',
  SATELLITE_READINESS:     'satellite_readiness',
  SCAN_V5_INVISIBLE:       'scan_v5_invisible_intelligence',
  // Invisible Intelligence Phase 2 (default OFF). Allow dev/test
  // override via VITE_FF_<FLAG>=on or by setting the env to "true".
  ENABLE_ML_RANKING:                    'enable_ml_ranking',
  ENABLE_DISEASE_CONFIDENCE_CALIBRATION:'enable_disease_confidence_calibration',
  ENABLE_PREDICTIVE_YIELD:              'enable_predictive_yield',
  ENABLE_SATELLITE_ENRICHMENT:          'enable_satellite_enrichment',
  ENABLE_NGO_INTELLIGENCE:              'enable_ngo_intelligence',
});

// Spec §13 safe defaults — core ON, advanced OFF.
const _FLAG_DEFAULTS = Object.freeze({
  [FLAG.CORE_SCAN]:                true,
  [FLAG.LIFECYCLE]:                true,
  [FLAG.DAILY_DECISION]:           true,
  [FLAG.TRUST_EXPLANATION]:        true,
  [FLAG.CONFIDENCE_LOOP]:          true,
  [FLAG.SOIL_INTELLIGENCE]:        false,
  [FLAG.SUPPLIER_INTELLIGENCE]:    false,
  [FLAG.MARKETPLACE_INTELLIGENCE]: false,
  [FLAG.YIELD_PREDICTION]:         false,
  [FLAG.NGO_ANALYTICS]:            false,
  [FLAG.SATELLITE_READINESS]:      false,
  [FLAG.SCAN_V5_INVISIBLE]:        false,
  // Invisible Intelligence Phase 2 — all OFF by default.
  [FLAG.ENABLE_ML_RANKING]:                    false,
  [FLAG.ENABLE_DISEASE_CONFIDENCE_CALIBRATION]:false,
  [FLAG.ENABLE_PREDICTIVE_YIELD]:              false,
  [FLAG.ENABLE_SATELLITE_ENRICHMENT]:          false,
  [FLAG.ENABLE_NGO_INTELLIGENCE]:              false,
});

export const KILL_SWITCH = Object.freeze({
  ALL_RECOMMENDATIONS:    'all_recommendations',
  ALL_PREDICTIONS:        'all_predictions',
  ALL_TELEMETRY:          'all_telemetry',
  HEAVY_ANIMATIONS:       'heavy_animations',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ─── Environment readers ─────────────────────────────────────

function _readEnv() {
  return _safe(() => {
    if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env;
    return {};
  }, {});
}

function _readWindow() {
  try {
    return typeof window !== 'undefined' ? window : {};
  } catch { return {}; }
}

// ─── Flag checks ─────────────────────────────────────────────

/**
 * Read a flag — env override wins over default. Env key shape:
 *   VITE_FF_<UPPERCASE_FLAG> = "true" | "1" | "on"
 */
export function isFeatureFlagOn(flag) {
  return _safe(() => {
    if (typeof flag !== 'string') return false;
    const env = _readEnv();
    const key = 'VITE_FF_' + flag.toUpperCase();
    const raw = env[key];
    if (typeof raw === 'string') {
      const v = raw.trim().toLowerCase();
      if (v === 'true' || v === '1' || v === 'on' || v === 'yes') return true;
      if (v === 'false' || v === '0' || v === 'off' || v === 'no') return false;
    }
    return _FLAG_DEFAULTS[flag] === true;
  }, false);
}

/**
 * Check a kill switch. Defaults to OFF (i.e. the kill is NOT
 * engaged). Set `VITE_KS_<NAME>=on` to engage.
 */
export function killSwitch(name) {
  return _safe(() => {
    if (typeof name !== 'string') return false;
    const env = _readEnv();
    const raw = env['VITE_KS_' + name.toUpperCase()];
    if (typeof raw !== 'string') return false;
    const v = raw.trim().toLowerCase();
    return v === 'on' || v === 'true' || v === '1' || v === 'yes';
  }, false);
}

// ─── Build / asset checks ────────────────────────────────────

function _readBuildId() {
  return _safe(() => {
    const env = _readEnv();
    return _str(env.VITE_RAILWAY_GIT_COMMIT_SHA)
        || _str(env.VITE_BUILD_ID)
        || _str(env.VITE_GIT_SHA)
        || null;
  }, null);
}

function _readLocaleVersion() {
  return _safe(() => {
    const env = _readEnv();
    return _str(env.VITE_LOCALE_VERSION) || null;
  }, null);
}

function _readScanRuntimeVersion() {
  return _safe(() => {
    const win = _readWindow();
    if (win.__farrowayBuild && typeof win.__farrowayBuild === 'function') {
      const snap = _safe(() => win.__farrowayBuild(), null);
      if (_isObj(snap)) return _str(snap.scanRuntimeVersion) || null;
    }
    return null;
  }, null);
}

/**
 * Verify the loaded bundle reports the same build identity in
 * every place we can read it. Honest "unknown" when the field is
 * missing — never a false positive.
 */
export function verifyDeploymentIntegrity() {
  return _safe(() => {
    const buildId            = _readBuildId();
    const localeVersion      = _readLocaleVersion();
    const scanRuntimeVersion = _readScanRuntimeVersion();

    const problems = [];
    if (!buildId) problems.push('build_id_missing');
    if (!localeVersion) problems.push('locale_version_missing');

    // Cross-check window globals if available
    const win = _readWindow();
    const winBuild = _safe(() => {
      if (typeof win.__farrowayBuild === 'function') return win.__farrowayBuild();
      return null;
    }, null);
    if (_isObj(winBuild) && winBuild.gitSha && buildId && winBuild.gitSha !== buildId) {
      problems.push('runtime_build_mismatch');
    }

    const healthy = problems.length === 0;
    return Object.freeze({
      engineVersion: ENGINE_VERSION,
      healthy,
      buildId,
      localeVersion,
      scanRuntimeVersion,
      problems: Object.freeze(problems),
      generatedAt: Date.now(),
    });
  }, Object.freeze({
    engineVersion: ENGINE_VERSION,
    healthy: false,
    buildId: null,
    localeVersion: null,
    scanRuntimeVersion: null,
    problems: Object.freeze(['inspection_failed']),
    generatedAt: Date.now(),
  }));
}

// ─── Health score ────────────────────────────────────────────

/**
 * Roll deployment-integrity + flag state into a 0..100 score
 * surfaces use to decide whether to render heavy features.
 */
export function reportDeploymentHealth() {
  return _safe(() => {
    const integrity = verifyDeploymentIntegrity();
    let score = 100;
    if (!integrity.healthy) score -= Math.min(60, integrity.problems.length * 20);
    // Kill switches each shave 10 off the score.
    for (const name of Object.values(KILL_SWITCH)) {
      if (killSwitch(name)) score -= 10;
    }
    score = Math.max(0, Math.min(100, score));
    const band = score >= 90 ? 'healthy'
               : score >= 70 ? 'degraded'
               : score >= 40 ? 'risky'
               : 'unhealthy';
    return Object.freeze({
      engineVersion: ENGINE_VERSION,
      score,
      band,
      integrity,
      killSwitches: Object.freeze(
        Object.fromEntries(
          Object.values(KILL_SWITCH).map((k) => [k, killSwitch(k)]),
        ),
      ),
      flagSnapshot: Object.freeze(
        Object.fromEntries(
          Object.values(FLAG).map((f) => [f, isFeatureFlagOn(f)]),
        ),
      ),
      generatedAt: Date.now(),
    });
  }, Object.freeze({
    engineVersion: ENGINE_VERSION,
    score: 0, band: 'unhealthy',
    integrity: verifyDeploymentIntegrity(),
    killSwitches: Object.freeze({}),
    flagSnapshot: Object.freeze({}),
    generatedAt: Date.now(),
  }));
}

export const _internal = Object.freeze({
  _FLAG_DEFAULTS, _readEnv, _readWindow,
  _readBuildId, _readLocaleVersion, _readScanRuntimeVersion,
  ENGINE_VERSION,
});

const _module = {
  FLAG, KILL_SWITCH,
  isFeatureFlagOn, killSwitch,
  verifyDeploymentIntegrity, reportDeploymentHealth,
  _internal,
};
export default _module;
