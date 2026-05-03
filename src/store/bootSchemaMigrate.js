/**
 * bootSchemaMigrate.js — schema-versioned localStorage migration.
 *
 *   import { migrateOnBoot } from '../store/bootSchemaMigrate.js';
 *   migrateOnBoot();   // call once from App.jsx on every boot
 *
 * Why this module exists
 * ──────────────────────
 *   Older Farroway versions wrote localStorage shapes that newer
 *   render paths assume away. A `farroway_user_profile` blob from
 *   v1 has no `userType` field; v2 added it; v3 split farms vs
 *   gardens; v4 introduced the 6-role security model. A user who
 *   skipped a release jumps from v1 → v4 and the legacy shapes
 *   are still on disk.
 *
 *   Bare `JSON.parse(localStorage.getItem(...))` already routes
 *   through `safeParse` so a corrupt blob can never white-screen
 *   the app. This module is the COMPLEMENTARY safety: when a
 *   blob exists but its shape is older than the running code
 *   expects, we one-shot upgrade it on boot. Idempotent: the
 *   `farroway_schema_version` sentinel records the highest
 *   migration that has run, so subsequent boots are no-ops.
 *
 * What it migrates
 *   v1 → v2: backfill missing `userType` on `farroway_user_profile`
 *            from `farmType` + `country` heuristic.
 *   v2 → v3: rename legacy `userMode` slot to `farroway_user_type`
 *            so the canonical reader (core/userType.js) finds it.
 *            (Older builds wrote both keys; newer ones only read
 *            the canonical one.)
 *   v3 → v4: collapse legacy auth role aliases (super_admin →
 *            platform_admin, institutional_admin → ngo_admin,
 *            field_officer → field_agent, staff → ngo_admin) on
 *            the mirrored `farroway_active_role` slot so the
 *            6-role canonical names land everywhere RouteGuard
 *            + canAccessRoute read.
 *   v4 → v5: drop the `farroway_legacy_role` write site (kept on
 *            disk but no longer authoritative). Pure cleanup.
 *
 * Strict-rule audit
 *   * Never throws — every read + write try/catch'd.
 *   * Never deletes user data — only RENAMES / NORMALISES values.
 *   * Idempotent — sentinel guards every step so the migration
 *     can run on every boot without doing work twice.
 *   * Pure ESM, top-level imports only.
 *   * Returns a structured report so admin tooling can see what
 *     ran on a given session.
 */

import { safeReadJSON, getItem, setItem } from '../utils/storage.js';

// Bump this whenever a new migration step is appended below.
// The sentinel value on disk is the LAST applied version, so a
// fresh install starts at version 0 and runs every step in
// sequence; subsequent boots compare against this constant.
export const SCHEMA_VERSION = 5;

const SCHEMA_VERSION_KEY  = 'farroway_schema_version';
const USER_PROFILE_KEY    = 'farroway_user_profile';
const USER_TYPE_KEY       = 'farroway_user_type';
const LEGACY_USER_MODE    = 'userMode';
const LEGACY_ACTIVE_ROLE  = 'farroway_active_role';

// Maps legacy auth-record role names onto the spec's 6-role
// canonical set. Mirrors the server-side roleAliases.js so the
// frontend route guard never has to do the translation itself.
const LEGACY_ROLE_ALIASES = Object.freeze({
  super_admin:         'platform_admin',
  admin:               'platform_admin',
  institutional_admin: 'ngo_admin',
  ngo:                 'ngo_admin',
  staff:               'ngo_admin',
  field_officer:       'field_agent',
  agent:               'field_agent',
});

