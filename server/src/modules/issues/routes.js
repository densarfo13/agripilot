/**
 * Issue Escalation Routes — Feedback-to-Improvement Loop
 *
 * Routes:
 *   POST  /api/issues                  — submit a new issue (any authenticated user)
 *   GET   /api/issues/mine             — list my issues (any authenticated user)
 *   GET   /api/issues/notifications    — staff notifications (admin only)
 *   PATCH /api/issues/notifications/read — mark notifications read (admin only)
 *   GET   /api/issues                  — list all issues (admin only)
 *   GET   /api/issues/insights         — category/priority/SLA summary (admin only)
 *   GET   /api/issues/assignees        — list assignable users (admin only)
 *   PATCH /api/issues/bulk             — bulk update issues (admin only)
 *   PATCH /api/issues/:id              — update issue (admin only)
 *   GET   /api/issues/:id/comments     — list comments (reporter + admin)
 *   POST  /api/issues/:id/comments     — add comment (reporter + admin)
 *   GET   /api/issues/:id/attachments  — list attachments (reporter + admin)
 *   POST  /api/issues/:id/attachments  — upload attachment (reporter + admin)
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../../config/database.js';
import { opsEvent } from '../../utils/opsLogger.js';

const VALID_TYPES = ['BUG', 'DATA_ISSUE', 'ACCESS_ISSUE', 'FEATURE_REQUEST'];
const VALID_CATEGORIES = ['BLOCKER', 'FRICTION', 'TRUST', 'FEATURE'];
const VALID_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED'];
const MAX_DESC_LENGTH = 2000;
const MAX_COMMENT_LENGTH = 1000;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];

// SLA thresholds (hours)
const SLA_THRESHOLDS = {
  HIGH: { response: 4, resolve: 24 },
  MEDIUM: { response: 12, resolve: 72 },
  LOW: { response: 48, resolve: 168 },
};

// Auto-map category → default priority
const CATEGORY_PRIORITY_MAP = {
  BLOCKER: 'HIGH',
  TRUST: 'HIGH',
  FRICTION: 'MEDIUM',
  FEATURE: 'LOW',
};

const issueLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.sub || 'anonymous',
  message: { error: 'Too many issue reports. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// File upload config
const uploadsDir = path.resolve('uploads/issues');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const issueUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: MAX_ATTACHMENT_SIZE },
  fileFilter: (req, file, cb) => {
    cb(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
  },
});

// Helper: create staff notification
async function notifyStaff(userId, type, title, message, metadata = {}) {
  if (!userId) return;
  try {
    await prisma.staffNotification.create({ data: { userId, type, title, message, metadata } });
  } catch { /* non-critical */ }
}

// Helper: check if user can access issue (reporter or admin)
async function canAccessIssue(req, issueId) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { id: true, userId: true, orgId: true } });
  if (!issue) return null;
  const isAdmin = ['super_admin', 'institutional_admin'].includes(req.user.role);
  const isReporter = issue.userId === req.user.sub;
  if (!isAdmin && !isReporter) return null;
  if (req.user.role === 'institutional_admin' && req.organizationId && issue.orgId !== req.organizationId) return null;
  return issue;
}

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

// ─── POST /api/issues ───────────────────────────────────

router.post('/', issueLimiter, asyncHandler(async (req, res) => {
  const { issueType, category, description, pageRoute, priority } = req.body;

  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }
  if (description.trim().length > MAX_DESC_LENGTH) {
    return res.status(400).json({ error: `description must be ${MAX_DESC_LENGTH} characters or fewer` });
  }
  if (!issueType || !VALID_TYPES.includes(issueType)) {
    return res.status(400).json({ error: `issueType must be one of: ${VALID_TYPES.join(', ')}` });
  }

  const resolvedCategory = VALID_CATEGORIES.includes(category) ? category : 'FRICTION';
  // Priority: explicit override wins, otherwise auto-map from category
  const resolvedPriority = VALID_PRIORITIES.includes(priority)
    ? priority
    : (CATEGORY_PRIORITY_MAP[resolvedCategory] || 'MEDIUM');

  const issue = await prisma.issue.create({
    data: {
      userId: req.user.sub,
      orgId: req.organizationId || null,
      issueType,
      category: resolvedCategory,
      priority: resolvedPriority,
      description: description.trim(),
      pageRoute: pageRoute ? String(pageRoute).slice(0, 200) : null,
    },
    select: {
      id: true, issueType: true, category: true, priority: true, status: true, assignedToId: true, createdAt: true,
    },
  });

  opsEvent('workflow', 'issue_created', 'info', {
    issueId: issue.id,
    userId: req.user.sub,
    orgId: req.organizationId,
    issueType,
    category: resolvedCategory,
    priority: resolvedPriority,
    pageRoute,
  });

  res.status(201).json({ message: 'Issue reported successfully. We will review it shortly.', id: issue.id });
}));

