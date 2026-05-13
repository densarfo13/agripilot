/**
 * stateMigration.js — versioned localStorage migration with a
 * sessionStorage loop guard.
 *
 *   import { runStateMigration, CURRENT_STATE_VERSION } from './lib/stateMigration.js';
 *
 *   // At the very top of main.jsx:
 *   runStateMigration();
 *
 * What it does
 *   1. Reads `farroway_state_version` from localStorage.
 *   2. If it matches CURRENT_STATE_VERSION, no-op.
 *   3. If missing or older:
 *      a. Validates each known key's parsed shape.
 *      b. Removes every key whose value can't be migrated to the
 *         new shape (the safest default — the rest of the app
 *         falls back to defaults.js gracefully).
 *      c. Stamps the new version.
 *      d. Sets a sessionStorage flag so we DON'T enter a reload
 *         loop on the next boot. Subsequent migrations only
 *         reload when the flag is absent.
 *
 * Strict-rule audit
 *   • Synchronous; never throws.
 *   • NEVER signs the user out — auth keys are protected by
 *     storageSafe.removeFarrowayState() (which we do NOT call;
 *     we do per-key drop instead, so even broader sweeps don't
 *     touch farroway_token / farroway_user).
 *   • Loop-safe — sessionStorage `farroway_migrated_once` flag
 *     ensures we never reload twice in a single session even
 *     if some parallel writer keeps re-corrupting state.
 *   • Idempotent: running it repeatedly with the same version
 *     in storage is a no-op.
 */

import {
  safeJsonParse,
  validateFarm,
  validateTask,
  validateWeather,
  FARROWAY_AUTH_KEYS,
} from './storageSafe.js';

// Bump this whenever the persisted-state shape changes in a way
// the previous build can't read. Format: YYYY-MM-DD-state-vN.
//
// v7 — drops cached task payloads so the legacy "Start logging
//      farm costs to track profitability" / "Keep logging
//      harvest…" entries can't surface from a stale cache.
// v8 — direction-fix: replace the lexicographic compare in the
//      direction guard below with a monotonic integer sequence
//      (CURRENT_STATE_SEQUENCE). Lexicographic compare misordered
//      same-day version strings such that the guard skipped
//      legitimate migrations and left users on stale state.
export const CURRENT_STATE_VERSION = '2026-05-04-state-v8';

// Monotonically-increasing state-schema sequence — drives the
// direction guard. Bump on every release that changes
// CURRENT_STATE_VERSION. The sequence is the only source of
// truth for "newer vs older"; the version string is just a
// human-readable label.
export const CURRENT_STATE_SEQUENCE = 8;

const STATE_VERSION_KEY     = 'farroway_state_version';
const STATE_SEQUENCE_KEY    = 'farroway_state_sequence';
// Spec §4 — sessionStorage flag preventing a migration loop in
// the same browser-tab session. Renamed from the prior
// 'farroway_migrated_once' to match the spec exactly. Older
// flag is also honoured for back-compat so a tab open across
// the rename doesn't trigger a second migration.
const MIGRATED_ONCE_FLAG    = 'farroway_migration_ran_once';
const LEGACY_MIGRATED_FLAG  = 'farroway_migrated_once';

// Per-key validators. Keys NOT in this map are removed unconditionally
// when the version changes (we'd rather lose a stale cache than have
// it crash a render).
const VALIDATORS = Object.freeze({
  farroway_active_farm:    validateFarm,
  farroway_cached_tasks:   (v) => Array.isArray(v) && v.every(validateTask),
  farroway_cached_weather: validateWeather,
});

// Keys we always touch when a migration runs. Anything not in this
// list is left alone (we don't want to wipe arbitrary user state).
//
// v7 added the task / daily-plan / progress-task / queue keys
// below so the previous deploy's cached task payloads (which
// could carry the legacy "Start logging farm costs…" wording)
// get dropped on the next boot.
const KEYS_OWNED = Object.freeze([
  'farroway_active_farm',
  'farroway_location',
  'farroway_events',
  'farroway_user_memory',
  'farroway_farmer_source',
  'farroway_sync_queue',
  'farroway_cached_tasks',
  'farroway_cached_weather',
  'farroway_offline_state',
  'farroway_selected_crop',
  'farroway_crop_stage',
  // v7 additions — daily/today task caches.
  'farroway_today_task',
  'farroway_task_queue',
  'farroway_progress_task',
  'farroway_daily_plan',
  // Logout-loop fix v3 (spec §2) — transient setup-state blob
  // some flows write while a wizard is mid-flight. Safe to drop
  // on every migration; the wizard repopulates it from the
  // server profile on the next mount.
  'farroway_temp_setup_state',
]);

/**
 * runStateMigration()
 *
 * Returns an object describing what happened — useful for tests
 * and the debug build stamp:
 *   {
 *     ranMigration: boolean,
 *     fromVersion:  string | null,
 *     toVersion:    string,
 *     droppedKeys:  string[],
 *     reloaded:     boolean,
 *   }
 */
