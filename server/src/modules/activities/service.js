import prisma from '../../config/database.js';
import { getRegionConfig, DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';
import { createNotification } from '../notifications/service.js';
import { onActivityLogged, ACTIVITY_STAGE_MAP } from '../lifecycle/service.js';

/**
 * Farm Activity Service
 * Tracks farmer daily activities: planting, spraying, fertilizing, irrigation,
 * weeding, harvesting, storage, selling, etc.
 * Crop-specific and season-aware.
 */

const ACTIVITY_VALIDATIONS = {
  planting:    { requiredFields: ['cropType'], tipKey: 'planting_tip' },
  spraying:    { requiredFields: ['cropType'], tipKey: 'spraying_tip' },
  fertilizing: { requiredFields: ['cropType'], tipKey: 'fertilizing_tip' },
  irrigation:  { requiredFields: [], tipKey: 'irrigation_tip' },
  weeding:     { requiredFields: [], tipKey: 'weeding_tip' },
  harvesting:  { requiredFields: ['cropType', 'quantity'], tipKey: 'harvesting_tip' },
  storage:     { requiredFields: ['cropType', 'quantity'], tipKey: 'storage_tip' },
  selling:     { requiredFields: ['cropType', 'quantity'], tipKey: 'selling_tip' },
  other:       { requiredFields: [], tipKey: null },
};

export async function createActivity(farmerId, data) {
  // Validate farmer exists
  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
  if (!farmer) {
    const err = new Error('Farmer not found');
    err.statusCode = 404;
    throw err;
  }

  // Validate activity type against known types
  const validTypes = Object.keys(ACTIVITY_VALIDATIONS);
  if (!validTypes.includes(data.activityType)) {
    const err = new Error(`Invalid activityType. Must be one of: ${validTypes.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const validation = ACTIVITY_VALIDATIONS[data.activityType];
  for (const field of validation.requiredFields) {
    if (!data[field]) {
      const err = new Error(`${field} is required for ${data.activityType} activity`);
      err.statusCode = 400;
      throw err;
    }
  }

  // Determine lifecycle stage at time of activity
  const activityStage = ACTIVITY_STAGE_MAP[data.activityType] || null;

  const activity = await prisma.farmActivity.create({
    data: {
      farmerId,
      activityType: data.activityType,
      cropType: data.cropType || null,
      description: data.description || null,
      quantity: data.quantity ? parseFloat(data.quantity) : null,
      unit: data.unit || null,
      lifecycleStage: activityStage,
      metadata: data.metadata || null,
      activityDate: data.activityDate ? new Date(data.activityDate) : new Date(),
    },
    include: { farmer: { select: { id: true, fullName: true } } },
  });

  // Auto-generate reminders based on activity type
  await generateFollowUpReminders(farmerId, activity, farmer);

  // Update lifecycle stage
  const stageUpdate = await onActivityLogged(farmerId, activity).catch(() => null);
  activity.stageUpdate = stageUpdate;

  return activity;
}

export async function listActivities(farmerId, filters = {}) {
  const where = { farmerId };
  if (filters.type) where.activityType = filters.type;
  if (filters.cropType) where.cropType = filters.cropType;
  if (filters.from || filters.to) {
    where.activityDate = {};
    if (filters.from) where.activityDate.gte = new Date(filters.from);
    if (filters.to) where.activityDate.lte = new Date(filters.to);
  }

  return prisma.farmActivity.findMany({
    where,
    orderBy: { activityDate: 'desc' },
    include: { farmer: { select: { id: true, fullName: true } } },
  });
}

export async function getActivity(id) {
  return prisma.farmActivity.findUnique({ where: { id }, include: { farmer: true } });
}

export async function getActivitySummary(farmerId) {
  const activities = await prisma.farmActivity.groupBy({
    by: ['activityType'],
    where: { farmerId },
    _count: true,
  });

  const recentActivity = await prisma.farmActivity.findFirst({
    where: { farmerId },
    orderBy: { activityDate: 'desc' },
    select: { activityType: true, cropType: true, activityDate: true },
  });

  const thisMonth = await prisma.farmActivity.count({
    where: {
      farmerId,
      activityDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    },
  });

  const recentActivities = await prisma.farmActivity.findMany({
    where: { farmerId },
    orderBy: { activityDate: 'desc' },
    take: 5,
    select: { id: true, activityType: true, cropType: true, activityDate: true, lifecycleStage: true },
  });

  return {
    byType: activities,
    recentActivity,
    thisMonthCount: thisMonth,
    recentActivities,
  };
}

// ─── Auto-reminder generation ──────────────────────────

async function generateFollowUpReminders(farmerId, activity, farmer) {
  const regionCfg = getRegionConfig(farmer.countryCode || DEFAULT_COUNTRY_CODE);
  const reminders = [];

  switch (activity.activityType) {
    case 'planting': {
      // Remind to fertilize in 2 weeks
      reminders.push({
        farmerId,
        reminderType: 'fertilizing',
        title: 'Time to fertilize',
        message: `Your ${activity.cropType || 'crop'} planted on ${activity.activityDate.toLocaleDateString()} may need first fertilizer application.`,
        dueDate: addDays(activity.activityDate, 14),
      });
      // Remind to weed in 3 weeks
      reminders.push({
        farmerId,
        reminderType: 'weeding',
        title: 'Weeding check',
        message: `Check ${activity.cropType || 'crop'} field for weeds — 3 weeks since planting.`,
        dueDate: addDays(activity.activityDate, 21),
      });
      break;
    }
    case 'spraying': {
      // Re-spray reminder in 2 weeks
      reminders.push({
        farmerId,
        reminderType: 'spraying',
        title: 'Re-spray check',
        message: `Consider follow-up spray for ${activity.cropType || 'crop'} — 14 days since last application.`,
        dueDate: addDays(activity.activityDate, 14),
      });
      break;
    }
    case 'harvesting': {
      // Storage reminder
      reminders.push({
        farmerId,
        reminderType: 'storage_check',
        title: 'Storage check',
        message: `Check storage conditions for your harvested ${activity.cropType || 'produce'}. Ensure proper drying and pest protection.`,
        dueDate: addDays(activity.activityDate, 7),
      });
      // Market check reminder
      reminders.push({
        farmerId,
        reminderType: 'market_check',
        title: 'Check market prices',
        message: `Review current market prices for ${activity.cropType || 'produce'} before selling.`,
        dueDate: addDays(activity.activityDate, 3),
      });
      break;
    }
  }

  for (const r of reminders) {
    try {
      await prisma.reminder.create({ data: r });
    } catch (e) {
      console.error('Failed to create follow-up reminder:', e.message);
    }
  }
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
