import React, { useState, useEffect, useRef } from 'react';
import { speak, stopSpeech, isVoiceAvailable, VOICE_LANGUAGES } from '../utils/voiceGuide.js';
import { trackVoiceEvent } from '../utils/voiceAnalytics.js';
import { getLanguage, setLanguage } from '../i18n/index.js';

/**
 * VoiceBar — shared voice controls for low-literacy farmers.
 *
 * Renders a compact bar with Listen button, language selector, and mute toggle.
 * Auto-plays the voice prompt once per unique voiceKey change.
 * Stops speech on voiceKey change and on unmount.
 * Hidden entirely when speechSynthesis is unavailable.
 *
 * Props:
 *   voiceKey  — current voice map key (e.g. 'home_welcome', 'update_start')
 *   compact   — if true, shows smaller controls (default: false)
 */
export default function VoiceBar({ voiceKey, compact = false }) {
  const [voiceLang, setVoiceLang] = useState(() => getLanguage());
  const [enabled, setEnabled] = useState(() => isVoiceAvailable());
  const playedRef = useRef({});

  // Persist language preference — uses unified i18n storage
  useEffect(() => {
    setLanguage(voiceLang); // writes to all localStorage keys + dispatches event
  }, [voiceLang]);

  // Listen for external language changes (e.g. from dashboard language selector)
  useEffect(() => {
    const handler = (e) => {
      const newLang = e.detail || getLanguage();
      if (newLang !== voiceLang) {
        setVoiceLang(newLang);
        playedRef.current = {}; // replay prompts in new language
      }
    };
    window.addEventListener('farroway:langchange', handler);
    return () => window.removeEventListener('farroway:langchange', handler);
  }, [voiceLang]);

  // Auto-play once per voiceKey
  useEffect(() => {
    if (!voiceKey) return;
    // Track prompt shown regardless of enabled state
    trackVoiceEvent('VOICE_PROMPT_SHOWN', { promptKey: voiceKey, language: voiceLang, enabled });
    if (!enabled) return;
    stopSpeech();
    if (!playedRef.current[voiceKey]) {
      playedRef.current[voiceKey] = true;
      const t = setTimeout(() => {
        speak(voiceKey, voiceLang);
        trackVoiceEvent('VOICE_PROMPT_PLAYED', { promptKey: voiceKey, language: voiceLang });
      }, 400);
      return () => clearTimeout(t);
    }
  }, [voiceKey, enabled, voiceLang]);

  // Stop on unmount
  useEffect(() => () => stopSpeech(), []);

  const handleReplay = () => {
    if (enabled && voiceKey) {
      speak(voiceKey, voiceLang);
      trackVoiceEvent('VOICE_PROMPT_REPLAYED', { promptKey: voiceKey, language: voiceLang });
    }
  };

  const handleLangChange = (e) => {
    setVoiceLang(e.target.value);
    playedRef.current = {}; // reset so prompts replay in new language
  };

  if (!isVoiceAvailable()) return null;

  const sz = compact ? 'compact' : 'normal';

  if (!enabled) {
    return (
      <div style={VS.bar}>
        <button
          type="button"
          onClick={() => { setEnabled(true); playedRef.current = {}; trackVoiceEvent('VOICE_PROMPT_PLAYED', { promptKey: voiceKey, language: voiceLang, action: 'unmuted' }); }}
          style={VS.listenBtn}
          aria-label="Turn on voice guide"
        >
          {'\uD83D\uDD08'} {compact ? 'Voice' : 'Enable Voice Guide'}
        </button>
      </div>
    );
  }

  return (
    <div style={VS.bar} data-testid="voice-bar">
      <button
        type="button"
        onClick={handleReplay}
        style={VS.listenBtn}
        aria-label="Listen again"
        data-testid="voice-listen-btn"
      >
        {'\uD83D\uDD0A'} {compact ? '' : 'Listen'}
      </button>
      <select
        value={voiceLang}
        onChange={handleLangChange}
        style={VS.langSelect}
        aria-label="Voice language"
        data-testid="voice-lang-select"
      >
        {VOICE_LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>{compact ? l.code.toUpperCase() : l.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => { stopSpeech(); setEnabled(false); trackVoiceEvent('VOICE_PROMPT_MUTED', { promptKey: voiceKey, language: voiceLang }); }}
        style={VS.muteBtn}
        aria-label="Turn off voice"
        data-testid="voice-mute-btn"
      >
        {'\uD83D\uDD07'}
      </button>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────
const VS = {
  bar: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    marginBottom: '0.75rem', padding: '0.4rem 0.5rem',
    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: '10px',
  },
  listenBtn: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.5rem 0.85rem', background: 'rgba(59,130,246,0.15)',
    border: '1.5px solid rgba(59,130,246,0.4)', borderRadius: '8px',
    color: '#60A5FA', fontWeight: 600, fontSize: '0.88rem',
    cursor: 'pointer', minHeight: '44px', minWidth: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
  langSelect: {
    flex: 1, padding: '0.4rem 0.5rem', background: '#1E293B',
    border: '1.5px solid #374151', borderRadius: '6px',
    color: '#FFFFFF', fontSize: '0.82rem', minHeight: '44px',
    cursor: 'pointer',
  },
  muteBtn: {
    padding: '0.4rem', background: 'transparent', border: 'none',
    fontSize: '1.1rem', cursor: 'pointer', minHeight: '44px', minWidth: '44px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent', borderRadius: '6px',
  },
};
