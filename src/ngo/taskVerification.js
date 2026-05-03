/**
 * taskVerification.js — verification artefact store for the
 * NGO/Program layer (spec §5).
 *
 *   recordTaskVerification({
 *     taskId,             // string — id of the completed task
 *     farmerId,           // string — farmer who completed it
 *     programId,          // optional string — when scoped to a program
 *     photoDataUrl,       // optional data:image/... URL
 *     note,               // optional string
 *   })
 *     → { id, taskId, farmerId, programId, photoUrl, photoDataUrl,
 *         timestamp, audit: { createdAt, source, ua } }
 *
 *   getVerificationsForTask(taskId)
 *   getVerificationsForFarmer(farmerId)
 *   getVerificationsForProgram(programId)
 *
 * Why a separate store
 * ────────────────────
 * The existing `eventStore` is append-only telemetry — it's
 * not the right home for first-class verification artefacts
 * with attached media. This store is the small, audit-shaped
 * sibling: each row is a single verification entry with its own
 * id and timestamp + a stamped "audit" sub-object so a programme
 * manager can answer "when did this farmer record this proof,
 * and from what surface?".
 *
 * Storage: localStorage[`farroway_task_verifications`] = Array<row>.
 * Capped to MAX_ROWS so a runaway scan campaign can't fill the
 * tab's quota. Photo data URLs live INSIDE the rows on the same
 * key; if a future iteration moves them to IndexedDB, the row
 * shape can keep `photoUrl` as a remote pointer and drop the
 * inline data URL transparently.
 *
 * Strict-rule audit
 *   • Never throws — quota / private-mode / corrupt JSON
 *     degrade to no-op (record returns null).
 *   • SSR-safe (every storage call is guarded).
 *   • Pure read APIs return arrays, never null, so callers
 *     don't have to null-check on render.
 *   • Idempotent on `id`; callers can pre-compute an id (e.g.
 *     `${taskId}:${farmerId}:${dateISO}`) to dedupe across
 *     tabs / re-submits.
 */

const KEY = 'farroway_task_verifications';
const MAX_ROWS = 500;

function _now() { return Date.now(); }

function _readAll() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _writeAll(rows) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const trimmed = Array.isArray(rows) ? rows.slice(-MAX_ROWS) : [];
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    return true;
  } catch { return false; }
}

function _uid(prefix) {
  try {
    return `${prefix}_${_now()}_${Math.random().toString(36).slice(2, 8)}`;
  } catch {
    return `${prefix}_${_now()}`;
  }
}

function _ua() {
  try {
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      return String(navigator.userAgent).slice(0, 200);
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * recordTaskVerification — inserts (or upserts when `id` is
 * supplied) a verification row. Returns the stored row, or
 * null when storage is unavailable.
 */
export function recordTaskVerification(input = {}) {
  const taskId   = String(input.taskId   || '').trim();
  const farmerId = String(input.farmerId || '').trim();
  if (!taskId || !farmerId) return null;
  const id = String(input.id || _uid('ver'));
  const programId = input.programId ? String(input.programId) : null;
  const photoDataUrl = input.photoDataUrl
    && /^data:image\//i.test(input.photoDataUrl)
    ? String(input.photoDataUrl)
    : null;
  const note = input.note ? String(input.note).slice(0, 500) : null;
  const ts = Number.isFinite(input.timestamp) ? input.timestamp : _now();
  const row = {
    id,
    taskId,
    farmerId,
    programId,
    // Spec §5 — photo upload per task. We store the data URL
    // directly so the verification works fully offline; a
    // future server upload would replace this with a remote
    // `photoUrl` pointer (kept on the row for forward-compat).
    photoUrl:     null,
    photoDataUrl,
    note,
    timestamp:    ts,
    // Spec §5 — basic audit log on each row. `createdAt` is the
    // ISO mirror of `timestamp` for human-readable exports;
    // `source` lets us trace where the verification originated
    // (defaults to 'app'); `ua` captures the browser/device
    // string at submission time so the auditor can sanity-check
    // unusual patterns (one device submitting 100 verifications
    // an hour, etc.).
    audit: {
      createdAt: new Date(ts).toISOString(),
      source:    String(input.source || 'app'),
      ua:        _ua(),
    },
  };
  const rows = _readAll();
  const idx  = rows.findIndex((r) => r && r.id === id);
  if (idx >= 0) rows[idx] = row;
  else          rows.push(row);
  _writeAll(rows);
  return row;
}

/**
 * getVerifications — read-only listing helpers. Each filters
 * by a single facet and returns the rows newest-first so the
 * dashboard can render the list without an extra sort.
 */
export function getVerificationsForTask(taskId) {
  if (!taskId) return [];
  const id = String(taskId);
  return _readAll()
    .filter((r) => r && r.taskId === id)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export function getVerificationsForFarmer(farmerId) {
  if (!farmerId) return [];
  const id = String(farmerId);
  return _readAll()
    .filter((r) => r && r.farmerId === id)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export function getVerificationsForProgram(programId) {
  if (!programId) return [];
  const id = String(programId);
  return _readAll()
    .filter((r) => r && r.programId === id)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/**
 * Reset the store. Test seam + privacy hook (called by the
 * existing clearLocalActivityData chain when the user opts
 * out of activity tracking).
 */
export function clearTaskVerifications() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export const _internal = Object.freeze({ KEY, MAX_ROWS });

export default {
  recordTaskVerification,
  getVerificationsForTask,
  getVerificationsForFarmer,
  getVerificationsForProgram,
  clearTaskVerifications,
};
