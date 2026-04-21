/**
 * demoFallbacks.js — non-breaking fallback data + messages for the
 * admin / NGO demo flow.
 *
 * Contract:
 *   • friendlyEmptyMessage(kind)  — stable i18n key + English fallback
 *   • friendlyErrorMessage(kind)  — same, for soft error recovery
 *   • getFallbackNgoSummary()     — non-zero KPIs so an empty demo
 *                                    dashboard still communicates value
 *   • getFallbackProgramRisk()    — small risk distribution
 *   • getFallbackPerformance()    — small performance snapshot
 *   • shouldShowFallback()        — gate: only returns true in demo
 *                                    mode AND when the real payload
 *                                    is empty/errored
 *
 * None of these helpers mutate state. The calling page decides
 * whether to render the fallback shape or the real one — we just
 * give it a clean value to render.
 */

import { isDemoMode } from '../../config/demoMode.js';

// ─── Friendly empty / error wording ──────────────────────────────
const EMPTY_MESSAGES = Object.freeze({
  notifications:    { key: 'admin.empty.notifications',  fallback: 'No alerts right now \u2014 everything looks clear.' },
  issues:           { key: 'admin.empty.issues',         fallback: 'No pending issues at the moment.' },
  farmers:          { key: 'admin.empty.farmers',        fallback: 'No farmers yet. They\u2019ll show up here after onboarding.' },
  reports:          { key: 'admin.empty.reports',        fallback: 'Reports will appear here once activity is recorded.' },
  security:         { key: 'admin.empty.security',       fallback: 'Nothing flagged for review today.' },
  default:          { key: 'admin.empty.default',        fallback: 'No records yet.' },
});

const ERROR_MESSAGES = Object.freeze({
  analytics:        { key: 'admin.softError.analytics',    fallback: 'Still preparing data \u2014 check back in a moment.' },
  session:          { key: 'admin.softError.session',      fallback: 'Your session is being refreshed\u2026' },
  network:          { key: 'admin.softError.network',      fallback: 'Having trouble reaching the server. Using local data for now.' },
  generic:          { key: 'admin.softError.generic',      fallback: 'Still loading. This view will fill in shortly.' },
});

export function friendlyEmptyMessage(kind = 'default') {
  return EMPTY_MESSAGES[kind] || EMPTY_MESSAGES.default;
}

export function friendlyErrorMessage(kind = 'generic') {
  return ERROR_MESSAGES[kind] || ERROR_MESSAGES.generic;
}

// ─── Fallback analytics payloads (demo-mode only) ────────────────
/**
 * getFallbackNgoSummary — deterministic non-zero KPI shape used when
 * the server payload is empty or unreachable AND demo mode is on.
 * The numbers are intentionally modest so demos look real, not
 * inflated.
 */
export function getFallbackNgoSummary() {
  return Object.freeze({
    totalFarmers:     18,
    activeFarmers:    12,
    completionRate:   0.42,
    highRiskFarmers:  3,
    program:          null,
    source:           'demo_fallback',
  });
}

export function getFallbackProgramRisk() {
  return Object.freeze({
    high:   3,
    medium: 7,
    low:    8,
    source: 'demo_fallback',
  });
}

export function getFallbackPerformance() {
  return Object.freeze({
    avgYield:        1.8,
    avgScore:        62,
    taskCompletion:  0.54,
    source:          'demo_fallback',
  });
}

/**
 * shouldShowFallback — gate used by pages:
 *   "if demo mode is on AND the server came back empty/broken,
 *    render the fallback so the demo never looks dead."
 */
export function shouldShowFallback({ data = null, error = null } = {}) {
  if (!isDemoMode()) return false;
  if (error) return true;
  if (data == null) return true;
  if (Array.isArray(data) && data.length === 0) return true;
  if (typeof data === 'object') {
    // Treat "all zero" objects as effectively empty for fallback purposes.
    const numericValues = Object.values(data).filter((v) => typeof v === 'number');
    if (numericValues.length > 0 && numericValues.every((v) => v === 0)) return true;
  }
  return false;
}

export const _internal = Object.freeze({
  EMPTY_MESSAGES, ERROR_MESSAGES,
});
