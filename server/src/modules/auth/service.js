import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database.js';
import { config } from '../../config/index.js';

export async function register({ email, password, fullName, role, organizationId }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Validate role — reject unknown roles instead of silently downgrading
  const validRoles = ['field_officer', 'reviewer', 'investor_viewer'];
  if (!role || !validRoles.includes(role)) {
    const err = new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  const safeRole = role;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: safeRole,
      organizationId: organizationId || null,
    },
  });

  const token = generateToken(user);

  return {
    user: sanitizeUser(user),
    accessToken: token,
  };
}

/**
 * loginViaPhone — issue a session for a phone-verified farmer after
 * a successful Twilio Verify OTP check. Called from the SMS
 * verification service when `purpose === 'login_verify'`.
 *
 * Lookup order:
 *   1. Match a Farmer row by phone (the source of truth for farmer
 *      phone numbers). The farmer row carries the userId we need.
 *   2. Load the User through the farmer's userId so the sanitised
 *      shape matches what `login()` returns — same MFA gate, same
 *      organisation claim, same audit trail downstream.
 *
 * Notes:
 *   • Returns null (not throw) when no farmer owns this phone — the
 *     caller renders a safe "no account on this phone" response.
 *   • MFA is NOT re-challenged here because farmers are exempt
 *     (mfa/service.isMfaExempt('farmer')=true). If a non-farmer role
 *     ever starts using phone login, the existing isMfaRequired gate
 *     should be re-evaluated.
 *   • phoneVerifiedAt on the farmer row is stamped by the caller
 *     (sms service) as part of the same transaction intent, so we
 *     don't re-touch it here.
 */
export async function loginViaPhone({ phone }) {
  if (!phone || typeof phone !== 'string') {
    const err = new Error('phone is required');
    err.statusCode = 400;
    throw err;
  }

  const farmer = await prisma.farmer.findFirst({
    where: { phone },
    select: {
      id: true,
      userId: true,
      registrationStatus: true,
      fullName: true,
    },
  });
  if (!farmer || !farmer.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: farmer.userId },
    include: {
      farmerProfile: {
        select: { id: true, registrationStatus: true, fullName: true },
      },
      organization: {
        select: { id: true, name: true, type: true },
      },
    },
  });
  if (!user || !user.active) return null;

  // Record the login channel so audits + dashboards can distinguish
  // phone-OTP logins from password / federated.
  await prisma.user.update({
    where: { id: user.id },
    data:  { lastLoginMethod: 'phone_otp', lastLoginAt: new Date() },
  }).catch(() => { /* non-fatal */ });

  const sanitized = sanitizeUser(user);
  if (user.role === 'farmer' && user.farmerProfile) {
    sanitized.farmerId = user.farmerProfile.id;
    sanitized.registrationStatus = user.farmerProfile.registrationStatus;
  }
  sanitized.organizationId = user.organizationId || null;
  sanitized.organization   = user.organization || null;

  return { user: sanitized, accessToken: generateToken(user) };
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      farmerProfile: {
        select: { id: true, registrationStatus: true, fullName: true },
      },
      organization: {
        select: { id: true, name: true, type: true },
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

  // Update last login method and timestamp
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginMethod: 'local', lastLoginAt: new Date() } });

  const sanitized = sanitizeUser(user);

  // Include farmer registration status for farmer-role users
  if (user.role === 'farmer' && user.farmerProfile) {
    sanitized.farmerId = user.farmerProfile.id;
    sanitized.registrationStatus = user.farmerProfile.registrationStatus;
  }

  // Include organization info
  sanitized.organizationId = user.organizationId || null;
  sanitized.organization = user.organization || null;

  // ─── MFA gate ────────────────────────────────────────────
  // Import here to avoid circular dependency (mfa/service imports prisma)
  const { isMfaRequired } = await import('../mfa/service.js');

  if (isMfaRequired(user.role)) {
    if (!user.mfaEnabled) {
      // MFA required but not enrolled → return setup-required signal
      const mfaSetupToken = generateMfaChallengeToken(user);
      return {
        mfaSetupRequired: true,
        mfaToken: mfaSetupToken,
        user: { id: user.id, role: user.role, email: user.email },
      };
    }
    // MFA required and enrolled → return challenge-required signal
    const mfaChallengeToken = generateMfaChallengeToken(user);
    return {
      mfaChallengeRequired: true,
      mfaToken: mfaChallengeToken,
      user: { id: user.id, role: user.role, email: user.email },
    };
  }

  // MFA not required for this role → issue full access token immediately
  const token = generateToken(user);
  return { user: sanitized, accessToken: token };
}

