/**
 * src/runtime/scan/ScanDetectionNormalizer.ts — normalize ANY provider
 * result (Plant.id / PlantNet / Crop.id / local knowledge / manual review)
 * into the canonical Scan detection contract.
 *
 * Pure + never throws. Localizes every label through translateEntityLabel()
 * (English fallback + translatorReview flag when missing). Computes
 * overallConfidence + needsReview from the contract thresholds. NEVER
 * surfaces raw provider JSON — rawProviderRef is an opaque internal pointer.
 */

import {
  SCAN_DETECTION_CONTRACT_VERSION, CONFIDENCE_THRESHOLDS,
  confidenceTier, confidenceLabel, DETECTION_DISCLAIMER,
  PLANT_TYPES, HEALTH_STATUSES, SEVERITIES, GROWTH_STAGES, HARVEST_STATUSES,
} from './scanDetectionContracts';
import { translateEntityLabel } from '../../i18n/translateEntityLabel';

export const SCAN_DETECTION_NORMALIZER_VERSION = 'scan-detection-normalizer-v1';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _obj = (v: unknown): any => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
const _coerce = (v: unknown, allowed: readonly string[], fb: string): string =>
  (allowed as readonly string[]).includes(String(v)) ? String(v) : fb;

/** Localize + canonicalize a label for a catalog type. Returns the matched
 *  canonical key, the localized displayName, and the review/fallback flags. */
function _resolve(type: string, label: unknown, locale: string) {
  return _safe(() => {
    const out = translateEntityLabel({ type, keyOrName: _str(label) || String(label || ''), locale });
    return {
      canonicalKey: _str(out && out.canonicalKey),
      displayName:  _str(out && out.label),
      matched:      !!(out && out.fallbackUsed === false),
      reviewRequired: !!(out && out.reviewRequired),
    };
  }, { canonicalKey: '', displayName: _str(label), matched: false, reviewRequired: true });
}

function _mkIssue(type: string, raw: any, locale: string) {
  const label = _str(raw && (raw.name || raw.label || raw.key)) || _str(raw);
  const r = _resolve(type, label, locale);
  const c = confidenceTier(raw && raw.confidence);
  const signsKey = type === 'disease' ? 'symptoms' : 'visualSigns';
  return Object.freeze({
    canonicalKey: r.canonicalKey || null,
    displayName:  r.displayName,
    confidence:   c.score,
    confidenceLabel: confidenceLabel(c.tier),
    severity:     _coerce(raw && raw.severity, SEVERITIES, 'unknown'),
    [signsKey]:   Object.freeze(_arr(raw && raw.signs).map(_str).filter(Boolean)),
    reviewRequired: r.reviewRequired || c.needsReview,
    limitations:  'Based on the photo and available information only — ' + DETECTION_DISCLAIMER,
  });
}

/** Bucket a free-text issue label into disease / pest / nutrient by which
 *  catalog it canonically resolves into (matched === true). */
function _bucketIssues(rawIssues: any[], locale: string) {
  const diseases: any[] = [], pests: any[] = [], nutrients: any[] = [];
  for (const issue of rawIssues) {
    const label = _str(issue && (issue.name || issue.label || issue.key)) || _str(issue);
    if (!label) continue;
    const asDisease = _resolve('disease', label, locale);
    if (asDisease.matched) { diseases.push(_mkIssue('disease', issue, locale)); continue; }
    const asPest = _resolve('pest', label, locale);
    if (asPest.matched) { pests.push(_mkIssue('pest', issue, locale)); continue; }
    const asNutrient = _resolve('nutrient', label, locale);
    if (asNutrient.matched) { nutrients.push(_mkIssue('nutrient', issue, locale)); continue; }
    // Unmatched → keep as a disease-bucket "needs review" item, never invented.
  }
  return { diseases, pests, nutrients };
}

export interface NormalizeOpts { locale?: string; imageSource?: 'upload' | 'camera'; }

/**
 * Normalize a raw provider result into the canonical detection contract.
 */
