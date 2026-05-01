/**
 * useVoicePreferences — user-tunable voice settings.
 *
 * Coexists with `useVoiceMute`:
 *   • `useVoiceMute`   owns the simple "mute everything" bit.
 *     It's the affordance pinned to the screen for instant
 *     silencing.
 *   • `useVoicePreferences` (this hook) owns the day-2 settings
 *     a Settings screen would expose:
 *       - voiceEnabled    (defaults to false; the user opts in)
 *       - voiceLanguage   (defaults to the active UI lang)
 *       - voiceSpeed      (0.7 .. 1.3; passed to playVoice if it
 *                          ever supports speed; today voicePlayer
 *                          uses a fixed 0.9 rate)
 *
 * Why default voiceEnabled = false (per spec §6)
 * ──────────────────────────────────────────────
 *   The launch rule is "voice should support farmers, not annoy
 *   them". Auto-play happens only when the user has explicitly
 *   enabled voice. Until then, every voice surface shows a
 *   manual Play button via `<VoiceControls>` / `<VoiceReplayButton>`.
 *
 * Storage keys
 *   farroway_voice_enabled     'true' | 'false'
 *   farroway_voice_language    short language code
 *   farroway_voice_speed       number string (e.g. '0.9')
 *
 * Cross-tab sync via the `farroway:voiceprefchange` event +
 * native storage events.
 */

import { useCallback, useEffect, useState } from 'react';

const KEY = Object.freeze({
  enabled:  'farroway_voice_enabled',
  language: 'farroway_voice_language',
  speed:    'farroway_voice_speed',
});
const EVENT = 'farroway:voicepreferencechange';

function _readEnabled() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(KEY.enabled) === 'true';
  } catch { return false; }
}

function _readLanguage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'en';
    return window.localStorage.getItem(KEY.language) || 'en';
  } catch { return 'en'; }
}

function _readSpeed() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 0.9;
    const raw = window.localStorage.getItem(KEY.speed);
    if (!raw) return 0.9;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0.9;
    if (n < 0.5) return 0.5;
    if (n > 2) return 2;
    return n;
  } catch { return 0.9; }
}

function _emit() {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT));
    }
  } catch { /* ignore */ }
}

function _writeStr(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
    _emit();
  } catch { /* ignore */ }
}

// ── Module-level setters (for non-React callers) ─────────────

export function isVoiceEnabled()   { return _readEnabled(); }
export function getVoiceLanguage() { return _readLanguage(); }
export function getVoiceSpeed()    { return _readSpeed(); }

export function setVoiceEnabled(value)  { _writeStr(KEY.enabled,  value ? 'true' : 'false'); }
export function setVoiceLanguage(value) { _writeStr(KEY.language, String(value || 'en').slice(0, 8)); }
export function setVoiceSpeed(value) {
  let n = Number(value);
  if (!Number.isFinite(n)) n = 0.9;
  if (n < 0.5) n = 0.5;
  if (n > 2) n = 2;
  _writeStr(KEY.speed, String(n));
}

// ── React hook ───────────────────────────────────────────────

export default function useVoicePreferences() {
  const [enabled, _setEnabled]   = useState(_readEnabled);
  const [language, _setLanguage] = useState(_readLanguage);
  const [speed, _setSpeed]       = useState(_readSpeed);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const refresh = () => {
      _setEnabled(_readEnabled());
      _setLanguage(_readLanguage());
      _setSpeed(_readSpeed());
    };
    const onEvt = () => refresh();
    const onStorage = (e) => {
      if (!e || !e.key) return;
      if (e.key === KEY.enabled || e.key === KEY.language || e.key === KEY.speed) refresh();
    };
    window.addEventListener(EVENT, onEvt);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onEvt);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setEnabled  = useCallback((v) => { setVoiceEnabled(v);  _setEnabled(!!v); }, []);
  const setLanguage = useCallback((v) => { setVoiceLanguage(v); _setLanguage(String(v || 'en')); }, []);
  const setSpeed    = useCallback((v) => {
    setVoiceSpeed(v);
    _setSpeed(_readSpeed());
  }, []);

  return { enabled, language, speed, setEnabled, setLanguage, setSpeed };
}

export const _internal = Object.freeze({ KEY, EVENT });
