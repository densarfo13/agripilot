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
  FARROWAY_BUILD_VERSION,
  FARROWAY_COMMIT_SHA,
} from './lib/forceUiReset.js';
// Expose build constants on window for the deployment-sanity
// logs below + DevTools `window.__FARROWAY_BUILD_VERSION`
// inspection. Read-only convenience — never used as a state
// store.
try {
  if (typeof window !== 'undefined') {
    window.__FARROWAY_BUILD_VERSION = FARROWAY_BUILD_VERSION;
    window.__FARROWAY_COMMIT_SHA    = FARROWAY_COMMIT_SHA;
  }
} catch { /* swallow */ }
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
    // CHECK 5 — list every localStorage key currently on the
    // device. Names only, never values, so token / user data
    // is never logged. Lets engineers spot stale keys that
    // are blocking new UI from rendering.
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (typeof k === 'string') keys.push(k);
      }
      // eslint-disable-next-line no-console
      console.log('LocalStorage keys:', keys);
    } catch { /* swallow */ }

    // Onboarding-loop diagnostic (May 2026): three booleans that
    // tell engineers which path the user is on. Never logs the
    // location string itself — just whether one is set.
    try {
      let location = null;
      try {
        const raw = localStorage.getItem('farroway_active_farm');
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') {
          location = parsed.locationName || parsed.location
                  || parsed.region || parsed.country || null;
        }
      } catch { location = null; }
      // eslint-disable-next-line no-console
      console.log('Location:', location ? '<set>' : null);
      // User type — read from the dedicated key the
      // useUserMode hook persists to.
      let userType = null;
      try { userType = localStorage.getItem('farroway_user_type'); }
      catch { userType = null; }
      // eslint-disable-next-line no-console
      console.log('User type:', userType || '(not set)');
    } catch { /* never throw from a diagnostic */ }
  }
} catch { /* never throw from a diagnostic */ }

// ── Deployment sanity logs (spec §7 of debug pass) ──────────────
// Lets engineers confirm at a glance which build, branch, and
// API target the user is actually running. Renders one block
// per boot — never the token value, never user-identifying data.
try {
  // Pull the build constants without re-importing the module
  // (forceUiReset.js was imported above; the constants are
  // available via that import). We resolve them lazily inside
  // a try block so a missing constant doesn't crash the boot.
  // eslint-disable-next-line no-console
  console.log('───────────────  Farroway deployment  ───────────────');
  // eslint-disable-next-line no-console
  console.log('App version:',
    (typeof window !== 'undefined' && window.__FARROWAY_BUILD_VERSION)
      || '(see "Farroway Build:" line above)');
  // eslint-disable-next-line no-console
  console.log('Current URL:',
    typeof window !== 'undefined' && window.location ? window.location.href : '(no window)');
  // Phase-2 spec line — pathname-only so it's grep-friendly
  // when a user reports an issue from a deep link.
  // eslint-disable-next-line no-console
  console.log('Current route:',
    typeof window !== 'undefined' && window.location ? window.location.pathname : '(no window)');
  // eslint-disable-next-line no-console
  console.log('Environment:',
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE) || 'production');
  // eslint-disable-next-line no-console
  console.log('API base URL:',
    (typeof import.meta !== 'undefined' && import.meta.env
      && (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL))
      || '/api (relative — Vite proxy or Express prod)');
  // Feature flags — just the public ones. Never log secrets.
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const flags = {};
    for (const k of Object.keys(import.meta.env)) {
      if (k.startsWith('VITE_FEATURE_') || k.startsWith('FEATURE_')) {
        flags[k] = import.meta.env[k];
      }
    }
    // eslint-disable-next-line no-console
    console.log('Feature flags:', Object.keys(flags).length > 0 ? flags : '(none from import.meta.env)');
  }
  // eslint-disable-next-line no-console
  console.log('───────────────────────────────────────────────────────');
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
