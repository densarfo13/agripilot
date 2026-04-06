import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import { dedupGuard } from '../../middleware/dedup.js';
import prisma from '../../config/database.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

const VALID_ORG_TYPES = ['NGO', 'LENDER', 'COOPERATIVE', 'INVESTOR', 'DEVELOPMENT_PARTNER', 'INTERNAL'];

// List all organizations (super_admin sees all; institutional_admin sees own only)
router.get('/', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const where = {};
  // institutional_admin can only see their own org
  if (req.user.role !== 'super_admin' && req.organizationId) {
    where.id = req.organizationId;
  }

  const orgs = await prisma.organization.findMany({
    where,
    include: {
      _count: {
        select: { users: true, farmers: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Enrich with application counts
  const enriched = await Promise.all(orgs.map(async (org) => {
    const appCount = await prisma.application.count({
      where: { farmer: { organizationId: org.id } },
    });
    return {
      ...org,
      _count: { ...org._count, applications: appCount },
    };
  }));

  res.json(enriched);
}));

// Get single organization by ID
router.get('/:id',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    // institutional_admin can only view their own org
    if (req.user.role !== 'super_admin' && req.organizationId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied — not your organization' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, farmers: true } },
      },
    });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const appCount = await prisma.application.count({
      where: { farmer: { organizationId: org.id } },
    });

    res.json({ ...org, _count: { ...org._count, applications: appCount } });
  }));

// Create organization (super_admin only)
router.post('/',
  authorize('super_admin'),
  dedupGuard('org-create'),
  asyncHandler(async (req, res) => {
    const { name, type, countryCode, regionCode } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (type && !VALID_ORG_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_ORG_TYPES.join(', ')}` });
    }

    const org = await prisma.organization.create({
      data: {
        name: name.trim(),
        type: type || 'INTERNAL',
        countryCode: countryCode || null,
        regionCode: regionCode || null,
      },
    });

    writeAuditLog({ userId: req.user.sub, action: 'organization_created', details: { organizationId: org.id, name: org.name } }).catch(() => {});
    res.status(201).json(org);
  }));

// Update organization (super_admin only)
router.patch('/:id',
  validateParamUUID('id'),
  authorize('super_admin'),
  dedupGuard('org-update'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Organization not found' });

    const { name, type, countryCode, regionCode, isActive } = req.body;
    if (type && !VALID_ORG_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_ORG_TYPES.join(', ')}` });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (type !== undefined) updateData.type = type;
    if (countryCode !== undefined) updateData.countryCode = countryCode || null;
    if (regionCode !== undefined) updateData.regionCode = regionCode || null;
    if (isActive !== undefined) updateData.isActive = !!isActive;

    const updated = await prisma.organization.update({
      where: { id: req.params.id },
      data: updateData,
    });

    writeAuditLog({ userId: req.user.sub, action: 'organization_updated', details: { organizationId: updated.id, changes: Object.keys(updateData) } }).catch(() => {});
    res.json(updated);
  }));

export default router;
