/**
 * Feedback Capture Routes
 *
 * Lightweight in-app feedback: any authenticated user can submit,
 * only admins can read the full list.
 *
 * Fields:
 *   message  — free text (required)
 *   context  — page or action context (optional, e.g. "farmer-detail/resend-invite")
 *   severity — info | low | medium | high (defaults to info)
 *
 * Routes:
 *   POST /api/feedback
 *   GET  /api/feedback   (super_admin, institutional_admin only)
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import rateLimit from 'express-rate-limit';
import prisma from '../../config/database.js';

const VALID_SEVERITIES = ['info', 'low', 'medium', 'high'];
const MAX_MESSAGE_LENGTH = 2000;

// Prevent feedback spam: 10 submissions per 10 minutes per user
const feedbackLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  // Use userId as key — all feedback routes require authentication so req.user.sub is always present
  keyGenerator: (req) => req.user?.sub || 'anonymous',
  message: { error: 'Too many feedback submissions. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

// ─── POST /api/feedback ──────────────────────────────────────

router.post('/', feedbackLimiter, asyncHandler(async (req, res) => {
  const { message, context, severity } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
  }

  const resolvedSeverity = VALID_SEVERITIES.includes(severity) ? severity : 'info';

  const entry = await prisma.userFeedback.create({
    data: {
      userId: req.user.sub,
      role: req.user.role,
      message: message.trim(),
      context: context ? String(context).slice(0, 200) : null,
      severity: resolvedSeverity,
    },
    select: {
      id: true, severity: true, context: true, createdAt: true,
    },
  });

  res.status(201).json({ message: 'Feedback received. Thank you.', id: entry.id });
}));

// ─── GET /api/feedback ───────────────────────────────────────
// Admin-only. Query params: ?severity=high&limit=50

router.get('/',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const severity = req.query.severity;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const skip = (page - 1) * limit;

    const where = {};
    if (severity && VALID_SEVERITIES.includes(severity)) where.severity = severity;

    // Institutional admins only see feedback from their org's users
    if (req.user.role === 'institutional_admin' && req.organizationId) {
      where.user = { organizationId: req.organizationId };
    }

    const [items, total] = await Promise.all([
      prisma.userFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, role: true, message: true, context: true,
          severity: true, createdAt: true,
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.userFeedback.count({ where }),
    ]);

    // Severity distribution
    const bySeverity = await prisma.userFeedback.groupBy({
      by: ['severity'],
      where: req.user.role === 'institutional_admin' && req.organizationId
        ? { user: { organizationId: req.organizationId } }
        : {},
      _count: true,
    });

    res.json({
      total,
      page,
      limit,
      items,
      distribution: Object.fromEntries(bySeverity.map(r => [r.severity, r._count])),
    });
  }));

export default router;