export function normalizeDetection(raw: unknown, opts: NormalizeOpts = {}) {
  return _safe(() => {
    const r = _obj(raw) || {};
    const locale = _str(opts.locale) || 'en';
    const imageSource = opts.imageSource === 'camera' ? 'camera' : 'upload';

    // primary plant/crop.
    const plantLabel = _str(r.commonName || r.displayName || r.name);
    const pr = _resolve('crop', plantLabel, locale);
    const primaryTier = confidenceTier(r.confidence);
    const primary = Object.freeze({
      type:          _coerce(r.category || r.type, PLANT_TYPES, 'unknown'),
      canonicalKey:  pr.canonicalKey || null,
      displayName:   pr.displayName || 'Unknown',
      scientificName: _str(r.scientificName) || null,
      confidence:    primaryTier.score,
      confidenceLabel: confidenceLabel(primaryTier.tier),
    });

    // health.
    const healthObj = _obj(r.health) || {};
    const healthTier = confidenceTier(healthObj.confidence != null ? healthObj.confidence : r.healthConfidence);
    const health = Object.freeze({
      status:     _coerce(healthObj.status || r.healthStatus, HEALTH_STATUSES, 'unknown'),
      score:      _num(healthObj.score),
      confidence: healthTier.score,
    });

    // issues → disease / pest / nutrient (use explicit arrays if provided,
    // else bucket the generic issue list).
    const explicitD = _arr(r.diseases), explicitP = _arr(r.pests), explicitN = _arr(r.nutrients);
    const bucketed = _bucketIssues(_arr(r.issues), locale);
    const diseases = (explicitD.length ? explicitD.map((d) => _mkIssue('disease', d, locale)) : bucketed.diseases);
    const pests    = (explicitP.length ? explicitP.map((p) => _mkIssue('pest', p, locale))    : bucketed.pests);
    const nutrients = (explicitN.length ? explicitN.map((n) => _mkIssue('nutrient', n, locale)) : bucketed.nutrients);

    // growth stage + harvest readiness (only when the provider supplies them).
    const gs = _obj(r.growthStage) || {};
    const gsTier = confidenceTier(gs.confidence);
    const growthStage = Object.freeze({
      stage:      _coerce(gs.stage, GROWTH_STAGES, 'unknown'),
      confidence: gsTier.score,
      source:     _str(gs.source) || 'provider',
    });
    const hr = _obj(r.harvestReadiness) || {};
    const hrTier = confidenceTier(hr.confidence);
    const harvestReadiness = Object.freeze({
      status:     _coerce(hr.status, HARVEST_STATUSES, 'unknown'),
      confidence: hrTier.score,
      estimatedWindow: _str(hr.estimatedWindow) || null,
      limitations: 'Readiness, not an exact date — ' + DETECTION_DISCLAIMER,
    });

    // overall confidence = primary tier (the spine of the result).
    const overallConfidence = primaryTier.score;
    const needsReview = primaryTier.needsReview
      || health.status === 'unknown' && primary.type === 'unknown'
      || pr.reviewRequired
      || diseases.some((d: any) => d.reviewRequired)
      || pests.some((p: any) => p.reviewRequired);

    return Object.freeze({
      runtimeVersion: SCAN_DETECTION_NORMALIZER_VERSION,
      contractVersion: SCAN_DETECTION_CONTRACT_VERSION,
      scanId:      _str(r.scanId) || null,
      imageSource,
      provider:    _str(r.provider) || 'unknown',
      detectedAt:  _str(r.detectedAt) || null,
      primary,
      health,
      diseases:  Object.freeze(diseases),
      pests:     Object.freeze(pests),
      nutrients: Object.freeze(nutrients),
      growthStage,
      harvestReadiness,
      overallConfidence,
      needsReview: !!needsReview,
      limitations: 'Results are based on the photo and available information only. '
        + 'If unknown, we say so. ' + DETECTION_DISCLAIMER,
      // Internal-only opaque pointer to stored raw data — NEVER rendered to
      // the grower (gate-enforced by check-scan-result-safety).
      rawProviderRef: _str(r.rawProviderRef || r.rawProviderId) || null,
    });
  }, _emptyDetection(opts));
}

function _emptyDetection(opts: NormalizeOpts = {}) {
  return Object.freeze({
    runtimeVersion: SCAN_DETECTION_NORMALIZER_VERSION,
    contractVersion: SCAN_DETECTION_CONTRACT_VERSION,
    scanId: null, imageSource: opts.imageSource === 'camera' ? 'camera' : 'upload',
    provider: 'unknown', detectedAt: null,
    primary: Object.freeze({ type: 'unknown', canonicalKey: null, displayName: 'Unknown', scientificName: null, confidence: null, confidenceLabel: confidenceLabel('unknown') }),
    health: Object.freeze({ status: 'unknown', score: null, confidence: null }),
    diseases: Object.freeze([]), pests: Object.freeze([]), nutrients: Object.freeze([]),
    growthStage: Object.freeze({ stage: 'unknown', confidence: null, source: 'none' }),
    harvestReadiness: Object.freeze({ status: 'unknown', confidence: null, estimatedWindow: null, limitations: DETECTION_DISCLAIMER }),
    overallConfidence: null, needsReview: true,
    limitations: 'Not enough information yet. ' + DETECTION_DISCLAIMER,
    rawProviderRef: null,
  });
}

/* ── §7 task candidates from a detection (safe, localized, no dosage) ── */
export function buildScanTaskCandidates(detection: unknown, opts: NormalizeOpts = {}) {
  return _safe(() => {
    const d = _obj(detection) || {};
    const locale = _str(opts.locale) || 'en';
    const t = (key: string, fallback: string) => {
      const out = _safe(() => translateEntityLabel({ type: 'task', keyOrName: key, locale }), null);
      return (out && _str(out.label)) || fallback;
    };
    const tasks: any[] = [];
    const push = (taskType: string, text: string) =>
      tasks.push(Object.freeze({ taskType, text, vettedTreatment: false, dosage: null }));

    if (_arr(d.diseases).length) {
      push('inspect_nearby', t('inspect_nearby_plants', 'Inspect nearby plants for the same signs.'));
      push('follow_up_scan', t('follow_up_scan', 'Scan this plant again in a few days to watch for change.'));
      // Treatment task ONLY if a vetted catalog entry exists (never auto-prescribed here).
    }
    if (_arr(d.pests).length) {
      push('inspect_leaf_underside', t('inspect_leaf_underside', 'Check the underside of the leaves.'));
      push('follow_up_scan', t('follow_up_scan', 'Scan again in a few days to watch for change.'));
    }
    if (_arr(d.nutrients).length) {
      push('check_soil_moisture', t('check_soil_moisture', 'Check soil and watering.'));
      push('follow_up_observation', t('follow_up_observation', 'Observe the plant over the next week.'));
    }
    const hr = _obj(d.harvestReadiness);
    if (hr && hr.status === 'ready') push('harvest_check', t('harvest_check', 'Check ripeness — harvest within the window if ready.'));
    else if (hr && hr.status === 'almost_ready') push('scan_again_soon', t('scan_again_soon', 'Almost ready — scan again soon.'));

    return Object.freeze(tasks.slice(0, 4));
  }, Object.freeze([]));
}
