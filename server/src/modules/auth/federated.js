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

import crypto from 'crypto';
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

// ─── OAuth state CSRF protection ──────────────────────
// State param format: base64url(JSON payload) + '.' + HMAC-SHA256 signature
// Payload: { mode, nonce, exp, userId? }
// - mode: 'login' | 'link'
// - nonce: random hex — ensures state is unguessable
// - exp: UNIX timestamp (5 min TTL)
// - userId: present only for 'link' mode (carries initiating user through callback)

const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function buildOAuthState({ mode, userId } = {}) {
  const payload = {
    mode: mode || 'login',
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: Math.floor((Date.now() + STATE_TTL_MS) / 1000),
    ...(userId && { userId }),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', config.oauthStateSecret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

/**
 * Verify and parse an OAuth state parameter.
 * Returns the parsed payload or throws with statusCode 400.
 */
export function verifyOAuthState(stateParam) {
  if (!stateParam || typeof stateParam !== 'string') {
    const err = new Error('Missing OAuth state parameter');
    err.statusCode = 400;
    throw err;
  }
  const dot = stateParam.lastIndexOf('.');
  if (dot < 1) {
    const err = new Error('Malformed OAuth state parameter');
    err.statusCode = 400;
    throw err;
  }
  const encoded = stateParam.slice(0, dot);
  const sig = stateParam.slice(dot + 1);

  const expectedSig = crypto
    .createHmac('sha256', config.oauthStateSecret)
    .update(encoded)
    .digest('base64url');

  // Constant-time comparison
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    const err = new Error('Invalid OAuth state signature — possible CSRF');
    err.statusCode = 400;
    throw err;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    const err = new Error('OAuth state payload is not valid JSON');
    err.statusCode = 400;
    throw err;
  }

  if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) {
    const err = new Error('OAuth state has expired. Please try again.');
    err.statusCode = 400;
    throw err;
  }

  return payload; // { mode, nonce, exp, userId? }
}

// ─── Provider availability ─────────────────────────────

export function isGoogleEnabled() {
  return !!(config.google.clientId && config.google.clientSecret);
}

export function isMicrosoftEnabled() {
  return !!(config.microsoft.clientId && config.microsoft.clientSecret);
}

// ─── Build authorize URLs ──────────────────────────────

// mode: 'login' | 'link', userId: required when mode === 'link'
export function getGoogleAuthUrl({ mode = 'login', userId } = {}) {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: `${config.auth.callbackBaseUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    state: buildOAuthState({ mode, userId }),
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export function getMicrosoftAuthUrl({ mode = 'login', userId } = {}) {
  const tenant = config.microsoft.tenantId;
  const params = new URLSearchParams({
    client_id: config.microsoft.clientId,
    redirect_uri: `${config.auth.callbackBaseUrl}/api/auth/microsoft/callback`,
    response_type: 'code',
    scope: 'openid email profile User.Read',
    state: buildOAuthState({ mode, userId }),
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

// ─── Generic OIDC provider ────────────────────────────
// Supports any OpenID Connect-compliant provider (Okta, Auth0, Keycloak, etc.)
// Discovery: reads metadata from {issuerUrl}/.well-known/openid-configuration

export function isOidcEnabled() {
  return !!(config.oidc.issuerUrl && config.oidc.clientId && config.oidc.clientSecret);
}

// Cache discovered metadata for the lifetime of the process
let _oidcMetadata = null;

async function getOidcMetadata() {
  if (_oidcMetadata) return _oidcMetadata;
  const url = `${config.oidc.issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`OIDC discovery failed for ${config.oidc.issuerUrl}`);
    err.statusCode = 502;
    throw err;
  }
  _oidcMetadata = await res.json();
  return _oidcMetadata;
}

export async function getOidcAuthUrl({ mode = 'login', userId } = {}) {
  const meta = await getOidcMetadata();
  const params = new URLSearchParams({
    client_id: config.oidc.clientId,
    redirect_uri: `${config.auth.callbackBaseUrl}/api/auth/oidc/callback`,
    response_type: 'code',
    scope: config.oidc.scopes,
    state: buildOAuthState({ mode, userId }),
    prompt: 'select_account',
  });
  return `${meta.authorization_endpoint}?${params}`;
}

