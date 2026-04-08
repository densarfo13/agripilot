import prisma from '../../config/database.js';

const VALID_CROPS = ['maize', 'rice', 'cassava', 'wheat'];
const VALID_STAGES = ['planting', 'growing', 'flowering', 'harvest'];
const VALID_REC_STATUSES = ['pending', 'completed', 'skipped'];

// ─── Validation helpers ────────────────────────────────

export function validateCrop(crop) {
  if (!VALID_CROPS.includes(crop)) {
    const err = new Error(`crop must be one of: ${VALID_CROPS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

export function validateStage(stage) {
  if (!VALID_STAGES.includes(stage)) {
    const err = new Error(`stage must be one of: ${VALID_STAGES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

export function validateRecStatus(status) {
  if (!VALID_REC_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_REC_STATUSES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

// ─── Farm Profile CRUD ─────────────────────────────────

export async function createFarmProfile(data, farmerId) {
  validateCrop(data.crop);
  if (data.stage) validateStage(data.stage);

  if (!data.farmerName) {
    const err = new Error('farmerName is required');
    err.statusCode = 400;
    throw err;
  }

  return prisma.farmProfile.create({
    data: {
      farmerId,
      farmerName: data.farmerName,
      farmName: data.farmName || null,
      locationName: data.locationName || null,
      latitude: data.latitude != null ? parseFloat(data.latitude) : null,
      longitude: data.longitude != null ? parseFloat(data.longitude) : null,
      crop: data.crop,
      farmSizeAcres: data.farmSizeAcres != null ? parseFloat(data.farmSizeAcres) : null,
      stage: data.stage || 'planting',
    },
    include: { recommendations: { take: 3, orderBy: { createdAt: 'desc' } } },
  });
}

export async function getFarmProfile(farmProfileId) {
  const profile = await prisma.farmProfile.findUnique({
    where: { id: farmProfileId },
    include: { recommendations: { take: 5, orderBy: { createdAt: 'desc' } } },
  });
  if (!profile) {
    const err = new Error('Farm profile not found');
    err.statusCode = 404;
    throw err;
  }
  return profile;
}

export async function listFarmProfiles(farmerId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.farmProfile.findMany({
      where: { farmerId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { recommendations: { take: 1, orderBy: { createdAt: 'desc' } } },
    }),
    prisma.farmProfile.count({ where: { farmerId } }),
  ]);
  return { items, total, page, limit };
}

export async function updateFarmProfile(farmProfileId, data) {
  if (data.crop) validateCrop(data.crop);
  if (data.stage) validateStage(data.stage);

  const updateData = {};
  if (data.farmerName !== undefined) updateData.farmerName = data.farmerName;
  if (data.farmName !== undefined) updateData.farmName = data.farmName;
  if (data.locationName !== undefined) updateData.locationName = data.locationName;
  if (data.latitude !== undefined) updateData.latitude = data.latitude != null ? parseFloat(data.latitude) : null;
  if (data.longitude !== undefined) updateData.longitude = data.longitude != null ? parseFloat(data.longitude) : null;
  if (data.crop !== undefined) updateData.crop = data.crop;
  if (data.farmSizeAcres !== undefined) updateData.farmSizeAcres = data.farmSizeAcres != null ? parseFloat(data.farmSizeAcres) : null;
  if (data.stage !== undefined) updateData.stage = data.stage;

  if (Object.keys(updateData).length === 0) {
    const err = new Error('No valid fields to update');
    err.statusCode = 400;
    throw err;
  }

  return prisma.farmProfile.update({
    where: { id: farmProfileId },
    data: updateData,
    include: { recommendations: { take: 3, orderBy: { createdAt: 'desc' } } },
  });
}

// ─── Recommendation Records ────────────────────────────

export async function createRecommendation(farmProfileId, data) {
  if (!data.title || !data.action) {
    const err = new Error('title and action are required');
    err.statusCode = 400;
    throw err;
  }
  if (data.status) validateRecStatus(data.status);

  // Verify farm profile exists
  await getFarmProfile(farmProfileId);

  return prisma.recommendationRecord.create({
    data: {
      farmProfileId,
      title: data.title,
      action: data.action,
      urgency: data.urgency || null,
      confidence: data.confidence != null ? parseFloat(data.confidence) : null,
      reason: data.reason || null,
      nextReviewDays: data.nextReviewDays != null ? parseInt(data.nextReviewDays, 10) : null,
      score: data.score != null ? parseFloat(data.score) : null,
      status: data.status || 'pending',
      farmerNote: data.farmerNote || null,
    },
  });
}

export async function listRecommendations(farmProfileId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.recommendationRecord.findMany({
      where: { farmProfileId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.recommendationRecord.count({ where: { farmProfileId } }),
  ]);
  return { items, total, page, limit };
}

export async function updateRecommendation(recommendationId, data) {
  if (data.status) validateRecStatus(data.status);

  const updateData = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.farmerNote !== undefined) updateData.farmerNote = data.farmerNote;

  if (Object.keys(updateData).length === 0) {
    const err = new Error('No valid fields to update (allowed: status, farmerNote)');
    err.statusCode = 400;
    throw err;
  }

  return prisma.recommendationRecord.update({
    where: { id: recommendationId },
    data: updateData,
  });
}

// ─── Dashboard Summary ─────────────────────────────────

export async function getDashboardSummary(farmProfileId) {
  const profile = await prisma.farmProfile.findUnique({
    where: { id: farmProfileId },
    include: {
      recommendations: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
  if (!profile) {
    const err = new Error('Farm profile not found');
    err.statusCode = 404;
    throw err;
  }

  const statusCounts = await prisma.recommendationRecord.groupBy({
    by: ['status'],
    where: { farmProfileId },
    _count: true,
  });

  return {
    profile: {
      id: profile.id,
      farmerName: profile.farmerName,
      farmName: profile.farmName,
      crop: profile.crop,
      stage: profile.stage,
      farmSizeAcres: profile.farmSizeAcres,
      locationName: profile.locationName,
    },
    latestRecommendation: profile.recommendations[0] || null,
    recentActivity: profile.recommendations.slice(0, 3),
    recommendationStats: Object.fromEntries(
      statusCounts.map(s => [s.status, s._count])
    ),
  };
}
