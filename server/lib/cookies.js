import { env } from './env.js';

const isProd = env.NODE_ENV === 'production';

function normalizedSameSite() {
  const raw = (env.COOKIE_SAMESITE || 'lax').toLowerCase();
  if (['strict', 'lax', 'none'].includes(raw)) return raw;
  return 'lax';
}

function buildCookieOptions(maxAgeMs) {
  const sameSite = normalizedSameSite();
  return {
    httpOnly: true,
    sameSite,
    secure: isProd || sameSite === 'none',
    path: '/',
    maxAge: maxAgeMs,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie('access_token', accessToken, buildCookieOptions(15 * 60 * 1000));
  res.cookie('refresh_token', refreshToken, buildCookieOptions(30 * 24 * 60 * 60 * 1000));
}

export function clearAuthCookies(res) {
  res.clearCookie('access_token', buildCookieOptions(0));
  res.clearCookie('refresh_token', buildCookieOptions(0));
}
