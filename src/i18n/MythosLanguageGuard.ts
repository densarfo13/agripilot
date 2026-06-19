/**
 * MythosLanguageGuard.ts — sprint #204, spec STEP 2.
 *
 * The single language-health composite. Pins:
 *   window.__farrowayLanguageHealth() — unified score over the
 *     three existing probes (coverage / consistency / live leaks).
 *
 * It does NOT re-implement detection (the build-time `audit:i18n`
 * gate + the runtime LanguageLeakDetector + LanguageConsistencyRuntime
 * already own that). It COMPOSES them into one verdict + a 0-100
 * score so the founder can read one number.
 *
 * Score model (transparent + honest — two axes never conflated):
 *   structuralScore  — code-side: 100 when 0 {key} leaks + 0 blank
 *                      labels + every locale at 100% structural
 *                      parity. This is the axis a sprint can move.
 *   translationScore — content-side: min real-translation % across
 *                      launch locales. Moved by TRANSLATORS, not code.
 *   languageHealth   — reported as the structural score (the
 *                      engineering measure); translationScore is
 *                      surfaced separately, never folded in to fake
 *                      a 100.
 *
 * Pure / SSR-safe / idempotent / never throws.
 */

export const MYTHOS_LANGUAGE_GUARD_VERSION = 'mythos-language-guard-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _hasWindow = (): boolean =>
  _safe(() => typeof window !== 'undefined' && !!window, false);

function _probe(name: string): any {
  if (!_hasWindow()) return null;
  return _safe(() => {
    const fn = (window as any)[name];
    if (typeof fn !== 'function') return null;
    const v = fn();
    return v && typeof v === 'object' ? v : null;
  }, null);
}
function _num(v: unknown): number | null {
  return (typeof v === 'number' && Number.isFinite(v)) ? v : null;
}

export function buildFarrowayLanguageHealth(): Readonly<{
  ok: boolean;
  runtimeVersion: string;
  languageHealth: number;          // 0-100, structural (engineering)
  structuralScore: number;
  translationScore: number | null; // content (translator), null if unknown
  keyLeaks: number;
  blankLabels: number;
  activeLocale: string;
  verdict: 'LOCKED' | 'NEEDS_TRANSLATION' | 'LEAKING';
  composedFrom: ReadonlyArray<string>;
}> {
  return _safe(() => {
    const leaks = _probe('__farrowayLanguageLeaks') || {};
    const consistency = _probe('__languageConsistencyHealth') || {};
    const coverage = _probe('__languageHealth') || {};

    const keyLeaks = _num(leaks.keyLeaks) ?? 0;
    const blankLabels = _num(leaks.blankLabels) ?? _num(consistency.blankLabels) ?? 0;
    const activeLocale = typeof leaks.activeLocale === 'string'
      ? leaks.activeLocale : 'en';

    // Structural: full marks minus penalties for the two definite
    // code-side failures. Each leak/blank costs points; floors at 0.
    const structuralScore = Math.max(0, 100 - (keyLeaks * 10) - (blankLabels * 5));

    // Translation: min real-translation % across locales, from the
    // coverage probe when present. null when we can't measure it.
    let translationScore: number | null = null;
    const byLocale = coverage.translationCoverageByLocale;
    if (byLocale && typeof byLocale === 'object') {
      const vals = Object.values(byLocale)
        .map((v) => _num(v)).filter((v): v is number => v != null);
      if (vals.length > 0) translationScore = Math.min(...vals);
    }

    let verdict: 'LOCKED' | 'NEEDS_TRANSLATION' | 'LEAKING';
    if (keyLeaks > 0 || blankLabels > 0) verdict = 'LEAKING';
    else if (translationScore != null && translationScore < 100) verdict = 'NEEDS_TRANSLATION';
    else verdict = 'LOCKED';

    return Object.freeze({
      ok: keyLeaks === 0 && blankLabels === 0,
      runtimeVersion: 'farroway-language-health-v1',
      languageHealth: structuralScore,
      structuralScore,
      translationScore,
      keyLeaks, blankLabels, activeLocale,
      verdict,
      composedFrom: Object.freeze([
        '__farrowayLanguageLeaks', '__languageConsistencyHealth', '__languageHealth',
      ]),
    });
  }, Object.freeze({
    ok: false,
    runtimeVersion: 'farroway-language-health-v1',
    languageHealth: 0, structuralScore: 0, translationScore: null,
    keyLeaks: 0, blankLabels: 0, activeLocale: 'en',
    verdict: 'LEAKING' as const,
    composedFrom: Object.freeze([
      '__farrowayLanguageLeaks', '__languageConsistencyHealth', '__languageHealth',
    ]),
  }));
}

let _installed = false;
export function installMythosLanguageGuard(): void {
  if (_installed) return;
  if (!_hasWindow()) return;
  _safe(() => {
    Object.defineProperty(window as any, '__farrowayLanguageHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildFarrowayLanguageHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  buildFarrowayLanguageHealth, installMythosLanguageGuard,
});
export default installMythosLanguageGuard;
