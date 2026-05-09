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

// Cooldowns in milliseconds (per spec §12).
export const COOLDOWN = Object.freeze({
  weather:         12 * 60 * 60 * 1000,
  task:             8 * 60 * 60 * 1000,
  task_reminder:    8 * 60 * 60 * 1000,
  scan_followup:   24 * 60 * 60 * 1000,
  scan:            24 * 60 * 60 * 1000,
  buyer:            6 * 60 * 60 * 1000,
  funding:         24 * 60 * 60 * 1000,
  progress:        24 * 60 * 60 * 1000,
  // Default for unknown kinds — generous so we never accidentally
  // spam a new category.
  default:         12 * 60 * 60 * 1000,
});

function _read() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(DEDUP_KEY);
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
    const entries = Object.entries(map);
    if (entries.length > MAX_TRACKED) {
      entries.sort((a, b) => Date.parse(a[1] || '') - Date.parse(b[1] || ''));
      const trimmed = entries.slice(entries.length - MAX_TRACKED);
      const out = {};
      for (const [k, v] of trimmed) out[k] = v;
      localStorage.setItem(DEDUP_KEY, JSON.stringify(out));
      return;
    }
    localStorage.setItem(DEDUP_KEY, JSON.stringify(map));
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
 * Forget every recorded delivery — used by tests + sign-out.
 */
export function clearDedup() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(DEDUP_KEY);
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
  clearDedup,
  _readDedupMap,
};
export default _module;
