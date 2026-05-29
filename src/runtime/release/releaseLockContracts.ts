/**
 * src/runtime/release/releaseLockContracts.ts — Frozen
 * contracts for the Farroway Release Lock v1 runtime.
 *
 *   import {
 *     RELEASE_LOCK_VERSION, RELEASE_VERDICT,
 *     CHECK_KIND, CHECK_STATUS, SEVERITY,
 *     RELEASE_SECTIONS, MANUAL_CHECK_IDS,
 *   } from 'src/runtime/release/releaseLockContracts';
 *
 * What this is
 * ────────────
 *   Pure constants + types. Engines read these to know what
 *   sections exist, what severity levels mean, and what status
 *   strings are legal. Frozen at module load.
 *
 * Strict-rule audit
 *   • Pure data, no side effects, no imports of engines.
 *   • SSR-safe. Never throws.
 */

export const RELEASE_LOCK_VERSION = 'farroway-release-lock-v1';

export const RELEASE_VERDICT = Object.freeze({
  GREEN:  'GREEN',
  YELLOW: 'YELLOW',
  RED:    'RED',
});
export type ReleaseVerdict =
  (typeof RELEASE_VERDICT)[keyof typeof RELEASE_VERDICT];

/** Kind of check — automated read of diagnostics OR manual QA. */
export const CHECK_KIND = Object.freeze({
  AUTO:   'auto',
  MANUAL: 'manual',
});

/** Status of a single checklist item. */
export const CHECK_STATUS = Object.freeze({
  PASSED:        'passed',
  FAILED:        'failed',
  PENDING:       'pending',
  PENDING_MANUAL:'pendingManual',
  WARNING:       'warning',
  SKIPPED:       'skipped',
  UNKNOWN:       'unknown',
});

/** Severity that a failed check contributes to. */
export const SEVERITY = Object.freeze({
  /** Failing this flips the verdict to RED. */
  BLOCKER:  'blocker',
  /** Failing this surfaces a warning; YELLOW at worst. */
  WARNING:  'warning',
  /** Informational — never gates anything. */
  INFO:     'info',
});
export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];

/** Canonical section keys — UI + report consume these in order. */
export const RELEASE_SECTIONS = Object.freeze([
  'scanRuntime',
  'plantRuntime',
  'scanToManagedPlant',
  'myPlants',
  'plantProfile',
  'plantTimeline',
  'knowledgeLayer',
  'dailyBriefing',
  'realPlantMedia',
  'founderDashboard',
] as const);
export type ReleaseSectionKey = (typeof RELEASE_SECTIONS)[number];

/** Manual check ids — these are the items QA marks pass/fail. */
export const MANUAL_CHECK_IDS = Object.freeze([
  'manual.iphoneSafariScan',
  'manual.androidChromeScan',
  'manual.pwaScan',
  'manual.realCameraScan',
  'manual.realUploadScan',
  'manual.offlineReconnect',
  'manual.testflightSmokeTest',
] as const);
export type ManualCheckId = (typeof MANUAL_CHECK_IDS)[number];

/**
 * Knowledge Layer / Real Plant Media targets per the launch
 * spec. The Release Lock measures the CURRENT state against
 * these and emits warnings (NEVER blockers) when below target.
 */
export const KNOWLEDGE_TARGETS = Object.freeze({
  plants:   200,
  diseases:  15,
  pests:     15,
});

export const MEDIA_TARGETS = Object.freeze({
  flower:     100,
  vegetable:   50,
  fruit:       50,
  herb:        50,
  houseplant:  50,
  crop:        50,
  disease:    100,
  pest:       100,
});

/**
 * Storage key for the manual check overrides — admin only.
 * Only the internal release page reads/writes this. Normal
 * users never see the surface.
 */
export const MANUAL_STORAGE_KEY = 'farroway_release_lock_manual';

/** Internal-only flag — gates the release page from public users. */
export const INTERNAL_FLAG_KEY = 'farroway_internal';
