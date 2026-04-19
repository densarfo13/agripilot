/**
 * signalExtractor.js — turns a flat event stream into the two
 * shapes the decision engine expects:
 *
 *   signalsByType:    { [signalType]: samples[] }
 *                     — fed to buildSignalConfidenceSummary
 *
 *   signalsByContext: { [contextKey]: signals[] }
 *                     — fed to scoreAllContexts /
 *                       resolveSignalConflict
 *
 * Mapping table (event → signal type + direction):
 *
 *   HARVEST_SUBMITTED (outcomeClass='good') → harvest_outcome +1
 *   HARVEST_SUBMITTED (outcomeClass='bad')  → harvest_outcome -1
 *   HARVEST_SUBMITTED (outcomeClass='mixed')→ harvest_outcome  0
 *   RECOMMENDATION_SELECTED  → recommendation_acceptance +1
 *   RECOMMENDATION_REJECTED  → recommendation_acceptance -1
 *   CROP_CHANGED_AFTER_RECOMMENDATION → crop_switched -1
 *   ISSUE_REPORTED           → issue_report -1
 *                            + repeated_issue_severity -1 if ≥3
 *                              same-type reports in 30d
 *   TASK_COMPLETED           → task_completion +1, task_behavior_pattern +1
 *   TASK_SKIPPED             → task_skip -1
 *   TASK_REPEAT_SKIPPED      → task_repeat_skipped -1, task_behavior_pattern -1
 *   LOCATION_RETRY_CLICKED   → location_retry -1
 *   LOCATION_CONFIRMED_YES   → (no signal — this is a UI ack)
 *   LOCATION_CONFIRMED_MANUAL after CONFIRMED_YES → detect_overridden_by_manual -1
 *   STEP_ABANDONED           → step_abandonment -1
 *   BUYER_INTEREST_SUBMITTED → buyer_interest +1
 *   LISTING_SOLD             → listing_conversion +1
 *   LISTING_EXPIRED          → listing_expired_unsold -1
 *
 * Context keys:
 *   - crop-scoped:  `${country}:${crop}` (lowercase) — when both
 *                   country and crop are present on the event
 *   - user-scoped:  `user:${userId}` — otherwise
 *
 * The extractor is a pure function. It NEVER touches Prisma. The
 * caller supplies events; it returns both shapes plus a few
 * rollups that are handy for dashboards.
 */

import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
} from '../../services/analytics/decisionEventTypes.js';
import {
  getSignalConfidenceScore,
} from '../../services/decision/signalConfidence.js';

const ISSUE_SEVERITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const ISSUE_SEVERITY_THRESHOLD = 3;

