/**
 * stageHistory — append-only local log of crop stage transitions.
 *
 * Every time a farm's crop stage changes, a record is appended here.
 * Records are NEVER deleted — this is a local audit trail.
 *
 * Useful for:
 *   - Detecting accidental stage regressions (e.g. flowering → seedling)
 *   - Diagnosing sync issues ("the stage changed 3 times offline")
 *   - Showing the farmer their crop timeline
 *   - Providing context to support if data looks wrong
 *
 * Storage: localStorage (simple, sync, survives page reload).
 * Cap: 200 entries per farm (oldest trimmed). Typically ~10-15 stage
 * changes per growing season, so this covers multiple seasons.
 */

const STORAGE_KEY = 'farroway:stage_history';
const MAX_ENTRIES_PER_FARM = 200;

/** Load all stage history from localStorage */
function _load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

/** Save stage history to localStorage */
function _save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — non-critical */ }
}

/**
 * Record a crop stage transition.
 *
 * @param {Object} opts
 * @param {string} opts.farmId - Farm identifier
 * @param {string} opts.fromStage - Previous stage (null if first entry)
 * @param {string} opts.toStage - New stage
 * @param {string} [opts.source] - What triggered the change: 'user', 'sync', 'auto', 'setup'
 * @param {boolean} [opts.isOnline] - Whether the device was online at the time
 */
export function recordStageChange({ farmId, fromStage, toStage, source = 'user', isOnline = true }) {
  if (!farmId || !toStage) return;
  // Don't record no-ops
  if (fromStage === toStage) return;

  const data = _load();
  const key = `farm:${farmId}`;
  if (!data[key]) data[key] = [];

  const entry = {
    from: fromStage || null,
    to: toStage,
    at: new Date().toISOString(),
    ts: Date.now(),
    source,
    online: isOnline,
  };

  // Detect regression (going backward in typical stage progression)
  const STAGE_ORDER = [
    'land_preparation', 'planting', 'seedling', 'vegetative',
    'flowering', 'fruiting', 'harvest', 'post_harvest',
  ];
  const fromIdx = STAGE_ORDER.indexOf(fromStage);
  const toIdx = STAGE_ORDER.indexOf(toStage);
  if (fromIdx >= 0 && toIdx >= 0 && toIdx < fromIdx) {
    entry.regression = true;
  }

  data[key].push(entry);

  // Cap entries per farm
  if (data[key].length > MAX_ENTRIES_PER_FARM) {
    data[key] = data[key].slice(-MAX_ENTRIES_PER_FARM);
  }

  _save(data);
}

/**
 * Get stage history for a specific farm.
 * @param {string} farmId
 * @returns {Array} Stage transition entries, oldest first
 */
export function getStageHistory(farmId) {
  const data = _load();
  return data[`farm:${farmId}`] || [];
}

/**
 * Get the last recorded stage for a farm.
 * @param {string} farmId
 * @returns {string|null} Most recent stage, or null if no history
 */
export function getLastStage(farmId) {
  const history = getStageHistory(farmId);
  if (history.length === 0) return null;
  return history[history.length - 1].to;
}

/**
 * Check if a stage transition looks like a regression.
 * @param {string} fromStage
 * @param {string} toStage
 * @returns {boolean}
 */
export function isRegression(fromStage, toStage) {
  const STAGE_ORDER = [
    'land_preparation', 'planting', 'seedling', 'vegetative',
    'flowering', 'fruiting', 'harvest', 'post_harvest',
  ];
  const fromIdx = STAGE_ORDER.indexOf(fromStage);
  const toIdx = STAGE_ORDER.indexOf(toStage);
  return fromIdx >= 0 && toIdx >= 0 && toIdx < fromIdx;
}

/**
 * Get any regressions in a farm's history.
 * @param {string} farmId
 * @returns {Array} Entries where regression === true
 */
export function getRegressions(farmId) {
  return getStageHistory(farmId).filter(e => e.regression);
}

/**
 * Get count of stage changes for a farm.
 * @param {string} farmId
 * @returns {number}
 */
export function stageChangeCount(farmId) {
  return getStageHistory(farmId).length;
}