/**
 * Complete MFA challenge after password login.
 * Verifies the TOTP code and issues a full access JWT with mfaVerifiedAt.
 */
export async function completeMfaChallenge({ mfaToken, totpCode }) {
  // Validate the short-lived MFA challenge token
  let payload;
  try {
    payload = jwt.verify(mfaToken, config.jwt.secret);
  } catch {
    const err = new Error('Invalid or expired MFA token. Please log in again.');
    err.statusCode = 401;
    throw err;
  }

  if (payload.purpose !== 'mfa_challenge') {
    const err = new Error('Invalid token type.');
    err.statusCode = 401;
    throw err;
  }

  const { verifyMfaCode } = await import('../mfa/service.js');
  const valid = await verifyMfaCode(payload.sub, totpCode);
  if (!valid) {
    const err = new Error('Invalid authenticator code. Please try again.');
    err.statusCode = 400;
    throw err;
  }

  // Fetch fresh user data for the full token
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, active: true, tokenVersion: true, organizationId: true, fullName: true, createdAt: true },
  });
  if (!user || !user.active) {
    const err = new Error('Account not found or deactivated.');
    err.statusCode = 403;
    throw err;
  }

  const accessToken = generateToken(user, { mfaVerifiedAt: Math.floor(Date.now() / 1000) });
  return { user: sanitizeUser(user), accessToken };
}

/**
 * Logout: bump tokenVersion to invalidate all issued JWTs for this user.
 */
export async function logout(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
  // Invalidate auth cache so the new tokenVersion takes effect immediately
  const { invalidateAuthCache } = await import('../../middleware/auth.js');
  invalidateAuthCache(userId);
}

/**
 * Step-up: re-verify MFA and return a new JWT with refreshed mfaVerifiedAt.
 */
export async function stepUpAuth({ userId, totpCode }) {
  const { verifyMfaCode } = await import('../mfa/service.js');
  const valid = await verifyMfaCode(userId, totpCode);
  if (!valid) {
    const err = new Error('Invalid authenticator code.');
    err.statusCode = 400;
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, active: true, tokenVersion: true, organizationId: true, fullName: true, createdAt: true },
  });
  if (!user || !user.active) {
    const err = new Error('Account not found or deactivated.');
    err.statusCode = 403;
    throw err;
  }

  const accessToken = generateToken(user, { mfaVerifiedAt: Math.floor(Date.now() / 1000) });
  return { accessToken };
}

function generateToken(user, extraClaims = {}) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion ?? 0,   // tokenVersion for revocation
      ...extraClaims,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

/**
 * Short-lived MFA challenge token (purpose: 'mfa_challenge').
 * Used when MFA is required but not yet verified after password login.
 * Expires in MFA_CHALLENGE_TOKEN_MINUTES (default 5 min).
 */
function generateMfaChallengeToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, purpose: 'mfa_challenge', tv: user.tokenVersion ?? 0 },
    config.jwt.secret,
    { expiresIn: `${config.mfa.challengeTokenMinutes}m` },
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

// ─── Self-service profile update (safe fields only) ────

/**
 * Let a user update their own profile.
 * Only fullName and preferredLanguage are mutable by the account owner.
 * Email and role changes require admin action.
 */
export async function updateSelfProfile({ userId, fullName, preferredLanguage }) {
  const data = {};
  if (fullName !== undefined) data.fullName = fullName.trim();
  if (preferredLanguage !== undefined) data.preferredLanguage = preferredLanguage;

  if (Object.keys(data).length === 0) {
    const err = new Error('At least one updatable field required: fullName, preferredLanguage');
    err.statusCode = 400;
    throw err;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, fullName: true, role: true, active: true, preferredLanguage: true, organizationId: true },
  });
  return user;
}

