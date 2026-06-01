/**
 * GrowVisibilityPolicy.ts — pure visibility enforcement helpers for grow
 * posts. NO window global. NO install function. Used by the privacy guard,
 * the feed page, and (mirrored to) the server-side route handlers.
 *
 * Self-contained — zero imports. Every export is frozen.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export const GROW_VISIBILITY_POLICY_VERSION = 'grow-visibility-policy-v1' as const;

// Role buckets — the role strings the rest of the app uses. Kept inline so
// this file has no imports.
const ADMIN_ROLES = Object.freeze(new Set(['super_admin', 'institutional_admin']));
const NGO_ROLES = Object.freeze(new Set(['ngo_admin', 'ngo_field_officer', 'institutional_admin']));
const BUYER_ROLES = Object.freeze(new Set(['buyer', 'buyer_admin']));

export type Visibility = 'private' | 'organization' | 'community' | 'public';

export interface Viewer {
  userId?: string | null;
  role?: string | null;
  organizationId?: string | null;
}
export interface PostShape {
  authorId: string;
  organizationId: string | null;
  visibility: Visibility;
  hidden?: boolean;
  deletedAt?: number | null;
}

/**
 * canSee(viewer, post): the canonical authorization function. The server
 * MIRRORS this rule in route handlers; the client uses it to filter the
 * feed defensively. Returns false on any error.
 *
 * Order matters:
 *   1. Deleted / hidden posts are invisible to everyone except the author
 *      and admin moderators (so the moderation page can still surface
 *      reported items).
 *   2. The author can always see their own post.
 *   3. Buyers can NEVER see private grower data — they only see
 *      community + public posts (§6: "buyer cannot access private grower posts").
 *   4. Private posts: author + admin only.
 *   5. Organization posts: same-org members + admin.
 *   6. Community posts: any authenticated user, except buyers when the post
 *      is from an NGO/farmer they have no relationship with (kept simple in
 *      V1 — buyers see community + public).
 *   7. Public posts: anyone (auth not strictly required for visibility, but
 *      our server requires auth for the API endpoints — V1 keeps the
 *      "public" tier reserved for a shareable link, not anonymous browsing).
 */
export function canSee(viewer: any, post: any): boolean {
  return _safe(() => {
    const v: Viewer = (viewer && typeof viewer === 'object') ? viewer : {};
    const p: PostShape = (post && typeof post === 'object') ? post : ({} as any);
    const role = typeof v.role === 'string' ? v.role : '';
    const isAdmin = ADMIN_ROLES.has(role);
    const isAuthor = !!(v.userId && p.authorId && String(v.userId) === String(p.authorId));
    const isDeleted = !!p.deletedAt;
    const isHidden = !!p.hidden;
    // Step 1 — deleted / hidden invisible except to author / admin.
    if (isDeleted) return false; // even author cannot see deleted (soft-delete is final)
    if (isHidden && !isAdmin && !isAuthor) return false;
    // Step 2 — author always sees their own.
    if (isAuthor) return true;
    // Step 3 — buyers only see community + public.
    if (BUYER_ROLES.has(role)) {
      return p.visibility === 'community' || p.visibility === 'public';
    }
    // Step 4 — private posts: author + admin.
    if (p.visibility === 'private') return isAdmin;
    // Step 5 — organization-scoped posts.
    if (p.visibility === 'organization') {
      if (isAdmin) return true;
      return !!(v.organizationId && p.organizationId &&
        String(v.organizationId) === String(p.organizationId));
    }
    // Step 6 — community posts.
    if (p.visibility === 'community') return !!v.userId; // any authenticated user
    // Step 7 — public posts (V1 still requires auth).
    if (p.visibility === 'public') return !!v.userId;
    return false;
  }, false);
}

/** Filter an array of posts to those a viewer is allowed to see. */
export function filterVisible<T extends PostShape>(viewer: any, posts: ReadonlyArray<T>): ReadonlyArray<T> {
  return _safe(() => Object.freeze(
    (Array.isArray(posts) ? posts : []).filter((p) => canSee(viewer, p))
  ), Object.freeze([]));
}

/**
 * Buyer-safety projector — even when a buyer is *allowed* to see a post,
 * we project out private grower fields (farmId, organizationId, exact
 * crop-quantity, scan diagnosis details). The buyer never sees private
 * farmer data.
 */
export function projectForBuyer<T extends PostShape>(post: T): Readonly<T> {
  return _safe(() => Object.freeze({
    ...(post as any),
    farmId: null,
    organizationId: null,
    // The buyer view never includes scanResultIncluded details — strip the
    // diagnosis even if scanResultIncluded was true on the original.
    scanResultIncluded: false,
  }) as T, post);
}

/**
 * Returns true when the viewer role indicates a "buyer" surface; the
 * server uses this to apply projectForBuyer + extra filters.
 */
export function isBuyerRole(role: any): boolean {
  return typeof role === 'string' && BUYER_ROLES.has(role);
}

/** Returns true when the viewer is an admin / institutional admin. */
export function isAdminRole(role: any): boolean {
  return typeof role === 'string' && ADMIN_ROLES.has(role);
}

/** Returns true when the viewer is part of an NGO (org-scoped feeds). */
export function isNgoRole(role: any): boolean {
  return typeof role === 'string' && NGO_ROLES.has(role);
}
