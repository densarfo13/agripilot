/**
 * wateringEngine.js — weather-aware watering recommendation.
 *
 *   import { computeWateringRecommendation }
 *     from 'src/core/watering/wateringEngine.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure helper that turns farm/garden context + recent weather
 *   into ONE watering recommendation: water / skip / monitor, plus
 *   the ideal time, drought / overwatering risk, and a short why.
 *
 *   It does NOT generate tasks or fire notifications — those go
 *   through the existing task generator and notificationOrchestrator
 *   (no duplicate task system). It is also NOT a model: every
 *   decision is plain arithmetic over honest inputs.
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O. Honest wording — no guaranteed
 *     yield, no certainty about disease.
 */

const _str = (v) => String(v == null ? '' : v).toLowerCase();
const _num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };

export const WATERING_ACTION = Object.freeze({
  WATER:   'water',
  SKIP:    'skip',
  MONITOR: 'monitor',
});

export const WATERING_TIME = Object.freeze({
  MORNING: 'morning',
  EVENING: 'evening',
  NOW:     'now',
});

export const RISK = Object.freeze({ LOW: 'low', MEDIUM: 'medium', HIGH: 'high' });

const FALLBACK = Object.freeze({
  recommendation:   WATERING_ACTION.MONITOR,
  idealTime:        WATERING_TIME.MORNING,
  skipReason:       '',
  droughtRisk:      RISK.LOW,
  overwateringRisk: RISK.LOW,
  why:              'Check the soil before deciding.',
  next:             'Check soil moisture',
});

/** Hours since `iso`, or null when unknown/invalid (we never had a
 *  last-watered timestamp). "Unknown" must not act like "long ago". */
function _hoursSince(iso, nowMs) {
  const t = (typeof iso === 'number') ? iso : Date.parse(String(iso || ''));
  if (!Number.isFinite(t)) return null;
  return Math.max(0, ((nowMs || Date.now()) - t) / 3600000);
}

/** Pick "morning" by default; "evening" when it's already past noon. */
function _pickTime(nowMs) {
  try {
    const d = new Date(nowMs || Date.now());
    return d.getHours() < 12 ? WATERING_TIME.MORNING : WATERING_TIME.EVENING;
  } catch {
    return WATERING_TIME.MORNING;
  }
}

/** Mode-aware task line. */
function _taskLine(action, crop, mode) {
  const isFarmer = _str(mode) === 'farmer';
  const c = String(crop || '').trim();
  const name = c || (isFarmer ? 'the crop' : 'your plants');
  if (action === WATERING_ACTION.SKIP) {
    return isFarmer
      ? `Skip irrigation today — ${name}`
      : `Skip watering today — ${name}`;
  }
  if (action === WATERING_ACTION.MONITOR) {
    return isFarmer
      ? `Check soil before irrigating ${name}`
      : `Check the soil before watering ${name}`;
  }
  // water
  return isFarmer
    ? `Irrigate ${name} this morning`
    : `Water ${name} this morning`;
}

/**
 * Compute a watering recommendation.
 *
 * @param {object} input
 * @param {string} [input.crop]
 * @param {string} [input.cropStage]
 * @param {string} [input.mode]           'farmer' | 'gardener'
 * @param {string} [input.region]
 * @param {object} [input.weather]        { rainfallTodayMm, rainProbability24hPct,
 *                                          temperatureC, humidityPct,
 *                                          daysSinceRain }
 * @param {object} [input.taskHistory]    { lastWateredAt }
 * @param {object} [input.stress]         { wilting, scanStress }
 * @param {number} [input.nowMs]          injectable clock
 * @returns {object}
 */
