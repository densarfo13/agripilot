import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database.js';
import { config } from '../../config/index.js';

export async function register({ email, password, fullName, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Only super_admin can create admin roles; default to field_officer
  const validRoles = ['field_officer', 'reviewer', 'investor_viewer'];
  const safeRole = validRoles.includes(role) ? role : 'field_officer';

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: safeRole,
    },
  });

  const token = generateToken(user);

  return {
    user: sanitizeUser(user),
    accessToken: token,
  };
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      farmerProfile: {
        select: { id: true, registrationStatus: true, fullName: true },
      },
    },
  });
  if (!user) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }

  // Federated-only accounts have no password hash
  if (!user.passwordHash) {
    const err = new Error('This account uses federated login (Google/Microsoft). Use the provider sign-in button.');
    err.statusCode = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }

  if (!user.active) {
    const err = new Error('Account deactivated');
    err.statusCode = 403;
    throw err;
  }

  // Update last login method
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginMethod: 'local' } });

  const token = generateToken(user);
  const sanitized = sanitizeUser(user);

  // Include farmer registration status for farmer-role users
  if (user.role === 'farmer' && user.farmerProfile) {
    sanitized.farmerId = user.farmerProfile.id;
    sanitized.registrationStatus = user.farmerProfile.registrationStatus;
  }

  return {
    user: sanitized,
    accessToken: token,
  };
}

function generateToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

export async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  // If user has no password (federated-only), currentPassword must be empty/null to set initial password
  if (!user.passwordHash) {
    if (currentPassword) {
      const err = new Error('This account has no password set. Leave current password empty to set one.');
      err.statusCode = 400;
      throw err;
    }
  } else {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      const err = new Error('Current password is incorrect');
      err.statusCode = 400;
      throw err;
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { message: 'Password changed successfully' };
}

export async function adminResetPassword({ targetUserId, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash },
  });

  return { message: 'Password reset successfully' };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  };
}
