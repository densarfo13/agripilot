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
  titleKey, whyKey, stepsKey,
  urgency = 'today', priority = 'high',
  icon = '\uD83C\uDF3E', iconBg,
} = {}) {
  const all = prune(read());
  const now = Date.now();
  const task = {
    id: `tmp_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    source, titleKey, whyKey, stepsKey,
    urgency, priority, icon, iconBg,
    createdAt: now,
    completedAt: null,
    expiresAt: now + TTL_MS,
  };
  all.push(task);
  write(all);
  return task;
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
