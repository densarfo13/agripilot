import prisma from '../../config/database.js';
import { DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';

/**
 * Create a farmer (staff-initiated — auto-approved, not self-registered).
 */
export async function createFarmer(data, userId) {
  return prisma.farmer.create({
    data: {
      fullName: data.fullName,
      phone: data.phone,
      nationalId: data.nationalId || null,
      region: data.region,
      district: data.district || null,
      village: data.village || null,
      primaryCrop: data.primaryCrop || null,
      farmSizeAcres: data.farmSizeAcres ? parseFloat(data.farmSizeAcres) : null,
      yearsExperience: data.yearsExperience ? parseInt(data.yearsExperience) : null,
      deviceId: data.deviceId || null,
      countryCode: data.countryCode || DEFAULT_COUNTRY_CODE,
      regionCode: data.regionCode || null,
      preferredLanguage: data.preferredLanguage || 'en',
      createdById: userId,
      // Staff-created farmers are auto-approved
      selfRegistered: false,
      registrationStatus: 'approved',
      approvedAt: new Date(),
      approvedById: userId,
    },
    include: { createdBy: { select: { id: true, fullName: true, email: true } } },
  });
}

export async function listFarmers({ page = 1, limit = 20, search, region }) {
  const where = {};
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { nationalId: { contains: search } },
    ];
  }
  if (region) where.region = region;

  const [farmers, total] = await Promise.all([
    prisma.farmer.findMany({
      where,
      include: {
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.farmer.count({ where }),
  ]);

  return { farmers, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getFarmerById(id) {
  const farmer = await prisma.farmer.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, fullName: true, email: true } },
      applications: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, cropType: true, requestedAmount: true, createdAt: true },
      },
    },
  });
  if (!farmer) {
    const err = new Error('Farmer not found');
    err.statusCode = 404;
    throw err;
  }
  return farmer;
}

/**
 * Get farmer profile for a logged-in farmer user (via userId).
 * Returns registration status, applications, and unread notifications.
 */
export async function getMyFarmerProfile(userId) {
  return prisma.farmer.findUnique({
    where: { userId },
    include: {
      applications: {
        select: { id: true, status: true, cropType: true, requestedAmount: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      notifications: {
        where: { read: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
}

export async function updateFarmer(id, data) {
  await getFarmerById(id); // ensure exists

  // Validate numeric fields
  if (data.farmSizeAcres !== undefined && data.farmSizeAcres !== null && data.farmSizeAcres !== '') {
    const val = parseFloat(data.farmSizeAcres);
    if (isNaN(val) || val < 0) {
      const err = new Error('farmSizeAcres must be a non-negative number');
      err.statusCode = 400;
      throw err;
    }
  }
  if (data.yearsExperience !== undefined && data.yearsExperience !== null && data.yearsExperience !== '') {
    const val = parseInt(data.yearsExperience, 10);
    if (isNaN(val) || val < 0) {
      const err = new Error('yearsExperience must be a non-negative integer');
      err.statusCode = 400;
      throw err;
    }
  }

  return prisma.farmer.update({
    where: { id },
    data: {
      ...(data.fullName && { fullName: data.fullName }),
      ...(data.phone && { phone: data.phone }),
      ...(data.nationalId !== undefined && { nationalId: data.nationalId }),
      ...(data.region && { region: data.region }),
      ...(data.district !== undefined && { district: data.district }),
      ...(data.village !== undefined && { village: data.village }),
      ...(data.primaryCrop !== undefined && { primaryCrop: data.primaryCrop }),
      ...(data.farmSizeAcres !== undefined && { farmSizeAcres: data.farmSizeAcres ? parseFloat(data.farmSizeAcres) : null }),
      ...(data.yearsExperience !== undefined && { yearsExperience: data.yearsExperience ? parseInt(data.yearsExperience, 10) : null }),
    },
  });
}

export async function deleteFarmer(id) {
  await getFarmerById(id);
  // Check for applications
  const appCount = await prisma.application.count({ where: { farmerId: id } });
  if (appCount > 0) {
    const err = new Error('Cannot delete farmer with existing applications');
    err.statusCode = 409;
    throw err;
  }
  return prisma.farmer.delete({ where: { id } });
}
