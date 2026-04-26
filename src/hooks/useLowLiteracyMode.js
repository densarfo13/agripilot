/**
 * useLowLiteracyMode — UI preference for the icon-first / fewer-words
 * farmer mode.
 *
 * Persists in localStorage under `farroway:lowLiteracyMode` and
 * broadcasts a `farroway:lowliteracychange` CustomEvent so every
 * subscribed component re-renders together (matches the existing
 * `farroway:langchange` pattern in src/i18n/index.js).
 *
 * Why a tiny hook instead of a new context provider
 * ─────────────────────────────────────────────────
 * The strict project rule is "no new engines / parallel systems".
 * AppSettingsContext already owns most farmer prefs, but this flag
 * is purely visual sugar with zero cross-cutting concerns — a hook
 * that reads/writes a single localStorage key + dispatches an event
 * is the smallest possible footprint and avoids modifying the
 * existing provider tree.
 *
 * Standard mode is preserved: turning the flag off restores all
 * current cards/text exactly as before.
 *
 * Usage
 * ─────
 *   const { enabled, setEnabled, toggle } = useLowLiteracyMode();
 *   <button onClick={toggle}>{enabled ? 'Standard' : 'Simple'}</button>
 *
 *   // From a non-React module:
 *   import { isLowLiteracyMode, setLowLiteracyMode } from './useLowLiteracyMode.js';
 */

import { useCallback, useEffect, useState } from 'react';

const KEY = 'farroway:lowLiteracyMode';
const EVENT = 'farroway:lowliteracychange';

function _read() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(KEY) === 'true';
  } catch { return false; }
}

function _write(value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(KEY, value ? 'true' : 'false');
  } catch { /* ignore quota / private mode */ }
}

export function isLowLiteracyMode() {
  return _read();
}

export function setLowLiteracyMode(value) {
  const next = !!value;
  _write(next);
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    }
  } catch { /* ignore */ }
  // Apply a body class so global CSS rules (larger fonts, denser
  // touch targets) can hook in without each component duplicating
  // sizing logic.
  try {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('low-literacy-mode', next);
    }
  } catch { /* ignore */ }
  return next;
}

// Apply the body class on first module load so the very first
// paint is correct on reload.
if (typeof window !== 'undefined') {
  try {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('low-literacy-mode', _read());
    }
  } catch { /* ignore */ }
}

export default function useLowLiteracyMode() {
  const [enabled, _set] = useState(_read);

  useEffect(() => {
    const handler = (e) => _set(typeof e?.detail === 'boolean' ? e.detail : _read());
    if (typeof window !== 'undefined') {
      window.addEventListener(EVENT, handler);
      // Cross-tab sync: also react to storage events.
      const storageHandler = (e) => {
        if (e?.key === KEY) _set(_read());
      };
      window.addEventListener('storage', storageHandler);
      return () => {
        window.removeEventListener(EVENT, handler);
        window.removeEventListener('storage', storageHandler);
      };
    }
    return undefined;
  }, []);

  const setEnabled = useCallback((value) => {
    setLowLiteracyMode(value);
    _set(!!value);
  }, []);

  const toggle = useCallback(() => {
    const next = !_read();
    setLowLiteracyMode(next);
    _set(next);
  }, []);

  return { enabled, setEnabled, toggle };
}
