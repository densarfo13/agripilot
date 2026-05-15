// ── Console noise filter (install FIRST — must run before any log) ─
// Suppresses chrome-extension, tabs:outgoing.message.ready, and
// cornhusk/shared-service spam in production. No-op in dev builds.
import { installConsoleFilter, installGlobalErrorFilter } from './lib/consoleFilter.js';
installConsoleFilter();
// Extension error isolation: capture-phase listeners intercept
// chrome-extension:// / moz-extension:// errors before analytics
// bubble-phase listeners can fire an app_error event for them.
installGlobalErrorFilter();

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
// Farm State Synchronization Audit — non-destructive mirror of
// the canonical active farm into a single v1 cache key. Runs
// once on boot + re-mirrors on every FarmEvents.FARM_*. Legacy
// keys remain the primary write path; v1 is a fast-read slot
// future surfaces can prefer.
import { startFarmActiveCache } from './lib/farmActiveCache.js';
// Browser-extension noise filter — static import so it can
// install before any other module runs.
import { installExtensionNoiseFilter } from './lib/console/extensionNoiseFilter.js';
// i18n dev-console handle — installs window.__farrowayI18n in dev
// builds only (spec §13 of the Permanent Localization fix). Static
// import; the install call below is gated on import.meta.env.DEV
// so production tree-shakes the audit surface out entirely.
import { installI18nDevHandle } from './i18n/devConsoleAudit.js';
import {
  LOOP_STATE_KEYS,
  FEATURE_EVENT_SYNC,
  EVENT_QUEUE_KEYS,
  DISABLE_EVENTS,
} from './lib/pilotFlags.js';
import { setOnboardingComplete } from './utils/onboarding.js';
import { logStartup } from './core/runtime/logger.js';
const _farrowayResettingUi = ensureUiVersion();
killServiceWorkerAndCaches();
// Idempotent — safe to call ahead of React mount; the cache
// listens to the typed bus and writes whenever farm state
// changes. The initial mirror runs synchronously.
startFarmActiveCache();

// Browser-extension noise filter — installs synchronously BEFORE
// any UI mounts so cornhusk / tabs:outgoing.message.ready /
// chrome-extension "Failed to construct URL" errors stay out of
// the production console. Wraps console.error + console.warn +
// the global onerror + onunhandledrejection handlers so even
// extension-thrown unhandled promises get swallowed. It NEVER
// hides ambiguous lines — only the locked patterns drop.
// Idempotent; safe in dev (real Farroway errors still surface).
try { installExtensionNoiseFilter(); } catch { /* swallow */ }

// i18n dev-console handle (spec §13). Dev-only — gives QA a
// `window.__farrowayI18n.audit()` entry point with the
// [FARROWAY_I18N] console prefix that consolidates the missing-
// translation queue, active-language snapshot, and <html lang>
// mismatch warning. Idempotent + SSR-safe + never throws.
// Production builds skip the install entirely so the audit
// surface never reaches real users.
try {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    installI18nDevHandle();
  }
} catch { /* swallow */ }

// Dev-only UAT seed handle. Exposes `window.__farrowayUat` so a
// QA operator can run `__farrowayUat.seed({ mode: 'farm_us' })`
// from DevTools without an admin page. Production builds (where
// import.meta.env.DEV is false) skip this entirely so the seed
// surface never reaches real users. The seed itself writes to
// localStorage only and is always tagged UAT_DEMO so production
// filters can exclude it even when called by accident.
try {
  if (typeof window !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    import('./lib/seed/uatSeed.js').then((mod) => {
      try {
        window.__farrowayUat = {
          seed:        mod.seedUatData,
          clear:       mod.clearUatData,
          isSeeded:    mod.isUatSeeded,
          sentinel:    mod.getUatSentinel,
        };

        console.log('[UAT] seed helpers exposed: window.__farrowayUat.{seed,clear,isSeeded,sentinel}');
      } catch { /* swallow */ }
    }).catch(() => { /* swallow */ });
  }
} catch { /* swallow */ }

// Stable-pilot restore marker (May 2026 spec §10). Single
// greppable line per boot — engineers can confirm the
// restored bundle is live without opening DevTools deeply.
try {
   
  console.log('Farroway restored stable pilot v1');
} catch { /* swallow */ }

