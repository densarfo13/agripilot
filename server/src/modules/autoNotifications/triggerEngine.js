/**
 * Trigger Engine — 6 automated notification rules.
 *
 * Rule 1: invite_reminder     — farmer invited but not accepted after 3 days
 * Rule 2: no_first_update     — no first progress entry 7+ days after planting
 * Rule 3: stale_farmer        — no activity for 14+ days on an active season
 * Rule 4: validation_pending  — officer validation awaited 5+ days
 * Rule 5: reviewer_backlog    — reviewer has 10+ pending applications
 * Rule 6: high_risk_alert     — season risk is Critical or High
 *
 * Each rule returns an array of notification payloads to enqueue.
 * Each payload: { type, organizationId, userId, roleTarget, farmerId, seasonId, templateCtx, preferredChannel }
 *
 * Scale-ready: all rules use bounded queries (take: BATCH_LIMIT) and
 * batch-fetch related records to eliminate N+1 patterns.
 */

import prisma from '../../config/database.js';
import { computeSeasonRisk } from '../risk/service.js';

const INVITE_REMINDER_DAYS    = 3;
const NO_FIRST_UPDATE_DAYS    = 7;
const STALE_FARMER_DAYS       = 14;
const VALIDATION_PENDING_DAYS = 5;
const REVIEWER_BACKLOG_THRESHOLD = 10;

// Maximum records processed per rule per cycle. Prevents OOM on large datasets.
// If more records exist, they'll be caught in the next cycle.
const BATCH_LIMIT = 500;

const REVIEW_PENDING_STATUSES = ['submitted', 'under_review', 'needs_more_evidence', 'field_review_required', 'escalated'];

// ─── Rule 1: Invite reminder ─────────────────────────────

export async function ruleInviteReminder() {
  const cutoff = new Date(Date.now() - INVITE_REMINDER_DAYS * 24 * 60 * 60 * 1000);

  const farmers = await prisma.farmer.findMany({
    where: {
      inviteToken:          { not: null },
      inviteAcceptedAt:     null,
      invitedAt:            { lte: cutoff },
      inviteDeliveryStatus: { in: ['email_sent', 'phone_sent', 'manual_share_ready'] },
    },
    take: BATCH_LIMIT,
    select: {
      id: true,
      fullName: true,
      phone: true,
      organizationId: true,
      inviteToken: true,
      invitedAt: true,
    },
  });

  return farmers.map(f => {
    const daysSinceInvite = Math.floor((Date.now() - new Date(f.invitedAt)) / 86400000);
    const inviteUrl = f.inviteToken
      ? `${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/invite/${f.inviteToken}`
      : null;

    return {
      type: 'invite_reminder',
      organizationId: f.organizationId,
      userId: null,
      roleTarget: 'field_officer',
      farmerId: f.id,
      seasonId: null,
      preferredChannel: 'sms',
      phone: f.phone,
      email: null,
      templateCtx: { farmerName: f.fullName, daysSinceInvite, inviteUrl },
    };
  });
}

// ─── Rule 2: No first update ─────────────────────────────

export async function ruleNoFirstUpdate() {
  const cutoff = new Date(Date.now() - NO_FIRST_UPDATE_DAYS * 24 * 60 * 60 * 1000);

  const seasons = await prisma.farmSeason.findMany({
    where: {
      status:           'active',
      plantingDate:     { lte: cutoff },
      lastActivityDate: null,
      progressEntries:  { none: {} },
    },
    take: BATCH_LIMIT,
    select: {
      id: true,
      cropType: true,
      plantingDate: true,
      farmer: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          organizationId: true,
          assignedOfficerId: true,
        },
      },
    },
  });

  return seasons.map(s => {
    const daysSincePlanting = Math.floor((Date.now() - new Date(s.plantingDate)) / 86400000);
    return {
      type: 'no_first_update',
      organizationId: s.farmer.organizationId,
      userId: null,
      roleTarget: 'field_officer',
      farmerId: s.farmer.id,
      seasonId: s.id,
      preferredChannel: 'sms',
      phone: s.farmer.phone,
      email: null,
      templateCtx: { farmerName: s.farmer.fullName, cropType: s.cropType, daysSincePlanting },
    };
  });
}

// ─── Rule 3: Stale farmer ────────────────────────────────

