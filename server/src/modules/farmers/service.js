import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import prisma from '../../config/database.js';
import { normalizePhoneForStorage } from '../../utils/phoneUtils.js';
import { config } from '../../config/index.js';
import { computeLandSizeFields, fromHectares } from '../../utils/landSize.js';
import { normalizeCrop } from '../farmProfiles/service.js';

const VALID_GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];

// ─── Computed status helpers ──────────────────────────────
// These derive clean enum-style strings from raw DB fields so that
// the UI never has to re-implement derivation logic.

/**
 * Derive the farmer's access status from DB state.
 * @returns 'ACTIVE' | 'PENDING_APPROVAL' | 'NO_ACCESS' | 'DISABLED'
 */
export function computeAccessStatus(farmer) {
  if (!farmer) return 'NO_ACCESS';
  const { registrationStatus } = farmer;
  if (registrationStatus === 'disabled') return 'DISABLED';
  if (registrationStatus === 'pending_approval') return 'PENDING_APPROVAL';
  if (registrationStatus === 'rejected') return 'NO_ACCESS';
  // approved — check whether the linked account is active
  const acct = farmer.userAccount;
  if (acct?.active) return 'ACTIVE';
  return 'NO_ACCESS'; // approved but no account yet, or account deactivated
}

/**
 * Derive the farmer's invite status from DB state.
 * Self-registered farmers are always NOT_SENT (they signed up themselves).
 * @returns 'NOT_SENT' | 'LINK_GENERATED' | 'INVITE_SENT_EMAIL' | 'INVITE_SENT_PHONE' | 'ACCEPTED' | 'EXPIRED'
 */
export function computeInviteStatus(farmer) {
  if (!farmer) return 'NOT_SENT';
  if (farmer.selfRegistered) return 'NOT_SENT';
  const { inviteDeliveryStatus, inviteToken, inviteExpiresAt, userId } = farmer;
  // If the farmer has a linked account, access has been established
  if (userId) return 'ACCEPTED';
  // No account yet — check invite lifecycle
  if (inviteDeliveryStatus === 'cancelled') return 'CANCELLED';
  if (inviteToken && inviteExpiresAt && new Date() > new Date(inviteExpiresAt)) return 'EXPIRED';
  if (inviteDeliveryStatus === 'email_sent') return 'INVITE_SENT_EMAIL';
  if (inviteDeliveryStatus === 'phone_sent') return 'INVITE_SENT_PHONE';
  if (inviteDeliveryStatus === 'manual_share_ready' || inviteToken) return 'LINK_GENERATED';
  return 'NOT_SENT';
}