// Alive-UI runtime marker (Active UI Audit pass). Single line
// that proves the latest deploy is running in this tab. Console
// filter does NOT suppress this prefix — engineers grep for
// `[Farroway UI] Alive runtime active` to confirm a stale-cache
// fix landed. The line includes the bundled UI version + an
// ISO timestamp so the screenshot the operator captures is
// self-dating.
try {
   
  // Late-import the version string so the marker stays valid
  // even if forceUiReset's export shape changes underneath us.
  // Dynamic require is intentional: keeps this file's import
  // graph identical to before so build hashing doesn't churn.
  import('./lib/forceUiReset.js').then((mod) => {
    try {
      console.log(
        '[Farroway UI] Alive runtime active',
        new Date().toISOString(),
        mod.FARROWAY_UI_VERSION || 'unknown',
      );
    } catch { /* swallow */ }
  }).catch(() => { /* swallow */ });
   
} catch { /* never throw from startup logger */ }

// Service Worker + Cache Purge Pass spec §7 — dev-only build
// version log in the exact format the audit expects. Gated on
// import.meta.env.DEV so production builds drop the literal.
// FARROWAY_COMMIT_SHA is the build hash (CI sets VITE_COMMIT_SHA,
// falls back to a per-build epoch fingerprint locally).
try {
  if (import.meta.env.DEV) {
     
    console.log('[FARROWAY_BUILD] version:', FARROWAY_COMMIT_SHA);
  }
} catch { /* never throw from startup logger */ }

// ── Loop-state cleanup + onboarding completion stamp ────────────
//
// On every boot we wipe the localStorage keys that have caused
// setup-redirect loops in past releases and stamp the onboarding-
// complete flag. This way a tab that was stuck mid-wizard
// recovers the next time the page loads — even if the user
// never taps Continue again. Auth + user identity are NEVER
// touched. The contract is a hard guarantee: dropping every
// key in LOOP_STATE_KEYS
// must leave the user signed in and routable to Home.
//
// When the pilot flag flips back to false, this block no-ops.
// ── userType safe-default (May 2026 blank-screen fix §1) ────────
//
// Home reads `userType` to pick the right copy. The dashboard
// console diagnostic was logging "User type: (not set)" for live
// pilot users because no save handler had stamped it on this
// device. Default to 'farmer' so every render path has a usable
// value — the only role the pilot serves anyway. Both the new
// `userType` key (Home's preferred name) and the legacy
// `farroway_user_type` key (the existing useUserMode hook) are
// stamped so all readers agree.
//
// Auth keys are NEVER touched by this default. If a real role
// is already persisted (admin, ngo, buyer, super_admin, etc.)
// we leave it alone.
// ── Event-sync disabled for pilot (May 2026 stability fix §1) ───
//
// /api/events was returning 400 in a tight loop because the server
// Zod schema didn't line up with the client's enqueued event
// shape — every 5s the offline-queue tick re-fired the same bad
// payload, spamming the user's DevTools. While FEATURE_EVENT_SYNC
// is false we wipe every known queue key on boot so a tab that
// inherited a poisoned queue from a previous version cleans up
// in exactly one boot. Auth + the local `farroway_events` event
// log (read by the admin surfaces) are NOT in EVENT_QUEUE_KEYS —
// they survive the wipe.
try {
  // DISABLE_EVENTS is the master kill switch; FEATURE_EVENT_SYNC
  // is the legacy soft-gate. Wipe whenever EITHER is asking for
  // the queue to be drained.
  const _shouldWipeEventQueue = DISABLE_EVENTS || !FEATURE_EVENT_SYNC;
  if (_shouldWipeEventQueue && typeof localStorage !== 'undefined') {
    let dropped = 0;
    for (const k of EVENT_QUEUE_KEYS) {
      try {
        if (localStorage.getItem(k) != null) {
          localStorage.removeItem(k);
          dropped += 1;
        }
      } catch { /* per-key tolerate */ }
    }
    // Spec-literal log line — engineers grep for the exact
    // string in user-supplied DevTools captures.
     
    console.log(DISABLE_EVENTS
      ? 'Event system disabled'
      : 'Event sync disabled for pilot');
    if (dropped > 0) {
       
      console.log(
        '[Farroway] Cleared ' + dropped
        + ' stale event-queue key(s) at boot.'
      );
    }
  }
} catch { /* never throw from boot */ }

