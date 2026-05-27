/**
 * FarmHydrationGate.jsx — render-block while the canonical farm
 * store rehydrates from localStorage (spec §3).
 *
 *   import FarmHydrationGate from
 *     'src/components/system/FarmHydrationGate.jsx';
 *
 *   <FarmHydrationGate>
 *     <App />
 *   </FarmHydrationGate>
 *
 * Why this gate
 * ─────────────
 *   The zustand persist middleware rehydrates asynchronously on
 *   mount. Pages that render before hydration finishes briefly
 *   see DEFAULT_FARM and then re-render — the visible flash
 *   farmers reported as "Choose your main crop" before settling
 *   on the actual crop name.
 *
 *   We block render for ONE animation frame after mount, then
 *   let pages through. Long enough for zustand to swap in the
 *   persisted snapshot; short enough that the user never sees a
 *   spinner.
 *
 *   Falls back to a calm dark backdrop (matches the app shell)
 *   so the screen doesn't flash white during the gate.
 */

import { useEffect } from 'react';

import { useCanonicalFarmStore } from '../../store/canonicalFarmStore.js';

function FarmHydrationGate({ children }) {
  const hydrated    = useCanonicalFarmStore((s) => s.hydrated);
  const setHydrated = useCanonicalFarmStore((s) => s.setHydrated);

  useEffect(() => {
    let raf = 0;
    if (typeof requestAnimationFrame === 'function') {
      raf = requestAnimationFrame(() => setHydrated(true));
    } else {
      // SSR / test env without rAF — flip immediately.
      setHydrated(true);
    }
    return () => {
      if (raf && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(raf);
      }
    };
  }, [setHydrated]);

  if (!hydrated) {
    return (
      <div
        aria-hidden="true"
        style={{
          minHeight: '100vh',
          background: '#071b11',
        }}
      />
    );
  }

  return children;
}

export default FarmHydrationGate;
