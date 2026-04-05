import prisma from '../../config/database.js';
import { getRegionConfig, getStorageDefault } from '../regionConfig/service.js';
import { createNotification } from '../notifications/service.js';

/**
 * Post-Harvest Service
 * Storage guidance, storage status tracking, condition monitoring.
 * Advisory only — not a marketplace.
 */

// ─── Storage Status ─────────────────────────────────────

export async function getStorageStatus(farmerId) {
  return prisma.produceStorageStatus.findMany({
    where: { farmerId },
    orderBy: { updatedAt: 'desc' },
    include: { farmer: { select: { id: true, fullName: true, countryCode: true } } },
  });
}

export async function upsertStorageStatus(farmerId, data) {
  // Validate farmer
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

  const storageData = {
    cropType: data.cropType,
    quantityKg: data.quantityKg ? parseFloat(data.quantityKg) : null,
    harvestDate: data.harvestDate ? new Date(data.harvestDate) : null,
    storageMethod: data.storageMethod || null,
    storageCondition: data.storageCondition || 'unknown',
    readyToSell: data.readyToSell === true,
    notes: data.notes || null,
    metadata: data.metadata || null,
  };

  const existing = await prisma.produceStorageStatus.findFirst({
    where: { farmerId, cropType: data.cropType },
  });

  let result;
  if (existing) {
    result = await prisma.produceStorageStatus.update({
      where: { id: existing.id },
      data: storageData,
    });
  } else {
    result = await prisma.produceStorageStatus.create({
      data: { farmerId, ...storageData },
    });
  }

  // Check if storage conditions warrant a notification
  await checkStorageConditions(farmerId, result, farmer);

  return result;
}

export async function getStorageStatusById(id) {
  return prisma.produceStorageStatus.findUnique({
    where: { id },
    include: { farmer: { select: { id: true, fullName: true, countryCode: true } } },
  });
}

// ─── Storage Guidance ───────────────────────────────────

export function getStorageGuidance(cropType, countryCode = 'KE') {
  const regionCfg = getRegionConfig(countryCode);
  const storageDefault = getStorageDefault(countryCode, cropType);

  const guidance = {
    maize: {
      recommendedMethod: storageDefault.method,
      maxDays: storageDefault.maxDays,
      optimalMoisture: '13%',
      tips: [
        'Dry to <13% moisture content before storage',
        'Use hermetic bags (e.g., PICS bags) to prevent weevil damage',
        'Store in a cool, dry, ventilated area away from walls',
        'Check regularly for signs of insect damage or mold',
        'Consider treating with approved grain protectants',
      ],
      risks: ['Aflatoxin contamination if moisture > 14%', 'Weevil and borer damage', 'Rodent damage'],
      country: regionCfg.country,
    },
    wheat: {
      recommendedMethod: storageDefault.method,
      maxDays: storageDefault.maxDays,
      optimalMoisture: '12%',
      tips: [
        'Ensure moisture content below 12% before storage',
        'Use phosphine fumigation if pest levels are high',
        'Monitor temperature regularly — should be below 25°C',
        'Use metal silos or hermetic storage where available',
      ],
      risks: ['Rust contamination if stored wet', 'Grain weevil damage'],
      country: regionCfg.country,
    },
    rice: {
      recommendedMethod: storageDefault.method,
      maxDays: storageDefault.maxDays,
      optimalMoisture: '14%',
      tips: [
        'Dry paddy to 14% moisture content',
        'Clean and grade before storage',
        'Use airtight containers or hermetic bags',
        'Store away from walls and floor on pallets',
      ],
      risks: ['Grain moth damage', 'Quality loss if moisture too high'],
      country: regionCfg.country,
    },
    coffee: {
      recommendedMethod: storageDefault.method,
      maxDays: storageDefault.maxDays,
      optimalMoisture: '11%',
      tips: [
        'Store parchment coffee in cool, dry place',
        'Keep away from strong odors — coffee absorbs smells',
        'Monitor humidity levels — ideal below 60%',
        'Grade and sort before storage for better prices',
      ],
      risks: ['Flavor degradation from moisture', 'Mold if humidity is high'],
      country: regionCfg.country,
    },
    cashew: {
      recommendedMethod: 'warehouse',
      maxDays: 365,
      optimalMoisture: '8%',
      tips: [
        'Dry raw cashew nuts to <8% moisture',
        'Store in jute bags in well-ventilated warehouse',
        'Keep away from moisture and direct sunlight',
        'Grade by size for better market prices',
      ],
      risks: ['Shell oil degradation', 'Fungal contamination'],
      country: regionCfg.country,
    },
    tea: {
      recommendedMethod: storageDefault.method,
      maxDays: storageDefault.maxDays,
      optimalMoisture: '3-5%',
      tips: [
        'Store in airtight containers',
        'Keep away from moisture, light, and strong odors',
        'Maintain consistent temperature',
        'Deliver to factory promptly for best green leaf quality',
      ],
      risks: ['Oxidation from air exposure', 'Quality loss from moisture'],
      country: regionCfg.country,
    },
  };

  const result = guidance[cropType?.toLowerCase()] || {
    recommendedMethod: 'warehouse',
    maxDays: 90,
    optimalMoisture: 'varies',
    tips: [
      'Dry produce adequately before storage',
      'Protect from pests and moisture',
      'Monitor regularly for condition changes',
      'Store in clean, dry area',
    ],
    risks: ['Pest damage', 'Moisture-related spoilage'],
    country: regionCfg.country,
  };

  result.cropType = cropType;
  result.currency = regionCfg.currencyCode;
  return result;
}

