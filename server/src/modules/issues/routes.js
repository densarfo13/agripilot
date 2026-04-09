/**
 * Issue Escalation Routes — Feedback-to-Improvement Loop
 *
 * Routes:
 *   POST  /api/issues            — submit a new issue (any authenticated user)
 *   GET   /api/issues/mine       — list my issues (any authenticated user)
 *   GET   /api/issues            — list all issues (admin only)
 *   GET   /api/issues/insights   — category/priority summary (admin only)
 *   PATCH /api/issues/:id        — update issue (admin only)
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import rateLimit from 'express-rate-limit';
import prisma from '../../config/database.js';
import { opsEvent } from '../../utils/opsLogger.js';

const VALID_TYPES = ['BUG', 'DATA_ISSUE', 'ACCESS_ISSUE', 'FEATURE_REQUEST'];
const VALID_CATEGORIES = ['BLOCKER', 'FRICTION', 'TRUST', 'FEATURE'];
const VALID_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED'];
const MAX_DESC_LENGTH = 2000;

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

    res.json({
      total: totalCount,
      byCategory: Object.fromEntries(byCategory.map(r => [r.category, r._count])),
      byPriority: Object.fromEntries(byPriority.map(r => [r.priority, r._count])),
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, r._count])),
      byType: Object.fromEntries(byType.map(r => [r.issueType, r._count])),
      frequent,
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
          createdAt: true, updatedAt: true,
          user: { select: { id: true, fullName: true, email: true } },
          organization: { select: { id: true, name: true } },
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

    opsEvent('workflow', 'issue_status_updated', 'info', {
      issueId: id,
      oldStatus: existing.status,
      newStatus: status || existing.status,
      updatedBy: req.user.sub,
    });

    res.json(updated);
  }));

export default router;
