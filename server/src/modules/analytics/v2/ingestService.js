/**
 * ingestService.js — stateless core of the v2 analytics ingest
 * endpoint. Accepts a raw events batch, validates it, and hands
 * the accepted slice to a caller-supplied `persistFn`.
 *
 * Keeping persistence behind a function means this service has
 * zero Prisma coupling — the caller (v2 routes.js) wires in the
 * actual DB write, and tests can inject a stub.
 *
 * Contract:
 *   ingestAnalyticsBatch({
 *     events:    Event[],
 *     userId:    string | null,
 *     persistFn: (normalizedEvents, { userId }) => Promise<void>,
 *     now?:      number,
 *   }) => Promise<{
 *     accepted:  number,
 *     rejected:  { index, reasons }[],
 *     persisted: boolean,
 *   }>
 */

import {
  validateBatch,
} from '../../../services/analytics/analyticsValidationService.js';
import {
  withProductIntelligenceAllowlist,
} from '../../../services/analytics/productIntelligenceEventTypes.js';

const DEFAULT_ALLOWLIST_EXTENSIONS = new Set([
  // Onboarding analytics events (from onboardingEventTypes).
  // We accept these without making the caller register every one.
  'onboarding_language_selected',
  'onboarding_location_detect_clicked',
  'onboarding_location_detect_success',
  'onboarding_location_detect_failed',
  'onboarding_location_permission_denied',
  'onboarding_manual_country_selected',
  'onboarding_continue_blocked_missing_country',
  'onboarding_completed',
  'onboarding_resumed',
]);

export async function ingestAnalyticsBatch({
  events,
  userId = null,
  persistFn,
  now = Date.now(),
  extraAllowlist = null,
} = {}) {
  const allowlist = withProductIntelligenceAllowlist(
    new Set([
      ...DEFAULT_ALLOWLIST_EXTENSIONS,
      ...(extraAllowlist ? extraAllowlist : []),
    ]),
  );

  const { accepted, rejected } = validateBatch(events, { allowlist, now });

  if (!accepted.length) {
    return { accepted: 0, rejected, persisted: false };
  }

  if (typeof persistFn !== 'function') {
    // No persistence callback — acceptance-only mode (useful for
    // staging / dry-run deployments).
    return { accepted: accepted.length, rejected, persisted: false };
  }

  await persistFn(accepted, { userId });
  return { accepted: accepted.length, rejected, persisted: true };
}

export const _internal = { DEFAULT_ALLOWLIST_EXTENSIONS };
