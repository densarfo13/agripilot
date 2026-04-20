/**
 * alertService.js — SERVER-side alert consolidator for the
 * /api/alerts and /api/admin/interventions endpoints.
 *
 * Distinct from src/core/alerts/alertTrigger.js (CLIENT-side
 * version) so we don't cross the module system (server is
 * CommonJS, client is ESM). Same contract + rules.
 *
 * generateAlerts({ risk, weather }) → [
 *   { id, severity, key, params, fallback }, ...
 * ]
 *
 * Pure. No i18n runtime. Keys only — the caller localizes.
 */

const SEVERITY_ORDER = { critical: 3, warning: 2, info: 1, safe: 0 };

function alert(id, severity, key, params, fallback) {
  return Object.freeze({
    id, severity, key,
    params: Object.freeze(params || {}),
    fallback,
  });
}

function generateAlerts({ risk = null, weather = null, pestRisk = null } = {}) {
  const out = [];
  const level = typeof risk === 'string' ? risk : (risk && risk.level);

  // Risk-based alert.
  if (level === 'high' || level === 'critical') {
    out.push(alert(
      'alert.high_risk',
      'critical',
      'alert.high_risk.body',
      {},
      'High risk detected. Take action today.',
    ));
  }

  if (weather && typeof weather === 'object') {
    if (weather.rainTomorrow) {
      out.push(alert(
        'alert.rain_tomorrow',
        'warning',
        'alert.rain_tomorrow.body',
        {},
        'Rain expected tomorrow. Prepare your farm today.',
      ));
    }
    if (weather.heavyRainExpected) {
      out.push(alert(
        'alert.heavy_rain',
        'critical',
        'alert.heavy_rain.body',
        {},
        'Heavy rain expected — protect fields and harvest today.',
      ));
    }
    if (weather.drought || (weather.dry && weather.tempHigh)) {
      out.push(alert(
        'alert.drought_stress',
        'warning',
        'alert.drought_stress.body',
        {},
        'Dry and hot conditions — check soil moisture.',
      ));
    }
  }

  if (pestRisk && typeof pestRisk === 'object') {
    const l = String(pestRisk.level || '').toLowerCase();
    if (l === 'high' || l === 'critical') {
      out.push(alert(
        'alert.pest_risk',
        l === 'critical' ? 'critical' : 'warning',
        'alert.pest_risk.body',
        { pest: String(pestRisk.pest || '') },
        'High pest risk detected — scout and treat early.',
      ));
    }
  }

  // Dedupe by id; sort by severity desc.
  const seen = new Set();
  const deduped = out.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
  deduped.sort((a, b) =>
    (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0));
  return deduped;
}

/**
 * generateAlertStrings — spec-compatible shorthand: returns
 * plain strings using each alert's English fallback. Useful
 * for the farmer app bootstrap path before i18n is wired.
 */
function generateAlertStrings(input) {
  return generateAlerts(input).map((a) => a.fallback);
}

module.exports = {
  generateAlerts,
  generateAlertStrings,
  _internal: { SEVERITY_ORDER },
};