export function computeWateringRecommendation(input) {
  try {
    const s = (input && typeof input === 'object') ? input : {};
    const mode    = _str(s.mode) === 'farmer' ? 'farmer' : 'gardener';
    const crop    = s.crop;
    const w       = (s.weather && typeof s.weather === 'object') ? s.weather : {};
    const stress  = (s.stress && typeof s.stress === 'object') ? s.stress : {};
    const hist    = (s.taskHistory && typeof s.taskHistory === 'object') ? s.taskHistory : {};
    const nowMs   = Number.isFinite(s.nowMs) ? s.nowMs : Date.now();

    const rainTodayRaw = _num(w.rainfallTodayMm);
    const rainProbRaw  = _num(w.rainProbability24hPct);
    const tempC      = _num(w.temperatureC);
    const humidity   = _num(w.humidityPct);
    const daysSince  = _num(w.daysSinceRain);
    const hoursSinceWatered = _hoursSince(hist.lastWateredAt, nowMs);

    // Honest fallback: with no weather signal AND no history AND no
    // stress, we genuinely don't know — recommend monitoring.
    const hasAnySignal = rainTodayRaw != null || rainProbRaw != null
      || tempC != null || humidity != null || daysSince != null
      || hoursSinceWatered != null
      || stress.wilting === true || _str(stress.scanStress) === 'high';
    if (!hasAnySignal) {
      return { ...FALLBACK, next: _taskLine(WATERING_ACTION.MONITOR, crop, mode) };
    }

    const rainToday = rainTodayRaw || 0;
    const rainProb  = rainProbRaw || 0;

    // ── Skip rules (rain-first; trust the sky) ───────────────
    if (rainToday >= 5) {
      return _result(WATERING_ACTION.SKIP, _pickTime(nowMs), {
        skipReason: 'It already rained today',
        droughtRisk: RISK.LOW,
        overwateringRisk: rainToday >= 15 ? RISK.HIGH : RISK.MEDIUM,
        why: 'Rain has soaked the soil — extra water risks waterlogging.',
      }, crop, mode);
    }
    if (rainProb >= 70) {
      return _result(WATERING_ACTION.SKIP, _pickTime(nowMs), {
        skipReason: 'Rain is likely later today',
        droughtRisk: RISK.LOW,
        overwateringRisk: RISK.MEDIUM,
        why: 'Rain is likely later today — wait and save the water.',
      }, crop, mode);
    }

    // ── Recently watered → avoid overwatering ────────────────
    // Unknown lastWateredAt (null) must not count as "recent".
    const recentlyWatered = hoursSinceWatered != null && hoursSinceWatered < 12;
    if (recentlyWatered && (humidity == null || humidity >= 50) && !(stress.wilting === true)) {
      return _result(WATERING_ACTION.SKIP, _pickTime(nowMs), {
        skipReason: 'You watered recently',
        droughtRisk: RISK.LOW,
        overwateringRisk: humidity != null && humidity >= 85 ? RISK.HIGH : RISK.MEDIUM,
        why: 'The soil should still be moist from the last watering.',
      }, crop, mode);
    }

    // ── Drought risk ─────────────────────────────────────────
    // Unknown signals do NOT escalate drought — only finite numbers.
    let droughtRisk = RISK.LOW;
    if ((daysSince != null && daysSince >= 7)
        || (hoursSinceWatered != null && hoursSinceWatered >= 96)) {
      droughtRisk = RISK.HIGH;
    } else if ((daysSince != null && daysSince >= 4)
        || (hoursSinceWatered != null && hoursSinceWatered >= 48)) {
      droughtRisk = RISK.MEDIUM;
    }
    if (stress.wilting === true || _str(stress.scanStress) === 'high') droughtRisk = RISK.HIGH;

    // ── Time-of-day pick ─────────────────────────────────────
    // High heat (>= 30 C) → keep watering in cool hours (morning).
    let idealTime = _pickTime(nowMs);
    if (tempC != null && tempC >= 30) idealTime = WATERING_TIME.MORNING;

    // ── High humidity → frequency damping ────────────────────
    let overwateringRisk = RISK.LOW;
    if (humidity != null && humidity >= 85) {
      overwateringRisk = RISK.MEDIUM;
      if (!recentlyWatered && droughtRisk === RISK.LOW) {
        return _result(WATERING_ACTION.MONITOR, idealTime, {
          skipReason: '',
          droughtRisk, overwateringRisk,
          why: 'Humidity is high — check the soil before adding more water.',
        }, crop, mode);
      }
    }

    // ── Default: water now (mode-aware phrasing) ─────────────
    const why = droughtRisk === RISK.HIGH
      ? 'Soil has been dry for several days — watering helps the plant recover.'
      : (tempC != null && tempC >= 30
          ? 'Warm day expected — water early so less is lost to heat.'
          : 'Routine watering keeps growth steady.');
    return _result(WATERING_ACTION.WATER, idealTime, {
      skipReason: '', droughtRisk, overwateringRisk, why,
    }, crop, mode);
  } catch {
    return { ...FALLBACK };
  }
}

function _result(action, idealTime, extras, crop, mode) {
  return {
    recommendation:   action,
    idealTime,
    skipReason:       extras.skipReason || '',
    droughtRisk:      extras.droughtRisk || RISK.LOW,
    overwateringRisk: extras.overwateringRisk || RISK.LOW,
    why:              extras.why || '',
    next:             _taskLine(action, crop, mode),
  };
}

/**
 * Build a notification spec ready for `notificationOrchestrator.
 * routeNotifications`. Returns null when no notification is needed
 * (e.g. a skip-because-rain doesn't always warrant a push).
 *
 * @param {object} rec  output of computeWateringRecommendation
 * @param {object} [opts] { id, language, mode, crop }
 */
export function wateringNotificationFor(rec, opts) {
  try {
    if (!rec || typeof rec !== 'object') return null;
    const o = (opts && typeof opts === 'object') ? opts : {};
    const id   = String(o.id || `watering_${Date.now()}`);
    const lang = String(o.language || 'en');
    const mode = _str(o.mode);
    const urgency = rec.droughtRisk === RISK.HIGH ? 'high' : 'normal';

    if (rec.recommendation === WATERING_ACTION.WATER) {
      return {
        id, kind: 'task_reminder', urgency, mode,
        title: rec.next,
        body:  rec.why,
        language: lang,
      };
    }
    if (rec.recommendation === WATERING_ACTION.SKIP && rec.overwateringRisk === RISK.HIGH) {
      return {
        id, kind: 'irrigation_warning', urgency: 'normal', mode,
        title: rec.next,
        body:  rec.why,
        language: lang,
      };
    }
    // monitor / soft skip → no push (in-app banner only). Return
    // null so orchestrator never schedules a push for it.
    return null;
  } catch {
    return null;
  }
}

const _module = {
  WATERING_ACTION,
  WATERING_TIME,
  RISK,
  computeWateringRecommendation,
  wateringNotificationFor,
};
export default _module;
