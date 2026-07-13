/**
 * evidenceAggregator.js — cross-view evidence aggregation + identification rules
 * across multiple photos in one scan session (spec P3/P4).
 *
 * Pure, deterministic, never throws. Preserves per-image provider results, never
 * averages unrelated confidence values, and never presents Farroway's combined
 * agreement as the provider's confidence. Reuses the existing taxon-id helper and
 * the env-tunable identification thresholds (no NEW thresholds are introduced).
 */

import { taxonIdFor } from '../scanDecision/plantConfirmation.js';
import { getIdentificationThresholds } from '../scanDecision/resolveIdentificationState.js';

const _arr = (v) => (Array.isArray(v) ? v : []);
function _pct01(v) { const n = Number(v); if (!Number.isFinite(n)) return null; return n > 1 && n <= 100 ? n / 100 : n; }

// The single best candidate of one image (already sorted DESC, but be defensive).
function _topOf(img) {
  const cands = _arr(img && img.candidates)
    .map((c) => ({
      taxonId: taxonIdFor(c && c.scientificName, c && c.commonName),
      commonName: String((c && (c.commonName || c.name)) || '').trim(),
      scientificName: String((c && c.scientificName) || '').trim(),
      score: _pct01(c && (c.providerConfidence != null ? c.providerConfidence : c.score)),
    }))
    .filter((c) => c.taxonId && c.score != null)
    .sort((a, b) => b.score - a.score);
  return cands[0] || null;
}

/**
 * @param {object} input
 * @param {Array} input.perImageResults  [{ viewType, imageQualityStatus, candidates:[...] }]
 * @param {object} [input.priorConfirmed] a previously CONFIRMED identity for this plot — never overwritten by a weaker later photo
 * @returns {Readonly<object>} {
 *   identificationState, topCandidate, candidates, crossViewAgreement,
 *   providerRawConfidence, farrowayContextScore, reasonCode }
 */
export function aggregateEvidence(input = {}) {
  const th = getIdentificationThresholds();
  const images = _arr(input.perImageResults).filter((im) => String(im && im.imageQualityStatus || 'PASS').toUpperCase() !== 'FAIL');

  // Group each image's TOP candidate by normalized taxon — cross-view agreement.
  const byTaxon = new Map();
  for (const img of images) {
    const top = _topOf(img);
    if (!top) continue;
    const g = byTaxon.get(top.taxonId) || { taxonId: top.taxonId, commonName: top.commonName, scientificName: top.scientificName, views: 0, maxScore: 0 };
    g.views += 1;
    if (top.score > g.maxScore) g.maxScore = top.score;
    if (!g.commonName && top.commonName) g.commonName = top.commonName;
    byTaxon.set(top.taxonId, g);
  }
  const ranked = Array.from(byTaxon.values())
    .sort((a, b) => (b.views - a.views) || (b.maxScore - a.maxScore));

  const _emptyOut = (state, reason) => Object.freeze({
    identificationState: state, topCandidate: null, candidates: Object.freeze([]),
    crossViewAgreement: 0, providerRawConfidence: null, farrowayContextScore: 0, reasonCode: reason,
  });

  // Prior confirmed identity is never downgraded by a weaker later photo (P4).
  if (input.priorConfirmed && input.priorConfirmed.taxonId) {
    return Object.freeze({
      identificationState: 'CONFIRMED',
      topCandidate: Object.freeze({ ...input.priorConfirmed }),
      candidates: Object.freeze(ranked.map((r) => Object.freeze({ ...r }))),
      crossViewAgreement: (byTaxon.get(input.priorConfirmed.taxonId) || {}).views || 0,
      providerRawConfidence: (byTaxon.get(input.priorConfirmed.taxonId) || {}).maxScore ?? null,
      farrowayContextScore: 0,
      reasonCode: 'PRIOR_CONFIRMED_KEPT',
    });
  }

  if (!ranked.length) return _emptyOut('LOW_CONFIDENCE', 'no_candidates');

  const top = ranked[0];
  const second = ranked[1] || null;
  const candidatesOut = Object.freeze(ranked.map((r) => Object.freeze({ ...r })));
  const base = {
    topCandidate: Object.freeze({ taxonId: top.taxonId, commonName: top.commonName, scientificName: top.scientificName }),
    candidates: candidatesOut,
    crossViewAgreement: top.views,
    providerRawConfidence: top.maxScore,   // the REAL provider number, never a combined score
    farrowayContextScore: 0,               // populated only by the context reranker (kept separate)
  };

  // CONFLICTING_EVIDENCE — two different taxa each backed by a strong image, and
  // neither dominates cross-view agreement. More photos of the same leaf won't help.
  if (second && top.taxonId !== second.taxonId
      && top.maxScore >= th.confirmed && second.maxScore >= th.confirmed
      && top.views === second.views) {
    return Object.freeze({ ...base, identificationState: 'CONFLICTING_EVIDENCE', reasonCode: 'strong_disagreement' });
  }

  // CONFIRMED — one strong provider result clearing confirmed+margin, OR the same
  // taxon agreeing across ≥2 useful views at provisional-or-better confidence.
  const marginOk = !second || (top.maxScore - second.maxScore) >= th.margin || top.taxonId !== second.taxonId;
  if ((top.maxScore >= th.confirmed && marginOk)
      || (top.views >= 2 && top.maxScore >= th.provisional)) {
    return Object.freeze({ ...base, identificationState: 'CONFIRMED', reasonCode: top.views >= 2 ? 'cross_view_agreement' : 'single_strong' });
  }

  if (top.maxScore >= th.provisional) {
    return Object.freeze({ ...base, identificationState: 'PROVISIONAL', reasonCode: 'plausible_below_confirmed' });
  }
  return Object.freeze({ ...base, identificationState: 'LOW_CONFIDENCE', reasonCode: 'weak_evidence' });
}

export default aggregateEvidence;
