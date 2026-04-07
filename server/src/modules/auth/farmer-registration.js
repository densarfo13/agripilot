import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import prisma from '../../config/database.js';
import { DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';
import { isEmailConfigured, isSmsConfigured } from '../notifications/deliveryService.js';
import { normalizePhoneForStorage } from '../../utils/phoneUtils.js';

/** Invite tokens expire after this many days */
const INVITE_EXPIRY_DAYS = parseInt(process.env.INVITE_TOKEN_EXPIRY_DAYS || '7', 10);

function makeInviteExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_EXPIRY_DAYS);
  return d;
}

/**
 * Farmer self-registration.
 * Creates a User (role=farmer, active=false) and a Farmer record (pending_approval).
 * The farmer cannot access institutional pages until approved.
 */
export async function farmerSelfRegister({
  fullName,
  phone,
  email,
  password,
  countryCode,
  region,
  district,
  village,
  preferredLanguage,
  primaryCrop,
  farmSizeAcres,
}) {
  // Normalize phone before any checks or storage
  const normalizedPhone = normalizePhoneForStorage(phone);

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  // Check if phone already exists for a farmer (using normalized form)
  const existingFarmer = await prisma.farmer.findFirst({ where: { phone: normalizedPhone } });
  if (existingFarmer) {
    const err = new Error('Phone number already registered');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Transaction: create user + farmer atomically (prevents orphaned user on farmer creation failure)
  const { user, farmer } = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role: 'farmer',
        active: true, // can log in, but access is limited by role
        preferredLanguage: preferredLanguage || 'en',
      },
    });

    const newFarmer = await tx.farmer.create({
      data: {
        fullName,
        phone: normalizedPhone,
        region: region || 'Not specified',
        district: district || null,
        village: village || null,
        countryCode: countryCode || DEFAULT_COUNTRY_CODE,
        preferredLanguage: preferredLanguage || 'en',
        primaryCrop: primaryCrop || null,
        farmSizeAcres: farmSizeAcres || null,
        selfRegistered: true,
        registrationStatus: 'pending_approval',
        userId: newUser.id,
        createdById: newUser.id,
      },
    });

    return { user: newUser, farmer: newFarmer };
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
    farmer: {
      id: farmer.id,
      fullName: farmer.fullName,
      registrationStatus: farmer.registrationStatus,
    },
    message: 'Registration received. Your account is pending approval.',
  };
}

/**
 * Get pending farmer registrations (for admin/institutional staff).
 * @param {Object} orgScope - Organization filter, e.g. { organizationId: 'xxx' }
 */
