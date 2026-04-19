/**
 * useAnalytics — one entry point every component uses to log
 * analytics. Consolidates what used to be scattered fetch calls
 * and direct analyticsClient usage. Responsibilities:
 *
 *   • build the metadata envelope (analyticsEnvelope)
 *   • validate against the known event taxonomy
 *   • enqueue into the offline buffer (analyticsBuffer)
 *   • trigger an async flush when online
 *
 * The hook is intentionally dependency-light: it only depends on
 * the pure utilities we just added, not on any context provider.
 * That means it's safe to call from an onboarding screen before
 * any provider mounts.
 *
 * Usage:
 *   const { track } = useAnalytics({ mode, language, country });
 *   track(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, {
 *     confidence,
 *     meta: { crop: 'maize' },
 *   });
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  buildAnalyticsMetadata,
  markOnboardingStarted,
} from '../utils/analyticsEnvelope.js';
import {
  enqueueAnalyticsEvent,
  flushAnalyticsBuffer,
  installFlushOnReconnect,
} from '../utils/analyticsBuffer.js';
import { FUNNEL_EVENT_TYPES } from '../utils/funnelEventTypes.js';
import { DECISION_EVENT_VALUES } from '../utils/decisionEventTypes.js';
import { ONBOARDING_EVENT_TYPES } from '../utils/onboardingEventTypes.js';

const ANALYTICS_ENDPOINT = '/api/v2/analytics/events';

const KNOWN_EVENT_TYPES = new Set([
  ...Object.values(FUNNEL_EVENT_TYPES),
  ...Object.values(ONBOARDING_EVENT_TYPES),
  ...DECISION_EVENT_VALUES,
]);

async function defaultSendOne(event) {
  if (typeof fetch !== 'function') return false;
  try {
    const res = await fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      credentials: 'include',
    });
    return res && res.ok;
  } catch {
    return false;
  }
}

/**
 * @param {object} defaults
 * @param {'backyard'|'farm'|'unknown'} [defaults.mode]
 * @param {string} [defaults.language]
 * @param {string} [defaults.country]
 * @param {string} [defaults.stateCode]
 * @param {function} [defaults.sendOne]  override transport (tests)
 */
export function useAnalytics(defaults = {}) {
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const sendOne = defaults.sendOne || defaultSendOne;

  // Install the reconnect listener once per hook instance.
  useEffect(() => {
    const dispose = installFlushOnReconnect(sendOne);
    // Also try one flush on mount — covers page-reload after offline use.
    flushAnalyticsBuffer(sendOne).catch(() => {});
    return dispose;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const track = useCallback((type, extras = {}) => {
    const d = defaultsRef.current || {};
    if (!KNOWN_EVENT_TYPES.has(type)) {
      // Don't throw — just shelve. A server-side validator will
      // surface unknowns. Keeping the client lenient means adding
      // a new event on the server doesn't force a client release.
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[analytics] unknown event type:', type);
      }
    }
    const envelope = buildAnalyticsMetadata({
      type,
      mode:      extras.mode      ?? d.mode,
      language:  extras.language  ?? d.language,
      country:   extras.country   ?? d.country,
      stateCode: extras.stateCode ?? d.stateCode,
      confidence: extras.confidence,
      meta:       extras.meta || {},
    });
    enqueueAnalyticsEvent(envelope);
    // Fire-and-forget flush; don't block the UI even if it's slow.
    flushAnalyticsBuffer(sendOne).catch(() => {});
    return envelope;
  }, [sendOne]);

  // Mark onboarding start as a side-effect of *any* track call
  // during onboarding — simplifies callers.
  const trackOnboarding = useCallback((type, extras = {}) => {
    markOnboardingStarted();
    return track(type, extras);
  }, [track]);

  return useMemo(() => ({ track, trackOnboarding }), [track, trackOnboarding]);
}

export default useAnalytics;
