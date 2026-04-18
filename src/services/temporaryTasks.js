/**
 * temporaryTasks — short-lived tasks injected from parallel assists
 * like the camera scanner (spec §6). Kept separate from the main task
 * engine so the farmer's primary lifecycle is never disturbed.
 *
 * Entry: { id, source, titleKey, whyKey, stepsKey?, urgency, priority,
 *          icon, createdAt, completedAt?, expiresAt }
 *
 * A task lives up to 7 days or until completed/dismissed, whichever
 * comes first. That keeps the store self-trimming on low-end devices.
 */

const KEY = 'farroway:temporary_tasks';
const MAX = 10;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Clutter guard: at most N active (un-completed, un-expired) tasks
// from the 'camera' source on Home at once. Spec §6.
const MAX_ACTIVE_CAMERA = 2;

function isCameraSource(t) {
  return t.source === 'camera' || t.source === 'camera_diagnosis';
}

function isActive(t, now = Date.now()) {
  return !t.completedAt && (t.expiresAt || 0) > now;
}

function isDev() {
  try { if (typeof import.meta !== 'undefined') return !!import.meta.env?.DEV; } catch { /* ignore */ }
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function write(entries) {
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX))); }
  catch { /* quota */ }
}

function prune(entries) {
  const now = Date.now();
  return entries.filter(e => !e.completedAt && (e.expiresAt || 0) > now);
}

export function addTemporaryTask({
  source = 'camera_diagnosis',
  issueType,                           // e.g. 'pest_detected'
  titleKey, whyKey, stepsKey, lookForKey, tipKey,
  followupTaskType,
  urgency = 'today', priority = 'high',
  icon = '\uD83C\uDF3E', iconBg,
  expiresInHours,                       // overrides the default 7-day TTL
} = {}) {
  let all = prune(read());
  const now = Date.now();
  const ttl = Number.isFinite(expiresInHours) ? expiresInHours * 60 * 60 * 1000 : TTL_MS;

  // ─── Merge-by-issueType for camera source (spec §5, §6) ───
  // If the same camera issueType is already active, refresh it in
  // place instead of creating a duplicate. Keeps Home clutter-free
  // and preserves the original id so any UI state pinned to that id
  // survives the re-scan.
  if (isCameraSource({ source }) && issueType) {
    const existingIdx = all.findIndex(t =>
      isCameraSource(t) && t.issueType === issueType && isActive(t, now)
    );
    if (existingIdx >= 0) {
      all[existingIdx] = {
        ...all[existingIdx],
        titleKey, whyKey, stepsKey, lookForKey, tipKey,
        urgency, priority, icon, iconBg,
        followupTaskType,
        createdAt: now,
        expiresAt: now + ttl,
        mergedCount: (all[existingIdx].mergedCount || 0) + 1,
      };
      write(all);
      return all[existingIdx];
    }
  }

  const task = {
    id: `tmp_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    source, issueType, followupTaskType,
    titleKey, whyKey, stepsKey, lookForKey, tipKey,
    urgency, priority, icon, iconBg,
    createdAt: now,
    completedAt: null,
    expiresAt: now + ttl,
  };

  // ─── Max-active camera guard (spec §6) ────────────────────
  // If adding this task would push the camera-source count past
  // MAX_ACTIVE_CAMERA, evict the oldest active camera task first.
  if (isCameraSource(task)) {
    const activeCamera = all
      .filter(t => isCameraSource(t) && isActive(t, now))
      .sort((a, b) => a.createdAt - b.createdAt);
    while (activeCamera.length >= MAX_ACTIVE_CAMERA) {
      const oldest = activeCamera.shift();
      if (isDev()) {
        console.warn('[temporaryTasks] evicting oldest camera task to respect max-active cap', oldest.id);
      }
      all = all.filter(t => t.id !== oldest.id);
    }
  }

  all.push(task);
  write(all);
  return task;
}

/**
 * Does this temporary task count as an "issue" task that should take
 * over the Home hero slot? Camera scans AND land-check results
 * qualify — both are high-priority parallel-assist tasks created by
 * the farmer outside the normal crop flow.
 */
function isIssueSource(t) {
  return isCameraSource(t) || t.source === 'land_check';
}

/**
 * Return the single most recent active camera task, or null.
 * Kept as the original name for backwards compatibility with existing
 * call sites; widened to also cover land_check results so the one-
 * dominant-task contract holds across both assist paths.
 */
export function getActiveCameraTask() {
  const now = Date.now();
  const active = read()
    .filter(t => isIssueSource(t) && isActive(t, now))
    .sort((a, b) => b.createdAt - a.createdAt);
  return active[0] || null;
}

/** Explicit alias for callers that want the source-agnostic intent. */
export function getActiveIssueTask() {
  return getActiveCameraTask();
}

export function listTemporaryTasks() {
  const all = prune(read());
  write(all); // keep pruned list on disk
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}

export function completeTemporaryTask(id) {
  const all = read();
  const idx = all.findIndex(t => t.id === id);
  if (idx < 0) return null;
  all[idx].completedAt = Date.now();
  write(all);
  return all[idx];
}

export function dismissTemporaryTask(id) {
  const all = read().filter(t => t.id !== id);
  write(all);
}

export function clearTemporaryTasks() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
