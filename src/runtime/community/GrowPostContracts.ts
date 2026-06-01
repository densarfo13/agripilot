/**
 * GrowPostContracts.ts — pure type + constant contracts for the community
 * grow-share system. NO window global. NO install function.
 *
 * Self-contained — zero imports. Every export is frozen.
 *
 * > Decision support, not a guarantee. Private by default; no precise GPS;
 * > no automatic public sharing; no direct messaging; no live streaming.
 */

// ── helpers (verbatim pattern) ────────────────────────────────────────────
const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
export const GROW_POST_CONTRACTS_VERSION = 'grow-post-contracts-v1' as const;
export const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

// ── core unions ──────────────────────────────────────────────────────────
export type PostType =
  | 'plant_update' | 'before_after' | 'harvest' | 'question' | 'milestone';

export const POST_TYPES: ReadonlyArray<PostType> = Object.freeze([
  'plant_update', 'before_after', 'harvest', 'question', 'milestone',
]);

export type Visibility = 'private' | 'organization' | 'community' | 'public';

export const VISIBILITY_LEVELS: ReadonlyArray<Visibility> = Object.freeze([
  'private', 'organization', 'community', 'public',
]);

// Default visibility is ALWAYS 'private' — never change this without
// updating check-community-privacy gate which enforces it.
export const DEFAULT_VISIBILITY: Visibility = 'private';

// Feed filter taxonomy (§4).
export type FeedFilter =
  | 'vegetables' | 'flowers' | 'herbs' | 'fruit'
  | 'field_crops' | 'questions' | 'harvests';

export const FEED_FILTERS: ReadonlyArray<FeedFilter> = Object.freeze([
  'vegetables', 'flowers', 'herbs', 'fruit',
  'field_crops', 'questions', 'harvests',
]);

// Artifact kinds (§9). Recorded via ArtifactRuntime ONLY.
export const ARTIFACT_KINDS: ReadonlyArray<string> = Object.freeze([
  'GrowPostCreated', 'GrowPostShared', 'GrowPostUpdated', 'GrowPostDeleted',
  'GrowPostReported', 'CommentCreated', 'LikeCreated', 'NGOEvidenceShared',
]);

// Rate limits enforced server-side AND in client diagnostics (§5).
export const COMMENT_RATE_LIMIT = Object.freeze({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxComments: 20,
  maxReports: 5,
});

// Default pagination — feed MUST paginate (§4: "No infinite feed without
// pagination"; §11: "pagination required").
export const FEED_PAGE_SIZE = 20 as const;
export const FEED_MAX_PAGE_SIZE = 50 as const;

// ── post shape ───────────────────────────────────────────────────────────
export interface GrowPost {
  id: string;
  authorId: string;
  plantId: string | null;
  farmId: string | null;
  organizationId: string | null;
  postType: PostType;
  title: string;
  notes: string;
  photos: ReadonlyArray<string>;
  cropKey: string | null;
  plantName: string | null;
  growthStage: string | null;
  healthStatus: string | null;
  visibility: Visibility;
  locationLabel: string | null;     // coarse region label only; e.g. "Volta region"
  preciseLocationHidden: true;      // hard-coded TRUE in every post
  scanResultIncluded: boolean;      // explicit opt-in for scan diagnosis
  createdAt: number;                // ms epoch
  updatedAt: number;                // ms epoch
  // Moderation state — soft-delete + reported.
  deletedAt: number | null;
  reportedCount: number;
  hidden: boolean;
}

// PII / private-data patterns the guard / validator rejects.
const PHONE_RE = /(?:\+?\d[\s\-()]?){7,}/;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const GPS_RE   = /[-+]?\b\d{1,3}\.\d{4,}\s*,\s*[-+]?\d{1,3}\.\d{4,}\b/; // lat,lon with ≥4 decimals
const FARMER_ID_RE = /\bfarmer_id\b|\bfarmerId\b|\b[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}\b/i;
const DEVICE_ID_RE = /\bdeviceId\b|\bIMEI\b/i;

