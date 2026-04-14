import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from './env.js';

export function generateOpaqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      emailVerified: !!user.emailVerifiedAt,
    },
    env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' },
  );
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, { expiresIn: '30d' });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET);
}

// ─── MFA challenge token (short-lived, 5 min) ────────────
// Issued after password verification for users who have MFA enabled.
// Must be exchanged at /api/v2/auth/mfa/verify with a valid TOTP code.
export function signMfaChallengeToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, purpose: 'mfa_challenge' },
    env.ACCESS_TOKEN_SECRET,
    { expiresIn: '5m' },
  );
}

export function verifyMfaChallengeToken(token) {
  const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET);
  if (payload.purpose !== 'mfa_challenge') {
    throw new Error('Invalid token purpose');
  }
  return payload;
}
