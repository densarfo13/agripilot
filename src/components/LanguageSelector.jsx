import { LANGUAGES } from '../lib/i18n.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';

export default function LanguageSelector() {
  const { language, setLanguage } = useAppPrefs();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
      style={S.select}
      aria-label="Select language"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}

const S = {
  select: {
    background: '#111827',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    padding: '0.4rem 0.6rem',
    fontSize: '0.8rem',
    cursor: 'pointer',
    outline: 'none',
  },
};
