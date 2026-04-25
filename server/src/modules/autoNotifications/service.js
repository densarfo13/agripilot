/**
 * Auto-Notification Service
 *
 * Orchestrates: trigger → rate-limit check → template render → DB record → send → update record
 *
 * Exports:
 *   runNotificationCycle()  — called by the cron job
 *   listNotifications(opts) — admin list endpoint
 *   retryFailed(id)         — admin retry endpoint
 *   getStats(orgId)         — admin stats endpoint
 */

import prisma from '../../config/database.js';
import { collectAllTriggers } from './triggerEngine.js';
import { isAllowed } from './rateLimiter.js';
import { renderTemplate } from './templates.js';
import { dispatch } from './sender.js';
import { logNotificationEvent, logDeliveryEvent } from '../../utils/opsLogger.js';

// ─── Run one full notification cycle ─────────────────────

export async function runNotificationCycle() {
  let enqueued = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const triggers = await collectAllTriggers();

  for (const trigger of triggers) {
    const {
      type,
      organizationId,
      userId,
      roleTarget,
      farmerId,
      seasonId,
      preferredChannel,
      phone,
      email,
      templateCtx,
    } = trigger;

    // Rate limit check
    const allowed = await isAllowed({ type, farmerId, userId, seasonId });

    if (!allowed) {
      // Record as skipped (no DB write — just increment counter)
      skipped++;
      continue;
    }

    // Render template
    const { subject, message } = renderTemplate(type, templateCtx);

    // Create DB record with pending status
    let record;
    try {
      record = await prisma.autoNotification.create({
        data: {
          organizationId,
          userId,
          roleTarget,
          farmerId,
          seasonId,
          type,
          channel: preferredChannel,
          subject,
          message,
          status: 'pending',
          attempts: 0,
        },
      });
      enqueued++;
    } catch (err) {
      console.error('[autoNotif] Failed to create notification record:', err.message);
      failed++;
      continue;
    }

    // Resolve farmer notification preferences (Fix P2.7) so the
    // dispatcher can honour SMS/WhatsApp/voice opt-outs persisted
    // in the Farmer table. Failure is non-fatal — fall back to the
    // legacy "all channels enabled" behaviour.
    let preferences = null;
    if (farmerId && prisma?.farmer?.findUnique) {
      try {
        preferences = await prisma.farmer.findUnique({
          where: { id: farmerId },
          select: {
            receiveSMS: true,
            receiveWhatsApp: true,
            receiveVoiceAlerts: true,
            literacyMode: true,
            preferredReminderTime: true,
            preferredLanguage: true,
          },
        });
      } catch { preferences = null; }
    }

    // Literacy mode 'audio' → upgrade preferred channel to voice so
    // the cron honours the farmer's pick. Without this, a farmer who
    // selected audio in the UI would still get text first because
    // the trigger engine doesn't know about the per-farmer setting.
    let resolvedChannel = preferredChannel;
    if (preferences && preferences.literacyMode === 'audio'
        && preferences.receiveVoiceAlerts !== false) {
      resolvedChannel = 'voice';
    }

    // [WIRING] every triggered insight that survives rate-limit ends
    // up here — log so prod ops can confirm the cron actually
    // produced enqueued rows. One line per row.
    console.log(`[WIRING] insight.fired type=${type} farmerId=${farmerId || 'n/a'} `
      + `channel=${resolvedChannel || 'n/a'} literacy=${preferences?.literacyMode || 'text'}`);

    // Attempt delivery
    await deliverRecord(record, {
      phone, email, farmerId,
      preferredChannel: resolvedChannel,
      preferences,
      language: preferences?.preferredLanguage || 'en',
    });

    const updated = await prisma.autoNotification.findUnique({ where: { id: record.id }, select: { status: true } });
    if (updated?.status === 'sent')   sent++;
    if (updated?.status === 'failed') failed++;
  }

  logNotificationEvent('cycle_summary', { enqueued, sent, skipped, failed });
  return { enqueued, sent, skipped, failed };
}

