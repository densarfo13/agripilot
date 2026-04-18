/**
 * taskCorrection — forgiving recovery layer on top of task completion.
 *
 * Two stores, both in localStorage, both bounded so they self-trim on
 * low-end devices:
 *
 *   1. UNDO_KEY      — one open undo slot per session, 20 s TTL.
 *                      Holds enough metadata to fully restore the task
 *                      (previous status, completedAt, camera-source
 *                      payload, etc.) so a single tap reverses the
 *                      completion.
 *   2. CORRECTIONS   — ring buffer of correction records for analytics
 *                      and dev support. Marks the reason (`didnt_do`,
 *                      `tap_by_mistake`, `not_applicable`,
 *                      `need_help`) and the original task context.
 *
 * This is a correction system, not a task editor: callers can flip
 * status or record a reason. Nothing here ever lets the UI rewrite
 * task title / steps / why / timing / risk.
 */

const UNDO_KEY = 'farroway:task_undo';
const CORR_KEY = 'farroway:task_corrections';
const UNDO_WINDOW_MS = 20 * 1000;
const CORR_MAX = 50;

// ─── Correction reasons (spec §3) ──────────────────────────
export const CORRECTION_REASON = Object.freeze({
  DIDNT_DO: 'didnt_do',
  TAP_BY_MISTAKE: 'tap_by_mistake',
  NOT_APPLICABLE: 'not_applicable',
  NEED_HELP: 'need_help',
});

// ─── Task statuses (spec §4) ───────────────────────────────
export const TASK_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FLAGGED_FOR_REVIEW: 'flagged_for_review',
  HELP_REQUESTED: 'help_requested',
});

// ─── Undo window ───────────────────────────────────────────

function readUndo() {
  try {
    const raw = localStorage.getItem(UNDO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.undoExpiresAt) return null;
    if (parsed.undoExpiresAt < Date.now()) { clearUndoWindow(); return null; }
    return parsed;
  } catch { return null; }
}

function writeUndo(record) {
  try { localStorage.setItem(UNDO_KEY, JSON.stringify(record)); }
  catch { /* quota */ }
}

/**
 * Open a 20-second undo window right after a task completion. Metadata
 * must carry everything needed to restore the task — the undo handler
 * reads it and never talks to the server for camera tasks.
 *
 * @param {Object} args
 * @param {string} args.taskId
 * @param {string} args.source         'normal' | 'camera'
 * @param {Object} [args.metadata]     camera-task payload (titleKey etc.)
 * @param {string} [args.previousStatus]
 * @param {number} [args.completedAt]
 */
export function startUndoWindow({
  taskId, source = 'normal', metadata = null,
  previousStatus = TASK_STATUS.ACTIVE,
  completedAt = Date.now(),
}) {
  if (!taskId) return null;
  const record = {
    taskId, source, metadata,
    previousStatus,
    completedAt,
    undoExpiresAt: Date.now() + UNDO_WINDOW_MS,
  };
  writeUndo(record);
  return record;
}

/** Is the active undo still usable? */
export function canUndo(taskId) {
  const u = readUndo();
  if (!u) return false;
  if (taskId && u.taskId !== taskId) return false;
  return true;
}

/** Read the active undo (null if none/expired). */
export function getActiveUndo() {
  return readUndo();
}

/** Clear the undo slot — called after use, after expiry, or on log-out. */
export function clearUndoWindow() {
  try { localStorage.removeItem(UNDO_KEY); } catch { /* ignore */ }
}

/**
 * Remaining milliseconds on the active undo window (0 if none).
 */
export function undoMsRemaining() {
  const u = readUndo();
  if (!u) return 0;
  return Math.max(0, u.undoExpiresAt - Date.now());
}

// ─── Correction records ────────────────────────────────────

function readCorrections() {
  try {
    const raw = localStorage.getItem(CORR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeCorrections(list) {
  try { localStorage.setItem(CORR_KEY, JSON.stringify(list.slice(-CORR_MAX))); }
  catch { /* quota */ }
}

/**
 * Log a correction (spec §3). Returns the record so callers can
 * emit analytics with the same id.
 */
export function recordCorrection({
  taskId,
  reason,
  source = 'normal',
  previousStatus,
  nextStatus,
  note,
}) {
  if (!taskId || !reason) return null;
  const record = {
    id: `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    taskId, reason, source,
    previousStatus: previousStatus || null,
    nextStatus: nextStatus || null,
    note: note || null,
    correctedAt: Date.now(),
  };
  const all = readCorrections();
  all.push(record);
  writeCorrections(all);
  return record;
}

/** Recent corrections — newest first. */
export function listCorrections(limit = 20) {
  return [...readCorrections()].sort((a, b) => b.correctedAt - a.correctedAt).slice(0, limit);
}

/**
 * Map a correction reason to the next task status (spec §3):
 *   didnt_do / tap_by_mistake → ACTIVE (re-open)
 *   not_applicable            → FLAGGED_FOR_REVIEW
 *   need_help                 → HELP_REQUESTED
 */
export function statusForReason(reason) {
  switch (reason) {
    case CORRECTION_REASON.DIDNT_DO:
    case CORRECTION_REASON.TAP_BY_MISTAKE:
      return TASK_STATUS.ACTIVE;
    case CORRECTION_REASON.NOT_APPLICABLE:
      return TASK_STATUS.FLAGGED_FOR_REVIEW;
    case CORRECTION_REASON.NEED_HELP:
      return TASK_STATUS.HELP_REQUESTED;
    default:
      return TASK_STATUS.ACTIVE;
  }
}

/** Dev helper — wipe both stores. */
export function clearAllCorrectionState() {
  try { localStorage.removeItem(UNDO_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(CORR_KEY); } catch { /* ignore */ }
}

export const _internal = { UNDO_WINDOW_MS, CORR_MAX };
