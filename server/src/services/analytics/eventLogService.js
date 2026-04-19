/**
 * eventLogService.js — append-only analytics + ops metrics.
 *
 *   logEvent(prisma, { user, eventType, metadata })
 *   getEventCounts(prisma, { from, to, eventTypes? })
 *   getConversionMetrics(prisma, { from, to })
 *     → { harvestToListingRate, interestsPerListing, acceptRate }
 *
 * Every write is fire-and-forget: if the event_logs table isn't
 * migrated yet, we swallow the error so the caller's primary
 * action still succeeds. The assumption is "analytics is nice to
 * have, never a blocker".
 *
 * Canonical event types (keep this list authoritative):
 */
export const EVENT_TYPES = Object.freeze({
  ONBOARDING_COMPLETED:                      'onboarding_completed',
  ONBOARDING_RESUMED:                        'onboarding_resumed',
  ONBOARDING_LANGUAGE_SELECTED:              'onboarding_language_selected',
  ONBOARDING_LOCATION_DETECT_CLICKED:        'onboarding_location_detect_clicked',
  ONBOARDING_LOCATION_DETECT_SUCCESS:        'onboarding_location_detect_success',
  ONBOARDING_LOCATION_DETECT_FAILED:         'onboarding_location_detect_failed',
  ONBOARDING_LOCATION_PERMISSION_DENIED:     'onboarding_location_permission_denied',
  ONBOARDING_MANUAL_COUNTRY_SELECTED:        'onboarding_manual_country_selected',
  ONBOARDING_CONTINUE_BLOCKED_MISSING_COUNTRY:'onboarding_continue_blocked_missing_country',
  RECOMMENDATION_VIEWED:    'recommendation_viewed',
  CROP_SELECTED:            'crop_selected',
  TODAY_VIEWED:             'today_viewed',
  TASK_COMPLETED:           'task_completed',
  TASK_SKIPPED:             'task_skipped',
  ISSUE_REPORTED:           'issue_reported',
  HARVEST_SUBMITTED:        'harvest_submitted',
  LISTING_CREATED:          'listing_created',
  BUYER_INTEREST_SUBMITTED: 'buyer_interest_submitted',
  INTEREST_ACCEPTED:        'interest_accepted',
  INTEREST_DECLINED:        'interest_declined',
  LISTING_SOLD:             'listing_sold',
});

const VALID = new Set(Object.values(EVENT_TYPES));

export async function logEvent(prisma, { user, eventType, metadata } = {}) {
  if (!eventType || !VALID.has(eventType)) return null;
  try {
    return await prisma.eventLog.create({
      data: {
        userId: user?.id || null,
        eventType,
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      },
    });
  } catch {
    // Table not migrated or transient failure — analytics is never
    // the reason to fail a user action.
    return null;
  }
}

/**
 * getEventCounts — { [eventType]: count } over the window. Used by
 * an admin overview panel.
 */
export async function getEventCounts(prisma, { from, to, eventTypes } = {}) {
  const where = {};
  if (from || to) where.occurredAt = {};
  if (from) where.occurredAt.gte = new Date(from);
  if (to)   where.occurredAt.lte = new Date(to);
  if (Array.isArray(eventTypes) && eventTypes.length) {
    where.eventType = { in: eventTypes.filter((t) => VALID.has(t)) };
  }
  try {
    const rows = await prisma.eventLog.groupBy({
      by: ['eventType'], where, _count: { _all: true },
    });
    return Object.fromEntries(rows.map((r) => [r.eventType, r._count._all]));
  } catch {
    return {};
  }
}

/**
 * getConversionMetrics — derived rates for the ops dashboard.
 *
 *   harvestToListingRate  = listing_created / harvest_submitted
 *   interestsPerListing   = buyer_interest_submitted / listing_created
 *   acceptRate            = interest_accepted / (interest_accepted + interest_declined)
 *
 * Each ratio is bounded to [0, 1] and returns null when the
 * denominator is zero so dashboards don't render NaN.
 */
export async function getConversionMetrics(prisma, { from, to } = {}) {
  const counts = await getEventCounts(prisma, {
    from, to,
    eventTypes: [
      'harvest_submitted', 'listing_created', 'buyer_interest_submitted',
      'interest_accepted', 'interest_declined',
    ],
  });
  const ratio = (num, den) => (den > 0 ? Math.min(1, Math.max(0, num / den)) : null);
  return {
    window: { from: from || null, to: to || null },
    counts,
    harvestToListingRate: ratio(counts.listing_created || 0,  counts.harvest_submitted || 0),
    interestsPerListing:  (counts.listing_created || 0) > 0
      ? (counts.buyer_interest_submitted || 0) / counts.listing_created
      : null,
    acceptRate: ratio(
      counts.interest_accepted || 0,
      (counts.interest_accepted || 0) + (counts.interest_declined || 0),
    ),
  };
}
