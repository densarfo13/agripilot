import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getFarmProfile, saveFarmProfile } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const { isAuthenticated, authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setInitialized(true);
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const data = await getFarmProfile();
      setProfile(data.profile || null);
      return data.profile || null;
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [isAuthenticated]);

  const saveProfile = useCallback(async (payload) => {
    const data = await saveFarmProfile(payload);
    setProfile(data.profile || null);
    return data;
  }, []);

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
      refreshProfile,
      saveProfile,
      setProfile,
    }),
    [profile, loading, initialized, refreshProfile, saveProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
}