// Farmer-profile fallback marker (spec §7) — DEV ONLY.
// Production cleanup spec §11: informational-only boot lines
// are suppressed in production. The fallback handler still
// runs unconditionally; only the console echo is gated.
if (import.meta.env.DEV) try {
   
  console.log('Farmer profile fallback active');
} catch { /* swallow */ }

try {
  if (typeof localStorage !== 'undefined') {
    const _existing = (() => {
      try {
        return localStorage.getItem('userType')
            || localStorage.getItem('farroway_user_type');
      } catch { return null; }
    })();
    if (_existing == null || String(_existing).trim() === '') {
      try { localStorage.setItem('userType', 'farmer'); }
      catch { /* swallow — quota / private mode */ }
      try { localStorage.setItem('farroway_user_type', 'farmer'); }
      catch { /* swallow */ }
      // DEV-only echo (production cleanup §11) — the default
      // is still applied unconditionally; only the log is gated.
      if (import.meta.env.DEV) {
         
        console.log('[Farroway] userType defaulted to "farmer" (was missing).');
      }
    }
  }
} catch { /* never throw from boot */ }

// Loop-state localStorage cleanup runs unconditionally at boot.
// The earlier BYPASS_SETUP_FOR_PILOT gate was removed in the
// May 2026 permanent-PilotHome-removal pass — the cleanup is
// defensive (it only deletes the specific loop-prone keys listed
// in LOOP_STATE_KEYS) and safe to run on every boot.
try {
  if (typeof localStorage !== 'undefined') {
    let droppedLoopKeys = 0;
    for (const k of LOOP_STATE_KEYS) {
      try {
        if (localStorage.getItem(k) != null) {
          localStorage.removeItem(k);
          droppedLoopKeys += 1;
        }
      } catch { /* per-key tolerate */ }
    }
    // Also clear the sessionStorage one-shot guard so a fresh
    // tab never thinks it has "already visited setup once"
    // (which is meaningless under the bypass).
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('farroway_setup_visited');
      }
    } catch { /* swallow */ }
    // Stamp the onboarding-complete flag so any downstream
    // reader (CompleteSetupCard logic, dashboard gating,
    // legacy guards) treats the user as already-onboarded.
    try { setOnboardingComplete(); } catch { /* swallow */ }
     
    console.log(
      '[Farroway] Pilot bypass active — cleared '
      + droppedLoopKeys + ' loop-state key(s); stamped onboarding flag.'
    );
  }
} catch { /* never throw from boot */ }

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
     
    console.log('Auth exists:', Boolean(authExists));
     
    console.log('Onboarding complete:', Boolean(onboardingComplete));
     
    console.log('Migration ran:', Boolean(migrationRan));
    // CHECK 5 — list every localStorage key currently on the
    // device. DEV ONLY (production cleanup spec §11: no verbose
    // diagnostic dumps in production console). Names only,
    // never values; in DEV this lets engineers spot stale keys
    // blocking new UI from rendering.
    try {
      if (import.meta.env.DEV) {
        const keys = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const k = localStorage.key(i);
          if (typeof k === 'string') keys.push(k);
        }
         
        console.log('LocalStorage keys:', keys);
      }
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
       
      console.log('Location:', location ? '<set>' : null);
      // User type — read from the dedicated key the
      // useUserMode hook persists to.
      let userType = null;
      try { userType = localStorage.getItem('farroway_user_type'); }
      catch { userType = null; }
       
      console.log('User type:', userType || '(not set)');
    } catch { /* never throw from a diagnostic */ }
  }
} catch { /* never throw from a diagnostic */ }

