/**
 * cohortGrouper.js — slices a set of users into answerable cohorts.
 * Used by every product-intelligence report so we can compare:
 *
 *   • Backyard vs Farm
 *   • Detect vs Manual location
 *   • English vs Hindi vs Spanish
 *   • Country A vs B
 *   • High vs Medium vs Low confidence
 *   • Full-support vs Limited-support regions
 *
 * No DB coupling — pass in users as `{ userId, events, profile? }`.
 * The classifier reads events for mode / language / country, and
 * uses the explicit `profile` field if present to override.
 */

import { DECISION_EVENT_TYPES } from './decisionEventTypes.js';

function firstMeta(events, key) {
  for (const e of events) {
    const v = e?.meta?.[key] ?? e?.[key];
    if (v != null && v !== '') return v;
  }
  return null;
}

/**
 * extractCohortKeys — derives cohort identifiers from one user's
 * event stream. Returns a frozen record of the fields product
 * dashboards most care about.
 */
export function extractCohortKeys(user = {}) {
  const events = Array.isArray(user.events) ? user.events : [];
  const profile = user.profile || {};

  const mode = normalize(profile.mode ?? firstMeta(events, 'mode'),
                         ['backyard', 'farm'], 'unknown');
  const language = normalize(profile.language ?? firstMeta(events, 'language'),
                             null, null);
  const country  = profile.country ?? firstMeta(events, 'country') ?? null;

  let locationMethod = 'unknown';
  if (events.some((e) => e?.type === 'onboarding_location_detect_success'))
    locationMethod = 'detect';
  else if (events.some((e) =>
      e?.type === DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL
      || e?.type === 'onboarding_manual_country_selected'))
    locationMethod = 'manual';

  let confidenceTier = 'unknown';
  // Take the latest non-null confidence seen on a recommendation event.
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (!ev) continue;
    const c = ev.confidence;
    if (c?.level) { confidenceTier = c.level; break; }
  }

  const supportTier = profile.supportTier
                    ?? firstMeta(events, 'supportTier')
                    ?? 'unknown';

  return Object.freeze({
    mode, language, country, locationMethod,
    confidenceTier: String(confidenceTier).toLowerCase(),
    supportTier:    String(supportTier).toLowerCase(),
  });
}

/**
 * groupUsersBy — generic cohort grouper. Returns
 *   {
 *     [key]: { count, users: [{userId, keys}] }
 *   }
 * where `key` comes from calling getKey(user).
 */
export function groupUsersBy(users = [], getKey) {
  if (typeof getKey !== 'function') return {};
  const out = {};
  for (const u of Array.isArray(users) ? users : []) {
    const keys = extractCohortKeys(u);
    const k = getKey(u, keys);
    if (k == null) continue;
    out[k] = out[k] || { count: 0, users: [] };
    out[k].count += 1;
    out[k].users.push({ userId: u?.userId ?? null, keys });
  }
  return out;
}

export function groupByMode(users = []) {
  return groupUsersBy(users, (_u, k) => k.mode);
}
export function groupByLocationMethod(users = []) {
  return groupUsersBy(users, (_u, k) => k.locationMethod);
}
export function groupByCountry(users = []) {
  return groupUsersBy(users, (_u, k) => k.country ?? 'unknown');
}
export function groupByLanguage(users = []) {
  return groupUsersBy(users, (_u, k) => k.language ?? 'unknown');
}
export function groupByConfidenceTier(users = []) {
  return groupUsersBy(users, (_u, k) => k.confidenceTier);
}

/**
 * compareCohorts — given two cohort keys, returns a comparison
 * object with a provided metric function. The metric fn takes an
 * array of users and returns a number (e.g. completion rate).
 * Useful for the report builder: "farm vs backyard completion".
 */
export function compareCohorts(cohortAUsers, cohortBUsers, metricFn, { labelA = 'A', labelB = 'B' } = {}) {
  if (typeof metricFn !== 'function') return null;
  const a = metricFn(cohortAUsers) ?? null;
  const b = metricFn(cohortBUsers) ?? null;
  return {
    [labelA]: a,
    [labelB]: b,
    diff: Number.isFinite(a) && Number.isFinite(b) ? +(a - b).toFixed(4) : null,
  };
}

function normalize(value, allowed, fallback) {
  if (value == null) return fallback;
  const v = String(value).toLowerCase();
  if (!allowed) return v;
  return allowed.includes(v) ? v : fallback;
}
