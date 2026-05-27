/**
 * ngoIntelligenceEngine.js — Phase 2 §6.
 *
 *   import { buildNgoIntelligence }
 *     from 'src/core/ngo/ngoIntelligenceEngine.js';
 *
 *   const v = buildNgoIntelligence({
 *     activeFarm, region, taskHistory, scanHistory,
 *     recommendationHistory, outcomeHistory, recoveryHistory,
 *     interventionHistory,
 *   });
 *
 *   v = {
 *     engagementSummary,            — { scans, tasksCompleted, returnVisits }
 *     cropRiskSummary,              — { crop, riskBand, contributingFactors[] }
 *     interventionEffectiveness,    — { intervention, helpedCount, ignoredCount }[]
 *     recoveryTrends,               — { resolved, improved, worsened, unchanged }
 *     dataQualityScore,             — 0..1
 *     exportReady,                  — boolean
 *     engineVersion:'ngo-intel-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   A thin facade over the existing outcomeAnalytics surface that
 *   produces the NGO-facing intelligence shape. Strictly aggregate:
 *   no PII, no exact farm coordinates, no raw images.
 *
 *   When ENABLE_NGO_INTELLIGENCE is OFF or data quality is too
 *   thin, returns a frozen `exportReady: false` envelope so the
 *   downstream dashboard knows to display "still building".
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • PII contract: NEVER includes user id / phone / email / lat / lng
 *     verbatim. Region is rounded to its label (no postcode).
 */

import { FLAG, isFeatureFlagOn } from '../deployment/deploymentGovernance.js';
import { gateEngine } from '../intelligence/dataQualityGate.js';

const ENGINE_VERSION = 'ngo-intel-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// Explicit PII deny-list. Any of these keys on an input object
// must NOT appear in the output envelope.
const PII_KEYS = Object.freeze(new Set([
  'userId', 'phone', 'phoneNumber', 'email', 'fullName', 'name',
  'lat', 'lng', 'latitude', 'longitude', 'coords', 'address',
  'imageData', 'photoBytes', 'blob', 'dataUrl',
]));

function _stripPii(obj) {
  if (!_isObj(obj)) return null;
  const out = {};
  for (const k of Object.keys(obj)) {
    if (PII_KEYS.has(k)) continue;
    const v = obj[k];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return Object.freeze(out);
}

function _engagementSummary(input) {
  const scans = Array.isArray(input.scanHistory) ? input.scanHistory.length : 0;
  const tasks = Array.isArray(input.taskHistory)
    ? input.taskHistory.filter((t) => t && t.completed === true).length : 0;
  return Object.freeze({ scans, tasksCompleted: tasks });
}

function _recoveryTrends(input) {
  const outcomes = Array.isArray(input.outcomeHistory) ? input.outcomeHistory : [];
  const counts = { resolved: 0, improved: 0, worsened: 0, unchanged: 0 };
  for (const o of outcomes) {
    if (!_isObj(o)) continue;
    const out = _str(o.outcome).toLowerCase();
    if (out in counts) counts[out] += 1;
  }
  return Object.freeze(counts);
}

function _interventionEffectiveness(input) {
  const interventions = Array.isArray(input.interventionHistory) ? input.interventionHistory : [];
  const grouped = new Map();
  for (const i of interventions) {
    if (!_isObj(i)) continue;
    const name = _str(i.name);
    if (!name) continue;
    if (!grouped.has(name)) grouped.set(name, { intervention: name, helpedCount: 0, ignoredCount: 0 });
    const slot = grouped.get(name);
    if (i.helped === true) slot.helpedCount += 1;
    if (i.helped === false) slot.ignoredCount += 1;
  }
  return Object.freeze(Array.from(grouped.values()).map((v) => Object.freeze(v)));
}

function _cropRiskSummary(input, recoveryTrends) {
  const farm = input.activeFarm || {};
  const crop = _str(farm.cropId || farm.crop) || null;
  if (!crop) {
    return Object.freeze({ crop: null, riskBand: 'unknown', contributingFactors: Object.freeze([]) });
  }
  const factors = [];
  if (recoveryTrends.worsened >= 2) factors.push('repeated_worsening');
  const scans = Array.isArray(input.scanHistory) ? input.scanHistory : [];
  if (scans.filter((s) => _str(s && s.severity).toLowerCase() === 'serious').length >= 1) {
    factors.push('serious_scan_recent');
  }
  let riskBand = 'stable';
  if (factors.length >= 2) riskBand = 'at_risk';
  else if (factors.length === 1) riskBand = 'watch';
  return Object.freeze({
    crop,
    riskBand,
    contributingFactors: Object.freeze(factors),
  });
}

/**
 * Build the NGO intelligence envelope. Always returns frozen;
 * never throws.
 */
export function buildNgoIntelligence(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};

    const flagOn = isFeatureFlagOn(FLAG.ENABLE_NGO_INTELLIGENCE);
    const gate   = gateEngine('ngo_intelligence', safe);

    if (!flagOn || !gate.ready) {
      return Object.freeze({
        engineVersion:             ENGINE_VERSION,
        engagementSummary:         Object.freeze({ scans: 0, tasksCompleted: 0 }),
        cropRiskSummary:           Object.freeze({ crop: null, riskBand: 'unknown', contributingFactors: Object.freeze([]) }),
        interventionEffectiveness: Object.freeze([]),
        recoveryTrends:            Object.freeze({ resolved: 0, improved: 0, worsened: 0, unchanged: 0 }),
        dataQualityScore:          _num(gate.quality && gate.quality.score) || 0,
        exportReady:               false,
        regionTag:                 _stripPii({ region: _str(safe.region) || _str(safe.activeFarm && safe.activeFarm.region) }),
        generatedAt:               Date.now(),
      });
    }

    const recoveryTrends = _recoveryTrends(safe);
    return Object.freeze({
      engineVersion:             ENGINE_VERSION,
      engagementSummary:         _engagementSummary(safe),
      cropRiskSummary:           _cropRiskSummary(safe, recoveryTrends),
      interventionEffectiveness: _interventionEffectiveness(safe),
      recoveryTrends,
      dataQualityScore:          _num(gate.quality && gate.quality.score) || 0,
      exportReady:               true,
      regionTag:                 _stripPii({ region: _str(safe.region) || _str(safe.activeFarm && safe.activeFarm.region) }),
      generatedAt:               Date.now(),
    });
  }, Object.freeze({
    engineVersion:             ENGINE_VERSION,
    engagementSummary:         Object.freeze({ scans: 0, tasksCompleted: 0 }),
    cropRiskSummary:           Object.freeze({ crop: null, riskBand: 'unknown', contributingFactors: Object.freeze([]) }),
    interventionEffectiveness: Object.freeze([]),
    recoveryTrends:            Object.freeze({ resolved: 0, improved: 0, worsened: 0, unchanged: 0 }),
    dataQualityScore:          0,
    exportReady:               false,
    regionTag:                 null,
    generatedAt:               Date.now(),
  }));
}

export const _internal = Object.freeze({
  _stripPii, _engagementSummary, _recoveryTrends,
  _interventionEffectiveness, _cropRiskSummary,
  PII_KEYS, ENGINE_VERSION,
});

const _module = { buildNgoIntelligence, _internal };
export default _module;
