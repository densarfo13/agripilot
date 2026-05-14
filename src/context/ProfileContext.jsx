import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getFarmProfile, saveFarmProfile, getFarms, switchActiveFarm as apiSwitchFarm, setDefaultFarm as apiSetDefault, updateFarm as apiUpdateFarm } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useNetwork } from './NetworkContext.jsx';
import { safeTrackEvent } from '../lib/analytics.js';
import { saveProfileLocalFirst, readProfileLocal } from '../services/farmService.js';
import {
  saveProfileDraft,
  getProfileDraft,
  enqueueProfileSync,
  getSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueItem,
  saveSyncMeta,
  getSyncMeta,
} from '../lib/offlineDb.js';
import { log } from '../lib/logger.js';
// Emergency Active Farm Hydration Fix — bridge between the
// backend-hydrated profile farms and the canonical localStorage
// reader that powers Home / Tasks / Scan / Sell. Without this
// mirror, Home stays empty even when My Farm shows farms because
// it reads localStorage and ProfileContext only stores farms in
// React state.
import { FarmEvents, publish as _publishFarmEvent } from '../lib/farmEventBus.js';

const ProfileContext = createContext(null);

const CURRENT_FARM_KEY = 'agripilot_currentFarmId';
const CANONICAL_FARMS_KEY        = 'farroway.farms';
const CANONICAL_ACTIVE_FARM_KEY  = 'farroway.activeFarmId';
const CANONICAL_ACTIVE_EXPERIENCE = 'farroway_active_experience';

/**
 * Mirror the backend-hydrated farms into the canonical localStorage
 * shape so Home / Tasks / Sell — which all read via
 * farmContextEngine — see the same farms My Farm renders.
 *
 * Idempotent + never throws. Publishes FARM_CREATED on the typed
 * bus so reactive subscribers (useFarmContext) re-render.
 */
function mirrorFarmsToCanonical(farms, activeFarmId) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!Array.isArray(farms)) return;
    // Only write when the shape actually changed — avoids loops
    // when ProfileContext re-renders with the same farms array.
    const prevRaw = localStorage.getItem(CANONICAL_FARMS_KEY);
    const nextRaw = JSON.stringify(farms);
    const idChanged = activeFarmId
      && activeFarmId !== localStorage.getItem(CANONICAL_ACTIVE_FARM_KEY);
    if (prevRaw === nextRaw && !idChanged) return;
    localStorage.setItem(CANONICAL_FARMS_KEY, nextRaw);
    if (activeFarmId) {
      localStorage.setItem(CANONICAL_ACTIVE_FARM_KEY, String(activeFarmId));
      // Ensure the experience is pinned to 'farm' so legacy
      // surfaces that gate on activeExperience surface the farm
      // (a missing pin used to default to null and suppress the
      // entity render).
      if (!localStorage.getItem(CANONICAL_ACTIVE_EXPERIENCE)) {
        localStorage.setItem(CANONICAL_ACTIVE_EXPERIENCE, 'farm');
      }
    }
    _publishFarmEvent(FarmEvents.FARM_CREATED, {
      source:  'profile_context_mirror',
      farmId:  activeFarmId || null,
      count:   farms.length,
    });
  } catch { /* swallow — never break ProfileContext on a storage error */ }
}

function nextBackoffMs(retryCount) {
  return Math.min(1000 * Math.pow(2, retryCount), 60000);
}

/** Read persisted farm selection from localStorage (safe for SSR/errors) */
function getPersistedFarmId() {
  try { return localStorage.getItem(CURRENT_FARM_KEY) || null; } catch { return null; }
}

/** Write persisted farm selection to localStorage */
function persistFarmId(farmId) {
  try {
    if (farmId) localStorage.setItem(CURRENT_FARM_KEY, farmId);
    else localStorage.removeItem(CURRENT_FARM_KEY);
  } catch { /* ignore storage errors */ }
}

/**
 * Resolve the current farm from the farms list:
 * 1. Persisted farm ID (if still active)
 * 2. Default farm (isDefault === true)
 * 3. First active farm
 * Returns null if no active farms exist.
 */
function resolveCurrentFarm(farms, persistedId) {
  const active = farms.filter((f) => f.status === 'active');
  if (active.length === 0) return null;

  // 1. Persisted selection (if still valid & active)
  if (persistedId) {
    const persisted = active.find((f) => f.id === persistedId);
    if (persisted) return persisted;
  }

  // 2. Default farm
  const defaultFarm = active.find((f) => f.isDefault);
  if (defaultFarm) return defaultFarm;

  // 3. First active (most recently updated)
  return active[0];
}

/**
 * Sort farms: active first, default first, then most recently updated.
 * Archived farms sorted last.
 */
