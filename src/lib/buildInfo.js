/**
 * buildInfo.js — single source of truth for the active frontend
 * build's identity. Imported once at boot from main.jsx so the
 * deployed bundle exposes a greppable signal that ops can use to
 * confirm "yes, this is the new build" vs "the deploy didn't push."
 *
 * Why this exists
 * ─────────────────
 * The Railway-deployment reflection audit found that production
 * was running stale code because `master` was ahead of `origin/
 * master` by 8 commits — every redeploy reshipped the same source.
 * The bundle hash in the HTML changed (chunked deps shifted) but
 * no behaviour did. This module gives DevTools + the DOM a clear
 * post-deploy marker so the next mismatch surfaces in seconds:
 *
 *   1. console.log in main.jsx prints the version on boot.
 *   2. A hidden <div id="farroway-build-marker"> is inserted into
 *      <body> for browser-extension / e2e inspection.
 *
 * Production-safe
 * ─────────────────
 * The version string is computed at MODULE-LOAD time inside the
 * shipped bundle. That's intentional: each fresh `vite build`
 * produces a new bundle file whose embedded `new Date().toISOString()`
 * is the build moment. Old caches that still hold the prior bundle
 * keep their prior timestamp; new caches load the new timestamp.
 * Mismatch == stale cache.
 */

// One-shot computed at bundle module-load. Vite locks this into
// the chunk so every browser running THIS bundle agrees on the
// same string. If two visitors see different values, one of them
// is on an older cached bundle — exactly the diagnostic signal.
export const FARROWAY_BUILD_INFO = Object.freeze({
  version: 'alive-ui-' + new Date().toISOString(),
  source:  'active-production-frontend',
});

/**
 * Insert the hidden DOM marker once. Idempotent — second+ calls
 * leave the existing node alone. Called from main.jsx after
 * ReactDOM mounts so it never races React's tree.
 *
 * In dev, the marker also gets a visible 1-line strip at the
 * bottom of the page (12px font, semi-transparent) so engineers
 * can visually confirm the build without opening DevTools.
 */
export function installBuildMarker() {
  try {
    if (typeof document === 'undefined') return;
    if (document.getElementById('farroway-build-marker')) return;
    const el = document.createElement('div');
    el.id = 'farroway-build-marker';
    el.setAttribute('data-build', FARROWAY_BUILD_INFO.version);
    el.setAttribute('data-source', FARROWAY_BUILD_INFO.source);
    // Always present in the DOM (for scrapers / e2e), only visible
    // in dev. Pure inline styles so a missing stylesheet can't
    // accidentally render it visible in production.
    const isDev = (() => {
      try {
        return typeof import.meta !== 'undefined'
          && !!import.meta.env
          && import.meta.env.DEV === true;
      } catch { return false; }
    })();
    if (isDev) {
      el.textContent = FARROWAY_BUILD_INFO.version;
      el.style.cssText = [
        'position:fixed',
        'bottom:0',
        'left:0',
        'z-index:2147483647',
        'font:12px/1.2 monospace',
        'color:#86efac',
        'background:rgba(8,17,26,0.55)',
        'padding:2px 6px',
        'pointer-events:none',
        'border-top-right-radius:4px',
      ].join(';');
    } else {
      // Production: present but never visible — pure marker.
      el.style.cssText = 'display:none';
    }
    (document.body || document.documentElement).appendChild(el);
  } catch { /* never throw from diagnostics */ }
}

const _module = { FARROWAY_BUILD_INFO, installBuildMarker };
export default _module;
