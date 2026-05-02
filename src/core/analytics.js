/**
 * analytics.js \u2014 spec-named shim around the canonical
 * `analytics/analyticsStore.trackEvent` so callers that follow
 * the go-live spec's `import { trackEvent } from '../core/
 * analytics.js';` shape resolve to the same function the rest
 * of the codebase already uses.
 *
 *   import { trackEvent } from '../core/analytics.js';
 *
 *   trackEvent('task_completed', { farmId, crop, taskId });
 *   trackEvent('scan_used',      { scanId, confidence });
 *   trackEvent('day2_return',    { sinceFirstOpen: 1 });
 *
 * Why a shim
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * The go-live spec \u00a714 mandates a "lightweight analytics
 * service at src/core/analytics.ts" with a single
 * trackEvent(name, payload) export and a "no app crash if
 * analytics fails" rule. The codebase already ships that
 * function at src/analytics/analyticsStore.js \u2014 this file
 * just re-exports it under the spec path so we don't end up
 * with two parallel emit pipelines that drift.
 *
 * Both call sites (the existing ones via /analytics/ and any
 * future ones via /core/) feed the same event store; admin
 * dashboards that read events see a single stream regardless
 * of where the emit was called from.
 *
 * Strict-rule audit
 *   \u2022 No new I/O. trackEvent itself is wrapped in try/catch by
 *     every caller so a tracking failure can never propagate.
 *   \u2022 Pure re-export; no transformation of names or payloads.
 *   \u2022 Coexists with the spec's pilot/NGO event taxonomy
 *     (active farmers, active gardens, task completion rate,
 *     scan usage, crop distribution, region activity, day2 /
 *     day7 return) \u2014 those are tracked via name conventions,
 *     not separate functions.
 */

export { trackEvent } from '../analytics/analyticsStore.js';
export { trackEvent as default } from '../analytics/analyticsStore.js';
