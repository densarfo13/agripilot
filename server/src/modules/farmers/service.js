import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import prisma from '../../config/database.js';
import { normalizePhoneForStorage } from '../../utils/phoneUtils.js';

const INVITE_EXPIRY_DAYS = parseInt(process.env.INVITE_TOKEN_EXPIRY_DAYS || '7', 10);
function makeInviteExpiry() { const d = new Date(); d.setDate(d.getDate() + INVITE_EXPIRY_DAYS); return d; }
import { DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';
import { invalidateAuthCache } from '../../middleware/auth.js';

/**
 * Create a farmer (staff-initiated — auto-approved, not self-registered).
 * If email + password are provided, also creates a linked User account.
 */
export async function createFarmer(data, userId, organizationId) {
  const { email, password } = data;
  // Final normalization pass — route layer normalizes first, this is a safety net
  const phone = normalizePhoneForStorage(data.phone);

  // If email + password provided: validate uniqueness then create User + Farmer atomically
  if (email && password) {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      const err = new Error('Email already registered');
      err.statusCode = 409;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName: data.fullName,
          role: 'farmer',
          active: true,
          preferredLanguage: data.preferredLanguage || 'en',
          organizationId: organizationId || null,
        },
      });

      return tx.farmer.create({
        data: {
          fullName: data.fullName,
          phone,
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
          selfRegistered: false,
          registrationStatus: 'approved',
          approvedAt: new Date(),
          approvedById: userId,
          userId: newUser.id,
        },
        include: { createdBy: { select: { id: true, fullName: true, email: true } }, userAccount: { select: { id: true, email: true } } },
      });
    });
  }

  // No credentials — create farmer with an invite token so staff can share a sign-up link
  const inviteToken = randomUUID();
  const inviteExpiresAt = makeInviteExpiry();
  const farmer = await prisma.farmer.create({
    data: {
      fullName: data.fullName,
      phone,
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
      selfRegistered: false,
      registrationStatus: 'approved',
      approvedAt: new Date(),
      approvedById: userId,
      inviteToken,
      inviteExpiresAt,
      inviteChannel: 'link',
      inviteDeliveryStatus: 'manual_share_ready',
    },
    include: { createdBy: { select: { id: true, fullName: true, email: true } } },
  });
  farmer._inviteToken = inviteToken;
  farmer._inviteExpiresAt = inviteExpiresAt;
  return farmer;
}

export async function listFarmers({ page = 1, limit = 20, search, region, registrationStatus, orgScope = {} }) {
  const where = { ...orgScope };
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { nationalId: { contains: search } },
    ];
  }
  if (region) where.region = region;
  if (registrationStatus) where.registrationStatus = registrationStatus;

  const [farmers, total] = await Promise.all([
    prisma.farmer.findMany({
      where,
      include: {
        createdBy: { select: { id: true, fullName: true } },
        organization: { select: { id: true, name: true, type: true } },
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
      organization: { select: { id: true, name: true, type: true } },
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
    const allowedStr = allowed?.length ? allowed.join(', ') : 'none';
    const err = new Error(
      `Cannot change farmer status from '${farmer.registrationStatus}' to '${newStatus}'. ` +
      `Allowed transitions from '${farmer.registrationStatus}': ${allowedStr}.`
    );
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