// ─── Storage Dashboard ──────────────────────────────────

export async function getStorageDashboard(farmerId) {
  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
  if (!farmer) {
    const err = new Error('Farmer not found');
    err.statusCode = 404;
    throw err;
  }

  const items = await prisma.produceStorageStatus.findMany({
    where: { farmerId },
    orderBy: { updatedAt: 'desc' },
  });

  const regionCfg = getRegionConfig(farmer.countryCode || 'KE');

  const summary = {
    totalItems: items.length,
    totalQuantityKg: items.reduce((sum, i) => sum + (i.quantityKg || 0), 0),
    readyToSell: items.filter(i => i.readyToSell).length,
    conditionBreakdown: {},
    items: items.map(item => {
      const storageDefault = getStorageDefault(farmer.countryCode, item.cropType);
      const daysSinceHarvest = item.harvestDate
        ? Math.floor((Date.now() - new Date(item.harvestDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const isOverStorageLimit = daysSinceHarvest !== null && daysSinceHarvest > storageDefault.maxDays;

      return {
        ...item,
        daysSinceHarvest,
        maxRecommendedDays: storageDefault.maxDays,
        isOverStorageLimit,
        recommendedMethod: storageDefault.method,
      };
    }),
    currency: regionCfg.currencyCode,
    country: regionCfg.country,
  };

  // Condition breakdown
  for (const item of items) {
    summary.conditionBreakdown[item.storageCondition] = (summary.conditionBreakdown[item.storageCondition] || 0) + 1;
  }

  return summary;
}

// ─── Helpers ────────────────────────────────────────────

async function checkStorageConditions(farmerId, storageStatus, farmer) {
  // If condition is poor or deteriorating, notify farmer
  if (['poor', 'deteriorating'].includes(storageStatus.storageCondition)) {
    try {
      await createNotification(farmerId, {
        notificationType: 'post_harvest',
        title: `Storage alert: ${storageStatus.cropType}`,
        message: `Your ${storageStatus.cropType} storage condition is ${storageStatus.storageCondition}. Consider selling soon or improving storage conditions.`,
        metadata: { storageStatusId: storageStatus.id, cropType: storageStatus.cropType },
      });
    } catch (e) {
      console.error('Failed to create storage notification:', e.message);
    }
  }

  // If harvest date is old, warn about quality loss
  if (storageStatus.harvestDate) {
    const daysSince = Math.floor((Date.now() - new Date(storageStatus.harvestDate).getTime()) / (1000 * 60 * 60 * 24));
    const storageDefault = getStorageDefault(farmer.countryCode, storageStatus.cropType);
    if (daysSince > storageDefault.maxDays * 0.8) {
      try {
        await createNotification(farmerId, {
          notificationType: 'post_harvest',
          title: `Storage duration warning: ${storageStatus.cropType}`,
          message: `Your ${storageStatus.cropType} has been in storage for ${daysSince} days (recommended max: ${storageDefault.maxDays}). Consider selling to avoid quality loss.`,
          metadata: { storageStatusId: storageStatus.id, daysSince },
        });
      } catch (e) {
        console.error('Failed to create duration notification:', e.message);
      }
    }
  }
}
