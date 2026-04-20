/**
 * dailyLoop.js — deterministic, offline-first helpers for the daily
 * retention loop.
 *
 * The loop:
 *   OPEN → ACT → FEEDBACK → PROGRESS → NEXT → RETURN
 *
 * This module answers three questions with pure functions:
 *
 *   1. Is this a first-visit-today or a continuing session?
 *   2. What's the farmer's current streak, and should it reset?
 *   3. Which reinforcement / next-day hint should we show?
 *
 * Storage keys (all namespaced):
 *   farroway.lastVisit         — ISO date "YYYY-MM-DD" of the last app open
 *   farroway.streak            — integer; number of consecutive days with ≥1 completion
 *   farroway.streakUpdatedAt   — ISO date "YYYY-MM-DD"; guards against double-increment
 *
 * Offline-first: every function tolerates the absence of window /
 * localStorage and falls back to sane defaults.
 */

// ─── Storage helpers ──────────────────────────────────────────────
const K = Object.freeze({
  LAST_VISIT:    'farroway.lastVisit',
  STREAK:        'farroway.streak',
  STREAK_AT:     'farroway.streakUpdatedAt',
});

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}
function read(key)   { if (!hasStorage()) return null; try { return window.localStorage.getItem(key); } catch { return null; } }
function write(key, v) {
  if (!hasStorage()) return false;
  try {
    if (v == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, String(v));
    return true;
  } catch { return false; }
}

