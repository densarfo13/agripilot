/**
 * layers.js — official layered architecture for Farroway.
 *
 * Read this file before adding a new feature. The five layers are
 * NORMATIVE — the CI guard (scripts/check-layer-boundaries.mjs)
 * enforces every import-direction rule below.
 *
 *   UI_LAYER             pages + components + visual renderers
 *   RUNTIME_LAYER        farm / scan / camera / language / location /
 *                        offline runtimes (single source of truth per
 *                        domain; UI subscribes via hooks)
 *   SERVICE_LAYER        side-effect owners: journal persistence,
 *                        task creation, upload, queue, sync
 *   INTELLIGENCE_LAYER   pure decision engines: recommendations,
 *                        scan continuity, confidence calibration,
 *                        outcome + regional learning
 *   INFRASTRUCTURE_LAYER external integrations: weather provider,
 *                        satellite adapter, funding provider,
 *                        marketplace provider, NGO analytics provider
 *
 * Allowed import directions:
 *
 *           ┌──────────┐
 *           │    UI    │ — may import: RUNTIME (hooks only),
 *           └────┬─────┘   tSafe, design tokens, child components
 *                │
 *                ▼
 *           ┌──────────┐
 *           │ RUNTIME  │ — may import: SERVICE, stores,
 *           └────┬─────┘   INTELLIGENCE orchestrators
 *                │
 *        ┌───────┴───────┐
 *        ▼               ▼
 *  ┌──────────┐   ┌──────────────┐
 *  │ SERVICE  │   │ INTELLIGENCE │ — may import:
 *  └────┬─────┘   └──────┬───────┘   normalized runtime snapshots,
 *       │                │           outcome memory, signal-quality
 *       ▼                │           engines
 *  ┌──────────────┐      │
 *  │ INFRASTRUCT  │◀─────┘
 *  └──────────────┘   — may NOT import UI, must not own UI state
 *
 * The guard categorises every file by its path prefix and refuses
 * cross-layer imports that violate the table above.
 */

export const LAYER = Object.freeze({
  UI:             'ui',
  RUNTIME:        'runtime',
  SERVICE:        'service',
  INTELLIGENCE:   'intelligence',
  INFRASTRUCTURE: 'infrastructure',
});

/**
 * Path-prefix classifier. Order matters — first match wins. Add
 * more specific prefixes BEFORE broader ones.
 *
 * Format: `[ glob/prefix, LAYER.* ]`
 */
export const LAYER_PREFIXES = Object.freeze([
  // ─── UI ──────────────────────────────────────────────────────
  ['src/pages/',         LAYER.UI],
  ['src/components/',    LAYER.UI],
  ['src/features/',      LAYER.UI],
  ['src/screens/',       LAYER.UI],

  // ─── Runtime (canonical store + hook + state machine) ───────
  ['src/store/canonicalFarmStore', LAYER.RUNTIME],
  ['src/store/languageStore',      LAYER.RUNTIME],
  ['src/core/farm/',               LAYER.RUNTIME],
  ['src/core/scan/ScanRuntime',    LAYER.RUNTIME],
  ['src/core/scan/scanRuntimeContracts', LAYER.RUNTIME],
  ['src/core/scan/scanLifecycleStateMachine', LAYER.RUNTIME],
  ['src/core/scan/scanSessionManager',        LAYER.RUNTIME],
  ['src/core/scan/scanContinuityBridge',      LAYER.RUNTIME],
  ['src/core/scan/scanPersistenceBridge',     LAYER.SERVICE],
  ['src/core/camera/',                        LAYER.RUNTIME],
  ['src/core/location/',                      LAYER.RUNTIME],
  ['src/core/runtime/',                       LAYER.RUNTIME],
  ['src/core/continuity/',                    LAYER.RUNTIME],
  ['src/hooks/useScanRuntime',                LAYER.RUNTIME],
  ['src/hooks/useActiveFarm',                 LAYER.RUNTIME],
  ['src/hooks/useLocationIntelligence',       LAYER.RUNTIME],
  ['src/hooks/useScanHistory',                LAYER.RUNTIME],
  ['src/hooks/useApiClient',                  LAYER.RUNTIME],
  ['src/runtime/apiRuntime',                  LAYER.RUNTIME],
  ['src/runtime/',                            LAYER.RUNTIME],
  ['src/i18n/localeStorageBridge',            LAYER.RUNTIME],
  ['src/i18n/supportedLocales',               LAYER.RUNTIME],

  // ─── Services (side-effect owners) ──────────────────────────
  ['src/services/',                LAYER.SERVICE],
  ['src/data/',                    LAYER.SERVICE],
  ['src/lib/scan/scanHistoryStore', LAYER.SERVICE],
  ['src/data/scanHistory',         LAYER.SERVICE],
  ['src/core/scan/offlineScanQueue', LAYER.SERVICE],
  ['src/core/scan/scanToTask',     LAYER.SERVICE],
  ['src/lib/offlineScanQueue',     LAYER.SERVICE],
  ['src/lib/sync',                 LAYER.SERVICE],
  ['src/lib/upload',               LAYER.SERVICE],

  // ─── Intelligence (pure decision engines) ───────────────────
  ['src/core/intelligence/',       LAYER.INTELLIGENCE],
  ['src/core/recommendations/',    LAYER.INTELLIGENCE],
  ['src/core/trust/',              LAYER.INTELLIGENCE],
  ['src/core/journal/',            LAYER.INTELLIGENCE],
  ['src/core/memory/',             LAYER.INTELLIGENCE],
  ['src/core/retention/',          LAYER.INTELLIGENCE],
  ['src/core/observability/',      LAYER.INTELLIGENCE],
  ['src/core/deployment/',         LAYER.INTELLIGENCE],
  ['src/core/networkEffects/',     LAYER.INTELLIGENCE],
  ['src/intelligence/',            LAYER.INTELLIGENCE],

  // ─── Infrastructure (external integrations) ─────────────────
  ['src/core/weather/',            LAYER.INFRASTRUCTURE],
  ['src/core/satellite/',          LAYER.INFRASTRUCTURE],
  ['src/core/ngo/',                LAYER.INFRASTRUCTURE],
  ['src/api/',                     LAYER.INFRASTRUCTURE],
  ['src/lib/api',                  LAYER.INFRASTRUCTURE],
  ['src/market/',                  LAYER.INFRASTRUCTURE],
]);

