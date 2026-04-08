import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import { validateParamUUID, parsePositiveInt } from '../../middleware/validate.js';
import prisma from '../../config/database.js';

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

// Get audit trail for an application
router.get('/application/:applicationId',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const logs = await prisma.auditLog.findMany({
      where: { applicationId: req.params.applicationId },
      include: { user: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(logs);
  }));

// Get all audit logs (admin only, org-scoped)
router.get('/', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1, 1000);
  const limit = parsePositiveInt(req.query.limit, 50, 200);
  const where = {};
  if (req.query.action) where.action = req.query.action;
  if (req.query.userId) where.userId = req.query.userId;

  // Org-scope: institutional_admin sees only their org's audit logs
  if (req.organizationId) where.organizationId = req.organizationId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, role: true } },
        application: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

export default router;
