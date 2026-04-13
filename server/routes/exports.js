import express from 'express';
import { authenticate, authorize } from '../src/middleware/auth.js';
import { extractOrganization } from '../src/middleware/orgScope.js';
import prisma from '../src/config/database.js';
import { asyncHandler } from '../src/middleware/errorHandler.js';

const router = express.Router();

// Shared middleware for all export routes
router.use(authenticate, authorize('super_admin', 'institutional_admin'), extractOrganization);

/**
 * Helper: escape a CSV field value (handle commas, quotes, newlines).
 */
function csvEscape(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Helper: convert an array of objects to CSV text.
 */
function toCsv(headers, rows) {
  const headerLine = headers.map(h => csvEscape(h.label)).join(',');
  const dataLines = rows.map(row =>
    headers.map(h => csvEscape(h.getter(row))).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

// ─── GET /farmers/csv ──────────────────────────────────
router.get('/farmers/csv', asyncHandler(async (req, res) => {
  const where = {};
  if (req.organizationId) {
    where.organizationId = req.organizationId;
  }
  if (req.query.status) {
    where.registrationStatus = req.query.status;
  }

  const farmers = await prisma.farmer.findMany({
    where,
    include: {
      farmLocations: { select: { id: true } },
      applications: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const headers = [
    { label: 'ID', getter: r => r.id },
    { label: 'Full Name', getter: r => r.fullName },
    { label: 'Phone', getter: r => r.phone },
    { label: 'Country Code', getter: r => r.countryCode },
    { label: 'Gender', getter: r => r.gender },
    { label: 'Registration Status', getter: r => r.registrationStatus },
    { label: 'Lifecycle Stage', getter: r => r.lifecycleStage },
    { label: 'Organization ID', getter: r => r.organizationId },
    { label: 'Farm Locations', getter: r => r.farmLocations?.length ?? 0 },
    { label: 'Applications', getter: r => r.applications?.length ?? 0 },
    { label: 'Created At', getter: r => r.createdAt?.toISOString() },
  ];

  const csv = toCsv(headers, farmers);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="farmers-export.csv"');
  res.send(csv);
}));

// ─── GET /updates/csv ──────────────────────────────────
router.get('/updates/csv', asyncHandler(async (req, res) => {
  const where = {};
  if (req.organizationId) {
    where.farmSeason = { farmer: { organizationId: req.organizationId } };
  }

  const entries = await prisma.seasonProgressEntry.findMany({
    where,
    include: {
      farmSeason: {
        select: { id: true, cropType: true, farmer: { select: { id: true, fullName: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const headers = [
    { label: 'Entry ID', getter: r => r.id },
    { label: 'Farm Season ID', getter: r => r.farmSeasonId },
    { label: 'Crop Type', getter: r => r.farmSeason?.cropType },
    { label: 'Farmer ID', getter: r => r.farmSeason?.farmer?.id },
    { label: 'Farmer Name', getter: r => r.farmSeason?.farmer?.fullName },
    { label: 'Entry Type', getter: r => r.entryType },
    { label: 'Content', getter: r => r.content },
    { label: 'Created At', getter: r => r.createdAt?.toISOString() },
  ];

  const csv = toCsv(headers, entries);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="updates-export.csv"');
  res.send(csv);
}));

// ─── GET /validations/csv ──────────────────────────────
router.get('/validations/csv', asyncHandler(async (req, res) => {
  const where = {};
  if (req.organizationId) {
    where.farmSeason = { farmer: { organizationId: req.organizationId } };
  }
  if (req.query.status) {
    where.status = req.query.status;
  }

  const validations = await prisma.officerValidation.findMany({
    where,
    include: {
      farmSeason: {
        select: { id: true, cropType: true, farmer: { select: { id: true, fullName: true } } },
      },
    },
    orderBy: { validatedAt: 'desc' },
  });

  const headers = [
    { label: 'Validation ID', getter: r => r.id },
    { label: 'Farm Season ID', getter: r => r.farmSeasonId },
    { label: 'Crop Type', getter: r => r.farmSeason?.cropType },
    { label: 'Farmer ID', getter: r => r.farmSeason?.farmer?.id },
    { label: 'Farmer Name', getter: r => r.farmSeason?.farmer?.fullName },
    { label: 'Officer ID', getter: r => r.officerId },
    { label: 'Status', getter: r => r.status },
    { label: 'Notes', getter: r => r.notes },
    { label: 'Validated At', getter: r => r.validatedAt?.toISOString() },
  ];

  const csv = toCsv(headers, validations);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="validations-export.csv"');
  res.send(csv);
}));

export default router;
