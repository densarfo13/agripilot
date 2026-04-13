import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { writeAuditLog } from '../lib/audit.js';

const router = express.Router();

const VALID_UNITS = ['kg', 'bags', 'tonnes', 'crates'];

// ─── Farmer: GET own supply readiness ───────────────────
router.get('/mine', authenticate, async (req, res) => {
  try {
    const profile = await prisma.farmProfile.findFirst({
      where: { userId: req.user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!profile) return res.json({ success: true, supply: null });

    const supply = await prisma.v2SupplyReadiness.findFirst({
      where: { profileId: profile.id, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({ success: true, supply });
  } catch (error) {
    console.error('GET /api/v2/supply-readiness/mine failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load supply readiness' });
  }
});

// ─── Farmer: POST create/update supply readiness ────────
router.post('/mine', authenticate, async (req, res) => {
  try {
    const { readyToSell, estimatedQuantity, quantityUnit, expectedHarvestDate, priceExpectation, currency, qualityNotes } = req.body;

    if (typeof readyToSell !== 'boolean') {
      return res.status(400).json({ success: false, error: 'readyToSell must be true or false' });
    }

    if (quantityUnit && !VALID_UNITS.includes(quantityUnit)) {
      return res.status(400).json({ success: false, error: `quantityUnit must be one of: ${VALID_UNITS.join(', ')}` });
    }

    const parsedDate = expectedHarvestDate ? new Date(expectedHarvestDate) : null;
    if (parsedDate && isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid expected harvest date' });
    }

    const profile = await prisma.farmProfile.findFirst({
      where: { userId: req.user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, crop: true },
    });
    if (!profile) {
      return res.status(400).json({ success: false, error: 'Complete your farm profile first' });
    }

    const crop = profile.crop || 'unknown';

    // Upsert: update existing active record for this crop, or create new
    const existing = await prisma.v2SupplyReadiness.findFirst({
      where: { profileId: profile.id, crop, status: 'active' },
    });

    let supply;
    if (existing) {
      supply = await prisma.v2SupplyReadiness.update({
        where: { id: existing.id },
        data: {
          readyToSell,
          estimatedQuantity: estimatedQuantity != null ? Number(estimatedQuantity) : null,
          quantityUnit: quantityUnit || 'kg',
          expectedHarvestDate: parsedDate,
          priceExpectation: priceExpectation != null ? Number(priceExpectation) : null,
          currency: currency || 'GHS',
          qualityNotes: qualityNotes || null,
        },
      });
    } else {
      supply = await prisma.v2SupplyReadiness.create({
        data: {
          profileId: profile.id,
          readyToSell,
          crop,
          estimatedQuantity: estimatedQuantity != null ? Number(estimatedQuantity) : null,
          quantityUnit: quantityUnit || 'kg',
          expectedHarvestDate: parsedDate,
          priceExpectation: priceExpectation != null ? Number(priceExpectation) : null,
          currency: currency || 'GHS',
          qualityNotes: qualityNotes || null,
        },
      });
    }

    await writeAuditLog(req, {
      userId: req.user.id,
      action: existing ? 'supply_readiness.updated' : 'supply_readiness.created',
      entityType: 'V2SupplyReadiness',
      entityId: supply.id,
      metadata: { readyToSell, crop },
    });

    return res.json({ success: true, supply });
  } catch (error) {
    console.error('POST /api/v2/supply-readiness/mine failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to save supply readiness' });
  }
});

// ─── Admin: GET list of sale-ready supply ───────────────
// This route uses V1 auth middleware imported separately
// We'll handle admin auth inline since V2 cookie auth doesn't carry role
router.get('/admin/list', authenticate, async (req, res) => {
  try {
    const { crop, readyOnly } = req.query;

    const where = { status: { in: ['active', 'connected'] } };
    if (readyOnly === 'true') where.readyToSell = true;
    if (crop) where.crop = crop;

    const records = await prisma.v2SupplyReadiness.findMany({
      where,
      include: {
        profile: {
          select: {
            id: true, farmerUuid: true, farmerName: true, farmName: true,
            crop: true, locationName: true, country: true,
            latitude: true, longitude: true, farmSizeAcres: true,
            landBoundaries: { select: { id: true }, take: 1 },
            seedScans: { select: { id: true, authenticity: true }, take: 1 },
          },
        },
        buyerLinks: {
          select: {
            id: true, status: true, linkedAt: true,
            buyer: { select: { id: true, buyerName: true, companyName: true } },
          },
          orderBy: { linkedAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { expectedHarvestDate: 'asc' },
    });

    // Enrich with simple trust signals
    const enriched = records.map((r) => {
      const p = r.profile;
      const profileComplete = !!(p.farmerName && p.crop && p.locationName && p.latitude);
      const landMapped = (p.landBoundaries?.length || 0) > 0;
      const seedRecorded = (p.seedScans?.length || 0) > 0;
      const seedOk = p.seedScans?.[0]?.authenticity === 'verified';

      let trustLevel = 'low';
      let trustLabel = 'Incomplete profile';
      if (profileComplete) {
        trustLevel = 'medium';
        trustLabel = 'Profile complete';
      }
      if (profileComplete && landMapped) {
        trustLevel = 'good';
        trustLabel = 'Verified location';
      }
      if (profileComplete && landMapped && seedOk) {
        trustLevel = 'high';
        trustLabel = 'Fully verified';
      }

      return {
        id: r.id,
        readyToSell: r.readyToSell,
        crop: r.crop,
        estimatedQuantity: r.estimatedQuantity,
        quantityUnit: r.quantityUnit,
        expectedHarvestDate: r.expectedHarvestDate,
        priceExpectation: r.priceExpectation,
        currency: r.currency,
        qualityNotes: r.qualityNotes,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        farmer: {
          name: p.farmerName,
          uuid: p.farmerUuid,
          farm: p.farmName,
          crop: p.crop,
          location: p.locationName,
          country: p.country,
          farmSize: p.farmSizeAcres,
        },
        trust: { level: trustLevel, label: trustLabel, profileComplete, landMapped, seedRecorded },
        buyerLinks: (r.buyerLinks || []).map((bl) => ({
          id: bl.id,
          status: bl.status,
          linkedAt: bl.linkedAt,
          buyerName: bl.buyer?.buyerName,
          buyerCompany: bl.buyer?.companyName,
        })),
      };
    });

    return res.json({ success: true, supply: enriched, total: enriched.length });
  } catch (error) {
    console.error('GET /api/v2/supply-readiness/admin/list failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load supply list' });
  }
});

// ─── Admin: POST mark as connected ──────────────────────
router.post('/admin/:id/connect', authenticate, async (req, res) => {
  try {
    const record = await prisma.v2SupplyReadiness.findUnique({ where: { id: req.params.id } });
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });

    const updated = await prisma.v2SupplyReadiness.update({
      where: { id: record.id },
      data: { status: 'connected', connectedAt: new Date(), connectedBy: req.user.id },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'supply_readiness.connected',
      entityType: 'V2SupplyReadiness',
      entityId: record.id,
      metadata: { crop: record.crop, farmerProfileId: record.profileId },
    });

    return res.json({ success: true, supply: updated });
  } catch (error) {
    console.error('POST /api/v2/supply-readiness/admin/:id/connect failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to update' });
  }
});

// ─── Admin: GET CSV export ──────────────────────────────
router.get('/admin/export.csv', authenticate, async (req, res) => {
  try {
    const where = { status: { in: ['active', 'connected'] } };
    if (req.query.readyOnly === 'true') where.readyToSell = true;

    const records = await prisma.v2SupplyReadiness.findMany({
      where,
      include: {
        profile: {
          select: {
            farmerUuid: true, farmerName: true, farmName: true,
            crop: true, locationName: true, country: true, farmSizeAcres: true,
          },
        },
      },
      orderBy: { expectedHarvestDate: 'asc' },
    });

    function esc(v) {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    const headers = [
      'Farmer ID', 'Farmer Name', 'Farm', 'Crop', 'Ready to Sell',
      'Estimated Qty', 'Unit', 'Expected Harvest', 'Price Expectation',
      'Currency', 'Location', 'Country', 'Farm Size (acres)', 'Quality Notes', 'Status',
    ];

    const rows = records.map((r) => [
      esc(r.profile?.farmerUuid), esc(r.profile?.farmerName), esc(r.profile?.farmName),
      esc(r.crop), r.readyToSell ? 'Yes' : 'No',
      esc(r.estimatedQuantity), esc(r.quantityUnit),
      r.expectedHarvestDate ? r.expectedHarvestDate.toISOString().split('T')[0] : '',
      esc(r.priceExpectation), esc(r.currency),
      esc(r.profile?.locationName), esc(r.profile?.country),
      esc(r.profile?.farmSizeAcres), esc(r.qualityNotes), esc(r.status),
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="supply-readiness.csv"');
    res.send(csv);
  } catch (error) {
    console.error('GET /api/v2/supply-readiness/admin/export.csv failed:', error);
    return res.status(500).json({ success: false, error: 'Export failed' });
  }
});

export default router;
