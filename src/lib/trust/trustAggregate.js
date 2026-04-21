/**
 * trustAggregate.js — org-level rollup of farmer trust profiles.
 *
 * Pure + rules-based. Reads only the inputs the caller passes,
 * never hits the network or localStorage directly. The NGO
 * analytics layer wires this into `getProgramSummary` so
 * dashboards, CSV exports, and printable reports share one view.
 *
 *   aggregateTrustProfiles({
 *     farms,         // Farm[] — filtered already, e.g. for one program
 *     events,        // farroway.farmEvents
 *     completions,   // legacy completions store
 *     now,           // Date | ms
 *     activityWindowDays, // default 7
 *   }) → {
 *     total:              number,
 *     byLevel:            { high, medium, low },
 *     pctHighCompleteness:         0..100,
 *     pctMissingLocation:          0..100,
 *     pctMissingCrop:              0..100,
 *     pctInactiveRecently:         0..100,
 *     pctOnboardingIncomplete:     0..100,
 *     pctUnlinkedToOrg:            0..100,
 *     avgScore:           number,     // rounded
 *     profiles:           TrustProfile[], // one per farm, in input order
 *   }
 *
 * All percentages are integers 0..100. `total === 0` → every
 * percentage is 0 and `byLevel` is all zeros (never NaN).
 */

import { getFarmerTrustProfile, TRUST_MAX } from './trustProfile.js';

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

/**
 * aggregateTrustProfiles — walk every farm once, build its profile,
 * and accumulate org-level counts.
 *
 * Deliberately does NOT re-read any store here — the caller passes
 * in already-scoped arrays (e.g. farms filtered to a single program).
 * This keeps the function easy to test and easy to run server-side
 * against a Prisma result set later.
 */
export function aggregateTrustProfiles({
  farms = [],
  events = [],
  completions = [],
  now = null,
  activityWindowDays = 7,
} = {}) {
  const list = Array.isArray(farms) ? farms : [];
  const total = list.length;

  const byLevel = { high: 0, medium: 0, low: 0 };
  let missingLocation       = 0;
  let missingCrop           = 0;
  let inactiveRecently      = 0;
  let onboardingIncomplete  = 0;
  let unlinkedToOrg         = 0;
  let scoreSum              = 0;

  const profiles = [];

  for (const farm of list) {
    if (!farm) continue;
    const profile = getFarmerTrustProfile({
      farm, events, completions, now, activityWindowDays,
    });
    profiles.push(profile);

    byLevel[profile.level] = (byLevel[profile.level] || 0) + 1;
    scoreSum += profile.score || 0;

    const s = profile.signals;
    if (!s.locationCaptured)    missingLocation      += 1;
    if (!s.cropSelected)        missingCrop          += 1;
    if (!s.recentActivity)      inactiveRecently     += 1;
    if (!s.onboardingComplete)  onboardingIncomplete += 1;
    if (!s.organizationLinked)  unlinkedToOrg        += 1;
  }

  const avgScore = total > 0 ? Math.round(scoreSum / total) : 0;

  return Object.freeze({
    total,
    byLevel:                 Object.freeze({ ...byLevel }),
    pctHighCompleteness:     pct(byLevel.high, total),
    pctMediumCompleteness:   pct(byLevel.medium, total),
    pctLowCompleteness:      pct(byLevel.low, total),
    pctMissingLocation:      pct(missingLocation,      total),
    pctMissingCrop:          pct(missingCrop,          total),
    pctInactiveRecently:     pct(inactiveRecently,     total),
    pctOnboardingIncomplete: pct(onboardingIncomplete, total),
    pctUnlinkedToOrg:        pct(unlinkedToOrg,        total),
    avgScore,
    maxScore:                TRUST_MAX,
    profiles:                Object.freeze(profiles),
  });
}

export const _internal = Object.freeze({ pct });
