import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { completeSeason, completeTask, getActiveSeason, startSeason } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const SeasonContext = createContext(null);

export function SeasonProvider({ children }) {
  const { isAuthenticated, authLoading } = useAuth();
  const [season, setSeason] = useState(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [seasonInitialized, setSeasonInitialized] = useState(false);

  const refreshSeason = useCallback(async () => {
    if (!isAuthenticated) {
      setSeason(null);
      setSeasonInitialized(true);
      setSeasonLoading(false);
      return null;
    }

    setSeasonLoading(true);
    try {
      const data = await getActiveSeason();
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

  useEffect(() => {
    if (!authLoading) {
      refreshSeason().catch((error) => {
        console.error('Failed to initialize season context:', error);
        setSeasonLoading(false);
        setSeasonInitialized(true);
      });
    }
  }, [authLoading, refreshSeason]);

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
