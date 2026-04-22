import prisma from '../../config/database.js';

/**
 * Farmer Notification Service
 * Dispatches notifications for workflow events, reminders, and system messages.
 *
 * Notification types: application_update, reminder, system, post_harvest, market, weather
 */

export async function createNotification(farmerId, data) {
  return prisma.farmerNotification.create({
    data: {
      farmerId,
      notificationType: data.notificationType || 'system',
      title: data.title,
      message: data.message,
      metadata: data.metadata || null,
    },
  });
}

/**
 * ─── Farroway Score snapshots ─────────────────────────────────
 * Persisted as FarmerNotification rows with
 * metadata.kind = 'farroway_score_snapshot' so we don't have to
 * add a new table. The score card POSTs one snapshot per day per
 * farm; listScoreSnapshots returns the recent ones ordered by
 * date desc for trend calculation across devices.
 */
export async function createScoreSnapshot(farmerId, snapshot) {
  if (!farmerId || !snapshot) return null;
  const overall = Number(snapshot.overall);
  if (!Number.isFinite(overall)) return null;
  const date = String(snapshot.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  // Dedup: one snapshot per (farmer, farm, date). Updating in
  // place keeps the history clean even when the card re-posts
  // as the score drifts through the day.
  const existing = await prisma.farmerNotification.findFirst({
    where: {
      farmerId,
      notificationType: 'system',
      metadata: { path: ['kind'], equals: 'farroway_score_snapshot' },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  // Prisma JSON filters vary by DB; we post-filter to stay portable.
  const sameDay = (existing && matchSnapshot(existing, { farmId: snapshot.farmId, date }))
    ? existing
    : null;
  if (sameDay) {
    return prisma.farmerNotification.update({
      where: { id: sameDay.id },
      data: {
        message: `Farroway Score ${overall} (${snapshot.band || ''})`,
        metadata: buildSnapshotMeta({ ...snapshot, overall, date }),
      },
    });
  }
  return prisma.farmerNotification.create({
    data: {
      farmerId,
      notificationType: 'system',
      title: 'Farroway Score snapshot',
      message: `Farroway Score ${overall} (${snapshot.band || ''})`,
      metadata: buildSnapshotMeta({ ...snapshot, overall, date }),
    },
  });
}

export async function listScoreSnapshots(farmerId, { farmId = null, limit = 14 } = {}) {
  if (!farmerId) return [];
  const rows = await prisma.farmerNotification.findMany({
    where: { farmerId, notificationType: 'system' },
    orderBy: { createdAt: 'desc' },
    take: Math.min(200, Math.max(1, limit * 4)),
  });
  const out = [];
  for (const n of rows) {
    const meta = coerceMeta(n.metadata);
    if (!meta || meta.kind !== 'farroway_score_snapshot') continue;
    if (farmId && meta.farmId && meta.farmId !== farmId) continue;
    out.push({
      date:    meta.date,
      overall: meta.overall,
      band:    meta.band || null,
      farmId:  meta.farmId || null,
      id:      n.id,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function buildSnapshotMeta({ overall, band, date, farmId, confidence, categories }) {
  // Keep metadata small — history queries read this, we don't want
  // kilobyte metadata rows. Per-category score only; no signals blob.
  const cats = {};
  if (categories && typeof categories === 'object') {
    for (const [k, v] of Object.entries(categories)) {
      if (v && Number.isFinite(v.score)) cats[k] = Math.round(v.score);
    }
  }
  return {
    kind:       'farroway_score_snapshot',
    date,
    overall:    Math.round(overall),
    band:       band || null,
    farmId:     farmId || null,
    confidence: confidence || null,
    categories: cats,
  };
}

function coerceMeta(metadata) {
  if (!metadata) return null;
  if (typeof metadata === 'string') {
    try { return JSON.parse(metadata); } catch { return null; }
  }
  return typeof metadata === 'object' ? metadata : null;
}

function matchSnapshot(row, { farmId, date }) {
  const m = coerceMeta(row.metadata);
  if (!m || m.kind !== 'farroway_score_snapshot') return false;
  if (m.date !== date) return false;
  if (farmId && m.farmId && m.farmId !== farmId) return false;
  return true;
}

export async function listNotifications(farmerId, filters = {}) {
  const where = { farmerId };
  if (filters.read !== undefined) where.read = filters.read === 'true';
  if (filters.type) where.notificationType = filters.type;

  // Bound limit: min 1, max 200, default 50
  let take = 50;
  if (filters.limit) {
    const parsed = parseInt(filters.limit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      take = Math.min(parsed, 200);
    }
  }

  return prisma.farmerNotification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function markRead(id) {
  const notification = await prisma.farmerNotification.findUnique({ where: { id } });
  if (!notification) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }
  return prisma.farmerNotification.update({
    where: { id },
    data: { read: true },
  });
}

export async function markAllRead(farmerId) {
  return prisma.farmerNotification.updateMany({
    where: { farmerId, read: false },
    data: { read: true },
  });
}

export async function getUnreadCount(farmerId) {
  return prisma.farmerNotification.count({ where: { farmerId, read: false } });
}

// ─── Dispatch helpers (called by other modules) ────────

/**
 * Notify farmer of application status change.
 */
export async function notifyApplicationUpdate(farmerId, applicationId, status, message) {
  return createNotification(farmerId, {
    notificationType: 'application_update',
    title: `Application ${formatStatus(status)}`,
    message: message || `Your application status has been updated to: ${formatStatus(status)}.`,
    metadata: { applicationId, status },
  });
}

/**
 * Notify farmer of upcoming reminder.
 */
export async function notifyReminder(farmerId, reminderId, title, message) {
  return createNotification(farmerId, {
    notificationType: 'reminder',
    title: `Reminder: ${title}`,
    message,
    metadata: { reminderId },
  });
}

/**
 * Notify farmer of post-harvest guidance.
 */
export async function notifyPostHarvest(farmerId, cropType, message) {
  return createNotification(farmerId, {
    notificationType: 'post_harvest',
    title: `Post-harvest: ${cropType}`,
    message,
    metadata: { cropType },
  });
}

/**
 * Notify farmer of market update.
 */
export async function notifyMarketUpdate(farmerId, cropType, message) {
  return createNotification(farmerId, {
    notificationType: 'market',
    title: `Market update: ${cropType}`,
    message,
    metadata: { cropType },
  });
}

function formatStatus(status) {
  return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || status;
}
