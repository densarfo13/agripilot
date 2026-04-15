/**
 * Crop Stage Service — local-first save pattern for crop stage updates.
 *
 * Flow:
 *   1. Save optimistically to local state (caller updates UI)
 *   2. Attempt API write
 *   3. If offline or network error → queue to offline queue
 *   4. Return result with sync status
 *
 * Consumers: CropStageModal, any future crop stage UI.
 * Never call updateCropStage() directly from UI — use this service.
 */
import { updateCropStage } from '../lib/api.js';
import { enqueue } from '../utils/offlineQueue.js';
import { safeTrackEvent } from '../lib/analytics.js';

/**
 * Save a crop stage update with local-first pattern.
 *
 * @param {string} farmId
 * @param {string} stage - New stage value (e.g., 'flowering')
 * @param {Object} options
 * @param {boolean} options.isOnline - Current network status
 * @param {Function} options.refreshProfile - ProfileContext refresh
 * @returns {Promise<{ success: boolean, offline: boolean, error: string|null }>}
 */
export async function saveCropStage(farmId, stage, { isOnline, refreshProfile }) {
  // Track the attempt
  safeTrackEvent('crop_stage.save_attempt', { farmId, stage });

  try {
    // Attempt API write
    await updateCropStage(farmId, stage, undefined);

    // Refresh profile context so UI reflects the new stage
    if (refreshProfile) {
      await refreshProfile();
    }

    safeTrackEvent('crop_stage.save_success', { farmId, stage });
    return { success: true, offline: false, error: null };
  } catch (err) {
    // Network error → queue for offline sync
    const isNetworkError = !isOnline || !err.status || err.message === 'Failed to fetch' || err.name === 'TypeError';

    if (isNetworkError) {
      try {
        await enqueue({
          method: 'PATCH',
          url: `/api/v2/farm-profile/${farmId}/stage`,
          data: { cropStage: stage },
        });
        safeTrackEvent('crop_stage.save_queued', { farmId, stage });
        return { success: true, offline: true, error: null };
      } catch (queueErr) {
        safeTrackEvent('crop_stage.queue_failed', { farmId, error: queueErr.message });
        return { success: false, offline: true, error: queueErr.message || 'Failed to save locally' };
      }
    }

    // Server error (validation, 500, etc.)
    safeTrackEvent('crop_stage.save_failed', { farmId, stage, error: err.message, status: err.status });
    return { success: false, offline: false, error: err.message || 'Failed to save' };
  }
}
