import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { completeSeason, completeTask, getActiveSeason, startSeason } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useProfile } from './ProfileContext.jsx';

const SeasonContext = createContext(null);

export function SeasonProvider({ children }) {
  const { isAuthenticated, authLoading } = useAuth();
  const { profile } = useProfile();
  const [season, setSeason] = useState(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [seasonInitialized, setSeasonInitialized] = useState(false);

  // Track the active farm ID so season auto-refreshes on farm switch
  const currentFarmId = profile?.id || null;
  const prevFarmIdRef = useRef(currentFarmId);

  const refreshSeason = useCallback(async (farmId) => {
    if (!isAuthenticated) {
      setSeason(null);
      setSeasonInitialized(true);
      setSeasonLoading(false);
      return null;
    }

    setSeasonLoading(true);
    try {
      const data = await getActiveSeason(farmId || undefined);
      setSeason(data.season || null);
      return data.season || null;
    } finally {
      setSeasonLoading(false);
      setSeasonInitialized(true);
    }
  }, [isAuthenticated]);

  const beginSeason = useCallback(async (payload) => {
    const data = await startSeason(payload);
    setSeason(data.season || null);
    return data;
  }, []);

  const finishSeason = useCallback(async () => {
    if (!season?.id) return null;
    const data = await completeSeason(season.id);
    setSeason(data.season?.isActive ? data.season : null);
    return data;
  }, [season?.id]);

  const markTaskComplete = useCallback(async (taskId) => {
    const data = await completeTask(taskId);

    setSeason((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: (prev.tasks || []).map((task) =>
          task.id === taskId ? { ...task, status: 'completed' } : task
        ),
      };
    });

    return data;
  }, []);

  // Initial load
  useEffect(() => {
    if (!authLoading) {
      refreshSeason().catch((error) => {
        console.error('Failed to initialize season context:', error);
        setSeasonLoading(false);
        setSeasonInitialized(true);
      });
    }
  }, [authLoading, refreshSeason]);

  // Auto-refresh season when active farm changes (farm switch)
  useEffect(() => {
    if (currentFarmId && currentFarmId !== prevFarmIdRef.current && seasonInitialized) {
      prevFarmIdRef.current = currentFarmId;
      refreshSeason(currentFarmId).catch((error) => {
        console.error('Failed to refresh season after farm switch:', error);
      });
    } else {
      prevFarmIdRef.current = currentFarmId;
    }
  }, [currentFarmId, seasonInitialized, refreshSeason]);

  const value = useMemo(
    () => ({
      season,
      seasonLoading,
      seasonInitialized,
      refreshSeason,
      beginSeason,
      finishSeason,
      markTaskComplete,
    }),
    [season, seasonLoading, seasonInitialized, refreshSeason, beginSeason, finishSeason, markTaskComplete],
  );

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeason() {
  const context = useContext(SeasonContext);
  if (!context) throw new Error('useSeason must be used within SeasonProvider');
  return context;
}
