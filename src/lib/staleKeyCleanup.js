/**
 * staleKeyCleanup — safe migration / removal of obsolete
 * Farroway localStorage keys (May 2026 production hardening
 * pass §8).
 *
 *   import { cleanupStaleKeys } from 'src/lib/staleKeyCleanup.js';
 *   cleanupStaleKeys();   // call once at app boot
 *
 * RULES (mandatory)
 *   • NEVER call `localStorage.clear()`. We only remove keys
 *     that appear on the curated `STALE_KEYS` list. Anything
 *     not on that list is left untouched.
 *   • NEVER touch tokens / sessions / auth state — those keys
 *     are explicitly excluded by the allow-list pattern.
 *   • Idempotent — calling twice is a no-op.
 *   • SSR-safe — silently no-ops when localStorage is unavailable.
 *   • Never throws. Each removal wrapped in try/catch.
 *
 * STALE_KEYS POLICY
 *   Add a key here ONLY when:
 *     1. The key was used by a prior pilot/version of Farroway,
 *     2. The key's data shape is no longer compatible with
 *        current code paths,
 *     3. Leaving the key behind risks a stale-state bug,
 *     4. The user can recreate the data without loss.
 *
 *   Each entry carries a comment explaining what it was + why
 *   we're removing it. The annotation is the audit trail.
 */

// ─── Curated stale-key allow-list ────────────────────────────────
//
// Order: oldest deprecation at top, newest at bottom. Each entry
// is a string OR a { key, reason } envelope. The audit trail is
// the comment + the dated reason — not git blame, since these
// entries outlive most file rewrites.
export const STALE_KEYS = Object.freeze([
  // Pre-pilot v1 dashboard cache — schema replaced by the new
  // PilotHome / WeatherHeroActionCard pipeline. The old payload
  // shape includes fields (`mood`, `oldStreak`, `legacyAlert`)
  // that no current consumer reads, and re-hydrating them on
  // boot triggered the "ghost task" complaint in early-pilot QA.
  'farroway_dashboard_v1',
  'farroway_dashboard_legacy',

  // Pre-Soft-Ochre (Apr 2025) theme persistence — was used to
  // toggle the legacy dark-green palette per device. The Soft
  // Ochre token system shipped May 2026 is now the only theme;
  // the persisted toggle does nothing but bloat localStorage.
  'farroway_theme_legacy',
  'farroway_dark_mode_v1',

  // Pre-canonical /scan-crop history. The canonical /scan flow
  // writes to `farroway_scan_history_v1` (still active, kept).
  // The legacy `farroway_camera_scans` slot was the
  // CameraScanPage's per-device store before /scan-crop was
  // redirected to /scan in the canonical-lock pass.
  'farroway_camera_scans',
  'farroway_camera_history',

  // Pre-orchestration memory slot. The current orchestrator
  // uses `farroway_orch_memory_v1`. The earlier slot was
  // shaped differently and reading it would crash the new
  // continuity-memory consumer.
  'farroway_home_memory',

  // Pre-coordination event queue. Replaced by the canonical
  // `farroway_orch_events_v1` ring buffer.
  'farroway_event_queue',

  // Pre-pilot funding cache. The canonical store key is
  // `farroway_funding_opportunities` (still active). Older
  // pilots used these slot names with different shapes.
  'farroway_funding_cache',
  'farroway_grants_cache',

  // Pre-OnTrack streak v1 (replaced by the daily-habit hook
  // backed by `farroway:lastTaskCompletedAt`).
  'farroway_streak_v1',
]);

// Auth-related key prefixes we MUST NEVER touch, even if a
// future entry on STALE_KEYS accidentally matches them.
// Defence-in-depth: a typo in STALE_KEYS won't log out the
// user.
const PROTECTED_PREFIXES = Object.freeze([
  'auth_',
  'farroway_auth_',
  'session_',
  'access_token',
  'refresh_token',
  'jwt_',
  'csrf_',
]);

function _isProtected(key) {
  if (typeof key !== 'string') return true; // refuse non-strings outright
  for (const p of PROTECTED_PREFIXES) {
    if (key.startsWith(p)) return true;
  }
  return false;
}

function _hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch { return false; }
}

/**
 * Run the stale-key cleanup. Returns the list of keys that
 * were actually removed (or `[]` when nothing matched / no
 * storage available). Never throws.
 *
 * @returns {Array<string>}
 */
export function cleanupStaleKeys() {
  const removed = [];
  if (!_hasLocalStorage()) return removed;

  for (const entry of STALE_KEYS) {
    const key = typeof entry === 'string' ? entry : (entry && entry.key);
    if (!key || _isProtected(key)) continue;
    try {
      // Only remove if the key actually exists — avoids the
      // appearance of "removing" something that wasn't there
      // and keeps the returned list accurate.
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        removed.push(key);
      }
    } catch { /* per-key — never propagate */ }
  }
  return removed;
}

/**
 * Inspect what WOULD be removed without actually removing it.
 * Used by tests + an admin debug view.
 *
 * @returns {Array<string>}
 */
export function previewStaleKeys() {
  if (!_hasLocalStorage()) return [];
  const present = [];
  for (const entry of STALE_KEYS) {
    const key = typeof entry === 'string' ? entry : (entry && entry.key);
    if (!key || _isProtected(key)) continue;
    try {
      if (localStorage.getItem(key) !== null) present.push(key);
    } catch { /* swallow */ }
  }
  return present;
}

const _module = {
  STALE_KEYS,
  cleanupStaleKeys,
  previewStaleKeys,
};
export default _module;
