import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { writeAuditLog } from '../lib/audit.js';

const router = express.Router();

// ─── GET / — list seed scans for current user's profile ──────────
router.get('/', authenticate, async (req, res) => {
  try {
    // Support explicit ?farmId= for farm-scoped queries
    const farmId = req.query.farmId || null;
    let profile;
    if (farmId) {
      profile = await prisma.farmProfile.findFirst({
        where: { id: farmId, userId: req.user.id },
        select: { id: true },
      });
    } else {
      profile = await prisma.farmProfile.findFirst({
        where: { userId: req.user.id, isDefault: true, status: 'active' },
        select: { id: true },
      });
      if (!profile) {
        profile = await prisma.farmProfile.findFirst({
          where: { userId: req.user.id, status: 'active' },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
      }
    }
    if (!profile) return res.json({ success: true, scans: [] });

    const scans = await prisma.v2SeedScan.findMany({
      where: { profileId: profile.id },
      orderBy: { scannedAt: 'desc' },
    });

    return res.json({ success: true, scans });
  } catch (error) {
    console.error('GET /api/v2/seed-scans failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load seed scans' });
  }
});

// ─── POST / — record a new seed scan ────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { scanMethod, seedType, variety, supplier, batchNumber, expiryDate, rawScanData } = req.body;

    // Validate scanMethod
    const validMethods = ['qr', 'barcode', 'manual'];
    if (!scanMethod || !validMethods.includes(scanMethod)) {
      return res.status(400).json({ success: false, error: 'scanMethod must be one of: qr, barcode, manual' });
    }

    // At least seedType or rawScanData required
    if (!seedType && !rawScanData) {
      return res.status(400).json({ success: false, error: 'Either seedType or rawScanData is required' });
    }

    const profile = await prisma.farmProfile.findFirst({
      where: { userId: req.user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!profile) {
      return res.status(400).json({ success: false, error: 'Complete your farm profile first' });
    }

    // Determine initial authenticity — placeholder logic
    // In production this would call a seed verification service
    let authenticity = 'unknown';
    let authenticityMsg = null;

    if (rawScanData && scanMethod !== 'manual') {
      // If scan data looks like a known format, mark as pending verification
      authenticity = 'unknown';
      authenticityMsg = 'Scan recorded. Verification pending.';
    }

    const parsedExpiry = expiryDate ? new Date(expiryDate) : null;
    if (parsedExpiry && isNaN(parsedExpiry.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid expiry date' });
    }

    // Check if expired
    if (parsedExpiry && parsedExpiry < new Date()) {
      authenticity = 'warning';
      authenticityMsg = 'Seed packet has passed its expiry date.';
    }

    const scan = await prisma.v2SeedScan.create({
      data: {
        profileId: profile.id,
        scanMethod,
        seedType: seedType || null,
        variety: variety || null,
        supplier: supplier || null,
        batchNumber: batchNumber || null,
        expiryDate: parsedExpiry,
        rawScanData: rawScanData || null,
        authenticity,
        authenticityMsg,
        scannedBy: req.user.id,
      },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'seed_scan.created',
      entityType: 'V2SeedScan',
      entityId: scan.id,
      metadata: { scanMethod, seedType, authenticity },
    });

    return res.status(201).json({ success: true, scan });
  } catch (error) {
    console.error('POST /api/v2/seed-scans failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to save seed scan' });
  }
});

// ─── GET /:id — single scan detail ─────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const profile = await prisma.farmProfile.findFirst({
      where: { userId: req.user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    const scan = await prisma.v2SeedScan.findFirst({
      where: { id: req.params.id, profileId: profile.id },
    });
    if (!scan) return res.status(404).json({ success: false, error: 'Scan not found' });

    return res.json({ success: true, scan });
  } catch (error) {
    console.error('GET /api/v2/seed-scans/:id failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load scan' });
  }
});

export default router;
