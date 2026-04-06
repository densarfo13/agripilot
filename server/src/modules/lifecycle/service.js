import prisma from '../../config/database.js';

/**
 * Lifecycle Stage Engine
 *
 * Computes a farmer's current lifecycle stage from their activity history.
 * Supports two modes:
 *   1. Demo/seeded: uses stored stage if stageSource === 'seeded' or 'manual'
 *   2. Production: derives stage from real activity logs
 *
 * Stage progression: pre_planting → planting → vegetative → flowering → harvest → post_harvest
 */

const STAGE_ORDER = ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'];

// Maps activity types to lifecycle stages
const ACTIVITY_STAGE_MAP = {
  planting:    'planting',
  fertilizing: 'vegetative',
  spraying:    'vegetative',
  irrigation:  'vegetative',
  weeding:     'vegetative',
  harvesting:  'harvest',
  storage:     'post_harvest',
  selling:     'post_harvest',
  other:       null, // doesn't drive stage
};

// Stage-specific reminders to generate
const STAGE_REMINDERS = {
  pre_planting: [
    { type: 'general', title: 'Prepare your land', message: 'Clear and prepare your field for planting. Remove debris and old crop residue.', daysFromNow: 3 },
    { type: 'general', title: 'Gather inputs', message: 'Purchase seeds, fertilizer, and any required chemicals before planting season begins.', daysFromNow: 7 },
    { type: 'evidence_completion', title: 'Confirm farm boundary', message: 'Ensure your farm boundary is mapped for credit applications.', daysFromNow: 5 },
    { type: 'evidence_completion', title: 'Complete farmer evidence', message: 'Upload ID documents and farm photos to strengthen your credit profile.', daysFromNow: 10 },
  ],
  planting: [
    { type: 'general', title: 'Monitor crop emergence', message: 'Check your {crop} field for germination and emergence within 7-10 days of planting.', daysFromNow: 10 },
    { type: 'fertilizing', title: 'Plan first fertilizer application', message: 'Your {crop} will need first top-dressing fertilizer in about 2 weeks.', daysFromNow: 14 },
    { type: 'farm_visit_followup', title: 'Field visit reminder', message: 'A field officer may visit to verify your {crop} planting. Keep records ready.', daysFromNow: 7 },
  ],
  vegetative: [
    { type: 'spraying', title: 'Pest and disease check', message: 'Inspect your {crop} for pests and diseases. Spray if needed.', daysFromNow: 7 },
    { type: 'weeding', title: 'Weeding reminder', message: 'Check your {crop} field for weeds. Remove them to reduce competition for nutrients.', daysFromNow: 5 },
    { type: 'irrigation', title: 'Irrigation check', message: 'Ensure your {crop} has adequate water. Check soil moisture levels.', daysFromNow: 3 },
    { type: 'general', title: 'Crop monitoring', message: 'Monitor your {crop} growth. Look for signs of nutrient deficiency or stress.', daysFromNow: 14 },
  ],
  flowering: [
    { type: 'general', title: 'Monitor crop closely', message: 'Your {crop} is at a critical stage. Watch for pest damage and ensure adequate water.', daysFromNow: 3 },
    { type: 'harvesting', title: 'Start harvest planning', message: 'Begin planning for harvest — arrange labor, storage, and transport.', daysFromNow: 14 },
    { type: 'general', title: 'Prepare drying area', message: 'Set up a clean, dry area for post-harvest drying of your {crop}.', daysFromNow: 21 },
  ],
  harvest: [
    { type: 'harvesting', title: 'Log harvest quantity', message: 'Record the quantity of {crop} you have harvested for your records and credit tracking.', daysFromNow: 1 },
    { type: 'drying_reminder', title: 'Dry your produce', message: 'Dry your {crop} to recommended moisture levels before storage to prevent spoilage.', daysFromNow: 3 },
    { type: 'storage_check', title: 'Prepare storage', message: 'Clean and prepare your storage facility. Check for pests and leaks before storing {crop}.', daysFromNow: 5 },
  ],
  post_harvest: [
    { type: 'storage_check', title: 'Inspect storage condition', message: 'Check your stored {crop} for signs of pest damage, mold, or moisture problems.', daysFromNow: 7 },
    { type: 'pest_inspection', title: 'Pest and spoilage check', message: 'Inspect your {crop} storage for weevils, borers, or other pests. Treat if necessary.', daysFromNow: 14 },
    { type: 'market_check', title: 'Check market prices', message: 'Review current market prices for {crop}. Consider selling if prices are favorable.', daysFromNow: 10 },
  ],
};

/**
 * Compute lifecycle stage from activity history.
 * Returns { stage, confidence, source, latestActivity, cropType }
 */
