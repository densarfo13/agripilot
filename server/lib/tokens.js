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
