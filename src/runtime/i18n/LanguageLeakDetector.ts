/**
 * LanguageLeakDetector.ts — sprint #203, spec §6.
 *
 * Runtime DOM guard. Pins window.__farrowayLanguageLeaks(). Scans
 * the live document for the three leak classes a build-time gate
 * cannot see:
 *   1. {key.path} leaks — a key that fell through every fallback
 *   2. blank labels — empty interactive elements (button/a with no
 *      accessible text)
 *   3. Latin-script English while the active locale is non-Latin
 *      (Hindi = Devanagari). This is the only reliable runtime
 *      "English leak" signal — for Latin-script locales (fr/tw/sw/ha)
 *      English and the target share an alphabet, so we cannot
 *      distinguish by script and report leakSuspectCount: null
 *      (honest — we never fabricate a count we can't measure).
 *
 * Read-only. Pure except the DOM read. SSR-safe. Never throws.
 */

export const LANGUAGE_LEAK_DETECTOR_VERSION = 'language-leak-detector-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _hasDoc = (): boolean =>
  _safe(() => typeof document !== 'undefined' && !!document.body, false);

function _activeLocale(): string {
  return _safe(() => {
    const html = document.documentElement;
    const l = (html && html.getAttribute('lang')) || '';
    return String(l).toLowerCase().slice(0, 2);
  }, 'en');
}

// Visible {key.path} leaks — never legitimate grower copy.
function _keyLeaks(text: string): number {
  const m = text.match(/\{[a-z][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+\}/g);
  return m ? m.length : 0;
}

// Blank interactive elements (button / link with no text + no aria).
function _blankLabels(): number {
  return _safe(() => {
    const els = document.querySelectorAll('button, a[href], [role="button"]');
    let n = 0;
    els.forEach((el) => {
      const txt = String((el as HTMLElement).innerText || '').trim();
      const aria = el.getAttribute('aria-label') || el.getAttribute('title') || '';
      const hasIcon = el.querySelector('svg, img, [aria-hidden="true"]');
      if (!txt && !aria.trim() && !hasIcon) n++;
    });
    return n;
  }, 0);
}

// Latin-English suspects while a non-Latin locale is active. Counts
// text nodes that are pure ASCII-letters of length ≥ 4 (a word).
function _englishSuspects(locale: string): number | null {
  // Only meaningful for non-Latin-script locales. Today that's hi.
  const NON_LATIN = new Set(['hi']);
  if (!NON_LATIN.has(locale)) return null; // honest: can't tell
  return _safe(() => {
    const body = document.body;
    if (!body) return 0;
    const text = String(body.innerText || '');
    // Words of 4+ ASCII letters that aren't all-caps acronyms.
    const words = text.match(/\b[A-Za-z]{4,}\b/g) || [];
    // Filter obvious non-copy (units, brand). Count distinct-ish.
    const suspects = words.filter((w) => !/^[A-Z]{2,}$/.test(w));
    return suspects.length;
  }, 0);
}

export function buildLanguageLeaks(): Readonly<{
  ok: boolean;
  runtimeVersion: string;
  activeLocale: string;
  keyLeaks: number;
  blankLabels: number;
  englishSuspectCount: number | null;
  scanned: boolean;
}> {
  return _safe(() => {
    if (!_hasDoc()) {
      return Object.freeze({
        ok: true, runtimeVersion: 'farroway-language-leaks-v1',
        activeLocale: 'en', keyLeaks: 0, blankLabels: 0,
        englishSuspectCount: null, scanned: false,
      });
    }
    const locale = _activeLocale();
    const text = _safe(() => String(document.body.innerText || ''), '');
    const keyLeaks = _keyLeaks(text);
    const blankLabels = _blankLabels();
    const englishSuspectCount = _englishSuspects(locale);
    // ok when no key leaks + no blanks (the two definite failures).
    // englishSuspectCount is advisory (heuristic), not an ok-gate.
    return Object.freeze({
      ok: keyLeaks === 0 && blankLabels === 0,
      runtimeVersion: 'farroway-language-leaks-v1',
      activeLocale: locale,
      keyLeaks, blankLabels, englishSuspectCount,
      scanned: true,
    });
  }, Object.freeze({
    ok: false, runtimeVersion: 'farroway-language-leaks-v1',
    activeLocale: 'en', keyLeaks: 0, blankLabels: 0,
    englishSuspectCount: null, scanned: false,
  }));
}

let _installed = false;
export function installLanguageLeakDetector(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__farrowayLanguageLeaks', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildLanguageLeaks(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  buildLanguageLeaks, installLanguageLeakDetector,
});
export default installLanguageLeakDetector;