export async function computeStageFromActivities(farmerId) {
  // Get the most recent activities (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const activities = await prisma.farmActivity.findMany({
    where: {
      farmerId,
      activityDate: { gte: sixMonthsAgo },
    },
    orderBy: { activityDate: 'desc' },
    take: 50,
  });

  if (activities.length === 0) {
    return {
      stage: 'pre_planting',
      confidence: 'low',
      source: 'activity',
      latestActivity: null,
      cropType: null,
      reason: 'No recent activities found — defaulting to pre-planting.',
    };
  }

  // Find the most recent stage-relevant activity
  // Activities are sorted by date DESC, so first match with a mapped stage wins
  let derivedStage = 'pre_planting';
  let latestRelevant = null;
  let cropType = null;

  for (const act of activities) {
    const mappedStage = ACTIVITY_STAGE_MAP[act.activityType];
    if (mappedStage) {
      const mappedIndex = STAGE_ORDER.indexOf(mappedStage);
      const currentIndex = STAGE_ORDER.indexOf(derivedStage);
      if (mappedIndex >= currentIndex) {
        derivedStage = mappedStage;
        latestRelevant = act;
        cropType = act.cropType || cropType;
        break; // Most recent relevant activity determines stage
      }
    }
  }

  // Check for storage records too (for post_harvest detection)
  const hasRecentStorage = await prisma.produceStorageStatus.findFirst({
    where: {
      farmerId,
      updatedAt: { gte: sixMonthsAgo },
    },
  });

  if (hasRecentStorage && STAGE_ORDER.indexOf(derivedStage) < STAGE_ORDER.indexOf('post_harvest')) {
    // If there are active storage records AND we detected harvest, move to post_harvest
    if (derivedStage === 'harvest') {
      derivedStage = 'post_harvest';
    }
  }

  // Confidence based on data quality
  let confidence = 'medium';
  if (activities.length >= 5) confidence = 'high';
  if (activities.length <= 2) confidence = 'low';

  const reason = latestRelevant
    ? `Stage derived from ${latestRelevant.activityType} activity on ${new Date(latestRelevant.activityDate).toLocaleDateString()}.`
    : 'Stage derived from activity pattern analysis.';

  return {
    stage: derivedStage,
    confidence,
    source: 'activity',
    latestActivity: latestRelevant ? {
      id: latestRelevant.id,
      type: latestRelevant.activityType,
      cropType: latestRelevant.cropType,
      date: latestRelevant.activityDate,
    } : null,
    cropType,
    reason,
  };
}

/**
 * Get the current lifecycle state for a farmer.
 * If stageSource is 'seeded' or 'manual', returns stored stage.
 * Otherwise, recomputes from activities.
 */
export async function getLifecycleState(farmerId) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: {
      id: true,
      fullName: true,
      primaryCrop: true,
      currentStage: true,
      stageUpdatedAt: true,
      stageSource: true,
      stageConfidence: true,
      stageCropType: true,
      countryCode: true,
      region: true,
    },
  });

  if (!farmer) {
    const err = new Error('Farmer not found');
    err.statusCode = 404;
    throw err;
  }

  // If stage was manually set or seeded, return stored values
  if (farmer.stageSource === 'seeded' || farmer.stageSource === 'manual') {
    const stageReminders = getStageRecommendations(farmer.currentStage, farmer.stageCropType || farmer.primaryCrop);
    return {
      farmerId: farmer.id,
      farmerName: farmer.fullName,
      currentStage: farmer.currentStage,
      stageUpdatedAt: farmer.stageUpdatedAt,
      stageSource: farmer.stageSource,
      stageConfidence: farmer.stageConfidence || 'medium',
      cropType: farmer.stageCropType || farmer.primaryCrop,
      recommendations: stageReminders,
      stageIndex: STAGE_ORDER.indexOf(farmer.currentStage),
      totalStages: STAGE_ORDER.length,
      stages: STAGE_ORDER,
    };
  }

  // Production mode: compute from activities
  const computed = await computeStageFromActivities(farmerId);

  // Update stored stage if it changed
  if (computed.stage !== farmer.currentStage) {
    await prisma.farmer.update({
      where: { id: farmerId },
      data: {
        currentStage: computed.stage,
        stageUpdatedAt: new Date(),
        stageSource: 'activity',
        stageConfidence: computed.confidence,
        stageCropType: computed.cropType || farmer.primaryCrop,
      },
    });
  }

  const stageReminders = getStageRecommendations(computed.stage, computed.cropType || farmer.primaryCrop);

  return {
    farmerId: farmer.id,
    farmerName: farmer.fullName,
    currentStage: computed.stage,
    stageUpdatedAt: new Date(),
    stageSource: computed.source,
    stageConfidence: computed.confidence,
    cropType: computed.cropType || farmer.primaryCrop,
    latestActivity: computed.latestActivity,
    reason: computed.reason,
    recommendations: stageReminders,
    stageIndex: STAGE_ORDER.indexOf(computed.stage),
    totalStages: STAGE_ORDER.length,
    stages: STAGE_ORDER,
  };
}

/**
 * Force recompute lifecycle stage from activities, ignoring stored stage.
 */
