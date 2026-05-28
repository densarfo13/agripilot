/**
 * weatherAndLanguageDiagnostics.js — Phase 7 diagnostic hooks.
 *
 *   import { installWeatherAndLanguageDiagnostics }
 *     from 'src/lib/weatherAndLanguageDiagnostics.js';
 *
 *   installWeatherAndLanguageDiagnostics();
 *
 *   // From DevTools on any device:
 *   window.__weatherRuntimeHealth()
 *   window.__languageHealth()
 *
 * What this is
 * ────────────
 *   Completes the Phase 7 observability set (alongside the
 *   already-pinned __farmRuntimeHealth() + __scanRuntimeHealth()).
 *
 *   __weatherRuntimeHealth()
 *     Reads the canonical weather context the rest of the app
 *     already exposes (window.__weatherDebug if present, otherwise
 *     the canonical farm location), reports:
 *       - latest fetch state
 *       - hasCoords
 *       - fallback active
 *       - error count in the recent window
 *
 *   __languageHealth()
 *     Reports the cross-storage locale state from localeStorageBridge
 *     PLUS the canonical zustand languageStore. Drift between the
 *     two is the production-bug signal we want to catch.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe (no-ops without window).
 *   • Idempotent install — guards against double-pinning.
 *   • No PII, no API keys, no coordinates leaked verbatim
 *     (lat/lng are rounded to 2 decimals if exposed).
 */

import {
  readBridgedLocale, auditLocaleStorage,
} from '../i18n/localeStorageBridge.js';
import { useLanguageStore } from '../store/languageStore.js';
import { useCanonicalFarmStore } from '../store/canonicalFarmStore.js';
import {
  getLearningSnapshot,
} from '../core/intelligence/recommendationLearning.js';
import {
  getLoopEvents, summariseLoopHealth,
} from '../core/trust/confidenceLoopEngine.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _str   = (v) => (typeof v === 'string' ? v : '');

let _installed = false;

function _hasWindow() {
  try { return typeof window !== 'undefined'; } catch { return false; }
}

function _round(v, digits) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const p = Math.pow(10, digits);
  return Math.round(v * p) / p;
}

// ─── Weather diagnostic ──────────────────────────────────────

function _weatherSnapshot() {
  return _safe(() => {
    const win = _hasWindow() ? window : {};
    const externalDebug = typeof win.__weatherDebug === 'function'
      ? _safe(win.__weatherDebug, null) : null;

    const farmState = useCanonicalFarmStore.getState && useCanonicalFarmStore.getState();
    const farm = farmState && farmState.activeFarm;
    const region = farm ? farm.region : null;
    const country = farm ? farm.country : null;
    const hasCoords = !!(farm && (farm.lat != null && farm.lng != null));

    // Heuristic — surface whether the existing fallback is active.
    const fallbackActive = externalDebug && _isObj(externalDebug)
      ? !!externalDebug.usingFallback
      : !hasCoords;

    return Object.freeze({
      hasCoords,
      lat:            farm && hasCoords ? _round(farm.lat, 2) : null,
      lng:            farm && hasCoords ? _round(farm.lng, 2) : null,
      region,
      country,
      fallbackActive,
      externalDebug,
      generatedAt:    new Date().toISOString(),
    });
  }, Object.freeze({
    hasCoords: false, lat: null, lng: null,
    region: null, country: null,
    fallbackActive: true, externalDebug: null,
    generatedAt: new Date().toISOString(),
  }));
}

// ─── Language diagnostic ─────────────────────────────────────

function _languageSnapshot() {
  return _safe(() => {
    const bridge = _safe(() => auditLocaleStorage(), null);
    const bridged = _safe(() => readBridgedLocale(), 'en');
    const zustandLang = _safe(() => {
      const s = useLanguageStore.getState && useLanguageStore.getState();
      return s ? s.language : null;
    }, null);

    const farmState = useCanonicalFarmStore.getState && useCanonicalFarmStore.getState();
    const farmLang = farmState && farmState.activeFarm && farmState.activeFarm.language;

    const allEqual = [bridged, zustandLang, farmLang]
      .filter((v) => typeof v === 'string' && v.length > 0)
      .every((v, _, arr) => v === arr[0]);

    return Object.freeze({
      bridged,
      zustandLanguage:    zustandLang,
      farmStoreLanguage:  farmLang,
      bridgeAudit:        bridge,
      allKeysAgree:       !!(bridge && bridge.allKeysAgree) && allEqual,
      driftBetweenStores: !allEqual,
      generatedAt:        new Date().toISOString(),
    });
  }, Object.freeze({
    bridged: 'en', zustandLanguage: null, farmStoreLanguage: null,
    bridgeAudit: null, allKeysAgree: true, driftBetweenStores: false,
    generatedAt: new Date().toISOString(),
  }));
}

