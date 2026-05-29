/**
 * src/runtime/qa/qaContracts.ts — Frozen contracts for the
 * Farroway QA Readiness v1 runtime.
 *
 *   import {
 *     QA_RUNTIME_VERSION, DEVICE_KINDS,
 *     CHECK_STATUSES, QA_VERDICTS, QA_STORAGE_KEY,
 *   } from 'src/runtime/qa/qaContracts';
 *
 * What this is
 * ────────────
 *   Pure constants + types for the cross-device QA Readiness
 *   surface. The runtime + the internal page read from here so
 *   the list of device kinds, statuses, and verdicts stays
 *   single-sourced.
 *
 * Strict-rule audit
 *   • Pure data, no side effects, no imports of engines.
 *   • Every export Object.freeze'd.
 *   • SSR-safe. Never throws.
 */

export const QA_RUNTIME_VERSION = 'farroway-qa-runtime-v1';

/** Device kinds we sweep for manual QA. */
export const DEVICE_KINDS = Object.freeze([
  'iphone_safari',
  'android_chrome',
  'pwa',
] as const);
export type DeviceKind = (typeof DEVICE_KINDS)[number];

/** Status of an individual checklist item. */
export const CHECK_STATUSES = Object.freeze([
  'pending',
  'passed',
  'failed',
] as const);
export type CheckStatus = (typeof CHECK_STATUSES)[number];

/** Overall QA Readiness verdict. */
export const QA_VERDICTS = Object.freeze([
  'READY',
  'PENDING',
  'FAILED',
] as const);
export type QAVerdict = (typeof QA_VERDICTS)[number];

/**
 * Storage key for the manual QA check overrides — admin only.
 * Only the internal QA page reads/writes this. Normal users
 * never see the surface.
 */
export const QA_STORAGE_KEY = 'farroway_qa_manual_checks';