/**
 * Allowed import edges. Per layer, list the layers it MAY import
 * from. The classifier itself + tSafe + design tokens are global
 * shared utilities, not layer-controlled.
 */
export const ALLOWED_IMPORTS = Object.freeze({
  [LAYER.UI]: Object.freeze([
    LAYER.RUNTIME,       // hooks only
    LAYER.UI,            // child components
    // shared utility libs (tSafe, design tokens, format helpers)
    // are not in any layer — they're free to import everywhere
  ]),
  [LAYER.RUNTIME]: Object.freeze([
    LAYER.RUNTIME,
    LAYER.SERVICE,
    LAYER.INTELLIGENCE,
  ]),
  [LAYER.SERVICE]: Object.freeze([
    LAYER.SERVICE,
    LAYER.INFRASTRUCTURE,
    LAYER.RUNTIME,       // store reads ok
  ]),
  [LAYER.INTELLIGENCE]: Object.freeze([
    LAYER.INTELLIGENCE,
    LAYER.RUNTIME,       // normalized snapshots
    LAYER.SERVICE,       // outcome memory / signal stores
  ]),
  [LAYER.INFRASTRUCTURE]: Object.freeze([
    LAYER.INFRASTRUCTURE,
    LAYER.SERVICE,       // queue / sync helpers
    // explicitly NOT: UI
  ]),
});

/**
 * Hard-forbidden import patterns inside specific layers. The
 * boundary checker scans every file's import lines for these
 * substrings and reports as violations.
 */
export const FORBIDDEN_IN_UI = Object.freeze([
  // Direct classifier imports — UI must go through ScanRuntime.
  { id: 'ui_imports_analyzeScan',
    re: /from\s+['"][^'"]*scanDetectionEngine[^'"]*['"]/,
    label: 'UI imports analyzeScan (use useScanRuntime)' },
  { id: 'ui_imports_analyzeImageSafe',
    re: /from\s+['"][^'"]*mlScanAnalyzer[^'"]*['"]/,
    label: 'UI imports analyzeImageSafe (use useScanRuntime)' },
  // Direct journal/task writers — UI must go through bridge.
  { id: 'ui_imports_scanHistory',
    re: /from\s+['"][^'"]*data\/scanHistory[^'"]*['"]/,
    label: 'UI imports scanHistory directly (use scanPersistenceBridge)' },
  { id: 'ui_imports_scanToTask',
    re: /from\s+['"][^'"]*core\/scanToTask[^'"]*['"]/,
    label: 'UI imports scanToTask directly (use scanPersistenceBridge)' },
  // Direct provider imports — UI must go through runtime/service.
  { id: 'ui_imports_satellite',
    re: /from\s+['"][^'"]*core\/satellite[^'"]*['"]/,
    label: 'UI imports satellite provider directly' },
  { id: 'ui_imports_weather_provider',
    re: /from\s+['"][^'"]*core\/weather\/weatherProvider[^'"]*['"]/,
    label: 'UI imports weather provider directly' },
]);

export const FORBIDDEN_IN_INFRASTRUCTURE = Object.freeze([
  { id: 'infra_imports_ui_pages',
    re: /from\s+['"][^'"]*\/pages\/[^'"]*['"]/,
    label: 'infrastructure imports UI pages (illegal — UI is downstream)' },
  { id: 'infra_imports_ui_components',
    re: /from\s+['"][^'"]*\/components\/[^'"]*['"]/,
    label: 'infrastructure imports UI components (illegal)' },
]);

const _module = {
  LAYER, LAYER_PREFIXES, ALLOWED_IMPORTS,
  FORBIDDEN_IN_UI, FORBIDDEN_IN_INFRASTRUCTURE,
};
export default _module;
