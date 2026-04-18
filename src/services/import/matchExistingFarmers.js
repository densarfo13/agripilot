/**
 * matchExistingFarmers — decide whether each parsed row should
 * create a new farmer record, update an existing one, or be skipped.
 *
 * Match priority (hardened — identity spec §1):
 *   1. external_farmer_id (exact)         → UPDATE_EXISTING
 *   2. phone_number      (exact)         → UPDATE_EXISTING
 *   3. fuzzy full_name + region_or_state → POSSIBLE_DUPLICATE (operator resolves)
 *
 * Row statuses after matching:
 *   NEW                — no existing farmer matched; create one
 *   UPDATE_EXISTING    — confident exact-identifier match; safe-merge on import
 *   POSSIBLE_DUPLICATE — fuzzy candidate; DO NOT auto-merge
 *   DUPLICATE_IN_FILE  — handled by validator already (not overwritten)
 *   INVALID            — row was error at validation; do not import
 *
 * The existingFarmers loader is injected so tests and future API
 * callers can pass their own source without reaching into fetch code.
 */
import { fuzzyNameRegionScore, FUZZY_MATCH_THRESHOLD } from './importHardening.js';

/**
 * Build an indexed view of existing farmers once, then look up by
 * priority. Each existing record is expected to expose at least:
 *   { id, externalFarmerId?, phone_number, full_name, region_or_state }
 */
function indexFarmers(existing = []) {
  const byExternalId = new Map();
  const byPhone = new Map();
  const byNameRegion = new Map();

  for (const f of existing) {
    if (f.external_farmer_id || f.externalFarmerId) {
      byExternalId.set(String(f.external_farmer_id || f.externalFarmerId), f);
    }
    if (f.phone_number || f.phone) {
      byPhone.set(String(f.phone_number || f.phone), f);
    }
    const key = `${(f.full_name || f.fullName || '').trim().toLowerCase()}|${(f.region_or_state || f.region || '').trim().toLowerCase()}`;
    if (key !== '|') byNameRegion.set(key, f);
  }

  return { byExternalId, byPhone, byNameRegion };
}

function matchOne(row, idx, existingList) {
  const eid = row.external_farmer_id;
  if (eid && idx.byExternalId.has(eid)) {
    return { matched: idx.byExternalId.get(eid), reason: 'external_farmer_id', fuzzy: false };
  }
  const phone = row.phone_number;
  if (phone && idx.byPhone.has(phone)) {
    return { matched: idx.byPhone.get(phone), reason: 'phone_number', fuzzy: false };
  }

  // Fuzzy name+region — flag only, never auto-merge (spec §1).
  let bestScore = 0;
  let bestCandidate = null;
  for (const candidate of existingList) {
    const score = fuzzyNameRegionScore(row, candidate);
    if (score > bestScore) { bestScore = score; bestCandidate = candidate; }
  }
  if (bestCandidate && bestScore >= FUZZY_MATCH_THRESHOLD) {
    return { matched: bestCandidate, reason: 'fuzzy_name_region', fuzzy: true, score: bestScore };
  }
  return { matched: null, reason: null, fuzzy: false };
}

/**
 * Attach matching metadata to validator results.
 * @param {Array} validatorResults - { row, status, issues }
 * @param {Array} existingFarmers
 * @returns {Array} results + { importStatus, matched, matchReason }
 */
export function matchExistingFarmers(validatorResults = [], existingFarmers = []) {
  const idx = indexFarmers(existingFarmers);

  return validatorResults.map(result => {
    // Errors and in-file duplicates short-circuit
    if (result.status === 'error') {
      return { ...result, importStatus: 'INVALID', matched: null, matchReason: null };
    }
    if (result.status === 'duplicate_in_file') {
      return { ...result, importStatus: 'DUPLICATE_IN_FILE', matched: null, matchReason: null };
    }

    const { matched, reason, fuzzy, score } = matchOne(result.row, idx, existingFarmers);
    if (matched && fuzzy) {
      // Spec §1: fuzzy hits surface for operator review. Never silent merge.
      return {
        ...result,
        importStatus: 'POSSIBLE_DUPLICATE',
        matched,
        matchReason: reason,
        matchScore: score,
      };
    }
    if (matched) {
      return { ...result, importStatus: 'UPDATE_EXISTING', matched, matchReason: reason };
    }
    return { ...result, importStatus: 'NEW', matched: null, matchReason: null };
  });
}

export const _internal = { indexFarmers, matchOne };
