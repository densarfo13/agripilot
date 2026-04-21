/**
 * decisionEngine.js — rule-based scanner that reads server-side data
 * and emits a list of autonomous-action decisions for the cron runner
 * to execute.
 *
 *   decideActions({ prisma, now, limits }) → Decision[]
 *
 *   Decision = {
 *     actionType: 'sms_reminder' | 'email_alert' | 'assign_officer' | 'review',
 *     targetType: 'farmer' | 'farm' | 'issue',
 *     targetId:   string,
 *     rule:       string,                 // 'stalled_onboarding_7d' | ...
 *     reason:     string,                 // short human-readable
 *     priority:   'low' | 'medium' | 'high' | 'critical',
 *     score:      number,
 *     channel:    'sms' | 'email' | 'in_app' | null,
 *     contact:    { phone?, email?, farmerId? },
 *     template:   { subject, message }    // already-localised text
 *   }
 *
 * Decision rules (no ML — all explainable):
 *   • stalled_onboarding_7d — farmer invited ≥ 7 days, no accept.
 *     Action: SMS reminder (if phone), else email.
 *   • inactive_farmer_14d — active farmer with no event ≥ 14 days.
 *     Action: SMS nudge (if phone), else email.
 *   • critical_issue_unassigned — open issue, severity ∈ {high, critical},
 *     no assignee. Action: assign_officer when roster available, else
 *     email the admin distribution list.
 *   • new_farmer_welcome — acceptedAt within 24h, never messaged.
 *     Action: SMS welcome.
 *
 * Safety:
 *   • Never emits the same (actionType, targetId) twice per day; the
 *     action engine checks ActionLog for same-day duplicates.
 *   • Dry-run friendly — caller can inspect output before execution.
 *   • Handles missing Prisma models gracefully; empty list when the
 *     DB is unreachable.
 */

import { scoreCandidate, sortByPriority } from './scoringEngine.js';

const DAY_MS = 24 * 3600 * 1000;

function clampLimit(n, defaultVal = 50) {
  if (n == null) return defaultVal;
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return defaultVal;
  return Math.min(500, Math.floor(v));
}

// ─── Rule evaluators ─────────────────────────────────────────────

/**
 * Stalled onboarding — invites older than 7 days with no
 * acceptedAt. Reads Application rows; farms that already reached
 * `acceptedAt` or `rejectedAt` are skipped.
 */
async function findStalledOnboarding({ prisma, now, limit }) {
  try {
    if (!prisma || !prisma.application) return [];
    const cutoff = new Date(now - 7 * DAY_MS);
    const rows = await prisma.application.findMany({
      where:   { acceptedAt: null, createdAt: { lt: cutoff } },
      take:    clampLimit(limit),
      orderBy: { createdAt: 'asc' },
      include: { farmer: true },
    });
    return rows.filter(Boolean);
  } catch { return []; }
}

/**
 * Inactive farmers — no login / task_completed event in the last
 * 14 days. Uses the User.lastLoginAt field when present; falls
 * back to a simple lastActivityAt on the Farmer record.
 */
async function findInactiveFarmers({ prisma, now, limit }) {
  try {
    if (!prisma || !prisma.farmer) return [];
    const cutoff = new Date(now - 14 * DAY_MS);
    const rows = await prisma.farmer.findMany({
      where: {
        OR: [
          { updatedAt:      { lt: cutoff } },
          { user:           { lastLoginAt: { lt: cutoff } } },
        ],
      },
      take:    clampLimit(limit),
      orderBy: { updatedAt: 'asc' },
      include: { user: true },
    });
    return rows.filter(Boolean);
  } catch { return []; }
}

/**
 * Critical issues awaiting assignment. Server may not have a
 * dedicated Issue model in v1 — this reader works against whatever
 * is available (farm events / issues table) and silently skips when
 * none exist.
 */
async function findCriticalUnassignedIssues({ prisma, now, limit }) {
  try {
    if (!prisma || !prisma.issue) return [];
    const rows = await prisma.issue.findMany({
      where: {
        status: { in: ['open', 'escalated'] },
        severity: { in: ['high', 'critical'] },
        assignedTo: null,
      },
      take:    clampLimit(limit),
      orderBy: { createdAt: 'asc' },
    });
    return rows.filter(Boolean);
  } catch { return []; }
}

