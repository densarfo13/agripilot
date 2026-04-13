import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getFarmProfile, saveFarmProfile } from '../lib/api.js';
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

function nextBackoffMs(retryCount) {
  return Math.min(1000 * Math.pow(2, retryCount), 60000);
}

export function ProfileProvider({ children }) {
  const { isAuthenticated, authLoading } = useAuth();
  const { isOnline } = useNetwork();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | error
  const [syncMeta, setSyncMeta] = useState({ lastSyncedAt: null, pendingCount: 0, lastError: null });
  const flushingRef = useRef(false);
  const savingRef = useRef(false);
  const prevAuthRef = useRef(isAuthenticated);

  // ─── Reset profile state on auth transition (unauth → auth) ───
  // Prevents ProfileGuard from using stale initialized=true with null profile
  // which would incorrectly redirect to /profile/setup before fetch completes.
  useEffect(() => {
    if (isAuthenticated && !prevAuthRef.current) {
      setInitialized(false);
      setProfile(null);
      setLoading(true);
    }
    if (!isAuthenticated && prevAuthRef.current) {
      // Logged out — clear profile immediately
      setProfile(null);
      setInitialized(false);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

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
        if (serverProfile) await saveProfileDraft(serverProfile);
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
        if (saved) await saveProfileDraft(saved);
        setSyncStatus('synced');
        await saveSyncMeta({ lastSyncedAt: Date.now(), lastError: null });
        await refreshSyncMeta();
        safeTrackEvent('profile.saved', { mode: 'online' });
        safeTrackEvent('profile.save.success', { mode: 'online' });
        return data;
      } catch (err) {
        await enqueueProfileSync(payload);
        setSyncStatus('error');
        await saveSyncMeta({ lastError: err.message || 'Save failed' });
        await refreshSyncMeta();
        safeTrackEvent('profile.saved', { mode: 'queued' });
        safeTrackEvent('profile.save.failed', { error: err.message || 'Save failed' });
        return { profile: payload, offline: true };
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
      refreshProfile().catch(() => {
        setLoading(false);
        setInitialized(true);
      });
    }
  }, [authLoading, refreshProfile]);

  // Load sync meta on init
  useEffect(() => {
    if (initialized) refreshSyncMeta();
  }, [initialized, refreshSyncMeta]);

  const value = useMemo(
    () => ({
      profile,
      loading,
      initialized,
      syncStatus,
      syncMeta,
      refreshProfile,
      refreshSyncMeta,
      saveProfile: saveProfileOfflineAware,
      setProfile,
    }),
    [profile, loading, initialized, syncStatus, syncMeta, refreshProfile, refreshSyncMeta, saveProfileOfflineAware],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
}