export function runStateMigration() {
  if (typeof localStorage === 'undefined') {
    return _result(false, null, [], false);
  }

  let stored = null;
  try { stored = localStorage.getItem(STATE_VERSION_KEY); } catch { stored = null; }

  if (stored === CURRENT_STATE_VERSION) {
    return _result(false, stored, [], false);
  }

  // Direction guard — if the stored STATE SEQUENCE is greater
  // than the in-bundle sequence, the browser is serving a stale
  // cached bundle that doesn't yet know about the newer schema.
  // Migrating + reloading would re-serve the same stale bundle,
  // which would re-fire the migration, which would reload again —
  // Chrome throttles navigation after ~5 such bounces, then the
  // user sees a blank page.
  //
  // The previous lexicographic compare on version strings misfired
  // for same-day reissues (e.g. "no-loop-v1" < "onboarding-fix-v1"
  // because 'n' < 'o' even though no-loop shipped LATER). The
  // sequence is a monotonic integer so the comparison is
  // unambiguous.
  let storedSeq = NaN;
  try {
    const raw = localStorage.getItem(STATE_SEQUENCE_KEY);
    if (raw != null) storedSeq = Number(raw);
  } catch { storedSeq = NaN; }
  if (Number.isFinite(storedSeq) && storedSeq > CURRENT_STATE_SEQUENCE) {
    try {
       
      console.warn(
        '[Farroway] State migration skipped: stale bundle '
        + '(in-bundle seq ' + CURRENT_STATE_SEQUENCE
        + ' < stored seq ' + storedSeq + ').'
      );
    } catch { /* swallow */ }
    return _result(false, stored, [], false);
  }

  // Loop guard — if we've already migrated once in this tab session,
  // do NOT reload again even if the version still doesn't match.
  // (The page is already running the latest code; one reload is
  // enough.) Honours both the new spec-named flag and the legacy
  // name so a tab open across the rename doesn't double-migrate.
  let migratedOnce = false;
  try {
    if (typeof sessionStorage !== 'undefined') {
      migratedOnce = sessionStorage.getItem(MIGRATED_ONCE_FLAG)   === '1'
                  || sessionStorage.getItem(MIGRATED_ONCE_FLAG)   === 'true'
                  || sessionStorage.getItem(LEGACY_MIGRATED_FLAG) === '1';
    }
  } catch { migratedOnce = false; }

  // Walk owned keys. Validate; drop on any failure.
  const droppedKeys = [];
  for (const key of KEYS_OWNED) {
    const parsed = safeJsonParse(key, undefined);
    if (parsed === undefined) continue;          // missing — fine
    const validator = VALIDATORS[key];
    let ok = true;
    if (typeof validator === 'function') {
      try { ok = !!validator(parsed); } catch { ok = false; }
    } else {
      // Without a validator we err on the side of dropping — this
      // is a migration, not a passthrough. The defaults layer
      // covers the renderer for any cleared key.
      ok = false;
    }
    if (!ok) {
      try { localStorage.removeItem(key); droppedKeys.push(key); }
      catch { /* tolerate */ }
    }
  }

  // Auth NEVER gets cleared. Belt-and-braces sanity check:
  for (const k of FARROWAY_AUTH_KEYS) {
    // No-op — we never touched these. This loop is for documenting
    // intent + giving tests a hook to assert nothing was dropped.
    void k;
  }

  // Stamp the new version + sequence BEFORE a potential reload
  // so we don't loop. Both are written so the direction guard on
  // the next boot reads the up-to-date sequence.
  try { localStorage.setItem(STATE_VERSION_KEY, CURRENT_STATE_VERSION); }
  catch { /* tolerate — boot continues */ }
  try { localStorage.setItem(STATE_SEQUENCE_KEY, String(CURRENT_STATE_SEQUENCE)); }
  catch { /* tolerate — boot continues */ }

  // First run on a fresh install (no stored version yet) doesn't
  // need a reload — there's no in-memory React tree depending on
  // the cleared keys yet.
  if (stored == null) {
    return _result(true, stored, droppedKeys, false);
  }

  // Subsequent migrations: reload ONCE per session so the live
  // tree picks up the cleaned state. Subsequent boots in the same
  // session no-op even if the version still differs.
  let reloaded = false;
  if (!migratedOnce) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        // Spec §4 — write the new spec-named flag as 'true'
        // (matches the user-facing wording exactly). Both '1'
        // and 'true' are accepted by the read above.
        sessionStorage.setItem(MIGRATED_ONCE_FLAG, 'true');
      }
    } catch { /* tolerate */ }
    try {
      if (typeof window !== 'undefined' && window.location
          && typeof window.location.reload === 'function') {
        window.location.reload();
        reloaded = true;
      }
    } catch { /* tolerate */ }
  }

  return _result(true, stored, droppedKeys, reloaded);
}

function _result(ranMigration, fromVersion, droppedKeys, reloaded) {
  return {
    ranMigration,
    fromVersion,
    toVersion: CURRENT_STATE_VERSION,
    droppedKeys,
    reloaded,
  };
}

// Test hooks.
export const _internal = Object.freeze({
  STATE_VERSION_KEY,
  STATE_SEQUENCE_KEY,
  MIGRATED_ONCE_FLAG,
  KEYS_OWNED,
  VALIDATORS,
});

export default runStateMigration;