// ─── GET /api/issues/mine ───────────────────────────────

router.get('/mine', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.issue.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, issueType: true, category: true, description: true, status: true,
        priority: true, pageRoute: true, adminNote: true, resolutionNote: true,
        assignedToId: true, assignedTo: { select: { id: true, fullName: true } },
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.issue.count({ where: { userId: req.user.sub } }),
  ]);

  res.json({ total, page, limit, items });
}));

// ─── GET /api/issues/notifications ──────────────────────
// Staff notifications for issue-related events.

router.get('/notifications',
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const [items, unreadCount] = await Promise.all([
      prisma.staffNotification.findMany({
        where: { userId: req.user.sub },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, type: true, title: true, message: true, read: true, metadata: true, createdAt: true },
      }),
      prisma.staffNotification.count({ where: { userId: req.user.sub, read: false } }),
    ]);
    res.json({ items, unreadCount });
  }));

// ─── PATCH /api/issues/notifications/read ───────────────

router.patch('/notifications/read',
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const where = { userId: req.user.sub };
    if (Array.isArray(ids) && ids.length > 0) where.id = { in: ids };
    await prisma.staffNotification.updateMany({ where, data: { read: true } });
    res.json({ ok: true });
  }));

// ─── GET /api/issues/insights ───────────────────────────
// Admin-only. Returns category/priority/status distributions and top frequent issue types.

router.get('/insights',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const orgScope = req.user.role === 'institutional_admin' && req.organizationId
      ? { orgId: req.organizationId } : {};

    const [byCategory, byPriority, byStatus, byType, totalCount] = await Promise.all([
      prisma.issue.groupBy({ by: ['category'], where: orgScope, _count: true }),
      prisma.issue.groupBy({ by: ['priority'], where: orgScope, _count: true }),
      prisma.issue.groupBy({ by: ['status'], where: orgScope, _count: true }),
      prisma.issue.groupBy({ by: ['issueType'], where: orgScope, _count: true, orderBy: { _count: { issueType: 'desc' } } }),
      prisma.issue.count({ where: orgScope }),
    ]);

    // Top frequent descriptions (group by first 80 chars to find duplicates)
    const recentOpen = await prisma.issue.findMany({
      where: { ...orgScope, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { description: true, category: true, priority: true },
    });

    // Simple frequency: count descriptions that share similar prefix
    const prefixCounts = {};
    for (const r of recentOpen) {
      const prefix = r.description.slice(0, 80).toLowerCase().trim();
      if (!prefixCounts[prefix]) prefixCounts[prefix] = { text: r.description.slice(0, 120), count: 0, category: r.category, priority: r.priority };
      prefixCounts[prefix].count++;
    }
    const frequent = Object.values(prefixCounts)
      .filter(f => f.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // SLA metrics: avg first-response time and avg resolution time (in hours)
    const slaIssues = await prisma.issue.findMany({
      where: orgScope,
      select: { createdAt: true, firstResponseAt: true, resolvedAt: true },
    });
    let responseTimeSum = 0, responseTimeCount = 0;
    let resolveTimeSum = 0, resolveTimeCount = 0;
    for (const si of slaIssues) {
      if (si.firstResponseAt) {
        responseTimeSum += (si.firstResponseAt.getTime() - si.createdAt.getTime());
        responseTimeCount++;
      }
      if (si.resolvedAt) {
        resolveTimeSum += (si.resolvedAt.getTime() - si.createdAt.getTime());
        resolveTimeCount++;
      }
    }
    // SLA breach counts for open/in-progress issues
    const openIssues = await prisma.issue.findMany({
      where: { ...orgScope, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { priority: true, status: true, createdAt: true, firstResponseAt: true },
    });
    let breachedResponse = 0, breachedResolve = 0;
    const now = Date.now();
    for (const oi of openIssues) {
      const thresh = SLA_THRESHOLDS[oi.priority] || SLA_THRESHOLDS.MEDIUM;
      const ageHrs = (now - oi.createdAt.getTime()) / 3600000;
      if (!oi.firstResponseAt && ageHrs > thresh.response) breachedResponse++;
      if (ageHrs > thresh.resolve) breachedResolve++;
    }

    const sla = {
      avgFirstResponseHrs: responseTimeCount > 0 ? Math.round((responseTimeSum / responseTimeCount) / 3600000 * 10) / 10 : null,
      avgResolveHrs: resolveTimeCount > 0 ? Math.round((resolveTimeSum / resolveTimeCount) / 3600000 * 10) / 10 : null,
      sampledResponse: responseTimeCount,
      sampledResolved: resolveTimeCount,
      breachedResponse,
      breachedResolve,
      thresholds: SLA_THRESHOLDS,
    };

    res.json({
      total: totalCount,
      byCategory: Object.fromEntries(byCategory.map(r => [r.category, r._count])),
      byPriority: Object.fromEntries(byPriority.map(r => [r.priority, r._count])),
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, r._count])),
      byType: Object.fromEntries(byType.map(r => [r.issueType, r._count])),
      frequent,
      sla,
    });
  }));

