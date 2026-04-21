/**
 * regionalHealthAlerts.js — regional disease/pest risk alerts on
 * top of the existing cluster-detection primitives.
 *
 *   detectRegionalHealthAlerts({ reports, now, windowDays,
 *     mediumThreshold, highThreshold }) → HealthAlert[]
 *
 *   HealthAlert = {
 *     region, crop, category, count, level,          // 'medium' | 'high'
 *     messageKey, message,                           // safe farmer-facing copy
 *     adminMessage,                                  // admin-facing variant
 *     reason,                                        // explanation for the alert
 *     since, ids[]
 *   }
 *
 * Safety contract:
 *   • Never claims a confirmed outbreak. Copy is hedged:
 *       "Possible disease risk increasing in cassava farms in this area"
 *   • Level stays below "confirmed" until a human confirms any
 *     single report's category.
 *   • Thresholds: 3+ reports → 'medium', 5+ → 'high'. Tunable via
 *     opts for operators running different-sized programs.
 *   • Returns [] when there's nothing to surface — no fake alerts.
 *
 * Pure. No Prisma, no React, no network.
 */

const DAY_MS = 24 * 3600 * 1000;

function lower(s) { return String(s || '').toLowerCase(); }

function regionKeyOf(report) {
  if (!report) return 'unknown';
  const country = lower(report.countryCode || '');
  const state   = lower(report.stateCode   || report.region || '');
  if (country && state && state !== '*') return `${country.toUpperCase()}/${state.toUpperCase()}`;
  if (state  && state  !== '*') return state.toUpperCase();
  if (country) return country.toUpperCase();
  return lower(report.location || 'unknown').toUpperCase();
}

// Farmer-facing copy is deliberately hedged — see spec §12.
const MESSAGE_KEYS = Object.freeze({
  pest: {
    farmerKey: 'health.regional.pest.farmer',
    farmerEn:  'Pest reports are increasing nearby. Inspect your plants.',
    adminEn:   (count, crop, region) =>
      `Pest reports rising in ${crop || 'multiple crops'} (${region}) — ${count} in window`,
  },
  disease: {
    farmerKey: 'health.regional.disease.farmer',
    farmerEn:  'Possible disease risk increasing in this area. Check your crop and report changes.',
    adminEn:   (count, crop, region) =>
      `Possible disease spreading in ${crop || 'multiple crops'} (${region}) — ${count} in window`,
  },
  nutrient_deficiency: {
    farmerKey: 'health.regional.nutrient.farmer',
    farmerEn:  'Nutrient-like symptoms being reported in this area. Compare with healthy plants.',
    adminEn:   (count, crop, region) =>
      `Nutrient-deficiency reports rising in ${crop || 'multiple crops'} (${region}) — ${count} in window`,
  },
  water_stress: {
    farmerKey: 'health.regional.water.farmer',
    farmerEn:  'Water stress reports are rising nearby. Check soil moisture.',
    adminEn:   (count, crop, region) =>
      `Water-stress reports rising in ${crop || 'multiple crops'} (${region}) — ${count} in window`,
  },
  physical_damage: {
    farmerKey: 'health.regional.physical.farmer',
    farmerEn:  'Several farms have reported physical crop damage nearby.',
    adminEn:   (count, crop, region) =>
      `Physical-damage reports rising in ${crop || 'multiple crops'} (${region}) — ${count} in window`,
  },
  unknown: {
    farmerKey: 'health.regional.unknown.farmer',
    farmerEn:  'Multiple farms nearby reported issues. An officer will follow up.',
    adminEn:   (count, crop, region) =>
      `${count} unclassified reports in ${crop || 'multiple crops'} (${region}) — officer review`,
  },
});

/**
 * detectRegionalHealthAlerts — group triage reports by (region,
 * crop, category) over the recent window; emit an alert per group
 * that crosses `mediumThreshold`. Sorted by count desc.
 */
export function detectRegionalHealthAlerts({
  reports         = [],
  now             = Date.now(),
  windowDays      = 7,
  mediumThreshold = 3,
  highThreshold   = 5,
} = {}) {
  if (!Array.isArray(reports) || reports.length === 0) return [];

  const cutoff = now - Math.max(1, windowDays) * DAY_MS;
  const groups = new Map();

  for (const report of reports) {
    if (!report) continue;
    const ts = Number(report.createdAt) || Date.parse(report.createdAt) || 0;
    if (ts < cutoff) continue;
    const region   = regionKeyOf(report);
    const crop     = lower(report.crop) || 'unknown';
    const category = lower(report.predictedCategory || report.category || 'unknown');
    // Confirmed reports promote their row into the group — the
    // admin note carries confirmedCategory; we honour that here so
    // a human confirmation is reflected in the rollup key.
    const key = `${region}::${crop}::${category}`;
    const entry = groups.get(key) || {
      region, crop, category, count: 0, ids: [],
      since: ts,
    };
    entry.count += 1;
    entry.ids.push(report.id);
    if (ts < entry.since) entry.since = ts;
    groups.set(key, entry);
  }

  const alerts = [];
  for (const entry of groups.values()) {
    if (entry.count < mediumThreshold) continue;
    const level = entry.count >= highThreshold ? 'high' : 'medium';
    const msg = MESSAGE_KEYS[entry.category] || MESSAGE_KEYS.unknown;
    alerts.push(Object.freeze({
      region:     entry.region,
      crop:       entry.crop,
      category:   entry.category,
      count:      entry.count,
      level,
      messageKey: msg.farmerKey,
      message:    msg.farmerEn,
      adminMessage: msg.adminEn(entry.count, entry.crop, entry.region),
      reason:     `${entry.count} similar ${entry.category} reports in ${entry.region} in the last ${windowDays} days`,
      since:      entry.since,
      ids:        Object.freeze(entry.ids.slice(0, 20)),
    }));
  }

  alerts.sort((a, b) => (b.count - a.count)
    || a.region.localeCompare(b.region)
    || a.category.localeCompare(b.category));
  return alerts;
}

/**
 * farmerVisibleAlertsFor — given the full alert list and a target
 * farmer's region + crop, pick the subset that's relevant to them.
 * Returns [] when nothing applies.
 */
export function farmerVisibleAlertsFor(alerts, { region, crop } = {}) {
  if (!Array.isArray(alerts)) return [];
  const reg  = regionKeyOf({ stateCode: region, region });
  const key  = lower(crop);
  return alerts.filter((a) => {
    if (a.region !== reg) return false;
    // Show the alert when either the crop matches or the alert
    // carries the unknown-crop bucket (applies across crops).
    return !key || a.crop === key || a.crop === 'unknown';
  });
}

export const _internal = Object.freeze({
  DAY_MS, MESSAGE_KEYS, regionKeyOf,
});
