/**
 * ScanConfidenceExplainer.ts — builds the farmer-facing "why" +
 * "limitations" lists (sprint #200, spec §6).
 *
 * Pure. Translates the envelope signals + farm context into plain,
 * non-jargon sentences. Never names a provider. Never claims
 * certainty. Always returns at least one "why" and the honest
 * limitations.
 */

import type { FarmScanContext, MythosConfidenceLabel } from './ScanMythosContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);

export const SCAN_CONFIDENCE_EXPLAINER_VERSION = 'scan-confidence-explainer-v1';

export function confidenceLabelFor(pct: number | null): MythosConfidenceLabel {
  const c = _num(pct);
  if (c == null) return 'Review recommended';
  if (c >= 80) return 'Likely match';
  if (c >= 60) return 'Needs confirmation';
  return 'Review recommended';
}

/**
 * Build the "why" list (plain reasons supporting the result).
 * Sources, in order: image signal → issue → weather → farm context.
 */
export function buildWhy(input: {
  plant?: string;
  issue?: string;
  weatherNote?: string;
  context?: FarmScanContext | null;
  confidencePct?: number | null;
}): ReadonlyArray<string> {
  return _safe(() => {
    const why: string[] = [];
    const issue = _str(input.issue);
    if (issue && issue.toLowerCase() !== 'no_visible_issue') {
      why.push('Leaf appearance suggests ' + issue.replace(/_/g, ' ') + '.');
    } else if (_str(input.plant)) {
      why.push('The photo matched a known plant pattern.');
    }
    const weather = _str(input.weatherNote);
    if (weather) why.push(weather);
    const ctx = input.context;
    if (ctx && Array.isArray(ctx.rationale)) {
      for (const r of ctx.rationale) if (_str(r)) why.push(r);
    }
    const c = _num(input.confidencePct);
    if (why.length === 0) {
      why.push(c != null && c < 60
        ? 'The photo gave a weak signal — a clearer shot will help.'
        : 'Based on what the photo showed.');
    }
    return Object.freeze(why.slice(0, 5));
  }, Object.freeze(['Based on what the photo showed.']));
}

/**
 * Build the honest "limitations" list. ALWAYS non-empty (the spec
 * requires limitations on every card).
 */
export function buildLimitations(input: {
  imageQuality?: { overall?: string; leafCoverage?: number | null };
  confidencePct?: number | null;
  multiPhotoMissing?: boolean;
}): ReadonlyArray<string> {
  return _safe(() => {
    const lims: string[] = [];
    const iq = input.imageQuality || {};
    if (_str(iq.overall) && iq.overall !== 'good') {
      lims.push('The photo was hard to read in places.');
    }
    const cov = _num(iq.leafCoverage);
    if (cov != null && cov < 50) {
      lims.push('The photo shows only part of the leaf.');
    }
    const c = _num(input.confidencePct);
    if (c != null && c < 60) {
      lims.push('This is a possible match, not a confirmed one.');
    }
    if (input.multiPhotoMissing) {
      lims.push('More photos would sharpen this result.');
    }
    if (lims.length === 0) {
      // The universal honest caveat — decision support, not a guarantee.
      lims.push('This is guidance from one photo, not a lab test.');
    }
    return Object.freeze(lims.slice(0, 4));
  }, Object.freeze(['This is guidance from one photo, not a lab test.']));
}

export const _internal = Object.freeze({
  confidenceLabelFor, buildWhy, buildLimitations,
});
