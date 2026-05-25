/**
 * scanFollowupEngine.js — turns a scan diagnosis into a concrete
 * follow-up plan: task + reminder + prevention tip + recurrence
 * check.
 *
 *   import { buildFollowupPlan } from 'src/core/scan/scanFollowupEngine.js';
 *
 *   const plan = buildFollowupPlan({
 *     issueCategory:    'fungal_risk',
 *     confidenceLabel:  'medium',
 *     crop:             'tomato',
 *     stage:            'flowering',
 *     weather:          { humidityPct: 88, rainProbability24hPct: 60 },
 *     nowMs:            Date.now(),
 *   });
 *   // plan = {
 *   //   followupTask, reminder, preventionTip,
 *   //   recurrenceCheck, memoryUpdate,
 *   // }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure planner. Given a hedged diagnosis + context, returns
 *   four localizable envelopes the surface renders + one memory
 *   patch the surface persists. Every output is hedged
 *   ("check / monitor / consider") — never "treat with X chemical".
 *
 *   It is NOT a treatment recommender — Farroway doesn't prescribe
 *   chemicals. The prevention tip is operational hygiene only
 *   (airflow / watering timing / mulch). For anything chemical, the
 *   prevention envelope routes to the "consult a local expert"
 *   message.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Hedged wording asserted in the test suite.
 */

const _DAY = 86400000;
const _str = (v) => String(v == null ? '' : v).toLowerCase();

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

function _scheduleDaysFor(issue, confidence) {
  // Higher-confidence + harder-to-reverse issues → tighter recheck.
  if (issue === 'fungal_risk')       return confidence === 'high' ? 2 : 3;
  if (issue === 'pest_damage')       return confidence === 'high' ? 1 : 2;
  if (issue === 'water_stress')      return 1;
  if (issue === 'nutrient_stress')   return 5;
  if (issue === 'healthy')           return 14;
  return 3;
}

function _followupTaskFor(issue, crop) {
  const c = crop ? String(crop) : '';
  switch (issue) {
    case 'fungal_risk':
      return _msg('scan.followup.task.fungal',
        'Re-check the underside of {crop} leaves for spots or fuzzy patches.', { crop: c });
    case 'pest_damage':
      return _msg('scan.followup.task.pest',
        'Walk the {crop} rows and check for pests near the affected area.', { crop: c });
    case 'water_stress':
      return _msg('scan.followup.task.water',
        'Check soil moisture by your {crop} and water deeply if dry.', { crop: c });
    case 'nutrient_stress':
      return _msg('scan.followup.task.nutrient',
        'Consider a soil test for your {crop} — sustained yellowing can mean nutrient gaps.', { crop: c });
    case 'healthy':
      return _msg('scan.followup.task.healthy',
        'Crop looks healthy — keep your current routine.');
    default:
      return _msg('scan.followup.task.generic',
        'Check the {crop} again in a few days and compare with this photo.', { crop: c });
  }
}

function _preventionTipFor(issue, weather) {
  const wet = !!(weather && (weather.humidityPct >= 80 || weather.rainProbability24hPct >= 60));
  switch (issue) {
    case 'fungal_risk':
      return _msg('scan.followup.prevent.fungal',
        wet
          ? 'Improve airflow between plants and water at the base, not on the leaves.'
          : 'Water at the base of the plant and remove fallen leaves to reduce spread.');
    case 'pest_damage':
      return _msg('scan.followup.prevent.pest',
        'Inspect new growth weekly — early detection is the best prevention.');
    case 'water_stress':
      return _msg('scan.followup.prevent.water',
        'A layer of mulch holds moisture and helps the soil stay even.');
    case 'nutrient_stress':
      return _msg('scan.followup.prevent.nutrient',
        'Compost or organic matter supports steady nutrient supply.');
    case 'healthy':
      return _msg('scan.followup.prevent.healthy',
        'Keep records — consistent care is what produces healthy crops.');
    default:
      return _msg('scan.followup.prevent.generic',
        'Steady care + steady observation is the best prevention.');
  }
}

function _recurrenceCheckFor(issue, scanHistory) {
  if (!Array.isArray(scanHistory) || scanHistory.length === 0) {
    return _msg('scan.followup.recurrence.firstTime',
      'This is the first time we have seen this on your farm.');
  }
  const sameKind = scanHistory.filter((s) => s && _str(s.issueCategory) === issue);
  if (sameKind.length === 0) {
    return _msg('scan.followup.recurrence.newIssue',
      'New issue — no record of this one before.');
  }
  if (sameKind.length === 1) {
    return _msg('scan.followup.recurrence.secondTime',
      'Second time we have seen this — worth watching closely.');
  }
  return _msg('scan.followup.recurrence.recurring',
    'Recurring issue — consider a soil or water-routine review.', { count: sameKind.length + 1 });
}

/**
 * Build the full follow-up plan envelope for the surface to render
 * + the memory patch the surface persists.
 *
 * @param {object} ctx
 * @returns {object}
 */
export function buildFollowupPlan(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const issue = _str(c.issueCategory) || 'unknown';
    const confidence = _str(c.confidenceLabel) || 'low';
    const nowMs = Number.isFinite(c.nowMs) ? c.nowMs : Date.now();

    // Hard rule: failed-image / needs-review scans never produce a
    // follow-up "plan" — only the calm "choose a clearer photo"
    // envelope.
    if (confidence === 'needs_review' || issue === 'unknown_needs_clearer_photo') {
      return {
        ok:           false,
        reason:       'needs_review',
        followupTask: null,
        reminder:     null,
        preventionTip:_msg('scan.followup.preventionNeedsReview',
                            'Choose a clearer photo before we suggest next steps.'),
        recurrenceCheck: null,
        memoryUpdate: null,
        disclaimer:   _msg('scan.followup.disclaimer.hedged',
                            'Scan-based guidance is a starting point — local conditions vary.'),
      };
    }

    const days = _scheduleDaysFor(issue, confidence);
    const followupTask    = _followupTaskFor(issue, c.crop);
    const preventionTip   = _preventionTipFor(issue, c.weather);
    const recurrenceCheck = _recurrenceCheckFor(issue, c.scanHistory);
    const reminder = {
      atMs: nowMs + days * _DAY,
      message: _msg('scan.followup.reminder',
        'Re-check your {crop} {days} day(s) after the scan.',
        { crop: c.crop || '', days }),
    };
    const memoryUpdate = {
      scanId:        c.scanId || null,
      issueCategory: issue,
      confidence:    confidence,
      followupAtMs:  reminder.atMs,
      generatedAt:   nowMs,
    };
    return {
      ok:           true,
      followupTask,
      reminder,
      preventionTip,
      recurrenceCheck,
      memoryUpdate,
      disclaimer:   _msg('scan.followup.disclaimer.hedged',
                          'Scan-based guidance is a starting point — local conditions vary.'),
    };
  } catch {
    return {
      ok:           false,
      reason:       'exception',
      followupTask: null,
      reminder:     null,
      preventionTip:null,
      recurrenceCheck: null,
      memoryUpdate: null,
      disclaimer:   _msg('scan.followup.disclaimer.hedged',
                          'Scan-based guidance is a starting point.'),
    };
  }
}

const _module = { buildFollowupPlan };
export default _module;
