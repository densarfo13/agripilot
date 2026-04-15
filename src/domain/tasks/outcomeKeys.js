/**
 * outcomeKeys — maps task types/titles to outcome translation keys.
 *
 * Outcome text tells the farmer what was achieved, not just "done".
 * Each key resolves to a short, practical, localized line.
 */

const TYPE_OUTCOMES = {
  dry_harvest:         'outcome.dryHarvest',
  drying:              'outcome.dryHarvest',
  water_crop:          'outcome.waterCrop',
  watering:            'outcome.waterCrop',
  irrigation:          'outcome.waterCrop',
  check_pests:         'outcome.checkPests',
  pest_check:          'outcome.checkPests',
  pest_inspection:     'outcome.checkPests',
  spray_crop:          'outcome.sprayCrop',
  spraying:            'outcome.sprayCrop',
  protect_harvest:     'outcome.protectHarvest',
  rain_protection:     'outcome.protectHarvest',
  log_harvest:         'outcome.logHarvest',
  harvest_record:      'outcome.logHarvest',
  harvest:             'outcome.harvest',
  weed_field:          'outcome.weedField',
  weeding:             'outcome.weedField',
  fertilize:           'outcome.fertilize',
  fertilizing:         'outcome.fertilize',
  plant_crop:          'outcome.plantCrop',
  planting:            'outcome.plantCrop',
  land_prep:           'outcome.landPrep',
  land_preparation:    'outcome.landPrep',
  sort_clean:          'outcome.sortClean',
  sorting:             'outcome.sortClean',
  store_harvest:       'outcome.storeHarvest',
  storage:             'outcome.storeHarvest',
  update_stage:        'outcome.updateStage',
  stage_update:        'outcome.updateStage',
};

// Title keyword fallbacks — if actionType doesn't match, check the title
const TITLE_KEYWORDS = [
  { pattern: /dry/i,            key: 'outcome.dryHarvest' },
  { pattern: /water|irrigat/i,  key: 'outcome.waterCrop' },
  { pattern: /pest|insect/i,    key: 'outcome.checkPests' },
  { pattern: /spray/i,          key: 'outcome.sprayCrop' },
  { pattern: /rain|protect/i,   key: 'outcome.protectHarvest' },
  { pattern: /harvest|yield/i,  key: 'outcome.harvest' },
  { pattern: /weed/i,           key: 'outcome.weedField' },
  { pattern: /fertili/i,        key: 'outcome.fertilize' },
  { pattern: /plant|sow/i,      key: 'outcome.plantCrop' },
  { pattern: /land.*prep|clear/i, key: 'outcome.landPrep' },
  { pattern: /sort|clean|grad/i,  key: 'outcome.sortClean' },
  { pattern: /stor/i,           key: 'outcome.storeHarvest' },
  { pattern: /log|record/i,     key: 'outcome.logHarvest' },
];

/**
 * Resolve outcome translation key for a completed task.
 * @param {string} actionType - Task action type
 * @param {string} title - Task title (fallback matching)
 * @returns {string|null} Translation key or null
 */
export function getOutcomeKey(actionType, title) {
  // Direct type match
  if (actionType && TYPE_OUTCOMES[actionType]) {
    return TYPE_OUTCOMES[actionType];
  }

  // Normalized type match (lowercase, underscored)
  if (actionType) {
    const normalized = actionType.toLowerCase().replace(/[-\s]+/g, '_');
    if (TYPE_OUTCOMES[normalized]) return TYPE_OUTCOMES[normalized];
  }

  // Title keyword fallback
  if (title) {
    for (const { pattern, key } of TITLE_KEYWORDS) {
      if (pattern.test(title)) return key;
    }
  }

  return null;
}
