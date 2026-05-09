/**
 * soilScanEngine.js — confidence-safe soil scan v1.
 *
 *   import { analyzeSoilScan } from './lib/soilScanEngine.js';
 *
 *   const result = analyzeSoilScan({
 *     userCue: 'dry',          // user-selected visual cue
 *     weather: liveWeather,    // current live weather envelope
 *     mode:    'farm',         // 'farm' | 'garden'
 *   });
 *   // → {
 *   //     status:           'dry',
 *   //     confidence:       'medium',
 *   //     whatNoticedKey, whatNoticedFb,
 *   //     whatToCheckKey, whatToCheckFb,
 *   //     suggestedActionKey, suggestedActionFb,
 *   //     taskTitleKey, taskTitleFb,
 *   //   }
 *
 * Why heuristic, not ML
 * ─────────────────────
 *   The Soil Scan v1 spec explicitly forbids lab-grade claims
 *   (no exact pH / NPK / contamination from a single image).
 *   The honest v1: combine the USER'S visual cue choice with
 *   the live weather context to produce a calm "looks like X /
 *   here's one thing to check / here's one safe action" result.
 *   Future versions can layer image analysis on top WITHOUT
 *   changing this envelope shape.
 *
 * Categories the engine resolves to
 *   moist        — soil reads damp, no immediate concern
 *   dry          — soil looks dry; suggest moisture check
 *   waterlogging — recent heavy rain + wet appearance
 *   cracked      — surface cracks suggest dry-stress recovery
 *   mold         — surface mold/algae concern
 *   drainage     — pooling water, poor drainage concern
 *   unclear      — photo too dark / blurry / unclear
 *   review       — fallback when nothing else fits
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Never claims certainty — every output uses calm "may /
 *     possible / looks like / check / monitor" wording.
 *   • Returns frozen objects so consumers can't mutate.
 *   • No I/O — caller passes weather + cue, no fetches here.
 */

const VALID_CUES = new Set([
  'moist', 'dry', 'waterlogging', 'cracked', 'mold', 'drainage', 'unclear',
]);

function _isFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n);
}

function _coerceWeather(w) {
  if (!w || typeof w !== 'object' || Array.isArray(w)) return {};
  return w;
}

/**
 * Pick the result envelope for a given category. Returns
 * frozen { status, whatNoticedKey, suggestedActionKey, taskTitleKey, … }.
 *
 * One row per category. The keys are the i18n contracts the
 * SoilScanResultCard renders; fallbacks are conservative
 * English strings the caller can drop into tSafe().
 */
function _envelopeFor(status) {
  switch (status) {
    case 'moist':
      return Object.freeze({
        status,
        whatNoticedKey:     'soilScan.notice.moist',
        whatNoticedFb:      'Soil looks moist on the surface.',
        whatToCheckKey:     'soilScan.check.moist',
        whatToCheckFb:      'Check moisture 2 inches below the surface.',
        suggestedActionKey: 'soilScan.action.moist',
        suggestedActionFb:  'No watering needed right now — monitor again tomorrow.',
        taskTitleKey:       'soilScan.task.moist',
        taskTitleFb:        'Check soil moisture below the surface.',
      });
    case 'dry':
      return Object.freeze({
        status,
        whatNoticedKey:     'soilScan.notice.dry',
        whatNoticedFb:      'Soil looks dry on the surface.',
        whatToCheckKey:     'soilScan.check.dry',
        whatToCheckFb:      'Check moisture 2 inches below the surface.',
        suggestedActionKey: 'soilScan.action.dry',
        suggestedActionFb:  'Water slowly and check if the soil absorbs evenly.',
        taskTitleKey:       'soilScan.task.dry',
        taskTitleFb:        'Water slowly and recheck soil moisture.',
      });
    case 'waterlogging':
      return Object.freeze({
        status,
        whatNoticedKey:     'soilScan.notice.waterlogging',
        whatNoticedFb:      'Possible waterlogging near the surface.',
        whatToCheckKey:     'soilScan.check.waterlogging',
        whatToCheckFb:      'Check if water is pooling near roots.',
        suggestedActionKey: 'soilScan.action.waterlogging',
        suggestedActionFb:  'Improve drainage and avoid extra watering for now.',
        taskTitleKey:       'soilScan.task.waterlogging',
        taskTitleFb:        'Check drainage and water pooling near roots.',
      });
    case 'cracked':
      return Object.freeze({
        status,
        whatNoticedKey:     'soilScan.notice.cracked',
        whatNoticedFb:      'Soil surface looks cracked.',
        whatToCheckKey:     'soilScan.check.cracked',
        whatToCheckFb:      'Check whether the soil absorbs water evenly.',
        suggestedActionKey: 'soilScan.action.cracked',
        suggestedActionFb:  'Water slowly in stages so the soil rehydrates evenly.',
        taskTitleKey:       'soilScan.task.cracked',
        taskTitleFb:        'Water slowly and watch for even absorption.',
      });
    case 'mold':
      return Object.freeze({
        status,
        whatNoticedKey:     'soilScan.notice.mold',
        whatNoticedFb:      'Possible surface mold or algae.',
        whatToCheckKey:     'soilScan.check.mold',
        whatToCheckFb:      'Check for excess moisture or low airflow around the area.',
        suggestedActionKey: 'soilScan.action.mold',
        suggestedActionFb:  'Improve airflow and avoid overwatering.',
        taskTitleKey:       'soilScan.task.mold',
        taskTitleFb:        'Improve airflow and reduce watering.',
      });
    case 'drainage':
      return Object.freeze({
        status,
        whatNoticedKey:     'soilScan.notice.drainage',
        whatNoticedFb:      'Possible poor drainage on the surface.',
        whatToCheckKey:     'soilScan.check.drainage',
        whatToCheckFb:      'Check drainage paths around the planting area.',
        suggestedActionKey: 'soilScan.action.drainage',
        suggestedActionFb:  'Clear drainage and avoid extra watering for now.',
        taskTitleKey:       'soilScan.task.drainage',
        taskTitleFb:        'Clear drainage paths around your plants.',
      });
    case 'unclear':
      return Object.freeze({
        status,
        whatNoticedKey:     'soilScan.notice.unclear',
        whatNoticedFb:      'Photo looks unclear.',
        whatToCheckKey:     'soilScan.check.unclear',
        whatToCheckFb:      'Take a clearer photo in natural light.',
        suggestedActionKey: 'soilScan.action.unclear',
        suggestedActionFb:  'Take a clearer photo and try again.',
        taskTitleKey:       'soilScan.task.unclear',
        taskTitleFb:        'Take a clearer soil photo in natural light.',
      });
    case 'review':
    default:
      return Object.freeze({
        status: 'review',
        whatNoticedKey:     'soilScan.notice.review',
        whatNoticedFb:      'Soil condition needs a closer look.',
        whatToCheckKey:     'soilScan.check.review',
        whatToCheckFb:      'Check moisture, drainage, and surface condition.',
        suggestedActionKey: 'soilScan.action.review',
        suggestedActionFb:  'Walk the area today and note anything unusual.',
        taskTitleKey:       'soilScan.task.review',
        taskTitleFb:        'Inspect soil moisture and drainage today.',
      });
  }
}

