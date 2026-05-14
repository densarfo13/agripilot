/**
 * voiceTelemetry — analytics helpers for the Voice Guide V1 layer.
 *
 *   trackVoicePlayed({ source, lang });
 *   trackVoiceStopped({ source });
 *   trackVoiceUnavailable({ reason });
 *   trackVoiceLanguageSelected({ from, to });
 *
 * Why a dedicated wrapper
 *   The Voice Guide V1 spec calls for four distinct telemetry
 *   events. Each call goes through the existing safeTrackEvent
 *   pipeline so analytics failure NEVER breaks the UI. The
 *   wrapper exists so a caller can fire the right event with a
 *   one-line import + no event-name typos.
 *
 * Strict-rule audit
 *   * Never throws. safeTrackEvent already swallows; this layer
 *     adds a second try/catch so an import-time failure of the
 *     analytics module is also tolerated.
 *   * No PII. Only short tag strings ('home_recommendation',
 *     'scan_result', 'task_card', 'weather_warning') reach the
 *     analytics layer.
 */

import { safeTrackEvent } from '../analytics.js';

export const VOICE_EVENTS = Object.freeze({
  PLAYED:              'voice_played',
  STOPPED:             'voice_stopped',
  UNAVAILABLE:         'voice_unavailable',
  LANGUAGE_SELECTED:   'voice_language_selected',
});

const _ALLOWED_SOURCES = new Set([
  'home_recommendation',
  'home_weather_warning',
  'task_card',
  'task_why',
  'scan_result',
  'scan_recommendation',
  'weather_warning',
  'sell_prompt',
  'unknown',
]);

function _safeSource(source) {
  if (typeof source === 'string' && _ALLOWED_SOURCES.has(source)) return source;
  return 'unknown';
}

function _safeLang(lang) {
  if (typeof lang !== 'string') return 'unknown';
  const norm = lang.trim().toLowerCase();
  if (!norm) return 'unknown';
  // BCP-47 shape (en, en-US, tw-GH) — anything else collapses.
  return /^[a-z]{2}(-[a-z]{2})?$/.test(norm) ? norm : 'unknown';
}

function _fire(event, payload) {
  try {
    safeTrackEvent(event, payload || {});
  } catch { /* swallow — analytics failure never breaks UI */ }
}

/**
 * Voice playback started.
 *
 * @param {object} [input]
 * @param {string} [input.source]  which surface played
 * @param {string} [input.lang]    BCP-47 tag actually used
 * @param {number} [input.charCount] length of the spoken text
 */
export function trackVoicePlayed(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  _fire(VOICE_EVENTS.PLAYED, {
    source:    _safeSource(safe.source),
    lang:      _safeLang(safe.lang),
    charCount: Number.isFinite(safe.charCount) ? Math.min(2000, safe.charCount) : null,
  });
}

/** User tapped Stop OR navigation cancelled playback. */
export function trackVoiceStopped(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  _fire(VOICE_EVENTS.STOPPED, {
    source: _safeSource(safe.source),
    reason: typeof safe.reason === 'string' ? safe.reason.slice(0, 32) : 'user_action',
  });
}

/** Voice service unavailable (browser missing speechSynthesis, etc). */
export function trackVoiceUnavailable(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  _fire(VOICE_EVENTS.UNAVAILABLE, {
    reason: typeof safe.reason === 'string' ? safe.reason.slice(0, 64) : 'unknown',
  });
}

/** User changed their preferred voice language in Settings. */
export function trackVoiceLanguageSelected(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  _fire(VOICE_EVENTS.LANGUAGE_SELECTED, {
    from: _safeLang(safe.from),
    to:   _safeLang(safe.to),
  });
}

const _module = {
  VOICE_EVENTS,
  trackVoicePlayed,
  trackVoiceStopped,
  trackVoiceUnavailable,
  trackVoiceLanguageSelected,
};
export default _module;
