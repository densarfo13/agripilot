import prisma from '../../config/database.js';

/**
 * Track an analytics event. Fire-and-forget — never fails the caller.
 */
export async function trackEvent(event, userId = null, metadata = null) {
  try {
    await prisma.analyticsEvent.create({
      data: { event, userId, metadata },
    });
  } catch {
    // Silent — analytics should never break product flows
  }
}

/**
 * Get event counts for a time range (admin use).
 */
export async function getEventCounts(since = null) {
  const where = since ? { createdAt: { gte: new Date(since) } } : {};
  const counts = await prisma.analyticsEvent.groupBy({
    by: ['event'],
    where,
    _count: true,
    orderBy: { _count: { event: 'desc' } },
  });
  return counts.map(c => ({ event: c.event, count: c._count }));
}
