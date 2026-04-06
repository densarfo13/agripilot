import prisma from '../../config/database.js';
import { DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';
import { invalidateAuthCache } from '../../middleware/auth.js';

/**
 * Create a farmer (staff-initiated — auto-approved, not self-registered).
 */
export async function createFarmer(data, userId, organizationId) {
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
      organizationId: organizationId || null,
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

export async function listFarmers({ page = 1, limit = 20, search, region, orgScope = {} }) {
  const where = { ...orgScope };
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
      userAccount: { select: { id: true, email: true, fullName: true, active: true, lastLoginMethod: true, createdAt: true } },
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

// ─── Access & Assignment ─────────────────────────────────

/**
 * Update farmer access status (disable, reactivate, re-approve).
 * Only admins can call this.
 */
export async function updateAccessStatus(farmerId, newStatus, userId) {
  const farmer = await getFarmerById(farmerId);

  const VALID_STATUS_TRANSITIONS = {
    pending_approval: ['approved', 'rejected', 'disabled'],
    approved: ['disabled'],
    rejected: ['pending_approval', 'disabled'],
    disabled: ['pending_approval', 'approved'],
  };

  const allowed = VALID_STATUS_TRANSITIONS[farmer.registrationStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    const err = new Error(`Cannot transition from '${farmer.registrationStatus}' to '${newStatus}'`);
    err.statusCode = 400;
    throw err;
  }

  const updateData = { registrationStatus: newStatus };

  if (newStatus === 'approved') {
    updateData.approvedAt = new Date();
    updateData.approvedById = userId;
  }

  // Transaction: farmer status + user activation state atomically
  const result = await prisma.$transaction(async (tx) => {
    if (newStatus === 'disabled' && farmer.userId) {
      await tx.user.update({ where: { id: farmer.userId }, data: { active: false } });
    }
    if ((newStatus === 'approved' || newStatus === 'pending_approval') && farmer.userId) {
      await tx.user.update({ where: { id: farmer.userId }, data: { active: true } });
    }

    return tx.farmer.update({
      where: { id: farmerId },
      data: updateData,
      include: {
        userAccount: { select: { id: true, email: true, active: true } },
      },
    });
  });

  // Invalidate auth cache after successful transaction
  if (farmer.userId && ['disabled', 'approved', 'pending_approval'].includes(newStatus)) {
    invalidateAuthCache(farmer.userId);
  }

  return result;
}

/**
 * Assign or reassign a field officer to a farmer.
 */
export async function assignOfficerToFarmer(farmerId, officerId, userId) {
  await getFarmerById(farmerId);

  if (officerId) {
    const officer = await prisma.user.findUnique({ where: { id: officerId } });
    if (!officer) {
      const err = new Error('Field officer not found');
      err.statusCode = 404;
      throw err;
    }
    if (!['field_officer', 'institutional_admin', 'super_admin'].includes(officer.role)) {
      const err = new Error('User is not a field officer');
      err.statusCode = 400;
      throw err;
    }
  }

  return prisma.farmer.update({
    where: { id: farmerId },
    data: { assignedOfficerId: officerId || null },
    include: {
      createdBy: { select: { id: true, fullName: true, email: true } },
      userAccount: { select: { id: true, email: true, active: true } },
    },
  });
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
