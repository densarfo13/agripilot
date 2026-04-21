/**
 * adminNav.js — demo-mode-aware admin navigation filter.
 *
 * In demo mode the admin nav is restricted to the four core items
 * that tell the product's value story cleanly:
 *
 *   Dashboard · Farmers · Reports · Notifications
 *
 * Everything else (Fraud Queue, Hotspot Inspector, Security Requests,
 * advanced intelligence / risk tools, etc.) is *hidden* — never
 * deleted — so a post-demo flip off demo mode instantly restores the
 * full nav.
 *
 * Usage:
 *   import { filterAdminNav, DEMO_ADMIN_NAV_IDS } from 'src/lib/demo/adminNav.js';
 *   const items = filterAdminNav(allItems);  // respects isDemoMode()
 */

import { isDemoMode } from '../../config/demoMode.js';

/**
 * Canonical ids of the four demo-visible admin nav entries. The
 * string match is case-insensitive so existing nav configs using
 * labels ("Dashboard") or ids ("dashboard") work without changes.
 */
export const DEMO_ADMIN_NAV_IDS = Object.freeze([
  'dashboard',
  'farmers',
  'reports',
  'notifications',
]);

const DEMO_SET = new Set(DEMO_ADMIN_NAV_IDS);

function normalizeKey(x) {
  return String(x || '').trim().toLowerCase();
}

/**
 * Does an item belong to the demo nav set? Matches against
 * `item.id` first, then `item.key`, then the lower-cased `label`,
 * so any reasonable nav config shape works.
 */
export function isDemoAdminNavItem(item) {
  if (!item) return false;
  const candidates = [item.id, item.key, item.label, item.slug, item.path];
  for (const c of candidates) {
    const k = normalizeKey(c);
    if (!k) continue;
    // Strip a leading slash so "/dashboard" matches "dashboard".
    const clean = k.replace(/^\/+/, '').replace(/^admin\//, '');
    if (DEMO_SET.has(clean)) return true;
  }
  return false;
}

/**
 * filterAdminNav — returns the subset to render. Honours demo mode
 * automatically; call-sites don't need to know about the flag.
 */
export function filterAdminNav(items = []) {
  if (!Array.isArray(items)) return [];
  if (!isDemoMode()) return items.slice();
  return items.filter(isDemoAdminNavItem);
}

/**
 * Advanced nav items that are HIDDEN in demo mode. Exposed so admin
 * pages can show a "Show advanced tools" toggle if they want to.
 */
export function hiddenInDemo(items = []) {
  if (!Array.isArray(items)) return [];
  if (!isDemoMode()) return [];
  return items.filter((i) => !isDemoAdminNavItem(i));
}

export const _internal = Object.freeze({ DEMO_SET, normalizeKey });
