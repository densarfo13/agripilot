import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import prisma from '../../config/database.js';

const router = Router();
router.use(authenticate);

// Get audit trail for an application
router.get('/application/:applicationId', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { applicationId: req.params.applicationId },
    include: { user: { select: { id: true, fullName: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(logs);
}));

// Get all audit logs (admin only)
router.get('/', authorize('super_admin'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, action, userId } = req.query;
  const where = {};
  if (action) where.action = action;
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, role: true } },
        application: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
}));

export default router;
