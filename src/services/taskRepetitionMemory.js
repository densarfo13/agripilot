/**
 * taskRepetitionMemory — distinct-day tracking per task type.
 *
 * Used by the adaptive-wording layer so a task that is still open on
 * day 2 or day 3 can shift its title from base → finish → complete_now
 * (spec §1). "Day" is a calendar date in the user's local timezone, so
 * opening the app twice on the same day does NOT bump the counter.
 *
 * Entry shape: { type: { firstSeenAt, lastSeenAt, lastSeenDate, distinctDays, completedAt } }
 * Pruned to 30 entries max and auto-expires anything older than 21 days
 * so the store stays small on low-end devices.
 */

const KEY = 'farroway:task_repetition_memory';
const MAX_ENTRIES = 30;
const RETENTION_MS = 21 * 24 * 60 * 60 * 1000;

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function writeAll(map) {
  try {
    // Trim to MAX_ENTRIES by lastSeenAt recency
    const entries = Object.entries(map).sort(
      ([, a], [, b]) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0)
    ).slice(0, MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* quota */ }
}

function pruneExpired(map, now = Date.now()) {
  const out = {};
  for (const [type, entry] of Object.entries(map)) {
    if ((entry.lastSeenAt || 0) + RETENTION_MS >= now) out[type] = entry;
  }
  return out;
}

function localDateString(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Record a "seen" event for a task type. Returns the updated entry.
 * Safe to call on every render — it's a no-op once per local day.
 */
export function recordTaskSeen(type) {
  if (!type) return null;
  const now = Date.now();
  const today = localDateString(now);
  const all = pruneExpired(readAll(), now);
  const existing = all[type] || null;

  if (!existing) {
    all[type] = {
      firstSeenAt: now,
      lastSeenAt: now,
      lastSeenDate: today,
      distinctDays: 1,
      completedAt: null,
    };
  } else if (existing.completedAt) {
    // Task was previously completed — this is a fresh re-issue. Start over.
    all[type] = {
      firstSeenAt: now,
      lastSeenAt: now,
      lastSeenDate: today,
      distinctDays: 1,
      completedAt: null,
    };
  } else if (existing.lastSeenDate !== today) {
    all[type] = {
      ...existing,
      lastSeenAt: now,
      lastSeenDate: today,
      distinctDays: (existing.distinctDays || 1) + 1,
    };
  } else {
    // Same day — only bump lastSeenAt, don't increment distinctDays
    all[type] = { ...existing, lastSeenAt: now };
  }

  writeAll(all);
  return all[type];
}

/**
 * Number of distinct local calendar days this task has been shown
 * without completion. 0 if unseen; 1 if seen today only; 3 if seen
 * today + 2 earlier days.
 */
export function getRepetitionDays(type) {
  if (!type) return 0;
  const entry = readAll()[type];
  if (!entry || entry.completedAt) return 0;
  return entry.distinctDays || 0;
}

/**
 * Mark a task complete — used to reset urgency so the next time the
 * same task re-surfaces it starts at the base wording again.
 */
export function markTaskCompleted(type, now = Date.now()) {
  if (!type) return;
  const all = readAll();
  if (!all[type]) return;
  all[type] = { ...all[type], completedAt: now };
  writeAll(all);
}

/**
 * Clear everything — dev / logout / tests.
 */
export function clearTaskRepetitionMemory() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Expose for test harnesses. */
export const _internal = { localDateString, RETENTION_MS, MAX_ENTRIES };
