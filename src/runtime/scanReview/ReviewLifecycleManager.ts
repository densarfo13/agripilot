/**
 * ReviewLifecycleManager.ts — sprint #215 §6.
 *
 * Keeps the scan review queue from growing forever: items older than
 * 30 days are archived; items older than 60 days that were never
 * reviewed are deleted. Pure classification + a runner that applies it
 * over the ScanReviewQueue. The caller supplies `asOf` (ISO) so the
 * classifier stays deterministic.
 *
 * Never throws.
 */

import { listReviewQueue, setReviewStatus } from './ScanReviewQueue';
import type { ScanReviewItem } from './ScanReviewContracts';

export const REVIEW_LIFECYCLE_VERSION = 'review-lifecycle-manager-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export const ARCHIVE_AFTER_DAYS = 30;
export const DELETE_AFTER_DAYS = 60;

function _ageDays(createdAt: string, asOf: string): number | null {
  return _safe(() => {
    const c = new Date(createdAt); const a = new Date(asOf);
    if (isNaN(c.getTime()) || isNaN(a.getTime())) return null;
    return Math.floor((a.getTime() - c.getTime()) / 86400000);
  }, null);
}

export type LifecycleAction = 'keep' | 'archive' | 'delete';

export function classifyReviewItem(item: ScanReviewItem, asOf: string): LifecycleAction {
  return _safe(() => {
    const age = _ageDays(item.createdAt, asOf);
    if (age == null) return 'keep';
    if (age >= DELETE_AFTER_DAYS && item.status === 'pending_review') return 'delete';
    if (age >= ARCHIVE_AFTER_DAYS && item.status === 'pending_review') return 'archive';
    return 'keep';
  }, 'keep');
}

/** Apply the lifecycle. Returns counts. asOf defaults to now. */
export function runReviewLifecycle(asOf?: string): Readonly<{
  archived: number; deleted: number; kept: number;
}> {
  return _safe(() => {
    const stamp = asOf || new Date().toISOString();
    const items = listReviewQueue();
    let archived = 0, deleted = 0, kept = 0;
    for (const it of items) {
      const action = classifyReviewItem(it, stamp);
      if (action === 'delete') { setReviewStatus(it.scanId, 'discarded'); deleted++; }
      else if (action === 'archive') { setReviewStatus(it.scanId, 'reviewed'); archived++; }
      else kept++;
    }
    return Object.freeze({ archived, deleted, kept });
  }, Object.freeze({ archived: 0, deleted: 0, kept: 0 }));
}

export const _internal = Object.freeze({
  classifyReviewItem, runReviewLifecycle, ARCHIVE_AFTER_DAYS, DELETE_AFTER_DAYS,
});
export default runReviewLifecycle;
