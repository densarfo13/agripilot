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
  // hosts /api/* — empty base URL is correct. Log a warning so an
  // operator can tell "intentional same-origin" from "forgot the env
  // var" in dev tools, but never crash the bundle at module load.
  //
  // De-duped: the previous shape fired the warning on every call to
  // resolveApiBase, which in practice meant once per module that
  // imports api.js — turning DevTools into noise on every page load.
  // The flag below means the warning surfaces ONCE per session;
  // ops still sees it, the farmer's console doesn't get spammed.
  if (isProd && !raw) _maybeWarnSameOrigin();

  // Normalise: trim a trailing slash so callers can safely concat
  // `${base}/api/v2/...` without doubling up.
  return raw.replace(/\/+$/, '');
}

let _sameOriginWarned = false;
function _maybeWarnSameOrigin() {
  if (_sameOriginWarned) return;
  _sameOriginWarned = true;
  if (typeof console === 'undefined' || !console.warn) return;
  try {
    console.warn(
      '[api] VITE_API_BASE_URL not set; falling back to same-origin requests. '
      + 'Set it explicitly if your frontend and API live on different origins.',
    );
  } catch { /* ignore */ }
}

export const _internal = Object.freeze({ /* reserved */ });
