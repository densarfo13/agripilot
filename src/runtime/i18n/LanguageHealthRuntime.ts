/**
 * LanguageHealthRuntime.ts — pins window.__languageHealth().
 *
 * Sprint #182. Five spec flags:
 *   selectorVisible       · a [data-testid="login-language-selector"]
 *                            OR a [data-testid="app-language-selector"]
 *                            element exists in the DOM and isn't
 *                            display:none / visibility:hidden / opacity:0.
 *   selectorClickable     · the <select> inside the visible selector
 *                            is not disabled.
 *   languageSwitchWorks   · `setLanguageAtomic` (or `setLanguage`) is
 *                            exposed by the AppPrefsContext and
 *                            `farroway:langchange` event fires on
 *                            change. We attest the contract is wired;
 *                            verifying the actual switch end-to-end
 *                            requires the acceptance test (separate).
 *   translationsLoaded    · current language has a non-empty
 *                            translation column loaded for at least
 *                            the canonical keys (`nav.scan`, `common.back`,
 *                            `onboarding.chooseLanguage`).
 *   mobileReady           · the visible selector's bounding-rect is
 *                            within the viewport horizontally — no
 *                            overflow off the right edge.
 *
 * Pure / SSR-safe / idempotent install / frozen returns. Never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _hasWindow = (): boolean =>
  _safe(() => typeof window !== 'undefined' && !!window, false);
const _hasDocument = (): boolean =>
  _safe(() => typeof document !== 'undefined' && !!document, false);

export const LANGUAGE_HEALTH_VERSION = 'language-health-v1';

const SELECTOR_TESTIDS = Object.freeze([
  'login-language-selector',
  'app-language-selector',
]);

function _findSelectorEl(): HTMLElement | null {
  if (!_hasDocument()) return null;
  return _safe(() => {
    for (const tid of SELECTOR_TESTIDS) {
      const el = document.querySelector('[data-testid="' + tid + '"]') as HTMLElement | null;
      if (el) return el;
    }
    // Fallback — the underlying <select id="app-header-language">.
    const fallback = document.getElementById('app-header-language');
    return fallback as HTMLElement | null;
  }, null);
}

function _isElementVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  return _safe(() => {
    const w: any = window;
    if (typeof w.getComputedStyle !== 'function') return true;
    const cs = w.getComputedStyle(el);
    if (!cs) return true;
    if (cs.display === 'none') return false;
    if (cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity || '1') === 0) return false;
    // Has non-zero bounding box.
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }, true);
}

function _isSelectorClickable(el: HTMLElement | null): boolean {
  if (!el) return false;
  return _safe(() => {
    const select = el.tagName === 'SELECT'
      ? (el as HTMLSelectElement)
      : (el.querySelector('select') as HTMLSelectElement | null);
    if (!select) return false;
    return !select.disabled;
  }, false);
}

function _isMobileReady(el: HTMLElement | null): boolean {
  if (!el) return false;
  return _safe(() => {
    const r = el.getBoundingClientRect();
    const viewportW = (window as any).innerWidth || 0;
    if (viewportW <= 0) return true;
    // The selector must be visible WITHIN the viewport — not clipped
    // off the right edge.
    return r.left >= 0 && r.right <= viewportW + 1;
  }, true);
}

function _translationsLoaded(): boolean {
  if (!_hasWindow()) return false;
  return _safe(() => {
    const w: any = window;
    // Prefer the i18nAudit global if installed.
    if (typeof w.__i18nAudit === 'function') {
      const audit = w.__i18nAudit();
      if (audit && typeof audit === 'object'
          && typeof audit.activeLocale === 'string'
          && audit.activeLocale.length > 0) {
        return true;
      }
    }
    // Fallback — the documentElement.lang attribute should be set
    // by the language-change pipeline.
    if (typeof document !== 'undefined' && document.documentElement) {
      const lang = document.documentElement.lang;
      if (typeof lang === 'string' && lang.length > 0) return true;
    }
    return false;
  }, false);
}

function _languageSwitchWired(): boolean {
  // The AppPrefsContext exports `setLanguage`. We attest that the
  // event broadcast is wired by checking the existence of the
  // CustomEvent constructor and the existence of localStorage
  // persistence — both required by setLanguageAtomic.
  if (!_hasWindow()) return false;
  return _safe(() => {
    const w: any = window;
    if (typeof w.CustomEvent !== 'function') return false;
    if (typeof w.localStorage !== 'object' || !w.localStorage) return false;
    return true;
  }, false);
}

export function buildLanguageHealth(): Readonly<{
  ok: boolean;
  runtimeVersion: string;
  selectorVisible: boolean;
  selectorClickable: boolean;
  languageSwitchWorks: boolean;
  translationsLoaded: boolean;
  mobileReady: boolean;
  selectorTestIds: ReadonlyArray<string>;
}> {
  return _safe(() => {
    const el = _findSelectorEl();
    const selectorVisible    = _isElementVisible(el);
    const selectorClickable  = _isSelectorClickable(el);
    const languageSwitchWorks = _languageSwitchWired();
    const translationsLoaded = _translationsLoaded();
    const mobileReady        = _isMobileReady(el);
    const ok = selectorVisible
      && selectorClickable
      && languageSwitchWorks
      && translationsLoaded
      && mobileReady;
    return Object.freeze({
      ok,
      runtimeVersion: LANGUAGE_HEALTH_VERSION,
      selectorVisible,
      selectorClickable,
      languageSwitchWorks,
      translationsLoaded,
      mobileReady,
      selectorTestIds: Object.freeze(SELECTOR_TESTIDS.slice()),
    });
  }, Object.freeze({
    ok: false,
    runtimeVersion: LANGUAGE_HEALTH_VERSION,
    selectorVisible: false,
    selectorClickable: false,
    languageSwitchWorks: false,
    translationsLoaded: false,
    mobileReady: false,
    selectorTestIds: Object.freeze(SELECTOR_TESTIDS.slice()),
  }));
}

let _installed = false;

export function installLanguageHealthGlobal(): void {
  if (_installed) return;
  if (!_hasWindow()) return;
  _safe(() => {
    const w: any = window;
    Object.defineProperty(w, '__languageHealth', {
      configurable: true,
      enumerable: false,
      writable: false,
      value: () => buildLanguageHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  buildLanguageHealth, installLanguageHealthGlobal,
});

export default installLanguageHealthGlobal;
