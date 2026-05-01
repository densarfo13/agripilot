/**
 * useVoiceMute — global mute toggle for the voice-guidance hooks.
 *
 * Persists in `localStorage['farroway_voice_muted']` and
 * broadcasts a `farroway:voicemutechange` CustomEvent so every
 * subscribed component re-renders together (matches the existing
 * `farroway:langchange` + `farroway:lowliteracychange` pattern).
 *
 * Behaviour
 *   • toggle()         flips the bit
 *   • setMuted(bool)   explicit setter
 *   • muted            current state
 *
 * The actual silencing is enforced inside `voicePlayer.playVoice` —
 * this hook just owns the persisted bit.
 */

import { useCallback, useEffect, useState } from 'react';
import { stopVoice } from '../utils/voicePlayer.js';

const KEY = 'farroway_voice_muted';
const EVENT = 'farroway:voicemutechange';

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

export function isVoiceMuted() {
  return _read();
}

export function setVoiceMuted(value) {
  const next = !!value;
  _write(next);
  // Stop any in-flight speech immediately so the user gets
  // instant silence on mute.
  if (next) stopVoice();
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    }
  } catch { /* ignore */ }
  return next;
}

export default function useVoiceMute() {
  const [muted, _setLocal] = useState(_read);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onEvt = (e) => _setLocal(typeof e?.detail === 'boolean' ? e.detail : _read());
    window.addEventListener(EVENT, onEvt);
    // Cross-tab sync.
    const onStorage = (e) => { if (e?.key === KEY) _setLocal(_read()); };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onEvt);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !_read();
    setVoiceMuted(next);
    _setLocal(next);
  }, []);

  const setMuted = useCallback((value) => {
    setVoiceMuted(value);
    _setLocal(!!value);
  }, []);

  return { muted, toggle, setMuted };
}
