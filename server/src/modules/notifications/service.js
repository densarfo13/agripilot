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
