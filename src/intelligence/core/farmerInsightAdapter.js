/**
 * farmerInsightAdapter — last-mile translator from internal
 * intelligence outputs to the calm, action-framed shape the
 * farmer UI renders.
 *
 * SPEC §9
 *   Input:  Prediction | RiskEstimate | Recommendation
 *   Output: { title, message, actionLabel, actionRoute,
 *             timeEstimate, confidenceLabel }
 *
 * RULES (spec §13 safety)
 *   • Hides numeric scores, internal flags, fraud language.
 *   • Strips any FORBIDDEN_USER_WORDING substring as a final
 *     safety net (case-insensitive).
 *   • Never throws. Returns a stable shape even with missing input.
 *   • Confidence label only renders when low — surfaces "Needs
 *     review"; medium/high don't show a badge so the UI stays
 *     uncluttered.
 */

import {
  CONFIDENCE,
  FORBIDDEN_USER_WORDING,
  PREDICTION_TYPE,
  RISK_TYPE,
} from './intelligenceTypes.js';
import { confidenceLabel } from './confidence.js';

// ─── Forbidden-wording filter ────────────────────────────────────

/**
 * Strip every forbidden substring (case-insensitive). The output
 * is the original string with each match replaced by an empty
 * string. Whitespace is collapsed afterwards so removing a word
 * mid-sentence doesn't leave a double space.
 */
export function forbiddenWordingFilter(text) {
  if (!text || typeof text !== 'string') return '';
  let out = text;
  for (const phrase of FORBIDDEN_USER_WORDING) {
    if (!phrase) continue;
    // RegExp escape — we treat phrases as literal substrings.
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'gi'), '');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

// ─── Action route + label maps ───────────────────────────────────

const ROUTE_FOR_ACTION = Object.freeze({
  check_drainage:        '/tasks',
  check_soil_moisture:   '/scan/soil',
  inspect_lower_leaves:  '/scan',
  prepare_listing:       '/sell',
  add_location:          '/my-farm',
  complete_profile:      '/my-farm',
  improve_listing:       '/sell',
  scan_followup:         '/scan',
  celebrate_progress:    '/progress',
});

const LABEL_FOR_ACTION = Object.freeze({
  check_drainage:        'Start check',
  check_soil_moisture:   'Check soil',
  inspect_lower_leaves:  'Open scan',
  prepare_listing:       'Start listing',
  add_location:          'Add region',
  complete_profile:      'Complete profile',
  improve_listing:       'Add a photo',
  scan_followup:         'Open scan',
  celebrate_progress:    'See progress',
});

const TIME_FOR_ACTION = Object.freeze({
  check_drainage:        '2 min',
  check_soil_moisture:   '2 min',
  inspect_lower_leaves:  '3 min',
  prepare_listing:       '4 min',
  add_location:          '1 min',
  complete_profile:      '3 min',
  improve_listing:       '2 min',
  scan_followup:         '3 min',
  celebrate_progress:    '1 min',
});

// Title hints per prediction / risk type. Kept short — the
// message line carries the calm, action-framed copy.
const TITLE_FOR_PREDICTION = Object.freeze({
  [PREDICTION_TYPE.WEATHER_PREP]:    'Weather note',
  [PREDICTION_TYPE.SCAN_FOLLOWUP]:   'Follow-up check',
  [PREDICTION_TYPE.SOIL_FOLLOWUP]:   'Soil follow-up',
  [PREDICTION_TYPE.HARVEST_LISTING]: 'Harvest soon',
  [PREDICTION_TYPE.LOCATION_SETUP]:  'Set your region',
  [PREDICTION_TYPE.GROWTH_MOMENTUM]: 'Nice progress',
  [PREDICTION_TYPE.TASK_NUDGE]:      'Today’s focus',
  [PREDICTION_TYPE.GENERIC]:         'Today’s tip',
});

const TITLE_FOR_RISK = Object.freeze({
  [RISK_TYPE.WEATHER]:         'Weather note',
  [RISK_TYPE.MOISTURE]:        'Soil note',
  [RISK_TYPE.PEST]:            'Plant check',
  [RISK_TYPE.DISEASE]:         'Plant check',
  [RISK_TYPE.HARVEST_DELAY]:   'Harvest note',
  [RISK_TYPE.BUYER_READINESS]: 'Buyer note',
  [RISK_TYPE.DATA_CONFIDENCE]: 'Quick setup',
});

// ─── Public adapter ──────────────────────────────────────────────

/**
 * Convert a Prediction or RiskEstimate (or a plain `{ message,
 * actionType }` envelope) into a FarmerInsight. Never throws.
 *
 * @param {object} internal
 * @returns {import('./intelligenceTypes.js').FarmerInsight|null}
 */
export function toFarmerFriendlyInsight(internal) {
  if (!internal || typeof internal !== 'object') return null;

  // Try to detect input shape: Prediction | RiskEstimate | plain.
  const action = String(
    internal.recommendedAction
    || internal.action
    || '',
  );
  const message = String(
    internal.userFacingText
    || internal.message
    || '',
  );

  // Title — derived from typed payload when available, else
  // a generic calm header.
  let title = '';
  if (internal.predictionType && TITLE_FOR_PREDICTION[internal.predictionType]) {
    title = TITLE_FOR_PREDICTION[internal.predictionType];
  } else if (internal.riskType && TITLE_FOR_RISK[internal.riskType]) {
    title = TITLE_FOR_RISK[internal.riskType];
  } else if (internal.title) {
    title = String(internal.title);
  } else {
    title = 'Today’s tip';
  }

  const confidence = String(internal.confidence || '').toLowerCase();
  // We surface a confidence chip ONLY when low — that's the cue
  // to show "Needs review". Medium/high stay quiet (spec §12).
  const showConfidence = (confidence === CONFIDENCE.LOW);

  // Filter every visible string through the forbidden-word net.
  const safeTitle   = forbiddenWordingFilter(title)   || 'Today’s tip';
  const safeMessage = forbiddenWordingFilter(message) || 'Take a moment to check on your plants.';
  const actionLabel = LABEL_FOR_ACTION[action] || 'Open';
  const actionRoute = ROUTE_FOR_ACTION[action] || '/tasks';
  const timeEstimate = TIME_FOR_ACTION[action] || '2 min';

  return Object.freeze({
    title:           safeTitle,
    message:         safeMessage,
    actionLabel,
    actionRoute,
    timeEstimate,
    confidenceLabel: showConfidence ? confidenceLabel(CONFIDENCE.LOW) : null,
  });
}

const _module = { toFarmerFriendlyInsight, forbiddenWordingFilter };
export default _module;
