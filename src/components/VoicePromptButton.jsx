import { useState } from 'react';
import { speakText, stopSpeaking, languageToVoiceCode } from '../lib/voice.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';

export default function VoicePromptButton({ text, label }) {
  const { language } = useAppPrefs();
  const [speaking, setSpeaking] = useState(false);

  const handleToggle = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      const voiceCode = languageToVoiceCode(language);
      speakText(text, voiceCode);
      setSpeaking(true);
      // Reset when speech ends naturally
      if ('speechSynthesis' in window) {
        const check = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            setSpeaking(false);
            clearInterval(check);
          }
        }, 300);
      }
    }
  };

  if (!text) return null;

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
