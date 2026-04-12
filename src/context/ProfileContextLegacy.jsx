import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useFarmStore } from '../store/farmStore.js';

const ProfileContext = createContext(null);

/**
 * Legacy profile context — loads farm profile once via existing farmStore/API,
 * provides it to all children (dashboard, badge, guard) without duplicate fetches.
 * Used by the existing Bearer-token auth flow (staff + existing farmer routes).
 */
export function ProfileProvider({ children }) {
  const { fetchProfiles, createProfile, updateProfile, currentProfile } = useFarmStore();
  const [profile, setProfile] = useState(currentProfile || null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    try {
      const profiles = await fetchProfiles();
      const latest = profiles?.[0] || null;
      setProfile(latest);
      return latest;
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [fetchProfiles]);

  const saveProfile = useCallback(async (payload) => {
    const existing = profile || currentProfile;
    let result;
    if (existing?.id) {
      result = await updateProfile(existing.id, payload);
    } else {
      result = await createProfile(payload);
    }
    const updated = result?.profile || result;
    if (updated) setProfile(updated);
    return result;
  }, [profile, currentProfile, createProfile, updateProfile]);

  useEffect(() => {
    refreshProfile().catch((err) => {
      console.error('Failed to initialize profile context:', err);
      setLoading(false);
      setInitialized(true);
    });
  }, [refreshProfile]);

  const value = useMemo(() => ({
    profile,
    loading,
    initialized,
    refreshProfile,
    saveProfile,
    setProfile,
  }), [profile, loading, initialized, refreshProfile, saveProfile]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
