/**
 * farmFallbacks.js — defensive helpers that produce useful
 * fallback content for the My Farm screen when live data is
 * thin or missing.
 *
 * Strict contract
 * ───────────────
 *   • Pure functions. No I/O. No translation.
 *   • Never throw. Every input may be null / undefined / partial.
 *   • Output is a stable shape with i18n KEYS (not strings) so the
 *     calling component picks the localised label via tStrict.
 *
 * Why this lives in `src/lib/farm/` and not `src/intelligence/`
 * ────────────────────────────────────────────────────────────
 * The intelligence layer produces signals + recommendations.
 * These helpers produce the LANGUAGE-AGNOSTIC empty/fallback
 * content the My Farm cards render BETWEEN those signals — the
 * "Add farm size" / "Weather update pending" / "Start with
 * today's task" copy. They are presentation-adjacent, not
 * diagnostic, so they sit closer to the UI layer.
 */

// Status codes used by getFarmStatus. The caller maps each to a
// localised label key + tone.
export const FARM_STATUS = Object.freeze({
  ON_TRACK:          'on_track',
  NEEDS_ATTENTION:   'needs_attention',
  SETUP_INCOMPLETE:  'setup_incomplete',
});

// ─── Public helpers ─────────────────────────────────────────

/**
 * Determine the overall farm status from a few high-level signals.
 *
 * @param {object|null} farm
 * @param {object[]|null} tasks   today's tasks (may be empty)
 * @param {object[]|null} risks   risk-engine output array (may be empty)
 * @returns {{ code: string, key: string, fallback: string, tone: 'info'|'warn'|'ok' }}
 */
export function getFarmStatus(farm, tasks, risks) {
  try {
    if (!farm || typeof farm !== 'object') {
      return _status(FARM_STATUS.SETUP_INCOMPLETE);
    }
    // Setup incomplete — missing crop / location / size.
    // `crop` is canonical (canonicalizeFarmPayload in lib/api.js).
    const hasCrop = !!farm.crop;
    const hasLocation = !!(farm.region || farm.country || farm.countryCode || farm.location);
    const hasSize = _isPositiveNumber(farm.size ?? farm.farmSize);
    if (!hasCrop || !hasLocation || !hasSize) {
      return _status(FARM_STATUS.SETUP_INCOMPLETE);
    }

    // Needs attention — any overdue task OR any high-risk signal.
    const hasOverdue = Array.isArray(tasks)
      && tasks.some(t => t && (t.overdue === true || t.isOverdue === true));
    const hasHighRisk = Array.isArray(risks)
      && risks.some(r => r && (r.level === 'high' || r.severity === 'high'));
    if (hasOverdue || hasHighRisk) {
      return _status(FARM_STATUS.NEEDS_ATTENTION);
    }

    return _status(FARM_STATUS.ON_TRACK);
  } catch {
    return _status(FARM_STATUS.SETUP_INCOMPLETE);
  }
}

/**
 * Produce a row-by-row health summary that NEVER says "No data".
 *
 * @param {object|null} farm
 * @param {object|null} weather   raw weather payload from WeatherContext
 * @param {object[]|null} risks   pest / risk results (may be empty)
 * @returns {{
 *   weather:  { state: string, key: string, fallback: string, tone: string },
 *   pest:     { state: string, key: string, fallback: string, tone: string },
 *   planting: { state: string, key: string, fallback: string, tone: string },
 *   overall:  { code: string, key: string, fallback: string, tone: string },
 * }}
 */
export function getFarmHealth(farm, weather, risks) {
  try {
    // ─── Weather ───────────────────────────────────────────
    let weatherCell;
    if (_isUsefulWeather(weather)) {
      const high = !!(weather.severe || weather.heavyRain || weather.highWind);
      const med  = !!(weather.dry || weather.drySpell || weather.hot);
      weatherCell = high
        ? _cell('high',    'farm.fallback.weather.high',    'Weather risk high',    'warn')
        : med
          ? _cell('medium','farm.fallback.weather.medium','Weather risk moderate','info')
          : _cell('low',   'farm.fallback.weather.low',     'Weather looks calm',   'ok');
    } else {
      weatherCell = _cell('pending', 'farm.fallback.weather.pending',
        'Weather update pending', 'info');
    }

    // ─── Pest / disease risk ───────────────────────────────
    let pestCell;
    if (Array.isArray(risks) && risks.length > 0) {
      const top = risks.find(r => r && r.level === 'high')
                || risks.find(r => r && r.level === 'medium')
                || risks[0];
      const lvl = top?.level || 'low';
      pestCell = lvl === 'high'
        ? _cell('high',   'farm.fallback.pest.high',   'Pest risk high',   'warn')
        : lvl === 'medium'
          ? _cell('medium','farm.fallback.pest.medium','Pest risk moderate','info')
          : _cell('low',  'farm.fallback.pest.low',    'Pest risk low',    'ok');
    } else {
      pestCell = _cell('monitoring', 'farm.fallback.pest.monitoring',
        'Monitoring for crop risks', 'info');
    }

    // ─── Planting / stage readiness ───────────────────────
    const stage = String(farm?.cropStage || farm?.stage || '').toLowerCase();
    const PLANTING_NEAR = new Set(['planning', 'land_preparation', 'planting']);
    let plantingCell;
    if (!stage) {
      plantingCell = _cell('pending', 'farm.fallback.planting.pending',
        'Stage not set', 'info');
    } else if (PLANTING_NEAR.has(stage)) {
      plantingCell = _cell('ready', 'farm.fallback.planting.ready',
        'Ready to plant', 'ok');
    } else {
      plantingCell = _cell('growing', 'farm.fallback.planting.growing',
        'Crop growing', 'ok');
    }

    // ─── Overall ───────────────────────────────────────────
    const overall = getFarmStatus(farm, null, risks);

    return Object.freeze({
      weather:  weatherCell,
      pest:     pestCell,
      planting: plantingCell,
      overall,
    });
  } catch {
    return Object.freeze({
      weather:  _cell('pending', 'farm.fallback.weather.pending', 'Weather update pending', 'info'),
      pest:     _cell('monitoring', 'farm.fallback.pest.monitoring', 'Monitoring for crop risks', 'info'),
      planting: _cell('pending', 'farm.fallback.planting.pending', 'Stage not set', 'info'),
      overall:  _status(FARM_STATUS.SETUP_INCOMPLETE),
    });
  }
}