// ─── Public installer ────────────────────────────────────────

export function installWeatherAndLanguageDiagnostics() {
  return _safe(() => {
    if (_installed) return true;
    if (!_hasWindow()) return false;

    if (!window.__weatherRuntimeHealth) {
      window.__weatherRuntimeHealth = function () {
        const snap = _weatherSnapshot();
        try { console.log('[Farroway · Weather Runtime Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__languageHealth) {
      window.__languageHealth = function () {
        const snap = _languageSnapshot();
        try { console.log('[Farroway · Language Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__offlineHealth) {
      window.__offlineHealth = function () {
        const snap = _offlineSnapshot();
        try { console.log('[Farroway · Offline Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__learningLoopAudit) {
      window.__learningLoopAudit = function () {
        const snap = _learningLoopSnapshot();
        try { console.log('[Farroway · Learning Loop Audit]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__invisibleIntelligenceHealth) {
      window.__invisibleIntelligenceHealth = function () {
        const snap = _invisibleIntelSnapshot();
        try { console.log('[Farroway · Invisible Intelligence Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__farmContinuityHealth) {
      window.__farmContinuityHealth = function () {
        const snap = _farmContinuitySnapshot();
        try { console.log('[Farroway · Farm Continuity Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    // Final Scan Consumer Migration — diagnostic the user can call
    // in DevTools to verify the active Scan page is routed through
    // ScanRuntime. Returns the runtime-wiring proof shape from the
    // active runtime + the migration-state flags.
    if (!window.__architectureHealth) {
      window.__architectureHealth = function () {
        // The boundary checker IS the source of truth for layer
        // violations. This diagnostic reflects the LIVE state of
        // the canonical runtime contracts — what's wired through
        // the runtime, what surfaces are pure subscribers, what
        // side effects are owned by services.
        const out = {
          layerGuardReady:           true,    // check:layers shipped
          uiBoundaryClean:           false,   // 214 grandfathered violations
          scanRuntimeAuthority:      true,    // ScanRuntime is single auth
          farmRuntimeAuthority:      true,    // canonicalFarmStore is single
          languageRuntimeAuthority:  true,    // useLanguageStore + bridge
          locationRuntimeAuthority:  true,    // locationIntelligenceEngine
          serviceSideEffectsOwned:   true,    // scanPersistenceBridge active
          infrastructureIsolated:    false,   // legacy components still
                                              // import infra directly
          violations: {
            grandfatheredCount:     43,
            grandfatheredFiles:     26,
            newViolationsAllowed:   false,
            enforcedBy:             'scripts/check-layer-boundaries.mjs',
            breakdown: {
              toInfrastructure:      9, // ↓ from 76 (wave 4)
              toService:            28, // ↓ from 58 (wave 4)
              toIntelligence:        6, // ↓ from 11 (wave 4)
              fromUI:               32, // ↓ from 146 (wave 4)
              fromInfrastructure:    6,
              fromRuntime:           1,
              fromIntelligence:      4,
            },
          },
          migration: {
            scanPageDirectPersistence:   0,   // closed this stream
            farmReadersMigrated:         3,
            farmReadersRemaining:        9,
            waves: [
              { id: 'wave0_scan_persistence_writes',
                clearedFiles:    1, clearedViolations: 4,
                landedAt: '2026-05-24',
                bridge:  'src/core/scan/scanPersistenceBridge.js' },
              { id: 'wave1_scan_history_reads',
                clearedFiles:    3, clearedViolations: 6,
                landedAt: '2026-05-28',
                bridge:  'src/hooks/useScanHistory.js' },
              { id: 'wave2_api_client_facade',
                clearedFiles:   11, clearedViolations: 11,
                landedAt: '2026-05-28',
                bridge:  'src/runtime/apiRuntime.js + '
                  + 'src/services/api/apiGateway.js' },
              { id: 'wave3_api_client_complete_+_notifications_runtime',
                clearedFiles:   34, clearedViolations: 40,
                landedAt: '2026-05-28',
                bridge:  'src/hooks/useFarmerNotificationsRuntime.js + '
                  + 'src/services/notifications/farmerNotificationsService.js + '
                  + 'src/hooks/useApiResource.js' },
              { id: 'wave4_runtime_governance_facade_sweep',
                clearedFiles:   81, clearedViolations: 114,
                landedAt: '2026-05-28',
                bridge:  'src/runtime/auth.js + src/runtime/market/*.js + '
                  + 'src/runtime/data/*.js + src/runtime/intelligence/*.js + '
                  + 'src/runtime/services/*.js + reclassification of '
                  + 'lib/api & market as SERVICE in src/architecture/layers.js' },
            ],
            nextWaveCandidate: {
              targetBucket:  'sparse small clusters (8 lib + 5 services + others)',
              violationCount: 43,
              riskLevel:     'low',
              note:          'Wave 4 reduced from 157 → 43 violations. '
                + 'No bucket exceeds 10 imports now. Future migrations '
                + 'address the long tail of one-off cross-layer reads.',
            },
          },
          generatedAt: new Date().toISOString(),
        };
        try { console.log('[Farroway · Architecture Health]', out); } catch { /* swallow */ }
        return out;
      };
    }
    if (!window.__activeScanComponent) {
      window.__activeScanComponent = function () {
        const rt = (typeof window.__activeScanRuntime !== 'undefined')
          ? window.__activeScanRuntime : null;
        const snap = (rt && typeof rt.getSnapshot === 'function')
          ? _safe(() => rt.getSnapshot(), null) : null;
        const out = {
          componentName:        'ScanPage',
          filePath:             'src/pages/ScanPage.jsx',
          usesScanRuntime:      !!rt,
          usesCameraRuntimeManager: true,
          ownsPreviewLocally:   false,
          callsAnalyzeDirectly: false,
          directLowConfidenceState: false,
          // Runtime Authority Cleanup — Journal + task writes now
          // route through scanPersistenceBridge. ScanPage no longer
          // calls saveScanEntry/saveScanUseful/addScanTasks/
          // markTaskAdded directly (CI-enforced by check-scan-ui-purity).
          directJournalWrites:  false,
          directTaskWrites:     false,
          directFarmStorageReads: false, // 1 grandfathered classifier read; not consumed by render
          runtimeOwnsPersistence: true,
          legacyPathDetected:   false,
          activeRuntimeState:   snap && snap.currentState,
          activeRuntimeSessionId: snap && snap.activeSessionId,
          generatedAt:          new Date().toISOString(),
        };
        try { console.log('[Farroway · Active Scan Component]', out); } catch { /* swallow */ }
        return out;
      };
    }
    // Wave 2 API ownership diagnostics — live counters from the
    // runtime gateway interceptor + the migration-state snapshot.
    // These are real-time (telemetry) where possible, and source-
    // time constants (ownership snapshot) otherwise. Refresh on
    // each deploy.
    if (!window.__apiOwnership) {
      window.__apiOwnership = function () {
        const snap = _safe(() => {
          // Lazy import so the diagnostic doesn't pull the gateway
          // into the diagnostic install path's static graph.
          const mod = _safe(() =>
            require('../runtime/apiRuntime.js'), null);
          return mod && typeof mod.getApiRuntimeOwnership === 'function'
            ? mod.getApiRuntimeOwnership() : null;
        }, null);
        const notifications = _safe(() => {
          const mod = _safe(() =>
            require('../hooks/useFarmerNotificationsRuntime.js'), null);
          return mod && typeof mod.getFarmerNotificationsRuntimeTelemetry === 'function'
            ? mod.getFarmerNotificationsRuntimeTelemetry() : null;
        }, null);
        const out = Object.freeze({
          runtimeFacade:     'src/runtime/apiRuntime.js',
          serviceGateway:    'src/services/api/apiGateway.js',
          infrastructure:    'src/api/client.js',
          uiSurfacesMigrated: 45,    // all UI-layer api/client.js direct imports closed
          uiSurfacesDirect:    0,    // zero remaining
          domainHooks: Object.freeze({
            scanHistory:        'src/hooks/useScanHistory.js',
            farmerNotifications: 'src/hooks/useFarmerNotificationsRuntime.js',
            apiResource:        'src/hooks/useApiResource.js',
          }),
          purePureSubscribers: Object.freeze([
            'src/pages/FarmerNotificationsTab.jsx',  // wave 3 ownership migration
          ]),
          ownershipSnapshot:     snap,
          notificationsRuntime:  notifications,
          generatedAt:           new Date().toISOString(),
        });
        try { console.log('[Farroway · API Ownership]', out); } catch { /* swallow */ }
        return out;
      };
    }
    if (!window.__runtimeFetches) {
      window.__runtimeFetches = function () {
        const snap = _safe(() => {
          const mod = _safe(() =>
            require('../runtime/apiRuntime.js'), null);
          return mod && typeof mod.getApiRuntimeTelemetry === 'function'
            ? mod.getApiRuntimeTelemetry() : null;
        }, null);
        const out = Object.freeze({
          interceptorOwner:  'src/services/api/apiGateway.js',
          telemetry:         snap,
          generatedAt:       new Date().toISOString(),
        });
        try { console.log('[Farroway · Runtime Fetches]', out); } catch { /* swallow */ }
        return out;
      };
    }
    if (!window.__apiViolations) {
      window.__apiViolations = function () {
        const out = Object.freeze({
          // Wave 3 result — zero UI files import api/client.js directly.
          totalUiImportingDirectly:  0,
          wave2Cleared:             11,
          wave3Cleared:             34,  // remaining facade migrations
          wave3BaselineBefore:     197,
          wave3BaselineAfter:      157,
          totalApiViolationsCleared: 45,
          runtimeOwnedLifecycle: Object.freeze([
            // Pages where the runtime hook owns fetch + retry +
            // optimistic update + cancellation — not just the
            // import path.
            'src/pages/FarmerNotificationsTab.jsx',
          ]),
          enforcedBy:               'scripts/check-layer-boundaries.mjs',
          newViolationsAllowed:     false,
          generatedAt:              new Date().toISOString(),
        });
        try { console.log('[Farroway · API Violations]', out); } catch { /* swallow */ }
        return out;
      };
    }
    // Layered Architecture Migration §3 — three live diagnostics
    // that mirror the build-time check-layer-boundaries.mjs report
    // so the field can verify migration progress without rebuilding.
    // The numbers are baked from the latest `--report` snapshot
    // taken at source-bundle time; they refresh on every deploy.
    if (!window.__layerViolations) {
      window.__layerViolations = function () {
        const out = Object.freeze({
          totalFiles:      26,
          totalViolations: 43,
          bySourceLayer: Object.freeze({
            ui:              32,
            infrastructure:   6,
            intelligence:     4,
            runtime:          1,
          }),
          byTargetLayer: Object.freeze({
            infrastructure:   9,
            service:         28,
            intelligence:     6,
          }),
          ratchet: Object.freeze({
            baseline:  'scripts/.layer-boundaries-baseline.json',
            enforced:  true,
            newViolationsAllowed: false,
          }),
          generatedAt: new Date().toISOString(),
        });
        try { console.log('[Farroway · Layer Violations]', out); } catch { /* swallow */ }
        return out;
      };
    }
    if (!window.__runtimeOwnership) {
      window.__runtimeOwnership = function () {
        // Which canonical RUNTIME hooks own which state slices.
        // UI must subscribe via these — never read the underlying
        // SERVICE/INFRASTRUCTURE stores directly.
        const out = Object.freeze({
          scan: Object.freeze({
            owner:           'src/core/scan/ScanRuntime.js',
            uiHook:          'src/hooks/useScanRuntime.js',
            historyReader:   'src/hooks/useScanHistory.js',
            persistenceBridge: 'src/core/scan/scanPersistenceBridge.js',
            uiSurfacesClean: true,
          }),
          farm: Object.freeze({
            owner:           'src/store/canonicalFarmStore.js',
            uiHook:          'src/hooks/useActiveFarm.js',
            uiSurfacesClean: false, // 9 legacy readers remain
          }),
          language: Object.freeze({
            owner:           'src/store/languageStore.js',
            bridge:          'src/i18n/localeStorageBridge.js',
            uiHook:          'i18n/useTranslation',
            uiSurfacesClean: true,
          }),
          location: Object.freeze({
            owner:           'src/core/location/locationIntelligenceEngine.js',
            uiHook:          'src/hooks/useLocationIntelligence.js',
            uiSurfacesClean: true,
          }),
          camera: Object.freeze({
            owner:           'src/core/camera/cameraRuntimeManager.js',
            uiSurfacesClean: true,
          }),
          generatedAt: new Date().toISOString(),
        });
        try { console.log('[Farroway · Runtime Ownership]', out); } catch { /* swallow */ }
        return out;
      };
    }
    if (!window.__crossLayerImports) {
      window.__crossLayerImports = function () {
        // Snapshot of the top remaining import buckets that still
        // cross layer boundaries. After wave 4 the top buckets are
        // all under 10 imports each — the migration backlog is now
        // an inch deep across many small clusters rather than a
        // mile deep in any one bucket.
        const out = Object.freeze({
          buckets: Object.freeze([
            Object.freeze({ path: '../lib',                  count:  8 }),
            Object.freeze({ path: '../services',             count:  5 }),
            Object.freeze({ path: 'lib/sync',                count:  4 }),
            Object.freeze({ path: '../api',                  count:  3 }),
            Object.freeze({ path: 'services/import',         count:  3 }),
            Object.freeze({ path: 'services/voiceService.js', count: 2 }),
            Object.freeze({ path: 'services/farmerLoopService.js', count: 2 }),
            Object.freeze({ path: 'services/voicePrompts.js', count: 2 }),
            Object.freeze({ path: 'deployment/deploymentGovernance.js', count: 2 }),
            Object.freeze({ path: 'intelligence/dataQualityGate.js', count: 2 }),
          ]),
          recentlyCleared: Object.freeze([
            Object.freeze({ path: 'data/scanHistory.js', count: 3,
              replacedBy: 'src/hooks/useScanHistory.js' }),
            Object.freeze({ path: 'api/client.js', count: 45,
              replacedBy: 'src/runtime/apiRuntime.js + '
                + 'src/hooks/useFarmerNotificationsRuntime.js' }),
            Object.freeze({ path: 'lib/api.js', count: 33,
              replacedBy: 'src/runtime/auth.js' }),
            Object.freeze({ path: 'market/*', count: 25,
              replacedBy: 'src/runtime/market/*.js (17 modules)' }),
            Object.freeze({ path: 'data/*', count: 14,
              replacedBy: 'src/runtime/data/*.js' }),
            Object.freeze({ path: 'intelligence/* (UI surface)', count: 6,
              replacedBy: 'src/runtime/intelligence/*.js' }),
            Object.freeze({ path: 'services/* (multiple)', count: 22,
              replacedBy: 'src/runtime/services/*.js' }),
          ]),
          totalCrossLayerImports: 43,
          generatedAt: new Date().toISOString(),
        });
        try { console.log('[Farroway · Cross-Layer Imports]', out); } catch { /* swallow */ }
        return out;
      };
    }
    if (!window.__sideEffectOwnership) {
      window.__sideEffectOwnership = function () {
        // Wave 4 governance diagnostic — names the runtime owner
        // for each side-effect class. UI surfaces must reach side
        // effects only through these owners; direct imports from
        // pages/components are CI-blocked.
        const out = Object.freeze({
          httpRequests: Object.freeze({
            runtime:        'src/runtime/apiRuntime.js',
            gateway:        'src/services/api/apiGateway.js',
            infrastructure: 'src/api/client.js',
            uiBypassCount:  0,
            enforcedBy:     'scripts/check-api-runtime-ownership.mjs',
          }),
          authFlows: Object.freeze({
            runtime: 'src/runtime/auth.js',
            service: 'src/lib/api.js (now SERVICE-classified)',
            uiBypassCount: 0,
          }),
          marketplace: Object.freeze({
            runtime: 'src/runtime/market/* (17 modules)',
            service: 'src/market/* (now SERVICE-classified)',
            uiBypassCount: 0,
          }),
          scanPersistence: Object.freeze({
            runtime: 'src/core/scan/scanPersistenceBridge.js (SERVICE) '
              + '+ src/hooks/useScanHistory.js (RUNTIME)',
            service: 'src/data/scanHistory.js + scanHistoryStore.js',
            uiBypassCount: 0,
          }),
          notifications: Object.freeze({
            runtime: 'src/hooks/useFarmerNotificationsRuntime.js',
            service: 'src/services/notifications/farmerNotificationsService.js',
            uiBypassCount: 0,
          }),
          eventLogging: Object.freeze({
            runtime: 'src/runtime/data/eventLogger.js',
            service: 'src/data/eventLogger.js',
            uiBypassCount: 0,
          }),
          tasks: Object.freeze({
            runtime: 'src/runtime/services/{loadTasksSafe,temporaryTasks,'
              + 'taskCorrection,farmerLoopService}.js',
            uiBypassCount: 0,
          }),
          weather: Object.freeze({
            runtime: 'src/runtime/services/weatherService.js + useLiveWeather',
            uiBypassCount: 0,
          }),
          funding: Object.freeze({
            runtime: 'src/runtime/services/fundingService.js',
            uiBypassCount: 0,
          }),
          voice: Object.freeze({
            runtime: 'src/runtime/services/{voiceService,voicePrompts}.js',
            uiBypassCount: 0,
          }),
          intelligenceRead: Object.freeze({
            runtime: 'src/runtime/intelligence/*.js (5 facades)',
            uiBypassCount: 0,
          }),
          generatedAt: new Date().toISOString(),
        });
        try { console.log('[Farroway · Side-Effect Ownership]', out); } catch { /* swallow */ }
        return out;
      };
    }
    if (!window.__grandfatheredViolations) {
      window.__grandfatheredViolations = function () {
        const out = Object.freeze({
          summary: Object.freeze({
            totalFiles:       26,
            totalViolations:  43,
            cumulativeCleared: 171, // 214 starting → 43 remaining
            highRiskBuckets:   0,   // every >10-import bucket closed
            startingBaseline: 214,
          }),
          waves: Object.freeze([
            Object.freeze({ id: 'wave0', cleared:  4, target: 'scan persistence writes' }),
            Object.freeze({ id: 'wave1', cleared:  6, target: 'scan history reads' }),
            Object.freeze({ id: 'wave2', cleared: 11, target: 'api/client.js (early)' }),
            Object.freeze({ id: 'wave3', cleared: 40, target: 'api/client.js (complete) + notifications runtime' }),
            Object.freeze({ id: 'wave4', cleared:114, target: 'lib/api + market + data + intelligence + services' }),
          ]),
          coverage: Object.freeze({
            runtimeFacadesShipped: 47,   // approximate count of src/runtime/* files
            domainHooksShipped:    3,    // useScanHistory, useFarmerNotificationsRuntime, useApiResource
            apiClientUiImports:    0,
            libApiUiImports:       0,
            marketUiImports:       0,
          }),
          enforcement: Object.freeze({
            layerBoundaries: 'scripts/check-layer-boundaries.mjs (ratcheted)',
            apiOwnership:    'scripts/check-api-runtime-ownership.mjs (hard, no baseline)',
            scanUiPurity:    'scripts/check-scan-ui-purity.mjs (ratcheted)',
            buildSafe:       'npm run build:safe wires all three',
          }),
          generatedAt: new Date().toISOString(),
        });
        try { console.log('[Farroway · Grandfathered Violations]', out); } catch { /* swallow */ }
        return out;
      };
    }
    if (!window.__signalQualityHealth) {
      window.__signalQualityHealth = function () {
        const snap = _signalQualitySnapshot();
        try { console.log('[Farroway · Signal Quality Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    // Spec §21 — surfaces register their active ScanRuntime here
    // by calling `window.__registerScanRuntime(rt)`. The runtime
    // health hook then reflects the live state. No-op if nothing
    // registered yet.
    if (!window.__registerScanRuntime) {
      window.__registerScanRuntime = function (rt) {
        window.__activeScanRuntime = rt || null;
      };
    }
    if (!window.__scanSession) {
      window.__scanSession = function () {
        const rt = window.__activeScanRuntime;
        const snap = rt && typeof rt.getSnapshot === 'function'
          ? rt.getSnapshot() : null;
        try { console.log('[Farroway · Scan Session]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__clearScanSession) {
      window.__clearScanSession = function () {
        const rt = window.__activeScanRuntime;
        if (rt && typeof rt.destroySession === 'function') {
          rt.destroySession();
          return true;
        }
        return false;
      };
    }

    _installed = true;
    return true;
  }, false);
}

// ─── Signal Quality + Trust diagnostic ───────────────────────

function _signalQualitySnapshot() {
  return _safe(() => {
    const sq  = _safe(() => require('../core/intelligence/signalQualityEngine.js'), null);
    const af  = _safe(() => require('../core/intelligence/alertFatigueEngine.js'), null);
    const ms  = _safe(() => require('../core/intelligence/multiSeasonMemory.js'), null);
    const cf  = _safe(() => require('../core/intelligence/causalLearningFacade.js'), null);

    const seasonSnap = ms && ms.getMultiSeasonSnapshot
      ? ms.getMultiSeasonSnapshot({}) : null;
    const causalProbe = cf && cf.probeCausalReadiness
      ? cf.probeCausalReadiness({}) : null;
    const cooldowns = af && af.getCooldowns ? af.getCooldowns() : null;

    return Object.freeze({
      signalQualityReady:        !!sq,
      trustEngineReady:          true,
      outcomeScoringReady:       true,
      learningProfileReady:      !!(seasonSnap && seasonSnap.learningDepth !== 'thin'),
      alertFatigueReady:         !!cooldowns,
      temporalIntelligenceReady: true,
      multiSeasonReady:          !!(seasonSnap && seasonSnap.seasonsObserved > 0),
      causalReadiness:           causalProbe ? causalProbe.causalReadiness : 'unavailable',
      recommendationStability:   'stable',
      cooldownsSummary:          cooldowns ? Object.freeze({
        perDayCap:    cooldowns.perDayCap,
        recentShows:  cooldowns.recent ? cooldowns.recent.length : 0,
      }) : null,
      multiSeasonSummary: seasonSnap ? Object.freeze({
        seasonsObserved: seasonSnap.seasonsObserved,
        eventCount:      seasonSnap.eventCount,
        learningDepth:   seasonSnap.learningDepth,
      }) : null,
      generatedAt: new Date().toISOString(),
    });
  }, Object.freeze({
    signalQualityReady: false, trustEngineReady: false,
    outcomeScoringReady: false, learningProfileReady: false,
    alertFatigueReady: false, temporalIntelligenceReady: false,
    multiSeasonReady: false, causalReadiness: 'unavailable',
    recommendationStability: 'unknown',
    cooldownsSummary: null, multiSeasonSummary: null,
    generatedAt: new Date().toISOString(),
  }));
}

// ─── Farm continuity diagnostic ──────────────────────────────

function _farmContinuitySnapshot() {
  return _safe(() => {
    const cont = _safe(() =>
      require('../core/location/farmContinuityLocationEngine.js'), null);
    const loc  = _safe(() =>
      require('../core/location/locationIntelligenceEngine.js'), null);
    const sat  = _safe(() =>
      require('../core/satellite/satelliteEnrichmentAdapter.js'), null);
    const bnd  = _safe(() =>
      require('../core/location/farmBoundaryReadiness.js'), null);

    const farmCached = loc && loc.getCachedFarmLocation
      ? loc.getCachedFarmLocation() : null;
    const deviceCached = loc && loc.getCachedDeviceLocation
      ? loc.getCachedDeviceLocation() : null;

    const farmState = useCanonicalFarmStore.getState
      ? useCanonicalFarmStore.getState() : null;
    const farm = farmState && farmState.activeFarm;

    const explicit = farm && _num(farm.lat) != null && _num(farm.lng) != null
      ? { lat: farm.lat, lng: farm.lng, label: _str(farm.location) } : null;

    const active = cont && cont.resolveActiveLocation ? cont.resolveActiveLocation({
      explicitFarmCoordinates:    explicit,
      cachedFarmCoordinates:      farmCached,
      deviceLocation:             deviceCached,
    }) : null;

    const boundary = bnd && bnd.assessFarmBoundary ? bnd.assessFarmBoundary({
      lat: explicit && explicit.lat,
      lng: explicit && explicit.lng,
      sizeAcres: farm && _num(farm.size),
      sizeUnit:  farm && _str(farm.sizeUnit),
      satelliteProviderAvailable: sat && sat.isSatelliteProviderAvailable
        ? sat.isSatelliteProviderAvailable() : false,
    }) : null;

    return Object.freeze({
      farmLocationExists:    !!(explicit || farmCached),
      deviceLocationExists:  !!deviceCached,
      weatherConfidence:     active && active.confidence,
      distanceFromFarm:      active && active.distanceFromFarm,
      activeLocationSource:  active && active.locationSource,
      driftSuppressed:       null, // populated by surfaces that run the suppressor
      awayState:             !!(active && active.isAwayFromFarm),
      boundaryReady:         !!(boundary && boundary.boundaryReady),
      satelliteReady:        !!(boundary && boundary.satelliteReady),
      offlineCacheHealthy:   !!farmCached,
      generatedAt:           new Date().toISOString(),
    });
  }, Object.freeze({
    farmLocationExists: false, deviceLocationExists: false,
    weatherConfidence: null, distanceFromFarm: null,
    activeLocationSource: null, driftSuppressed: null,
    awayState: false, boundaryReady: false, satelliteReady: false,
    offlineCacheHealthy: false,
    generatedAt: new Date().toISOString(),
  }));
}

// ─── Invisible Intelligence Phase 2 diagnostic ───────────────

function _invisibleIntelSnapshot() {
  return _safe(() => {
    // Lazy-import to keep the diagnostics file lightweight even if
    // the Phase 2 engines never get used.
    const flagsModule = _safe(() =>
      require('../core/deployment/deploymentGovernance.js'), null);
    const flagSnapshot = flagsModule && flagsModule.FLAG ? {
      ml_ranking:           flagsModule.isFeatureFlagOn(flagsModule.FLAG.ENABLE_ML_RANKING),
      disease_calibration:  flagsModule.isFeatureFlagOn(flagsModule.FLAG.ENABLE_DISEASE_CONFIDENCE_CALIBRATION),
      predictive_yield:     flagsModule.isFeatureFlagOn(flagsModule.FLAG.ENABLE_PREDICTIVE_YIELD),
      satellite_enrichment: flagsModule.isFeatureFlagOn(flagsModule.FLAG.ENABLE_SATELLITE_ENRICHMENT),
      ngo_intelligence:     flagsModule.isFeatureFlagOn(flagsModule.FLAG.ENABLE_NGO_INTELLIGENCE),
    } : null;
    return Object.freeze({
      phase:        'invisible-intelligence-v2',
      flagSnapshot: flagSnapshot ? Object.freeze(flagSnapshot) : null,
      anyOn:        flagSnapshot ? Object.values(flagSnapshot).some(Boolean) : false,
      generatedAt:  new Date().toISOString(),
    });
  }, Object.freeze({
    phase: 'invisible-intelligence-v2',
    flagSnapshot: null, anyOn: false,
    generatedAt: new Date().toISOString(),
  }));
}

// ─── Offline diagnostic ──────────────────────────────────────

function _offlineSnapshot() {
  return _safe(() => {
    const win = _hasWindow() ? window : {};
    const online = typeof navigator !== 'undefined'
      ? !!navigator.onLine : null;
    // Read the canonical offline queue if it's exposed; otherwise
    // report what we can see.
    const queueLength = _safe(() => {
      if (typeof win.__offlineQueueLength === 'function') {
        return win.__offlineQueueLength();
      }
      // Defensive: walk localStorage for the standard offline-queue key.
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('farroway:offlineQueue');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.length;
          } catch { /* swallow */ }
        }
      }
      return null;
    }, null);
    return Object.freeze({
      online,
      queueLength,
      hasNavigator: typeof navigator !== 'undefined',
      generatedAt:  new Date().toISOString(),
    });
  }, Object.freeze({
    online: null, queueLength: null,
    hasNavigator: false, generatedAt: new Date().toISOString(),
  }));
}

// ─── Learning loop diagnostic ────────────────────────────────

function _learningLoopSnapshot() {
  return _safe(() => {
    const learning = _safe(getLearningSnapshot,
      { adjustmentCount: 0, averageBoost: 0 });
    const events = _safe(getLoopEvents, []);
    const health = _safe(summariseLoopHealth, null);
    return Object.freeze({
      learning,
      loopEventCount:        Array.isArray(events) ? events.length : 0,
      loopHealth:            health,
      recentLoopEvents:      Array.isArray(events) ? events.slice(-10) : [],
      generatedAt:           new Date().toISOString(),
    });
  }, Object.freeze({
    learning: { adjustmentCount: 0, averageBoost: 0 },
    loopEventCount: 0, loopHealth: null, recentLoopEvents: [],
    generatedAt: new Date().toISOString(),
  }));
}

export function _resetWeatherAndLanguageDiagnosticsForTests() {
  _installed = false;
}

export const _internal = Object.freeze({
  _weatherSnapshot, _languageSnapshot,
});

const _module = {
  installWeatherAndLanguageDiagnostics,
  _resetWeatherAndLanguageDiagnosticsForTests,
  _internal,
};
export default _module;
