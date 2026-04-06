/**
 * Federated Authentication Service
 *
 * Handles Google and Microsoft OAuth2 code flow:
 *   1. Build provider authorize URL (redirect user to provider)
 *   2. Exchange auth code for tokens + user info
 *   3. Look up / link user in local IAM
 *   4. Enforce all existing access rules (active, role, approval)
 *   5. Issue JWT only after IAM checks pass
 *
 * Security rules:
 *   - No privileged role auto-creation
 *   - No approval bypass for farmers
 *   - No access for disabled/rejected accounts
 *   - Provider linking is audited
 */

import jwt from 'jsonwebtoken';
import prisma from '../../config/database.js';
import { config } from '../../config/index.js';
import { writeAuditLog } from '../audit/service.js';

// ─── Provider URLs ─────────────────────────────────────

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const MS_BASE = 'https://login.microsoftonline.com';
const MS_GRAPH_ME = 'https://graph.microsoft.com/v1.0/me';

// ─── Provider availability ─────────────────────────────

export function isGoogleEnabled() {
  return !!(config.google.clientId && config.google.clientSecret);
}

export function isMicrosoftEnabled() {
  return !!(config.microsoft.clientId && config.microsoft.clientSecret);
}

// ─── Build authorize URLs ──────────────────────────────

export function getGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: `${config.auth.callbackBaseUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    state: state || '',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export function getMicrosoftAuthUrl(state) {
  const tenant = config.microsoft.tenantId;
  const params = new URLSearchParams({
    client_id: config.microsoft.clientId,
    redirect_uri: `${config.auth.callbackBaseUrl}/api/auth/microsoft/callback`,
    response_type: 'code',
    scope: 'openid email profile User.Read',
    state: state || '',
    prompt: 'select_account',
  });
  return `${MS_BASE}/${tenant}/oauth2/v2.0/authorize?${params}`;
}

// ─── Exchange code → user info ─────────────────────────

export async function getGoogleUserInfo(code) {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: `${config.auth.callbackBaseUrl}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const err = new Error('Failed to exchange Google auth code');
    err.statusCode = 401;
    throw err;
  }

  const tokens = await tokenRes.json();

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    const err = new Error('Failed to fetch Google user info');
    err.statusCode = 401;
    throw err;
  }

  const info = await userRes.json();

  return {
    provider: 'google',
    providerAccountId: info.sub,
    email: info.email?.toLowerCase()?.trim(),
    name: info.name || info.email,
    emailVerified: info.email_verified,
  };
}

export async function getMicrosoftUserInfo(code) {
  const tenant = config.microsoft.tenantId;
  const tokenUrl = `${MS_BASE}/${tenant}/oauth2/v2.0/token`;

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.microsoft.clientId,
      client_secret: config.microsoft.clientSecret,
      redirect_uri: `${config.auth.callbackBaseUrl}/api/auth/microsoft/callback`,
      grant_type: 'authorization_code',
      scope: 'openid email profile User.Read',
    }),
  });

  if (!tokenRes.ok) {
    const err = new Error('Failed to exchange Microsoft auth code');
    err.statusCode = 401;
    throw err;
  }

  const tokens = await tokenRes.json();

  const userRes = await fetch(MS_GRAPH_ME, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    const err = new Error('Failed to fetch Microsoft user info');
    err.statusCode = 401;
    throw err;
  }

  const info = await userRes.json();

  return {
    provider: 'microsoft',
    providerAccountId: info.id,
    email: (info.mail || info.userPrincipalName)?.toLowerCase()?.trim(),
    name: info.displayName || info.mail,
  };
}

// ─── Core federated login ──────────────────────────────

/**
 * Authenticate via federated provider.
 * Enforces all existing IAM rules. Never auto-creates privileged accounts.
 */
