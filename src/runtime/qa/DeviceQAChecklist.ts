/**
 * src/runtime/qa/DeviceQAChecklist.ts — Frozen 27-item
 * cross-device QA checklist (3 devices × 9 categories).
 *
 *   import {
 *     DEVICE_QA_CHECKLIST, DEVICE_QA_CHECKLIST_VERSION,
 *   } from 'src/runtime/qa/DeviceQAChecklist';
 *
 * What this is
 * ────────────
 *   The full cross-product of DEVICE_KINDS × QA_CATEGORIES.
 *   Each item carries id, device, label, category. Frozen at
 *   module load so consumers cannot mutate.
 *
 * Strict-rule audit
 *   • Pure data, no side effects.
 *   • Every entry Object.freeze'd, outer array Object.freeze'd.
 *   • SSR-safe. Never throws.
 */

import { DEVICE_KINDS, DeviceKind } from './qaContracts';

export const DEVICE_QA_CHECKLIST_VERSION = 'farroway-qa-checklist-v1';

/** The 9 categories swept per device. */
const QA_CATEGORIES = Object.freeze([
  { key: 'login',          label: 'Login + session restore' },
  { key: 'scan_nav',       label: 'Open Scan from primary nav' },
  { key: 'upload_photo',   label: 'Upload photo for scan' },
  { key: 'camera_photo',   label: 'Capture photo with camera' },
  { key: 'add_plant',      label: 'Add scan result to My Plants' },
  { key: 'complete_task',  label: 'Complete a plant care task' },
  { key: 'offline_add',    label: 'Add plant while offline' },
  { key: 'reconnect_sync', label: 'Reconnect and sync offline queue' },
  { key: 'no_duplicate',   label: 'No duplicate plant after sync' },
] as const);
type QACategory = (typeof QA_CATEGORIES)[number]['key'];

const DEVICE_LABELS: Readonly<Record<DeviceKind, string>> = Object.freeze({
  iphone_safari: 'iPhone · Safari',
  android_chrome: 'Android · Chrome',
  pwa: 'Installed PWA',
});

export interface DeviceQAChecklistItem {
  readonly id:       string;
  readonly device:   DeviceKind;
  readonly label:    string;
  readonly category: QACategory;
}

function _buildChecklist(): ReadonlyArray<DeviceQAChecklistItem> {
  const items: DeviceQAChecklistItem[] = [];
  for (const device of DEVICE_KINDS) {
    for (const cat of QA_CATEGORIES) {
      const id = `qa.${device}.${cat.key}`;
      items.push(Object.freeze({
        id,
        device,
        label: `${DEVICE_LABELS[device]} — ${cat.label}`,
        category: cat.key,
      }));
    }
  }
  return Object.freeze(items);
}

/** 27-entry frozen array — DEVICE_KINDS × QA_CATEGORIES. */
export const DEVICE_QA_CHECKLIST: ReadonlyArray<DeviceQAChecklistItem> =
  _buildChecklist();

export { QA_CATEGORIES, DEVICE_LABELS };