export function extractSignalsFromEvents(events = [], opts = {}) {
  const safe = Array.isArray(events) ? [...events].filter(Boolean) : [];
  safe.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const byType    = Object.create(null);
  const byContext = Object.create(null);

  const pushType = (signalType, sample) => {
    if (!signalType) return;
    (byType[signalType] = byType[signalType] || []).push(sample);
  };
  const pushContext = (contextKey, signal) => {
    if (!contextKey) return;
    (byContext[contextKey] = byContext[contextKey] || []).push(signal);
  };

  const userId = opts.userId ? String(opts.userId) : null;
  const defaultUserKey = userId ? `user:${userId}` : null;

  // Pre-pass: count issue_reported by type within 30d windows so we
  // can emit repeated_issue_severity at the right index.
  const issueWindow = [];
  const repeatedIssueHitAt = new Set();
  for (let i = 0; i < safe.length; i++) {
    const ev = safe[i];
    if (ev.type !== DECISION_EVENT_TYPES.ISSUE_REPORTED) continue;
    const t  = Number(ev.timestamp) || 0;
    const k  = String(ev.meta?.type || 'unknown');
    // Drop old entries outside the window
    while (issueWindow.length && (t - issueWindow[0].t) > ISSUE_SEVERITY_WINDOW_MS) issueWindow.shift();
    issueWindow.push({ t, k });
    const sameTypeCount = issueWindow.filter((x) => x.k === k).length;
    if (sameTypeCount >= ISSUE_SEVERITY_THRESHOLD) repeatedIssueHitAt.add(i);
  }

  // Track last confirm-yes so we can detect detect→manual override.
  let lastConfirmedYesAt = null;

  for (let i = 0; i < safe.length; i++) {
    const ev = safe[i];
    if (!ev || !ev.type) continue;
    const ts = Number(ev.timestamp) || 0;
    const cropKey = cropContext(ev);
    const userKey = defaultUserKey;

    switch (ev.type) {
      case DECISION_EVENT_TYPES.HARVEST_SUBMITTED: {
        const direction = normalizeOutcome(ev.meta?.outcomeClass ?? ev.meta?.outcome);
        const sample = { timestamp: ts, direction, weight: 1 };
        pushType('harvest_outcome', sample);
        pushContext(cropKey || userKey,
          summary('harvest_outcome', direction, [sample]));
        break;
      }
      case DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED: {
        const sample = { timestamp: ts, direction: +1, weight: 1 };
        pushType('recommendation_acceptance', sample);
        pushContext(cropKey || userKey,
          summary('recommendation_acceptance', +1, [sample]));
        break;
      }
      case DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED: {
        const sample = { timestamp: ts, direction: -1, weight: 1 };
        pushType('recommendation_acceptance', sample);
        pushContext(cropKey || userKey,
          summary('recommendation_acceptance', -1, [sample]));
        break;
      }
      case DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION: {
        const sample = { timestamp: ts, direction: -1, weight: 1 };
        pushType('crop_switched', sample);
        // Attribute the switch to the "from" crop's context.
        const fromKey = ev.meta?.from
          ? `${String(ev.country || '').toLowerCase()}:${String(ev.meta.from).toLowerCase()}`
          : cropKey || userKey;
        pushContext(fromKey,
          summary('crop_switched', -1, [sample]));
        break;
      }
      case DECISION_EVENT_TYPES.ISSUE_REPORTED: {
        const sample = { timestamp: ts, direction: -1, weight: 1 };
        pushType('issue_report', sample);
        if (repeatedIssueHitAt.has(i)) {
          pushType('repeated_issue_severity', sample);
          pushContext(cropKey || userKey,
            summary('repeated_issue_severity', -1, [sample]));
        }
        pushContext(cropKey || userKey,
          summary('issue_report', -1, [sample]));
        break;
      }
      case DECISION_EVENT_TYPES.TASK_COMPLETED: {
        const s = { timestamp: ts, direction: +1, weight: 1 };
        pushType('task_completion', s);
        pushType('task_behavior_pattern', s);
        pushContext(cropKey || userKey,
          summary('task_behavior_pattern', +1, [s]));
        break;
      }
      case DECISION_EVENT_TYPES.TASK_SKIPPED: {
        const s = { timestamp: ts, direction: -1, weight: 1 };
        pushType('task_skip', s);
        break;
      }
      case DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED: {
        const s = { timestamp: ts, direction: -1, weight: 1 };
        pushType('task_repeat_skipped', s);
        pushType('task_behavior_pattern', s);
        pushContext(userKey,
          summary('task_behavior_pattern', -1, [s]));
        break;
      }
      case DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED: {
        const s = { timestamp: ts, direction: -1, weight: 1 };
        pushType('location_retry', s);
        pushContext(userKey, summary('location_retry', -1, [s]));
        break;
      }
      case DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES: {
        lastConfirmedYesAt = ts;
        break;
      }
      case DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL: {
        if (lastConfirmedYesAt && ts > lastConfirmedYesAt) {
          const s = { timestamp: ts, direction: -1, weight: 1 };
          pushType('detect_overridden_by_manual', s);
          pushContext(userKey,
            summary('detect_overridden_by_manual', -1, [s]));
          lastConfirmedYesAt = null; // consume
        }
        break;
      }
      case FUNNEL_EVENT_TYPES.STEP_ABANDONED: {
        const s = { timestamp: ts, direction: -1, weight: 1 };
        pushType('step_abandonment', s);
        pushContext(userKey, summary('step_abandonment', -1, [s]));
        break;
      }
      case DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED: {
        const s = { timestamp: ts, direction: +1, weight: 1 };
        pushType('buyer_interest', s);
        pushContext(cropKey || userKey, summary('buyer_interest', +1, [s]));
        break;
      }
      case DECISION_EVENT_TYPES.LISTING_SOLD: {
        const s = { timestamp: ts, direction: +1, weight: 1 };
        pushType('listing_conversion', s);
        pushContext(cropKey || userKey, summary('listing_conversion', +1, [s]));
        break;
      }
      case DECISION_EVENT_TYPES.LISTING_EXPIRED: {
        const s = { timestamp: ts, direction: -1, weight: 1 };
        pushType('listing_expired_unsold', s);
        pushContext(cropKey || userKey, summary('listing_expired_unsold', -1, [s]));
        break;
      }
      default:
        // Unknown events contribute a tiny weak_engagement signal so
        // the dashboard still has a "pulse" for low-activity users.
        if (ev.type) {
          pushType('weak_engagement', { timestamp: ts, direction: +1, weight: 0.2 });
        }
    }
  }

  // Collapse per-context signals: multiple rows for the same signalType
  // become one row with summed sampleCount + recomputed confidence.
  const byContextCollapsed = Object.create(null);
  for (const [ctx, arr] of Object.entries(byContext)) {
    const map = new Map();
    for (const s of arr) {
      const curr = map.get(s.signalType);
      if (!curr) { map.set(s.signalType, { ...s, sourceCount: s.sourceCount || 1 }); }
      else {
        // Re-score by concatenating underlying samples (we keep them on _samples)
        const merged = {
          signalType: s.signalType,
          _samples: [...(curr._samples || [curr]), ...(s._samples || [s])],
        };
        const conf = getSignalConfidenceScore({
          signalType: s.signalType,
          samples: (merged._samples || []).map(sampleOf),
          now: opts.now,
        });
        merged.direction      = Math.sign((curr.direction || 0) + (s.direction || 0));
        merged.confidenceScore = conf.confidenceScore;
        merged.sourceCount    = (curr.sourceCount || 1) + (s.sourceCount || 1);
        map.set(s.signalType, merged);
      }
    }
    byContextCollapsed[ctx] = [...map.values()].map(({ _samples, ...rest }) => rest);
  }

  return {
    signalsByType: byType,
    signalsByContext: byContextCollapsed,
    rollups: {
      totalEvents: safe.length,
      typesSeen: Object.keys(byType),
      contextsSeen: Object.keys(byContextCollapsed),
    },
  };
}