// ─── GET /api/issues ────────────────────────────────────

router.get('/',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status && VALID_STATUSES.includes(req.query.status)) where.status = req.query.status;
    if (req.query.issueType && VALID_TYPES.includes(req.query.issueType)) where.issueType = req.query.issueType;
    if (req.query.category && VALID_CATEGORIES.includes(req.query.category)) where.category = req.query.category;
    if (req.query.priority && VALID_PRIORITIES.includes(req.query.priority)) where.priority = req.query.priority;
    if (req.query.assignedToId) where.assignedToId = req.query.assignedToId;
    if (req.query.assignedToMe === 'true') where.assignedToId = req.user.sub;
    if (req.query.unassigned === 'true') where.assignedToId = null;

    if (req.user.role === 'institutional_admin' && req.organizationId) {
      where.orgId = req.organizationId;
    } else if (req.query.orgId) {
      where.orgId = req.query.orgId;
    }

    const [items, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }], // HIGH first
        skip,
        take: limit,
        select: {
          id: true, issueType: true, category: true, description: true, status: true, priority: true,
          pageRoute: true, adminNote: true, resolutionNote: true, assignedToId: true,
          assignedTo: { select: { id: true, fullName: true } },
          firstResponseAt: true, resolvedAt: true,
          createdAt: true, updatedAt: true,
          user: { select: { id: true, fullName: true, email: true } },
          organization: { select: { id: true, name: true } },
          _count: { select: { comments: true } },
        },
      }),
      prisma.issue.count({ where }),
    ]);

    const orgScope = req.user.role === 'institutional_admin' && req.organizationId
      ? { orgId: req.organizationId } : {};
    const byStatus = await prisma.issue.groupBy({ by: ['status'], where: orgScope, _count: true });

    res.json({
      total, page, limit, items,
      distribution: Object.fromEntries(byStatus.map(r => [r.status, r._count])),
    });
  }));

// ─── GET /api/issues/assignees ──────────────────────────
// Admin-only. Returns list of users who can be assigned issues.

router.get('/assignees',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const where = { role: { in: ['super_admin', 'institutional_admin', 'reviewer'] } };
    if (req.user.role === 'institutional_admin' && req.organizationId) {
      where.organizationId = req.organizationId;
    }
    const users = await prisma.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, role: true },
    });
    res.json(users);
  }));

// ─── PATCH /api/issues/bulk ─────────────────────────────
// Admin-only. Bulk update multiple issues at once.

router.patch('/bulk',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const { ids, status, assignedToId, priority, category } = req.body;

    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
      return res.status(400).json({ error: 'ids must be an array of 1-50 issue IDs' });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const data = {};
    if (status) data.status = status;
    if (priority) data.priority = priority;
    if (category) data.category = category;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const where = { id: { in: ids } };
    if (req.user.role === 'institutional_admin' && req.organizationId) {
      where.orgId = req.organizationId;
    }

    const result = await prisma.issue.updateMany({ where, data });

    opsEvent('workflow', 'issues_bulk_updated', 'info', {
      count: result.count,
      ids,
      changes: data,
      updatedBy: req.user.sub,
    });

    res.json({ updated: result.count });
  }));

// ─── PATCH /api/issues/:id ──────────────────────────────

