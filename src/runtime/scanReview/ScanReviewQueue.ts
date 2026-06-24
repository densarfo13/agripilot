/**
 * ScanReviewQueue.ts — sprint #214 §4.
 *
 * Local store for low-confidence / poor-quality scans the trust gate
 * blocked. These do NOT appear in Recent Scans and do NOT affect
 * FarmBrain — they wait for retake or expert review and can be
 * promoted only if confidence is later fixed.
 *
 * All localStorage access is try/catch-guarded; SSR-safe; never
 * throws. Pins window.__scanReviewQueueHealth().
 */

import {
  SCAN_REVIEW_STORAGE_KEY, SCAN_REVIEW_MAX,
} from './ScanReviewContracts';
import type { ScanReviewItem, ReviewStatus } from './ScanReviewContracts';

export const SCAN_REVIEW_QUEUE_VERSION = 'scan-review-queue-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);

function _readAll(): ScanReviewItem[] {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SCAN_REVIEW_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }, []);
}
function _writeAll(items: ScanReviewItem[]): boolean {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(SCAN_REVIEW_STORAGE_KEY, JSON.stringify(items.slice(-SCAN_REVIEW_MAX)));
    return true;
  }, false);
}

/** Add a blocked scan to the review queue (dedup by scanId). */
export function addToReviewQueue(input: {
  scanId?: string; imageUrl?: string; qualityScore?: number | null;
  confidence?: number | null; reasons?: ReadonlyArray<string>;
  createdAt?: string; farmId?: string | null; userId?: string | null;
}): boolean {
  return _safe(() => {
    const scanId = _str(input.scanId);
    if (!scanId) return false;
    const items = _readAll().filter((i) => i.scanId !== scanId);
    items.push({
      scanId,
      imageUrl: _str(input.imageUrl),
      qualityScore: _num(input.qualityScore),
      confidence: _num(input.confidence),
      reasons: Array.isArray(input.reasons) ? input.reasons.slice(0, 6) : [],
      createdAt: _str(input.createdAt),
      farmId: input.farmId != null ? _str(input.farmId) : null,
      userId: input.userId != null ? _str(input.userId) : null,
      status: 'pending_review',
    });
    return _writeAll(items);
  }, false);
}

export function listReviewQueue(status?: ReviewStatus): ReadonlyArray<Readonly<ScanReviewItem>> {
  return _safe(() => {
    const items = _readAll();
    const filtered = status ? items.filter((i) => i.status === status) : items;
    return Object.freeze(filtered.map((i) => Object.freeze(i)));
  }, Object.freeze([]));
}

export function reviewQueueCount(status: ReviewStatus = 'pending_review'): number {
  return _safe(() => _readAll().filter((i) => i.status === status).length, 0);
}

export function setReviewStatus(scanId: string, status: ReviewStatus): boolean {
  return _safe(() => {
    const items = _readAll();
    let changed = false;
    for (const i of items) { if (i.scanId === scanId) { i.status = status; changed = true; } }
    return changed ? _writeAll(items) : false;
  }, false);
}

export function buildScanReviewQueueHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  reviewQueueReady: true; recentScansClean: true; pendingCount: number;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: SCAN_REVIEW_QUEUE_VERSION,
    reviewQueueReady: true as const,
    recentScansClean: true as const,
    pendingCount: reviewQueueCount('pending_review'),
  });
}

let _installed = false;
export function installScanReviewQueueHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__scanReviewQueueHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildScanReviewQueueHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  addToReviewQueue, listReviewQueue, reviewQueueCount, setReviewStatus,
  buildScanReviewQueueHealth, installScanReviewQueueHealthGlobal,
});
export default addToReviewQueue;
