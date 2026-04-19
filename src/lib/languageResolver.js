/**
 * languageResolver.js — resolve the active UI language using a
 * strict priority chain that never mixes up "what language do I
 * speak" with "what region do I farm in".
 *
 *   1. manual user choice     — picked in the settings UI
 *   2. saved profile preference — what the farmer last confirmed
 *   3. device/browser locale  — first call, no prior signals
 *   4. default fallback       — English
 *
 * Exports:
 *   SUPPORTED_LANGUAGES     — ordered list of language codes
 *   resolveLanguage()       — returns the current active code
 *   confirmLanguage(code)   — store manual + profile choice
 *   detectBrowserLanguage() — returns browser locale mapped to ours
 */

export const SUPPORTED_LANGUAGES = Object.freeze([
  { code: 'en', label: 'English',  short: 'EN' },
  { code: 'hi', label: 'हिन्दी',    short: 'HI' },
  { code: 'tw', label: 'Twi (beta)', short: 'TW' },
  // Legacy codes still supported by the dictionary — kept out of the
  // confirmation UI so the roll-out stays focused.
  { code: 'fr', label: 'Français', short: 'FR', hidden: true },
  { code: 'sw', label: 'Kiswahili', short: 'SW', hidden: true },
  { code: 'ha', label: 'Hausa',    short: 'HA', hidden: true },
]);

const SUPPORTED_SET = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

// Storage keys — separate from region storage so the two resolvers
// can't stomp each other.
const KEY_MANUAL = 'farroway:lang:manual';
const KEY_PROFILE = 'farroway:lang:profile';
// Legacy key the existing app already persists to. We keep writing
// it so VoiceBar and server-side locale reads stay in sync.
const KEY_LEGACY = 'farroway:lang';
const KEY_LEGACY_VOICE = 'farroway:voiceLang';
const KEY_LEGACY_UI = 'farroway_lang';

const DEFAULT_LANG = 'en';

function readLs(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLs(key, value) {
  try { localStorage.setItem(key, value); } catch { /* quota / locked */ }
}

/** Map a raw browser locale (`en-US`, `hi-IN`, `ak-GH`) to ours. */
export function detectBrowserLanguage() {
  if (typeof navigator === 'undefined') return null;
  const candidates = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ].filter(Boolean);
  for (const raw of candidates) {
    const lower = String(raw).toLowerCase();
    const base = lower.split(/[-_]/)[0];
    if (SUPPORTED_SET.has(base)) return base;
    // Akan maps to Twi for our purposes.
    if (base === 'ak') return 'tw';
  }
  return null;
}

/**
 * Resolve the active language using the priority chain. `opts`:
 *   profileLang — string code the caller read from the farmer profile
 */
export function resolveLanguage(opts = {}) {
  const manual = readLs(KEY_MANUAL);
  if (manual && SUPPORTED_SET.has(manual)) return manual;

  const profile = opts.profileLang || readLs(KEY_PROFILE);
  if (profile && SUPPORTED_SET.has(profile)) return profile;

  // Legacy path — older installs wrote only to the combined key.
  const legacy = readLs(KEY_LEGACY) || readLs(KEY_LEGACY_UI) || readLs(KEY_LEGACY_VOICE);
  if (legacy && SUPPORTED_SET.has(legacy)) return legacy;

  const browser = detectBrowserLanguage();
  if (browser) return browser;

  return DEFAULT_LANG;
}

/**
 * Record a user choice. Writes the manual slot AND the three legacy
 * keys so the rest of the app (voice, server, old selectors) all
 * flip in one atomic operation.
 */
export function confirmLanguage(code) {
  if (!SUPPORTED_SET.has(code)) return false;
  writeLs(KEY_MANUAL, code);
  writeLs(KEY_PROFILE, code);
  writeLs(KEY_LEGACY, code);
  writeLs(KEY_LEGACY_VOICE, code);
  writeLs(KEY_LEGACY_UI, code);
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('farroway:langchange', { detail: code })); }
    catch { /* ignore */ }
  }
  return true;
}

export const _keys = { KEY_MANUAL, KEY_PROFILE, KEY_LEGACY };
