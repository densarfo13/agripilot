/**
 * MountDecisionDebugPanel — drop-in mount for
 * DecisionEngineDebugPanel. Fetches a snapshot from the server
 * (if enabled) and passes it in. Safe to render unconditionally —
 * the panel itself checks dev flags before rendering anything.
 *
 * Usage at your root layout:
 *   import MountDecisionDebugPanel from '@/components/dev/MountDecisionDebugPanel';
 *   <MountDecisionDebugPanel intervalMs={15000} />
 */

import { useMemo } from 'react';
import DecisionEngineDebugPanel from './DecisionEngineDebugPanel.jsx';
import { useDecisionEngineSnapshot } from '../../hooks/useDecisionEngineSnapshot.js';

function devEnabled() {
  const viteDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
  let userFlag = false;
  try {
    userFlag = typeof window !== 'undefined'
      && window.localStorage
      && window.localStorage.getItem('farroway.debug') === '1';
  } catch { /* noop */ }
  return !!(viteDev || userFlag);
}

export default function MountDecisionDebugPanel({
  intervalMs = 15000,
  body = null,
} = {}) {
  const enabled = devEnabled();
  const { snapshot } = useDecisionEngineSnapshot({
    enabled, intervalMs, body,
  });
  const resolved = useMemo(() => snapshot || null, [snapshot]);
  if (!enabled) return null;
  return <DecisionEngineDebugPanel snapshot={resolved} />;
}
