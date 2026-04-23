/**
 * clearSessionState.js — shared-device-safe logout purge.
 *
 * The audit found that AuthContext logout cleared a couple of keys
 * but left behind stale entries that let farmer A's data bleed into
 * farmer B's session on the same phone / NGO kiosk. This helper is
 * the canonical cleanup: call it from EVERY logout path.
 *
 *   await clearSessionState()
 *     → Promise<{ clearedKeys, clearedCaches, errors[] }>
 *
 * What it wipes
 *   • Every known auth/session localStorage key (current + legacy names)
 *   • Every known farm/session-context key
 *   • Every Cache Storage entry served by the service worker
 *   • sessionStorage in full
 *
 * What it deliberately does NOT wipe
 *   • IndexedDB object stores that back offline sync — those hold
 *     data the farmer would lose without re-sync. We leave them
 *     alone; the next login prompts for a full fresh sync.
 *
 * Never throws. Individual failures are collected into `errors[]`
 * so callers can log them without interrupting logout flow.
 */

// Every localStorage key the app has ever written that carries
// session-scoped data. Additive — historical keys stay listed so
// farmers upgrading from an old bundle still get a clean logout.
const LOCAL_STORAGE_KEYS = Object.freeze([
  // Current
  'farroway:session_cache',
  'farroway:last_email',
  'farroway:pending_route',
  'farroway:active_farm_id',
  // Legacy auth bundles
  'farroway_user',
  'farroway_token',
  'farroway:access_token',
  'farroway:refresh_token',
  'farroway:user_profile',
  // Farm context
  'agripilot_currentFarmId',
  'agripilot:current_farm',
  'farroway:currentFarm',
  // Onboarding + tour flags
  'farroway:onboarding_complete',
  'farroway:tour_seen',
  // Offline queue metadata — drop stale queue pointers, not the
  // IndexedDB store itself. Queue rows survive; just the cursor.
  'farroway:sync_cursor',
  'farroway:sync_dedup',
]);

// Prefixes we sweep (for per-user scoped caches like `farroway:crop_insight:<id>`).
const LOCAL_STORAGE_PREFIXES = Object.freeze([
  'farroway:crop_insight:',
  'farroway:notifications:',
  'farroway:prefs:',
]);

export async function clearSessionState({
  localStorageRef = typeof localStorage !== 'undefined' ? localStorage : null,
  sessionStorageRef = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  cachesRef = typeof caches !== 'undefined' ? caches : null,
} = {}) {
  const cleared = { clearedKeys: [], clearedCaches: [], errors: [] };

  // ─── localStorage ─────────────────────────────────────────
  if (localStorageRef) {
    for (const key of LOCAL_STORAGE_KEYS) {
      try {
        if (localStorageRef.getItem(key) != null) {
          localStorageRef.removeItem(key);
          cleared.clearedKeys.push(key);
        }
      } catch (err) {
        cleared.errors.push({ stage: 'localStorage', key, message: String(err && err.message) });
      }
    }
    // Prefix sweep.
    try {
      const keys = [];
      for (let i = 0; i < localStorageRef.length; i += 1) {
        const k = localStorageRef.key(i);
        if (k && LOCAL_STORAGE_PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
      }
      for (const k of keys) {
        try { localStorageRef.removeItem(k); cleared.clearedKeys.push(k); }
        catch (err) {
          cleared.errors.push({ stage: 'localStorage', key: k, message: String(err && err.message) });
        }
      }
    } catch (err) {
      cleared.errors.push({ stage: 'localStorage-sweep', message: String(err && err.message) });
    }
  }

  // ─── sessionStorage ───────────────────────────────────────
  if (sessionStorageRef) {
    try { sessionStorageRef.clear(); }
    catch (err) {
      cleared.errors.push({ stage: 'sessionStorage', message: String(err && err.message) });
    }
  }

  // ─── Cache Storage (service worker) ───────────────────────
  if (cachesRef && typeof cachesRef.keys === 'function') {
    try {
      const names = await cachesRef.keys();
      for (const name of names) {
        try {
          const ok = await cachesRef.delete(name);
          if (ok) cleared.clearedCaches.push(name);
        } catch (err) {
          cleared.errors.push({ stage: 'caches', name, message: String(err && err.message) });
        }
      }
    } catch (err) {
      cleared.errors.push({ stage: 'caches-keys', message: String(err && err.message) });
    }
  }

  return cleared;
}

// Exported for tests so we can assert the exact sweep list.
export const _internal = Object.freeze({
  LOCAL_STORAGE_KEYS, LOCAL_STORAGE_PREFIXES,
});
