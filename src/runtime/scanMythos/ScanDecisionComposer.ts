/**
 * ScanDecisionComposer.ts — assembles the ScanMythosDecision trust
 * card from the already-shipped scanRecovery envelope + farm context
 * + explainer + multi-photo status (sprint #200, spec §6).
 *
 * COMPOSITION ONLY. Reads envelope fields the consensus engine
 * already produced (#176-#179, #193, #198). Never calls a provider,
 * never invents a diagnosis, never fabricates satellite/NDVI.
 *
 * Pure. Never throws. Frozen returns.
 */

import { buildFarmScanContext } from './FarmScanContextRuntime';
import {
  confidenceLabelFor, buildWhy, buildLimitations,
} from './ScanConfidenceExplainer';
import { getMultiPhotoStatus } from './MultiPhotoGuidance';
import {
  FORBIDDEN_PROVIDER_NAMES, FORBIDDEN_DOSAGE_TOKENS,
} from './ScanMythosContracts';
import type { ScanMythosDecision } from './ScanMythosContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export const SCAN_DECISION_COMPOSER_VERSION = 'scan-decision-composer-v1';

// Strip any leaked provider name / unsafe dosage from a grower string.
function _scrub(s: string): string {
  let out = s;
  for (const p of FORBIDDEN_PROVIDER_NAMES) {
    out = out.split(p).join('our check');
  }
  for (const d of FORBIDDEN_DOSAGE_TOKENS) {
    if (out.includes(d)) return 'Check with your field officer before treating.';
  }
  return out;
}

function _addDays(iso: string | null, days: number): string {
  // Pure offset against a passed-in base date (no Date.now() — the
  // workflow/runtime forbids it in some contexts; here we accept the
  // envelope's followUpDate if present, else compute from a base).
  return _safe(() => {
    const base = iso ? new Date(iso) : new Date();
    base.setDate(base.getDate() + days);
    return base.toISOString().slice(0, 10);
  }, '');
}

/**
 * Compose a ScanMythosDecision from a scanRecovery envelope + context
 * inputs. Every field is resolved to a safe non-empty value.
 */
export function composeScanMythosDecision(input: {
  envelope?: any;            // scanRecovery envelope (server) or result
  activeCrop?: string;
  cropStage?: string;
  location?: string;
  weatherNote?: string;
  previousScans?: ReadonlyArray<{ issue?: string; plant?: string }>;
  previousOutcomes?: ReadonlyArray<{ status?: string }>;
  photosUsed?: ReadonlyArray<string>;
} = {}): Readonly<ScanMythosDecision> {
  return _safe(() => {
    const env = (input.envelope && typeof input.envelope === 'object')
      ? input.envelope : {};

    const topCandidates = _arr(env.topCandidates).slice(0, 5).map((c) =>
      Object.freeze({
        commonName:     _str(c && (c.commonName || c.name)),
        scientificName: _str(c && c.scientificName),
        score:          _num(c && c.score) || 0,
      }));

    // ── plant ladder — NEVER empty, never "Unknown Plant" w/ cands ─
    const rawPlant = _str(env.plantName);
    const topName = topCandidates[0]
      ? (topCandidates[0].commonName || topCandidates[0].scientificName) : '';
    const plant = rawPlant
      || topName
      || (topCandidates.length > 0 ? 'Needs confirmation' : 'Scan unclear');

    const baseConf = _num(env.confidence) ?? _num(env.confidencePct) ?? 0;

    // ── farm context boost (explainable, capped, re-rank only) ─────
    const context = buildFarmScanContext({
      activeCrop: input.activeCrop,
      cropStage: input.cropStage,
      location: input.location,
      topCandidates,
      previousScans: input.previousScans,
      previousOutcomes: input.previousOutcomes,
    });
    const boostedConf = Math.max(0, Math.min(100,
      Math.round(baseConf + (context.confidenceBoost || 0))));

    // ── multi-photo ────────────────────────────────────────────────
    const multi = getMultiPhotoStatus({
      photosUsed: input.photosUsed,
      confidencePct: boostedConf,
      objectType: _str(env.objectType),
    });

    // ── issue / severity (from envelope; never invented) ───────────
    const issueCand = _arr(env.issueCandidates)[0] || {};
    const issue = _str(env.issueType) || _str(issueCand.name) || 'no_visible_issue';
    const severity = (['low', 'medium', 'high'].includes(_str(env.severity))
      ? _str(env.severity) : null) as ScanMythosDecision['severity'];

    // ── why + limitations ──────────────────────────────────────────
    const why = buildWhy({
      plant, issue, weatherNote: input.weatherNote,
      context, confidencePct: boostedConf,
    }).map(_scrub);
    const limitations = buildLimitations({
      imageQuality: env.imageQuality,
      confidencePct: boostedConf,
      multiPhotoMissing: multi.missingHelpfulPhotos.length > 0,
    }).map(_scrub);

    // ── next action (envelope-sourced, scrubbed of dosage/provider) ─
    const nextAction = _scrub(_str(env.nextAction)
      || 'Check a few nearby plants today.');

    // ── follow-up (envelope date or +3d default) ───────────────────
    const followUpDate = _str(env.followUpDate)
      || _addDays(null, severity === 'high' ? 3 : severity === 'medium' ? 3 : 7);

    return Object.freeze({
      runtimeVersion: 'scan-mythos-decision-v1',
      plant,
      scientificName: _str(env.scientificName),
      confidence: boostedConf,
      confidenceLabel: confidenceLabelFor(boostedConf),
      topCandidates: Object.freeze(topCandidates),
      issue,
      issueType: issue,
      severity,
      farmContextBoost: context.confidenceBoost || 0,
      satelliteContextBoost: 0, // satellite out of scope this sprint
      why: Object.freeze(why),
      limitations: Object.freeze(limitations),
      nextAction,
      estimatedTime: _str(env.estimatedTime) || '3-5 minutes',
      followUpDate,
      outcomePrompt: 'Did the plant improve?',
      riskPrediction: _str(env.whyItMatters) || null,
      neverFabricatesSatellite: true as const,
      neverShowsProviderNames: true as const,
    });
  }, Object.freeze({
    runtimeVersion: 'scan-mythos-decision-v1',
    plant: 'Scan unclear',
    scientificName: '',
    confidence: 0,
    confidenceLabel: 'Review recommended' as const,
    topCandidates: Object.freeze([]),
    issue: 'no_visible_issue',
    issueType: 'no_visible_issue',
    severity: null,
    farmContextBoost: 0,
    satelliteContextBoost: 0,
    why: Object.freeze(['We could not read this photo clearly.']),
    limitations: Object.freeze(['This is guidance from one photo, not a lab test.']),
    nextAction: 'Retake the photo in good light, focused on one leaf.',
    estimatedTime: '3-5 minutes',
    followUpDate: '',
    outcomePrompt: 'Did the plant improve?',
    riskPrediction: null,
    neverFabricatesSatellite: true as const,
    neverShowsProviderNames: true as const,
  }));
}

export const _internal = Object.freeze({ composeScanMythosDecision });
export default composeScanMythosDecision;