export async function getOidcUserInfo(code) {
  const meta = await getOidcMetadata();

  const tokenRes = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.oidc.clientId,
      client_secret: config.oidc.clientSecret,
      redirect_uri: `${config.auth.callbackBaseUrl}/api/auth/oidc/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const err = new Error('Failed to exchange OIDC auth code');
    err.statusCode = 401;
    throw err;
  }

  const tokens = await tokenRes.json();

  // Prefer userinfo endpoint; fall back to id_token claims for email
  let email, name, providerAccountId;

  if (meta.userinfo_endpoint) {
    const userRes = await fetch(meta.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) {
      const err = new Error('Failed to fetch OIDC user info');
      err.statusCode = 401;
      throw err;
    }
    const info = await userRes.json();
    providerAccountId = info.sub;
    email = (info.email || '').toLowerCase().trim();
    name = info.name || info.preferred_username || email;
  } else if (tokens.id_token) {
    // Parse id_token claims (no signature verification needed — token came from our request)
    const [, claimsPart] = tokens.id_token.split('.');
    const claims = JSON.parse(Buffer.from(claimsPart, 'base64url').toString('utf8'));
    providerAccountId = claims.sub;
    email = (claims.email || '').toLowerCase().trim();
    name = claims.name || claims.preferred_username || email;
  }

  if (!providerAccountId || !email) {
    const err = new Error('OIDC provider did not return required claims (sub, email)');
    err.statusCode = 401;
    throw err;
  }

  return {
    provider: 'oidc',
    providerAccountId,
    email,
    name,
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
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginMethod: provider },
    select: { tokenVersion: true },
  });

  const tokenVersion = updatedUser.tokenVersion ?? 0;

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

  // 8. MFA gate — same policy as local login
  const { isMfaRequired } = await import('./service.js').then(m => m).catch(() => ({}));
  if (typeof isMfaRequired === 'function' && isMfaRequired(user.role)) {
    // Reload MFA state
    const mfaUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mfaEnabled: true, tokenVersion: true },
    });

    if (!mfaUser?.mfaEnabled) {
      // MFA required but not set up
      const mfaSetupToken = jwt.sign(
        { sub: user.id, email: user.email, role: user.role, purpose: 'mfa_challenge', tv: tokenVersion },
        config.jwt.secret,
        { expiresIn: `${config.mfa?.challengeTokenMinutes || 5}m` },
      );
      return { user: sanitized, mfaSetupRequired: true, mfaToken: mfaSetupToken };
    }

    // MFA enrolled — need challenge
    const mfaChallengeToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, purpose: 'mfa_challenge', tv: tokenVersion },
      config.jwt.secret,
      { expiresIn: `${config.mfa?.challengeTokenMinutes || 5}m` },
    );
    return { user: sanitized, mfaChallengeRequired: true, mfaToken: mfaChallengeToken };
  }

  // 9. Issue full JWT (no MFA required for this role)
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, tv: tokenVersion },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );

  return { user: sanitized, accessToken: token };
}

// ─── Federated callback dispatch ──────────────────────
// Called from callback routes after getting providerUser and verifying state.
// Dispatches to login or link flow based on state.mode.

export async function handleFederatedCallback({ providerUser, statePayload }) {
  const mode = statePayload?.mode || 'login';

  if (mode === 'link') {
    const userId = statePayload?.userId;
    if (!userId) {
      const err = new Error('Link mode requires userId in state');
      err.statusCode = 400;
      throw err;
    }
    // Verify the user still exists and is active before linking
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, active: true, role: true },
    });
    if (!user) {
      const err = new Error('User account not found');
      err.statusCode = 404;
      throw err;
    }
    if (!user.active) {
      const err = new Error('Account deactivated');
      err.statusCode = 403;
      throw err;
    }
    await linkProvider({
      userId,
      provider: providerUser.provider,
      providerAccountId: providerUser.providerAccountId,
      providerEmail: providerUser.email,
    });
    return { linked: true };
  }

  // Default: login flow
  return federatedLogin(providerUser);
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

export function generateCallbackHtml(result) {
  const frontendOrigin = config.auth.frontendBaseUrl;

  if (result.error) {
    // Encode error for safe embedding
    const safeError = String(result.error).replace(/[<>"'&]/g, '');
    return `<!DOCTYPE html>
<html><head><title>Farroway</title></head>
<body>
<p>Authentication failed. This window will close.</p>
<script>
try {
  if (window.opener) {
    window.opener.postMessage({type:'farroway-auth',error:${JSON.stringify(safeError)}}, ${JSON.stringify(frontendOrigin)});
  }
} catch(e) {}
setTimeout(function(){ window.close(); }, 2000);
</script>
</body>
</html>`;
  }

  // Build payload — always include type; include whichever auth-state fields are present.
  // Handles: normal login (accessToken), MFA challenge (mfaChallengeRequired + mfaToken),
  // MFA setup required (mfaSetupRequired + mfaToken), and provider link (linked: true).
  const payload = JSON.stringify({
    type: 'farroway-auth',
    user: result.user,
    ...(result.accessToken         && { accessToken: result.accessToken }),
    ...(result.mfaChallengeRequired && { mfaChallengeRequired: true, mfaToken: result.mfaToken }),
    ...(result.mfaSetupRequired     && { mfaSetupRequired: true,     mfaToken: result.mfaToken }),
    ...(result.linked               && { linked: true }),
  });

  return `<!DOCTYPE html>
<html><head><title>Farroway</title></head>
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
