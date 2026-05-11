/**
 * notificationDeduplication — cooldown tracker.
 *
 * SPEC §12
 *   • weather:        12 h cooldown
 *   • task reminder:  8  h cooldown
 *   • scan follow-up: 24 h cooldown
 *
 *   The engine asks `shouldDeliver(kind, key)` before queuing.
 *   When false, the candidate is dropped silently — no second
 *   "you might want to check…" inside the cooldown window.
 *
 * STORAGE
 *   localStorage key `farroway_notif_dedup_v1`. Map of
 *   `${kind}:${key}` → ISO timestamp of last delivery. Capped at
 *   200 entries (oldest dropped first).
 *
 * SAFETY
 *   • Never throws on quota / private mode / corrupt JSON.
 *   • SSR-safe (every storage access guarded).
 *   • Pure read helpers stay side-effect free.
 */

export const DEDUP_KEY = 'farroway_notif_dedup_v1';
export const MAX_TRACKED = 200;

// ─── Per-user scoping ────────────────────────────────────────────
// The dedup map is stored under `${DEDUP_KEY}::${userId}` so two
// accounts sharing a device don't inherit each other's cooldowns.
// When no user id is set we fall back to `::__device` so the legacy
// single-user behaviour is preserved.
//
//   setActiveUserId('user_123');  // call once after sign-in
//   setActiveUserId(null);        // optional — call on sign-out
//
// Reads/writes route through the SCOPED key automatically — call
// sites do not need to know which user is active. The active-id
// state is module-level (not localStorage) so a fresh tab boots
// with `__device` until the auth layer rebinds.
let _activeUserId = null;

export function setActiveUserId(userId) {
  const next = (userId == null || userId === '') ? null : String(userId);
  _activeUserId = next;
}

export function getActiveUserId() {
  return _activeUserId;
}

function _storageKey() {
  const suffix = _activeUserId || '__device';
  return `${DEDUP_KEY}::${suffix}`;
}

// Cooldowns in milliseconds (per spec §12 + trusted-daily §3).
//   • progress (encouragement) bumped to 72 h so a farmer hears a
//     "nice work" / evening summary at most every 3 days — the
//     §3 rule "max 1 encouragement every 3 days".
export const COOLDOWN = Object.freeze({
  weather:         12 * 60 * 60 * 1000,
  task:             8 * 60 * 60 * 1000,
  task_reminder:    8 * 60 * 60 * 1000,
  scan_followup:   24 * 60 * 60 * 1000,
  scan:            24 * 60 * 60 * 1000,
  buyer:            6 * 60 * 60 * 1000,
  funding:         24 * 60 * 60 * 1000,
  progress:        72 * 60 * 60 * 1000,
  // Default for unknown kinds — generous so we never accidentally
  // spam a new category.
  default:         12 * 60 * 60 * 1000,
});

function _read() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(_storageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch { return {}; }
}

function _write(map) {
  try {
    if (typeof localStorage === 'undefined') return;
    // Cap the map at MAX_TRACKED entries — when we exceed the
    // ceiling, drop the oldest timestamps.
    const key = _storageKey();
    const entries = Object.entries(map);
    if (entries.length > MAX_TRACKED) {
      entries.sort((a, b) => Date.parse(a[1] || '') - Date.parse(b[1] || ''));
      const trimmed = entries.slice(entries.length - MAX_TRACKED);
      const out = {};
      for (const [k, v] of trimmed) out[k] = v;
      localStorage.setItem(key, JSON.stringify(out));
      return;
    }
    localStorage.setItem(key, JSON.stringify(map));
  } catch { /* quota — non-fatal */ }
}

function _isoNow() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function _cooldownMs(kind) {
  const ms = COOLDOWN[String(kind)];
  return Number.isFinite(ms) ? ms : COOLDOWN.default;
}

