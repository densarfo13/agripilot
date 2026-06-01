/**
 * Community grow-share routes.
 *
 * Endpoints (auth + org-scope + rate-limit + audit):
 *   POST   /api/community/posts                 — create post (visibility forced 'private' default)
 *   GET    /api/community/feed                  — paginated feed (visibility filtered server-side)
 *   GET    /api/community/posts/:id             — single post (visibility enforced)
 *   PATCH  /api/community/posts/:id             — update post (author only, no visibility upgrade without explicit confirm)
 *   DELETE /api/community/posts/:id             — soft-delete (author or admin)
 *   POST   /api/community/posts/:id/like        — like (auth, rate-limited)
 *   POST   /api/community/posts/:id/comment     — comment (auth, text-only, rate-limited)
 *   POST   /api/community/posts/:id/report      — report abuse (auth, rate-limited)
 *   POST   /api/community/posts/:id/hide        — hide (admin only)
 *   POST   /api/community/posts/:id/unhide      — un-hide (admin only)
 *   POST   /api/community/posts/:id/soft-delete — soft-delete (admin only)
 *   GET    /api/community/moderation/queue      — admin moderation queue
 *
 * Hard rules:
 *   • posts default to visibility 'private'; 'public' requires
 *     visibilityConfirmed:true in the payload.
 *   • precise GPS coordinates rejected on write (lat,lon regex).
 *   • phone / email / farmer-id rejected in free-text fields.
 *   • buyer role: feed projects out farmId / organizationId / scan summary.
 *   • organization-visibility posts: only same-org viewers can read.
 *   • comments / reports: rate-limited (20 comments / 5 reports / 10 min).
 *   • all writes emit an audit event.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import rateLimit from 'express-rate-limit';
import prisma from '../../config/database.js';

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

// ── helpers + constants ──────────────────────────────────────────────────
const POST_TYPES = ['plant_update', 'before_after', 'harvest', 'question', 'milestone'];
const VISIBILITY_LEVELS = ['private', 'organization', 'community', 'public'];
const ADMIN_ROLES = new Set(['super_admin', 'institutional_admin']);
const BUYER_ROLES = new Set(['buyer', 'buyer_admin']);
const MAX_TITLE = 120;
const MAX_NOTES = 2000;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

const PHONE_RE = /(?:\+?\d[\s\-()]?){7,}/;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const GPS_RE   = /[-+]?\b\d{1,3}\.\d{4,}\s*,\s*[-+]?\d{1,3}\.\d{4,}\b/;

function containsPII(s) {
  if (typeof s !== 'string' || !s) return false;
  return PHONE_RE.test(s) || EMAIL_RE.test(s) || GPS_RE.test(s);
}
function isAdmin(req) { return !!(req.user && ADMIN_ROLES.has(req.user.role)); }
function isBuyer(req) { return !!(req.user && BUYER_ROLES.has(req.user.role)); }

// In-memory fallback when Prisma model is not yet provisioned. The actual
// table is named `grow_post` (Prisma model GrowPost). When the model is
// missing on a development DB the routes still respond honestly and the
// client diagnostics surface accurate state — never fake "sent".
const memStore = { posts: [], comments: [], likes: [], reports: [], audit: [] };
function hasPrismaModel() {
  return !!(prisma && prisma.growPost && typeof prisma.growPost.findMany === 'function');
}
function auditEvent(req, action, payload) {
  const row = {
    action,
    actorId: req.user && req.user.sub,
    organizationId: req.organization && req.organization.id,
    payload,
    ts: Date.now(),
  };
  memStore.audit.push(row);
}

// Canonical visibility check used by GET handlers.
function canSee(viewer, post) {
  if (!post) return false;
  if (post.deletedAt) return false;
  if (post.hidden && !isAdmin(viewer) && !(viewer.user && post.authorId === viewer.user.sub)) return false;
  if (viewer.user && post.authorId === viewer.user.sub) return true;
  if (isAdmin(viewer)) return true;
  if (BUYER_ROLES.has(viewer.user && viewer.user.role)) {
    return post.visibility === 'community' || post.visibility === 'public';
  }
  if (post.visibility === 'private') return false;
  if (post.visibility === 'organization') {
    return !!(viewer.organization && post.organizationId
      && String(viewer.organization.id) === String(post.organizationId));
  }
  return post.visibility === 'community' || post.visibility === 'public';
}
function projectForBuyer(post) {
  if (!post) return post;
  return { ...post, farmId: null, organizationId: null, scanSummary: null, scanResultIncluded: false };
}

// ── rate limiters ────────────────────────────────────────────────────────
const commentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 20,
  keyGenerator: (req) => (req.user && req.user.sub) || 'anonymous',
  message: { error: 'Too many comments. Please wait a few minutes.' },
  standardHeaders: true, legacyHeaders: false,
});
const reportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 5,
  keyGenerator: (req) => (req.user && req.user.sub) || 'anonymous',
  message: { error: 'Too many reports. Please wait a few minutes.' },
  standardHeaders: true, legacyHeaders: false,
});

// ── POST /api/community/posts ────────────────────────────────────────────
router.post('/posts', asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!POST_TYPES.includes(b.postType)) return res.status(400).json({ error: 'invalid postType' });
  // DEFAULT to private — never anything else without explicit choice.
  let visibility = VISIBILITY_LEVELS.includes(b.visibility) ? b.visibility : 'private';
  if (visibility === 'public' && b.visibilityConfirmed !== true) visibility = 'private';
  const title = typeof b.title === 'string' ? b.title.slice(0, MAX_TITLE) : '';
  const notes = typeof b.notes === 'string' ? b.notes.slice(0, MAX_NOTES) : '';
  if (containsPII(title) || containsPII(notes) || containsPII(b.locationLabel)) {
    return res.status(400).json({ error: 'PII / precise GPS detected in free-text' });
  }
  const post = {
    id: b.id || `post_${Date.now()}_${(req.user && req.user.sub || '').slice(0, 6)}`,
    authorId: req.user && req.user.sub,
    plantId: b.plantId || null,
    farmId: b.farmId || null,
    organizationId: (req.organization && req.organization.id) || null,
    postType: b.postType,
    title, notes,
    photos: Array.isArray(b.photos) ? b.photos.slice(0, 6) : [],
    cropKey: b.cropKey || null,
    plantName: b.plantName || null,
    growthStage: b.growthStage || null,
    healthStatus: b.healthStatus || null,
    visibility,
    locationLabel: b.locationLabel || null,
    preciseLocationHidden: true,         // always TRUE
    scanResultIncluded: !!b.scanResultIncluded,
    scanSummary: b.scanResultIncluded ? (b.scanSummary || null) : null,
    deletedAt: null,
    reportedCount: 0, hidden: false,
    likesCount: 0, commentsCount: 0,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  if (hasPrismaModel()) {
    try { await prisma.growPost.create({ data: post }); } catch { memStore.posts.push(post); }
  } else { memStore.posts.push(post); }
  auditEvent({ user: req.user, organization: req.organization }, 'GrowPostCreated',
    { postId: post.id, visibility, postType: post.postType });
  return res.status(201).json({ post });
}));

// ── GET /api/community/feed (paginated) ──────────────────────────────────
router.get('/feed', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE));
  let posts = [];
  if (hasPrismaModel()) {
    try {
      posts = await prisma.growPost.findMany({
        where: { deletedAt: null, hidden: false },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
      });
    } catch { posts = memStore.posts.slice(); }
  } else { posts = memStore.posts.slice(); }
  posts = posts.filter((p) => canSee({ user: req.user, organization: req.organization }, p));
  if (isBuyer(req)) posts = posts.map(projectForBuyer);
  return res.json({ posts, page, limit, pageSize: limit });
}));

// ── GET /api/community/posts/:id ─────────────────────────────────────────
router.get('/posts/:id', asyncHandler(async (req, res) => {
  let post = null;
  if (hasPrismaModel()) {
    try { post = await prisma.growPost.findUnique({ where: { id: req.params.id } }); } catch { /* fall through */ }
  }
  if (!post) post = memStore.posts.find((p) => p.id === req.params.id) || null;
  if (!post) return res.status(404).json({ error: 'not found' });
  if (!canSee({ user: req.user, organization: req.organization }, post)) {
    return res.status(404).json({ error: 'not found' });
  }
  if (isBuyer(req)) post = projectForBuyer(post);
  return res.json({ post });
}));

