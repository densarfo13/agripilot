/**
 * Pilot Organization Setup
 *
 * Provisions a complete pilot organization with users in a single operation.
 * Intended for super_admin use only.
 *
 * Creates:
 *   - An Organization
 *   - An institutional_admin
 *   - Up to 3 field_officers
 *   - Optionally: a reviewer
 *   - Optionally: an investor_viewer
 *
 * Does NOT create farmers or seasons — those are created through normal
 * workflows after the pilot org is set up.
 */

import bcrypt from 'bcryptjs';
import prisma from '../../config/database.js';
import { writeAuditLog } from '../audit/service.js';

const VALID_ORG_TYPES = ['NGO', 'LENDER', 'COOPERATIVE', 'INVESTOR', 'DEVELOPMENT_PARTNER', 'INTERNAL'];

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    organizationId: user.organizationId,
  };
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/**
 * Provision a pilot organization with its initial staff.
 *
 * @param {object} opts
 * @param {string} opts.organizationName - Display name
 * @param {string} opts.organizationType - One of VALID_ORG_TYPES
 * @param {string} [opts.countryCode] - ISO country code (e.g., 'KE')
 * @param {object} opts.admin - { email, password, fullName }
 * @param {object[]} [opts.fieldOfficers] - Array of { email, password, fullName }
 * @param {object} [opts.reviewer] - { email, password, fullName }
 * @param {object} [opts.investorViewer] - { email, password, fullName }
 * @param {string} opts.createdByUserId - super_admin performing setup
 */
export async function setupPilotOrganization({
  organizationName,
  organizationType = 'NGO',
  countryCode = 'KE',
  admin,
  fieldOfficers = [],
  reviewer = null,
  investorViewer = null,
  createdByUserId,
}) {
  // ─── Validate inputs ──────────────────────────────────
  if (!organizationName || organizationName.trim().length < 2) {
    const err = new Error('organizationName must be at least 2 characters');
    err.statusCode = 400;
    throw err;
  }

  if (!VALID_ORG_TYPES.includes(organizationType)) {
    const err = new Error(`organizationType must be one of: ${VALID_ORG_TYPES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  if (!admin?.email || !admin?.password || !admin?.fullName) {
    const err = new Error('admin.email, admin.password, and admin.fullName are required');
    err.statusCode = 400;
    throw err;
  }

  if (fieldOfficers.length > 5) {
    const err = new Error('Maximum 5 field officers per pilot setup call');
    err.statusCode = 400;
    throw err;
  }

  // ─── Check email uniqueness upfront ───────────────────
  const allEmails = [
    admin.email,
    ...fieldOfficers.map(fo => fo.email),
    reviewer?.email,
    investorViewer?.email,
  ].filter(Boolean).map(e => e.toLowerCase().trim());

  const uniqueEmails = new Set(allEmails);
  if (uniqueEmails.size !== allEmails.length) {
    const err = new Error('Duplicate email addresses found in setup request');
    err.statusCode = 400;
    throw err;
  }

  const existingUsers = await prisma.user.findMany({
    where: { email: { in: allEmails } },
    select: { email: true },
  });

  if (existingUsers.length > 0) {
    const taken = existingUsers.map(u => u.email).join(', ');
    const err = new Error(`Email(s) already registered: ${taken}`);
    err.statusCode = 409;
    throw err;
  }

  // ─── Create organization ───────────────────────────────
  const org = await prisma.organization.create({
    data: {
      name: organizationName.trim(),
      type: organizationType,
      countryCode,
    },
  });

  const createdUsers = [];

  // ─── Create institutional_admin ───────────────────────
  const adminUser = await prisma.user.create({
    data: {
      email: admin.email.toLowerCase().trim(),
      passwordHash: await hashPassword(admin.password),
      fullName: admin.fullName.trim(),
      role: 'institutional_admin',
      organizationId: org.id,
    },
  });
  createdUsers.push(sanitizeUser(adminUser));

  // ─── Create field officers ─────────────────────────────
  for (const fo of fieldOfficers) {
    if (!fo.email || !fo.password || !fo.fullName) continue;
    const foUser = await prisma.user.create({
      data: {
        email: fo.email.toLowerCase().trim(),
        passwordHash: await hashPassword(fo.password),
        fullName: fo.fullName.trim(),
        role: 'field_officer',
        organizationId: org.id,
      },
    });
    createdUsers.push(sanitizeUser(foUser));
  }

  // ─── Create reviewer ──────────────────────────────────
  if (reviewer?.email && reviewer?.password && reviewer?.fullName) {
    const reviewerUser = await prisma.user.create({
      data: {
        email: reviewer.email.toLowerCase().trim(),
        passwordHash: await hashPassword(reviewer.password),
        fullName: reviewer.fullName.trim(),
        role: 'reviewer',
        organizationId: org.id,
      },
    });
    createdUsers.push(sanitizeUser(reviewerUser));
  }

  // ─── Create investor_viewer ────────────────────────────
  if (investorViewer?.email && investorViewer?.password && investorViewer?.fullName) {
    const viewerUser = await prisma.user.create({
      data: {
        email: investorViewer.email.toLowerCase().trim(),
        passwordHash: await hashPassword(investorViewer.password),
        fullName: investorViewer.fullName.trim(),
        role: 'investor_viewer',
        organizationId: org.id,
      },
    });
    createdUsers.push(sanitizeUser(viewerUser));
  }

  // ─── Audit log ────────────────────────────────────────
  writeAuditLog({
    userId: createdByUserId,
    organizationId: org.id,
    action: 'pilot_org_setup',
    details: {
      organizationId: org.id,
      organizationName: org.name,
      usersCreated: createdUsers.map(u => ({ id: u.id, role: u.role, email: u.email })),
    },
  }).catch(() => {});

  return {
    organization: {
      id: org.id,
      name: org.name,
      type: org.type,
      countryCode: org.countryCode,
      createdAt: org.createdAt,
    },
    users: createdUsers,
    summary: {
      totalUsersCreated: createdUsers.length,
      roles: createdUsers.map(u => u.role),
    },
    nextSteps: [
      'Log in as the institutional_admin to configure the organization',
      'Use /api/farmers to add or invite farmers',
      'Use /api/seasons to create farm seasons for farmers',
      'Monitor adoption via /api/pilot/metrics',
    ],
  };
}
