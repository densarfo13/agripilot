/**
 * canonicalHomeGuard.js — dev-mode assertion that ONLY
 * src/pages/Home.jsx renders the canonical farmer Home.
 *
 *   import { assertCanonicalHome } from '../lib/canonicalHomeGuard.js';
 *
 *   export default function Home() {
 *     assertCanonicalHome(import.meta.url);
 *     // …
 *   }
 *
 * Permanent Farmer Home spec §7 — if a non-Home file ever calls
 * this guard (i.e. some future commit reintroduces a parallel
 * Home component and forgets to pass `import.meta.url` from the
 * canonical file), the assertion throws in development. Production
 * builds tree-shake the entire body via the import.meta.env.DEV
 * gate so the guard is zero-cost at runtime.
 *
 * Strict-rule audit
 *   • Pure / SSR-safe.
 *   • NEVER throws in production — DEV gate at the top of the
 *     function returns early.
 *   • Idempotent for the canonical caller — re-mounts of Home.jsx
 *     are fine; only a SECOND distinct callerUrl triggers the
 *     "two callers" violation.
 */

// Module-level singleton that records the URL of the first caller.
// Reset only by HMR (which re-evaluates the module) — every fresh
// mount of Home in dev re-asserts cleanly.
let _firstCallerUrl = null;

// Canonical file fragments — every caller of this guard must
// come from one of these. The regex matches both .jsx and a
// hypothetical future .tsx rename without code change.
const CANONICAL_FRAGMENTS = ['/pages/Home.jsx', '/pages/Home.tsx'];

/**
 * Assert the calling module is the canonical Home file.
 *
 * No-op in production.
 *
 * @param {string} callerUrl — pass `import.meta.url` from the caller.
 * @throws {Error} if called from a non-canonical file in development.
 */
export function assertCanonicalHome(callerUrl) {
  try {
    // Production builds: Vite folds the condition to false and
    // the entire body becomes dead code (tree-shaken).
    if (typeof import.meta === 'undefined'
        || !import.meta.env
        || !import.meta.env.DEV) {
      return;
    }
  } catch { return; }

  const url = typeof callerUrl === 'string' ? callerUrl : '';

  // Caller must come from the canonical Home file.
  const isCanonical = CANONICAL_FRAGMENTS.some((f) => url.includes(f));
  if (!isCanonical) {
    throw new Error(
      '[CANONICAL_HOME] guard violated — only src/pages/Home.jsx '
      + 'may render canonical Home. Got caller: ' + (url || '(unknown)'),
    );
  }

  // First caller wins. A SECOND distinct caller URL signals that
  // a parallel Home component slipped into the tree even though
  // its URL happens to contain "/pages/Home" (unlikely, but the
  // guard catches it).
  if (_firstCallerUrl === null) {
    _firstCallerUrl = url;
    return;
  }
  if (_firstCallerUrl !== url) {
    throw new Error(
      '[CANONICAL_HOME] guard violated — two distinct callers '
      + 'attempted to render Home. First: ' + _firstCallerUrl
      + ' / Second: ' + url,
    );
  }
}

// Test-only — reset the module-level memo so unit tests can
// exercise the first-caller + duplicate-caller branches.
export function _resetCanonicalHomeGuard() {
  _firstCallerUrl = null;
}

const _module = { assertCanonicalHome, _resetCanonicalHomeGuard };
export default _module;
