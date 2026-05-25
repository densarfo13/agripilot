/**
 * ngoAnalytics.js — Phase 4 stub.
 *
 * STATUS: STUB BACKLOG. NOT imported anywhere. NOT wired to any
 * NGO surface yet. Designed entrypoint for cohort-level analytics
 * an NGO operator needs to monitor pilots / programs / interventions.
 *
 * Backlog intent — when wired, this consolidates the scattered NGO
 * read paths into a single intelligence module the NGO dashboards
 * subscribe to.
 *
 * Output shape:
 *
 *   {
 *     activeFarmers:        number | null,
 *     completionRate:       number | null,         // 0..1
 *     cropRiskHotspots:     RiskHotspot[],
 *     interventionNeeded:   InterventionFlag[],
 *     lastRefreshedISO:     string | null,
 *   }
 *
 * @typedef {object} RiskHotspot
 * @property {string} regionCode
 * @property {string} cropKey
 * @property {'low'|'medium'|'high'} severity
 * @property {number} affectedCount
 *
 * @typedef {object} InterventionFlag
 * @property {string} reasonKey      i18n key
 * @property {string} actionKey      i18n key
 * @property {number} priority       0..100
 */

export function buildNgoAnalytics(input = {}) {
  return Object.freeze({
    activeFarmers:      null,
    completionRate:     null,
    cropRiskHotspots:   [],
    interventionNeeded: [],
    lastRefreshedISO:   null,
    _input:             input,
    _version:           NGO_ANALYTICS_VERSION,
  });
}

export const NGO_ANALYTICS_VERSION = '0.1.0-stub';
