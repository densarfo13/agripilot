import prisma from '../../config/database.js';
import { getRegionConfig, DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';
import { createNotification } from '../notifications/service.js';

/**
 * Buyer Interest Service
 * Allows farmers to express interest in selling produce.
 * Advisory only — matches are informational, not transactional.
 * Statuses: expressed → matched → withdrawn
 */

export async function expressInterest(farmerId, data) {
  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
  if (!farmer) {
    const err = new Error('Farmer not found');
    err.statusCode = 404;
    throw err;
  }

  if (!data.cropType) {
    const err = new Error('cropType is required');
    err.statusCode = 400;
    throw err;
  }

  const regionCfg = getRegionConfig(farmer.countryCode || DEFAULT_COUNTRY_CODE);

  const interest = await prisma.buyerInterest.create({
    data: {
      farmerId,
      cropType: data.cropType,
      quantityKg: data.quantityKg ? parseFloat(data.quantityKg) : null,
      preferredBuyerType: data.preferredBuyerType || null,
      priceExpectation: data.priceExpectation ? parseFloat(data.priceExpectation) : null,
      currencyCode: data.currencyCode || regionCfg.currencyCode,
      notes: data.notes || null,
      status: 'expressed',
    },
    include: { farmer: { select: { id: true, fullName: true, region: true, countryCode: true } } },
  });

  // Notify farmer
  try {
    await createNotification(farmerId, {
      notificationType: 'market',
      title: `Buyer interest registered: ${data.cropType}`,
      message: `Your interest in selling ${data.cropType}${data.quantityKg ? ` (${data.quantityKg}kg)` : ''} has been registered. You will be notified of matching opportunities.`,
      metadata: { buyerInterestId: interest.id },
    });
  } catch (e) {
    console.error('Failed to create buyer interest notification:', e.message);
  }

  return interest;
}

export async function listInterests(farmerId, filters = {}) {
  const where = { farmerId };
  if (filters.status) where.status = filters.status;
  if (filters.cropType) where.cropType = filters.cropType;

  return prisma.buyerInterest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { farmer: { select: { id: true, fullName: true, region: true } } },
  });
}

export async function updateInterestStatus(id, status) {
  const valid = ['expressed', 'matched', 'withdrawn'];
  if (!valid.includes(status)) {
    const err = new Error(`Invalid status. Must be one of: ${valid.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const interest = await prisma.buyerInterest.findUnique({ where: { id } });
  if (!interest) {
    const err = new Error('Buyer interest not found');
    err.statusCode = 404;
    throw err;
  }

  return prisma.buyerInterest.update({
    where: { id },
    data: { status },
    include: { farmer: { select: { id: true, fullName: true } } },
  });
}

export async function getInterest(id) {
  const interest = await prisma.buyerInterest.findUnique({
    where: { id },
    include: { farmer: { select: { id: true, fullName: true, region: true, phone: true, countryCode: true } } },
  });
  if (!interest) {
    const err = new Error('Buyer interest not found');
    err.statusCode = 404;
    throw err;
  }
  return interest;
}

export async function withdrawInterest(id) {
  return updateInterestStatus(id, 'withdrawn');
}

/**
 * Get aggregated demand for a crop across all active interests.
 * Used by intelligence engine and admin dashboards.
 */
export async function getCropDemandSummary(cropType, countryCode) {
  const where = { status: 'expressed' };
  if (cropType) where.cropType = cropType;
  if (countryCode) {
    where.farmer = { countryCode };
  }

  const interests = await prisma.buyerInterest.findMany({
    where,
    include: { farmer: { select: { region: true, countryCode: true } } },
  });

  const totalQuantity = interests.reduce((sum, i) => sum + (i.quantityKg || 0), 0);
  const byRegion = {};
  for (const i of interests) {
    const region = i.farmer.region || 'Unknown';
    byRegion[region] = (byRegion[region] || 0) + 1;
  }

  return {
    cropType: cropType || 'all',
    totalInterests: interests.length,
    totalQuantityKg: totalQuantity,
    byRegion,
    averagePriceExpectation: interests.length > 0
      ? interests.filter(i => i.priceExpectation).reduce((sum, i) => sum + i.priceExpectation, 0) / interests.filter(i => i.priceExpectation).length || null
      : null,
  };
}