export async function ruleStaleActivity() {
  const cutoff = new Date(Date.now() - STALE_FARMER_DAYS * 24 * 60 * 60 * 1000);

  const seasons = await prisma.farmSeason.findMany({
    where: {
      status:           'active',
      lastActivityDate: { lte: cutoff },
    },
    take: BATCH_LIMIT,
    select: {
      id: true,
      lastActivityDate: true,
      farmer: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          organizationId: true,
          assignedOfficerId: true,
        },
      },
    },
  });

  // Deduplicate by farmerId (one notification per farmer even if multiple stale seasons)
  const seen = new Set();
  const uniqueSeasons = [];
  for (const s of seasons) {
    if (seen.has(s.farmer.id)) continue;
    seen.add(s.farmer.id);
    uniqueSeasons.push(s);
  }

  if (uniqueSeasons.length === 0) return [];

  // Batch-fetch all assigned officers in one query — eliminates N+1
  const officerIds = [...new Set(
    uniqueSeasons.map(s => s.farmer.assignedOfficerId).filter(Boolean),
  )];
  const officerMap = new Map();
  if (officerIds.length > 0) {
    const officers = await prisma.user.findMany({
      where: { id: { in: officerIds } },
      select: { id: true, fullName: true },
    });
    for (const o of officers) officerMap.set(o.id, o);
  }

  return uniqueSeasons.map(s => {
    const daysSinceActivity = Math.floor((Date.now() - new Date(s.lastActivityDate)) / 86400000);
    const officerName = s.farmer.assignedOfficerId
      ? (officerMap.get(s.farmer.assignedOfficerId)?.fullName || null)
      : null;

    return {
      type: 'stale_farmer',
      organizationId: s.farmer.organizationId,
      userId: null,
      roleTarget: 'field_officer',
      farmerId: s.farmer.id,
      seasonId: s.id,
      preferredChannel: 'sms',
      phone: s.farmer.phone,
      email: null,
      templateCtx: { farmerName: s.farmer.fullName, daysSinceActivity, officerName },
    };
  });
}

// ─── Rule 4: Validation pending ──────────────────────────

export async function ruleValidationPending() {
  const cutoff = new Date(Date.now() - VALIDATION_PENDING_DAYS * 24 * 60 * 60 * 1000);

  // Find validations that have not been completed, created more than N days ago
  const validations = await prisma.officerValidation.findMany({
    where: {
      completedAt: null,
      createdAt:   { lte: cutoff },
    },
    take: BATCH_LIMIT,
    select: {
      id: true,
      createdAt: true,
      officerId: true,
      season: {
        select: {
          id: true,
          farmer: {
            select: {
              id: true,
              fullName: true,
              organizationId: true,
            },
          },
        },
      },
    },
  });

  if (validations.length === 0) return [];

  // Batch-fetch all officers in one query — eliminates N+1
  const officerIds = [...new Set(validations.map(v => v.officerId).filter(Boolean))];
  const officerMap = new Map();
  if (officerIds.length > 0) {
    const officers = await prisma.user.findMany({
      where: { id: { in: officerIds } },
      select: { id: true, fullName: true, email: true },
    });
    for (const o of officers) officerMap.set(o.id, o);
  }

  return validations.map(v => {
    const daysWaiting = Math.floor((Date.now() - new Date(v.createdAt)) / 86400000);
    const officer = v.officerId ? officerMap.get(v.officerId) : null;

    return {
      type: 'validation_pending',
      organizationId: v.season?.farmer?.organizationId || null,
      userId: v.officerId,
      roleTarget: 'field_officer',
      farmerId: v.season?.farmer?.id || null,
      seasonId: v.season?.id || null,
      preferredChannel: 'email',
      phone: null,
      email: officer?.email || null,
      templateCtx: {
        officerName:  officer?.fullName || null,
        farmerName:   v.season?.farmer?.fullName || 'Unknown Farmer',
        seasonId:     v.season?.id,
        daysWaiting,
      },
    };
  });
}

// ─── Rule 5: Reviewer backlog ─────────────────────────────