// ─── Admin-managed user profile update ─────────────────

/**
 * Admin updates another user's profile fields.
 * - institutional_admin: own-org users only, cannot touch super_admin accounts, cannot change email
 * - super_admin: any user, may also change email
 */
export async function adminUpdateUserProfile({ targetUserId, actorId, actorRole, actorOrgId, updates }) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  // Org scope enforcement for institutional_admin
  if (actorRole === 'institutional_admin') {
    if (target.organizationId !== actorOrgId) {
      const err = new Error('Cannot edit users outside your organization');
      err.statusCode = 403;
      throw err;
    }
    if (target.role === 'super_admin') {
      const err = new Error('Cannot edit super_admin accounts');
      err.statusCode = 403;
      throw err;
    }
  }

  const data = {};
  if (updates.fullName !== undefined) data.fullName = updates.fullName.trim();
  if (updates.preferredLanguage !== undefined) data.preferredLanguage = updates.preferredLanguage;

  if (updates.email !== undefined) {
    if (actorRole !== 'super_admin') {
      const err = new Error('Only super_admin can change email addresses');
      err.statusCode = 403;
      throw err;
    }
    const emailLower = updates.email.toLowerCase().trim();
    const conflict = await prisma.user.findUnique({ where: { email: emailLower } });
    if (conflict && conflict.id !== targetUserId) {
      const err = new Error('Email already in use by another account');
      err.statusCode = 409;
      throw err;
    }
    data.email = emailLower;
  }

  if (Object.keys(data).length === 0) {
    const err = new Error('No valid fields provided. Accepted: fullName, preferredLanguage, email (super_admin only)');
    err.statusCode = 400;
    throw err;
  }

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data,
    select: { id: true, email: true, fullName: true, role: true, active: true, preferredLanguage: true, organizationId: true },
  });
  return { user, previous: target };
}

// ─── Admin role change ──────────────────────────────────

// Roles that may be assigned via admin role management (farmer assigned only via registration flow)
const ASSIGNABLE_ROLES = ['super_admin', 'institutional_admin', 'reviewer', 'field_officer', 'investor_viewer'];
// Roles institutional_admin may assign (cannot elevate to privileged roles)
const INSTITUTIONAL_ASSIGNABLE_ROLES = ['reviewer', 'field_officer', 'investor_viewer'];

/**
 * Change a user's role.
 * - Cannot change own role (prevents self-escalation)
 * - super_admin: can assign any non-farmer role
 * - institutional_admin: can only assign reviewer/field_officer/investor_viewer within own org
 * - farmer role is NOT assignable via this route
 */
export async function adminChangeUserRole({ targetUserId, newRole, actorId, actorRole, actorOrgId }) {
  if (targetUserId === actorId) {
    const err = new Error('Cannot change your own role');
    err.statusCode = 403;
    throw err;
  }

  if (!ASSIGNABLE_ROLES.includes(newRole)) {
    const err = new Error(
      newRole === 'farmer'
        ? 'Cannot assign farmer role via role management. Use the farmer registration flow.'
        : `Invalid role. Assignable roles: ${ASSIGNABLE_ROLES.join(', ')}`
    );
    err.statusCode = 400;
    throw err;
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  if (actorRole === 'institutional_admin') {
    if (target.organizationId !== actorOrgId) {
      const err = new Error('Cannot change roles for users outside your organization');
      err.statusCode = 403;
      throw err;
    }
    if (target.role === 'super_admin') {
      const err = new Error('Cannot change the role of a super_admin account');
      err.statusCode = 403;
      throw err;
    }
    if (!INSTITUTIONAL_ASSIGNABLE_ROLES.includes(newRole)) {
      const err = new Error(
        `institutional_admin can only assign: ${INSTITUTIONAL_ASSIGNABLE_ROLES.join(', ')}`
      );
      err.statusCode = 403;
      throw err;
    }
  }

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
    select: { id: true, email: true, fullName: true, role: true, active: true, organizationId: true },
  });
  return { user, previousRole: target.role };
}

// ─── Admin organization reassignment ───────────────────

/**
 * Move a user to a different organization (or remove from org).
 * super_admin only — institutional_admin cannot reassign across orgs.
 * Cannot change own organization.
 */