/**
 * Produce up to 3 contextual smart suggestions.
 *
 * @param {object|null} farm
 * @param {object[]|null} tasks
 * @param {object[]|null} listings        marketplace listings (any state)
 * @param {object[]|null} fundingMatches  matched funding opportunities
 * @returns {Array<{ key: string, fallback: string, route: string|null, priority: number }>}
 */
export function getSmartSuggestions(farm, tasks, listings, fundingMatches) {
  const out = [];
  try {
    const safeFarm = farm && typeof farm === 'object' ? farm : null;
    const todayTask = Array.isArray(tasks) && tasks.length > 0 ? tasks[0] : null;
    const taskNotDone = todayTask
      && !(todayTask.completed || todayTask.completedAt || todayTask.done);
    const hasLocation = !!(safeFarm?.region || safeFarm?.country || safeFarm?.countryCode);
    const hasSize = _isPositiveNumber(safeFarm?.size ?? safeFarm?.farmSize);
    const stage = String(safeFarm?.cropStage || safeFarm?.stage || '').toLowerCase();
    const READY_STAGES = new Set(['fruiting', 'harvest', 'post_harvest']);
    const readyToSell = safeFarm?.readyToSell === true
                     || READY_STAGES.has(stage);
    const hasListings = Array.isArray(listings) && listings.length > 0;
    const hasFunding = Array.isArray(fundingMatches) && fundingMatches.length > 0;

    // Rule priorities — lower = higher priority. Sort + slice(0, 3).

    // 1) Today's task pending → highest urgency.
    if (taskNotDone) {
      out.push({
        key:      'farm.suggest.completeToday',
        fallback: 'Complete today\u2019s task to keep your crop schedule on track.',
        route:    '/tasks',
        priority: 1,
      });
    }

    // 2) Setup gaps — surface only what's missing.
    if (!hasLocation) {
      out.push({
        key:      'farm.suggest.addLocation',
        fallback: 'Add your farm location for better weather alerts.',
        route:    '/edit-farm',
        priority: 2,
      });
    }
    if (!hasSize) {
      out.push({
        key:      'farm.suggest.addSize',
        fallback: 'Add farm size for better yield and funding estimates.',
        route:    '/edit-farm',
        priority: 2,
      });
    }

    // 3) Ready to sell.
    if (readyToSell && !hasListings) {
      out.push({
        key:      'farm.suggest.listProduceCtx',
        fallback: 'List produce when your crop is ready for buyers.',
        route:    '/sell',
        priority: 3,
      });
    }

    // 4) Funding opportunity.
    if (hasFunding) {
      out.push({
        key:      'farm.suggest.checkFundingCtx',
        fallback: 'Check funding opportunities based on your crop and region.',
        route:    '/opportunities',
        priority: 3,
      });
    }

    // 5) Generic fallback when nothing fired (e.g. fully set-up
    //    farm with no signals yet) — still better than blank.
    if (out.length === 0) {
      out.push({
        key:      'farm.suggest.exploreFunding',
        fallback: 'Explore funding opportunities for your farm.',
        route:    '/opportunities',
        priority: 4,
      });
    }

    out.sort((a, b) => a.priority - b.priority);
    return out.slice(0, 3);
  } catch {
    return [];
  }
}

/**
 * Render a value safely. If `value` is null / undefined / empty
 * string, returns `fallback`. Otherwise stringifies safely.
 *
 * @param {*} value
 * @param {string} [fallback='—']
 * @returns {string}
 */
export function formatFarmValue(value, fallback = '—') {
  try {
    if (value == null) return fallback;
    if (typeof value === 'string') {
      const s = value.trim();
      return s ? s : fallback;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : fallback;
    }
    const s = String(value).trim();
    return s ? s : fallback;
  } catch {
    return fallback;
  }
}

// ─── Internals ──────────────────────────────────────────────

const STATUS_TABLE = Object.freeze({
  on_track:          { key: 'farm.status.onTrack',         fallback: 'On track',           tone: 'ok'   },
  needs_attention:   { key: 'farm.status.needsAttention',  fallback: 'Needs attention',    tone: 'warn' },
  setup_incomplete:  { key: 'farm.status.setupIncomplete', fallback: 'Setup incomplete',   tone: 'info' },
});

function _status(code) {
  const row = STATUS_TABLE[code] || STATUS_TABLE.setup_incomplete;
  return Object.freeze({
    code,
    key:      row.key,
    fallback: row.fallback,
    tone:     row.tone,
  });
}

function _cell(state, key, fallback, tone) {
  return Object.freeze({ state, key, fallback, tone });
}

function _isPositiveNumber(v) {
  if (v == null || v === '') return false;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0;
}

function _isUsefulWeather(w) {
  if (!w || typeof w !== 'object') return false;
  // Any of these signals = the payload carries usable info.
  if (w.severe || w.heavyRain || w.highWind) return true;
  if (w.dry || w.drySpell || w.hot)           return true;
  if (typeof w.tempC === 'number')             return true;
  if (typeof w.rainMm24h === 'number')         return true;
  if (typeof w.risk === 'string')              return true;
  return false;
}
