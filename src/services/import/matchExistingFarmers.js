/**
 * matchExistingFarmers — decide whether each parsed row should
 * create a new farmer record, update an existing one, or be skipped.
 *
 * Match priority (spec §7):
 *   1. external_farmer_id (if provided and matched)
 *   2. phone_number
 *   3. fallback heuristic: full_name + region_or_state
 *
 * Row statuses after matching:
 *   NEW              — no existing farmer matched; create one
 *   UPDATE_EXISTING  — matched a farmer; safe-merge on import
 *   DUPLICATE_IN_FILE — handled by validator already (not overwritten)
 *   INVALID          — row was error at validation; do not import
 *
 * The existingFarmers loader is injected so tests and future API
 * callers can pass their own source without reaching into fetch code.
 */

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

function matchOne(row, idx) {
  const eid = row.external_farmer_id;
  if (eid && idx.byExternalId.has(eid)) {
    return { matched: idx.byExternalId.get(eid), reason: 'external_farmer_id' };
  }
  const phone = row.phone_number;
  if (phone && idx.byPhone.has(phone)) {
    return { matched: idx.byPhone.get(phone), reason: 'phone_number' };
  }
  const key = `${(row.full_name || '').trim().toLowerCase()}|${(row.region_or_state || '').trim().toLowerCase()}`;
  if (key !== '|' && idx.byNameRegion.has(key)) {
    return { matched: idx.byNameRegion.get(key), reason: 'name_region' };
  }
  return { matched: null, reason: null };
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

    const { matched, reason } = matchOne(result.row, idx);
    if (matched) {
      return { ...result, importStatus: 'UPDATE_EXISTING', matched, matchReason: reason };
    }
    return { ...result, importStatus: 'NEW', matched: null, matchReason: null };
  });
}

export const _internal = { indexFarmers, matchOne };
