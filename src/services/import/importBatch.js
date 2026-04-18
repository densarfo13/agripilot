/**
 * importBatch — create + track batch records for traceability (spec §12).
 *
 * V2 stores batches in localStorage under a ring buffer so the Ops team
 * can reconcile support requests without a server trip. When the
 * server-side batch store ships, `createImportBatch` and
 * `updateImportBatch` become thin API wrappers — the call sites don't
 * change.
 */

const STORAGE_KEY = 'farroway:import_batches';
const MAX_BATCHES = 50;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeAll(batches) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(batches.slice(-MAX_BATCHES)));
  } catch { /* quota — drop silently */ }
}

function randomId() {
  // 10 base36 chars of Math.random + timestamp. Not cryptographic, good
  // enough to spot a batch in logs.
  return `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a new batch. Returns the full record.
 */
export function createImportBatch({
  organizationId = '',
  uploadedBy = '',
  fileName = '',
  totalRows = 0,
} = {}) {
  const batch = {
    id: randomId(),
    organizationId,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    fileName,
    totalRows,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    invalidCount: 0,
    status: 'running',
    completedAt: null,
  };
  const all = readAll();
  all.push(batch);
  writeAll(all);
  return batch;
}

/**
 * Patch a batch in place. Returns the updated batch (or null if missing).
 */
export function updateImportBatch(batchId, patch) {
  const all = readAll();
  const idx = all.findIndex(b => b.id === batchId);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  writeAll(all);
  return all[idx];
}

export function listImportBatches() {
  // Newest first
  return [...readAll()].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

export function getImportBatch(id) {
  return readAll().find(b => b.id === id) || null;
}

export function clearImportBatches() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/**
 * Attach rollback metadata to a batch (created ids + per-update
 * before/patch pairs). Called by executeFarmerImport at the end of a
 * run so rollbackLastImportBatch can invert the work later.
 */
export function recordBatchAction(batchId, { createdFarmerIds = [], updatedFarmers = [] } = {}) {
  return updateImportBatch(batchId, {
    created_farmer_ids: createdFarmerIds,
    updated_farmers: updatedFarmers,
  });
}

/**
 * Roll back the most recent batch (spec §6, V2 scope = last batch only).
 *
 * Behaviour:
 *   - delete every farmer in created_farmer_ids via deleteFarmer()
 *   - restore every updated farmer to its saved `before` snapshot via
 *     updateFarmer()
 *
 * Callers inject `deleteFarmer` and `updateFarmer` so the rollback works
 * across transport choices (direct API, queue, mock).
 *
 * Returns { batchId, deleted, reverted, errors, status }.
 */
export async function rollbackLastImportBatch({ deleteFarmer, updateFarmer } = {}) {
  const all = readAll();
  const sorted = [...all].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const last = sorted.find(b => b.status === 'completed' && !b.rolledBackAt);

  if (!last) {
    return { batchId: null, deleted: 0, reverted: 0, errors: [], status: 'no_batch_to_rollback' };
  }
  if (typeof deleteFarmer !== 'function' || typeof updateFarmer !== 'function') {
    return { batchId: last.id, deleted: 0, reverted: 0, errors: ['missing_adapters'], status: 'adapters_missing' };
  }

  const errors = [];
  let deleted = 0;
  let reverted = 0;

  for (const id of last.created_farmer_ids || []) {
    try { await deleteFarmer(id); deleted++; }
    catch (err) { errors.push({ id, stage: 'delete', message: err?.message }); }
  }

  for (const entry of last.updated_farmers || []) {
    try { await updateFarmer(entry.id, entry.before); reverted++; }
    catch (err) { errors.push({ id: entry.id, stage: 'revert', message: err?.message }); }
  }

  updateImportBatch(last.id, {
    rolledBackAt: new Date().toISOString(),
    rollbackDeleted: deleted,
    rollbackReverted: reverted,
    rollbackErrors: errors,
    status: 'rolled_back',
  });

  return { batchId: last.id, deleted, reverted, errors, status: 'completed' };
}