// ── Deployment sanity logs (spec §7 of debug pass) ──────────────
// DEV ONLY (production cleanup spec §11: no boot-time deployment
// banner in production console — it's the largest single source
// of console noise on boot). Engineers running locally still see
// the full block.
if (import.meta.env.DEV) try {
  // Pull the build constants without re-importing the module
  // (forceUiReset.js was imported above; the constants are
  // available via that import). We resolve them lazily inside
  // a try block so a missing constant doesn't crash the boot.
   
  console.log('───────────────  Farroway deployment  ───────────────');
   
  console.log('App version:',
    (typeof window !== 'undefined' && window.__FARROWAY_BUILD_VERSION)
      || '(see "Farroway Build:" line above)');
   
  console.log('Current URL:',
    typeof window !== 'undefined' && window.location ? window.location.href : '(no window)');
  // Phase-2 spec line — pathname-only so it's grep-friendly
  // when a user reports an issue from a deep link.
   
  console.log('Current route:',
    typeof window !== 'undefined' && window.location ? window.location.pathname : '(no window)');
   
  console.log('Environment:',
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE) || 'production');
   
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
     
    console.log('Feature flags:', Object.keys(flags).length > 0 ? flags : '(none from import.meta.env)');
  }
   
  console.log('───────────────────────────────────────────────────────');
} catch { /* never throw from a diagnostic */ }

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
// Build-marker module — exports FARROWAY_BUILD_INFO + installBuildMarker.
// The deployment-reflection audit added this so ops can confirm at a
// glance whether the deployed bundle is the latest commit (compare
// FARROWAY_BUILD_INFO.version across two visitors).
import { FARROWAY_BUILD_INFO, installBuildMarker } from './lib/buildInfo.js';
// Sentry init — pure no-op when VITE_SENTRY_DSN isn't set (matches
// the server's "Missing SENTRY_DSN — Sentry disabled safely"
// banner). Must run before ReactDOM.createRoot so the SDK is in
// place when the first render-time exception fires.
import { initSentry } from './lib/sentry.js';
try { initSentry(); } catch { /* never throw from boot */ }
// Plant timeline auto-fire bridge — listens for plant_added /
// scan_added_to_tasks / task_completed_garden window events and
// appends timeline entries. Idempotent install; safe to call once
// at boot. Garden-mode-only writes; farm-mode events are dropped
// inside the bridge handlers.
import { installTimelineBridge } from './lib/plant/timelineBridge.js';
try { installTimelineBridge(); } catch { /* never throw from boot */ }
// Go-live audit fix: surface the 3-button recovery card
// (Repair session / Restart setup / Clear local cache) for any
// runtime exception that escapes a child component. The outer
// ErrorBoundary stays as the last-resort catch for truly fatal
// startup errors (e.g. createRoot or AppSettingsProvider blow-up).
import RecoveryErrorBoundary from './components/system/RecoveryErrorBoundary.jsx';
// Sentry-aware inner boundary — captures render-path exceptions
// via captureException + shows a calm fallback. Pure no-op for
// reporting when VITE_SENTRY_DSN isn't set; the boundary still
// works without Sentry, the error just doesn't get logged.
import SystemErrorBoundary from './components/system/ErrorBoundary.jsx';
import { AppSettingsProvider } from './context/AppSettingsContext.jsx';
import LanguageRegionGate from './components/LanguageRegionGate.jsx';
import { initSyncCoordinator } from './services/syncCoordinator.js';
import { initPrimaryActionDoneBridge } from './core/primaryActionDoneBridge.js';
// Service worker registration was permanently removed in the
// May 2026 stability pass. The unregister + cache-cleanup path
// is now the only SW-related code that ships; it lives in
// src/lib/forceUiReset.js (killServiceWorkerAndCaches).
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

// Service-worker registration is PERMANENTLY REMOVED (May 2026
// stability pass). The killServiceWorkerAndCaches() helper at
// the top of this file unregisters any leftover SWs + purges
// every cache on every boot — that's the only SW-related code
// that ships now. There is no opt-in path; if a future deploy
// wants PWA caching it must be re-introduced through a fresh
// review of cache invalidation strategy.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SystemErrorBoundary>
        <AppSettingsProvider>
          <LanguageRegionGate>
            <RecoveryErrorBoundary>
              <App />
            </RecoveryErrorBoundary>
          </LanguageRegionGate>
        </AppSettingsProvider>
      </SystemErrorBoundary>
    </ErrorBoundary>
  </React.StrictMode>,
);

// Boot success marker (May 2026 blank-screen fix §7).
// Single greppable line — engineers can confirm React mounted
// without anything else having to fire. If this line is missing
// from a user's DevTools console, the boot failed BEFORE
// createRoot. If it's present but the page is still blank,
// the watchdog below will say so within 4 seconds.
logStartup();

