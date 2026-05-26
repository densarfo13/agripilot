import { SUPPORTED_LOCALES } from '../i18n/supportedLocales.ts';
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
//
// Final-gap stability follow-up: the original 3-key sample was
// stable but didn't catch onboarding gaps \u2014 a language could
// pass parity here while still leaking English on the Step-0
// language picker / Pick-plant / Pick-crop / growing-setup
// screens. Expanding the sample to include one canonical key
// from each post-onboarding-rewrite screen keeps the picker
// honest: a partially-translated language is now hidden from
// the dropdown until every canonical screen is covered. The
// strict screen translator continues to enforce per-screen
// fallback as a second line of defence.
const REQUIRED_KEYS = Object.freeze([
  'recovery.repair',
  'nav.scan',
  'common.back',
  // Onboarding flow rewrite (clean-onboarding spec).
  'onboarding.chooseLanguage',
  'onboarding.whatAreYouGrowing',
  'onboarding.backyardGarden',
  'onboarding.farm',
  'onboarding.saveGarden',
  'onboarding.saveFarm',
  // Backyard growing-setup (garden-only step).
  'garden.growingSetup.title',
  'garden.growingSetup.container',
  'garden.growingSetup.bed',
  'garden.growingSetup.ground',
  'garden.growingSetup.unknown',
]);

// Post column-split: the prior `_isLanguageSupported(code)` filter
// checked `T[key][code]` for a sample of canonical keys to hide
// half-translated locales. After the lazy column-split refactor,
// non-English columns load on demand — so `T[key][code]` is
// undefined at picker render time and the filter hid EVERY non-
// English locale, even fully-translated ones. Coverage is now
// enforced by `npm run check:translations` (build-time) and
// `window.__i18nAudit()` (runtime QA) instead.
//
// REQUIRED_KEYS retained as a reference for the keys CI verifies.
const _LEGACY_REQUIRED_KEYS_REFERENCE = Object.freeze([
  'recovery.repair', 'nav.scan', 'common.back',
  'onboarding.chooseLanguage', 'onboarding.whatAreYouGrowing',
  'onboarding.backyardGarden', 'onboarding.farm',
  'onboarding.saveGarden', 'onboarding.saveFarm',
  'garden.growingSetup.title', 'garden.growingSetup.container',
  'garden.growingSetup.bed', 'garden.growingSetup.ground',
  'garden.growingSetup.unknown',
]);

export default function LanguageSelector() {
  const { language, setLanguage } = useAppPrefs();
  // Locales come straight from the centralized registry. No
  // filter, no overlay-table-walk; the column loader handles
  // missing-key fallback at lookup time.
  const supported = SUPPORTED_LOCALES.map((l) => ({
    code:  l.code,
    label: l.nativeName,
  }));

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