export async function recomputeLifecycle(farmerId) {
  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
  if (!farmer) {
    const err = new Error('Farmer not found');
    err.statusCode = 404;
    throw err;
  }

  const computed = await computeStageFromActivities(farmerId);
  const previousStage = farmer.currentStage;

  const updated = await prisma.farmer.update({
    where: { id: farmerId },
    data: {
      currentStage: computed.stage,
      stageUpdatedAt: new Date(),
      stageSource: 'activity',
      stageConfidence: computed.confidence,
      stageCropType: computed.cropType || farmer.primaryCrop,
    },
  });

  return {
    farmerId,
    previousStage,
    currentStage: computed.stage,
    stageChanged: previousStage !== computed.stage,
    confidence: computed.confidence,
    latestActivity: computed.latestActivity,
    reason: computed.reason,
  };
}

/**
 * Generate stage-based reminders for a farmer.
 * Avoids duplicating reminders already created for the same stage.
 */
export async function generateStageReminders(farmerId, stage, cropType) {
  const templates = STAGE_REMINDERS[stage];
  if (!templates || templates.length === 0) return [];

  // Check existing reminders to avoid duplicates
  const existingReminders = await prisma.reminder.findMany({
    where: {
      farmerId,
      lifecycleStage: stage,
      completed: false,
    },
    select: { title: true },
  });
  const existingTitles = new Set(existingReminders.map(r => r.title));

  const now = new Date();
  const created = [];

  for (const tmpl of templates) {
    // Personalize message
    const message = tmpl.message.replace(/\{crop\}/g, cropType || 'crop');
    const title = tmpl.title;

    // Skip if a pending reminder with same title already exists for this stage
    if (existingTitles.has(title)) continue;

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + tmpl.daysFromNow);

    try {
      const reminder = await prisma.reminder.create({
        data: {
          farmerId,
          reminderType: tmpl.type,
          title,
          message,
          dueDate,
          lifecycleStage: stage,
          triggerSource: 'lifecycle_engine',
        },
      });
      created.push(reminder);
    } catch (e) {
      console.error('Failed to create stage reminder:', e.message);
    }
  }

  return created;
}

/**
 * Called after an activity is logged — updates stage and generates reminders if stage changed.
 */
export async function onActivityLogged(farmerId, activity) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: { currentStage: true, stageSource: true, primaryCrop: true, stageCropType: true },
  });
  if (!farmer) return null;

  // Don't override manually set or seeded stages automatically
  // But DO still compute — just don't persist unless the activity moves forward
  const mappedStage = ACTIVITY_STAGE_MAP[activity.activityType];
  if (!mappedStage) return null;

  const currentIndex = STAGE_ORDER.indexOf(farmer.currentStage);
  const newIndex = STAGE_ORDER.indexOf(mappedStage);

  // Only progress forward (or to same stage)
  if (newIndex >= currentIndex) {
    const stageChanged = mappedStage !== farmer.currentStage;
    const cropType = activity.cropType || farmer.stageCropType || farmer.primaryCrop;

    await prisma.farmer.update({
      where: { id: farmerId },
      data: {
        currentStage: mappedStage,
        stageUpdatedAt: new Date(),
        stageSource: 'activity',
        stageConfidence: 'high',
        stageCropType: cropType,
      },
    });

    // Generate stage reminders if stage changed
    if (stageChanged) {
      await generateStageReminders(farmerId, mappedStage, cropType);
    }

    return {
      previousStage: farmer.currentStage,
      currentStage: mappedStage,
      stageChanged,
      remindersGenerated: stageChanged,
    };
  }

  return null;
}

/**
 * Get next recommended actions for a given stage.
 */
function getStageRecommendations(stage, cropType) {
  const templates = STAGE_REMINDERS[stage] || [];
  return templates.map(t => ({
    type: t.type,
    title: t.title,
    message: t.message.replace(/\{crop\}/g, cropType || 'crop'),
  }));
}

/**
 * Get stage display info (for UI).
 */
export function getStageInfo(stage) {
  const info = {
    pre_planting: { label: 'Pre-Planting', color: '#6b7280', icon: 'seed', description: 'Preparing land and gathering inputs' },
    planting: { label: 'Planting', color: '#16a34a', icon: 'seedling', description: 'Seeds sown, monitoring germination' },
    vegetative: { label: 'Vegetative Growth', color: '#059669', icon: 'leaf', description: 'Active crop growth and maintenance' },
    flowering: { label: 'Flowering', color: '#d97706', icon: 'flower', description: 'Crop at reproductive stage' },
    harvest: { label: 'Harvest', color: '#ea580c', icon: 'grain', description: 'Harvesting produce' },
    post_harvest: { label: 'Post-Harvest', color: '#7c3aed', icon: 'warehouse', description: 'Storage, drying, and market preparation' },
  };
  return info[stage] || info.pre_planting;
}

export { STAGE_ORDER, ACTIVITY_STAGE_MAP, STAGE_REMINDERS };
