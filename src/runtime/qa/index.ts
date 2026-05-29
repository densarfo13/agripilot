/**
 * src/runtime/qa/index.ts — Farroway QA Readiness v1 barrel.
 *
 *   import {
 *     qaReadiness, installQAReadinessGlobal,
 *     QA_RUNTIME_VERSION,
 *   } from 'src/runtime/qa';
 *
 *   window.__qaReadiness()  // pinned after boot
 *
 * What this is
 * ────────────
 *   Single import surface for the QA Readiness runtime. Composes
 *   the contracts + checklist + runtime modules.
 *
 * Strict-rule audit
 *   • Composition only — no direct engine logic here.
 *   • SSR-safe. Never throws.
 */

export const QA_INDEX_VERSION = 'farroway-qa-index-v1';

export {
  QA_RUNTIME_VERSION,
  DEVICE_KINDS,
  CHECK_STATUSES,
  QA_VERDICTS,
  QA_STORAGE_KEY,
} from './qaContracts';
export type {
  DeviceKind,
  CheckStatus,
  QAVerdict,
} from './qaContracts';

export {
  DEVICE_QA_CHECKLIST,
  DEVICE_QA_CHECKLIST_VERSION,
  QA_CATEGORIES,
  DEVICE_LABELS,
} from './DeviceQAChecklist';
export type {
  DeviceQAChecklistItem,
} from './DeviceQAChecklist';

export {
  loadManualChecks,
  setManualCheck,
  qaReadiness,
  installQAReadinessGlobal,
  QA_READINESS_RUNTIME_VERSION,
} from './QAReadinessRuntime';
