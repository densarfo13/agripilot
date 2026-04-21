/**
 * issueAssignment.js — deterministic officer-routing rules.
 *
 *   pickAssignment({
 *     issue,        // { crop, location, countryCode, stateCode, program, ... }
 *     registry,     // [{ id, name?, regions[], crops[], programs[]? }]
 *     workload,     // { [officerId]: activeIssueCount }
 *   }) → {
 *     officerId:  string | null,
 *     reasonTier: 'region_and_crop' | 'region_only'
 *               | 'program_match'   | 'admin_queue',
 *     reasons:    Array<{ rule, detail }>,
 *   }
 *
 * Priority (spec §6):
 *   1. same region + crop familiarity   (strongest — region tier)
 *   2. same region only
 *   3. same program officer
 *   4. admin queue fallback (officerId === null)
 *
 * Within a tier, ties break by lowest active workload and then
 * by stable registry position. A null officerId means "route to
 * admin queue" — the caller keeps status: 'open'.
 *
 * Pure. No side effects.
 */

function normalize(s) { return String(s || '').trim(); }
function normalizeLower(s) { return normalize(s).toLowerCase(); }

function asLocationKeys(issue) {
  if (!issue) return [];
  return [issue.stateCode, issue.state, issue.location,
          issue.countryCode, issue.country]
    .filter(Boolean)
    .map(normalize);
}

function officerCoversRegion(officer, issue) {
  const regions = Array.isArray(officer.regions) ? officer.regions : [];
  if (regions.length === 0) return false;
  const locKeys = asLocationKeys(issue);
  if (locKeys.length === 0) return false;
  return regions.some((r) => locKeys.some((l) => l.includes(normalize(r))));
}

function officerCoversCrop(officer, issue) {
  const crops = Array.isArray(officer.crops) ? officer.crops : [];
  if (crops.length === 0 || !issue || !issue.crop) return false;
  const cropKey = normalizeLower(issue.crop);
  return crops.some((c) => normalizeLower(c) === cropKey);
}

function officerCoversProgram(officer, issue) {
  const programs = Array.isArray(officer.programs) ? officer.programs : [];
  if (programs.length === 0 || !issue || !issue.program) return false;
  const progKey = normalize(issue.program);
  return programs.some((p) => normalize(p) === progKey);
}

function pickLowestWorkload(candidates, workload = {}) {
  if (candidates.length === 0) return null;
  // Stable sort by (activeCount asc, then original index).
  const indexed = candidates.map((o, idx) => ({
    o, idx, active: Number(workload[o.id]) || 0,
  }));
  indexed.sort((a, b) => (a.active - b.active) || (a.idx - b.idx));
  return indexed[0].o;
}

/**
 * pickAssignment — walk the tiers in priority order and pick the
 * best candidate in the first tier that has any matches.
 */
export function pickAssignment({
  issue = {},
  registry = [],
  workload = {},
} = {}) {
  if (!issue || !Array.isArray(registry) || registry.length === 0) {
    return Object.freeze({
      officerId: null,
      reasonTier: 'admin_queue',
      reasons: Object.freeze([Object.freeze({
        rule: 'no_registry',
        detail: 'No officer registry configured',
      })]),
    });
  }

  const regionAndCrop = [];
  const regionOnly    = [];
  const programOnly   = [];

  for (const officer of registry) {
    if (!officer || !officer.id) continue;
    const coversRegion  = officerCoversRegion(officer, issue);
    const coversCrop    = officerCoversCrop(officer, issue);
    const coversProgram = officerCoversProgram(officer, issue);
    if (coversRegion && coversCrop)       regionAndCrop.push(officer);
    else if (coversRegion)                regionOnly.push(officer);
    else if (coversProgram)               programOnly.push(officer);
  }

  // Tier 1: region + crop
  if (regionAndCrop.length > 0) {
    const picked = pickLowestWorkload(regionAndCrop, workload);
    return Object.freeze({
      officerId: picked.id,
      reasonTier: 'region_and_crop',
      reasons: Object.freeze([
        Object.freeze({ rule: 'region_match', detail: 'Officer covers this region' }),
        Object.freeze({ rule: 'crop_match',   detail: 'Officer covers this crop' }),
        Object.freeze({ rule: 'workload_balance',
          detail: `Chose officer with ${Number(workload[picked.id]) || 0} active issue(s)` }),
      ]),
    });
  }

  // Tier 2: region only
  if (regionOnly.length > 0) {
    const picked = pickLowestWorkload(regionOnly, workload);
    return Object.freeze({
      officerId: picked.id,
      reasonTier: 'region_only',
      reasons: Object.freeze([
        Object.freeze({ rule: 'region_match', detail: 'Officer covers this region' }),
        Object.freeze({ rule: 'workload_balance',
          detail: `Chose officer with ${Number(workload[picked.id]) || 0} active issue(s)` }),
      ]),
    });
  }

  // Tier 3: program only
  if (programOnly.length > 0) {
    const picked = pickLowestWorkload(programOnly, workload);
    return Object.freeze({
      officerId: picked.id,
      reasonTier: 'program_match',
      reasons: Object.freeze([
        Object.freeze({ rule: 'program_match', detail: 'Officer covers this program' }),
        Object.freeze({ rule: 'workload_balance',
          detail: `Chose officer with ${Number(workload[picked.id]) || 0} active issue(s)` }),
      ]),
    });
  }

  // Tier 4: admin queue
  return Object.freeze({
    officerId: null,
    reasonTier: 'admin_queue',
    reasons: Object.freeze([Object.freeze({
      rule: 'no_match',
      detail: 'No officer covers this region, crop, or program',
    })]),
  });
}

export const _internal = Object.freeze({
  officerCoversRegion, officerCoversCrop, officerCoversProgram,
  pickLowestWorkload,
});