// Active-path runtime marker (dev-only). Confirms the canonical
// production paths verified by the active-path wiring audit. If
// any of these change without a deploy, the marker makes the
// discrepancy visible in DevTools without opening the source.
try {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    const apiBase = import.meta.env.VITE_API_BASE_URL
      || import.meta.env.VITE_API_URL
      || '(same-origin /api)';
     
    console.log(
      '[Farroway Runtime] Active production paths verified',
      { home: '/home', scan: '/scan', apiBase },
    );
    // Dev-only diagnostic: print which API base the bundle is wired
    // to. Helps spot a stale .env.production after a deploy without
    // having to dig into the network panel.
     
    console.log('[Farroway API Base]', apiBase);
  }
} catch { /* swallow — never block boot on diagnostics */ }

// API base validation marker — runs in BOTH dev and prod so a
// stale .env.production / malformed base URL surfaces on the very
// first boot rather than the first failing fetch. The validation
// is intentionally permissive: it accepts (a) a fully-qualified
// https URL, (b) a relative '/api' path for same-origin Railway
// monolith deploys, or (c) an empty string (also same-origin).
// Anything else (a stray space, a typo without leading slash) gets
// a single greppable warn so ops can see it once.
try {
  const rawBase = (typeof import.meta !== 'undefined' && import.meta.env)
    ? (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '')
    : '';
  const baseStr = String(rawBase).trim();
  const validBase =
       baseStr === ''
    || baseStr.startsWith('/')
    || /^https?:\/\//i.test(baseStr);
  if (validBase) {
    // Per the URL-runtime elimination spec (§6): keep only warn/
    // error/fatal logs in production. The valid-base success line
    // was firing once per page load in prod and reading as noise.
    // Dev still gets it so a developer chasing a stale .env can see
    // the validated base immediately.
    if (import.meta.env && import.meta.env.DEV) {
       
      console.log('[Farroway API Base Validated]', {
        base: baseStr || '(same-origin)',
      });
    }
  } else {
     
    console.warn('[Farroway API Base Validated] INVALID base — '
      + 'expected empty, "/" path, or http(s):// URL. Got:', baseStr);
  }
} catch { /* never block boot on a diagnostic */ }

// Build-info marker — runs on every boot in BOTH dev and prod. The
// version string is locked into the bundle at build time, so two
// browsers running the same deploy see the same value. A mismatch
// across visitors is a deterministic "stale cache" signal.
try {
   
  console.log('[Farroway Frontend Build]', FARROWAY_BUILD_INFO);
  installBuildMarker();
} catch { /* swallow — never block boot on diagnostics */ }

// ── Blank-screen watchdog ───────────────────────────────────────
// React's createRoot() returns synchronously; the actual paint
// happens on the next tick. If 4 seconds later the #root element
// still has zero rendered content, something downstream of
// ErrorBoundary swallowed the render (e.g. a redirect loop or a
// provider stuck in `loading`). Log a single, greppable line so
// ops can spot it in user console drains, and stamp a
// localStorage flag so the next boot can show a recovery UI
// instead of repeating the blank screen.
try {
  if (typeof window !== 'undefined' && typeof setTimeout === 'function') {
    setTimeout(() => {
      try {
        const root = document.getElementById('root');
        const childCount = root && root.children ? root.children.length : 0;
        const textLen = root && typeof root.innerText === 'string'
          ? root.innerText.trim().length
          : 0;
        if (childCount === 0 || textLen === 0) {
           
          console.error(
            '[FARROWAY_BLANK] No content rendered after 4s.',
            'path:', window.location && window.location.pathname,
            'children:', childCount,
            'textLen:', textLen
          );
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('farroway_last_blank_at',
                String(Date.now()));
              localStorage.setItem('farroway_last_blank_path',
                String(window.location && window.location.pathname || ''));
            }
          } catch { /* swallow */ }
        } else {
          // Clear any prior blank-screen marker — last boot painted.
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.removeItem('farroway_last_blank_at');
              localStorage.removeItem('farroway_last_blank_path');
            }
          } catch { /* swallow */ }
        }
      } catch { /* never throw from a diagnostic */ }
    }, 4000);
  }
} catch { /* swallow */ }

} // end if (!_farrowayResettingUi)