/**
 * Resolve confidence based on inputs.
 *   • User cue + corroborating weather signal      → 'medium'
 *   • User cue alone                                → 'medium'
 *   • Weather signal alone (no cue)                 → 'low'
 *   • 'unclear' or 'review'                         → 'low'
 *   • Strong corroboration (cue + extreme weather)  → 'high'
 */
function _resolveConfidence(status, userCue, weather) {
  if (status === 'unclear' || status === 'review') return 'low';
  const w = _coerceWeather(weather);
  const rainPct = Number(w.rainChance);
  const temp    = Number(w.temp);
  const cond    = String(w.condition || '').toLowerCase();
  const recentRain = cond.includes('rain') || (Number.isFinite(rainPct) && rainPct >= 60);
  const heat       = Number.isFinite(temp) && temp >= 32;

  if (userCue === 'waterlogging' && recentRain) return 'high';
  if (userCue === 'dry' && heat)                 return 'high';
  if (VALID_CUES.has(userCue))                   return 'medium';
  return 'low';
}

/**
 * analyzeSoilScan(input) → { status, confidence, …keys }
 *
 * @param {object} input
 * @param {string} [input.userCue]    One of VALID_CUES.
 * @param {object} [input.weather]    Live weather envelope.
 * @param {'farm'|'garden'} [input.mode='farm']
 * @returns {object}                  Frozen result envelope.
 */
export function analyzeSoilScan(input) {
  const p = (input && typeof input === 'object') ? input : {};
  const cue = (typeof p.userCue === 'string' && VALID_CUES.has(p.userCue))
    ? p.userCue : null;

  // Status resolution priority:
  //   1. User cue if provided (the user is closer to the soil)
  //   2. Weather-driven inference if no cue
  //   3. 'review' fallback so callers always get a real envelope
  let status = 'review';
  if (cue) {
    status = cue;
  } else {
    const w = _coerceWeather(p.weather);
    const rainPct = Number(w.rainChance);
    const cond    = String(w.condition || '').toLowerCase();
    const temp    = Number(w.temp);
    if (cond.includes('rain') || (Number.isFinite(rainPct) && rainPct >= 70)) {
      status = 'waterlogging';
    } else if (Number.isFinite(temp) && temp >= 34) {
      status = 'dry';
    } else if (_isFiniteNumber(rainPct) && rainPct <= 20) {
      status = 'dry';
    } else {
      status = 'review';
    }
  }

  const envelope   = _envelopeFor(status);
  const confidence = _resolveConfidence(status, cue, p.weather);

  return Object.freeze({
    ...envelope,
    confidence,
    mode: (p.mode === 'garden' ? 'garden' : 'farm'),
  });
}

/**
 * Lightweight enum-style export so consumers can render chip
 * rows without copy-pasting strings.
 */
export const SOIL_SCAN_CUES = Object.freeze([
  { key: 'moist',        labelKey: 'soilScan.cue.moist',        labelFb: 'Looks moist'  },
  { key: 'dry',          labelKey: 'soilScan.cue.dry',          labelFb: 'Looks dry'    },
  { key: 'waterlogging', labelKey: 'soilScan.cue.waterlogging', labelFb: 'Possibly waterlogged' },
  { key: 'cracked',      labelKey: 'soilScan.cue.cracked',      labelFb: 'Looks cracked' },
  { key: 'mold',         labelKey: 'soilScan.cue.mold',         labelFb: 'Mold or algae' },
  { key: 'drainage',     labelKey: 'soilScan.cue.drainage',     labelFb: 'Pooling water' },
  { key: 'unclear',      labelKey: 'soilScan.cue.unclear',      labelFb: 'Photo unclear' },
]);

export default analyzeSoilScan;
