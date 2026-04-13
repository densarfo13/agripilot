import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { writeAuditLog } from '../lib/audit.js';

const router = express.Router();

const VALID_STATUSES = ['buyer_linked', 'buyer_contacted', 'in_discussion', 'matched', 'closed', 'cancelled'];

// ─── Admin: GET list buyer links ───────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, supplyId, buyerId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (supplyId) where.supplyId = supplyId;
    if (buyerId) where.buyerId = buyerId;

    const links = await prisma.v2BuyerLink.findMany({
      where,
      include: {
        buyer: {
          select: { id: true, buyerName: true, companyName: true, phone: true, email: true },
        },
        supply: {
          select: {
            id: true, crop: true, estimatedQuantity: true, quantityUnit: true,
            expectedHarvestDate: true, status: true, readyToSell: true,
            priceExpectation: true, currency: true, qualityNotes: true,
            profile: {
              select: {
                farmerName: true, farmerUuid: true, farmName: true,
                locationName: true, country: true, farmSizeAcres: true,
                landBoundaries: { select: { id: true }, take: 1 },
                seedScans: { select: { id: true, authenticity: true }, take: 1 },
              },
            },
          },
        },
      },
      orderBy: { linkedAt: 'desc' },
    });

    // Enrich with trust signals
    const enriched = links.map((l) => {
      const p = l.supply?.profile;
      const profileComplete = !!(p?.farmerName && l.supply?.crop && p?.locationName);
      const landMapped = (p?.landBoundaries?.length || 0) > 0;
      const seedRecorded = (p?.seedScans?.length || 0) > 0;
      const seedOk = p?.seedScans?.[0]?.authenticity === 'verified';

      let trustLevel = 'low';
      if (profileComplete) trustLevel = 'medium';
      if (profileComplete && landMapped) trustLevel = 'good';
      if (profileComplete && landMapped && seedOk) trustLevel = 'high';

      return {
        ...l,
        trust: { level: trustLevel, profileComplete, landMapped, seedRecorded },
      };
    });

    return res.json({ success: true, links: enriched, total: enriched.length });
  } catch (error) {
    console.error('GET /api/v2/buyer-links failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load buyer links' });
  }
});

// ─── Admin: POST create buyer link ─────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { supplyId, buyerId, notes } = req.body;

    if (!supplyId || !buyerId) {
      return res.status(400).json({ success: false, error: 'supplyId and buyerId are required' });
    }

    // Verify supply exists
    const supply = await prisma.v2SupplyReadiness.findUnique({ where: { id: supplyId } });
    if (!supply) return res.status(404).json({ success: false, error: 'Supply record not found' });

    // Verify buyer exists
    const buyer = await prisma.v2Buyer.findUnique({ where: { id: buyerId } });
    if (!buyer) return res.status(404).json({ success: false, error: 'Buyer not found' });

    // Check for duplicate link
    const existing = await prisma.v2BuyerLink.findUnique({
      where: { supplyId_buyerId: { supplyId, buyerId } },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: 'This buyer is already linked to this supply record' });
    }

    const link = await prisma.v2BuyerLink.create({
      data: {
        supplyId,
        buyerId,
        linkedBy: req.user.id,
        notes: notes?.trim() || null,
        status: 'buyer_linked',
      },
    });

    // Also mark supply as connected if still active
    if (supply.status === 'active') {
      await prisma.v2SupplyReadiness.update({
        where: { id: supplyId },
        data: { status: 'connected', connectedAt: new Date(), connectedBy: req.user.id },
      });
    }

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'buyer_link.created',
      entityType: 'V2BuyerLink',
      entityId: link.id,
      metadata: { supplyId, buyerId, crop: supply.crop },
    });

    return res.json({ success: true, link });
  } catch (error) {
    console.error('POST /api/v2/buyer-links failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to create buyer link' });
  }
});

// ─── Admin: PATCH update buyer link status ─────────────────────
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const existing = await prisma.v2BuyerLink.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Buyer link not found' });

    const link = await prisma.v2BuyerLink.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'buyer_link.status_updated',
      entityType: 'V2BuyerLink',
      entityId: link.id,
      metadata: { oldStatus: existing.status, newStatus: link.status },
    });

    return res.json({ success: true, link });
  } catch (error) {
    console.error('PATCH /api/v2/buyer-links/:id failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to update buyer link' });
  }
});

// ─── Admin: GET CSV export of buyer-linked opportunities ───────
router.get('/export.csv', authenticate, async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;

    const links = await prisma.v2BuyerLink.findMany({
      where,
      include: {
        buyer: true,
        supply: {
          include: {
            profile: {
              select: {
                farmerUuid: true, farmerName: true, farmName: true,
                crop: true, locationName: true, country: true, farmSizeAcres: true,
              },
            },
          },
        },
      },
      orderBy: { linkedAt: 'desc' },
    });

    function esc(v) {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    const headers = [
      'Farmer ID', 'Farmer Name', 'Farm', 'Crop', 'Estimated Qty', 'Unit',
      'Expected Harvest', 'Price', 'Currency', 'Location', 'Country',
      'Buyer Name', 'Buyer Company', 'Buyer Contact', 'Buyer Phone', 'Buyer Email',
      'Link Status', 'Linked At', 'Notes',
    ];

    const rows = links.map((l) => [
      esc(l.supply?.profile?.farmerUuid), esc(l.supply?.profile?.farmerName), esc(l.supply?.profile?.farmName),
      esc(l.supply?.crop), esc(l.supply?.estimatedQuantity), esc(l.supply?.quantityUnit),
      l.supply?.expectedHarvestDate ? l.supply.expectedHarvestDate.toISOString().split('T')[0] : '',
      esc(l.supply?.priceExpectation), esc(l.supply?.currency),
      esc(l.supply?.profile?.locationName), esc(l.supply?.profile?.country),
      esc(l.buyer?.buyerName), esc(l.buyer?.companyName), esc(l.buyer?.contactName),
      esc(l.buyer?.phone), esc(l.buyer?.email),
      esc(l.status), l.linkedAt ? l.linkedAt.toISOString().split('T')[0] : '',
      esc(l.notes),
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="buyer-links.csv"');
    res.send(csv);
  } catch (error) {
    console.error('GET /api/v2/buyer-links/export.csv failed:', error);
    return res.status(500).json({ success: false, error: 'Export failed' });
  }
});

export default router;
