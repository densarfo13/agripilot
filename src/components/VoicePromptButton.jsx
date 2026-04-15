import { useState } from 'react';
import voiceService from '../services/voiceService.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';

/**
 * VoicePromptButton — plays voice by prompt ID or raw text.
 *
 * Props:
 *   promptId — prompt key (e.g. 'task.water'). Uses 3-tier fallback (clip → provider → browser).
 *   text     — raw text fallback. Used when no promptId, or as display label.
 *   label    — button label text (default: 'Listen').
 *
 * If promptId is provided, speakPrompt() is used (with prerecorded clip support).
 * If only text is provided, speakText() is used (provider → browser only).
 */
export default function VoicePromptButton({ promptId, text, label }) {
  const { language } = useAppPrefs();
  const [speaking, setSpeaking] = useState(false);

  const handleToggle = () => {
    if (speaking) {
      voiceService.stop();
      setSpeaking(false);
    } else {
      const lang = language || 'en';
      // Prefer prompt ID (3-tier fallback) over raw text
      if (promptId) {
        voiceService.speakPrompt(promptId, lang);
      } else if (text) {
        voiceService.speakText(text, lang);
      }
      setSpeaking(true);
      // Poll for playback end (covers both audio element and speechSynthesis)
      const check = setInterval(() => {
        if (!voiceService.isSpeaking()) {
          setSpeaking(false);
          clearInterval(check);
        }
      }, 300);
    }
  };

  if (!promptId && !text) return null;

  return (
    <button onClick={handleToggle} style={S.btn} aria-label={speaking ? 'Stop voice' : 'Play voice'}>
      {speaking ? '⏹ Stop' : label ? `▶ ${label}` : '▶ Listen'}
    </button>
  );
}

const S = {
  btn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color: '#fff',
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
