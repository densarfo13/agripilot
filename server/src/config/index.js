import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

// ─── Production environment validation ─────────────────
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  const required = ['JWT_SECRET', 'DATABASE_URL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[FATAL] Missing required env vars in production: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('[FATAL] JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }

  // MFA encryption key must be a 64-char hex string (32 bytes) in production.
  // If unset, MFA enrollment will silently produce broken encrypted secrets.
  if (process.env.MFA_SECRET_KEY) {
    if (!/^[0-9a-fA-F]{64}$/.test(process.env.MFA_SECRET_KEY)) {
      console.error('[FATAL] MFA_SECRET_KEY must be a 64-character hex string in production.');
      console.error('[FATAL] Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      process.exit(1);
    }
  } else {
    console.warn('[WARN] MFA_SECRET_KEY not set in production — MFA enrollment will be unavailable.');
  }

  // Warn if communication providers are not configured — delivery will fail silently at cron time.
  if (!process.env.SENDGRID_API_KEY || !process.env.EMAIL_FROM_ADDRESS) {
    console.warn('[WARN] SendGrid not fully configured (SENDGRID_API_KEY / EMAIL_FROM_ADDRESS missing) — email delivery disabled.');
  }
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.warn('[WARN] Twilio not fully configured — SMS delivery disabled.');
  }
}

// In development, warn if using fallback secret
if (!isProduction && !process.env.JWT_SECRET) {
  console.warn('[WARN] JWT_SECRET not set — using dev-only fallback. Do NOT use in production.');
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  jwt: {
    // No fallback in production (validated above); dev-only fallback for local use
    secret: process.env.JWT_SECRET || (isProduction ? undefined : 'dev-only-fallback-not-for-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  cors: {
    // Comma-separated origins, or empty for dev permissive mode
    origins: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
  },
  // ─── Federated Auth (optional — features disabled if not configured) ──
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
  },
  auth: {
    // Base URL for OAuth callbacks (must match provider console config)
    callbackBaseUrl: process.env.AUTH_CALLBACK_BASE_URL || `http://localhost:${process.env.PORT || '4000'}`,
    // Frontend origin for postMessage target and redirect
    frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
  },
  // ─── Email delivery (SendGrid) — optional ──────────────
  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Farroway',
  },
  // ─── SMS delivery (Twilio) — optional ─────────────────
  sms: {
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },
  // ─── MFA (TOTP) ────────────────────────────────────────
  mfa: {
    // Issuer shown in authenticator apps (e.g. "Farroway")
    issuer: process.env.MFA_TOTP_ISSUER || 'Farroway',
    // AES-256-GCM key for encrypting TOTP secrets at rest.
    // Must be a 64-char hex string (32 bytes). Generate with:
    //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    secretEncryptionKey: process.env.MFA_SECRET_KEY || '',
    // How long (minutes) a step-up MFA verification stays valid
    stepUpWindowMinutes: parseInt(process.env.MFA_STEP_UP_WINDOW_MINUTES || '30', 10),
    // How long (minutes) an MFA challenge temp-token is valid
    challengeTokenMinutes: parseInt(process.env.MFA_CHALLENGE_TOKEN_MINUTES || '5', 10),
    // Number of backup codes to generate
    backupCodeCount: 10,
  },
  // ─── Password Reset ────────────────────────────────────
  passwordReset: {
    tokenExpiryMinutes: parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES || '60', 10),
  },
  // ─── Generic OIDC (Okta, Auth0, etc.) — optional ──────
  oidc: {
    issuerUrl: process.env.OIDC_ISSUER_URL || '',          // e.g. https://company.okta.com
    clientId: process.env.OIDC_CLIENT_ID || '',
    clientSecret: process.env.OIDC_CLIENT_SECRET || '',
    displayName: process.env.OIDC_DISPLAY_NAME || 'SSO',  // shown in UI
    scopes: process.env.OIDC_SCOPES || 'openid email profile',
  },
  // ─── Weather Integration (optional) ────────────────────
  weather: {
    apiKey: process.env.WEATHER_API_KEY || '',
    baseUrl: process.env.WEATHER_BASE_URL || 'https://api.open-meteo.com/v1',
    timeoutMs: parseInt(process.env.WEATHER_TIMEOUT_MS || '5000', 10),
    cacheTtlMinutes: parseInt(process.env.WEATHER_CACHE_TTL_MINUTES || '30', 10),
  },
  // ─── OAuth state signing ───────────────────────────────
  // Used to HMAC-sign the OAuth state param to prevent CSRF.
  // Falls back to JWT secret if not separately configured.
  oauthStateSecret: process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET ||
    (isProduction ? undefined : 'dev-only-fallback-not-for-production'),
};
