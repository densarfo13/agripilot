import { LANGUAGES } from '../i18n/index.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';

/**
 * LanguageSelector — bare-bones dropdown used in the app header /
 * settings. Re-uses the canonical `.form-select` CSS so the native
 * popup picks up `color-scheme: dark` + the solid-option rules and
 * stays legible on Windows Chromium (the white-on-white bug).
 *
 * Keep this component thin; any visual tweak should land in
 * src/index.css so every other native select inherits it.
 */
export default function LanguageSelector() {
  const { language, setLanguage } = useAppPrefs();

  return (
    // F21 follow-up: id + name added so DevTools accessibility
    // audit's "form field should have an id or name" stops
    // flagging this header control. aria-label was already present.
    <select
      id="app-header-language"
      name="appLanguage"
      className="form-select"
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

// Width/padding only — colours and the colour-scheme hint come from
// `.form-select` so changes stay in one place.
const S = {
  select: {
    width: 'auto',
    minWidth: 120,
    padding: '0.4rem 0.65rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
  },
};
