/**
 * previewFarmerImport — one-call orchestrator.
 *
 * parseImportFile → normalizeFarmerImportRows → validateFarmerImportRows
 *                 → matchExistingFarmers → rolled-up preview.
 *
 * Returns everything the preview UI needs: per-row status, counts, and
 * the raw rows so the operator can see what's about to happen.
 */
import { parseImportFile } from './parseImportFile.js';
import { normalizeFarmerImportRows } from './normalizeFarmerImportRows.js';
import { validateFarmerImportRows } from './validateFarmerImportRows.js';
import { matchExistingFarmers } from './matchExistingFarmers.js';

/**
 * @param {File} file
 * @param {Object} options
 * @param {Function} [options.loadExistingFarmers] - async () => Array<farmer>
 * @param {string}   [options.organizationId]
 * @returns {Promise<{ file, rows, results, counts }>}
 */
export async function previewFarmerImport(file, {
  loadExistingFarmers,
  organizationId,
} = {}) {
  const parsed = await parseImportFile(file);
  const normalized = normalizeFarmerImportRows(parsed.rows);

  // Stamp the organization so match/import downstream knows who owns
  // these rows, without the operator having to add a column every time.
  if (organizationId) {
    for (const r of normalized) {
      if (!r.organization_id) r.organization_id = organizationId;
    }
  }

  const validation = validateFarmerImportRows(normalized);

  // Existing farmers for dup/update detection. Caller may pass an async
  // loader; if not, we skip the match step (all rows look NEW). This
  // keeps the preview flow usable in fully offline or mocked scenarios.
  let existing = [];
  if (typeof loadExistingFarmers === 'function') {
    try { existing = await loadExistingFarmers(); } catch { existing = []; }
  }
  const matched = matchExistingFarmers(validation.results, existing);

  // Roll up counts the UI renders on the validation-summary screen
  const counts = {
    total: matched.length,
    newCount: matched.filter(r => r.importStatus === 'NEW').length,
    updateCount: matched.filter(r => r.importStatus === 'UPDATE_EXISTING').length,
    duplicateInFile: matched.filter(r => r.importStatus === 'DUPLICATE_IN_FILE').length,
    invalid: matched.filter(r => r.importStatus === 'INVALID').length,
    warnings: matched.filter(r => r.status === 'warning').length,
  };

  return {
    file: {
      name: parsed.fileName,
      size: parsed.fileSize,
      format: parsed.format,
    },
    headers: parsed.headers,
    results: matched,   // [{ row, status, issues, importStatus, matched, matchReason }]
    counts,
  };
}