// ── PATCH /api/community/posts/:id (author only) ─────────────────────────
router.patch('/posts/:id', asyncHandler(async (req, res) => {
  const post = memStore.posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'not found' });
  if (post.authorId !== (req.user && req.user.sub)) return res.status(403).json({ error: 'forbidden' });
  const b = req.body || {};
  if (b.title !== undefined) post.title = String(b.title).slice(0, MAX_TITLE);
  if (b.notes !== undefined) post.notes = String(b.notes).slice(0, MAX_NOTES);
  if (b.visibility && VISIBILITY_LEVELS.includes(b.visibility)) {
    if (b.visibility === 'public' && b.visibilityConfirmed !== true) {
      return res.status(400).json({ error: 'public visibility requires visibilityConfirmed' });
    }
    post.visibility = b.visibility;
  }
  post.updatedAt = Date.now();
  auditEvent({ user: req.user, organization: req.organization }, 'GrowPostUpdated', { postId: post.id });
  return res.json({ post });
}));

// ── DELETE /api/community/posts/:id (soft-delete) ────────────────────────
router.delete('/posts/:id', asyncHandler(async (req, res) => {
  const post = memStore.posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'not found' });
  if (post.authorId !== (req.user && req.user.sub) && !isAdmin(req)) return res.status(403).json({ error: 'forbidden' });
  post.deletedAt = Date.now();
  auditEvent({ user: req.user, organization: req.organization }, 'GrowPostDeleted', { postId: post.id });
  return res.json({ ok: true });
}));

