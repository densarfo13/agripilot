/**
 * assertApiBaseUrl.js — production-mode assertion that the frontend
 * build knows where the API lives.
 *
 *   resolveApiBase({ isProd, env, capacitor }) → string
 *
 * Behaviour
 *   • Capacitor + missing → THROW. The app shell runs from
 *     capacitor://localhost which has no server; an empty base URL
 *     is unrecoverable.
 *   • Browser + production + missing → console.warn and return ''.
 *     Same-origin requests are the correct default for the common
 *     Railway monolith deploy where the Express server serves both
 *     the API and the frontend bundle from one origin. Throwing
 *     here crashed the bundle at module load → blank page.
 *   • Browser + production + set → return trimmed (and trailing-
 *     slash-normalised) base URL.
 *
 * Pure + testable: it takes `env` + `isProd` + `capacitor` as args
 * so tests don't have to mutate `import.meta.env`.
 */

export function resolveApiBase({
  isProd = typeof import.meta !== 'undefined'
            && typeof import.meta.env !== 'undefined'
            ? Boolean(import.meta.env.PROD) : false,
  env   = typeof import.meta !== 'undefined' ? (import.meta.env || {}) : {},
  capacitor = typeof window !== 'undefined'
              && Boolean(window.Capacitor && window.Capacitor.isNativePlatform
                          && window.Capacitor.isNativePlatform()),
} = {}) {
  const raw = env.VITE_API_BASE_URL == null ? '' : String(env.VITE_API_BASE_URL).trim();

  // Capacitor native builds ALWAYS need an explicit base URL — the
  // app shell runs from a capacitor:// origin that has no server.
  // This is the ONE case where we throw, because no fallback works.
  if (capacitor && !raw) {
    throw new Error(
      'VITE_API_BASE_URL is required for Capacitor native builds. '
      + 'Set it in .env.production before running vite build.',
    );
  }

  // Browser production with no base URL → fall through to same-origin.
  // Most Railway deploys serve the bundle from the same Express that
  // hosts /api/* — empty base URL is correct. We do NOT warn in
  // production: same-origin is the documented Railway monolith pattern
  // and the warning has no operational value to a farmer opening
  // DevTools — it just looks like an error. Dev still gets the warn so
  // a developer running `vite preview` against a misconfigured .env
  // sees the hint immediately.
  if (!isProd && !raw) _maybeWarnSameOrigin();

  // Normalise: trim a trailing slash so callers can safely concat
  // `${base}/api/v2/...` without doubling up.
  return raw.replace(/\/+$/, '');
}

// F6 fix (interactive smoke test): the smoke-test console showed
// this warning firing ~8 times on initial page load. Module-local
// `let _sameOriginWarned` works for one ES module evaluation, but
// Vite dev HMR re-evaluates modules on touch and resets the flag,
// letting the warning re-fire on every re-eval. Persist the flag
// on globalThis so it survives HMR boundaries within a single
// browser tab — the warning now fires AT MOST once per page load.
const _GLOBAL_KEY = '__farroway_apiBaseSameOriginWarned';

function _maybeWarnSameOrigin() {
  try {
    const root = (typeof globalThis !== 'undefined') ? globalThis
               : (typeof window     !== 'undefined') ? window : null;
    if (root && root[_GLOBAL_KEY]) return;
    if (root) root[_GLOBAL_KEY] = true;
  } catch { /* ignore — globalThis access can throw under strict CSP */ }
  if (typeof console === 'undefined' || !console.warn) return;
  try {
    console.warn(
      '[api] VITE_API_BASE_URL not set; falling back to same-origin requests. '
      + 'Set it explicitly if your frontend and API live on different origins.',
    );
  } catch { /* ignore */ }
}

export const _internal = Object.freeze({ /* reserved */ });
