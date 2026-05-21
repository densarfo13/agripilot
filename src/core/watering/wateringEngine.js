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

export const URGENCY = Object.freeze({ LOW: 'low', NORMAL: 'normal', HIGH: 'high' });

// Localization seam — every user-visible string has a translation
// key + English fallback. No hardcoded English on the UI side.
const MSG = Object.freeze({
  WATER_NOW:       { key: 'watering.msg.water_now',       fallback: 'Water {crop} this morning.' },
  WATER_FARMER:    { key: 'watering.msg.water_farmer',    fallback: 'Irrigate {crop} this morning.' },
  WATER_EVENING:   { key: 'watering.msg.water_evening',   fallback: 'Water {crop} in the evening.' },
  WATER_DROUGHT:   { key: 'watering.msg.water_drought',   fallback: 'Soil may be dry — water {crop} this morning.' },
  SKIP_RAIN_PAST:  { key: 'watering.msg.skip_rain_past',  fallback: 'It already rained today. You may skip watering.' },
  SKIP_RAIN_SOON:  { key: 'watering.msg.skip_rain_soon',  fallback: 'Rain is likely later today. You may skip watering.' },
  SKIP_RECENT:     { key: 'watering.msg.skip_recent',     fallback: 'You watered recently. Wait before adding more.' },
  MONITOR_HUMID:   { key: 'watering.msg.monitor_humid',   fallback: 'Humidity is high — check the soil before watering.' },
  MONITOR_FUNGAL:  { key: 'watering.msg.monitor_fungal',  fallback: 'Possible fungal issue — check the soil and water at the base, not on the leaves.' },
  MONITOR_UNKNOWN: { key: 'watering.msg.monitor_unknown', fallback: 'Check the soil before deciding.' },
});

// Scan categories that mean "do not push more water onto leaves".
const WET_DISEASE_CATEGORIES = new Set(['fungal', 'mold', 'rot', 'mildew']);

