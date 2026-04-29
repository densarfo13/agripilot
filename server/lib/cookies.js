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

// Cookie TTLs.
//
// access_token  — short (15 min). JWT verifies stateless; expiring
//                 the cookie quickly forces a /refresh which lets
//                 us rotate the refresh token. Every successful
//                 /refresh re-issues a fresh access_token so an
//                 active farmer never sees this expire.
// refresh_token — LONG (1 year by default). The whole point is
//                 "log in once, stay logged in". Every successful
//                 /refresh ROLLS this cookie another year, so
//                 only a farmer idle longer than a year is asked
//                 to log in again.
//
// Operators who want a stricter staff-deploy TTL can set
// REFRESH_TTL_DAYS in the environment.
const ACCESS_TTL_MS    = 15 * 60 * 1000;
const REFRESH_TTL_DAYS = (() => {
  const raw = parseInt(env.REFRESH_TTL_DAYS || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 365;
})();
export const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie('access_token',  accessToken,  buildCookieOptions(ACCESS_TTL_MS));
  res.cookie('refresh_token', refreshToken, buildCookieOptions(REFRESH_TTL_MS));
}

export function clearAuthCookies(res) {
  res.clearCookie('access_token', buildCookieOptions(0));
  res.clearCookie('refresh_token', buildCookieOptions(0));
}
