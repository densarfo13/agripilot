/**
 * automationRules.js — deterministic orchestrator for the four
 * automation layers described in spec §3:
 *
 *   A. Auto-triage         → classifyIssue(...)
 *   B. Auto-severity        → scoreSeverity(...)
 *   C. Auto-assignment      → pickAssignment(...)
 *   D. Auto-acknowledgement + safe suggestion + escalation rules
 *
 *   planAutomation(issue, { registry, allIssues, now }) → {
 *     classification: {...},
 *     severityPlan:   {...},
 *     assignment:     {...},
 *     suggestion:     { text, kind: 'safe_observation' | 'safe_containment'
 *                                 | 'safe_water_check' | 'none' } | null,
 *     escalate:       boolean,
 *     escalateReasons:Array<{ rule, detail }>,
 *     cluster:        {...} | null,
 *     farmerAck:      string,
 *     audit:          Array<{ action, result, reasons, timestamp }>,
 *   }
 *
 * Pure — no writes, no side effects. The store applies the plan.
 */

import { classifyIssue } from './issueClassifier.js';
import { scoreSeverity } from './issueSeverity.js';
import { pickAssignment } from './issueAssignment.js';
import { detectCluster } from './clusterDetection.js';

// Safe, farmer-friendly suggestions. Every string is conservative:
// inspection + containment language, never prescriptive treatment.
const SAFE_SUGGESTIONS = Object.freeze({
  pest: {
    text: 'Inspect affected leaves and isolate damaged plants if possible.',
    kind: 'safe_containment',
  },
  disease: {
    text: 'Photograph a few affected leaves and avoid handling other plants until an officer reviews.',
    kind: 'safe_observation',
  },
  water_flood: {
    text: 'Check drainage and avoid adding more water. A field officer will review shortly.',
    kind: 'safe_containment',
  },
  water_drought: {
    text: 'Check soil moisture and water if you can. A field officer will review shortly.',
    kind: 'safe_water_check',
  },
  nutrient: {
    text: 'Note the affected area and the colour changes you see. An officer will review.',
    kind: 'safe_observation',
  },
  weather_damage: {
    text: 'Stake any bent stems and check drainage. Do not irrigate until the soil has dried.',
    kind: 'safe_containment',
  },
  unknown: {
    text: 'A field officer will review your report.',
    kind: 'none',
  },
});

function describesDrought(description) {
  const d = String(description || '').toLowerCase();
  return d.includes('drought') || d.includes('no rain')
      || d.includes('wilt')    || d.includes('dry');
}

function describesFlood(description) {
  const d = String(description || '').toLowerCase();
  return d.includes('flood') || d.includes('standing water')
      || d.includes('waterlog');
}

/**
 * pickSuggestion — spec §8 safety gate.
 *   • Only visible when confidence ≥ medium AND severity ≠ critical
 *   • "unknown" always falls through to the admin-review line
 *   • Water splits into flood-specific vs drought-specific suggestion
 */
function pickSuggestion({ classification, severityPlan, description }) {
  const { issueType, confidence } = classification;
  const { severity } = severityPlan;

  // Unknown always gets the neutral "officer will review" line —
  // never operational advice for something we couldn't classify.
  if (issueType === 'unknown') return SAFE_SUGGESTIONS.unknown;

  // Safety gates for confidence + severity.
  if (confidence === 'low' || severity === 'critical') {
    return SAFE_SUGGESTIONS.unknown;
  }

  if (issueType === 'water') {
    if (describesFlood(description))   return SAFE_SUGGESTIONS.water_flood;
    if (describesDrought(description)) return SAFE_SUGGESTIONS.water_drought;
    // Ambiguous — fall back to the neutral line so we don't tell a
    // flooded farmer to water and vice versa.
    return SAFE_SUGGESTIONS.unknown;
  }

  return SAFE_SUGGESTIONS[issueType] || SAFE_SUGGESTIONS.unknown;
}

/**
 * Count issues from the same farm in the last 7 days (exclusive of
 * the new one) so severity can bump on repeated reports (spec §5).
 */
function countRecentFromFarm({ farmId, allIssues = [], now = Date.now(), windowDays = 7 }) {
  if (!farmId) return 0;
  const cutoff = now - windowDays * 24 * 3600 * 1000;
  let count = 0;
  for (const i of allIssues) {
    if (!i || !i.farmId) continue;
    if (String(i.farmId) !== String(farmId)) continue;
    if ((i.createdAt || 0) < cutoff) continue;
    count += 1;
  }
  return count;
}

/**
 * Build the set of reasons that force an auto-escalate (spec §9):
 *   • severity ∈ {high, critical}
 *   • issueType === 'unknown' AND confidence === 'low'
 *   • same farm reports 3+ issues in 7 days
 *   • staple-crop disease suspicion (disease + staple crop)
 *   • cluster detected
 */