/**
 * True when a candidate of `(kind, key)` has not been delivered
 * inside its cooldown window. The optional `now` argument lets
 * tests freeze time without monkey-patching.
 *
 * @param {string} kind  — 'weather' | 'task' | 'scan_followup' | …
 * @param {string} [key] — opt — narrows dedup (e.g. taskId)
 * @param {Date}   [now]
 * @returns {boolean}
 */
export function shouldDeliver(kind, key = '', now = new Date()) {
  if (!kind) return false;
  const id = `${kind}:${String(key || '')}`;
  const map = _read();
  const last = Date.parse(map[id] || '');
  if (!Number.isFinite(last)) return true;
  const cooldown = _cooldownMs(kind);
  const elapsed = (now instanceof Date ? now.getTime() : Date.now()) - last;
  return elapsed >= cooldown;
}

/**
 * Mark a `(kind, key)` as delivered. Subsequent shouldDeliver
 * calls for the same pair return false until the cooldown
 * elapses.
 */
export function markDelivered(kind, key = '', when = new Date()) {
  if (!kind) return;
  const id = `${kind}:${String(key || '')}`;
  const map = _read();
  map[id] = (when instanceof Date) ? when.toISOString() : _isoNow();
  _write(map);
}

/**
 * Count deliveries recorded at or after `since`. Optionally narrow
 * to a single `kind`. Used by the engine to enforce the spec §3
 * daily ceilings (max 2/day total, max 1 weather/day).
 *
 *   countDeliveredSince(dayStart)            → total today
 *   countDeliveredSince(dayStart, 'weather') → weather only today
 *
 * Never throws — returns 0 if the store is corrupt or absent so a
 * storage blip can't accidentally suppress every notification.
 *
 * @param {Date}   since
 * @param {string} [kind]
 * @returns {number}
 */
export function countDeliveredSince(since, kind = null) {
  try {
    const map = _read();
    const sinceMs = (since instanceof Date) ? since.getTime() : Date.parse(since);
    if (!Number.isFinite(sinceMs)) return 0;
    let n = 0;
    for (const [id, ts] of Object.entries(map)) {
      const ms = Date.parse(ts || '');
      if (!Number.isFinite(ms)) continue;
      if (ms < sinceMs) continue;
      if (kind) {
        // Stored ids are `${kind}:${key}`. We compare the kind prefix.
        const colon = id.indexOf(':');
        const idKind = colon >= 0 ? id.slice(0, colon) : id;
        if (idKind !== kind) continue;
      }
      n += 1;
    }
    return n;
  } catch { return 0; }
}

/**
 * Forget every recorded delivery — used by tests + sign-out.
 */
export function clearDedup() {
  try {
    if (typeof localStorage === 'undefined') return;
    // Wipe ONLY the active-user scope. The other-user scope's
    // cooldowns must survive (their own device session may still
    // be live in another browser).
    localStorage.removeItem(_storageKey());
  } catch { /* swallow */ }
}

/**
 * Wipe every scoped dedup map on this device — used on full
 * factory-reset / sign-out-everywhere flows. Iterates the storage
 * keys instead of just removing the active scope.
 */
export function clearAllDedupScopes() {
  try {
    if (typeof localStorage === 'undefined') return;
    const prefix = `${DEDUP_KEY}::`;
    // Snapshot the keys first — mutating localStorage while
    // iterating its length is implementation-defined.
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (typeof k === 'string' && k.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
    // Also clear the legacy un-scoped key from before this change
    // landed, so a single-user device upgrading doesn't keep stale
    // cooldowns forever.
    try { localStorage.removeItem(DEDUP_KEY); } catch { /* ignore */ }
  } catch { /* swallow */ }
}

/**
 * Inspect the underlying store (test helper).
 */
export function _readDedupMap() { return _read(); }

const _module = {
  DEDUP_KEY,
  MAX_TRACKED,
  COOLDOWN,
  shouldDeliver,
  markDelivered,
  countDeliveredSince,
  clearDedup,
  clearAllDedupScopes,
  setActiveUserId,
  getActiveUserId,
  _readDedupMap,
};
export default _module;
