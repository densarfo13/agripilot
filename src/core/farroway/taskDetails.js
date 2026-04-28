/**
 * taskDetails.js — richer per-task copy for the Today screen.
 *
 *   getTaskDetail(taskId, { crop } = {})
 *     -> {
 *          titleKey, titleFb,        // "Prepare rows for maize"
 *          instructionKey, instrFb,  // "Make rows ~75cm apart"
 *          timingKey, timingFb,      // "Do this before rain starts today"
 *          riskKey, riskFb,          // "If you skip this, planting may be delayed"
 *        }
 *
 * Why a separate module
 *   src/core/farroway/taskMessages.js owns the SHORT one-line
 *   message used by SMS / push notifications. The new Today
 *   screen needs four explicit fields (title + instruction +
 *   timing + risk) to match the elite-UX brief without changing
 *   the notification surface. Each field returns an i18n key +
 *   English fallback so callers route through tSafe and the
 *   six launch locales render cleanly.
 *
 * Strict-rule audit
 *   * Pure: no I/O, no globals
 *   * Never throws on unknown task ids — falls back to the
 *     'check_farm' detail
 *   * Crop name is interpolated via {crop} placeholder so each
 *     locale can position it idiomatically (English: "Prepare
 *     rows for maize"; French: "Pr\u00E9parer les rangs pour
 *     le ma\u00EFs"). Unknown crops render the generic
 *     "for your farm" fallback.
 *   * No leak: never renders the raw taskId or weight values
 */

const _DEFAULT = Object.freeze({
  titleKey:       'today.task.checkFarm.title',
  titleFb:        'Check your farm today',
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