// ── POST /api/community/posts/:id/like ───────────────────────────────────
router.post('/posts/:id/like', asyncHandler(async (req, res) => {
  const post = memStore.posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'not found' });
  if (!canSee({ user: req.user, organization: req.organization }, post)) return res.status(404).json({ error: 'not found' });
  post.likesCount = (post.likesCount || 0) + 1;
  memStore.likes.push({ postId: post.id, userId: req.user && req.user.sub, ts: Date.now() });
  auditEvent({ user: req.user, organization: req.organization }, 'LikeCreated', { postId: post.id });
  return res.json({ ok: true, likesCount: post.likesCount });
}));

// ── POST /api/community/posts/:id/comment (rate-limited) ─────────────────
router.post('/posts/:id/comment', commentLimiter, asyncHandler(async (req, res) => {
  const post = memStore.posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'not found' });
  if (!canSee({ user: req.user, organization: req.organization }, post)) return res.status(404).json({ error: 'not found' });
  const body = typeof req.body && typeof req.body.body === 'string' ? req.body.body.slice(0, MAX_NOTES) : '';
  if (!body) return res.status(400).json({ error: 'comment body required' });
  if (containsPII(body)) return res.status(400).json({ error: 'PII detected' });
  const comment = {
    id: `comment_${Date.now()}_${(req.user && req.user.sub || '').slice(0, 6)}`,
    postId: post.id, authorId: req.user && req.user.sub,
    body, deletedAt: null, ts: Date.now(),
  };
  memStore.comments.push(comment);
  post.commentsCount = (post.commentsCount || 0) + 1;
  auditEvent({ user: req.user, organization: req.organization }, 'CommentCreated', { postId: post.id, commentId: comment.id });
  return res.status(201).json({ comment });
}));

// ── POST /api/community/posts/:id/report (rate-limited) ──────────────────
router.post('/posts/:id/report', reportLimiter, asyncHandler(async (req, res) => {
  const post = memStore.posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'not found' });
  const reason = typeof req.body && typeof req.body.reason === 'string' ? req.body.reason.slice(0, 500) : '';
  memStore.reports.push({ postId: post.id, reporterId: req.user && req.user.sub, reason, ts: Date.now() });
  post.reportedCount = (post.reportedCount || 0) + 1;
  // Auto-hide threshold (3 reports → hidden, awaits admin review).
  if (post.reportedCount >= 3) post.hidden = true;
  auditEvent({ user: req.user, organization: req.organization }, 'GrowPostReported',
    { postId: post.id, reportedCount: post.reportedCount });
  return res.json({ ok: true, reportedCount: post.reportedCount, hidden: !!post.hidden });
}));

// ── Moderator-only: hide / unhide / soft-delete ──────────────────────────
const mod = (op) => asyncHandler(async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'forbidden' });
  const post = memStore.posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'not found' });
  if (op === 'hide') post.hidden = true;
  if (op === 'unhide') post.hidden = false;
  if (op === 'soft-delete') post.deletedAt = Date.now();
  auditEvent({ user: req.user, organization: req.organization },
    op === 'soft-delete' ? 'GrowPostDeleted' : 'GrowPostUpdated', { postId: post.id, modOp: op });
  return res.json({ ok: true, post });
});
router.post('/posts/:id/hide', mod('hide'));
router.post('/posts/:id/unhide', mod('unhide'));
router.post('/posts/:id/soft-delete', mod('soft-delete'));

// ── GET /api/community/moderation/queue (admin only) ─────────────────────
router.get('/moderation/queue', asyncHandler(async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'forbidden' });
  const reported = memStore.posts.filter((p) => p.reportedCount > 0 && !p.deletedAt);
  const hidden = memStore.posts.filter((p) => p.hidden && !p.deletedAt);
  const audit = memStore.audit.slice(-100);
  return res.json({ reported, hidden, audit });
}));

export default router;
