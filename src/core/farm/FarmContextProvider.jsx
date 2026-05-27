/**
 * FarmContextProvider.jsx — React surface over the canonical
 * farmContextStore. Single source of truth every farm-aware screen
 * subscribes to.
 *
 *   import { FarmContextProvider, useActiveFarm, useFarmContext }
 *     from 'src/core/farm/FarmContextProvider.jsx';
 *
 *   // In your app root:
 *   <FarmContextProvider initialServerFarm={user.farm}>
 *     <App />
 *   </FarmContextProvider>
 *
 *   // In any screen:
 *   const { activeFarm } = useActiveFarm();
 *   if (activeFarm.cropId) { ... }
 *
 *   const ctx = useFarmContext();
 *   ctx.setActiveFarm({ ... });
 *   ctx.runMismatchAudit();
 *
 * Strict-rule audit
 *   • Subscribes to store updates on mount; cleans up on unmount.
 *   • Never throws — surface gracefully degrades to empty shell.
 *   • Calls installFarmContextDebugHooks() once on mount so
 *     window.__farmContextDebug() + __stateMismatchAudit() are
 *     pinned for QA on every device session.
 */

import {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
} from 'react';

import {
  getActiveFarm, setActiveFarm as setActiveFarmStore,
  hydrateActiveFarm, subscribeActiveFarm, clearActiveFarm,
  getHydrationSource, HYDRATION_SOURCE,
} from './farmContextStore.js';
import {
  installFarmContextDebugHooks, runStateMismatchAudit,
} from './farmContextDebug.js';

const FarmContext = createContext(null);

/**
 * Provider component.
 *
 * @param {object} props
 * @param {object} [props.initialServerFarm] — server farm payload
 * @param {object} [props.onboardingDraft]   — partial draft if any
 * @param {string} [props.locale]            — current ui locale
 * @param {React.ReactNode} props.children
 */
export function FarmContextProvider(props) {
  const initialServerFarm = props && props.initialServerFarm;
  const onboardingDraft   = props && props.onboardingDraft;
  const locale            = props && props.locale;
  const children          = props && props.children;

  const [activeFarm, setActiveFarmState] = useState(() => {
    // Hydrate once from server + draft + persisted local on first mount.
    try {
      hydrateActiveFarm({
        server:          initialServerFarm,
        onboardingDraft,
        locale,
      });
      return getActiveFarm();
    } catch {
      return getActiveFarm();
    }
  });

  const [hydrationSource, setHydrationSource] = useState(getHydrationSource);

  // Subscribe to store changes so every consumer re-renders on update.
  useEffect(() => {
    const unsubscribe = subscribeActiveFarm((next) => {
      try {
        setActiveFarmState(next);
        setHydrationSource(getHydrationSource());
      } catch { /* swallow */ }
    });
    // Pin the debug hooks once per app lifetime.
    try { installFarmContextDebugHooks(); } catch { /* swallow */ }
    return unsubscribe;
  }, []);

  // Update locale on the canonical farm when it changes (cheap re-norm).
  useEffect(() => {
    if (!locale) return;
    try {
      const current = getActiveFarm();
      if (current && current.cropId) {
        setActiveFarmStore(current, { locale, source: hydrationSource, force: true });
      }
    } catch { /* swallow */ }
    // We deliberately depend only on locale here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const setActiveFarm = useCallback((next, opts) => {
    try {
      return setActiveFarmStore(next, { locale, ...(opts || {}) });
    } catch { return null; }
  }, [locale]);

  const runMismatchAudit = useCallback(() => {
    try { return runStateMismatchAudit(); } catch { return null; }
  }, []);

  const value = useMemo(() => Object.freeze({
    activeFarm,
    hydrationSource,
    setActiveFarm,
    clearActiveFarm,
    runMismatchAudit,
    locale: locale || null,
  }), [activeFarm, hydrationSource, setActiveFarm, runMismatchAudit, locale]);

  return (
    <FarmContext.Provider value={value}>
      {children}
    </FarmContext.Provider>
  );
}

/**
 * The primary hook every farm-aware screen should use.
 *
 *   const { activeFarm, hydrationSource } = useActiveFarm();
 *
 * Works WITHOUT a provider too — falls back to direct store reads
 * so incremental adoption never breaks a screen.
 */
export function useActiveFarm() {
  const ctx = useContext(FarmContext);
  if (ctx) return ctx;
  // Provider not mounted — degrade to direct store read so the
  // screen still renders with whatever is persisted.
  return Object.freeze({
    activeFarm:      getActiveFarm(),
    hydrationSource: getHydrationSource(),
    setActiveFarm:   setActiveFarmStore,
    clearActiveFarm,
    runMismatchAudit: runStateMismatchAudit,
    locale: null,
  });
}

/**
 * Full context handle — used by surfaces that need to mutate the
 * active farm (onboarding, settings).
 */
export function useFarmContext() {
  return useActiveFarm();
}

export { HYDRATION_SOURCE };

const _module = {
  FarmContextProvider, useActiveFarm, useFarmContext, HYDRATION_SOURCE,
};
export default _module;
