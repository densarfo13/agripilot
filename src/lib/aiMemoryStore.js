/**
 * aiMemoryStore.js — bounded, transparent engagement memory for §5
 * of the Next-Best-Action Intelligence System.
 *
 *   recordSignal('risk_high:fungal', 'ignored');
 *   if (shouldSuppress('risk_high:fungal').suppressed) {
 *     // engine skips this candidate
 *   }
 *
 * Design guardrails (deliberately conservative)
 * ─────────────────────────────────────────────
 *   1. ONLY down-weight.  We never silently push a new
 *      recommendation up — adaptation only suppresses what the
 *      user explicitly skipped.
 *
 *   2. USER-INITIATED signals only.  "Ignored" is recorded only
 *      when the user taps Skip. Inaction is NOT ignore — a busy
 *      farmer who didn't open the app today shouldn't have their
 *      recommendations downweighted.
 *
 *   3. BOUNDED + VISIBLE.  After SUPPRESS_AT_IGNORES explicit
 *      skips within ROLLING_WINDOW_MS, suppress for SUPPRESS_FOR_MS.
 *      The store exposes `getSuppressedKinds()` so the UI can show
 *      the user exactly what was skipped + offer a "Resume" toggle.
 *
 *   4. AUTO-EXPIRY.  Suppression times out — we never permanently
 *      silence a signal.
 *
 *   5. PER-KIND, NOT PER-USER-PROFILE.  We track signal kinds
 *      (e.g. "risk_high:fungal"), not psychological models of the
 *      user. Honest scope.
 *
 * Storage
 * ───────
 *   Slot:  `farroway_ai_memory_v1`
 *   Shape: {
 *     events: [{ kind, type, ts }, ...],   // rolling event log
 *     suppressUntil: { [kind]: ts },       // explicit overrides
 *   }
 *   Bounded to MAX_EVENTS so the slot can't blow the quota.
 *
 * Strict-rule audit
 *   • SSR-safe (localStorage guard).
 *   • Every storage call wrapped — quota / private-mode → no-op.
 *   • Pure helpers (shouldSuppress / getSuppressedKinds) — never throw.
 */

export const MEMORY_KEY      = 'farroway_ai_memory_v1';
export const MAX_EVENTS      = 200;
export const ROLLING_WINDOW_MS  = 14 * 24 * 60 * 60 * 1000;   // 14 days
export const SUPPRESS_AT_IGNORES = 5;                          // user must say no this many times
export const SUPPRESS_FOR_MS    =  7 * 24 * 60 * 60 * 1000;   // 7 days

export const SIGNAL_TYPES = Object.freeze({
  SHOWN:     'shown',       // engine showed this kind to the user
  ENGAGED:   'engaged',     // user took the hint (added a task, etc.)
  IGNORED:   'ignored',     // user tapped Skip
  COMPLETED: 'completed',   // associated task was marked done later
});

// ─── Helpers ──────────────────────────────────────────────────

function _now() { try { return Date.now(); } catch { return 0; } }