function buildEscalationReasons({
  classification,
  severityPlan,
  recentFarmIssueCount,
  cluster,
  crop,
}) {
  const reasons = [];
  const { severity } = severityPlan;
  const { issueType, confidence } = classification;

  if (severity === 'high' || severity === 'critical') {
    reasons.push({ rule: 'high_or_critical_severity', detail: `Severity = ${severity}` });
  }
  if (issueType === 'unknown' && confidence === 'low') {
    reasons.push({ rule: 'unknown_low_confidence',
      detail: 'Could not classify issue with confidence' });
  }
  if (Number(recentFarmIssueCount) >= 3) {
    reasons.push({ rule: 'repeated_farm_reports',
      detail: `${recentFarmIssueCount} reports from this farm in the last 7 days` });
  }
  if (issueType === 'disease' && crop
      && ['maize', 'rice', 'wheat', 'cassava', 'sorghum', 'yam', 'millet'].includes(String(crop).toLowerCase())) {
    reasons.push({ rule: 'staple_crop_disease',
      detail: `Disease suspicion on staple crop: ${crop}` });
  }
  if (cluster) {
    reasons.push({ rule: 'cluster_detected',
      detail: cluster.reason });
  }
  return reasons;
}

/**
 * Farmer acknowledgement line. Safe, non-diagnostic. Never promises
 * a specific remedy.
 */
function farmerAckFor({ assignment, escalate, suggestion }) {
  if (escalate) {
    return 'Your issue has been received and flagged for admin review.';
  }
  if (assignment && assignment.officerId) {
    return 'Your issue has been received and assigned.';
  }
  if (suggestion && suggestion.kind !== 'none') {
    return 'Your issue has been received and is waiting for review.';
  }
  return 'Your issue has been received.';
}

/**
 * planAutomation — the main entry point. Given a freshly-created
 * (but not-yet-persisted) issue plus the current world state,
 * return the full decision record the store should apply.
 */
export function planAutomation(issue, {
  registry  = [],
  allIssues = [],
  now       = Date.now(),
} = {}) {
  if (!issue || typeof issue !== 'object') {
    return Object.freeze({
      classification: null,
      severityPlan:   null,
      assignment:     null,
      suggestion:     null,
      escalate:       false,
      escalateReasons: [],
      cluster:        null,
      farmerAck:      'Your issue has been received.',
      audit:          [],
    });
  }

  // Layer A — classify
  const classification = classifyIssue({
    description: issue.description,
    issueType:   issue.issueType,
  });

  // Layer B — severity
  const recentFarmIssueCount = countRecentFromFarm({
    farmId: issue.farmId, allIssues, now,
  });
  const severityPlan = scoreSeverity({
    description:  issue.description,
    classification,
    crop:         issue.crop,
    recentFarmIssueCount,
  });

  // Layer C — assign
  const workload = {};
  for (const i of allIssues) {
    if (!i || !i.assignedTo) continue;
    if (i.status === 'resolved') continue;
    workload[i.assignedTo] = (workload[i.assignedTo] || 0) + 1;
  }
  const assignment = pickAssignment({ issue, registry, workload });

  // Cluster detection runs over the full set so admin gets the
  // outbreak signal even when individual severities look routine.
  const cluster = detectCluster(issue, allIssues, { now });

  // Escalation — any one of the rules forces admin review.
  const escalateReasons = buildEscalationReasons({
    classification,
    severityPlan,
    recentFarmIssueCount,
    cluster,
    crop: issue.crop,
  });
  const escalate = escalateReasons.length > 0;

  // Layer D — suggestion (safety-gated) + farmer ack
  const suggestion = pickSuggestion({
    classification, severityPlan, description: issue.description,
  });
  const farmerAck = farmerAckFor({ assignment, escalate, suggestion });

  // Audit trail — one entry per automation layer.
  const audit = [
    Object.freeze({
      action: 'auto_triage',
      result: classification.issueType,
      reasons: classification.matchedRules,
      confidence: classification.confidence,
      timestamp: now,
    }),
    Object.freeze({
      action: 'auto_severity',
      result: severityPlan.severity,
      reasons: severityPlan.reasons,
      timestamp: now,
    }),
    Object.freeze({
      action: 'auto_assign',
      result: assignment.officerId || 'admin_queue',
      reasons: assignment.reasons,
      tier:   assignment.reasonTier,
      timestamp: now,
    }),
    Object.freeze({
      action: 'auto_acknowledge',
      result: farmerAck,
      reasons: [],
      timestamp: now,
    }),
  ];
  if (escalate) {
    audit.push(Object.freeze({
      action: 'auto_escalate',
      result: 'escalated',
      reasons: escalateReasons,
      timestamp: now,
    }));
  }
  if (cluster) {
    audit.push(Object.freeze({
      action: 'cluster_detected',
      result: cluster.clusterId,
      reasons: [{ rule: 'threshold_reached', detail: cluster.reason }],
      timestamp: now,
    }));
  }

  return Object.freeze({
    classification,
    severityPlan,
    assignment,
    suggestion,
    escalate,
    escalateReasons: Object.freeze(escalateReasons.map(Object.freeze)),
    cluster,
    farmerAck,
    audit: Object.freeze(audit),
  });
}

export const _internal = Object.freeze({
  SAFE_SUGGESTIONS, pickSuggestion, buildEscalationReasons,
  countRecentFromFarm, farmerAckFor,
});
