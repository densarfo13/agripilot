import { env } from './env.js';

const isProd = env.NODE_ENV === 'production';

function buildCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
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