// ─── Deliver a single record ──────────────────────────────

async function deliverRecord(record, { phone, email, farmerId, preferredChannel, preferences = null, language = 'en' }) {
  const attempts = (record.attempts || 0) + 1;

  try {
    const result = await dispatch({
      preferredChannel: preferredChannel || record.channel,
      subject: record.subject,
      message: record.message,
      phone,
      email,
      farmerId,
      preferences,
      language,
    });

    await prisma.autoNotification.update({
      where: { id: record.id },
      data: {
        status:   'sent',
        channel:  result.channel,
        sentAt:   new Date(),
        attempts,
        failureReason: null,
      },
    });
  } catch (err) {
    const failureReason = err?.message || 'Unknown delivery error';
    console.error(`[autoNotif] Delivery failed for ${record.id}:`, failureReason);
    logDeliveryEvent('send_failed', {
      notificationId: record.id,
      type: record.type,
      channel: record.channel,
      attempts,
      error: failureReason,
    });

    await prisma.autoNotification.update({
      where: { id: record.id },
      data: {
        status: 'failed',
        attempts,
        failureReason,
      },
    });
  }
}

// ─── Admin: list notifications ────────────────────────────

export async function listNotifications({
  actorRole,
  actorOrgId,
  status,
  type,
  farmerId,
  page = 1,
  limit = 50,
}) {
  const where = {};

  // Org scoping: institutional_admin sees own org only
  if (actorRole === 'institutional_admin' && actorOrgId) {
    where.organizationId = actorOrgId;
  }

  if (status)   where.status   = status;
  if (type)     where.type     = type;
  if (farmerId) where.farmerId = farmerId;

  const skip = (page - 1) * limit;

  const [records, total] = await Promise.all([
    prisma.autoNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.autoNotification.count({ where }),
  ]);

  return { records, total, page, limit };
}

// ─── Admin: retry a failed notification ──────────────────

export async function retryNotification({ id, actorRole, actorOrgId }) {
  const record = await prisma.autoNotification.findUnique({ where: { id } });
  if (!record) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }

  // Org scoping for institutional_admin
  if (actorRole === 'institutional_admin' && record.organizationId !== actorOrgId) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  if (record.status !== 'failed') {
    const err = new Error('Only failed notifications can be retried');
    err.statusCode = 400;
    throw err;
  }

  // Reset to pending so the UI shows immediate state change
  await prisma.autoNotification.update({
    where: { id },
    data: { status: 'pending', failureReason: null },
  });

  // We need to re-fetch the farmer/user contact info for delivery
  let phone = null;
  let email = null;

  if (record.farmerId) {
    const farmer = await prisma.farmer.findUnique({ where: { id: record.farmerId }, select: { phone: true } });
    phone = farmer?.phone || null;
  }
  if (record.userId) {
    const user = await prisma.user.findUnique({ where: { id: record.userId }, select: { email: true } });
    email = user?.email || null;
  }

  await deliverRecord(record, {
    phone,
    email,
    farmerId: record.farmerId,
    preferredChannel: record.channel,
  });

  return prisma.autoNotification.findUnique({ where: { id } });
}

// ─── Admin: stats ─────────────────────────────────────────

export async function getStats({ actorRole, actorOrgId }) {
  const where = {};
  if (actorRole === 'institutional_admin' && actorOrgId) {
    where.organizationId = actorOrgId;
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [totalSent, totalFailed, todaySent, byType] = await Promise.all([
    prisma.autoNotification.count({ where: { ...where, status: 'sent' } }),
    prisma.autoNotification.count({ where: { ...where, status: 'failed' } }),
    prisma.autoNotification.count({ where: { ...where, status: 'sent', sentAt: { gte: dayStart } } }),
    prisma.autoNotification.groupBy({
      by: ['type', 'status'],
      where,
      _count: { id: true },
    }),
  ]);

  return { totalSent, totalFailed, todaySent, byType };
}
