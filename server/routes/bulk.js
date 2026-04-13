import express from 'express';
import { authenticate, authorize } from '../src/middleware/auth.js';
import { extractOrganization } from '../src/middleware/orgScope.js';
import prisma from '../src/config/database.js';
import { asyncHandler } from '../src/middleware/errorHandler.js';
import { writeAuditLog } from '../src/modules/audit/service.js';

const router = express.Router();

// Shared middleware for all bulk routes
router.use(authenticate, authorize('super_admin', 'institutional_admin'), extractOrganization);

// ─── POST /import/farmers ──────────────────────────────
router.post('/import/farmers', asyncHandler(async (req, res) => {
  const { csv } = req.body;
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'Request body must include a "csv" string field.' });
  }

  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return res.status(400).json({ error: 'CSV must have a header row and at least one data row.' });
  }

  // Parse header
  const headerRow = lines[0].toLowerCase().split(',').map(h => h.trim());
  const nameIdx = headerRow.indexOf('name');
  const phoneIdx = headerRow.indexOf('phone');
  const countryIdx = headerRow.indexOf('country');

  if (nameIdx === -1 || phoneIdx === -1) {
    return res.status(400).json({ error: 'CSV header must include "name" and "phone" columns.' });
  }

  const orgId = req.organizationId || req.user.organizationId || null;
  const actorId = req.user.sub;

  // Pre-fetch existing phone numbers for duplicate detection
  const existingFarmers = await prisma.farmer.findMany({
    where: orgId ? { organizationId: orgId } : {},
    select: { phone: true },
  });
  const existingPhones = new Set(existingFarmers.map(f => f.phone));

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const name = cols[nameIdx] || '';
    const phone = cols[phoneIdx] || '';
    const country = countryIdx !== -1 ? (cols[countryIdx] || '') : '';

    // Validate name
    if (!name) {
      errors.push({ row: i + 1, error: 'Name is required.' });
      continue;
    }

    // Validate phone (basic: must start with + and have digits)
    if (!phone || !/^\+?\d{7,15}$/.test(phone.replace(/[\s-]/g, ''))) {
      errors.push({ row: i + 1, error: `Invalid phone format: "${phone}"` });
      continue;
    }

    const normalizedPhone = phone.replace(/[\s-]/g, '');

    // Skip duplicates
    if (existingPhones.has(normalizedPhone)) {
      skipped++;
      continue;
    }

    try {
      const farmer = await prisma.farmer.create({
        data: {
          fullName: name,
          phone: normalizedPhone,
          countryCode: country || null,
          registrationStatus: 'approved',
          organizationId: orgId,
        },
      });

      existingPhones.add(normalizedPhone);
      created++;

      await writeAuditLog({
        action: 'BULK_IMPORT_FARMER',
        actorId,
        targetType: 'farmer',
        targetId: farmer.id,
        details: { fullName: name, phone: normalizedPhone, source: 'csv_import' },
      });
    } catch (err) {
      errors.push({ row: i + 1, error: err.message });
    }
  }

  res.json({ created, skipped, errors });
}));

// ─── POST /invite ──────────────────────────────────────
router.post('/invite', asyncHandler(async (req, res) => {
  const { farmerIds } = req.body;
  if (!Array.isArray(farmerIds) || farmerIds.length === 0) {
    return res.status(400).json({ error: '"farmerIds" must be a non-empty array.' });
  }

  const orgId = req.organizationId || req.user.organizationId || null;

  // Validate all farmers exist and belong to org
  const where = { id: { in: farmerIds } };
  if (orgId) {
    where.organizationId = orgId;
  }

  const farmers = await prisma.farmer.findMany({
    where,
    select: { id: true },
  });
  const foundIds = new Set(farmers.map(f => f.id));

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const fid of farmerIds) {
    if (!foundIds.has(fid)) {
      failed++;
      errors.push({ farmerId: fid, error: 'Farmer not found or not in organization.' });
      continue;
    }

    // In a real implementation this would trigger SMS/email invite.
    // For now we mark it as sent.
    sent++;
  }

  res.json({ sent, failed, errors });
}));

// ─── POST /assign-officer ──────────────────────────────
router.post('/assign-officer', asyncHandler(async (req, res) => {
  const { farmerIds, officerId } = req.body;
  if (!Array.isArray(farmerIds) || farmerIds.length === 0) {
    return res.status(400).json({ error: '"farmerIds" must be a non-empty array.' });
  }
  if (!officerId) {
    return res.status(400).json({ error: '"officerId" is required.' });
  }

  // Validate officer exists, has field_officer role, and belongs to same org
  const officerWhere = { id: officerId };
  const officer = await prisma.user.findUnique({
    where: officerWhere,
    select: { id: true, role: true, organizationId: true },
  });

  if (!officer) {
    return res.status(404).json({ error: 'Officer not found.' });
  }
  if (officer.role !== 'field_officer') {
    return res.status(400).json({ error: 'Specified user does not have the field_officer role.' });
  }

  const orgId = req.organizationId || req.user.organizationId || null;

  // Ensure the officer belongs to the same organization
  if (orgId && officer.organizationId !== orgId) {
    return res.status(403).json({ error: 'Officer does not belong to your organization.' });
  }

  let updated = 0;
  const errors = [];

  for (const fid of farmerIds) {
    try {
      const where = { id: fid };
      if (orgId) {
        where.organizationId = orgId;
      }

      const farmer = await prisma.farmer.findFirst({ where, select: { id: true } });
      if (!farmer) {
        errors.push({ farmerId: fid, error: 'Farmer not found or not in organization.' });
        continue;
      }

      await prisma.farmer.update({
        where: { id: fid },
        data: { assignedOfficerId: officerId },
      });
      updated++;
    } catch (err) {
      errors.push({ farmerId: fid, error: err.message });
    }
  }

  res.json({ updated, errors });
}));

export default router;