export async function federatedLogin({ provider, providerAccountId, email, name }) {
  if (!email) {
    const err = new Error('Provider did not return an email address');
    err.statusCode = 400;
    throw err;
  }

  // 1. Look up by linked identity
  const fedIdentity = await prisma.federatedIdentity.findUnique({
    where: { uq_fed_provider_account: { provider, providerAccountId } },
    include: {
      user: {
        include: { farmerProfile: { select: { id: true, registrationStatus: true } } },
      },
    },
  });

  let user = fedIdentity?.user;

  // 2. If not linked, look up by email
  if (!user) {
    user = await prisma.user.findUnique({
      where: { email },
      include: { farmerProfile: { select: { id: true, registrationStatus: true } } },
    });

    // 3. No user at all → reject (no auto-creation of privileged accounts)
    if (!user) {
      const err = new Error('No account found for this email. Contact your administrator to create an account first.');
      err.statusCode = 403;
      throw err;
    }

    // 4. Auto-link provider to existing user
    await prisma.federatedIdentity.create({
      data: {
        userId: user.id,
        provider,
        providerAccountId,
        providerEmail: email,
      },
    });

    writeAuditLog({
      userId: user.id,
      action: 'provider_linked',
      details: { provider, providerEmail: email },
    }).catch(() => {});
  }

  // 5. Enforce: account must be active
  if (!user.active) {
    writeAuditLog({
      userId: user.id,
      action: 'federated_login_blocked',
      details: { provider, reason: 'account_deactivated' },
    }).catch(() => {});

    const err = new Error('Account deactivated');
    err.statusCode = 403;
    throw err;
  }

  // 6. Enforce: farmer approval status
  if (user.role === 'farmer' && user.farmerProfile) {
    const status = user.farmerProfile.registrationStatus;
    if (status === 'rejected' || status === 'disabled') {
      writeAuditLog({
        userId: user.id,
        action: 'federated_login_blocked',
        details: { provider, reason: `farmer_${status}` },
      }).catch(() => {});

      const err = new Error(
        status === 'rejected' ? 'Registration has been declined' : 'Account has been disabled'
      );
      err.statusCode = 403;
      throw err;
    }
    // pending_approval → allowed to log in (limited access enforced by requireApprovedFarmer)
  }

  // 7. Update last login method
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginMethod: provider },
  });

  // 8. Issue JWT (same shape as local login)
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );

  const sanitized = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  };

  if (user.role === 'farmer' && user.farmerProfile) {
    sanitized.farmerId = user.farmerProfile.id;
    sanitized.registrationStatus = user.farmerProfile.registrationStatus;
  }

  writeAuditLog({
    userId: user.id,
    action: 'federated_login',
    details: { provider },
  }).catch(() => {});

  return { user: sanitized, accessToken: token };
}

// ─── Link / unlink providers ───────────────────────────

export async function linkProvider({ userId, provider, providerAccountId, providerEmail }) {
  const existing = await prisma.federatedIdentity.findUnique({
    where: { uq_fed_provider_account: { provider, providerAccountId } },
  });

  if (existing) {
    if (existing.userId === userId) return existing; // already linked
    const err = new Error('This provider account is already linked to another user');
    err.statusCode = 409;
    throw err;
  }

  const identity = await prisma.federatedIdentity.create({
    data: {
      userId,
      provider,
      providerAccountId,
      providerEmail: providerEmail.toLowerCase(),
    },
  });

  writeAuditLog({
    userId,
    action: 'provider_linked',
    details: { provider, providerEmail },
  }).catch(() => {});

  return identity;
}

export async function unlinkProvider({ userId, provider }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { federatedIdentities: true },
  });

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  // Prevent removing last auth method
  const hasPassword = !!user.passwordHash;
  const otherProviders = user.federatedIdentities.filter(fi => fi.provider !== provider);

  if (!hasPassword && otherProviders.length === 0) {
    const err = new Error('Cannot unlink last authentication method. Set a password first.');
    err.statusCode = 400;
    throw err;
  }

  const deleted = await prisma.federatedIdentity.deleteMany({
    where: { userId, provider },
  });

  if (deleted.count === 0) {
    const err = new Error('Provider not linked to this account');
    err.statusCode = 404;
    throw err;
  }

  writeAuditLog({
    userId,
    action: 'provider_unlinked',
    details: { provider },
  }).catch(() => {});

  return { message: `${provider} account unlinked` };
}

export async function listLinkedProviders(userId) {
  return prisma.federatedIdentity.findMany({
    where: { userId },
    select: { provider: true, providerEmail: true, linkedAt: true },
    orderBy: { linkedAt: 'asc' },
  });
}

// ─── Callback HTML (popup → postMessage → parent) ──────

export function generateCallbackHtml({ user, accessToken, error }) {
  const frontendOrigin = config.auth.frontendBaseUrl;

  if (error) {
    // Encode error for safe embedding
    const safeError = String(error).replace(/[<>"'&]/g, '');
    return `<!DOCTYPE html>
<html><head><title>AgriPilot</title></head>
<body>
<p>Authentication failed. This window will close.</p>
<script>
try {
  if (window.opener) {
    window.opener.postMessage({type:'agripilot-auth',error:${JSON.stringify(safeError)}}, ${JSON.stringify(frontendOrigin)});
  }
} catch(e) {}
setTimeout(function(){ window.close(); }, 2000);
</script>
</body>
</html>`;
  }

  // Success — send user + token to parent window
  const payload = JSON.stringify({ type: 'agripilot-auth', user, accessToken });
  return `<!DOCTYPE html>
<html><head><title>AgriPilot</title></head>
<body>
<p>Signing in...</p>
<script>
try {
  if (window.opener) {
    window.opener.postMessage(${JSON.stringify(payload)}, ${JSON.stringify(frontendOrigin)});
  }
} catch(e) {}
setTimeout(function(){ window.close(); }, 500);
</script>
</body>
</html>`;
}