router.patch('/:id',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, adminNote, resolutionNote, priority, category, assignedToId } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const existing = await prisma.issue.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Issue not found' });

    if (req.user.role === 'institutional_admin' && req.organizationId && existing.orgId !== req.organizationId) {
      return res.status(403).json({ error: 'Not authorized to update this issue' });
    }

    const data = {};
    if (status) data.status = status;
    if (priority) data.priority = priority;
    if (category) data.category = category;
    if (adminNote !== undefined) data.adminNote = adminNote ? String(adminNote).slice(0, 1000) : null;
    if (resolutionNote !== undefined) data.resolutionNote = resolutionNote ? String(resolutionNote).slice(0, 2000) : null;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;

    // SLA: auto-set firstResponseAt on first status change away from OPEN
    if (status && status !== 'OPEN' && existing.status === 'OPEN' && !existing.firstResponseAt) {
      data.firstResponseAt = new Date();
    }
    // SLA: auto-set resolvedAt when moving to FIXED or VERIFIED
    if (status && (status === 'FIXED' || status === 'VERIFIED') && !existing.resolvedAt) {
      data.resolvedAt = new Date();
    }
    // SLA: clear resolvedAt if reopened
    if (status === 'OPEN' && existing.resolvedAt) {
      data.resolvedAt = null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const updated = await prisma.issue.update({
      where: { id },
      data,
      select: {
        id: true, issueType: true, category: true, description: true, status: true, priority: true,
        adminNote: true, resolutionNote: true, assignedToId: true,
        assignedTo: { select: { id: true, fullName: true } },
        pageRoute: true, createdAt: true, updatedAt: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    opsEvent('workflow', 'issue_updated', 'info', {
      issueId: id,
      oldStatus: existing.status,
      newStatus: status || existing.status,
      updatedBy: req.user.sub,
      ...(assignedToId !== undefined && { assignedToId: assignedToId || null, previousAssignee: existing.assignedToId }),
    });

    // In-app notification for assignment
    if (assignedToId !== undefined && assignedToId !== existing.assignedToId) {
      opsEvent('notification', 'issue_assigned', 'info', {
        issueId: id,
        assignedToId: assignedToId || null,
        previousAssignee: existing.assignedToId,
        assignedBy: req.user.sub,
      });
      if (assignedToId) {
        notifyStaff(assignedToId, 'issue_assigned',
          'Issue assigned to you',
          `${existing.description.slice(0, 80)}...`,
          { issueId: id, assignedBy: req.user.sub });
      }
    }

    // In-app notification for status change (to reporter)
    if (status && status !== existing.status) {
      notifyStaff(existing.userId, 'issue_status_changed',
        `Issue ${status === 'FIXED' ? 'fixed' : status === 'VERIFIED' ? 'verified' : status === 'IN_PROGRESS' ? 'in progress' : 'updated'}`,
        `Your issue "${existing.description.slice(0, 60)}..." is now ${status.replace('_', ' ').toLowerCase()}.`,
        { issueId: id, oldStatus: existing.status, newStatus: status });
    }

    res.json(updated);
  }));

// ─── GET /api/issues/:id/comments ──────────────────────
// Accessible by issue reporter + admins

router.get('/:id/comments', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const issue = await canAccessIssue(req, id);
  if (!issue) return res.status(404).json({ error: 'Issue not found or not authorized' });

  const comments = await prisma.issueComment.findMany({
    where: { issueId: id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, text: true, createdAt: true,
      user: { select: { id: true, fullName: true } },
    },
  });
  res.json(comments);
}));

// ─── POST /api/issues/:id/comments ─────────────────────

const commentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.sub || 'anonymous',
  message: { error: 'Too many comments. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/:id/comments', commentLimiter, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.trim().length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ error: `comment must be ${MAX_COMMENT_LENGTH} characters or fewer` });
  }

  const issue = await canAccessIssue(req, id);
  if (!issue) return res.status(404).json({ error: 'Issue not found or not authorized' });

  const comment = await prisma.issueComment.create({
    data: { issueId: id, userId: req.user.sub, text: text.trim() },
    select: {
      id: true, text: true, createdAt: true,
      user: { select: { id: true, fullName: true } },
    },
  });

  opsEvent('workflow', 'issue_comment_added', 'info', {
    issueId: id,
    commentId: comment.id,
    userId: req.user.sub,
  });

  // Notify assignee if commenter is not the assignee
  const fullIssue = await prisma.issue.findUnique({ where: { id }, select: { assignedToId: true, userId: true } });
  if (fullIssue?.assignedToId && fullIssue.assignedToId !== req.user.sub) {
    notifyStaff(fullIssue.assignedToId, 'issue_comment',
      'New comment on assigned issue',
      `${text.trim().slice(0, 80)}...`,
      { issueId: id, commentId: comment.id });
  }

  res.status(201).json(comment);
}));

// ─── GET /api/issues/:id/attachments ────────────────────

router.get('/:id/attachments', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const issue = await canAccessIssue(req, id);
  if (!issue) return res.status(404).json({ error: 'Issue not found or not authorized' });

  const attachments = await prisma.issueAttachment.findMany({
    where: { issueId: id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, filename: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true,
      user: { select: { id: true, fullName: true } },
    },
  });
  res.json(attachments);
}));

// ─── POST /api/issues/:id/attachments ───────────────────

router.post('/:id/attachments', issueUpload.single('file'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const issue = await canAccessIssue(req, id);
  if (!issue) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'Issue not found or not authorized' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or file type not allowed' });
  }

  const attachment = await prisma.issueAttachment.create({
    data: {
      issueId: id,
      userId: req.user.sub,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    },
    select: {
      id: true, filename: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true,
      user: { select: { id: true, fullName: true } },
    },
  });

  opsEvent('workflow', 'issue_attachment_added', 'info', {
    issueId: id,
    attachmentId: attachment.id,
    userId: req.user.sub,
    originalName: req.file.originalname,
  });

  res.status(201).json(attachment);
}));

export default router;