const FALLBACK = Object.freeze({
  recommendation:    WATERING_ACTION.MONITOR,
  shouldWaterToday:  false,
  idealTime:         WATERING_TIME.MORNING,
  bestTime:          WATERING_TIME.MORNING,
  skipReason:        '',
  urgency:           URGENCY.LOW,
  droughtRisk:       RISK.LOW,
  overwateringRisk:  RISK.LOW,
  risk:              RISK.LOW,
  why:               'Check the soil before deciding.',
  next:              'Check soil moisture',
  localizedMessage:  { ...MSG.MONITOR_UNKNOWN, params: {} },
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

/** Combine drought + overwatering risk into a single signal. */
function _combinedRisk(drought, overwater) {
  if (drought === RISK.HIGH || overwater === RISK.HIGH) return RISK.HIGH;
  if (drought === RISK.MEDIUM || overwater === RISK.MEDIUM) return RISK.MEDIUM;
  return RISK.LOW;
}

/** Urgency reflects how much the user should care RIGHT NOW. */
function _urgencyOf(action, droughtRisk, hasWetDisease) {
  if (hasWetDisease) return URGENCY.NORMAL;          // act, but not "urgent push"
  if (action === WATERING_ACTION.WATER && droughtRisk === RISK.HIGH) return URGENCY.HIGH;
  if (action === WATERING_ACTION.SKIP) return URGENCY.LOW;
  if (action === WATERING_ACTION.MONITOR) return URGENCY.LOW;
  return URGENCY.NORMAL;
}

/** Build a { key, fallback, params } localized-message envelope. */
function _msg(template, params) {
  const p = params && typeof params === 'object' ? params : {};
  return { key: template.key, fallback: template.fallback, params: { ...p } };
}

/**
 * Localize a `localizedMessage` envelope with a tSafe-style
 * translator `t(key, fallback)`. Substitutes `{paramName}` in the
 * translated/fallback string with values from `params`.
 *
 * @param {{ key, fallback, params? }} msg
 * @param {(key:string, fallback:string)=>string} [t]
 * @returns {string}
 */
export function localizeWateringMessage(msg, t) {
  try {
    if (!msg || typeof msg !== 'object') return '';
    const translator = typeof t === 'function' ? t : (_k, fb) => fb;
    let text = translator(msg.key, msg.fallback) || '';
    const params = msg.params && typeof msg.params === 'object' ? msg.params : {};
    text = String(text).replace(/\{(\w+)\}/g, (_m, name) => {
      const v = params[name];
      return v == null ? '' : String(v);
    });
    // Collapse leftover whitespace from empty {crop} substitutions.
    return text.replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
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
    // Accept a `snapshot` (from getIntelligenceSnapshot()) and pull
    // its weather / stress / mode / crop / region when the caller
    // hasn't passed them explicitly. Explicit fields ALWAYS win.
    const snap = (s.snapshot && typeof s.snapshot === 'object') ? s.snapshot : {};

    const mode    = _str(s.mode || snap.mode) === 'farmer' ? 'farmer' : 'gardener';
    const crop    = s.crop || snap.crop || null;
    const w       = (s.weather && typeof s.weather === 'object')
      ? s.weather
      : (snap.weather && typeof snap.weather === 'object' ? snap.weather : {});
    const stress  = (s.stress && typeof s.stress === 'object')
      ? s.stress
      : (snap.scanStress && typeof snap.scanStress === 'object' ? snap.scanStress : {});
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
        message: MSG.SKIP_RAIN_PAST,
      }, crop, mode);
    }
    if (rainProb >= 70) {
      return _result(WATERING_ACTION.SKIP, _pickTime(nowMs), {
        skipReason: 'Rain is likely later today',
        droughtRisk: RISK.LOW,
        overwateringRisk: RISK.MEDIUM,
        why: 'Rain is likely later today — wait and save the water.',
        message: MSG.SKIP_RAIN_SOON,
      }, crop, mode);
    }

    // ── Scan-aware adjustment (§4) ───────────────────────────
    // Fungal / mold / rot → REDUCE watering and avoid wetting
    // leaves. Honest wording: "check the soil first" — never
    // claim moisture without sensor support (§11).
    const scanCategory = _str(stress.category || stress.issueCategory);
    const hasWetDisease = WET_DISEASE_CATEGORIES.has(scanCategory);
    if (hasWetDisease) {
      return _result(WATERING_ACTION.MONITOR, _pickTime(nowMs), {
        skipReason: '',
        droughtRisk: RISK.LOW,
        overwateringRisk: RISK.HIGH,
        why: 'Possible fungal stress — check the soil and water at the base, not on the leaves.',
        message: MSG.MONITOR_FUNGAL,
        hasWetDisease: true,
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
        message: MSG.SKIP_RECENT,
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
          message: MSG.MONITOR_HUMID,
        }, crop, mode);
      }
    }

    // ── Default: water now (mode-aware phrasing) ─────────────
    const why = droughtRisk === RISK.HIGH
      ? 'Soil has been dry for several days — watering helps the plant recover.'
      : (tempC != null && tempC >= 30
          ? 'Warm day expected — water early so less is lost to heat.'
          : 'Routine watering keeps growth steady.');
    const defaultMsg = droughtRisk === RISK.HIGH
      ? MSG.WATER_DROUGHT
      : (mode === 'farmer' ? MSG.WATER_FARMER
          : (idealTime === WATERING_TIME.EVENING ? MSG.WATER_EVENING : MSG.WATER_NOW));
    return _result(WATERING_ACTION.WATER, idealTime, {
      skipReason: '', droughtRisk, overwateringRisk, why, message: defaultMsg,
    }, crop, mode);
  } catch {
    return { ...FALLBACK };
  }
}

function _result(action, idealTime, extras, crop, mode) {
  const droughtRisk      = extras.droughtRisk || RISK.LOW;
  const overwateringRisk = extras.overwateringRisk || RISK.LOW;
  const hasWetDisease    = !!extras.hasWetDisease;
  const cropName         = String(crop || '').trim();
  // Pick the right template if the caller didn't pass one explicitly.
  const template = extras.message || (
    action === WATERING_ACTION.WATER
      ? (mode === 'farmer' ? MSG.WATER_FARMER
          : (droughtRisk === RISK.HIGH ? MSG.WATER_DROUGHT : MSG.WATER_NOW))
      : (action === WATERING_ACTION.SKIP ? MSG.SKIP_RAIN_PAST : MSG.MONITOR_UNKNOWN)
  );
  const params = { ...(extras.params || {}), crop: cropName || (mode === 'farmer' ? 'the crop' : 'your plants') };
  return {
    recommendation:    action,
    shouldWaterToday:  action === WATERING_ACTION.WATER,
    idealTime,
    bestTime:          idealTime,
    skipReason:        extras.skipReason || '',
    urgency:           _urgencyOf(action, droughtRisk, hasWetDisease),
    droughtRisk,
    overwateringRisk,
    risk:              _combinedRisk(droughtRisk, overwateringRisk),
    why:               extras.why || '',
    next:              _taskLine(action, crop, mode),
    localizedMessage:  _msg(template, params),
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
  URGENCY,
  computeWateringRecommendation,
  wateringNotificationFor,
  localizeWateringMessage,
};
export default _module;
