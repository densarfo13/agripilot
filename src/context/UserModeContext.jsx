/**
 * UserModeContext — provides the current user mode to all components.
 *
 * Mode ≠ role. Roles control permissions (unchanged). Modes control presentation:
 *   basic    — icon-first, voice-guided, one action at a time
 *   standard — icon + short text, quick actions, simple progress
 *   advanced — admin/org dashboards, reports, detail views
 *
 * Mode is derived from role + experienceLevel, with manual override support.
 */
import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  getEffectiveMode,
  persistMode,
  clearPersistedMode,
  getAllowedModes,
  isFarmerMode,
} from '../lib/userMode.js';
import { useAuth } from './AuthContext.jsx';
import { useProfile } from './ProfileContext.jsx';

const UserModeContext = createContext(null);

export function UserModeProvider({ children }) {
  const { user } = useAuth();
  const { profile } = useProfile();

  const role = user?.role || 'farmer';
  const experienceLevel = profile?.experienceLevel || '';

  const [mode, setModeState] = useState(() => getEffectiveMode(role, experienceLevel));

  // Re-derive when role or experience changes
  useEffect(() => {
    setModeState(getEffectiveMode(role, experienceLevel));
  }, [role, experienceLevel]);

  const setMode = useCallback((newMode) => {
    const allowed = getAllowedModes(role);
    if (allowed.includes(newMode)) {
      persistMode(newMode);
      setModeState(newMode);
    }
  }, [role]);

  const resetMode = useCallback(() => {
    clearPersistedMode();
    setModeState(getEffectiveMode(role, experienceLevel));
  }, [role, experienceLevel]);

  const allowedModes = useMemo(() => getAllowedModes(role), [role]);
  const isBasic = mode === 'basic';
  const isStandard = mode === 'standard';
  const isAdvanced = mode === 'advanced';
  const isFarmer = isFarmerMode(mode);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      resetMode,
      allowedModes,
      isBasic,
      isStandard,
      isAdvanced,
      isFarmer,
    }),
    [mode, setMode, resetMode, allowedModes, isBasic, isStandard, isAdvanced, isFarmer],
  );

  return <UserModeContext.Provider value={value}>{children}</UserModeContext.Provider>;
}

export function useUserMode() {
  const context = useContext(UserModeContext);
  if (!context) throw new Error('useUserMode must be used within UserModeProvider');
  return context;
}
