/**
 * timelineBridge.js — auto-append plant timeline entries from
 * existing app events.
 *
 * Wires three signals into the timeline without touching any of
 * the existing handlers:
 *
 *   farroway:plant_added           → 'added' milestone
 *   farroway:scan_added_to_tasks   → 'scan_saved' milestone
 *   farroway:task_completed_garden → 'task_completed' milestone
 *
 * The bridge is a singleton — call `installTimelineBridge()` once
 * at app boot; subsequent calls are idempotent. The bridge only
 * appends events when the user is in garden mode (mode read at
 * event time so a farm → garden flip mid-session works).
 *
 * Strict-rule audit
 *   • Pure subscriptions; no React; no rendering.
 *   • Never throws — every listener wraps the append call.
 *   • No network. No async work.
 *   • SSR-safe — window guard.
 *   • Idempotent install (state flag on globalThis).
 */

import { appendTimelineEntry, TIMELINE_TYPES } from './timelineStore.js';
import { readPlant } from './plantStore.js';
import { readGrowMode } from '../growMode.js';

const INSTALL_FLAG = '__farroway_timeline_bridge_installed__';

function _isGarden() {
  try { return readGrowMode() === 'garden'; }
  catch { return false; }
}

function _plantId() {
  try { return readPlant().id || null; }
  catch { return null; }
}

function _onPlantAdded(ev) {
  try {
    const plant = ev?.detail?.plant || readPlant();
    appendTimelineEntry({
      type:     TIMELINE_TYPES.ADDED,
      plantId:  plant?.id || null,
      params:   { nickname: plant?.nickname || 'My Plant' },
      stage:    plant?.growthStage || null,
      // Force=true: the first-stamp event is celebrated even if a
      // dedupe row exists (rare but possible after store wipe).
      force:    true,
    });
  } catch { /* swallow */ }
}

function _onScanAddedToTasks(ev) {
  if (!_isGarden()) return;
  try {
    const detail = ev?.detail || {};
    appendTimelineEntry({
      type:         TIMELINE_TYPES.SCAN_SAVED,
      plantId:      _plantId(),
      scanCategory: detail.category || detail.scanCategory || null,
    });
  } catch { /* swallow */ }
}

function _onTaskCompleted(ev) {
  if (!_isGarden()) return;
  try {
    const detail = ev?.detail || {};
    appendTimelineEntry({
      type:    TIMELINE_TYPES.TASK_COMPLETED,
      plantId: _plantId(),
      params:  { taskTitle: detail.taskTitle || detail.title || '' },
      stage:   detail.stage || null,
    });
  } catch { /* swallow */ }
}

/**
 * installTimelineBridge() — wire up the three subscriptions.
 * Idempotent: a second call is a no-op.
 */
export function installTimelineBridge() {
  try {
    if (typeof window === 'undefined') return;
    if (globalThis[INSTALL_FLAG]) return;
    globalThis[INSTALL_FLAG] = true;

    window.addEventListener('farroway:plant_added',           _onPlantAdded);
    window.addEventListener('farroway:scan_added_to_tasks',   _onScanAddedToTasks);
    window.addEventListener('farroway:task_completed_garden', _onTaskCompleted);
  } catch { /* swallow */ }
}

export const _internal = Object.freeze({
  _onPlantAdded,
  _onScanAddedToTasks,
  _onTaskCompleted,
});
