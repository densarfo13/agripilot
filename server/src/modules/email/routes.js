/**
 * Email Admin Routes — email log visibility for admin dashboard.
 *
 * GET /api/email/logs — paginated email log with filters
 * GET /api/email/stats — summary counts by status/template
 */

import { Router } from 'express';
import prisma from '../../config/database.js';
import { authorize } from '../../middleware/auth.js';
import { isConfigured } from './provider.js';

const ADMIN_ROLES = ['super_admin', 'institutional_admin'];

const router = Router();

// All email admin routes require admin role
router.use(authorize(...ADMIN_ROLES));

/**
 * GET /api/email/logs
 * Query params: page, limit, status, templateName, recipient, since
 */
router.get('/logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.templateName) where.templateName = req.query.templateName;
    if (req.query.recipient) where.recipient = { contains: req.query.recipient, mode: 'insensitive' };
    if (req.query.since) where.createdAt = { gte: new Date(req.query.since) };

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          recipient: true,
          sender: true,
          subject: true,
          templateName: true,
          status: true,
          errorMessage: true,
          relatedUserId: true,
          createdAt: true,
        },
      }),
      prisma.emailLog.count({ where }),
    ]);

    res.json({
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[email/logs] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch email logs' });
  }
});

/**
 * GET /api/email/stats
 * Summary: counts by status, counts by template, provider status
 */
router.get('/stats', async (req, res) => {
  try {
    const [byStatus, byTemplate, totalCount] = await Promise.all([
      prisma.emailLog.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.emailLog.groupBy({
        by: ['templateName'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.emailLog.count(),
    ]);

    res.json({
      total: totalCount,
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, r._count.id])),
      byTemplate: Object.fromEntries(byTemplate.map(r => [r.templateName, r._count.id])),
      providerConfigured: isConfigured(),
    });
  } catch (err) {
    console.error('[email/stats] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch email stats' });
  }
});

export default router;
