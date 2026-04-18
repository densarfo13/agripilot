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
import { createImportBatch, updateImportBatch, recordBatchAction } from './importBatch.js';
import { triggerImportedFarmerOnboarding } from './onboardingImportedFarmers.js';
import {
  buildSafeUpdatePayload,
  deriveFarmerState,
  resolveCropForImport,
  assertNoSilentMerge,
  assertFarmerStateValid,
} from './importHardening.js';
import { resolveRegionProfile } from '../../engine/regionProfiles.js';
import { safeTrackEvent } from '../../lib/analytics.js';

const IMPORT_MODES = {
  CREATE_ONLY: 'create_only',
  CREATE_AND_UPDATE: 'create_and_update',
};

/**
 * Build the minimal safe payload for a new farmer record. Only fields
 * we actually received and validated land on the server. Also stamps:
 *   - import_confidence
 *   - farmer_state
 *   - crop_needs_confirmation (when region-suggested)
 */
function payloadForCreate(row, { organizationId, batchId, consentState, confidence }) {
  const regionProfile = resolveRegionProfile(row.country);
  const { crop, needsConfirmation } = resolveCropForImport({
    incomingCrop: row.crop, regionId: regionProfile?.id,
  });
  const farmerState = deriveFarmerState({
    consentState: consentState || 'imported_pending_activation',
    hasCrop: !!crop,
  });
  assertFarmerStateValid(farmerState);

  return {
    full_name: row.full_name,
    phone_number: row.phone_number,
    country: row.country,
    region_or_state: row.region_or_state,
    district: row.district || undefined,
    village: row.village || undefined,
    preferred_language: row.preferred_language || undefined,
    crop: crop || undefined,
    crop_needs_confirmation: needsConfirmation || undefined,
    land_size: row.land_size || undefined,
    gender: row.gender || undefined,
    age_range: row.age_range || undefined,
    external_farmer_id: row.external_farmer_id || undefined,
    organization_id: row.organization_id || organizationId || undefined,
    import_batch_id: batchId,
    import_confidence: confidence || undefined,
    region_profile_id: regionProfile?.id || undefined,
    consent_state: consentState || 'imported_pending_activation',
    farmer_state: farmerState,
    allow_sms: true, // partner may override later via consent capture
    source: 'partner_import',
  };
}

/**
 * Safe-merge payload — never blank out an existing value, never silently
 * overwrite a protected field (phone / region / country / crop). Any
 * collision becomes a `conflict` in the per-row result so the operator
 * can resolve it manually.
 */
function payloadForUpdate(row, existing, { batchId, confidence }) {
  const { patch, conflicts } = buildSafeUpdatePayload(row, existing);
  assertNoSilentMerge(conflicts);
  patch.import_batch_id = batchId;
  patch.last_partner_update_at = new Date().toISOString();
  if (confidence) patch.import_confidence = confidence;
  return { id: existing.id, patch, conflicts };
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

  const summary = {
    created: 0, updated: 0, skipped: 0, invalid: 0,
    onboardingSent: 0, possibleDuplicate: 0, conflictsDetected: 0,
  };
  const errors = [];
  const perRow = [];
  // Rollback trackers — kept on the batch record so rollbackLastImportBatch
  // can invert the work later without needing to re-parse the source file.
  const createdFarmerIds = [];
  const updatedFarmers = [];

  for (const result of previewResults) {
    const row = result.row;
    const rowNumber = row._rowNumber;
    const confidence = result.confidence || null;

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
    // Never auto-merge a fuzzy candidate (spec §1) — operator decides.
    if (result.importStatus === 'POSSIBLE_DUPLICATE') {
      summary.possibleDuplicate++;
      summary.skipped++;
      perRow.push({
        rowNumber, action: 'skipped', reason: 'possible_duplicate',
        matchScore: result.matchScore, matchedId: result.matched?.id,
      });
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
        const payload = payloadForCreate(row, {
          organizationId, batchId: batch.id, consentState, confidence,
        });
        const saveResult = await saveFarmer({ mode: 'create', payload });
        if (!saveResult?.ok) throw new Error(saveResult?.error || 'create_failed');
        summary.created++;
        createdFarmerIds.push(saveResult.id);
        perRow.push({ rowNumber, action: 'created', farmerId: saveResult.id, confidence });

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
        const { id, patch, conflicts } = payloadForUpdate(row, result.matched, {
          batchId: batch.id, confidence,
        });
        if (conflicts.length > 0) {
          summary.conflictsDetected += conflicts.length;
          errors.push({ rowNumber, stage: 'conflict', message: 'field_conflict', conflicts });
        }
        // Capture the pre-update snapshot so rollback can invert the patch.
        const before = {};
        for (const f of Object.keys(patch)) {
          before[f] = result.matched?.[f] ?? null;
        }
        const saveResult = await saveFarmer({ mode: 'update', payload: { id, ...patch } });
        if (!saveResult?.ok) throw new Error(saveResult?.error || 'update_failed');
        summary.updated++;
        updatedFarmers.push({ id, before, patch });
        perRow.push({ rowNumber, action: 'updated', farmerId: id, confidence,
          conflicts: conflicts.length ? conflicts : undefined });
      }
    } catch (err) {
      summary.invalid++;
      errors.push({ rowNumber, stage: result.importStatus, message: err.message });
      perRow.push({ rowNumber, action: 'failed', reason: err.message });
    }
  }

  // Stamp rollback data on the batch record
  recordBatchAction(batch.id, { createdFarmerIds, updatedFarmers });

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