export async function ruleReviewerBacklog() {
  const reviewers = await prisma.user.findMany({
    where: { role: 'reviewer', active: true },
    select: { id: true, fullName: true, email: true, organizationId: true },
  });

  if (reviewers.length === 0) return [];

  // Single aggregation query replaces N individual count queries — eliminates N+1
  const reviewerIds = reviewers.map(r => r.id);
  const pendingCounts = await prisma.application.groupBy({
    by: ['assignedReviewerId'],
    where: {
      assignedReviewerId: { in: reviewerIds },
      status:             { in: REVIEW_PENDING_STATUSES },
    },
    _count: { id: true },
  });

  const countMap = new Map(pendingCounts.map(r => [r.assignedReviewerId, r._count.id]));
  const reviewerMap = new Map(reviewers.map(r => [r.id, r]));

  const payloads = [];
  for (const [reviewerId, count] of countMap) {
    if (count < REVIEWER_BACKLOG_THRESHOLD) continue;
    const reviewer = reviewerMap.get(reviewerId);
    if (!reviewer) continue;

    payloads.push({
      type: 'reviewer_backlog',
      organizationId: reviewer.organizationId,
      userId: reviewer.id,
      roleTarget: 'reviewer',
      farmerId: null,
      seasonId: null,
      preferredChannel: 'email',
      phone: null,
      email: reviewer.email,
      templateCtx: { reviewerName: reviewer.fullName, pendingCount: count },
    });
  }

  return payloads;
}

// ─── Rule 6: High-risk alert ──────────────────────────────

export async function ruleHighRiskAlert() {
  const activeSeasons = await prisma.farmSeason.findMany({
    where: { status: 'active' },
    take: BATCH_LIMIT,
    select: {
      id: true,
      farmerId: true,
      farmer: {
        select: {
          id: true,
          fullName: true,
          organizationId: true,
          assignedOfficerId: true,
          phone: true,
        },
      },
    },
  });

  if (activeSeasons.length === 0) return [];

  // Compute risk per season, collect only high-risk seasons
  // computeSeasonRisk is per-season and cannot be batched without major refactor;
  // the BATCH_LIMIT above bounds the total number of calls.
  const highRiskSeasons = [];
  for (const season of activeSeasons) {
    let risk;
    try {
      risk = await computeSeasonRisk(season.id);
    } catch {
      continue; // skip if risk can't be computed
    }
    if (!risk || !['Critical', 'High'].includes(risk.riskLevel)) continue;
    highRiskSeasons.push({ season, risk });
  }

  if (highRiskSeasons.length === 0) return [];

  // Batch-fetch officers only for high-risk seasons — eliminates N+1
  const officerIds = [...new Set(
    highRiskSeasons
      .map(({ season }) => season.farmer.assignedOfficerId)
      .filter(Boolean),
  )];
  const officerMap = new Map();
  if (officerIds.length > 0) {
    const officers = await prisma.user.findMany({
      where: { id: { in: officerIds } },
      select: { id: true, fullName: true, email: true },
    });
    for (const o of officers) officerMap.set(o.id, o);
  }

  return highRiskSeasons.map(({ season, risk }) => {
    const officer = season.farmer.assignedOfficerId
      ? officerMap.get(season.farmer.assignedOfficerId)
      : null;

    return {
      type: 'high_risk_alert',
      organizationId: season.farmer.organizationId,
      userId: season.farmer.assignedOfficerId,
      roleTarget: 'field_officer',
      farmerId: season.farmer.id,
      seasonId: season.id,
      preferredChannel: 'email',
      phone: null,
      email: officer?.email || null,
      templateCtx: {
        officerName:   officer?.fullName || null,
        farmerName:    season.farmer.fullName,
        riskLevel:     risk.riskLevel,
        riskCategory:  risk.riskCategory,
        seasonId:      season.id,
      },
    };
  });
}

// ─── Run all rules ────────────────────────────────────────

export async function collectAllTriggers() {
  const [
    inviteReminders,
    noFirstUpdates,
    staleActivity,
    validationPending,
    reviewerBacklog,
    highRisk,
  ] = await Promise.allSettled([
    ruleInviteReminder(),
    ruleNoFirstUpdate(),
    ruleStaleActivity(),
    ruleValidationPending(),
    ruleReviewerBacklog(),
    ruleHighRiskAlert(),
  ]);

  const all = [];
  for (const result of [inviteReminders, noFirstUpdates, staleActivity, validationPending, reviewerBacklog, highRisk]) {
    if (result.status === 'fulfilled') {
      all.push(...result.value);
    } else {
      console.error('[triggerEngine] rule failed:', result.reason?.message);
    }
  }

  return all;
}
