import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getFarmProfile, saveFarmProfile, getFarms, switchActiveFarm as apiSwitchFarm, setDefaultFarm as apiSetDefault, updateFarm as apiUpdateFarm } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useNetwork } from './NetworkContext.jsx';
import { safeTrackEvent } from '../lib/analytics.js';
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

const ProfileContext = createContext(null);

const CURRENT_FARM_KEY = 'agripilot_currentFarmId';

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
  // useEffect fires after render → ProfileGuard would see stale initialized=true
  // and redirect to /profile/setup before the reset. This pattern (setState during
  // render based on changed props) is React's recommended solution — React will
  // immediately re-render with the new state before committing to the DOM.
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
      persistFarmId(null);
    }
  }

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
      const list = data.farms || [];
      const sorted = sortFarms(list);
      setFarms(sorted);
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
        }
        return serverProfile;
      } else {
        const draft = await getProfileDraft();
        setProfile(draft);
        return draft;
      }
    } catch {
      const draft = await getProfileDraft();
      if (draft) setProfile(draft);
      return draft || null;
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
    await saveProfileDraft(payload);
    setProfile((prev) => ({ ...prev, ...payload }));

    if (isOnline) {
      try {
        const data = await saveFarmProfile(payload);
        const saved = data.profile || null;
        setProfile(saved);
        if (saved) {
          await saveProfileDraft(saved);
          persistFarmId(saved.id);
        }
        setSyncStatus('synced');
        await saveSyncMeta({ lastSyncedAt: Date.now(), lastError: null });
        await refreshSyncMeta();
        safeTrackEvent('profile.saved', { mode: 'online' });
        safeTrackEvent('profile.save.success', { mode: 'online' });
        return data;
      } catch (err) {
        // Network errors (no status) → queue for offline sync
        // API errors (400, 500, etc.) → re-throw so caller can show the error
        const isNetworkError = !err.status && (err.message === 'Failed to fetch' || err.name === 'TypeError');
        if (isNetworkError) {
          console.log('[ProfileContext] Network error during save, queuing for offline sync');
          await enqueueProfileSync(payload);
          setSyncStatus('error');
          await saveSyncMeta({ lastError: err.message || 'Save failed' });
          await refreshSyncMeta();
          safeTrackEvent('profile.saved', { mode: 'queued' });
          safeTrackEvent('profile.save.failed', { error: err.message || 'Save failed' });
          return { profile: payload, offline: true };
        }
        // Server returned an actual error (validation, 500, etc.) — propagate it
        console.error('[ProfileContext] API error during save:', err.status, err.message);
        setSyncStatus('error');
        safeTrackEvent('profile.save.failed', { error: err.message || 'Save failed', status: err.status });
        throw err;
      }
    } else {
      await enqueueProfileSync(payload);
      setSyncStatus('idle');
      await refreshSyncMeta();
      safeTrackEvent('profile.saved', { mode: 'offline' });
      safeTrackEvent('profile.save.offline', {});
      return { profile: payload, offline: true };
    }
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
          } catch {
            const retryCount = (item.retryCount || 0) + 1;
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
