/**
 * farmService — local-first write service for farm data.
 *
 * Pattern: write to local store immediately → update UI → sync to server in background.
 * On failure: queue for retry via syncCoordinator.
 *
 * Covers: profile saves, harvest records, farm costs.
 * Consumed by ProfileContext and page-level components.
 */
import {
  saveFarmProfile,
  createHarvestRecord,
  updateHarvestRecord,
  createFarmCost,
  updateFarmCost,
} from '../lib/api.js';
import { saveProfileDraft, getProfileDraft } from '../lib/offlineDb.js';
import { enqueue } from '../utils/offlineQueue.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { log } from '../lib/logger.js';
import { getIdempotencyKey, consumeIdempotencyKey } from '../lib/idempotency.js';

// ─── In-memory cache for recent writes (avoids stale reads after local-first save) ───
const _recentWrites = new Map();
const WRITE_TTL = 30_000; // 30s — enough time for sync to complete

function cacheWrite(key, data) {
  _recentWrites.set(key, { data, ts: Date.now() });
  // Auto-evict after TTL
  setTimeout(() => _recentWrites.delete(key), WRITE_TTL);
}

export function getRecentWrite(key) {
  const entry = _recentWrites.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > WRITE_TTL) {
    _recentWrites.delete(key);
    return null;
  }
  return entry.data;
}

// ─── 1. PROFILE SAVE (local-first) ──────────────────────────
/**
 * Save farm profile: write locally first, then sync.
 *
 * @param {Object} payload - Profile fields to save
 * @param {Object} opts
 * @param {boolean} opts.isOnline
 * @returns {Promise<{profile: Object, offline: boolean, error: string|null}>}
 */
export async function saveProfileLocalFirst(payload, { isOnline }) {
  // Stamp with client-side timestamp for conflict ordering
  payload.clientUpdatedAt = new Date().toISOString();

  // 1. Write to IndexedDB immediately
  await saveProfileDraft(payload);
  cacheWrite('profile', payload);
  log('farm', 'profile_save_started', { mode: isOnline ? 'online' : 'offline' });

  const profileKey = getIdempotencyKey('profile', payload.id || 'draft');

  // 2. If online, sync to server in background
  if (isOnline) {
    try {
      const data = await saveFarmProfile(payload);
      const saved = data.profile || null;
      if (saved) {
        await saveProfileDraft(saved); // overwrite draft with server-confirmed data
        cacheWrite('profile', saved);
      }
      consumeIdempotencyKey('profile', payload.id || 'draft');
      safeTrackEvent('profile.saved', { mode: 'online' });
      log('farm', 'profile_save_synced');
      return { profile: saved || payload, offline: false, error: null };
    } catch (err) {
      const isNetworkError = !err.status && (err.message === 'Failed to fetch' || err.name === 'TypeError');
      if (isNetworkError) {
        // Network failed — queue for later
        await enqueue({
          method: 'PATCH',
          url: '/api/v2/farm-profile',
          data: payload,
          entityType: 'profile',
          actionType: 'update',
          idempotencyKey: profileKey,
        });
        safeTrackEvent('profile.saved', { mode: 'queued' });
        log('farm', 'profile_save_queued', { reason: 'network_error' });
        return { profile: payload, offline: true, error: null };
      }
      // Server error (validation, 500) — propagate
      log('farm', 'profile_save_failed', { status: err.status, message: err.message });
      throw err;
    }
  }

  // 3. Offline — queue for sync
  await enqueue({
    method: 'PATCH',
    url: '/api/v2/farm-profile',
    data: payload,
    entityType: 'profile',
    actionType: 'update',
    idempotencyKey: profileKey,
  });
  safeTrackEvent('profile.saved', { mode: 'offline' });
  log('farm', 'profile_save_queued', { reason: 'offline' });
  return { profile: payload, offline: true, error: null };
}

/**
 * Read profile: check recent writes first, then IndexedDB draft.
 * Avoids stale reads immediately after a local-first save.
 */
export async function readProfileLocal() {
  const recent = getRecentWrite('profile');
  if (recent) return recent;
  return getProfileDraft();
}

// ─── 2. HARVEST RECORD (local-first) ────────────────────────
/**
 * Create a harvest record: optimistic local cache + background sync.
 *
 * @param {Object} record - Harvest data
 * @param {Object} opts
 * @param {boolean} opts.isOnline
 * @param {string} opts.farmId
 * @returns {Promise<{record: Object, offline: boolean}>}
 */
export async function createHarvestLocalFirst(record, { isOnline, farmId }) {
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const localRecord = { ...record, id: tempId, _pending: true };
  cacheWrite(`harvest:${tempId}`, localRecord);
  log('farm', 'harvest_create_started', { farmId });

  const harvestKey = getIdempotencyKey('harvest', `${farmId}:${tempId}`);

  if (isOnline) {
    try {
      const data = await createHarvestRecord(record);
      const saved = data.record || data;
      cacheWrite(`harvest:${saved.id || tempId}`, { ...saved, _pending: false });
      consumeIdempotencyKey('harvest', `${farmId}:${tempId}`);
      log('farm', 'harvest_create_synced', { farmId });
      return { record: saved, offline: false };
    } catch (err) {
      if (!err.status) {
        await enqueue({
          method: 'POST',
          url: '/api/v2/harvest-records',
          data: record,
          entityType: 'harvest',
          actionType: 'create',
          idempotencyKey: harvestKey,
        });
        log('farm', 'harvest_create_queued');
        return { record: localRecord, offline: true };
      }
      throw err;
    }
  }

  await enqueue({
    method: 'POST',
    url: '/api/v2/harvest-records',
    data: record,
    entityType: 'harvest',
    actionType: 'create',
    idempotencyKey: harvestKey,
  });
  return { record: localRecord, offline: true };
}

// ─── 3. FARM COST (local-first) ─────────────────────────────
/**
 * Create a farm cost record: optimistic local cache + background sync.
 */
export async function createCostLocalFirst(cost, { isOnline, farmId }) {
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const localRecord = { ...cost, id: tempId, _pending: true };
  cacheWrite(`cost:${tempId}`, localRecord);
  log('farm', 'cost_create_started', { farmId });

  const costKey = getIdempotencyKey('cost', `${farmId}:${tempId}`);

  if (isOnline) {
    try {
      const data = await createFarmCost(cost);
      const saved = data.record || data;
      cacheWrite(`cost:${saved.id || tempId}`, { ...saved, _pending: false });
      consumeIdempotencyKey('cost', `${farmId}:${tempId}`);
      log('farm', 'cost_create_synced', { farmId });
      return { record: saved, offline: false };
    } catch (err) {
      if (!err.status) {
        await enqueue({
          method: 'POST',
          url: '/api/v2/farm-costs',
          data: cost,
          entityType: 'cost',
          actionType: 'create',
          idempotencyKey: costKey,
        });
        log('farm', 'cost_create_queued');
        return { record: localRecord, offline: true };
      }
      throw err;
    }
  }

  await enqueue({
    method: 'POST',
    url: '/api/v2/farm-costs',
    data: cost,
    entityType: 'cost',
    actionType: 'create',
    idempotencyKey: costKey,
  });
  return { record: localRecord, offline: true };
}
