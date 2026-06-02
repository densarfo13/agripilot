/**
 * growthStageEngine.js — server-side growth stage derivation.
 *
 * Scan V3 §2. Pure function. Never throws.
 *
 *   import { deriveGrowthStage } from './growthStageEngine.js';
 *   const out = deriveGrowthStage({
 *     scanCategory, plantType, plantingDate, weather, healthStatus,
 *   });
 *
 * Returns:
 *   {
 *     stage:         'seeded'|'germination'|'early_growth'|'vegetative'
 *                  | 'flowering'|'fruiting'|'harvest_ready'|'unknown',
 *     confidence:    'low'|'medium'|'high',
 *     nextMilestone: { stage: <next>, daysAway: number|null, hint: string },
 *     daysSincePlanting: number|null,
 *     v: 3,
 *     limitations:   'Decision support, not a guarantee.',
 *   }
 *
 * Honest fallback: when neither planting date NOR scan signals are
 * present, returns stage='unknown' + confidence='low'. We never
 * pretend to know the stage from nothing.
 */

const _str = (v) => (typeof v === 'string' ? v : '');
const _num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// Rough days-from-planting milestones per high-level crop family.
// Falls back to a generic table when the plant family is unknown.
// All numbers are conservative midpoints; the nextMilestone hint
// is the floor of the next stage's day range.
const STAGE_TABLES = Object.freeze({
  generic: Object.freeze([
    { stage: 'seeded',        from: 0,   to: 5   },
    { stage: 'germination',   from: 5,   to: 14  },
    { stage: 'early_growth',  from: 14,  to: 30  },
    { stage: 'vegetative',    from: 30,  to: 55  },
    { stage: 'flowering',     from: 55,  to: 75  },
    { stage: 'fruiting',      from: 75,  to: 100 },
    { stage: 'harvest_ready', from: 100, to: 200 },
  ]),
  // Cereal staples (maize / sorghum / millet)
  cereal: Object.freeze([
    { stage: 'seeded',        from: 0,   to: 5   },
    { stage: 'germination',   from: 5,   to: 12  },
    { stage: 'early_growth',  from: 12,  to: 28  },
    { stage: 'vegetative',    from: 28,  to: 55  },
    { stage: 'flowering',     from: 55,  to: 75  },
    { stage: 'fruiting',      from: 75,  to: 110 },
    { stage: 'harvest_ready', from: 110, to: 160 },
  ]),
  legume: Object.freeze([
    { stage: 'seeded',        from: 0,   to: 5   },
    { stage: 'germination',   from: 5,   to: 12  },
    { stage: 'early_growth',  from: 12,  to: 28  },
    { stage: 'vegetative',    from: 28,  to: 45  },
    { stage: 'flowering',     from: 45,  to: 60  },
    { stage: 'fruiting',      from: 60,  to: 85  },
    { stage: 'harvest_ready', from: 85,  to: 120 },
  ]),
  leafy: Object.freeze([
    { stage: 'seeded',        from: 0,   to: 4   },
    { stage: 'germination',   from: 4,   to: 10  },
    { stage: 'early_growth',  from: 10,  to: 20  },
    { stage: 'vegetative',    from: 20,  to: 40  },
    { stage: 'harvest_ready', from: 40,  to: 70  },
  ]),
  fruit: Object.freeze([
    { stage: 'seeded',        from: 0,   to: 6   },
    { stage: 'germination',   from: 6,   to: 14  },
    { stage: 'early_growth',  from: 14,  to: 35  },
    { stage: 'vegetative',    from: 35,  to: 60  },
    { stage: 'flowering',     from: 60,  to: 80  },
    { stage: 'fruiting',      from: 80,  to: 130 },
    { stage: 'harvest_ready', from: 130, to: 220 },
  ]),
});

function _familyFor(plantType) {
  const t = _str(plantType).toLowerCase();
  if (/maize|corn|wheat|rice|barley|sorghum|millet|teff/.test(t)) return 'cereal';
  if (/bean|pea|cowpea|chickpea|lentil|soy|peanut|groundnut/.test(t)) return 'legume';
  if (/lettuce|spinach|kale|cabbage|chard|amaranth|moringa\s*leaf/.test(t)) return 'leafy';
  if (/tomato|pepper|okra|eggplant|squash|melon|cucumber|mango|banana|citrus|apple/.test(t)) return 'fruit';
  return 'generic';
}

