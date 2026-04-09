/**
 * Issue Escalation Routes
 *
 * Lightweight internal issue reporting: any authenticated user can submit,
 * admins can list, filter, and update status.
 *
 * Routes:
 *   POST  /api/issues          — submit a new issue
 *   GET   /api/issues          — list issues (admin only)
 *   PATCH /api/issues/:id      — update issue status (admin only)
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import rateLimit from 'express-rate-limit';
import prisma from '../../config/database.js';
import { opsEvent } from '../../utils/opsLogger.js';

const VALID_TYPES = ['BUG', 'DATA_ISSUE', 'ACCESS_ISSUE', 'FEATURE_REQUEST'];
const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
const MAX_DESC_LENGTH = 2000;

// Rate limit: 10 issues per 10 minutes per user
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
  const { issueType, description, pageRoute } = req.body;

  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }
  if (description.trim().length > MAX_DESC_LENGTH) {
    return res.status(400).json({ error: `description must be ${MAX_DESC_LENGTH} characters or fewer` });
  }
  if (!issueType || !VALID_TYPES.includes(issueType)) {
    return res.status(400).json({ error: `issueType must be one of: ${VALID_TYPES.join(', ')}` });
  }

  const issue = await prisma.issue.create({
    data: {
      userId: req.user.sub,
      orgId: req.organizationId || null,
      issueType,
      description: description.trim(),
      pageRoute: pageRoute ? String(pageRoute).slice(0, 200) : null,
    },
    select: {
      id: true, issueType: true, status: true, createdAt: true,
    },
  });

  opsEvent('workflow', 'issue_created', 'info', {
    issueId: issue.id,
    userId: req.user.sub,
    orgId: req.organizationId,
    issueType,
    pageRoute,
  });

  res.status(201).json({ message: 'Issue reported successfully. We will review it shortly.', id: issue.id });
}));

// ─── GET /api/issues ────────────────────────────────────
// Admin-only. Query params: ?status=OPEN&issueType=BUG&orgId=xxx&limit=50&page=1

router.get('/',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
      where.status = req.query.status;
    }
    if (req.query.issueType && VALID_TYPES.includes(req.query.issueType)) {
      where.issueType = req.query.issueType;
    }

    // Institutional admins only see their org's issues
    if (req.user.role === 'institutional_admin' && req.organizationId) {
      where.orgId = req.organizationId;
    } else if (req.query.orgId) {
      where.orgId = req.query.orgId;
    }

    const [items, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, issueType: true, description: true, status: true,
          pageRoute: true, adminNote: true, createdAt: true, updatedAt: true,
          user: { select: { id: true, fullName: true, email: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
      prisma.issue.count({ where }),
    ]);

    // Status distribution
    const orgScope = req.user.role === 'institutional_admin' && req.organizationId
      ? { orgId: req.organizationId } : {};
    const byStatus = await prisma.issue.groupBy({
      by: ['status'],
      where: orgScope,
      _count: true,
    });

    res.json({
      total,
      page,
      limit,
      items,
      distribution: Object.fromEntries(byStatus.map(r => [r.status, r._count])),
    });
  }));

// ─── PATCH /api/issues/:id ──────────────────────────────

router.patch('/:id',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const existing = await prisma.issue.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Institutional admins can only update their org's issues
    if (req.user.role === 'institutional_admin' && req.organizationId && existing.orgId !== req.organizationId) {
      return res.status(403).json({ error: 'Not authorized to update this issue' });
    }

    const data = {};
    if (status) data.status = status;
    if (adminNote !== undefined) data.adminNote = adminNote ? String(adminNote).slice(0, 1000) : null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const updated = await prisma.issue.update({
      where: { id },
      data,
      select: {
        id: true, issueType: true, description: true, status: true,
        adminNote: true, pageRoute: true, createdAt: true, updatedAt: true,
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
