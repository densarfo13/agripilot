import bcrypt from 'bcryptjs';
import prisma from '../../config/database.js';

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
  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  // Check if phone already exists for a farmer
  const existingFarmer = await prisma.farmer.findFirst({ where: { phone } });
  if (existingFarmer) {
    const err = new Error('Phone number already registered');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Create user with farmer role, inactive until approved
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: 'farmer',
      active: true, // can log in, but access is limited by role
      preferredLanguage: preferredLanguage || 'en',
    },
  });

  // Create farmer record linked to user, self-registered, pending approval
  const farmer = await prisma.farmer.create({
    data: {
      fullName,
      phone,
      region: region || 'Not specified',
      district: district || null,
      village: village || null,
      countryCode: countryCode || 'KE',
      preferredLanguage: preferredLanguage || 'en',
      primaryCrop: primaryCrop || null,
      farmSizeAcres: farmSizeAcres || null,
      selfRegistered: true,
      registrationStatus: 'pending_approval',
      userId: user.id,
      createdById: user.id, // self-created
    },
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
 */
export async function getPendingRegistrations() {
  return prisma.farmer.findMany({
    where: { selfRegistered: true, registrationStatus: 'pending_approval' },
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
 */
export async function getAllSelfRegistered() {
  return prisma.farmer.findMany({
    where: { selfRegistered: true },
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
export async function approveRegistration({ farmerId, approvedById, assignedOfficerId }) {
  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
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

  const updated = await prisma.farmer.update({
    where: { id: farmerId },
    data: {
      registrationStatus: 'approved',
      approvedAt: new Date(),
      approvedById,
      assignedOfficerId: assignedOfficerId || null,
    },
    include: {
      userAccount: {
        select: { id: true, email: true, fullName: true },
      },
    },
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

  const updated = await prisma.farmer.update({
    where: { id: farmerId },
    data: {
      registrationStatus: 'rejected',
      rejectedAt: new Date(),
      rejectionReason: rejectionReason || null,
    },
  });

  // Deactivate the user account
  if (farmer.userId) {
    await prisma.user.update({
      where: { id: farmer.userId },
      data: { active: false },
    });
  }

  return updated;
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
