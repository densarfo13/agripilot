/**
 * assertApiBaseUrl.js — production-mode assertion that the frontend
 * build knows where the API lives.
 *
 * The audit found that `src/lib/api.js` defaults `VITE_API_BASE_URL`
 * to an empty string, silently making every API call a same-origin
 * request. On Capacitor the UI runs from `capacitor://localhost` so
 * same-origin goes nowhere; on a split-origin Railway deploy the UI
 * is served from a different subdomain than the API. Both break
 * silently — login succeeds against the wrong origin or 404s a path
 * the static server doesn't know about.
 *
 *   resolveApiBase({ isProd, env }) → string
 *     throws when isProd && VITE_API_BASE_URL is empty / missing.
 *
 * The helper is pure + testable: it takes `env` + `isProd` as args
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
  if (capacitor && !raw) {
    throw new Error(
      'VITE_API_BASE_URL is required for Capacitor native builds. '
      + 'Set it in .env.production before running vite build.',
    );
  }

  if (isProd && !raw) {
    throw new Error(
      'VITE_API_BASE_URL is required in production builds. '
      + 'Browser would otherwise make same-origin requests that break '
      + 'on split-origin deploys. Set VITE_API_BASE_URL in your '
      + 'hosting environment (Railway/Vercel/etc) and redeploy.',
    );
  }

  // Normalise: trim a trailing slash so callers can safely concat
  // `${base}/api/v2/...` without doubling up.
  return raw.replace(/\/+$/, '');
}

export const _internal = Object.freeze({ /* reserved */ });
