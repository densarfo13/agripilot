/**
 * taskDetails.js — richer per-task copy for the Today screen.
 *
 *   getTaskDetail(taskId, { crop } = {})
 *     -> {
 *          titleKey, titleFb,           // "Prepare rows for maize"
 *          urgencyKey, urgencyFb,       // "Urgent today"  (v2 — habit-forming flow)
 *          urgencyLevel,                // 'urgent' | 'today' | 'thisWeek'
 *          instructionKey, instrFb,     // "Make rows ~75cm apart"  (legacy back-compat)
 *          timingKey, timingFb,         // "Do this before rain starts today"
 *          riskKey, riskFb,             // "If you skip this, planting may be delayed"
 *        }
 *
 * Why both `urgency` and `instruction`?
 *   The original v1 elite-UX flow surfaced a four-row task card
 *   with title + instruction + timing + risk. The habit-forming
 *   v2 flow simplifies the visual surface to title + URGENCY +
 *   timing + risk — the instruction line moves to the voice
 *   channel (getTaskVoiceScript) so it stays accessible without
 *   crowding the visual card. Both fields are returned here so
 *   either flow can render cleanly + voice keeps the instruction
 *   text. Callers pick the field they need.
 *
 * Strict-rule audit
 *   * Pure: no I/O, no globals
 *   * Never throws on unknown task ids — falls back to the
 *     'check_farm' detail
 *   * Crop name is interpolated via {crop} placeholder so each
 *     locale can position it idiomatically
 *   * No leak: never renders the raw taskId or weight values
 */

// Urgency tiers: keep ONLY three so the visual chip never has
// to wrap to two lines on a phone width. Locales can keep the
// short phrasing under ~12 chars per the i18n overlay.
const URGENCY = Object.freeze({
  URGENT:    { level: 'urgent',    fb: 'Urgent today' },
  TODAY:     { level: 'today',     fb: 'Today'        },
  THIS_WEEK: { level: 'thisWeek',  fb: 'This week'    },
});

const _DEFAULT = Object.freeze({
  titleKey:       'today.task.checkFarm.title',
  titleFb:        'Check your farm today',
  urgencyKey:     'today.urgency.today',
  urgencyFb:      URGENCY.TODAY.fb,
  urgencyLevel:   URGENCY.TODAY.level,
  instructionKey: 'today.task.checkFarm.instruction',
  instructionFb:  'Walk through your field and look at your crops.',
  timingKey:      'today.task.checkFarm.timing',
  timingFb:       'A short check anytime today is enough.',
  riskKey:        'today.task.checkFarm.risk',
  riskFb:         'A daily look helps you catch problems early.',
});