function _daysSince(plantingDateIso) {
  if (!plantingDateIso) return null;
  const t = Date.parse(_str(plantingDateIso));
  if (!Number.isFinite(t)) return null;
  const days = (Date.now() - t) / (24 * 3600 * 1000);
  if (!Number.isFinite(days) || days < 0) return null;
  return Math.round(days);
}

function _stageFromTable(table, days) {
  for (const row of table) {
    if (days >= row.from && days < row.to) return row;
  }
  // Beyond the last range — peg to the last stage.
  return table[table.length - 1];
}

function _milestoneFor(table, currentStage, days) {
  const idx = table.findIndex((r) => r.stage === currentStage);
  const next = idx >= 0 ? table[idx + 1] : null;
  if (!next) return { stage: null, daysAway: null,
    hint: 'Crop is at the final stage in this model.' };
  const daysAway = Math.max(0, next.from - (days != null ? days : 0));
  return {
    stage:    next.stage,
    daysAway,
    hint:     'Next milestone: ' + String(next.stage).replace(/_/g, ' ')
              + ' in about ' + daysAway + ' day' + (daysAway === 1 ? '' : 's') + '.',
  };
}

function _stageFromScanSignal(scanCategory, healthStatus) {
  // Lightweight signal extractor — the scan classifier already
  // returns category hints (flower, fruit, plant, unknown).
  const cat = _str(scanCategory).toLowerCase();
  const health = _str(healthStatus).toLowerCase();
  if (cat === 'flower') return 'flowering';
  if (cat === 'fruit')  return 'fruiting';
  if (/ripe|mature/.test(health)) return 'harvest_ready';
  return null;
}

function _weatherSupportsGermination(weather) {
  // Coarse readiness check — warm, moist conditions favour
  // germination. Used only to lift confidence one band when
  // the planting-date answer aligns with reality.
  if (!weather || typeof weather !== 'object') return null;
  const t = _num(weather.tempHighC) ?? _num(weather.currentTempC);
  const rain = _num(weather.rainMmNext24h) ?? _num(weather.precipitationNowMm);
  if (t == null) return null;
  return t >= 15 && t <= 35 && (rain == null || rain >= 0);
}

export function deriveGrowthStage(input = {}) {
  try {
    const plantType    = _str(input.plantType);
    const plantingDate = _str(input.plantingDate);
    const days         = _daysSince(plantingDate);
    const family       = _familyFor(plantType);
    const table        = STAGE_TABLES[family] || STAGE_TABLES.generic;

    let stage      = 'unknown';
    let confidence = 'low';

    // Path A — we have a real planting date.
    if (days != null) {
      const row = _stageFromTable(table, days);
      stage = row.stage;
      confidence = 'medium';
      if (_weatherSupportsGermination(input.weather)) {
        confidence = 'high';
      }
    } else {
      // Path B — scan-signal fallback.
      const fromScan = _stageFromScanSignal(input.scanCategory, input.healthStatus);
      if (fromScan) {
        stage = fromScan;
        confidence = 'medium';
      }
    }

    const nextMilestone = (stage !== 'unknown')
      ? _milestoneFor(table, stage, days)
      : { stage: null, daysAway: null,
          hint: 'Add planting date to see the next milestone.' };

    return Object.freeze({
      stage,
      confidence,
      nextMilestone: Object.freeze(nextMilestone),
      daysSincePlanting: days,
      family,
      v: 3,
      limitations: 'Decision support, not a guarantee.',
    });
  } catch {
    return Object.freeze({
      stage: 'unknown', confidence: 'low',
      nextMilestone: Object.freeze({ stage: null, daysAway: null,
        hint: 'Add planting date to see the next milestone.' }),
      daysSincePlanting: null, family: 'generic', v: 3,
      limitations: 'Decision support, not a guarantee.',
    });
  }
}

export const _internal = Object.freeze({
  STAGE_TABLES, _familyFor, _daysSince, _stageFromTable,
  _milestoneFor, _stageFromScanSignal,
});

export default deriveGrowthStage;
