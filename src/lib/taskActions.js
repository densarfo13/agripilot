/**
 * taskActions.js — optimistic task completion with offline
 * fallback.
 *
 *   import { completeTask } from './lib/taskActions.js';
 *
 *   const { ok, queued } = await completeTask({
 *     id:         'decision-abc',
 *     title:      'Check soil moisture around your tomato',
 *     category:   'watering',
 *     decisionId: 'decision-abc',     // optional — sent to /api/decision/complete
 *   });
 *
 * Pipeline (every step is fire-and-forget — UI is already
 * updated by the time these resolve):
 *   1. taskStore.markTaskDone(id) — instant local state flip
 *      so Home / Tasks / Progress all show the completion in
 *      the same render frame.
 *   2. Toast: "Nice — you\u2019re on track" (success).
 *   3. Backend POST. We try /api/decision/complete first when a
 *      decisionId is present (richer ML training data); fall
 *      back to /api/tasks/complete-event for legacy task ids.
 *   4. On failure: toast "Saved on this device. We'll sync when
 *      online." + addToQueue() for the offline-sync coordinator
 *      to drain on reconnect.
 *   5. NEVER reverts the optimistic flip unless the backend
 *      EXPLICITLY rejects the completion (403 cross-user
 *      ownership). Other errors leave the local mark intact.
 *
 * Strict-rule audit
 *   • Always resolves — never rejects.
 *   • Local state flip happens BEFORE the network call so the
 *     UI is responsive even on slow connections.
 *   • Offline detection prefers explicit navigator.onLine then
 *     falls back to the catch path.
 */

import { markTaskDone, unmarkTaskDone } from './taskStore.js';
import { showToast } from './globalToast.js';
import { addToQueue } from '../offline/offlineQueue.js';

const SUCCESS_MSG = 'Nice \u2014 you\u2019re on track';
const QUEUED_MSG  = 'Saved on this device. We\u2019ll sync when online.';

/**
 * completeTask(task, opts?) — optimistic completion.
 *
 *   task = { id, title, category, decisionId?, ruleId?, actionType? }
 *
 * Returns Promise<{ ok, queued, error }>:
 *   ok      — true if the local mark was applied
 *   queued  — true if the action was enqueued for offline sync
 *   error   — server error message when applicable (never throws)
 */
export async function completeTask(task, opts = {}) {
  const t = (task && typeof task === 'object') ? task : {};
  const id = typeof t.id === 'string' && t.id.length > 0 ? t.id
    : (typeof t.decisionId === 'string' ? t.decisionId : null);
  if (!id) {
    // No id — surface a friendly toast and bail. We don't
    // optimistic-mark something we can't track.
    showToast('Task complete', 'success');
    return { ok: false, queued: false, error: 'missing_id' };
  }

  // 1. Optimistic local flip.
  markTaskDone(id, { title: t.title, category: t.category });

  // Sprint #189 — pilot analytics: task_completed. Fire-and-forget;
  // lazy import; failures swallow so analytics never breaks tasks.
  import('../runtime/analytics/PilotAnalyticsRuntime')
    .then(({ trackPilotEvent }) => trackPilotEvent({
      eventType: 'task_completed',
      metadata: { taskKind: t.category || 'unknown' },
    }))
    .catch(() => { /* swallow */ });

  // FARM_BRAIN_STATE_V1 — RULE 1: a completed task is an event that updates
  // FarmBrain (beyond scans). Fire-and-forget; never blocks the completion.
  import('../runtime/farmBrain/FarmBrainStateStore')
    .then(({ dispatchFarmEvent }) => dispatchFarmEvent('task_completed', {
      timelineEntry: { kind: 'task_completed', label: t.title || 'Task completed' },
    }, { taskKind: t.category || 'unknown' }))
    .catch(() => { /* swallow */ });

  // 2. Success toast — fires before the network call so the
  //    user gets immediate feedback.
  if (opts.suppressToast !== true) {
    showToast(SUCCESS_MSG, 'success');
  }

  // 3. Network sync. Lazy-import api so unit tests don't pull
  //    the whole axios client.
  const isOnline = typeof navigator === 'undefined'
    ? true
    : (navigator.onLine !== false);

  if (!isOnline) {
    _enqueueForLater(t);
    showToast(QUEUED_MSG, 'info', 4500);
    return { ok: true, queued: true, error: null };
  }

  try {
    const apiMod = await import('../api/client.js');
    const api = apiMod && (apiMod.default || apiMod);
    if (!api || typeof api.post !== 'function') {
      throw new Error('api_client_unavailable');
    }
    const path = t.decisionId ? '/decision/complete' : '/tasks/complete-event';
    const body = t.decisionId
      ? { decisionId: t.decisionId, actionType: t.actionType || t.category || null }
      : {
          taskId:    id,
          title:     t.title || null,
          category:  t.category || null,
          ruleId:    t.ruleId || null,
          completedAt: new Date().toISOString(),
        };
    const res = await api.post(path, body);
    // Some backends return 200 with { error } body — treat as
    // ok unless explicit rejection (403 / forbidden) surfaces.
    void res;
    return { ok: true, queued: false, error: null };
  } catch (err) {
    const status = err && err.response && err.response.status;
    const code = err && err.response && err.response.data && err.response.data.code;
    // Hard rejection — revert the optimistic mark.
    if (status === 403 && code === 'decision_not_owned') {
      unmarkTaskDone(id);
      showToast('That task isn\u2019t yours to complete.', 'error');
      return { ok: false, queued: false, error: 'forbidden' };
    }
    // Soft failure — keep the local mark, queue for later.
    _enqueueForLater(t);
    showToast(QUEUED_MSG, 'info', 4500);
    return { ok: true, queued: true, error: (err && err.message) || 'sync_failed' };
  }
}

function _enqueueForLater(t) {
  try {
    addToQueue({
      type:    'task_completed',
      payload: {
        taskId:     t.id || null,
        decisionId: t.decisionId || null,
        title:      t.title || null,
        category:   t.category || null,
        ruleId:     t.ruleId || null,
        actionType: t.actionType || null,
        completedAt: new Date().toISOString(),
      },
    });
  } catch { /* never throw from a queue helper */ }
}

export const _internal = Object.freeze({
  SUCCESS_MSG,
  QUEUED_MSG,
});

export default completeTask;