// ─── Decision builders ───────────────────────────────────────────

function buildStalledDecision(app, now) {
  const farmer = app.farmer || {};
  const scored = scoreCandidate({
    farmer, application: app, now,
  });
  const preferredChannel = farmer.phone ? 'sms' : (farmer.email ? 'email' : 'in_app');
  return Object.freeze({
    actionType: 'sms_reminder',
    targetType: 'farmer',
    targetId:   String(farmer.id || app.farmerId || app.id),
    rule:       'stalled_onboarding_7d',
    reason:     `Invite pending for ${scored.daysSince || 7}+ days`,
    priority:   scored.priority,
    score:      scored.score,
    channel:    preferredChannel,
    contact: {
      phone:    farmer.phone   || null,
      email:    farmer.email   || null,
      farmerId: String(farmer.id || app.farmerId || ''),
    },
    template: {
      subject: 'Finish joining Farroway',
      message: `Hi ${farmer.fullName || 'there'}, your Farroway invitation is still waiting. Open the link to complete your setup and start receiving farm reminders.`,
    },
    scheduledFor: new Date(now).toISOString(),
  });
}

function buildInactiveDecision(farmer, now) {
  const scored = scoreCandidate({ farmer, now });
  const preferredChannel = farmer.phone ? 'sms' : (farmer.email ? 'email' : 'in_app');
  return Object.freeze({
    actionType: 'sms_reminder',
    targetType: 'farmer',
    targetId:   String(farmer.id),
    rule:       'inactive_farmer_14d',
    reason:     `No activity for ${scored.daysSince || 14}+ days`,
    priority:   scored.priority,
    score:      scored.score,
    channel:    preferredChannel,
    contact: {
      phone:    farmer.phone || null,
      email:    farmer.email || (farmer.user && farmer.user.email) || null,
      farmerId: String(farmer.id),
    },
    template: {
      subject: 'Check in with your farm',
      message: `Hi ${farmer.fullName || 'there'}, it\u2019s been a couple of weeks. Open Farroway to see today\u2019s task and stay on track.`,
    },
    scheduledFor: new Date(now).toISOString(),
  });
}

function buildAssignDecision(issue, now) {
  const scored = scoreCandidate({ issue, now });
  return Object.freeze({
    actionType: 'assign_officer',
    targetType: 'issue',
    targetId:   String(issue.id),
    rule:       'critical_issue_unassigned',
    reason:     `Unassigned ${issue.severity} severity for ${scored.daysSince || 0}+ days`,
    priority:   scored.priority,
    score:      scored.score,
    channel:    'in_app',
    contact:    { farmerId: issue.farmerId || null },
    template: {
      subject: `Issue needs routing: ${issue.issueType || 'farm issue'}`,
      message: `High/critical issue has been open without assignment. Review and route in the admin queue.`,
    },
    scheduledFor: new Date(now).toISOString(),
  });
}

/**
 * decideActions — main entry for the cron runner. Runs the three
 * readers in parallel, builds per-row decisions, and returns them
 * sorted by priority (highest score first).
 */
export async function decideActions({
  prisma,
  now    = Date.now(),
  limits = {},
} = {}) {
  const [stalled, inactive, critical] = await Promise.all([
    findStalledOnboarding({ prisma, now, limit: limits.stalled  || 50 }),
    findInactiveFarmers(   { prisma, now, limit: limits.inactive || 50 }),
    findCriticalUnassignedIssues({ prisma, now, limit: limits.critical || 20 }),
  ]);

  const decisions = [];
  for (const app of stalled)  decisions.push(buildStalledDecision(app, now));
  for (const f of inactive)   {
    // Skip inactive farmers that are also stalled onboarding — the
    // stalled rule already covers them and we want one decision
    // per farmer per cycle.
    if (decisions.some((d) => d.targetId === String(f.id))) continue;
    decisions.push(buildInactiveDecision(f, now));
  }
  for (const i of critical)   decisions.push(buildAssignDecision(i, now));

  return sortByPriority(decisions);
}

export const _internal = Object.freeze({
  findStalledOnboarding, findInactiveFarmers, findCriticalUnassignedIssues,
  buildStalledDecision, buildInactiveDecision, buildAssignDecision,
  clampLimit, DAY_MS,
});
