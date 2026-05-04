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
  validateLocalStorageShapes,
} from './lib/forceUiReset.js';
import { runStateMigration } from './lib/stateMigration.js';
import { enforceTaskApiOnly } from './lib/taskCacheInvalidator.js';
const _farrowayResettingUi = ensureUiVersion();
killServiceWorkerAndCaches();
// Strip malformed-JSON entries (parse-level safety) — runs before
// the schema migration so we never feed garbage to a validator.
validateLocalStorageShapes();
// Schema-level migration. Drops keys whose parsed shape doesn't
// match the current contract; reloads exactly once per session
// (sessionStorage flag guards against loops). The user's auth
// token is preserved across every branch.
const _migrationResult = runStateMigration();
// Task-cache invalidator (May 2026 spec): the API is the ONLY
// source of truth for tasks. Until task_version === 'v2' is
// stamped, every task-related localStorage key is dropped.
// Logs "Task source = API ONLY" on every boot for diagnostic
// confirmation. Idempotent — a stamped boot no-ops.
enforceTaskApiOnly();
// When the migration triggers a reload, the page is about to
// navigate; skip the React mount the same way ensureUiVersion does.
const _farrowayMigrationReloading = _migrationResult && _migrationResult.reloaded === true;

// ── Safe debug logs (spec §7) ───────────────────────────────────
// Booleans only — never log token VALUES. These three booleans
// are the field-troubleshoot signals for the logout/setup-loop
// class of bugs. If any user reports being kicked out or sent
// back to setup after a deploy, the first DevTools console line
// tells us which branch fired.
try {
  if (typeof localStorage !== 'undefined') {
    const _has = (k) => {
      try { return localStorage.getItem(k) != null; } catch { return false; }
    };
    const authExists = _has('farroway_token')
                    || _has('farroway_auth_token')
                    || _has('auth_token')
                    || _has('access_token')
                    || _has('token')
                    || _has('farroway:session_cache');
    const onboardingComplete = _has('farroway_onboarding_done')
                            || _has('farroway_onboarding_completed')
                            || _has('farroway_onboarding_complete');
    let migrationRan = false;
    try {
      if (typeof sessionStorage !== 'undefined') {
        const v = sessionStorage.getItem('farroway_migration_ran_once')
               || sessionStorage.getItem('farroway_migrated_once');
        migrationRan = v === '1' || v === 'true';
      }
    } catch { migrationRan = false; }
    // eslint-disable-next-line no-console
    console.log('Auth exists:', Boolean(authExists));
    // eslint-disable-next-line no-console
    console.log('Onboarding complete:', Boolean(onboardingComplete));
    // eslint-disable-next-line no-console
    console.log('Migration ran:', Boolean(migrationRan));
  }
} catch { /* never throw from a diagnostic */ }

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

// When EITHER ensureUiVersion() OR runStateMigration() has
// started a reload, skip every side-effect below — none of them
// should mount on a page that's about to navigate. The reload
// will re-enter main.jsx with the new version stamped and this
// gate becomes false.
if (!_farrowayResettingUi && !_farrowayMigrationReloading) {

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
