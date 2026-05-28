/**
 * supportedLocales.ts — single source of truth for which locales
 * the app ships translation columns for.
 *
 * Before this file: three pickers (LanguageSelector, QuickLanguageModal,
 * FastFlow) each hardcoded a different (and incomplete) locale list.
 * Net effect: "I only see English in the picker."
 *
 * Contract
 * ────────
 *   SUPPORTED_LOCALES — readonly tuple, exact order shown in pickers.
 *                       Each entry has { code, englishName, nativeName }.
 *   LOCALE_CODES       — readonly tuple of just the codes for quick
 *                       `.includes()` checks and prop-type validation.
 *   isSupportedLocale  — narrow type guard.
 *   normalizeLocale    — coerces a free-form code to a supported one
 *                       (lowercase, trims region suffix); falls back
 *                       to 'en' when there is no match.
 *
 * Rules of the road
 * ─────────────────
 *   • Adding a locale here MUST be paired with a new
 *     src/i18n/columns/T-<code>.js column file. Otherwise the runtime
 *     fallback chain silently returns English and `__i18nState()`
 *     will flag the locale as half-shipped.
 *   • Do NOT introduce a parallel locale list anywhere else. CI grep
 *     guard (npm run check:no-duplicate-locales) will fail PRs that
 *     try to.
 *   • The english name field stays in English so the picker can show
 *     a stable accessible label (`aria-label`); the native name is
 *     what the user sees in the option row.
 *
 * Strict-rule audit
 *   • Pure data + pure functions. No imports of React, T, or window.
 *   • SSR-safe — no side effects on import.
 *   • Frozen at module scope so call sites cannot mutate.
 */

export type LocaleCode = 'en' | 'fr' | 'sw' | 'ha' | 'tw' | 'hi';

export interface SupportedLocale {
  readonly code:        LocaleCode;
  readonly englishName: string;
  readonly nativeName:  string;
}

// The order here IS the order pickers render. English first
// (source language); the rest follow the pilot-region priority
// the partner agronomy team agreed on (FR / SW / HA / TW / HI).
// RC1 — Hindi remains in the supported set so existing users who
// have it selected don't break; pickers consult getLaunchLocales()
// below to decide which codes to surface in the chooser.
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = Object.freeze([
  Object.freeze({ code: 'en', englishName: 'English',   nativeName: 'English'    }),
  Object.freeze({ code: 'fr', englishName: 'French',    nativeName: 'Français' }),
  Object.freeze({ code: 'sw', englishName: 'Swahili',   nativeName: 'Kiswahili'  }),
  Object.freeze({ code: 'ha', englishName: 'Hausa',     nativeName: 'Hausa'      }),
  Object.freeze({ code: 'tw', englishName: 'Twi',       nativeName: 'Twi'        }),
  Object.freeze({ code: 'hi', englishName: 'Hindi',     nativeName: 'हिन्दी' }),
]) as readonly SupportedLocale[];

/**
 * RC1 launch-locale gate. Hindi is hidden from the public picker
 * because translation coverage is at 54.3% (see check:translations).
 * Returns the subset of SUPPORTED_LOCALES that should be shown in
 * UI pickers for the current build.
 *
 *   • Hindi is included when `enableHindiLocale` feature flag is
 *     ON (set in src/config/features.js)
 *   • All other 5 locales are always shown
 *
 * Existing-Hindi users keep their selection — `isSupportedLocale`
 * still recognizes 'hi' as valid; only the chooser hides it.
 */
export function getLaunchLocales(opts?: {
  enableHindi?: boolean
}): readonly SupportedLocale[] {
  const enableHindi = !!(opts && opts.enableHindi);
  if (enableHindi) return SUPPORTED_LOCALES;
  return Object.freeze(
    SUPPORTED_LOCALES.filter((l) => l.code !== 'hi'),
  ) as readonly SupportedLocale[];
}

export const LOCALE_CODES: readonly LocaleCode[] = Object.freeze(
  SUPPORTED_LOCALES.map((l) => l.code),
) as readonly LocaleCode[];

export const DEFAULT_LOCALE: LocaleCode = 'en';

/**
 * Storage key consumers SHOULD use when reading/writing the
 * persisted locale. The actual legacy key wired into
 * `src/i18n/index.js` is `farroway:lang`; this constant lets new
 * code reference one symbol so a future migration is one-line.
 */
export const LOCALE_STORAGE_KEY = 'farroway:lang';

const _codeSet = new Set<string>(LOCALE_CODES);

/**
 * Type guard. Use this whenever a locale code comes in from
 * untrusted input (URL param, storage, server payload).
 */
export function isSupportedLocale(code: unknown): code is LocaleCode {
  return typeof code === 'string' && _codeSet.has(code);
}

/**
 * Coerce any input to a supported locale code:
 *   • lowercases
 *   • strips a region/script suffix ('en-US' → 'en', 'zh-Hans' → 'zh' → falls back)
 *   • returns DEFAULT_LOCALE on any failure
 *
 * Never throws.
 */
export function normalizeLocale(input: unknown): LocaleCode {
  try {
    if (typeof input !== 'string') return DEFAULT_LOCALE;
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return DEFAULT_LOCALE;
    if (isSupportedLocale(trimmed)) return trimmed;
    // Strip region/script suffix (e.g. 'en-US', 'fr_CA', 'zh-Hans')
    const head = trimmed.split(/[-_]/)[0];
    if (isSupportedLocale(head)) return head;
    return DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Quick lookup for the SupportedLocale entry. Returns undefined when
 * the code is not in the registry (callers should guard or use
 * normalizeLocale upstream).
 */
export function getSupportedLocale(code: unknown): SupportedLocale | undefined {
  if (!isSupportedLocale(code)) return undefined;
  return SUPPORTED_LOCALES.find((l) => l.code === code);
}

const _module = {
  SUPPORTED_LOCALES,
  LOCALE_CODES,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isSupportedLocale,
  normalizeLocale,
  getSupportedLocale,
};
export default _module;
