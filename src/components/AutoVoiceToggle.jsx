import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { t } from '../lib/i18n.js';

export default function AutoVoiceToggle() {
  const { autoVoice, setAutoVoice, language } = useAppPrefs();

  return (
    // F21 follow-up: type="button" prevents accidental form
    // submits when this lives inside a parent <form>; aria-pressed
    // exposes the toggle state to assistive tech (the icon swap
    // 🔊↔🔇 is the only visual signal otherwise).
    <button
      type="button"
      onClick={() => setAutoVoice(!autoVoice)}
      style={{
        ...S.btn,
        ...(autoVoice ? S.btnActive : {}),
      }}
      aria-label={t(language, 'autoVoice')}
      aria-pressed={autoVoice ? 'true' : 'false'}
    >
      {autoVoice ? '🔊' : '🔇'}
    </button>
  );
}

const S = {
  btn: {
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    padding: '0.4rem 0.6rem',
    fontSize: '0.95rem',
    cursor: 'pointer',
    color: '#fff',
    lineHeight: 1,
  },
  btnActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.15)',
  },
};
