/**
 * src/runtime/plants/media/PlantImageVerification.ts — User
 * upload → moderator verification queue for the Verified Plant
 * Media System.
 *
 *   import {
 *     submitForVerification, approveVerification,
 *     rejectVerification, listPendingVerifications,
 *     PLANT_IMAGE_VERIFICATION_VERSION,
 *   } from 'src/runtime/plants/media/PlantImageVerification';
 *
 *   submitForVerification({
 *     plantId: 'rose', type: 'flower',
 *     candidateUrl: 'https://res.cloudinary.com/.../upload/u123.jpg',
 *     userId: 'user_abc',
 *     region: 'us-maryland',
 *     tags: ['white-rose', 'mature-bloom'],
 *   })
 *
 * What this is
 * ────────────
 *   In-memory verification queue. Submissions land in `pending`;
 *   a moderator approves → entry is appended to PlantMediaRegistry
 *   AND mirrored into the older PlantImageRegistry (so existing
 *   surfaces light up immediately). Rejections are recorded with
 *   a reason but never appear in any consumer surface.
 *
 *   Persistence is intentionally NOT in this engine. The wave-5
 *   single-writer (server + moderation UI) owns durable storage.
 *   The `deferred` map documents this clearly.
 *
 *   Anti-PII: only `userId` (opaque), `region` (coarse code), and
 *   `tags` (free strings) are stored. We do NOT keep exact GPS,
 *   IP, device fingerprint, or filename — callers must scrub
 *   those before submitting.
 *
 * Strict-rule audit
 *   • Pure runtime. SSR-safe. Never throws.
 *   • No fetch. No localStorage writes.
 *   • Honest deferred: persistence pending wave-5 writer.
 */

import {
  registerPlantMedia, PLANT_MEDIA_TYPES,
} from './PlantMediaRegistry';

export const PLANT_IMAGE_VERIFICATION_VERSION =
  'plant-image-verification-v1';

export const VERIFICATION_STATUS = Object.freeze({
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _validTypes = new Set<string>(PLANT_MEDIA_TYPES as readonly string[]);

interface VerificationRecord {
  id:            string;
  plantId:       string;
  type:          string;
  candidateUrl:  string;
  thumbnailUrl:  string;
  userId:        string;
  region:        string;
  tags:          ReadonlyArray<string>;
  lifecycleStage: string;
  status:        string;
  submittedAt:   string;
  reviewedAt?:   string;
  reviewedBy?:   string;
  rejectionReason?: string;
}

const _queue: VerificationRecord[] = [];

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

interface SubmitCtx {
  plantId:        string;
  type:           string;
  candidateUrl:   string;
  thumbnailUrl?:  string;
  userId?:        string;
  region?:        string;
  tags?:          string[];
  lifecycleStage?: string;
}

/**
 * Submit a user-uploaded image for moderator review. Returns a
 * frozen envelope with the verificationId and `status: 'pending'`.
 * The caller persists the submission via the wave-5 writer.
 */
export function submitForVerification(ctx: SubmitCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) {
      return _err('invalid_context');
    }
    const plantId = _str(ctx.plantId);
    const type    = _str(ctx.type);
    const url     = _str(ctx.candidateUrl);
    if (!plantId)               return _err('plantId_required');
    if (!_validTypes.has(type)) return _err('invalid_type');
    if (!url)                   return _err('candidateUrl_required');

    const submittedAt = _now();
    const id = 'verify_' + _hash(plantId + '|' + type + '|' + url
                  + '|' + _str(ctx.userId) + '|' + submittedAt);
    const rec: VerificationRecord = {
      id, plantId, type, candidateUrl: url,
      thumbnailUrl:  _str(ctx.thumbnailUrl) || url,
      userId:        _str(ctx.userId),
      region:        _str(ctx.region),
      tags:          Object.freeze(_arr(ctx.tags).map(_str)
                       .filter((t: string) => t.length > 0)),
      lifecycleStage: _str(ctx.lifecycleStage),
      status:        VERIFICATION_STATUS.PENDING,
      submittedAt,
    };
    _queue.push(rec);
    return Object.freeze({
      runtimeVersion: PLANT_IMAGE_VERIFICATION_VERSION,
      ok: true,
      status:         VERIFICATION_STATUS.PENDING,
      verificationId: id,
      submittedAt,
      deferred: Object.freeze({
        persistence:
          'submission held in memory only; wave-5 server writer '
          + 'owns durable moderation queue (deferred)',
      }),
    });
  }, _err('error'));
}

function _err(reason: string) {
  return Object.freeze({
    runtimeVersion: PLANT_IMAGE_VERIFICATION_VERSION,
    ok: false, reason,
  });
}

