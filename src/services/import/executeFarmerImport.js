/**
 * executeFarmerImport — persist the operator-confirmed rows.
 *
 * V2 ships a client-side orchestrator that:
 *   1. filters out invalid / in-file-duplicate rows
 *   2. creates a batch record (createImportBatch) for traceability
 *   3. calls the save API once per row (per-row so partial progress
 *      survives individual failures)
 *   4. applies safe-merge semantics for existing farmers:
 *        - never overwrite a present existing value with a blank
 *        - only set fields the partner sent us
 *   5. returns a result summary keyed by the batch id
 *
 * The save call is injected via `options.saveFarmer` so the same
 * orchestrator serves both the manual file-upload path and a future
 * automated API-ingestion path without duplication.
 */
import { createImportBatch, updateImportBatch } from './importBatch.js';
import { triggerImportedFarmerOnboarding } from './onboardingImportedFarmers.js';
import { safeTrackEvent } from '../../lib/analytics.js';

const IMPORT_MODES = {
  CREATE_ONLY: 'create_only',
  CREATE_AND_UPDATE: 'create_and_update',
};

/**
 * Build the minimal safe payload for a new farmer record. Only fields
 * we actually received and validated land on the server.
 */
function payloadForCreate(row, { organizationId, batchId, consentState }) {
  return {
    full_name: row.full_name,
    phone_number: row.phone_number,
    country: row.country,
    region_or_state: row.region_or_state,
    district: row.district || undefined,
    village: row.village || undefined,
    preferred_language: row.preferred_language || undefined,
    crop: row.crop || undefined,
    land_size: row.land_size || undefined,
    gender: row.gender || undefined,
    age_range: row.age_range || undefined,
    external_farmer_id: row.external_farmer_id || undefined,
    organization_id: row.organization_id || organizationId || undefined,
    import_batch_id: batchId,
    consent_state: consentState || 'imported_pending_activation',
    source: 'partner_import',
  };
}

/**
 * Safe-merge payload — never blank out an existing value. Partners
 * sometimes re-send partial rows (e.g. only crop + land_size updates).
 */
function payloadForUpdate(row, existing, { batchId }) {
  const patch = {};
  const fields = [
    'full_name', 'phone_number', 'country', 'region_or_state', 'district',
    'village', 'preferred_language', 'crop', 'land_size', 'gender',
    'age_range', 'external_farmer_id',
  ];
  for (const f of fields) {
    const incoming = row[f];
    if (incoming && String(incoming).trim() !== '') {
      patch[f] = incoming;
    }
  }
  patch.import_batch_id = batchId;
  patch.last_partner_update_at = new Date().toISOString();
  return { id: existing.id, patch };
}

// ─── Public API ────────────────────────────────────────────

/**
 * @param {Array}  previewResults - from previewFarmerImport().results
 * @param {Object} options
 * @param {string} options.mode            - 'create_only' | 'create_and_update' (default)
 * @param {string} options.organizationId
 * @param {string} options.uploadedBy
 * @param {string} options.fileName
 * @param {string} [options.consentState]  - default 'imported_pending_activation'
 * @param {Function} options.saveFarmer    - async ({ mode, payload }) => { ok, id, error? }
 * @param {Function} [options.sendOnboarding] - async (farmerId, payload) => void (optional partner-policy gated)
 * @returns {Promise<{ batch, summary, errors, perRow }>}
 */
export async function executeFarmerImport(previewResults = [], {
  mode = IMPORT_MODES.CREATE_AND_UPDATE,
  organizationId,
  uploadedBy,
  fileName,
  consentState = 'imported_pending_activation',
  saveFarmer,
  sendOnboarding,
} = {}) {
  if (typeof saveFarmer !== 'function') {
    throw new Error('import.error.missingSaver');
  }

  const batch = createImportBatch({
    organizationId, uploadedBy, fileName, totalRows: previewResults.length,
  });
  safeTrackEvent('import.batch_started', { batchId: batch.id, total: previewResults.length, mode });

  const summary = { created: 0, updated: 0, skipped: 0, invalid: 0, onboardingSent: 0 };
  const errors = [];
  const perRow = [];

  for (const result of previewResults) {
    const row = result.row;
    const rowNumber = row._rowNumber;

    // Skip invalid and in-file dupes outright
    if (result.importStatus === 'INVALID') {
      summary.invalid++;
      perRow.push({ rowNumber, action: 'skipped', reason: 'invalid' });
      continue;
    }
    if (result.importStatus === 'DUPLICATE_IN_FILE') {
      summary.skipped++;
      perRow.push({ rowNumber, action: 'skipped', reason: 'duplicate_in_file' });
      continue;
    }

    // CREATE_ONLY mode bypasses updates
    if (result.importStatus === 'UPDATE_EXISTING' && mode === IMPORT_MODES.CREATE_ONLY) {
      summary.skipped++;
      perRow.push({ rowNumber, action: 'skipped', reason: 'exists_and_mode_create_only' });
      continue;
    }

    try {
      if (result.importStatus === 'NEW') {
        const payload = payloadForCreate(row, { organizationId, batchId: batch.id, consentState });
        const saveResult = await saveFarmer({ mode: 'create', payload });
        if (!saveResult?.ok) throw new Error(saveResult?.error || 'create_failed');
        summary.created++;
        perRow.push({ rowNumber, action: 'created', farmerId: saveResult.id });

        if (typeof sendOnboarding === 'function') {
          try {
            const sent = await triggerImportedFarmerOnboarding({
              farmerId: saveResult.id, payload, sendOnboarding,
            });
            if (sent) summary.onboardingSent++;
          } catch (err) {
            // Onboarding failure never rolls back the create
            errors.push({ rowNumber, stage: 'onboarding', message: err.message });
          }
        }
      } else if (result.importStatus === 'UPDATE_EXISTING') {
        const { id, patch } = payloadForUpdate(row, result.matched, { batchId: batch.id });
        const saveResult = await saveFarmer({ mode: 'update', payload: { id, ...patch } });
        if (!saveResult?.ok) throw new Error(saveResult?.error || 'update_failed');
        summary.updated++;
        perRow.push({ rowNumber, action: 'updated', farmerId: id });
      }
    } catch (err) {
      summary.invalid++;
      errors.push({ rowNumber, stage: result.importStatus, message: err.message });
      perRow.push({ rowNumber, action: 'failed', reason: err.message });
    }
  }

  const finalBatch = updateImportBatch(batch.id, {
    status: 'completed',
    createdCount: summary.created,
    updatedCount: summary.updated,
    skippedCount: summary.skipped,
    invalidCount: summary.invalid,
    completedAt: new Date().toISOString(),
  });
  safeTrackEvent('import.batch_completed', { batchId: batch.id, ...summary });

  return { batch: finalBatch, summary, errors, perRow };
}

export { IMPORT_MODES };
