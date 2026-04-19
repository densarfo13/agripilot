/**
 * personalVsRegional.js — scope separation for the optimization
 * loop. Personal signals affect ONE farmer's experience (task
 * urgency, wording tier). Regional signals affect ranking for
 * anyone in the same (crop, country, state, mode).
 *
 * The two layers NEVER cross-contaminate:
 *   • one farmer's heavy rejection of cassava moves THEIR
 *     recommendation slightly, but needs regional-threshold
 *     evidence before it moves cassava's ranking for others.
 *   • personal task-skip patterns tune THAT user's urgency
 *     immediately, but don't bleed into anyone else's.
 *
 * Exposed:
 *   SCOPE constants
 *   buildPersonalContextKey / buildRegionalContextKey
 *   parseScopeFromKey
 *   splitSignalsByScope(events, opts)
 *   mergeOptimizationLayers(regional, personal, opts)
 */

import { SCOPES } from './optimizationEligibility.js';
import { extractOptimizationSignals } from './signalExtractors.js';
import { buildRegionalContextKey, buildContextKey } from './contextKey.js';

export { SCOPES };
export const SCOPE = SCOPES;

/**
 * buildPersonalContextKey — prefixes with `u:<userId>|` so it
 * never collides with a regional key. Lowercased for stable
 * lookup.
 */
export function buildPersonalContextKey({
  userId, crop = '', country = '', state = '', mode = '', month = '',
} = {}) {
  if (!userId) return '';
  const suffix = buildContextKey({ crop, country, state, mode, month });
  return `u:${String(userId).toLowerCase()}|${suffix}`;
}

/** Parses which scope a key belongs to. */
export function parseScopeFromKey(key) {
  return String(key || '').startsWith('u:') ? SCOPES.PERSONAL : SCOPES.REGIONAL;
}

/** Strip the userId prefix off a personal key to get the regional equivalent. */
export function regionalKeyFromPersonal(key) {
  const s = String(key || '');
  const i = s.indexOf('|');
  if (!s.startsWith('u:') || i < 0) return s;
  return s.slice(i + 1);
}

/**
 * splitSignalsByScope — takes a flat event stream and produces
 * TWO extraction results: one bucketed by regional context keys
 * (the default), and one bucketed by personal keys (includes
 * userId). Events without a userId only contribute to regional.
 *
 * Input events are the same shape the analytics layer emits.
 * Per-user attribution is taken from `event.userId` first, then
 * from `event.meta?.userId`.
 */
export function splitSignalsByScope(events = [], opts = {}) {
  const regional = extractOptimizationSignals(events, opts);
  const byUser = groupEventsByUser(events);
  const personalExtractions = {};
  for (const [userId, userEvents] of Object.entries(byUser)) {
    const userRegional = extractOptimizationSignals(userEvents, opts);
    // Re-key every regional context into its personal form.
    const personalByContext = {};
    for (const [regKey, bucket] of Object.entries(userRegional.byContext || {})) {
      const personalKey = `u:${userId.toLowerCase()}|${regKey}`;
      personalByContext[personalKey] = bucket;
    }
    personalExtractions[userId] = {
      ...userRegional,
      byContext: personalByContext,
      scope: SCOPES.PERSONAL,
      userId,
    };
  }
  return {
    regional: { ...regional, scope: SCOPES.REGIONAL },
    personalByUser: personalExtractions,
  };
}

function groupEventsByUser(events = []) {
  const out = {};
  for (const ev of Array.isArray(events) ? events : []) {
    const userId = ev?.userId || ev?.meta?.userId;
    if (!userId) continue;
    (out[userId] = out[userId] || []).push(ev);
  }
  return out;
}

/**
 * mergeOptimizationLayers — combine regional + personal
 * adjustment maps for a single user. The merge rules are strict
 * by design:
 *
 *   • regional is the BASE for recommendationDelta (ranking) and
 *     for confidenceDelta (the wording tier). Personal does NOT
 *     override regional ranking — a single user can't swing the
 *     shortlist globally OR for themselves to a degree that
 *     departs from what the region supports.
 *   • personal can ADD to urgencyDelta (that's a per-user
 *     preference) on top of whatever regional has said.
 *   • personal CAN contribute a small discount to
 *     recommendationDelta for their own view — capped at
 *     PERSONAL_RECOMMENDATION_INFLUENCE (0.05) — but can never
 *     flip a regionally negative signal to positive.
 *   • listingQualityDelta is regional only — individual
 *     listings stay tied to regional buyer behavior.
 */
const PERSONAL_RECOMMENDATION_INFLUENCE = 0.05;

export function mergeOptimizationLayers(regional = {}, personal = {}, opts = {}) {
  const regionalByContext = regional.byContext || {};
  const personalByContext = personal.byContext || {};
  const merged = {};
  const meta = { combined: 0, personalApplied: 0, regionalOnly: 0 };

  // Start with every regional context verbatim.
  for (const [key, adj] of Object.entries(regionalByContext)) {
    merged[key] = { ...adj, scope: SCOPES.REGIONAL };
    meta.regionalOnly += 1;
  }

  // Layer personal adjustments onto a per-user view. We emit
  // a personal-keyed adjustment that CAN differ from its
  // regional twin, but the difference is bounded.
  for (const [personalKey, personalAdj] of Object.entries(personalByContext)) {
    const regionalKey = regionalKeyFromPersonal(personalKey);
    const regionalAdj = regionalByContext[regionalKey];
    const baseRecDelta = Number(regionalAdj?.recommendationDelta || 0);
    const baseConfDelta = Number(regionalAdj?.confidenceDelta || 0);
    const baseListDelta = Number(regionalAdj?.listingQualityDelta || 0);

    const personalRec = clamp(
      Number(personalAdj.recommendationDelta || 0),
      -PERSONAL_RECOMMENDATION_INFLUENCE,
      PERSONAL_RECOMMENDATION_INFLUENCE,
    );
    // "never flip a regionally negative signal to positive"
    let blendedRec = baseRecDelta + personalRec;
    if (baseRecDelta < 0 && blendedRec > 0) blendedRec = baseRecDelta;
    if (baseRecDelta > 0 && blendedRec < 0) blendedRec = baseRecDelta;

    merged[personalKey] = {
      contextKey: personalKey,
      scope: SCOPES.PERSONAL,
      recommendationDelta: blendedRec,
      // confidence stays regional — don't let one user move the
      // wording tier for themselves based on a few local events.
      confidenceDelta: baseConfDelta,
      // urgency is the main personal dial.
      urgencyDelta: Number(personalAdj.urgencyDelta || 0),
      // listing quality stays regional.
      listingQualityDelta: baseListDelta,
      reasons: [
        ...(regionalAdj?.reasons || []).map((r) => `regional:${r}`),
        ...(personalAdj.reasons || []).map((r) => `personal:${r}`),
      ],
      meetsThreshold: personalAdj.meetsThreshold || {
        recommendation: false, harvest: false, task: false, listing: false,
      },
      counts: personalAdj.counts || {},
    };
    meta.combined += 1;
    meta.personalApplied += 1;
  }

  return { byContext: merged, scopeMeta: meta };
}

function clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export const _internal = {
  PERSONAL_RECOMMENDATION_INFLUENCE,
  groupEventsByUser,
  regionalKeyFromPersonal,
};