function _read() {
  try {
    if (typeof localStorage === 'undefined') return { events: [], suppressUntil: {} };
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return { events: [], suppressUntil: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { events: [], suppressUntil: {} };
    return {
      events:        Array.isArray(parsed.events) ? parsed.events : [],
      suppressUntil: (parsed.suppressUntil && typeof parsed.suppressUntil === 'object')
        ? parsed.suppressUntil : {},
    };
  } catch {
    return { events: [], suppressUntil: {} };
  }
}

function _write(state) {
  try {
    if (typeof localStorage === 'undefined') return;
    const trimmed = {
      events: (state.events || []).slice(-MAX_EVENTS),
      suppressUntil: state.suppressUntil || {},
    };
    localStorage.setItem(MEMORY_KEY, JSON.stringify(trimmed));
  } catch { /* quota / private mode — non-fatal */ }
}

function _normKind(kind) {
  return String(kind || '').trim();
}

function _isWithinWindow(ts, nowMs) {
  if (typeof ts !== 'number') return false;
  return (nowMs - ts) <= ROLLING_WINDOW_MS;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Record an event for a signal kind. When `type` is 'ignored' and
 * the rolling-window count crosses SUPPRESS_AT_IGNORES, we stamp
 * `suppressUntil[kind] = now + SUPPRESS_FOR_MS` so the engine
 * skips this kind for a week.
 *
 * @param {string} kind        — e.g. 'risk_high:fungal', 'task_top'
 * @param {string} type        — one of SIGNAL_TYPES values
 * @returns {boolean}          — whether the event was recorded
 */
export function recordSignal(kind, type) {
  const k = _normKind(kind);
  if (!k) return false;
  const validTypes = Object.values(SIGNAL_TYPES);
  if (!validTypes.includes(String(type))) return false;
  const now = _now();
  const state = _read();
  state.events.push({ kind: k, type: String(type), ts: now });

  // Check rolling-window ignore count for this kind. If it crosses
  // the threshold, suppress.
  if (type === SIGNAL_TYPES.IGNORED) {
    const recentIgnores = state.events.filter((e) =>
      e && e.kind === k && e.type === SIGNAL_TYPES.IGNORED && _isWithinWindow(e.ts, now)
    ).length;
    if (recentIgnores >= SUPPRESS_AT_IGNORES) {
      state.suppressUntil[k] = now + SUPPRESS_FOR_MS;
    }
  }

  // Engagement clears any active suppression — the user came back
  // to this kind voluntarily, so we should treat it as live again.
  if (type === SIGNAL_TYPES.ENGAGED || type === SIGNAL_TYPES.COMPLETED) {
    if (state.suppressUntil[k]) {
      delete state.suppressUntil[k];
    }
  }

  _write(state);
  return true;
}

/**
 * @param {string} kind
 * @returns {{ suppressed: boolean, until: number|null, reason: string|null }}
 */
export function shouldSuppress(kind) {
  const k = _normKind(kind);
  if (!k) return { suppressed: false, until: null, reason: null };
  const state = _read();
  const until = state.suppressUntil && state.suppressUntil[k];
  const now = _now();
  if (typeof until === 'number' && until > now) {
    return {
      suppressed: true,
      until,
      reason: `User explicitly skipped this ${SUPPRESS_AT_IGNORES} times in the last ${Math.round(ROLLING_WINDOW_MS / (24 * 60 * 60 * 1000))} days; suppressed until ${new Date(until).toISOString()}`,
    };
  }
  // Lazy cleanup of an expired entry so the slot doesn't grow.
  if (typeof until === 'number' && until <= now) {
    delete state.suppressUntil[k];
    _write(state);
  }
  return { suppressed: false, until: null, reason: null };
}

/**
 * List of currently-suppressed kinds (for a "you skipped these"
 * settings surface). Returns [] when nothing is suppressed.
 *
 * @returns {Array<{ kind: string, until: string }>}
 */
export function getSuppressedKinds() {
  const state = _read();
  const now = _now();
  const out = [];
  for (const [kind, until] of Object.entries(state.suppressUntil || {})) {
    if (typeof until !== 'number' || until <= now) continue;
    try { out.push({ kind, until: new Date(until).toISOString() }); }
    catch { /* skip */ }
  }
  return out;
}

/**
 * Engagement-signal summary the engine + analytics can read.
 *
 * @param {string} [kind] — when provided, returns counters for that
 *                           kind only; otherwise returns the totals.
 * @param {number} [nowMs]
 * @returns {{ shown: number, engaged: number, ignored: number, completed: number }}
 */
export function getEngagementCounters(kind, nowMs) {
  const k = kind ? _normKind(kind) : null;
  const now = (typeof nowMs === 'number') ? nowMs : _now();
  const state = _read();
  const counters = { shown: 0, engaged: 0, ignored: 0, completed: 0 };
  for (const e of state.events) {
    if (!e || !_isWithinWindow(e.ts, now)) continue;
    if (k && e.kind !== k) continue;
    if (counters[e.type] != null) counters[e.type] += 1;
  }
  return counters;
}

/**
 * Manually clear suppression for a kind so the user can "resume"
 * a suppressed recommendation. Returns true when something was
 * actually cleared.
 *
 * @param {string} kind
 * @returns {boolean}
 */
export function resumeKind(kind) {
  const k = _normKind(kind);
  if (!k) return false;
  const state = _read();
  if (state.suppressUntil && state.suppressUntil[k]) {
    delete state.suppressUntil[k];
    _write(state);
    return true;
  }
  return false;
}

/** Wipe the memory (sign-out / debug). */
export function clearMemory() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(MEMORY_KEY);
    }
  } catch { /* ignore */ }
}

export default {
  recordSignal,
  shouldSuppress,
  getSuppressedKinds,
  getEngagementCounters,
  resumeKind,
  clearMemory,
  SIGNAL_TYPES,
  MEMORY_KEY,
  ROLLING_WINDOW_MS,
  SUPPRESS_AT_IGNORES,
  SUPPRESS_FOR_MS,
  MAX_EVENTS,
};
