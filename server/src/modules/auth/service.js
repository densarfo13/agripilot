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
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const err = new Error('Invalid credentials');
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

  const token = generateToken(user);

  return {
    user: sanitizeUser(user),
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