export async function getPendingRegistrations(orgScope = {}) {
  return prisma.farmer.findMany({
    where: { selfRegistered: true, registrationStatus: 'pending_approval', ...orgScope },
    include: {
      userAccount: {
        select: { id: true, email: true, fullName: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get all self-registered farmers with any status (for admin view).
 * @param {Object} orgScope - Organization filter
 */
export async function getAllSelfRegistered(orgScope = {}) {
  return prisma.farmer.findMany({
    where: { selfRegistered: true, ...orgScope },
    include: {
      userAccount: {
        select: { id: true, email: true, fullName: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Approve a farmer registration.
 */
export async function approveRegistration({ farmerId, approvedById, assignedOfficerId, organizationId }) {
  // Transaction: read + status check + update atomically to prevent race conditions
  const updated = await prisma.$transaction(async (tx) => {
    const farmer = await tx.farmer.findUnique({ where: { id: farmerId } });
    if (!farmer) {
      const err = new Error('Farmer not found');
      err.statusCode = 404;
      throw err;
    }
    if (farmer.registrationStatus !== 'pending_approval') {
      const err = new Error(`Cannot approve: current status is ${farmer.registrationStatus}`);
      err.statusCode = 400;
      throw err;
    }

    const updateData = {
      registrationStatus: 'approved',
      approvedAt: new Date(),
      approvedById,
      assignedOfficerId: assignedOfficerId || null,
    };

    // Assign farmer to approver's organization if farmer has no org yet
    if (!farmer.organizationId && organizationId) {
      updateData.organizationId = organizationId;
    }

    const updatedFarmer = await tx.farmer.update({
      where: { id: farmerId },
      data: updateData,
      include: {
        userAccount: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    // Also assign the user account to the org if it exists and has no org
    if (updatedFarmer.userAccount && organizationId && !farmer.organizationId) {
      await tx.user.update({
        where: { id: updatedFarmer.userAccount.id },
        data: { organizationId },
      });
    }

    return updatedFarmer;
  });

  return updated;
}

/**
 * Reject a farmer registration.
 */
export async function rejectRegistration({ farmerId, rejectedById, rejectionReason }) {
  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
  if (!farmer) {
    const err = new Error('Farmer not found');
    err.statusCode = 404;
    throw err;
  }
  if (farmer.registrationStatus !== 'pending_approval') {
    const err = new Error(`Cannot reject: current status is ${farmer.registrationStatus}`);
    err.statusCode = 400;
    throw err;
  }

  // Transaction: reject farmer + deactivate user atomically
  const updated = await prisma.$transaction(async (tx) => {
    const rejected = await tx.farmer.update({
      where: { id: farmerId },
      data: {
        registrationStatus: 'rejected',
        rejectedAt: new Date(),
        rejectionReason: rejectionReason || null,
      },
    });

    // Deactivate the linked user account
    if (farmer.userId) {
      await tx.user.update({
        where: { id: farmer.userId },
        data: { active: false },
      });
    }

    return rejected;
  });

  return updated;
}

/**
 * Invite a farmer (admin or field officer only).
 * Creates a Farmer record with registrationStatus = approved and invitedAt set.
 * Does NOT create a User account — the farmer can later self-register and link.
 * Or, if email/password are provided, creates a linked User account immediately.
 */
export async function inviteFarmer({
  fullName,
  phone,
  email,
  password,
  countryCode,
  region,
  district,
  village,
  preferredLanguage,
  primaryCrop,
  farmSizeAcres,
  invitedById,
  assignedOfficerId,
  organizationId,
}) {
  // Validate required fields
  if (!fullName || !phone || !region) {
    const err = new Error('fullName, phone, and region are required');
    err.statusCode = 400;
    throw err;
  }

  // Normalize phone before duplicate check and storage
  const normalizedPhone = normalizePhoneForStorage(phone);

  // Check duplicate phone (using normalized form)
  const existingFarmer = await prisma.farmer.findFirst({ where: { phone: normalizedPhone } });
  if (existingFarmer) {
    const err = new Error('Phone number already registered');
    err.statusCode = 409;
    throw err;
  }

  // Check email uniqueness before transaction if provided
  if (email && password) {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      const err = new Error('Email already registered');
      err.statusCode = 409;
      throw err;
    }
  }

  // Generate invite token only when no login account is being created
  // (farmers with credentials don't need a token — they have email+password)
  const needsToken = !(email && password);
  const inviteToken = needsToken ? randomUUID() : null;
  const inviteExpiresAt = needsToken ? makeInviteExpiry() : null;
  // Honest delivery status: manual_share_ready since no email/SMS is configured
  const inviteDeliveryStatus = needsToken ? 'manual_share_ready' : null;
  const inviteChannel = needsToken ? 'link' : null;

  // Transaction: create user (if needed) + farmer atomically
  const farmer = await prisma.$transaction(async (tx) => {
    let userId = null;

    if (email && password) {
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName,
          role: 'farmer',
          active: true,
          preferredLanguage: preferredLanguage || 'en',
          organizationId: organizationId || null,
        },
      });
      userId = user.id;
    }

    return tx.farmer.create({
      data: {
        fullName,
        phone: normalizedPhone,
        region,
        district: district || null,
        village: village || null,
        countryCode: countryCode || DEFAULT_COUNTRY_CODE,
        preferredLanguage: preferredLanguage || 'en',
        primaryCrop: primaryCrop || null,
        farmSizeAcres: farmSizeAcres ? parseFloat(farmSizeAcres) : null,
        selfRegistered: false,
        registrationStatus: 'approved', // invited farmers are pre-approved
        invitedAt: new Date(),
        approvedAt: new Date(),
        approvedById: invitedById,
        assignedOfficerId: assignedOfficerId || null,
        userId: userId,
        inviteToken: inviteToken,
        inviteExpiresAt: inviteExpiresAt,
        inviteChannel: inviteChannel,
        inviteDeliveryStatus: inviteDeliveryStatus,
        organizationId: organizationId || null,
        createdById: invitedById,
      },
      include: {
        userAccount: userId ? {
          select: { id: true, email: true, fullName: true },
        } : false,
      },
    });
  });

  // Attach invite token to returned object so the route can include it in the response
  farmer._inviteToken = inviteToken;
  return farmer;
}

/**
 * Get farmer profile for a logged-in farmer user.
 */
export async function getFarmerProfile(userId) {
  const farmer = await prisma.farmer.findUnique({
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
  return farmer;
}
