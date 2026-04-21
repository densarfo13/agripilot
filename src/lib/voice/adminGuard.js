/**
 * adminGuard.js — single source of truth for "is this request in an
 * admin context where voice/audio features must be suppressed?"
 *
 *   isAdminContext(pathname?) → boolean
 *   isAdminContextByRole(role?) → boolean
 *
 * Routes considered admin (voice OFF):
 *   /admin/**           — all admin dashboards + ops pages
 *   /officer/**         — field officer queues (internal staff)
 *   /reports/**         — printable + CSV reporting
 *   /ngo/**             — NGO program views
 *   /ops/**             — operational tooling
 *
 * Everything else (farmer Home, onboarding, scan, issue reporting,
 * settings, etc.) stays voice-ON.
 *
 * Pure. No React, no side effects. Used by every voice entry point
 * (VoiceBar, VoicePromptButton, voiceGuide.speak, voiceService.speak*)
 * so voice code never initializes on an admin page — no AudioContext,
 * no SpeechSynthesisUtterance, no speechSynthesis.getVoices() call.
 */

const ADMIN_PREFIXES = Object.freeze([
  '/admin',
  '/officer',
  '/reports',
  '/ngo',
  '/ops',
]);

function readPathname(explicit) {
  if (typeof explicit === 'string') return explicit;
  if (typeof window === 'undefined' || !window.location) return '';
  return String(window.location.pathname || '');
}

/**
 * isAdminContext — returns true when the current (or supplied) path
 * belongs to one of the admin-only route trees. Trailing slashes and
 * query strings are tolerated; matching is case-insensitive.
 */
export function isAdminContext(pathname) {
  const raw = readPathname(pathname);
  if (!raw) return false;
  // Strip query + hash, normalize case + trailing slash.
  const clean = raw.split(/[?#]/)[0].toLowerCase().replace(/\/+$/, '');
  if (!clean) return false;
  for (const prefix of ADMIN_PREFIXES) {
    if (clean === prefix) return true;
    if (clean.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

/**
 * Role-based variant for places that know the user's role but not
 * the URL (e.g. server-rendered shells, config probes). Admin roles
 * are suppressed; farmer role is voice-on.
 */
const ADMIN_ROLES = new Set([
  'admin', 'super_admin', 'institutional_admin',
  'field_officer', 'ngo_admin', 'program_manager',
]);

export function isAdminContextByRole(role) {
  if (!role) return false;
  return ADMIN_ROLES.has(String(role).toLowerCase());
}

export const _internal = Object.freeze({
  ADMIN_PREFIXES, ADMIN_ROLES,
});