const _DETAILS = Object.freeze({
  weed_rows: {
    titleKey:       'today.task.weedRows.title',
    titleFb:        'Weed your rows for {crop}',
    urgencyKey:     'today.urgency.today',
    urgencyFb:      URGENCY.TODAY.fb,
    urgencyLevel:   URGENCY.TODAY.level,
    instructionKey: 'today.task.weedRows.instruction',
    instructionFb:  'Pull weeds between rows with your hand or a hoe.',
    timingKey:      'today.task.weedRows.timing',
    timingFb:       'Do this in the morning before the heat.',
    riskKey:        'today.task.weedRows.risk',
    riskFb:         'If you skip this, weeds will steal water and food from your crops.',
  },

  scout_pests: {
    titleKey:       'today.task.scoutPests.title',
    titleFb:        'Check for pests on your {crop}',
    urgencyKey:     'today.urgency.urgent',
    urgencyFb:      URGENCY.URGENT.fb,
    urgencyLevel:   URGENCY.URGENT.level,
    instructionKey: 'today.task.scoutPests.instruction',
    instructionFb:  'Look at the leaves and stems closely. Check the underside of leaves.',
    timingKey:      'today.task.scoutPests.timing',
    timingFb:       'Do this today \u2014 pests spread fast.',
    riskKey:        'today.task.scoutPests.risk',
    riskFb:         'If you skip this, pests can damage your harvest.',
  },

  check_moisture: {
    titleKey:       'today.task.checkMoisture.title',
    titleFb:        'Check soil moisture for {crop}',
    urgencyKey:     'today.urgency.today',
    urgencyFb:      URGENCY.TODAY.fb,
    urgencyLevel:   URGENCY.TODAY.level,
    instructionKey: 'today.task.checkMoisture.instruction',
    instructionFb:  'Push your finger into the soil. It should be damp, not dry.',
    timingKey:      'today.task.checkMoisture.timing',
    timingFb:       'Do this before watering today.',
    riskKey:        'today.task.checkMoisture.risk',
    riskFb:         'If the soil is too dry, your crops will stress and grow slowly.',
  },

  prepare_harvest: {
    titleKey:       'today.task.prepareHarvest.title',
    titleFb:        'Prepare for harvesting {crop}',
    urgencyKey:     'today.urgency.thisWeek',
    urgencyFb:      URGENCY.THIS_WEEK.fb,
    urgencyLevel:   URGENCY.THIS_WEEK.level,
    instructionKey: 'today.task.prepareHarvest.instruction',
    instructionFb:  'Get bags or baskets ready and clear a dry storage spot.',
    timingKey:      'today.task.prepareHarvest.timing',
    timingFb:       'Do this in the next day or two.',
    riskKey:        'today.task.prepareHarvest.risk',
    riskFb:         'If you wait too long, your harvest may spoil or get pests.',
  },

  prepare_rows: {
    titleKey:       'today.task.prepareRows.title',
    titleFb:        'Prepare rows for {crop}',
    urgencyKey:     'today.urgency.urgent',
    urgencyFb:      URGENCY.URGENT.fb,
    urgencyLevel:   URGENCY.URGENT.level,
    instructionKey: 'today.task.prepareRows.instruction',
    instructionFb:  'Make rows ~75cm apart.',
    timingKey:      'today.task.prepareRows.timing',
    timingFb:       'Do this before rain starts today.',
    riskKey:        'today.task.prepareRows.risk',
    riskFb:         'If you skip this, planting may be delayed.',
  },

  check_farm: _DEFAULT,
});

function _capitaliseCrop(crop) {
  if (!crop || typeof crop !== 'string') return '';
  const trimmed = crop.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * getTaskDetail(taskId, { crop }) → 4-field detail object.
 *
 * Returns the detail map for the task, with the {crop}
 * placeholder pre-interpolated in the English fallback strings
 * so callers don't have to handle the substitution. The i18n
 * keys are returned RAW — the caller's tSafe(key, fb, vars)
 * call handles per-locale interpolation when the keys are
 * defined in the dictionary.
 */
export function getTaskDetail(taskId, { crop } = {}) {
  const detail = (taskId && _DETAILS[taskId]) || _DEFAULT;
  const cropLabel = _capitaliseCrop(crop) || 'your farm';

  return Object.freeze({
    titleKey:       detail.titleKey,
    titleFb:        String(detail.titleFb).replace(/\{crop\}/g, cropLabel),
    // Habit-forming v2: urgency chip on the simplified card
    urgencyKey:     detail.urgencyKey || _DEFAULT.urgencyKey,
    urgencyFb:      detail.urgencyFb  || _DEFAULT.urgencyFb,
    urgencyLevel:   detail.urgencyLevel || _DEFAULT.urgencyLevel,
    // Legacy back-compat: instruction text still available for
    // standard mode + voice fallback
    instructionKey: detail.instructionKey,
    instructionFb:  String(detail.instructionFb).replace(/\{crop\}/g, cropLabel),
    timingKey:      detail.timingKey,
    timingFb:       String(detail.timingFb).replace(/\{crop\}/g, cropLabel),
    riskKey:        detail.riskKey,
    riskFb:         String(detail.riskFb).replace(/\{crop\}/g, cropLabel),
    cropLabel,
  });
}

export default getTaskDetail;