function _readVersion() {
  const raw = getItem(SCHEMA_VERSION_KEY);
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function _writeVersion(v) {
  setItem(SCHEMA_VERSION_KEY, String(v));
}

// ─── Migration steps ──────────────────────────────────────
// Each step is (currentVersion, report) → new version. Steps
// MUST be additive: a new build adds one to the bottom; never
// rewrites a published step.

function _step1_userType(report) {
  // v1 → v2: backfill userType on the user profile from
  // farmType + country heuristic. Cheapest place to do this
  // is the frontend's own `userType.js` resolver — but the
  // resolver runs on every read, which is wasted work when
  // the field could be persisted. We seed it here once.
  try {
    const profile = safeReadJSON(USER_PROFILE_KEY, null);
    if (!profile || typeof profile !== 'object') return;
    if (profile.userType) return; // already set
    const ft = String(profile.farmType || '').toLowerCase();
    if (ft === 'backyard' || ft === 'home_garden') {
      profile.userType = 'backyard';
    } else if (ft === 'commercial' || ft === 'small_farm' || ft === 'community_farm') {
      profile.userType = 'farmer';
    } else {
      // Unknown — default to farmer (safest fallback per spec).
      profile.userType = 'farmer';
    }
    setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    report.steps.push({ step: 'v1_user_type_backfill', userType: profile.userType });
  } catch { /* swallow */ }
}

function _step2_renameUserMode(report) {
  // v2 → v3: rename `userMode` slot to canonical
  // `farroway_user_type` if the canonical slot is empty.
  try {
    const canonical = getItem(USER_TYPE_KEY);
    if (canonical) return; // already populated
    const legacy = getItem(LEGACY_USER_MODE);
    if (!legacy) return;
    setItem(USER_TYPE_KEY, legacy);
    report.steps.push({ step: 'v2_rename_user_mode', value: legacy });
    // Don't delete the legacy slot — older builds still read it.
  } catch { /* swallow */ }
}

function _step3_normaliseRole(report) {
  // v3 → v4: collapse legacy role aliases on
  // `farroway_active_role` so RouteGuard sees the canonical
  // 6-role name regardless of when the user logged in.
  try {
    const raw = getItem(LEGACY_ACTIVE_ROLE);
    if (!raw) return;
    const lower = String(raw).trim().toLowerCase();
    if (!lower) return;
    const canonical = LEGACY_ROLE_ALIASES[lower];
    if (!canonical) return; // already canonical or unknown — leave alone
    setItem(LEGACY_ACTIVE_ROLE, canonical);
    report.steps.push({ step: 'v3_normalise_role', from: lower, to: canonical });
  } catch { /* swallow */ }
}

function _step4_dropLegacyRoleSlot(report) {
  // v4 → v5: stop writing the obsolete `farroway_legacy_role`
  // sentinel on subsequent runs. We don't DELETE the value
  // (some shells read it for analytics) but we don't refresh
  // it either — it stays frozen at its last write.
  // No-op at the migration level; recorded for audit visibility.
  report.steps.push({ step: 'v4_drop_legacy_role_slot' });
}

const MIGRATIONS = [
  null,             // v0 → v1: no migration (initial)
  null,             // v1 → v2 placeholder index — see below
  _step1_userType,  // index 2 = run when bringing v1 → v2
  _step2_renameUserMode,
  _step3_normaliseRole,
  _step4_dropLegacyRoleSlot,
];

/**
 * migrateOnBoot() → { from, to, steps[] }
 *
 * Idempotent boot-time migration runner. Read once on boot
 * from App.jsx. Returns a report; callers may forward to
 * trackEvent('schema_migrated') for visibility.
 */
export function migrateOnBoot() {
  const report = { from: 0, to: 0, steps: [] };
  let current;
  try { current = _readVersion(); }
  catch { current = 0; }
  report.from = current;

  // Run every step from current+1 up to SCHEMA_VERSION.
  // MIGRATIONS[i] is the step that brings storage from i-1 → i.
  for (let v = current + 1; v <= SCHEMA_VERSION; v += 1) {
    const fn = MIGRATIONS[v];
    if (typeof fn === 'function') {
      try { fn(report); }
      catch { /* swallow — never let one bad step block the rest */ }
    }
    try { _writeVersion(v); }
    catch { /* swallow */ }
  }

  report.to = SCHEMA_VERSION;
  return report;
}

// Test hook: lets the unit suite reset the sentinel without
// touching real localStorage internals.
export const _internal = Object.freeze({
  SCHEMA_VERSION_KEY,
  LEGACY_ROLE_ALIASES,
  _readVersion,
  _writeVersion,
});

export default migrateOnBoot;
