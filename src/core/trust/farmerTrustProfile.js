/**
 * farmerTrustProfile.js — INTERNAL-ONLY farmer trust signal
 * (spec §5; extended for v2 §4).
 *
 *   import { computeFarmerTrustProfile }
 *     from 'src/core/trust/farmerTrustProfile.js';
 *
 * What it is — and the hard rule
 * ──────────────────────────────
 *   A soft trust score derived from a farmer's OWN activity:
 *   consistent farm activity, scans, task completion, produce
 *   listings, journal history, location consistency, and (v2)
 *   continuity signals — crop continuity, scan consistency,
 *   harvest consistency, task-completion reliability.
 *
 *   Used INTERNALLY ONLY — to weight marketplace ordering or
 *   prioritise review. NEVER shown to the farmer as a number,
 *   NEVER a credit score, NEVER a produce-quality guarantee. The
 *   result carries `internalOnly: true`.
 *
 * v2 addition — trustConfidenceScore
 *   The trust `score` answers "how much signal is there?". The new
 *   `trustConfidenceScore` answers a different question: "how much
 *   DATA backs that score?" — a high trust score from 2 events is
 *   not as reliable as the same score from 200. Callers should
 *   discount a high score when trustConfidenceScore is low.
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O. SSR-safe. Coordinates are read
 *     for consistency only — never stored or returned.
 */

export const TRUST_TIER = Object.freeze({
  NEW:         'new',
  BUILDING:    'building',
  ESTABLISHED: 'established',
});

/** Coerce to a non-negative finite number. */
function _n(v) {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
}

/** Clamp to a 0..1 ratio. */
function _ratio(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * Location consistency in [0,1] — 1.0 when activity clusters in one
 * place, lower when it scatters. Fewer than 2 samples → 1 (no
 * penalty for thin data). Coordinates are used here and discarded.
 */
function _locationConsistency(samples) {
  const list = Array.isArray(samples)
    ? samples.filter((s) => s && Number.isFinite(s.lat) && Number.isFinite(s.lng))
    : [];
  if (list.length < 2) return 1;
  let maxSpread = 0;
  for (let i = 1; i < list.length; i++) {
    const d = Math.abs(list[i].lat - list[0].lat)
            + Math.abs(list[i].lng - list[0].lng);
    if (d > maxSpread) maxSpread = d;
  }
  return Math.max(0, 1 - Math.min(1, maxSpread));
}

/**
 * Compute the internal farmer trust profile.
 *
 * @param {object} signals
 * @param {number} [signals.scansCompleted]
 * @param {number} [signals.tasksCompleted]
 * @param {number} [signals.produceListings]
 * @param {number} [signals.journalEntries]
 * @param {number} [signals.distinctActiveDays]
 * @param {Array<{lat:number,lng:number}>} [signals.locationSamples]
 * @param {number} [signals.cropContinuity]   0..1 — same crop tracked over time
 * @param {number} [signals.scanConsistency]  0..1 — regular scanning cadence
 * @param {number} [signals.harvestConsistency] 0..1 — harvests reported as expected
 * @param {number} [signals.taskReliability]  0..1 — tasks completed vs assigned
 * @returns {object}
 */
export function computeFarmerTrustProfile(signals) {
  try {
    const s = (signals && typeof signals === 'object') ? signals : {};
    const scans      = _n(s.scansCompleted);
    const tasks      = _n(s.tasksCompleted);
    const listings   = _n(s.produceListings);
    const journal    = _n(s.journalEntries);
    const activeDays = _n(s.distinctActiveDays);
    const locSamples = Array.isArray(s.locationSamples)
      ? s.locationSamples.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      : [];
    const locConsistency = _locationConsistency(s.locationSamples);

    // v2 continuity ratios — averaged into one "continuity" component.
    const cropContinuity    = _ratio(s.cropContinuity);
    const scanConsistency   = _ratio(s.scanConsistency);
    const harvestConsistency = _ratio(s.harvestConsistency);
    const taskReliability   = _ratio(s.taskReliability);
    const continuityAvg = (cropContinuity + scanConsistency
      + harvestConsistency + taskReliability) / 4;

    // Each component is capped so no single signal dominates — a
    // farmer cannot "grind" one action to look trusted. Caps sum
    // to 100.
    const cap = (v, max) => Math.min(max, v);
    const components = Object.freeze({
      activity:   cap(Math.round(activeDays * 4), 20),
      scans:      cap(Math.round(scans * 3), 15),
      tasks:      cap(Math.round(tasks * 3), 15),
      listings:   cap(Math.round(listings * 3), 10),
      journal:    cap(Math.round(journal * 2), 5),
      // Location points need real evidence (≥2 samples).
      location:   locSamples.length >= 2 ? Math.round(locConsistency * 10) : 0,
      continuity: Math.round(continuityAvg * 25),
    });

    let score = 0;
    for (const k of Object.keys(components)) score += components[k];
    score = Math.max(0, Math.min(100, Math.round(score)));

    const tier = score >= 60
      ? TRUST_TIER.ESTABLISHED
      : score >= 25
        ? TRUST_TIER.BUILDING
        : TRUST_TIER.NEW;

    // trustConfidenceScore — how much DATA backs the score. More
    // recorded activity → more reliable score. Capped at 100.
    const dataPoints = scans + tasks + listings + journal + activeDays;
    const trustConfidenceScore = Math.max(0, Math.min(100, Math.round(dataPoints * 4)));

    return Object.freeze({
      score,
      tier,
      components,
      trustConfidenceScore,
      locationConsistent: locConsistency >= 0.7,
      internalOnly:       true,
    });
  } catch {
    return Object.freeze({
      score:                0,
      tier:                 TRUST_TIER.NEW,
      components:           Object.freeze({}),
      trustConfidenceScore: 0,
      locationConsistent:   true,
      internalOnly:         true,
    });
  }
}

const _module = { TRUST_TIER, computeFarmerTrustProfile };
export default _module;