export function containsPII(text: any): boolean {
  return _safe(() => {
    if (typeof text !== 'string' || !text) return false;
    return PHONE_RE.test(text) || EMAIL_RE.test(text) || GPS_RE.test(text)
      || FARMER_ID_RE.test(text) || DEVICE_ID_RE.test(text);
  }, false);
}

export function containsPreciseLocation(text: any): boolean {
  return _safe(() => {
    if (typeof text !== 'string' || !text) return false;
    return GPS_RE.test(text);
  }, false);
}

export interface ValidationResult { valid: boolean; reason?: string; }

/**
 * Pure post validator. Used by the runtime + by the gates. Rejects:
 *   - unknown postType / visibility
 *   - precise GPS in title/notes/locationLabel
 *   - phone/email/farmer-id/device-id in any free-text field
 *   - preciseLocationHidden anything other than literal true
 *   - default-public attempts (visibility 'public' without an explicit
 *     visibilityConfirmed flag in the candidate)
 */
export function validatePost(candidate: any): ValidationResult {
  return _safe(() => {
    if (!candidate || typeof candidate !== 'object')
      return { valid: false, reason: 'no candidate' };
    if (!POST_TYPES.includes(candidate.postType))
      return { valid: false, reason: 'invalid postType' };
    if (!VISIBILITY_LEVELS.includes(candidate.visibility))
      return { valid: false, reason: 'invalid visibility' };
    if (candidate.preciseLocationHidden !== true)
      return { valid: false, reason: 'preciseLocationHidden must be true' };
    if (containsPII(candidate.title) || containsPII(candidate.notes)
        || containsPII(candidate.locationLabel))
      return { valid: false, reason: 'PII detected in free-text' };
    if (containsPreciseLocation(candidate.locationLabel))
      return { valid: false, reason: 'precise GPS in locationLabel' };
    // Public visibility requires an explicit user confirmation flag —
    // never an automatic default.
    if (candidate.visibility === 'public' && candidate.visibilityConfirmed !== true)
      return { valid: false, reason: 'public visibility requires visibilityConfirmed' };
    return { valid: true };
  }, { valid: false, reason: 'validator threw' });
}

/** Build a frozen, defaults-applied skeleton — never returns a public post. */
export function newDraftPost(partial: Partial<GrowPost>): Readonly<GrowPost> {
  return _safe(() => Object.freeze({
    id: String(partial.id || ''),
    authorId: String(partial.authorId || ''),
    plantId: partial.plantId || null,
    farmId: partial.farmId || null,
    organizationId: partial.organizationId || null,
    postType: (POST_TYPES.includes(partial.postType as PostType) ? partial.postType : 'plant_update') as PostType,
    title: String(partial.title || ''),
    notes: String(partial.notes || ''),
    photos: Object.freeze(Array.isArray(partial.photos) ? partial.photos.slice(0, 6) : []) as ReadonlyArray<string>,
    cropKey: partial.cropKey || null,
    plantName: partial.plantName || null,
    growthStage: partial.growthStage || null,
    healthStatus: partial.healthStatus || null,
    // DEFAULT VISIBILITY IS PRIVATE — never anything else.
    visibility: DEFAULT_VISIBILITY,
    locationLabel: partial.locationLabel || null,
    preciseLocationHidden: true as const,
    scanResultIncluded: false,
    createdAt: typeof partial.createdAt === 'number' ? partial.createdAt : 0,
    updatedAt: typeof partial.updatedAt === 'number' ? partial.updatedAt : 0,
    deletedAt: null,
    reportedCount: 0,
    hidden: false,
  }) as GrowPost, Object.freeze({
    id: '', authorId: '', plantId: null, farmId: null, organizationId: null,
    postType: 'plant_update', title: '', notes: '', photos: Object.freeze([]) as ReadonlyArray<string>,
    cropKey: null, plantName: null, growthStage: null, healthStatus: null,
    visibility: DEFAULT_VISIBILITY, locationLabel: null,
    preciseLocationHidden: true as const, scanResultIncluded: false,
    createdAt: 0, updatedAt: 0, deletedAt: null, reportedCount: 0, hidden: false,
  }) as GrowPost);
}
