import { LANGUAGES } from '../i18n/index.js';
import T from '../i18n/translations.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';

/**
 * LanguageSelector — bare-bones dropdown used in the app header /
 * settings. Re-uses the canonical `.form-select` CSS so the native
 * popup picks up `color-scheme: dark` + the solid-option rules and
 * stays legible on Windows Chromium (the white-on-white bug).
 *
 * Final go-live spec §15: hide unsupported language options. We
 * only render languages that have at least the small set of
 * canonical keys translated. CI's `guard:i18n` already enforces
 * 100% parity for the launch set, so this filter is belt-and-
 * braces — it stops a half-translated language from leaking
 * into the picker if anyone ever adds one.
 *
 * Keep this component thin; any visual tweak should land in
 * src/index.css so every other native select inherits it.
 */

// Canonical keys every supported language must translate. If a
// language is missing any of them, treat it as unsupported and
// drop it from the dropdown.
const REQUIRED_KEYS = Object.freeze([
  'recovery.repair',
  'nav.scan',
  'common.back',
]);

function _isLanguageSupported(code) {
  if (!code) return false;
  // English is the source language and always supported.
  if (code === 'en') return true;
  try {
    for (const k of REQUIRED_KEYS) {
      const row = T[k];
      if (!row || !row[code]) return false;
    }
    return true;
  } catch { return false; }
}

export default function LanguageSelector() {
  const { language, setLanguage } = useAppPrefs();
  const supported = LANGUAGES.filter((l) => _isLanguageSupported(l.code));

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
      {supported.map((lang) => (
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
