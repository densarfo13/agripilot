import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getFarmProfile, saveFarmProfile } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useNetwork } from './NetworkContext.jsx';
import {
  saveProfileDraft,
  getProfileDraft,
  enqueueProfileSync,
  getSyncQueue,
  removeSyncQueueItem,
} from '../lib/offlineDb.js';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const { isAuthenticated, authLoading } = useAuth();
  const { isOnline } = useNetwork();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | error

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
    await saveProfileDraft(payload);
    setProfile((prev) => ({ ...prev, ...payload }));

    if (isOnline) {
      try {
        const data = await saveFarmProfile(payload);
        const saved = data.profile || null;
        setProfile(saved);
        if (saved) await saveProfileDraft(saved);
        setSyncStatus('synced');
        return data;
      } catch {
        await enqueueProfileSync(payload);
        setSyncStatus('error');
        return { profile: payload, offline: true };
      }
    } else {
      await enqueueProfileSync(payload);
      setSyncStatus('idle');
      return { profile: payload, offline: true };
    }
  }, [isOnline]);

  const flushSyncQueue = useCallback(async () => {
    if (!isOnline) return;
    const queue = await getSyncQueue();
    if (queue.length === 0) return;

    setSyncStatus('syncing');
    for (const item of queue) {
      if (item.type === 'SAVE_PROFILE') {
        try {
          await saveFarmProfile(item.payload);
          await removeSyncQueueItem(item.id);
        } catch {
          setSyncStatus('error');
          return;
        }
      }
    }
    setSyncStatus('synced');
    await refreshProfile();
  }, [isOnline, refreshProfile]);

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

  const value = useMemo(
    () => ({
      profile,
      loading,
      initialized,
      syncStatus,
      refreshProfile,
      saveProfile: saveProfileOfflineAware,
      setProfile,
    }),
    [profile, loading, initialized, syncStatus, refreshProfile, saveProfileOfflineAware],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
}
