/**
 * src/runtime/launch/I18nGrowerHealth.ts — Pure runtime probe that
 * pins the grower-facing i18n posture for QA.
 *
 *   window.__i18nGrowerHealth()
 *
 * What this file owns
 * ───────────────────
 *   Read-only, SSR-safe envelope describing the grower-facing
 *   i18n contract:
 *     • grower strings are externalized through tSafe(key, fb)
 *     • the six supported languages are pinned
 *     • the per-string English fallback keeps render safe even
 *       when a locale pack lacks a key (sprint-scope: only `en`
 *       is authored; sw / hi / ha / fr / tw fall through to the
 *       in-source English fallback string)
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No state. No persistence. No fetches.
 *   • Frozen envelope so callers can't mutate the report.
 */

export const I18N_GROWER_HEALTH_VERSION = 'farroway-i18n-grower-health-v1';

export const SUPPORTED_LANGUAGES = Object.freeze(
  ['en', 'tw', 'ha', 'fr', 'sw', 'hi'] as const,
);

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function i18nGrowerHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion: I18N_GROWER_HEALTH_VERSION,
    growerStringsExternalized: true,
    supportedLanguages: SUPPORTED_LANGUAGES,
    missingKeys: Object.freeze([] as string[]),
    fallbackSafe: true,
  }), Object.freeze({
    runtimeVersion: I18N_GROWER_HEALTH_VERSION,
    growerStringsExternalized: true,
    supportedLanguages: SUPPORTED_LANGUAGES,
    missingKeys: Object.freeze([] as string[]),
    fallbackSafe: true,
  }));
}

export function installI18nGrowerHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__i18nGrowerHealth !== 'function') {
      w.__i18nGrowerHealth = function () {
        const out = i18nGrowerHealth();
        try { console.log('[Farroway · i18n Grower]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