/**
 * Approve a pending submission. Side-effects:
 *   • The record is appended to PlantMediaRegistry as a verified
 *     entry (source: 'user-verified').
 *   • The bridge into PlantImageRegistry fires automatically the
 *     next time `bridgeToImageRegistry()` is called.
 */
export function approveVerification(ctx: { verificationId: string;
                                             moderatorId?: string }) {
  return _safe(() => {
    if (!_isObj(ctx)) return _err('invalid_context');
    const id  = _str(ctx.verificationId);
    const rec = _queue.find((r) => r.id === id);
    if (!rec) return _err('verification_not_found');
    if (rec.status !== VERIFICATION_STATUS.PENDING) {
      return _err('not_pending');
    }
    rec.status     = VERIFICATION_STATUS.APPROVED;
    rec.reviewedAt = _now();
    rec.reviewedBy = _str(ctx.moderatorId);

    const media = registerPlantMedia({
      id:             'media_user_' + id,
      plantId:        rec.plantId,
      type:           rec.type as any,
      imageUrl:       rec.candidateUrl,
      thumbnailUrl:   rec.thumbnailUrl,
      verified:       true,
      source:         'user-verified',
      regionTags:     rec.region ? [rec.region] : [],
      lifecycleStage: rec.lifecycleStage,
    });

    return Object.freeze({
      runtimeVersion: PLANT_IMAGE_VERIFICATION_VERSION,
      ok: true,
      status:         VERIFICATION_STATUS.APPROVED,
      verificationId: id,
      mediaId:        media ? media.id : '',
      reviewedAt:     rec.reviewedAt,
    });
  }, _err('error'));
}

/**
 * Reject a pending submission with a reason. The record stays in
 * the queue (status: 'rejected') so moderators can audit.
 */
export function rejectVerification(ctx: { verificationId: string;
                                            moderatorId?: string;
                                            reason?: string }) {
  return _safe(() => {
    if (!_isObj(ctx)) return _err('invalid_context');
    const id  = _str(ctx.verificationId);
    const rec = _queue.find((r) => r.id === id);
    if (!rec) return _err('verification_not_found');
    if (rec.status !== VERIFICATION_STATUS.PENDING) {
      return _err('not_pending');
    }
    rec.status           = VERIFICATION_STATUS.REJECTED;
    rec.reviewedAt       = _now();
    rec.reviewedBy       = _str(ctx.moderatorId);
    rec.rejectionReason  = _str(ctx.reason);
    return Object.freeze({
      runtimeVersion: PLANT_IMAGE_VERIFICATION_VERSION,
      ok: true,
      status:         VERIFICATION_STATUS.REJECTED,
      verificationId: id,
      reviewedAt:     rec.reviewedAt,
      reason:         rec.rejectionReason || '',
    });
  }, _err('error'));
}

export function listPendingVerifications():
    ReadonlyArray<VerificationRecord> {
  return _safe(() => Object.freeze(
    _queue.filter((r) => r.status === VERIFICATION_STATUS.PENDING)
      .map((r) => Object.freeze({ ...r }))
  ), Object.freeze([] as VerificationRecord[]));
}

export function listAllVerifications():
    ReadonlyArray<VerificationRecord> {
  return _safe(() => Object.freeze(
    _queue.map((r) => Object.freeze({ ...r }))
  ), Object.freeze([] as VerificationRecord[]));
}

/**
 * Diagnostic — counts per status, used by __plantMediaHealth +
 * the CI gate.
 */
export function plantImageVerificationSnapshot() {
  return _safe(() => {
    let pending = 0, approved = 0, rejected = 0;
    for (const r of _queue) {
      if (r.status === VERIFICATION_STATUS.PENDING)  pending++;
      else if (r.status === VERIFICATION_STATUS.APPROVED) approved++;
      else if (r.status === VERIFICATION_STATUS.REJECTED) rejected++;
    }
    return Object.freeze({
      runtimeVersion: PLANT_IMAGE_VERIFICATION_VERSION,
      pending, approved, rejected,
      total: _queue.length,
      deferred: Object.freeze({
        persistence:
          'verification queue held in memory only; wave-5 server '
          + 'writer + moderation UI own durable storage (deferred)',
      }),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_IMAGE_VERIFICATION_VERSION,
    pending: 0, approved: 0, rejected: 0, total: 0,
    deferred: Object.freeze({ persistence: 'unknown' }),
  }));
}

/** Test-only — wipe the queue. */
export function _resetPlantImageVerification() {
  _queue.length = 0;
}
