/**
 * LanguageSessionLock.ts — sprint #215 §9.
 *
 * Once a locale is chosen it stays frozen for the session until the
 * user EXPLICITLY changes it — so a stray re-detect / default can't
 * flip a Twi session back toward English mid-flow. A change is honored
 * only when flagged explicit; everything else is rejected and the
 * locked locale is returned.
 *
 * Module-scope lock (per session). SSR-safe. Never throws. Pins
 * window.__languageSessionLockHealth().
 */

export const LANGUAGE_SESSION_LOCK_VERSION = 'language-session-lock-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

let _locked: string | null = null;

/** Lock the session locale (idempotent for the same code). */
export function lockLanguage(code: string): string {
  return _safe(() => {
    const c = _str(code);
    if (c && !_locked) _locked = c;
    return _locked || c;
  }, _locked || '');
}

export function getLockedLanguage(): string | null { return _locked; }

/**
 * Resolve the effective locale for a requested change. An explicit
 * user change updates the lock; a non-explicit request is rejected and
 * the locked locale is returned (prevents mixed-language flips).
 */
export function resolveLanguageChange(requested: string, opts?: { explicit?: boolean }): Readonly<{
  locale: string; changed: boolean; rejected: boolean;
}> {
  return _safe(() => {
    const req = _str(requested);
    if (!_locked) { _locked = req; return Object.freeze({ locale: req, changed: true, rejected: false }); }
    if (req === _locked) return Object.freeze({ locale: _locked, changed: false, rejected: false });
    if (opts && opts.explicit) {
      _locked = req;
      return Object.freeze({ locale: req, changed: true, rejected: false });
    }
    // Non-explicit attempt to change a locked locale → rejected.
    return Object.freeze({ locale: _locked, changed: false, rejected: true });
  }, Object.freeze({ locale: _locked || _str(requested), changed: false, rejected: false }));
}

export function buildLanguageSessionLockHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  languageSessionLockReady: true; locked: string | null; preventsMixedLanguage: true;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: LANGUAGE_SESSION_LOCK_VERSION,
    languageSessionLockReady: true as const,
    locked: _locked,
    preventsMixedLanguage: true as const,
  });
}

let _installed = false;
export function installLanguageSessionLockHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__languageSessionLockHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildLanguageSessionLockHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  lockLanguage, getLockedLanguage, resolveLanguageChange,
  buildLanguageSessionLockHealth, installLanguageSessionLockHealthGlobal,
});
export default resolveLanguageChange;
