/**
 * useFarmBrainState.js — FARM_BRAIN_STATE_V1, RULE 2 adoption.
 *
 * The React read for the single canonical FarmBrain state. A screen calls
 * `useFarmBrainState()` and re-renders whenever an event updates the store
 * (scan, task_completed, …). This is how "every screen reads FarmBrainState
 * only" becomes real — incrementally, one adopter at a time.
 *
 * Best-effort: if the store import or subscribe fails, the hook returns the
 * honest empty state and never throws.
 */
import { useEffect, useState } from 'react';
import {
  getFarmBrainState, subscribeFarmBrain,
} from '../runtime/farmBrain/FarmBrainStateStore';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

export default function useFarmBrainState() {
  const [state, setState] = useState(() => _safe(() => getFarmBrainState(), null));

  useEffect(() => {
    // Re-sync on mount (the store may have advanced before this screen mounted).
    setState(_safe(() => getFarmBrainState(), null));
    const unsub = _safe(() => subscribeFarmBrain((s) => setState(s)), null);
    return () => { _safe(() => (typeof unsub === 'function' ? unsub() : undefined), undefined); };
  }, []);

  return state;
}
