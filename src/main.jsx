// ── Forced UI cache/state reset + SW disable (run BEFORE everything) ──
//
//   ensureUiVersion()             — compares the bundled
//   FARROWAY_UI_VERSION against localStorage; on mismatch wipes
//   stale client state (preserving auth) and reloads ONCE.
//   killServiceWorkerAndCaches()  — unconditional fire-and-forget
//   cleanup that unregisters every service worker and drops any
//   `farroway*` / `workbox*` cache, run on EVERY boot.
//
// The auth session is never cleared — the user is NOT logged out.
import {
  ensureUiVersion,
  killServiceWorkerAndCaches,
} from './lib/forceUiReset.js';
const _farrowayResettingUi = ensureUiVersion();
killServiceWorkerAndCaches();

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
// Go-live audit fix: surface the 3-button recovery card
// (Repair session / Restart setup / Clear local cache) for any
// runtime exception that escapes a child component. The outer
// ErrorBoundary stays as the last-resort catch for truly fatal
// startup errors (e.g. createRoot or AppSettingsProvider blow-up).
import RecoveryErrorBoundary from './components/system/RecoveryErrorBoundary.jsx';
import { AppSettingsProvider } from './context/AppSettingsContext.jsx';
import LanguageRegionGate from './components/LanguageRegionGate.jsx';
import { initSyncCoordinator } from './services/syncCoordinator.js';
import { initPrimaryActionDoneBridge } from './core/primaryActionDoneBridge.js';
import { registerServiceWorker } from './lib/sw/registerServiceWorker.js';
import './index.css';
// Bootstrap the JSON-driven react-i18next namespace once, before any
// component mounts (spec §10). Legacy translations.js engine still
// runs in parallel; the two systems stay in sync via
// farroway:langchange events.
import './i18n/i18next.js';

// When a UI version reset is in progress, ensureUiVersion() has
// already started the async cleanup-then-reload pipeline. Skip
// every side-effect below — none of them should mount on a page
// that's about to navigate. The reload will re-enter main.jsx with
// the new version stamped, and this gate becomes false.
if (!_farrowayResettingUi) {

// Initialize offline sync coordinator (auto-flushes on reconnect + visibility)
initSyncCoordinator();

// Wire the FirstActionGate's `farroway:primaryActionDone` event
// into streakEngine.recordTaskCompleted() once at app boot. Bridge
// is idempotent against HMR (sets _bound flag) and the streak
// engine itself dedupes per-day, so this is safe to fire freely.
try { initPrimaryActionDoneBridge(); }
catch { /* never block boot */ }

// Final feedback-loop spec §7: auto-attach __farrowayPrintFeedback
// in dev so engineers can summarise local feedback from the
// browser console without an import. The helper auto-attaches
// from inside the module on dev import; production tree-shakes
// the side-effect via import.meta.env.DEV.
try {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    import('./utils/printFeedbackSummary.js').catch(() => { /* never block boot */ });
  }
} catch { /* ignore */ }

// Dev-only DOM text audit — runs ONCE on first idle, scans for
// likely hardcoded English literals, reports a single grouped block
// to the console. Vite tree-shakes the dynamic import out of the
// production bundle because `import.meta.env.DEV` is statically
// false there, so this code never ships to farmers.
// STABILITY HOTFIX (emergency stability patch §8):
// Auto-loaded dev scanners are temporarily disabled while the
// crash + login-kickout investigation continues. The scanners
// only READ window.location and document.body.innerText; they do
// NOT navigate, change language, or touch localStorage. But to
// match the spec's "if scanner is touching anything, comment it
// out" rule, the auto-loads are gated behind a separate opt-in
// flag (FARROWAY_AUDIT_AUTOLOAD). Set `localStorage['farroway:audit'] = '1'`
// in DevTools to re-enable for the current session.
//
// Manual on-demand entry points still work:
//   import('./i18n/scanRenderedTextForEnglish.js')
//     .then(m => m.scanRenderedTextForEnglish('hi', '/progress'));
//   import('./dev/i18nLeakScanner.js')
//     .then(m => m.scanForLeaks('hi', '/progress'));
function _auditAutoloadEnabled() {
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env || !import.meta.env.DEV) return false;
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('farroway:audit') === '1';
  } catch { return false; }
}
if (_auditAutoloadEnabled()) {
  import('./i18n/devTextAudit.js').catch(() => { /* never block boot */ });
  import('./i18n/scanRenderedTextForEnglish.js').catch(() => { /* never block boot */ });
  import('./dev/i18nLeakScanner.js').catch(() => { /* never block boot */ });
}

// Service-worker registration is DISABLED. While the cache-
// staleness investigation is ongoing, killServiceWorkerAndCaches()
// at the top of this file unregisters any existing SW + purges
// caches on every boot. To re-enable, restore the registerServiceWorker
// call below AND remove the kill call at module top.
//
// if (typeof window !== 'undefined') {
//   registerServiceWorker({ onNewVersion: ..., onActivated: ... })
//     .catch(() => { /* never propagate */ });
// }
void registerServiceWorker; // referenced for the import; satisfies linter

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppSettingsProvider>
        <LanguageRegionGate>
          <RecoveryErrorBoundary>
            <App />
          </RecoveryErrorBoundary>
        </LanguageRegionGate>
      </AppSettingsProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

} // end if (!_farrowayResettingUi)