export async function adminChangeUserOrg({ targetUserId, newOrgId, actorId }) {
  if (targetUserId === actorId) {
    const err = new Error('Cannot change your own organization');
    err.statusCode = 403;
    throw err;
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  if (newOrgId) {
    const org = await prisma.organization.findUnique({ where: { id: newOrgId } });
    if (!org) {
      const err = new Error('Organization not found');
      err.statusCode = 404;
      throw err;
    }
  }

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { organizationId: newOrgId || null },
    select: { id: true, email: true, fullName: true, role: true, active: true, organizationId: true },
  });
  return { user, previousOrgId: target.organizationId };
}

// ─── User Offboarding Services ────────────────────────────────────────────────

const USER_SELECT = { id: true, email: true, fullName: true, role: true, active: true, archivedAt: true, organizationId: true };

/**
 * Disable a user (revoke login access, preserve all history).
 * - super_admin: any non-self user
 * - institutional_admin: own-org non-super_admin users only
 */
export async function adminDisableUser({ targetUserId, actorId, actorRole, actorOrgId }) {
  if (targetUserId === actorId) {
    const err = new Error('Cannot disable your own account');
    err.statusCode = 403;
    throw err;
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: USER_SELECT });
  if (!target) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  if (!target.active) {
    const err = new Error('User is already disabled');
    err.statusCode = 409;
    throw err;
  }

  if (actorRole === 'institutional_admin') {
    if (target.role === 'super_admin') {
      const err = new Error('Institutional admins cannot disable super admin accounts');
      err.statusCode = 403;
      throw err;
    }
    if (target.organizationId !== actorOrgId) {
      const err = new Error('Cannot disable users outside your organization');
      err.statusCode = 403;
      throw err;
    }
  }

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { active: false },
    select: USER_SELECT,
  });
  return { user, previousActive: true };
}

/**
 * Re-enable a disabled user (restore login access).
 * - super_admin: any user
 * - institutional_admin: own-org non-super_admin users only
 * Cannot re-enable an archived user — must unarchive first.
 */
export async function adminEnableUser({ targetUserId, actorId, actorRole, actorOrgId }) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: USER_SELECT });
  if (!target) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  if (target.active) {
    const err = new Error('User is already active');
    err.statusCode = 409;
    throw err;
  }

  if (target.archivedAt) {
    const err = new Error('User is archived. Unarchive the account before re-enabling');
    err.statusCode = 409;
    throw err;
  }

  if (actorRole === 'institutional_admin') {
    if (target.role === 'super_admin') {
      const err = new Error('Institutional admins cannot re-enable super admin accounts');
      err.statusCode = 403;
      throw err;
    }
    if (target.organizationId !== actorOrgId) {
      const err = new Error('Cannot re-enable users outside your organization');
      err.statusCode = 403;
      throw err;
    }
  }

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { active: true },
    select: USER_SELECT,
  });
  return { user, previousActive: false };
}

/**
 * Archive a user (soft delete — super_admin only).
 * Sets active=false + archivedAt=now. Preserves all linked records.
 * Excluded from normal user list queries. Reversible via adminUnarchiveUser.
 */
export async function adminArchiveUser({ targetUserId, actorId }) {
  if (targetUserId === actorId) {
    const err = new Error('Cannot archive your own account');
    err.statusCode = 403;
    throw err;
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: USER_SELECT });
  if (!target) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  if (target.archivedAt) {
    const err = new Error('User is already archived');
    err.statusCode = 409;
    throw err;
  }

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { active: false, archivedAt: new Date() },
    select: USER_SELECT,
  });
  return { user };
}

/**
 * Unarchive a user (super_admin only). Does not re-enable — admin must
 * explicitly call enable after unarchiving.
 */
export async function adminUnarchiveUser({ targetUserId }) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: USER_SELECT });
  if (!target) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  if (!target.archivedAt) {
    const err = new Error('User is not archived');
    err.statusCode = 409;
    throw err;
  }

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { archivedAt: null },
    select: USER_SELECT,
  });
  return { user };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    active: user.active,
    organizationId: user.organizationId || null,
    createdAt: user.createdAt,
  };
}
