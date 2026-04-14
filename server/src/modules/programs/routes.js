/**
 * Program & Cohort Routes
 *
 * Organization → Program → Cohort → Farmers
 *
 * Programs group farmers into initiatives (e.g. "2026 Maize Pilot").
 * Cohorts sub-group within programs (e.g. "Batch 1 — Accra Region").
 *
 * All operations are org-scoped. Farmers can be assigned to a program
 * and optionally a cohort within that program.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import prisma from '../../config/database.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate, extractOrganization);

// ═══════════════════════════════════════════════════════════
//  PROGRAMS
// ═══════════════════════════════════════════════════════════

// GET /api/programs — list programs for org
router.get('/',
  authorize('super_admin', 'institutional_admin', 'field_officer', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    const orgId = req.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization context required' });

    const programs = await prisma.program.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { cohorts: true, farmers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ programs });
  }));

// POST /api/programs — create a program
router.post('/',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization context required' });

    const { name, description, startDate, endDate } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Program name is required' });

    const program = await prisma.program.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    writeAuditLog({ userId: req.user.sub, action: 'program_created', details: { programId: program.id, name } }).catch(() => {});
    res.status(201).json({ program });
  }));

// PATCH /api/programs/:id — update program
router.patch('/:id',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.organizationId;
    const existing = await prisma.program.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) return res.status(404).json({ error: 'Program not found' });

    const { name, description, status, startDate, endDate } = req.body;
    const program = await prisma.program.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      },
    });

    res.json({ program });
  }));

// ═══════════════════════════════════════════════════════════
//  COHORTS
// ═══════════════════════════════════════════════════════════

// GET /api/programs/:programId/cohorts — list cohorts in a program
router.get('/:programId/cohorts',
  authorize('super_admin', 'institutional_admin', 'field_officer', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    const orgId = req.organizationId;
    const program = await prisma.program.findFirst({
      where: { id: req.params.programId, organizationId: orgId },
    });
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const cohorts = await prisma.cohort.findMany({
      where: { programId: req.params.programId },
      include: {
        _count: { select: { farmers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ cohorts });
  }));

// POST /api/programs/:programId/cohorts — create a cohort
router.post('/:programId/cohorts',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.organizationId;
    const program = await prisma.program.findFirst({
      where: { id: req.params.programId, organizationId: orgId },
    });
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const { name, description, startDate, endDate } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Cohort name is required' });

    const cohort = await prisma.cohort.create({
      data: {
        programId: req.params.programId,
        name: name.trim(),
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    writeAuditLog({ userId: req.user.sub, action: 'cohort_created', details: { cohortId: cohort.id, programId: req.params.programId, name } }).catch(() => {});
    res.status(201).json({ cohort });
  }));

// PATCH /api/programs/:programId/cohorts/:id — update cohort
router.patch('/:programId/cohorts/:id',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.organizationId;
    const program = await prisma.program.findFirst({
      where: { id: req.params.programId, organizationId: orgId },
    });
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const existing = await prisma.cohort.findFirst({
      where: { id: req.params.id, programId: req.params.programId },
    });
    if (!existing) return res.status(404).json({ error: 'Cohort not found' });

    const { name, description, status, startDate, endDate } = req.body;
    const cohort = await prisma.cohort.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      },
    });

    res.json({ cohort });
  }));

// ═══════════════════════════════════════════════════════════
//  FARMER ASSIGNMENT
// ═══════════════════════════════════════════════════════════

// POST /api/programs/:programId/assign-farmers — assign farmers to program (and optionally cohort)
router.post('/:programId/assign-farmers',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.organizationId;
    const program = await prisma.program.findFirst({
      where: { id: req.params.programId, organizationId: orgId },
    });
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const { farmerIds, cohortId } = req.body;
    if (!farmerIds || !Array.isArray(farmerIds) || farmerIds.length === 0) {
      return res.status(400).json({ error: 'farmerIds array is required' });
    }

    // Verify cohort belongs to program if specified
    if (cohortId) {
      const cohort = await prisma.cohort.findFirst({
        where: { id: cohortId, programId: req.params.programId },
      });
      if (!cohort) return res.status(404).json({ error: 'Cohort not found in this program' });
    }

    // Verify all farmers belong to this org
    const farmers = await prisma.farmer.findMany({
      where: { id: { in: farmerIds }, organizationId: orgId },
      select: { id: true },
    });
    const validIds = new Set(farmers.map(f => f.id));
    const invalidIds = farmerIds.filter(id => !validIds.has(id));

    if (validIds.size === 0) {
      return res.status(400).json({ error: 'No valid farmer IDs found in this organization' });
    }

    // Bulk update
    const result = await prisma.farmer.updateMany({
      where: { id: { in: [...validIds] } },
      data: {
        programId: req.params.programId,
        ...(cohortId ? { cohortId } : {}),
      },
    });

    writeAuditLog({
      userId: req.user.sub,
      action: 'farmers_assigned_to_program',
      details: { programId: req.params.programId, cohortId, assignedCount: result.count },
    }).catch(() => {});

    res.json({
      success: true,
      assignedCount: result.count,
      invalidIds: invalidIds.length > 0 ? invalidIds : undefined,
    });
  }));

export default router;
