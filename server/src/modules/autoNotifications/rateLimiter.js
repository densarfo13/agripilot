/**
 * Rate limiter for automated notifications.
 *
 * Rules (all checked against the auto_notifications table):
 *   - Max 1 notification of the same type per farmer per day
 *   - Max 1 notification of the same type per userId per day
 *   - High-risk alerts: max 1 per season per 6 hours
 *   - Global daily cap: max 3 auto-notifications per farmer total
 */

import prisma from '../../config/database.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_6H     = 6  * 60 * 60 * 1000;

/**
 * Returns true if a notification is allowed (not rate-limited).
 *
 * @param {Object} params
 * @param {string} params.type
 * @param {string|null} params.farmerId
 * @param {string|null} params.userId
 * @param {string|null} params.seasonId
 * @returns {Promise<boolean>}
 */
export async function isAllowed({ type, farmerId, userId, seasonId }) {
  const now = new Date();

  // ─── High-risk: 1 per season per 6 hours ────────────────
  if (type === 'high_risk_alert' && seasonId) {
    const recent = await prisma.autoNotification.count({
      where: {
        type,
        seasonId,
        status: { not: 'skipped' },
        createdAt: { gte: new Date(now - MS_6H) },
      },
    });
    if (recent > 0) return false;
  }

  // ─── 1 per farmer per type per day ──────────────────────
  if (farmerId) {
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);

    const farmerDailyCount = await prisma.autoNotification.count({
      where: {
        type,
        farmerId,
        status: { not: 'skipped' },
        createdAt: { gte: dayStart },
      },
    });
    if (farmerDailyCount > 0) return false;

    // Global daily cap per farmer (max 3 any type)
    const globalDailyCount = await prisma.autoNotification.count({
      where: {
        farmerId,
        status: { not: 'skipped' },
        createdAt: { gte: dayStart },
      },
    });
    if (globalDailyCount >= 3) return false;
  }

  // ─── 1 per userId per type per day ──────────────────────
  if (userId && !farmerId) {
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);

    const userDailyCount = await prisma.autoNotification.count({
      where: {
        type,
        userId,
        status: { not: 'skipped' },
        createdAt: { gte: dayStart },
      },
    });
    if (userDailyCount > 0) return false;
  }

  return true;
}
