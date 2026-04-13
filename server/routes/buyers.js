import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { writeAuditLog } from '../lib/audit.js';

const router = express.Router();

// ─── Admin: GET list buyers ────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { crop, search } = req.query;

    const where = {};
    if (crop) {
      where.cropsInterested = { contains: crop };
    }
    if (search) {
      where.OR = [
        { buyerName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const buyers = await prisma.v2Buyer.findMany({
      where,
      include: {
        buyerLinks: {
          select: { id: true, status: true, supplyId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, buyers, total: buyers.length });
  } catch (error) {
    console.error('GET /api/v2/buyers failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load buyers' });
  }
});

// ─── Admin: GET single buyer ───────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const buyer = await prisma.v2Buyer.findUnique({
      where: { id: req.params.id },
      include: {
        buyerLinks: {
          include: {
            supply: {
              select: {
                id: true, crop: true, estimatedQuantity: true, quantityUnit: true,
                expectedHarvestDate: true, status: true, readyToSell: true,
                profile: {
                  select: { farmerName: true, farmerUuid: true, locationName: true, country: true },
                },
              },
            },
          },
          orderBy: { linkedAt: 'desc' },
        },
      },
    });

    if (!buyer) return res.status(404).json({ success: false, error: 'Buyer not found' });

    return res.json({ success: true, buyer });
  } catch (error) {
    console.error('GET /api/v2/buyers/:id failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load buyer' });
  }
});

// ─── Admin: POST create buyer ──────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { buyerName, companyName, contactName, phone, email, cropsInterested, regionsCovered, notes } = req.body;

    if (!buyerName || !buyerName.trim()) {
      return res.status(400).json({ success: false, error: 'Buyer name is required' });
    }

    const buyer = await prisma.v2Buyer.create({
      data: {
        buyerName: buyerName.trim(),
        companyName: companyName?.trim() || null,
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        cropsInterested: cropsInterested?.trim() || null,
        regionsCovered: regionsCovered?.trim() || null,
        notes: notes?.trim() || null,
        createdBy: req.user.id,
      },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'buyer.created',
      entityType: 'V2Buyer',
      entityId: buyer.id,
      metadata: { buyerName: buyer.buyerName },
    });

    return res.json({ success: true, buyer });
  } catch (error) {
    console.error('POST /api/v2/buyers failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to create buyer' });
  }
});

// ─── Admin: PUT update buyer ───────────────────────────────────
router.put('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.v2Buyer.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Buyer not found' });

    const { buyerName, companyName, contactName, phone, email, cropsInterested, regionsCovered, notes } = req.body;

    if (buyerName !== undefined && !buyerName.trim()) {
      return res.status(400).json({ success: false, error: 'Buyer name cannot be empty' });
    }

    const buyer = await prisma.v2Buyer.update({
      where: { id: req.params.id },
      data: {
        ...(buyerName !== undefined && { buyerName: buyerName.trim() }),
        ...(companyName !== undefined && { companyName: companyName?.trim() || null }),
        ...(contactName !== undefined && { contactName: contactName?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(cropsInterested !== undefined && { cropsInterested: cropsInterested?.trim() || null }),
        ...(regionsCovered !== undefined && { regionsCovered: regionsCovered?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'buyer.updated',
      entityType: 'V2Buyer',
      entityId: buyer.id,
      metadata: { buyerName: buyer.buyerName },
    });

    return res.json({ success: true, buyer });
  } catch (error) {
    console.error('PUT /api/v2/buyers/:id failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to update buyer' });
  }
});

export default router;
