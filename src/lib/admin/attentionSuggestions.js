/**
 * attentionSuggestions.js — "contact these N farmers today" picker.
 *
 *   getDailyContactSuggestions({
 *     farms, issues, events, now, limit, excludeReviewed,
 *   }) → [
 *     {
 *       farmId, farmerId, farmerName, phone, crop, region,
 *       score, priority, daysSince, reasons,
 *       issueId?, issueType?,
 *     }
 *   ]
 *
 * Contract:
 *   • Joins farms × open issues, scores each via attentionPriority
 *   • Excludes farms whose most-recent admin review is fresher than
 *     the row's latest update (unless excludeReviewed === false)
 *   • Returns top `limit` (default 5) sorted by priority desc
 *   • When no open issues exist for a farm but the farm is inactive,
 *     still includes it so the admin sees stalled engagement
 *   • Zero side effects — caller decides what to do with the list
 */

import { scoreAttentionTarget, sortByPriority } from './attentionPriority.js';
import { isReviewed } from './attentionActions.js';

function lower(s) { return String(s || '').toLowerCase(); }

function regionKeyOf(farm) {
  if (!farm) return null;
  const parts = [
    (farm.countryCode || farm.country || '').toString().toUpperCase(),
    (farm.stateCode   || farm.state   || '').toString().toUpperCase(),
  ].filter(Boolean);
  return parts.join('/') || null;
}

function latestActivityFor(farmId, events) {
  let max = 0;
  for (const e of events || []) {
    if (!e || String(e.farmId || '') !== String(farmId)) continue;
    if ((e.timestamp || 0) > max) max = e.timestamp;
  }
  return max || null;
}

/**
 * getDailyContactSuggestions — main entry. Local-first; no network.
 */
export function getDailyContactSuggestions({
  farms             = [],
  issues            = [],
  events            = [],
  now               = Date.now(),
  limit             = 5,
  excludeReviewed   = true,
} = {}) {
  // Build an issue index by farmId so we only score each (farm, issue)
  // pair once. Use only OPEN issues — resolved rows shouldn't pull
  // admins back in.
  const openIssuesByFarm = new Map();
  for (const issue of issues || []) {
    if (!issue || !issue.farmId) continue;
    if (issue.status === 'resolved') continue;
    const bucket = openIssuesByFarm.get(String(issue.farmId)) || [];
    bucket.push(issue);
    openIssuesByFarm.set(String(issue.farmId), bucket);
  }

  const candidates = [];

  for (const farm of farms || []) {
    if (!farm || !farm.id) continue;
    const farmId = String(farm.id);

    // Enrich the farm with lastActivityAt so the priority engine
    // can fire its inactivity rules.
    const lastActivityAt = latestActivityFor(farmId, events);
    const enrichedFarm = { ...farm, lastActivityAt };

    const bucket = openIssuesByFarm.get(farmId) || [];

    if (bucket.length === 0) {
      // No open issue — still surface the farm when it's stale.
      const scored = scoreAttentionTarget({ farm: enrichedFarm, now });
      if (scored.score > 0) {
        candidates.push(buildCandidate(enrichedFarm, null, scored));
      }
      continue;
    }

    // Score each open issue individually — one row per issue means
    // the admin sees WHICH issue is urgent, not just WHICH farm.
    for (const issue of bucket) {
      const scored = scoreAttentionTarget({ farm: enrichedFarm, issue, now });
      if (scored.score <= 0) continue;
      candidates.push(buildCandidate(enrichedFarm, issue, scored));
    }
  }

  // Filter out reviewed rows unless the caller wants them.
  const filtered = excludeReviewed
    ? candidates.filter((c) => {
        // The "since" we compare against is the row's latest update
        // (issue.updatedAt OR farm.lastActivityAt). If the admin
        // reviewed AFTER that, suppress the row.
        const sinceTs = c.issueId
          ? (c.issueUpdatedAt || c.issueCreatedAt || 0)
          : (c.lastActivityAt || 0);
        return !isReviewed(c.farmId, { sinceTs });
      })
    : candidates;

  const sorted = sortByPriority(filtered);
  const capped = Number.isFinite(limit) && limit > 0 ? sorted.slice(0, limit) : sorted;
  return capped.map((c) => Object.freeze({ ...c, reasons: Object.freeze(c.reasons || []) }));
}

function buildCandidate(farm, issue, scored) {
  return {
    farmId:          String(farm.id),
    farmerId:        farm.farmerId || null,
    farmerName:      farm.farmerName || farm.name || null,
    phone:           farm.phone || null,
    crop:            farm.crop ? lower(farm.crop) : null,
    region:          regionKeyOf(farm),
    program:         farm.program || null,
    score:           scored.score,
    priority:        scored.priority,
    daysSince:       scored.daysSince,
    reasons:         scored.reasons,
    issueId:         issue ? issue.id : null,
    issueType:       issue ? issue.issueType : null,
    issueSeverity:   issue ? issue.severity : null,
    issueStatus:     issue ? issue.status : null,
    issueCreatedAt:  issue ? (issue.createdAt || null) : null,
    issueUpdatedAt:  issue ? (issue.updatedAt || null) : null,
    lastActivityAt:  farm.lastActivityAt || null,
  };
}

export const _internal = Object.freeze({ regionKeyOf, latestActivityFor, buildCandidate });