// ─── Date helpers (deterministic, UTC-free) ───────────────────────
// We key on calendar day in the user's local zone. A single helper
// keeps "date arithmetic" consistent across the module and tests.
export function toIsoDate(d) {
  // Already an ISO calendar date — echo through to avoid timezone
  // drift (new Date('2026-01-02') parses as UTC midnight, which
  // rolls back a day in negative-offset zones).
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = d instanceof Date ? d : new Date(d);
  if (!Number.isFinite(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * dayDiff — whole-day difference between two ISO date strings.
 * Positive when b is later than a. Returns null when either input
 * is malformed.
 */
export function dayDiff(isoA, isoB) {
  if (!isoA || !isoB) return null;
  const a = new Date(`${isoA}T00:00:00`);
  const b = new Date(`${isoB}T00:00:00`);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return null;
  return Math.round((b - a) / (24 * 3600 * 1000));
}

// ─── Last visit ───────────────────────────────────────────────────
export function readLastVisit() { return read(K.LAST_VISIT); }

/** Update last-visit to today and return the previous value. */
export function touchLastVisit({ now } = {}) {
  const prev = readLastVisit();
  const today = toIsoDate(now || new Date());
  write(K.LAST_VISIT, today);
  return prev;
}

// ─── Streak ───────────────────────────────────────────────────────
function readStreakRaw() {
  const n = Number(read(K.STREAK) || 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
function readStreakAt() { return read(K.STREAK_AT); }

/**
 * getEffectiveStreak — returns the streak value the UI should show
 * RIGHT NOW. If the last increment was more than 1 day ago, the
 * streak has lapsed and we report 0. Does NOT mutate storage — call
 * `resetStaleStreak` for that.
 */
export function getEffectiveStreak({ now } = {}) {
  const streak = readStreakRaw();
  const at = readStreakAt();
  const today = toIsoDate(now || new Date());
  const diff = dayDiff(at, today);
  if (at == null || diff == null) return streak; // never incremented yet, or bad data
  if (diff <= 1) return streak;                   // still alive (same day or 1-day gap)
  return 0;                                       // lapsed
}

/** Forcibly zero out a lapsed streak in storage. Idempotent. */
export function resetStaleStreak({ now } = {}) {
  const at = readStreakAt();
  const today = toIsoDate(now || new Date());
  const diff = dayDiff(at, today);
  if (diff != null && diff > 1) {
    write(K.STREAK, '0');
    write(K.STREAK_AT, null);
    return true;
  }
  return false;
}

/**
 * markTaskCompletedForStreak — call whenever a farmer marks ANY
 * task complete. Rules (spec §2):
 *
 *   • same-day completion → no change (already counted today)
 *   • completed yesterday → increment by 1
 *   • never completed, or gap > 1 day → start at 1
 *
 * Always returns the new streak number. Does not throw.
 */
export function markTaskCompletedForStreak({ now } = {}) {
  const today = toIsoDate(now || new Date());
  const at = readStreakAt();
  const current = readStreakRaw();

  // Already counted today — no-op.
  if (at && at === today) return current;

  const diff = dayDiff(at, today);
  let next;
  if (diff === 1) next = current + 1;
  else            next = 1; // either first-ever or gap > 1

  write(K.STREAK, String(next));
  write(K.STREAK_AT, today);
  return next;
}

// ─── Daily entry status (spec §1, §5) ─────────────────────────────
/**
 * getDailyEntryStatus — answers:
 *
 *   • firstVisitToday  — is this the first open of the calendar day?
 *   • missedDays       — number of whole days skipped (0 if none)
 *   • messageKey       — i18n key for the greeting line
 *       'loop.first_visit_today'  | 'loop.continue_tasks'
 *       | 'loop.missed_day_message' (overrides when missedDays ≥ 1)
 */
export function getDailyEntryStatus({ now, lastVisit } = {}) {
  const today = toIsoDate(now || new Date());
  const last  = (lastVisit == null) ? readLastVisit() : lastVisit;
  if (!last) {
    return { firstVisitToday: true, missedDays: 0, messageKey: 'loop.first_visit_today' };
  }
  const diff = dayDiff(last, today);
  if (diff == null) {
    return { firstVisitToday: true, missedDays: 0, messageKey: 'loop.first_visit_today' };
  }
  if (diff === 0) {
    return { firstVisitToday: false, missedDays: 0, messageKey: 'loop.continue_tasks' };
  }
  if (diff === 1) {
    return { firstVisitToday: true, missedDays: 0, messageKey: 'loop.first_visit_today' };
  }
  return {
    firstVisitToday: true,
    missedDays: diff - 1,
    messageKey: 'loop.missed_day_message',
  };
}

// ─── Reinforcement messages (spec §6) ─────────────────────────────
// Varied but simple — rotate through a small catalog. Consumers pass
// a stable seed (e.g. taskId + timestamp) so the same completion
// renders the same message on re-render.
const REINFORCEMENT_KEYS = Object.freeze([
  'loop.reinforcement.1',
  'loop.reinforcement.2',
  'loop.reinforcement.3',
  'loop.reinforcement.4',
]);

export function pickReinforcementKey(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  if (!Number.isFinite(h)) h = 0;
  return REINFORCEMENT_KEYS[h % REINFORCEMENT_KEYS.length];
}

// ─── Next-day preview (spec §4) ──────────────────────────────────
/**
 * pickNextDayHint — produce a small i18n-keyed hint for "tomorrow"
 * without pulling the full task engine into every caller. Takes the
 * engine's latest snapshot (primary + secondaries + completions) and
 * returns the next logical task (the one that would be primary once
 * today's primary is completed).
 *
 *   input  : { engineSnapshot, completions }
 *   output : { kind: 'task'|'bridge', titleKey, whyKey, bridgeKey? }
 *            or null when we truly have nothing.
 *
 * The UI uses this to render:
 *   "Tomorrow: {t(titleKey)}"  or  "Next: {t(bridgeKey)}"
 */
export function pickNextDayHint({ engineSnapshot, completions = [] } = {}) {
  if (!engineSnapshot) return null;
  const doneIds = new Set(
    (completions || []).filter((c) => c && c.completed !== false).map((c) => String(c.taskId)),
  );

  // Walk primary + secondaries; skip anything already completed and
  // anything that IS the current primary (we want "tomorrow").
  const candidates = [];
  const { primaryTask, secondaryTasks = [] } = engineSnapshot;
  if (primaryTask && primaryTask.kind === 'task') candidates.push({ pos: 'primary', task: primaryTask });
  for (const s of secondaryTasks) candidates.push({ pos: 'secondary', task: s });

  // Prefer the FIRST secondary that isn't completed; otherwise, the
  // primary (if it's the only actionable thing, "tomorrow" == "today's
  // primary" — still useful as a hint).
  const nextSecondary = candidates.find(
    (c) => c.pos === 'secondary' && !doneIds.has(String(c.task.id)),
  );
  const anyActionable = candidates.find((c) => !doneIds.has(String(c.task.id)));
  const chosen = nextSecondary || anyActionable || null;

  if (chosen && chosen.task) {
    return {
      kind:     'task',
      titleKey: chosen.task.titleKey || null,
      whyKey:   chosen.task.whyKey   || null,
      bridgeKey: null,
    };
  }
  // Nothing actionable → bridge into the next stage.
  if (primaryTask && primaryTask.kind === 'bridge' && primaryTask.titleKey) {
    return {
      kind: 'bridge',
      titleKey: null, whyKey: null,
      bridgeKey: primaryTask.titleKey,
    };
  }
  return null;
}

// ─── Facade for the Today page / Progress engine ─────────────────
/**
 * computeDailyLoopFacts — one call for the UI; returns a frozen
 * summary suitable for rendering the streak chip, the entry banner,
 * and for feeding the Progress Engine (spec §7).
 */
export function computeDailyLoopFacts({
  now,
  completions = [],
} = {}) {
  const today = toIsoDate(now || new Date());
  resetStaleStreak({ now });
  const entry  = getDailyEntryStatus({ now });
  const streak = getEffectiveStreak({ now });

  // Did the farmer complete any task today? Works against the same
  // localStorage-backed completions the Progress Engine reads.
  let completedToday = 0;
  for (const c of completions || []) {
    if (!c || c.completed === false) continue;
    const iso = toIsoDate(c.timestamp || 0);
    if (iso === today) completedToday += 1;
  }

  return Object.freeze({
    today,
    lastVisit:       readLastVisit(),
    firstVisitToday: entry.firstVisitToday,
    missedDays:      entry.missedDays,
    entryMessageKey: entry.messageKey,
    streak,
    streakUpdatedAt: readStreakAt(),
    completedToday,
    dailyCompletionFlag: completedToday >= 1,
  });
}

export const _keys = K;
export const _internal = Object.freeze({ REINFORCEMENT_KEYS });
