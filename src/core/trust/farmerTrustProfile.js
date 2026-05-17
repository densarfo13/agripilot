/**
 * farmerTrustProfile.js — INTERNAL-ONLY farmer trust signal (spec §5).
 *
 *   import { computeFarmerTrustProfile }
 *     from 'src/core/trust/farmerTrustProfile.js';
 *
 * What it is — and the hard rule
 * ──────────────────────────────
 *   A soft trust score derived from a farmer's OWN activity:
 *   consistent farm activity, scans completed, task completion,
 *   produce listings, journal history, location consistency.
 *
 *   This score is used INTERNALLY ONLY — e.g. to weight marketplace
 *   ordering or to prioritise review. It is NEVER shown to the
 *   farmer as a number, NEVER presented as a credit score, and
 *   NEVER used as a guarantee about produce quality. The returned
 *   object carries `internalOnly: true` as a reminder to callers.
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O. SSR-safe.
 *   • Location samples are read for consistency only — coordinates
 *     are not stored or returned.
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
  // ~1 degree of spread (~110 km) reads as fully inconsistent.
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
 * @returns {{ score:number, tier:string, components:object,
 *             locationConsistent:boolean, internalOnly:true }}
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

    // Each component is capped so no single signal dominates the
    // score — a farmer cannot "grind" one action to look trusted.
    const cap = (v, max) => Math.min(max, v);
    const components = Object.freeze({
      activity: cap(Math.round(activeDays * 4), 25), // consistent presence
      scans:    cap(Math.round(scans * 3), 20),
      tasks:    cap(Math.round(tasks * 3), 20),
      listings: cap(Math.round(listings * 3), 15),
      journal:  cap(Math.round(journal * 2), 10),
      // Location points are only awarded with real evidence
      // (≥2 samples) — a farmer with no location data gets 0,
      // not a free 10.
      location: locSamples.length >= 2 ? Math.round(locConsistency * 10) : 0,
    });

    let score = 0;
    for (const k of Object.keys(components)) score += components[k];
    score = Math.max(0, Math.min(100, Math.round(score)));

    const tier = score >= 60
      ? TRUST_TIER.ESTABLISHED
      : score >= 25
        ? TRUST_TIER.BUILDING
        : TRUST_TIER.NEW;

    return Object.freeze({
      score,
      tier,
      components,
      locationConsistent: locConsistency >= 0.7,
      internalOnly:       true,
    });
  } catch {
    return Object.freeze({
      score:              0,
      tier:               TRUST_TIER.NEW,
      components:         Object.freeze({}),
      locationConsistent: true,
      internalOnly:       true,
    });
  }
}

const _module = { TRUST_TIER, computeFarmerTrustProfile };
export default _module;