function sortFarms(farms) {
  return [...farms].sort((a, b) => {
    // Active before inactive/archived
    const statusOrder = { active: 0, inactive: 1, archived: 2 };
    const sa = statusOrder[a.status] ?? 1;
    const sb = statusOrder[b.status] ?? 1;
    if (sa !== sb) return sa - sb;

    // Default first within same status
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;

    // Most recently updated first
    const ua = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const ub = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return ub - ua;
  });
}

export function ProfileProvider({ children }) {
  const { isAuthenticated, authLoading } = useAuth();
  const { isOnline } = useNetwork();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [farms, setFarms] = useState([]);  // all farms for this user
  const [farmSwitching, setFarmSwitching] = useState(false); // true while switching farms
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | error
  const [syncMeta, setSyncMeta] = useState({ lastSyncedAt: null, pendingCount: 0, lastError: null });
  const flushingRef = useRef(false);
  const savingRef = useRef(false);

  // ─── Synchronous auth-transition reset (runs DURING render, not after) ───
  // React's documented "adjusting state when a prop changes" pattern. The
  // setState calls below are SAFE to fire in render — React batches them and
  // re-renders with the new state before committing.
  //
  // ─── React #300 hardening (May 2026) ──────────────────────
  // ANY non-setState side effect was previously running here too —
  // specifically `persistFarmId(null)` on logout, which writes to
  // localStorage during render. That violates render-purity and
  // can surface as React error #300 ("Cannot update a component
  // while rendering a different component") under StrictMode's
  // double-render. The localStorage write is now hoisted into a
  // useEffect below; the in-render block keeps ONLY setState calls.
  const [prevAuth, setPrevAuth] = useState(isAuthenticated);
  if (isAuthenticated !== prevAuth) {
    setPrevAuth(isAuthenticated);
    if (isAuthenticated && !prevAuth) {
      // Just logged in — reset so ProfileGuard shows loading, not stale redirect
      setInitialized(false);
      setProfile(null);
      setLoading(true);
    }
    if (!isAuthenticated && prevAuth) {
      // Logged out — clear immediately
      setProfile(null);
      setInitialized(false);
      // persistFarmId moved to the useEffect below.
    }
  }
  // Side effect for the logout transition. useEffect runs AFTER
  // commit, so the localStorage write happens once the in-render
  // setState calls above have already taken effect. Safe under
  // StrictMode double-render because persistFarmId(null) is
  // idempotent.
  useEffect(() => {
    if (!isAuthenticated && prevAuth) {
      try { persistFarmId(null); } catch { /* tolerate */ }
    }
  }, [isAuthenticated, prevAuth]);

  const refreshSyncMeta = useCallback(async () => {
    try {
      const queue = await getSyncQueue();
      const meta = await getSyncMeta();
      const updated = { ...meta, pendingCount: queue.length };
      setSyncMeta(updated);
      return updated;
    } catch {
      return syncMeta;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshFarms = useCallback(async () => {
    if (!isAuthenticated || !isOnline) return [];
    try {
      const data = await getFarms();
      // Farm API 500 Error Audit — getFarms now ALWAYS resolves
      // to an envelope. If `failed === true`, the API errored
      // after retries — preserve the last-known-good farms state
      // and skip the mirror so a transient 500 never clobbers a
      // real local farm with "No farm added yet".
      if (data && data.failed) {
        return farms; // keep current React state untouched
      }
      const list = (data && data.farms) || [];
      const sorted = sortFarms(list);
      setFarms(sorted);
      // Emergency Active Farm Hydration Fix — mirror backend farms
      // to the canonical localStorage shape so Home / Tasks / Sell
      // (which read via farmContextEngine) see the same farms My
      // Farm renders. Active id derived from persisted selection,
      // server default farm, or the first active row — same order
      // resolveCurrentFarm uses. Skip the mirror when the backend
      // returned 0 farms BUT we already have local rows (transient
      // empty response after a server cold-start could otherwise
      // wipe canonical state).
      try {
        const persistedId = getPersistedFarmId();
        const resolved    = resolveCurrentFarm(sorted, persistedId);
        const activeId    = resolved ? resolved.id : null;
        if (sorted.length > 0) {
          mirrorFarmsToCanonical(sorted, activeId);
        }
      } catch { /* swallow */ }
      return sorted;
    } catch {
      return farms;
    }
  }, [isAuthenticated, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setInitialized(true);
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      if (isOnline) {
        const data = await getFarmProfile();
        const serverProfile = data.profile || null;
        setProfile(serverProfile);
        if (serverProfile) {
          await saveProfileDraft(serverProfile);
          persistFarmId(serverProfile.id);
          // Emergency Active Farm Hydration Fix — also write the
          // active id to the canonical pointer key so Home reads
          // the same active farm My Farm does. The full farms[]
          // mirror happens in refreshFarms; this just covers the
          // case where the profile loads before farms.
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(CANONICAL_ACTIVE_FARM_KEY, String(serverProfile.id));
              if (!localStorage.getItem(CANONICAL_ACTIVE_EXPERIENCE)) {
                localStorage.setItem(CANONICAL_ACTIVE_EXPERIENCE, 'farm');
              }
            }
          } catch { /* swallow */ }
        }
        return serverProfile;
      } else {
        // Offline: check recent writes first (local-first), then IndexedDB draft
        const local = await readProfileLocal();
        setProfile(local);
        return local;
      }
    } catch {
      // Network error: serve local data
      const local = await readProfileLocal();
      if (local) setProfile(local);
      return local || null;
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [isAuthenticated, isOnline]);

  /**
   * Switch to a specific farm by ID.
   * - Sets as default on backend
   * - Updates profile to the switched farm
   * - Persists selection to localStorage
   * - Sets farmSwitching=true during transition
   */
  const switchFarm = useCallback(async (farmId) => {
    if (!isOnline) throw new Error('Cannot switch farms while offline');
    setFarmSwitching(true);
    try {
      const data = await apiSetDefault(farmId);
      const switched = data.profile || null;
      setProfile(switched);
      if (switched) {
        await saveProfileDraft(switched);
        persistFarmId(switched.id);
      }
      // Refresh full farms list to reflect new default
      await refreshFarms();
      safeTrackEvent('farm.switched', { farmId });
      return switched;
    } finally {
      setFarmSwitching(false);
    }
  }, [isOnline, refreshFarms]);

  /**
   * Edit an existing farm (partial update).
   * Ownership verified server-side.
   */
  const editFarm = useCallback(async (farmId, payload) => {
    const data = await apiUpdateFarm(farmId, payload);
    const updated = data.profile || null;
    // If editing the currently active farm, update profile in context
    if (updated && updated.id === profile?.id) {
      setProfile(updated);
      await saveProfileDraft(updated);
    }
    // Refresh farms list to show updated data
    await refreshFarms();
    safeTrackEvent('farm.edited', { farmId, fields: Object.keys(payload) });
    return updated;
  }, [profile?.id, refreshFarms]);

  const saveProfileOfflineAware = useCallback(async (payload) => {
    if (savingRef.current) return { profile: payload, skipped: true };
    savingRef.current = true;
    try {
      // Optimistic UI update — show new data immediately
      setProfile((prev) => ({ ...prev, ...payload }));

      // Delegate to centralized farmService (local-first + background sync)
      const result = await saveProfileLocalFirst(payload, { isOnline });

      // Update with server-confirmed data if available
      setProfile(result.profile);
      if (result.profile?.id) persistFarmId(result.profile.id);

      if (result.offline) {
        // Ensure item is queued for background sync (enqueueProfileSync(payload))
        enqueueProfileSync(payload);
        setSyncStatus('idle');
        log('farm', 'profile_save_offline');
      } else {
        setSyncStatus('synced');
        await saveSyncMeta({ lastSyncedAt: Date.now(), lastError: null });
      }
      await refreshSyncMeta();
      return { profile: result.profile, offline: result.offline };
    } catch (err) {
      setSyncStatus('error');
      await saveSyncMeta({ lastError: err.message || 'Save failed' }).catch(() => {});
      await refreshSyncMeta();
      log('farm', 'profile_save_error', { status: err.status, message: err.message });
      throw err;
    } finally {
      savingRef.current = false;
    }
  }, [isOnline, refreshSyncMeta]);

  // Computed: active farms only (excludes inactive/archived)
  const activeFarms = useMemo(
    () => farms.filter((f) => f.status === 'active'),
    [farms],
  );

  // Current farm ID (derived from profile)
  const currentFarmId = profile?.id || null;

  const flushSyncQueue = useCallback(async () => {
    if (!isOnline) return;
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const queue = await getSyncQueue();
      if (queue.length === 0) return;

      setSyncStatus('syncing');
      for (const item of queue) {
        if (item.type === 'SAVE_PROFILE') {
          // Exponential backoff — skip items not yet ready for retry
          if (item.nextRetryAt && Date.now() < item.nextRetryAt) continue;

          try {
            const headers = {};
            if (item.idempotencyKey) {
              headers['X-Idempotency-Key'] = item.idempotencyKey;
            }
            await saveFarmProfile(item.payload, { headers });
            await removeSyncQueueItem(item.id);
            safeTrackEvent('profile.sync.success', { itemId: item.id });
          } catch (err) {
            // STALE-ITEM DETECTION (Apr 2026 pilot fix)
            // saveFarmProfile's pre-flight guard rejects queue
            // items with empty crop using `err.skippedNetwork`.
            // These can never succeed — the queued payload itself
            // is malformed — so drop them immediately instead of
            // looping the user through 400-retry backoff forever.
            if (err && err.skippedNetwork) {
              try { console.warn('[profile.sync] dropped unsendable item', item.id, err.fieldErrors); }
              catch { /* ignore */ }
              await removeSyncQueueItem(item.id);
              safeTrackEvent('profile.sync.dropped', { itemId: item.id, reason: 'skipped_network' });
              continue;
            }
            const retryCount = (item.retryCount || 0) + 1;
            // MAX-ATTEMPTS GIVE-UP: 8 retries with exponential
            // backoff is plenty. After that the queue item is
            // almost certainly stale or schema-mismatched —
            // drop it rather than retry forever.
            const MAX_RETRIES = 8;
            if (retryCount >= MAX_RETRIES) {
              try { console.warn('[profile.sync] gave up after', retryCount, 'retries — dropping item', item.id); }
              catch { /* ignore */ }
              await removeSyncQueueItem(item.id);
              safeTrackEvent('profile.sync.abandoned', { itemId: item.id, retryCount });
              continue;
            }
            const delay = nextBackoffMs(retryCount);
            await updateSyncQueueItem(item.id, {
              retryCount,
              nextRetryAt: Date.now() + delay,
            });
            await saveSyncMeta({ lastError: `Retry ${retryCount} scheduled` });
            setSyncStatus('error');
            safeTrackEvent('profile.sync.failed', { itemId: item.id, retryCount });
            await refreshSyncMeta();
            return;
          }
        }
      }
      setSyncStatus('synced');
      await saveSyncMeta({ lastSyncedAt: Date.now(), lastError: null });
      await refreshSyncMeta();
      await refreshProfile();
    } finally {
      flushingRef.current = false;
    }
  }, [isOnline, refreshProfile, refreshSyncMeta]);

  // Flush sync queue when coming back online
  useEffect(() => {
    if (isOnline && isAuthenticated && initialized) {
      flushSyncQueue();
    }
  }, [isOnline, isAuthenticated, initialized, flushSyncQueue]);

  useEffect(() => {
    if (!authLoading) {
      refreshProfile().then((prof) => {
        // Non-blocking: load farms list after active profile is set
        refreshFarms().then((farmsList) => {
          // If server returned a profile, check if persisted selection differs
          if (prof && farmsList.length > 0) {
            const persistedId = getPersistedFarmId();
            if (persistedId && persistedId !== prof.id) {
              // Persisted selection differs from server default — resolve
              const resolved = resolveCurrentFarm(farmsList, persistedId);
              if (resolved && resolved.id !== prof.id) {
                // Switch to persisted farm (non-blocking, don't fail init)
                apiSetDefault(resolved.id).then((data) => {
                  const switched = data.profile || null;
                  if (switched) {
                    setProfile(switched);
                    saveProfileDraft(switched);
                  }
                }).catch(() => {});
              }
            }
          }
        }).catch(() => {});
      }).catch(() => {
        setLoading(false);
        setInitialized(true);
      });
    }
  }, [authLoading, refreshProfile, refreshFarms]);

  // Load sync meta on init
  useEffect(() => {
    if (initialized) refreshSyncMeta();
  }, [initialized, refreshSyncMeta]);

  const value = useMemo(
    () => ({
      profile,
      farms,
      activeFarms,
      currentFarmId,
      loading,
      initialized,
      farmSwitching,
      syncStatus,
      syncMeta,
      refreshProfile,
      refreshFarms,
      refreshSyncMeta,
      saveProfile: saveProfileOfflineAware,
      switchFarm,
      editFarm,
      setProfile,
    }),
    [profile, farms, activeFarms, currentFarmId, loading, initialized, farmSwitching, syncStatus, syncMeta, refreshProfile, refreshFarms, refreshSyncMeta, saveProfileOfflineAware, switchFarm, editFarm],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
}

/**
 * useProfileOrNull — non-throwing variant for surfaces that
 * render BOTH inside and outside the ProfileProvider tree
 * (e.g. BottomTabNav on the login page, VoiceAssistant during
 * onboarding).
 *
 * Returns the context object when available, `null` when the
 * provider isn't mounted. NEVER throws — and crucially does NOT
 * wrap the hook call in try/catch (which would desync React's
 * internal hook counter and surface as the minified error #310
 * "Rendered more hooks than during the previous render").
 *
 * Usage:
 *   const profileCtx = useProfileOrNull();
 *   const profile = profileCtx?.profile || null;
 */
export function useProfileOrNull() {
  return useContext(ProfileContext);
}
