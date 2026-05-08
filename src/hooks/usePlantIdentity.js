/**
 * usePlantIdentity — read/write the active plant profile.
 *
 *   const { plant, setNickname, setField, save, hasPlant } = usePlantIdentity();
 *
 * Subscribes to the same-tab `farroway:plant_changed` event and the
 * cross-tab `storage` event so Home updates immediately when the
 * user edits the nickname on My Grow (or any other surface).
 *
 * Strict-rule audit
 *   • All hooks declared unconditionally — rules-of-hooks safe.
 *   • Never throws — every callback wraps the store call.
 *   • No network, no async, no blocking I/O.
 *   • SSR-safe — window/document access guarded.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  readPlant, savePlant, patchPlant, hasPlant as _hasPlant,
  PLANT_STORE_KEY, PLANT_FALLBACK,
} from '../lib/plant/plantStore.js';

export default function usePlantIdentity() {
  const [plant, setPlantState] = useState(() => {
    try { return readPlant(); } catch { return { ...PLANT_FALLBACK }; }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const refresh = () => {
      try { setPlantState(readPlant()); } catch { /* swallow */ }
    };

    const onStorage = (ev) => {
      try {
        if (ev?.key === PLANT_STORE_KEY) refresh();
      } catch { /* swallow */ }
    };

    try {
      window.addEventListener('farroway:plant_changed', refresh);
      window.addEventListener('storage', onStorage);
    } catch { /* swallow */ }

    return () => {
      try {
        window.removeEventListener('farroway:plant_changed', refresh);
        window.removeEventListener('storage', onStorage);
      } catch { /* swallow */ }
    };
  }, []);

  const save = useCallback((partial) => {
    try {
      const next = savePlant(partial);
      setPlantState(next);
      return next;
    } catch { return plant; }
  }, [plant]);

  const setField = useCallback((field, value) => {
    try {
      const next = patchPlant(field, value);
      setPlantState(next);
      return next;
    } catch { return plant; }
  }, [plant]);

  const setNickname = useCallback((name) => setField('nickname', name), [setField]);

  return {
    plant,
    save,
    setField,
    setNickname,
    hasPlant: _hasPlant(),
  };
}

export { usePlantIdentity };
