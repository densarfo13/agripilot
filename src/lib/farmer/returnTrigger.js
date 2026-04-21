/**
 * returnTrigger.js — "tomorrow preview / return loop" builder
 * (spec §9). Ships the farmer with a small, specific reason to
 * come back, replacing the dead-end "All done for now" state.
 *
 *   getReturnTrigger({ stage, crop, weather, cycleStartedAt, now })
 *     → {
 *         primary:   { textKey, text, whenKey, when },  // one line
 *         secondary: { textKey, text } | null,          // optional micro
 *         cta:       'open_tomorrow' | 'open_next_task' | 'review_progress',
 *       }
 *
 * Pure. Returns frozen strings + i18n keys; renderer picks one.
 * Never returns null — every farmer sees a return reason when
 * their tasks are done.
 */

const DAY_MS = 24 * 3600 * 1000;

function lower(s) { return String(s || '').toLowerCase(); }

// Stage-specific return lines. Short, specific, one job.
const STAGE_TRIGGERS = Object.freeze({
  land_prep:   { textKey: 'farmer.return.stage.land_prep',
                 en: 'Tomorrow: continue preparing the land.' },
  planting:    { textKey: 'farmer.return.stage.planting',
                 en: 'Tomorrow: check germination and water gently.' },
  early_growth:{ textKey: 'farmer.return.stage.early_growth',
                 en: 'Tomorrow: inspect seedlings for pests or gaps.' },
  mid_growth:  { textKey: 'farmer.return.stage.mid_growth',
                 en: 'Tomorrow: check soil moisture and weed pressure.' },
  harvest:     { textKey: 'farmer.return.stage.harvest',
                 en: 'Tomorrow: continue harvest if conditions are dry.' },
  post_harvest:{ textKey: 'farmer.return.stage.post_harvest',
                 en: 'Next 2 days: inspect stored crop for moisture.' },
});

function weatherSecondary(weather) {
  if (!weather || typeof weather !== 'object') return null;
  const status = lower(weather.status);
  if (status === 'rain_expected' || status === 'rain_coming' || status === 'heavy_rain') {
    return Object.freeze({
      textKey: 'farmer.return.weather.rain',
      text:    'Bring tools under cover tonight \u2014 rain expected.',
    });
  }
  if (status === 'excessive_heat') {
    return Object.freeze({
      textKey: 'farmer.return.weather.heat',
      text:    'Plan watering for early tomorrow morning.',
    });
  }
  if (status === 'low_rain' || status === 'dry_ahead') {
    return Object.freeze({
      textKey: 'farmer.return.weather.dry',
      text:    'Check moisture tomorrow \u2014 dry days ahead.',
    });
  }
  return null;
}

/**
 * getReturnTrigger — safe defaults guaranteed. Never returns null.
 */
export function getReturnTrigger({
  stage           = null,
  crop            = null,        // eslint-disable-line no-unused-vars
  weather         = null,
  cycleStartedAt  = null,        // eslint-disable-line no-unused-vars
  now             = Date.now(),  // eslint-disable-line no-unused-vars
} = {}) {
  const stageKey = lower(stage);
  const stageRow = STAGE_TRIGGERS[stageKey] || STAGE_TRIGGERS.mid_growth;

  const primary = Object.freeze({
    textKey: stageRow.textKey,
    text:    stageRow.en,
    whenKey: 'farmer.return.when.tomorrow',
    when:    'Tomorrow',
  });

  const secondary = weatherSecondary(weather);

  const cta = stageKey === 'harvest' || stageKey === 'post_harvest'
    ? 'review_progress'
    : 'open_tomorrow';

  return Object.freeze({
    primary,
    secondary,
    cta,
  });
}

export const _internal = Object.freeze({
  STAGE_TRIGGERS, weatherSecondary, DAY_MS,
});
