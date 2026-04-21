/**
 * adminNavGroups.js — four-group sidebar layout for the polished
 * admin nav (spec §5 "Sidebar simplification").
 *
 *   Overview      → Dashboard
 *   Operations    → Farmers, Issues
 *   Reports       → Reports (NGO + Program)
 *   Notifications → Notifications, Reminders
 *
 * Advanced modules (Fraud Queue, Hotspots, Security, Intelligence…)
 * collapse into an "Advanced" group that is hidden in demo mode and
 * visible but de-emphasised in production.
 *
 * Usage:
 *   const groups = groupAdminNav(items);  // respects isDemoMode()
 *   // groups = [{ id: 'overview', label: 'Overview', items: [...] }, ...]
 *
 * Pure. No React. Call-sites render however they want.
 */

import { isDemoMode } from '../../config/demoMode.js';
import { isDemoAdminNavItem } from './adminNav.js';

/**
 * Canonical group ids + their visible labels (i18n keys the UI can
 * resolve, with English fallbacks). Order of groups matters — this
 * is the top-to-bottom sidebar order.
 */
export const ADMIN_NAV_GROUPS = Object.freeze([
  { id: 'overview',      labelKey: 'admin.nav.overview',      fallback: 'Overview' },
  { id: 'operations',    labelKey: 'admin.nav.operations',    fallback: 'Operations' },
  { id: 'reports',       labelKey: 'admin.nav.reports',       fallback: 'Reports' },
  { id: 'notifications', labelKey: 'admin.nav.notifications', fallback: 'Notifications' },
  { id: 'advanced',      labelKey: 'admin.nav.advanced',      fallback: 'Advanced' },
]);

/**
 * Item-id / key / label → group id. Matches are case-insensitive
 * and accept the same id/key/label/slug/path surface as
 * `isDemoAdminNavItem`.
 */
const ITEM_GROUP = Object.freeze({
  // Overview
  dashboard:      'overview',
  home:           'overview',
  overview:       'overview',
  // Operations
  farmers:        'operations',
  issues:         'operations',
  'farm-issues':  'operations',
  interventions:  'operations',
  // Reports
  reports:        'reports',
  analytics:      'reports',
  impact:         'reports',
  ngo:            'reports',
  programs:       'reports',
  // Notifications
  notifications:  'notifications',
  reminders:      'notifications',
  alerts:         'notifications',
  // Advanced (hidden in demo mode, de-emphasised otherwise)
  'fraud-queue':  'advanced',
  fraud:          'advanced',
  hotspots:       'advanced',
  'hotspot-inspector': 'advanced',
  security:       'advanced',
  'security-requests': 'advanced',
  intelligence:   'advanced',
  audit:          'advanced',
  ops:            'advanced',
});

function normalizeKey(x) {
  return String(x || '').trim().toLowerCase()
    .replace(/^\/+/, '').replace(/^admin\//, '');
}

/** Resolve an item to its group id — defaults to 'advanced'. */
export function groupIdFor(item) {
  if (!item) return 'advanced';
  for (const key of [item.id, item.key, item.slug, item.path, item.label]) {
    const k = normalizeKey(key);
    if (k && ITEM_GROUP[k]) return ITEM_GROUP[k];
  }
  return 'advanced';
}

/**
 * groupAdminNav — bucket `items` into the 5 groups. In demo mode,
 * the `advanced` group is dropped entirely and non-demo items in
 * other groups are filtered via `isDemoAdminNavItem`. Empty groups
 * (no items) are dropped from the output so the sidebar never
 * renders a hollow heading.
 */
export function groupAdminNav(items = []) {
  const demo = isDemoMode();
  const buckets = new Map();

  for (const group of ADMIN_NAV_GROUPS) {
    buckets.set(group.id, {
      id: group.id,
      labelKey: group.labelKey,
      fallback: group.fallback,
      items: [],
    });
  }

  for (const item of items) {
    if (!item) continue;
    const gid = groupIdFor(item);
    if (demo) {
      if (gid === 'advanced') continue;           // drop advanced entirely
      if (!isDemoAdminNavItem(item)) continue;    // only the four demo items
    }
    const bucket = buckets.get(gid);
    if (bucket) bucket.items.push(item);
  }

  return Array.from(buckets.values()).filter((b) => b.items.length > 0);
}

export const _internal = Object.freeze({
  ITEM_GROUP, normalizeKey,
});
