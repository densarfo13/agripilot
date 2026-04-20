/**
 * alertTrigger.js — spec §9. Pure alert generator. Given the
 * current farm + weather + risk signals, emits a list of
 * LocalizedPayload alerts the UI can render / surface to
 * notifications.
 *
 * Pure. No React. No side effects. The caller decides how
 * to display or dispatch (push notification, toast, banner).
 *
 * Contract:
 *
 *   generateAlerts({ farm, weather, pestRisk, nowMs? })
 *     → [ { id, severity, title, body }, ... ]
 *
 * Each alert:
 *   id       — stable string, safe to dedupe across generations
 *   severity — 'info' | 'warning' | 'critical'
 *   title    — LocalizedPayload (key + params + fallback)
 *   body     — LocalizedPayload (key + params + fallback)
 *
 * Rules:
 *   • never emit raw English strings — every field is a payload
 *   • alerts are sorted by severity descending (critical first)
 *   • duplicate ids are deduped — first wins
 */

import { makeLocalizedPayload } from '../i18n/localizedPayload.js';

const SEVERITY_ORDER = { critical: 3, warning: 2, info: 1 };

function alert(id, severity, titleKey, bodyKey, params = {}, fallbackTitle, fallbackBody) {
  return Object.freeze({
    id,
    severity,
    title: makeLocalizedPayload(titleKey, params, { fallback: fallbackTitle || titleKey }),
    body:  makeLocalizedPayload(bodyKey,  params, { fallback: fallbackBody  || bodyKey  }),
  });
}

/**
 * generateAlerts — produce a sorted, deduped list.
 */
export function generateAlerts({ farm = null, weather = null, pestRisk = null } = {}) {
  const out = [];
  const weatherOk = weather && typeof weather === 'object';
  const stage = (farm && (farm.stage || farm.cropStage)) || null;

  // Rain tomorrow → land-prep prompt (§9 example)
  if (weatherOk && weather.rainTomorrow) {
    out.push(alert(
      'alert.rain_tomorrow',
      'warning',
      'alert.rain_tomorrow.title',
      'alert.rain_tomorrow.body',
      {},
      'Rain expected tomorrow',
      'Rain tomorrow. Prepare land today.',
    ));
  }

  // Heavy rain + harvest stage → protect harvest.
  if (weatherOk && weather.heavyRainExpected && (stage === 'harvest' || stage === 'post_harvest')) {
    out.push(alert(
      'alert.heavy_rain_harvest',
      'critical',
      'alert.heavy_rain_harvest.title',
      'alert.heavy_rain_harvest.body',
      {},
      'Heavy rain threatens your harvest',
      'Protect or gather your harvest before the storm.',
    ));
  }

  // Dry + tempHigh + vegetative/flowering → watering prompt.
  if (weatherOk && weather.dry && weather.tempHigh
      && (stage === 'vegetative' || stage === 'flowering' || stage === 'early_growth')) {
    out.push(alert(
      'alert.heat_dry',
      'warning',
      'alert.heat_dry.title',
      'alert.heat_dry.body',
      {},
      'Hot and dry conditions',
      'Check soil moisture and consider watering.',
    ));
  }

  // Pest risk signals.
  if (pestRisk && typeof pestRisk === 'object') {
    const level = String(pestRisk.level || '').toLowerCase();
    if (level === 'high' || level === 'critical') {
      out.push(alert(
        'alert.high_pest_risk',
        level === 'critical' ? 'critical' : 'warning',
        'alert.high_pest_risk.title',
        'alert.high_pest_risk.body',
        { pest: String(pestRisk.pest || '') },
        'High pest risk detected',
        'Scout your field and treat early.',
      ));
    }
  }

  // Dedupe by id (first wins), then sort by severity descending.
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
 * notifyAlerts — fan out to a supplied notifier function. Pure
 * aside from the injected call. Returns the list of ids that
 * were dispatched.
 */
export function notifyAlerts(alerts, notifier) {
  if (!Array.isArray(alerts)) return [];
  if (typeof notifier !== 'function') return [];
  const dispatched = [];
  for (const a of alerts) {
    if (!a || !a.id) continue;
    try {
      notifier(a);
      dispatched.push(a.id);
    } catch {
      // Swallow — one failed notification shouldn't block others.
    }
  }
  return dispatched;
}

export const _internal = { SEVERITY_ORDER };