/**
 * extractSignalsForUser — convenience wrapper that wires the
 * event-stream → signals pipeline for a single user.
 */
export function extractSignalsForUser(user, opts = {}) {
  return extractSignalsFromEvents(user?.events || [], {
    userId: user?.userId || opts.userId || null,
    now: opts.now,
  });
}

/**
 * extractSignalsForAllUsers — batch flavour. Returns a map of
 *   { [userId]: { signalsByType, signalsByContext, rollups } }
 * plus an aggregated `global` slice that merges everyone's
 * byType into one map (useful for country-level dashboards).
 */
export function extractSignalsForAllUsers(users = [], opts = {}) {
  const byUser = Object.create(null);
  const globalByType = Object.create(null);
  const globalByContext = Object.create(null);
  for (const u of Array.isArray(users) ? users : []) {
    const out = extractSignalsForUser(u, opts);
    byUser[u?.userId || 'anon'] = out;
    for (const [k, v] of Object.entries(out.signalsByType)) {
      (globalByType[k] = globalByType[k] || []).push(...v);
    }
    for (const [ctx, arr] of Object.entries(out.signalsByContext)) {
      (globalByContext[ctx] = globalByContext[ctx] || []).push(...arr);
    }
  }
  return { byUser, global: { signalsByType: globalByType, signalsByContext: globalByContext } };
}

// ─── internals ────────────────────────────────────────────
function cropContext(ev) {
  const country = String(ev.country || ev.meta?.country || '').toLowerCase();
  const crop    = String(ev.meta?.crop || '').toLowerCase();
  if (country && crop) return `${country}:${crop}`;
  return null;
}

function summary(signalType, direction, samples) {
  const conf = getSignalConfidenceScore({ signalType, samples });
  return {
    signalType,
    direction,
    confidenceScore: conf.confidenceScore,
    sourceCount: samples.length,
    _samples: samples, // internal — stripped on collapse
  };
}

function sampleOf(s) {
  // Accept either a raw sample or a summary-wrapped one.
  if (s && s.timestamp != null) return { timestamp: s.timestamp, direction: s.direction, weight: s.weight ?? 1 };
  if (s && s._samples) return s._samples[0];
  return { timestamp: 0, direction: 0, weight: 1 };
}

function normalizeOutcome(v) {
  const s = String(v || '').toLowerCase();
  if (s.startsWith('good'))  return +1;
  if (s.startsWith('bad'))   return -1;
  return 0;
}

export const _internal = { ISSUE_SEVERITY_WINDOW_MS, ISSUE_SEVERITY_THRESHOLD };
