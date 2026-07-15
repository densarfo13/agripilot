/**
 * guidedScanAccess.js — client-side visibility decision for the guided scan PILOT
 * (PR-C integration fix). The route was gated on RoleRoute(ADMIN_ROLES) only, which
 * blocked the pilot farmer account (role !== super_admin) → the UI never mounted →
 * POST /api/scan/sessions never fired. This widens the gate to: admin role OR an
 * allowlisted user id (env VITE_SCAN_GUIDED_PILOT_USER_IDS, comma-separated). A
 * regular farmer who is neither admin nor allowlisted stays DISABLED.
 *
 * Pure · never throws. `opts.pilotIds` lets tests inject the allowlist.
 */
import { ADMIN_ROLES } from '../../utils/roles.js';

export function guidedScanAccess(user, opts = {}) {
  const role = user && user.role;
  const id = (user && user.id != null) ? String(user.id) : '';
  const isAdmin = ADMIN_ROLES.includes(role);
  let pilotIds = Array.isArray(opts.pilotIds) ? opts.pilotIds : null;
  if (!pilotIds) {
    try {
      const raw = (typeof import.meta !== 'undefined' && import.meta.env
        && import.meta.env.VITE_SCAN_GUIDED_PILOT_USER_IDS) || '';
      pilotIds = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    } catch { pilotIds = []; }
  }
  const isPilot = !!(id && pilotIds.includes(id));
  return Object.freeze({
    enabled: isAdmin || isPilot,
    reason: isAdmin ? 'admin_role' : isPilot ? 'pilot_allowlist'
      : (role ? 'not_admin_or_pilot' : 'no_user'),
  });
}

export default guidedScanAccess;
