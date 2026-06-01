/**
 * useSimpleMode — light React hook over the existing simpleModeEngine
 * preference store + the new SimpleModeRuntime probe.
 *
 *   const { enabled, setEnabled } = useSimpleMode();
 *
 * Never throws; SSR-safe; rerenders the consumer when the storage
 * preference changes (cross-tab via the 'storage' event).
 */

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'farroway_simple_mode_enabled';
const LEGACY_KEY = 'farroway_simple_mode_v1';

function readPref() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const explicit = window.localStorage.getItem(STORAGE_KEY);
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (typeof legacy === 'string' && /simple|low.literacy/i.test(legacy)) return true;
    return false;
  } catch { return false; }
}

function writePref(next) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
    // Also bump the legacy key so old surfaces stay in sync.
    if (next) window.localStorage.setItem(LEGACY_KEY, 'simple');
    else window.localStorage.setItem(LEGACY_KEY, 'standard');
    // Fire a synthetic event so other hooks/components on the same tab
    // re-read without waiting for a route change.
    try { window.dispatchEvent(new Event('farroway:simpleModeChanged')); } catch { /* ignore */ }
    return true;
  } catch { return false; }
}

export default function useSimpleMode() {
  const [enabled, setEnabledState] = useState(() => readPref());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onStorage = (e) => { if (!e || e.key === STORAGE_KEY || e.key === LEGACY_KEY) setEnabledState(readPref()); };
    const onSame = () => setEnabledState(readPref());
    try { window.addEventListener('storage', onStorage); } catch { /* ignore */ }
    try { window.addEventListener('farroway:simpleModeChanged', onSame); } catch { /* ignore */ }
    return () => {
      try { window.removeEventListener('storage', onStorage); } catch { /* ignore */ }
      try { window.removeEventListener('farroway:simpleModeChanged', onSame); } catch { /* ignore */ }
    };
  }, []);

  const setEnabled = useCallback((next) => {
    writePref(!!next);
    setEnabledState(!!next);
  }, []);

  return { enabled, setEnabled };
}
