/**
 * ExpertReviewEngine.ts — sprint #216 §7.
 *
 * The agronomist review workflow over the #214 ScanReviewQueue: a
 * reviewer can assign, comment, approve, reject, and promote a queued
 * scan to a plant. Thin actions over the existing queue store — no new
 * datastore. Promotion only sets status; it never fabricates a
 * diagnosis.
 *
 * Guarded localStorage. Never throws. Pins window.__expertReviewHealth().
 */

import { listReviewQueue, setReviewStatus } from './ScanReviewQueue';

export const EXPERT_REVIEW_ENGINE_VERSION = 'expert-review-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const META_KEY = 'farroway:scanReviewMeta';

// Reviewer annotations live in a side store keyed by scanId so the
// queue item shape (privacy-reviewed) stays unchanged.
function _readMeta(): Record<string, { assignedTo?: string; comment?: string }> {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(META_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  }, {});
}
function _writeMeta(meta: Record<string, any>): boolean {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    return true;
  }, false);
}

export function assignReview(scanId: string, reviewer: string): boolean {
  return _safe(() => {
    const id = _str(scanId); if (!id) return false;
    const meta = _readMeta();
    meta[id] = { ...(meta[id] || {}), assignedTo: _str(reviewer) };
    return _writeMeta(meta);
  }, false);
}

export function commentReview(scanId: string, comment: string): boolean {
  return _safe(() => {
    const id = _str(scanId); if (!id) return false;
    const meta = _readMeta();
    meta[id] = { ...(meta[id] || {}), comment: _str(comment).slice(0, 500) };
    return _writeMeta(meta);
  }, false);
}

export function approveReview(scanId: string): boolean {
  return setReviewStatus(_str(scanId), 'reviewed');
}
export function rejectReview(scanId: string): boolean {
  return setReviewStatus(_str(scanId), 'discarded');
}
/** Promote a reviewed scan to a plant (status only — no fabrication). */
export function promoteToPlant(scanId: string): boolean {
  return setReviewStatus(_str(scanId), 'promoted_to_plant');
}

export function buildExpertReviewHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  expertReviewReady: true; pendingCount: number;
  actions: ReadonlyArray<string>;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: EXPERT_REVIEW_ENGINE_VERSION,
    expertReviewReady: true as const,
    pendingCount: _safe(() => listReviewQueue('pending_review').length, 0),
    actions: Object.freeze(['assign', 'comment', 'approve', 'reject', 'promote']),
  });
}

let _installed = false;
export function installExpertReviewHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__expertReviewHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildExpertReviewHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  assignReview, commentReview, approveReview, rejectReview, promoteToPlant,
  buildExpertReviewHealth, installExpertReviewHealthGlobal,
});
export default buildExpertReviewHealth;