const INVITE_EXPIRY_DAYS = parseInt(process.env.INVITE_TOKEN_EXPIRY_DAYS || '7', 10);
function makeInviteExpiry() { const d = new Date(); d.setDate(d.getDate() + INVITE_EXPIRY_DAYS); return d; }
import { DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';
import { invalidateAuthCache } from '../../middleware/auth.js';
import { logWorkflowEvent, opsEvent } from '../../utils/opsLogger.js';

// ─── Duplicate Detection ─────────────────────────────────

/**
 * Check for potential duplicate farmers before creation.
 * Returns { hasDuplicate, duplicates[] } — warning-only, never blocks.
 * Used by staff-create and invite endpoints.
 */
export async function checkDuplicateFarmer({ phone, fullName, region, organizationId, email }) {
  const conditions = [];

  // Exact phone match (strongest signal)
  if (phone) {
    const normalizedPhone = normalizePhoneForStorage(phone);
    conditions.push({ phone: normalizedPhone });
  }

  // Exact email match (strong signal) — check via linked user account
  if (email) {
    conditions.push({
      userAccount: { email: { equals: email.toLowerCase().trim(), mode: 'insensitive' } },
    });
  }

  // Name + region match (weaker signal, warn only)
  if (fullName && region) {
    conditions.push({
      AND: [
        { fullName: { equals: fullName, mode: 'insensitive' } },
        { region: { equals: region, mode: 'insensitive' } },
      ],
    });
  }

  if (conditions.length === 0) return { hasDuplicate: false, duplicates: [] };

  const orgWhere = organizationId ? { organizationId } : {};
  const matches = await prisma.farmer.findMany({
    where: {
      ...orgWhere,
      OR: conditions,
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      region: true,
      registrationStatus: true,
      createdAt: true,
    },
    take: 5,
  });

  if (matches.length > 0) {
    logWorkflowEvent('duplicate_farmer_detected', {
      inputPhone: phone,
      inputName: fullName,
      inputRegion: region,
      matchCount: matches.length,
      matchIds: matches.map(m => m.id),
    });
  }

  return {
    hasDuplicate: matches.length > 0,
    duplicates: matches.map(m => ({
      id: m.id,
      fullName: m.fullName,
      phone: m.phone,
      region: m.region,
      status: m.registrationStatus,
      createdAt: m.createdAt,
    })),
  };
}

/**
 * Create a farmer (staff-initiated — auto-approved, not self-registered).
 * If email + password are provided, also creates a linked User account.
 */
export async function createFarmer(data, userId, organizationId) {
  const { email, password } = data;
  // Final normalization pass — route layer normalizes first, this is a safety net
  const phone = normalizePhoneForStorage(data.phone);

  // Gender validation
  if (data.gender != null && data.gender !== '') {
    data.gender = String(data.gender).toLowerCase().trim();
    if (!VALID_GENDERS.includes(data.gender)) {
      opsEvent('validation', 'gender_invalid', 'warn', { gender: data.gender, context: 'createFarmer' });
      const err = new Error(`gender must be one of: ${VALID_GENDERS.join(', ')} (or null)`);
      err.statusCode = 400;
      throw err;
    }
  }

  // Location coordinate validation
  if (data.latitude != null) {
    const lat = parseFloat(data.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      opsEvent('validation', 'coordinate_invalid', 'warn', { field: 'latitude', value: data.latitude, context: 'createFarmer' });
      const err = new Error('latitude must be between -90 and 90');
      err.statusCode = 400;
      throw err;
    }
  }
  if (data.longitude != null) {
    const lng = parseFloat(data.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      opsEvent('validation', 'coordinate_invalid', 'warn', { field: 'longitude', value: data.longitude, context: 'createFarmer' });
      const err = new Error('longitude must be between -180 and 180');
      err.statusCode = 400;
      throw err;
    }
  }
  if ((data.latitude != null) !== (data.longitude != null)) {
    opsEvent('validation', 'coordinate_invalid', 'warn', { reason: 'partial_coordinates', context: 'createFarmer' });
    const err = new Error('Both latitude and longitude must be provided together (or both omitted/null)');
    err.statusCode = 400;
    throw err;
  }

  // Normalize primaryCrop
  if (data.primaryCrop) {
    data.primaryCrop = normalizeCrop(data.primaryCrop);
  }

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

      const ls = computeLandSizeFields(data.landSizeValue ?? data.farmSizeAcres, data.landSizeUnit || 'ACRE');
      return tx.farmer.create({
        data: {
          fullName: data.fullName,
          phone,
          nationalId: data.nationalId || null,
          gender: data.gender || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          region: data.region,
          district: data.district || null,
          village: data.village || null,
          primaryCrop: data.primaryCrop || null,
          farmSizeAcres: ls.landSizeHectares != null ? fromHectares(ls.landSizeHectares, 'ACRE') : null,
          landSizeValue: ls.landSizeValue,
          landSizeUnit: ls.landSizeUnit,
          landSizeHectares: ls.landSizeHectares,
          yearsExperience: data.yearsExperience ? parseInt(data.yearsExperience) : null,
          deviceId: data.deviceId || null,
          countryCode: data.countryCode || DEFAULT_COUNTRY_CODE,
          regionCode: data.regionCode || null,
          preferredLanguage: data.preferredLanguage || 'en',
          latitude: data.latitude != null ? parseFloat(data.latitude) : null,
          longitude: data.longitude != null ? parseFloat(data.longitude) : null,
          locationSource: data.locationSource || null,
          geolocationAccuracy: data.geolocationAccuracy != null ? parseFloat(data.geolocationAccuracy) : null,
          geolocationCapturedAt: data.geolocationCapturedAt ? new Date(data.geolocationCapturedAt) : null,
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
  const ls2 = computeLandSizeFields(data.landSizeValue ?? data.farmSizeAcres, data.landSizeUnit || 'ACRE');
  const farmer = await prisma.farmer.create({
    data: {
      fullName: data.fullName,
      phone,
      nationalId: data.nationalId || null,
      gender: data.gender || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      region: data.region,
      district: data.district || null,
      village: data.village || null,
      primaryCrop: data.primaryCrop || null,
      farmSizeAcres: ls2.landSizeHectares != null ? fromHectares(ls2.landSizeHectares, 'ACRE') : null,
      landSizeValue: ls2.landSizeValue,
      landSizeUnit: ls2.landSizeUnit,
      landSizeHectares: ls2.landSizeHectares,
      yearsExperience: data.yearsExperience ? parseInt(data.yearsExperience) : null,
      deviceId: data.deviceId || null,
      countryCode: data.countryCode || DEFAULT_COUNTRY_CODE,
      regionCode: data.regionCode || null,
      preferredLanguage: data.preferredLanguage || 'en',
      latitude: data.latitude != null ? parseFloat(data.latitude) : null,
      longitude: data.longitude != null ? parseFloat(data.longitude) : null,
      locationSource: data.locationSource || null,
      geolocationAccuracy: data.geolocationAccuracy != null ? parseFloat(data.geolocationAccuracy) : null,
      geolocationCapturedAt: data.geolocationCapturedAt ? new Date(data.geolocationCapturedAt) : null,
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
        userAccount: { select: { id: true, active: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.farmer.count({ where }),
  ]);

  // Attach computed status fields so the UI doesn't have to re-derive
  const enriched = farmers.map(f => ({
    ...f,
    accessStatus: computeAccessStatus(f),
    inviteStatus: computeInviteStatus(f),
  }));

  return { farmers: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
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
  return {
    ...farmer,
    accessStatus: computeAccessStatus(farmer),
    inviteStatus: computeInviteStatus(farmer),
  };
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

  // Gender validation — normalize to lowercase, reject invalid values
  if (data.gender !== undefined && data.gender !== null && data.gender !== '') {
    data.gender = String(data.gender).toLowerCase().trim();
    if (!VALID_GENDERS.includes(data.gender)) {
      opsEvent('validation', 'gender_invalid', 'warn', { gender: data.gender, farmerId: id, context: 'updateFarmer' });
      const err = new Error(`gender must be one of: ${VALID_GENDERS.join(', ')} (or null)`);
      err.statusCode = 400;
      throw err;
    }
  }

  // Location coordinate validation
  if (data.latitude !== undefined && data.latitude !== null) {
    const lat = parseFloat(data.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      opsEvent('validation', 'coordinate_invalid', 'warn', { field: 'latitude', value: data.latitude, farmerId: id, context: 'updateFarmer' });
      const err = new Error('latitude must be between -90 and 90');
      err.statusCode = 400;
      throw err;
    }
  }
  if (data.longitude !== undefined && data.longitude !== null) {
    const lng = parseFloat(data.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      opsEvent('validation', 'coordinate_invalid', 'warn', { field: 'longitude', value: data.longitude, farmerId: id, context: 'updateFarmer' });
      const err = new Error('longitude must be between -180 and 180');
      err.statusCode = 400;
      throw err;
    }
  }
  // If one coordinate is provided, both must be provided
  const hasLat = data.latitude !== undefined && data.latitude !== null;
  const hasLng = data.longitude !== undefined && data.longitude !== null;
  if (hasLat !== hasLng) {
    opsEvent('validation', 'coordinate_invalid', 'warn', { reason: 'partial_coordinates', farmerId: id, context: 'updateFarmer' });
    const err = new Error('Both latitude and longitude must be provided together (or both omitted/null)');
    err.statusCode = 400;
    throw err;
  }

  // Normalize primaryCrop to uppercase
  if (data.primaryCrop !== undefined && data.primaryCrop !== null && data.primaryCrop !== '') {
    data.primaryCrop = normalizeCrop(data.primaryCrop);
  }

  // Compute normalized land size if relevant fields changed
  const lsUpdate = {};
  if (data.landSizeValue !== undefined || data.landSizeUnit !== undefined || data.farmSizeAcres !== undefined) {
    const ls = computeLandSizeFields(data.landSizeValue ?? data.farmSizeAcres, data.landSizeUnit || 'ACRE');
    lsUpdate.landSizeValue = ls.landSizeValue;
    lsUpdate.landSizeUnit = ls.landSizeUnit;
    lsUpdate.landSizeHectares = ls.landSizeHectares;
    // Keep legacy farmSizeAcres in sync for backward compat
    if (ls.landSizeValue != null && ls.landSizeHectares != null) {
      lsUpdate.farmSizeAcres = fromHectares(ls.landSizeHectares, 'ACRE');
    } else {
      lsUpdate.farmSizeAcres = null;
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
      ...(data.farmSizeAcres !== undefined && !lsUpdate.hasOwnProperty('farmSizeAcres') && { farmSizeAcres: data.farmSizeAcres ? parseFloat(data.farmSizeAcres) : null }),
      ...lsUpdate,
      ...(data.yearsExperience !== undefined && { yearsExperience: data.yearsExperience ? parseInt(data.yearsExperience, 10) : null }),
      ...(data.gender !== undefined && { gender: data.gender || null }),
      ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }),
      ...(data.latitude !== undefined && { latitude: data.latitude != null ? parseFloat(data.latitude) : null }),
      ...(data.longitude !== undefined && { longitude: data.longitude != null ? parseFloat(data.longitude) : null }),
      ...(data.locationSource !== undefined && { locationSource: data.locationSource || null }),
      ...(data.geolocationAccuracy !== undefined && { geolocationAccuracy: data.geolocationAccuracy != null ? parseFloat(data.geolocationAccuracy) : null }),
      ...(data.geolocationCapturedAt !== undefined && { geolocationCapturedAt: data.geolocationCapturedAt ? new Date(data.geolocationCapturedAt) : null }),
      ...(data.assignedOfficerId !== undefined && { assignedOfficerId: data.assignedOfficerId || null }),
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

// ─── Profile Image Helpers ──────────────────────────────

/**
 * Delete an old profile image file from disk (best-effort).
 * Only deletes local /uploads/ paths — ignores external URLs.
 */
export function deleteOldProfileImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
  const filename = path.basename(imageUrl);
  // Safety: only delete files with profile- prefix (our naming convention)
  if (!filename.startsWith('profile-')) return;
  const filePath = path.join(path.resolve(config.upload.dir), filename);
  try { fs.unlinkSync(filePath); } catch { /* file may already be gone */ }
}
