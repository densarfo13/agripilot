/**
 * dailyBriefing.js — Phase 11 morning briefing composer.
 *
 *   import { composeMorningBriefing, composeEndOfDaySummary }
 *     from 'src/runtime/today/dailyBriefing.js';
 *
 * What this is
 * ────────────
 *   Pure text composer that turns the today-engine envelope into
 *   short farmer-language briefings ready for both display and
 *   TTS. Returns frozen line arrays + a `spoken` field for voice.
 *
 *   composeMorningBriefing(envelope) — opens the day
 *   composeEndOfDaySummary(envelope, dayDelta) — closes the day
 *
 *   Both compose translation-key + default pairs so callers can
 *   localize via tSafe without re-running the engine.
 */

const RUNTIME_VERSION = 'daily-briefing-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _arr  = (v) => (Array.isArray(v) ? v : []);
const _str  = (v) => (typeof v === 'string' ? v : '');
const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _greetingFor(now) {
  return _safe(() => {
    const h = (new Date(now)).getHours();
    if (h < 12) return { key: 'today.greet.morning',   def: 'Good morning' };
    if (h < 17) return { key: 'today.greet.afternoon', def: 'Good afternoon' };
    return { key: 'today.greet.evening', def: 'Good evening' };
  }, { key: 'today.greet.generic', def: 'Hello' });
}

function _capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function _line(key, def, params) {
  return Object.freeze({ key, def, params: Object.freeze(params || {}) });
}

/**
 * Morning briefing.
 *
 * @param {{
 *   now?: number,
 *   farmerName?: string,
 *   farmHealth?: { score, band, headlineDefault, suggestionDefault },
 *   prioritizedTasks?: Array,        // output of rankTasks
 *   weatherActions?: Array,
 *   fieldRisk?: Object,
 *   forecastSummary?: string,
 * }} envelope
 */
export function composeMorningBriefing(envelope) {
  const env = _isObj(envelope) ? envelope : {};
  const now = _isNum(env.now) ? env.now : Date.now();
  const greet = _greetingFor(now);
  const name = _str(env.farmerName);

  const lines = [];

  // Greeting
  const greetingLine = name
    ? { key: 'today.briefing.greetWithName', def: '{greet}, {name}.', params: { greet: '{greet_text}', name } }
    : { key: 'today.briefing.greetGeneric',  def: '{greet}.',          params: { greet: '{greet_text}' } };
  // greet sub-key bubbles up in the spoken string below; UI can
  // resolve via tSafe(greet.key, greet.def) and substitute.
  lines.push(_line(greetingLine.key, greetingLine.def, greetingLine.params));

  // Farm health snapshot
  if (env.farmHealth && env.farmHealth.score != null) {
    lines.push(_line(
      'today.briefing.farmHealth',
      'Farm Health: {score}.',
      { score: env.farmHealth.score },
    ));
  }

  // Priority task count
  const ranked = _arr(env.prioritizedTasks);
  const doNow   = ranked.filter((r) => r && r.priority
                          && r.priority.bucket === 'do_now').length;
  const doToday = ranked.filter((r) => r && r.priority
                          && r.priority.bucket === 'do_today').length;
  const recovery = ranked.filter((r) => r && r.priority
                          && r.priority.bucket === 'recovery').length;
  const priorityCount = doNow + doToday;
  if (priorityCount > 0) {
    lines.push(_line(
      priorityCount === 1
        ? 'today.briefing.onePriorityAction'
        : 'today.briefing.priorityActions',
      priorityCount === 1
        ? '1 priority action.'
        : '{n} priority actions.',
      { n: priorityCount },
    ));
  }
  if (recovery > 0) {
    lines.push(_line(
      'today.briefing.recovery',
      '{n} task{s} need attention from earlier.',
      { n: recovery, s: recovery > 1 ? 's' : '' },
    ));
  }

  // Weather actions
  const wActs = _arr(env.weatherActions);
  if (wActs.length > 0) {
    const first = wActs[0];
    if (first && first.headlineDefault) {
      lines.push(_line(
        first.headlineKey || 'today.briefing.weatherHeadline',
        first.headlineDefault + '.',
        {},
      ));
    }
    if (first && first.bodyDefault) {
      lines.push(_line(
        first.bodyKey || 'today.briefing.weatherBody',
        first.bodyDefault,
        {},
      ));
    }
  } else if (env.forecastSummary) {
    lines.push(_line('today.briefing.forecastSummary', env.forecastSummary, {}));
  }

  // Risk hint
  if (env.fieldRisk && env.fieldRisk.topLevel === 'high') {
    lines.push(_line(
      'today.briefing.fieldRiskHigh',
      'A high risk is active in your fields today.',
      {},
    ));
  }

  // Spoken composition — short, farmer-language. Substitute the
  // greeting text inline so TTS reads cleanly.
  const spokenParts = [];
  spokenParts.push((name ? `${greet.def}, ${name}.` : `${greet.def}.`));
  if (env.farmHealth && env.farmHealth.score != null) {
    spokenParts.push(`Farm health is ${env.farmHealth.score}.`);
  }
  if (priorityCount > 0) {
    spokenParts.push(
      priorityCount === 1
        ? '1 priority action today.'
        : `${priorityCount} priority actions today.`,
    );
  }
  if (wActs.length > 0 && wActs[0] && wActs[0].headlineDefault) {
    spokenParts.push(_capitalize(wActs[0].headlineDefault) + '. '
      + (_str(wActs[0].bodyDefault)));
  }

  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    greeting:       greet,
    lines:          Object.freeze(lines),
    spoken:         spokenParts.join(' ').replace(/\s+/g, ' ').trim(),
    counts: Object.freeze({
      doNow, doToday, recovery, total: ranked.length,
    }),
  });
}

/**
 * End-of-day summary.
 *
 * @param {Object} envelope
 * @param {{
 *   tasksCompletedToday?: number,
 *   healthDelta?: number,
 *   weatherEvents?: Array,
 *   yieldImpact?: { direction, note },
 * }} dayDelta
 */
export function composeEndOfDaySummary(envelope, dayDelta) {
  const dd = _isObj(dayDelta) ? dayDelta : {};
  const lines = [];
  lines.push(_line(
    'today.endOfDay.headline',
    'End of day summary.',
    {},
  ));
  if (_isNum(dd.tasksCompletedToday) && dd.tasksCompletedToday > 0) {
    lines.push(_line(
      'today.endOfDay.tasksCompleted',
      'You completed {n} task{s} today.',
      { n: dd.tasksCompletedToday, s: dd.tasksCompletedToday > 1 ? 's' : '' },
    ));
  }
  if (_isNum(dd.healthDelta) && dd.healthDelta !== 0) {
    const dir = dd.healthDelta > 0 ? 'up' : 'down';
    const abs = Math.abs(dd.healthDelta);
    lines.push(_line(
      'today.endOfDay.healthDelta',
      'Farm health went {dir} by {abs} points.',
      { dir, abs },
    ));
  }
  const events = _arr(dd.weatherEvents);
  if (events.length > 0) {
    lines.push(_line(
      'today.endOfDay.weather',
      '{n} weather event{s} affected your area.',
      { n: events.length, s: events.length > 1 ? 's' : '' },
    ));
  }
  if (_isObj(dd.yieldImpact) && dd.yieldImpact.note) {
    lines.push(_line(
      'today.endOfDay.yield',
      _str(dd.yieldImpact.note),
      {},
    ));
  }
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    lines: Object.freeze(lines),
  });
}

export const _internal = Object.freeze({ _greetingFor });
