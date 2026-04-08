/**
 * Trust & Risk Routes
 *
 * GET /api/trust/seasons/:seasonId   — season trust score
 * GET /api/trust/farmers/:farmerId   — farmer trust summary
 * GET /api/risk/seasons/:seasonId    — season risk assessment
 * GET /api/risk/farmers/:farmerId    — farmer risk assessment
 *
 * Permission matrix:
 *   super_admin         — all records
 *   institutional_admin — own-org records
 *   field_officer       — own assigned farmers / seasons
 *   reviewer            — any within org (read-only)
 *   investor_viewer     — summary-only (no raw reasons)
 *   farmer              — own records only, simplified output
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization, verifyOrgAccess } from '../../middleware/orgScope.js';
import { validateParamUUID } from '../../middleware/validate.js';
import { computeSeasonTrust, computeFarmerTrust } from './service.js';
import { computeSeasonRisk, computeFarmerRisk } from '../risk/service.js';
import prisma from '../../config/database.js';

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

// ─── GET /api/trust/seasons/:seasonId ─────────────────────

router.get('/seasons/:seasonId',
  validateParamUUID('seasonId'),
  authorize('super_admin', 'institutional_admin', 'field_officer', 'reviewer', 'investor_viewer', 'farmer'),
  asyncHandler(async (req, res) => {
    const { seasonId } = req.params;

    // Verify org access and farmer ownership for farmers
    const season = await prisma.farmSeason.findUnique({
      where: { id: seasonId },
      select: { id: true, farmer: { select: { id: true, organizationId: true, userId: true } } },
    });
    if (!season) return res.status(404).json({ error: 'Season not found' });

    // Farmer: only own season
    if (req.user.role === 'farmer') {
      if (season.farmer.userId !== req.user.sub) {
        return res.status(403).json({ error: 'Access denied — not your season' });
      }
    } else {
      // Org-scoped staff
      if (!req.isCrossOrg && season.farmer.organizationId !== req.organizationId) {
        return res.status(403).json({ error: 'Access denied — season outside your organization' });
      }
    }

    const trust = await computeSeasonTrust(seasonId);

    // investor_viewer and farmer get a simplified view
    if (req.user.role === 'investor_viewer' || req.user.role === 'farmer') {
      return res.json({
        trustScore: trust.trustScore,
        trustLevel: trust.trustLevel,
        trustUpdatedAt: trust.trustUpdatedAt,
      });
    }

    res.json(trust);
  }));

// ─── GET /api/trust/farmers/:farmerId ─────────────────────

router.get('/farmers/:farmerId',
  validateParamUUID('farmerId'),
  authorize('super_admin', 'institutional_admin', 'field_officer', 'reviewer', 'investor_viewer', 'farmer'),
  asyncHandler(async (req, res) => {
    const { farmerId } = req.params;

    const farmer = await prisma.farmer.findUnique({
      where: { id: farmerId },
      select: { id: true, organizationId: true, userId: true },
    });
    if (!farmer) return res.status(404).json({ error: 'Farmer not found' });

    // Farmer: only own profile
    if (req.user.role === 'farmer') {
      if (farmer.userId !== req.user.sub) {
        return res.status(403).json({ error: 'Access denied — not your profile' });
      }
    } else {
      if (!req.isCrossOrg && farmer.organizationId !== req.organizationId) {
        return res.status(403).json({ error: 'Access denied — farmer outside your organization' });
      }
    }

    const trust = await computeFarmerTrust(farmerId);

    if (req.user.role === 'investor_viewer' || req.user.role === 'farmer') {
      return res.json({
        trustScore: trust.trustScore,
        trustLevel: trust.trustLevel,
        trustUpdatedAt: trust.trustUpdatedAt,
      });
    }

    res.json(trust);
  }));

// ─── GET /api/risk/seasons/:seasonId ──────────────────────
// Exported as sub-path from this router for simplicity

router.get('/risk/seasons/:seasonId',
  validateParamUUID('seasonId'),
  authorize('super_admin', 'institutional_admin', 'field_officer', 'reviewer'),
  asyncHandler(async (req, res) => {
    const { seasonId } = req.params;

    const season = await prisma.farmSeason.findUnique({
      where: { id: seasonId },
      select: { id: true, farmer: { select: { id: true, organizationId: true } } },
    });
    if (!season) return res.status(404).json({ error: 'Season not found' });

    if (!req.isCrossOrg && season.farmer.organizationId !== req.organizationId) {
      return res.status(403).json({ error: 'Access denied — season outside your organization' });
    }

    const risk = await computeSeasonRisk(seasonId);
    res.json(risk);
  }));

// ─── GET /api/risk/farmers/:farmerId ──────────────────────

router.get('/risk/farmers/:farmerId',
  validateParamUUID('farmerId'),
  authorize('super_admin', 'institutional_admin', 'field_officer', 'reviewer'),
  asyncHandler(async (req, res) => {
    const { farmerId } = req.params;

    const farmer = await prisma.farmer.findUnique({
      where: { id: farmerId },
      select: { id: true, organizationId: true },
    });
    if (!farmer) return res.status(404).json({ error: 'Farmer not found' });

    if (!req.isCrossOrg && farmer.organizationId !== req.organizationId) {
      return res.status(403).json({ error: 'Access denied — farmer outside your organization' });
    }

    const risk = await computeFarmerRisk(farmerId);
    res.json(risk);
  }));

export default router;
