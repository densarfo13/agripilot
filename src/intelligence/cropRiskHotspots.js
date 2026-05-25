/**
 * cropRiskHotspots.js — Phase 4 stub.
 *
 * STATUS: STUB BACKLOG. NOT imported anywhere. Designed entrypoint
 * for region × crop risk clustering — feeds the map view + the
 * NGO "where do we need to send field officers this week" report.
 *
 * Output shape:
 *
 *   {
 *     hotspots: Hotspot[],
 *     lastRefreshedISO: string | null,
 *     methodology:      string | null,
 *   }
 *
 * @typedef {object} Hotspot
 * @property {string} regionCode
 * @property {string} cropKey
 * @property {string} riskTypeKey     i18n key (e.g. 'risk.flood', 'risk.pest.outbreak')
 * @property {'low'|'medium'|'high'} severity
 * @property {number} affectedFarmCount
 * @property {{ lat:number, lng:number } | null} centroid
 * @property {string} discoveredISO
 */

export function buildCropRiskHotspots(input = {}) {
  return Object.freeze({
    hotspots:         [],
    lastRefreshedISO: null,
    methodology:      null,
    _input:           input,
    _version:         CROP_RISK_HOTSPOTS_VERSION,
  });
}

export const CROP_RISK_HOTSPOTS_VERSION = '0.1.0-stub';
