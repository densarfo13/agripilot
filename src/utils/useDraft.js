import { useState, useRef, useCallback } from 'react';

const PREFIX = 'agripilot:draft:';

/**
 * Persists form state to localStorage so a partial entry survives
 * page refreshes, accidental navigation, or dropped connections.
 *
 * Usage:
 *   const { state, setState, clearDraft, draftRestored } = useDraft('my-key', initialValue);
 *
 * - state / setState  behave like useState but also write to localStorage.
 * - clearDraft()      removes the saved entry (call on successful submit).
 * - draftRestored     is true when an existing draft was loaded on mount.
 */
export function useDraft(key, initialState) {
  const restoredRef = useRef(false);
  const storageKey = PREFIX + key;

  const [state, setStateInternal] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        restoredRef.current = true;
        return parsed;
      }
    } catch { /* corrupt entry — fall through to initialState */ }
    return initialState;
  });

  // Capture the restored flag once (useState initializer runs synchronously
  // after the state initializer above, so restoredRef.current is already set)
  const [draftRestored] = useState(() => restoredRef.current);

  const setState = useCallback((updater) => {
    setStateInternal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage full */ }
      return next;
    });
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

  return { state, setState, clearDraft, draftRestored };
}
