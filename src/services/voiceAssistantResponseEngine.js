/**
 * voiceAssistantResponseEngine — pure command-to-envelope mapper
 * for the Context-Aware Voice Assistant V2.
 *
 *   import { answerCommand, VOICE_COMMANDS }
 *     from '../services/voiceAssistantResponseEngine.js';
 *
 *   const envelope = answerCommand({
 *     command:        'should i water today',
 *     farmContext:    { farm, crop, farmType, backyardType },
 *     weather:        { rainChance: 70, temp: 22 },
 *     tasks:          [...],
 *     lastScan:       {...},
 *     recommendation: {...},
 *     language:       'en',
 *   });
 *   //   {
 *   //     intent:         'should_water_today',
 *   //     spokenText:     'Check soil first. Rain may come later...',
 *   //     displayText:    same as spoken
 *   //     actionType:     null,
 *   //     actionPayload:  null,
 *   //     requiresConfirmation: false,
 *   //     confidenceTone: 'likely',
 *   //   }
 *
 * Why a SEPARATE engine
 *   The existing lib/voiceAssistant.js ships 6 intents from the
 *   Proactive Farm Intelligence spec. The V2 spec adds 10
 *   commands AND adds an actionType field so the host can
 *   safely perform reads / navigate / create-task / save-scan
 *   without the engine itself touching state. Keeping V2 in its
 *   own module avoids drifting the existing V1 routes + lets
 *   tests pin the V2 contract independently.
 *
 * Safety contract
 *   * The engine returns ONLY envelopes — it never mutates app
 *     state, never calls APIs, never speaks. The host wires the
 *     spokenText into the existing TTS layer + the actionType
 *     into the appropriate dispatcher.
 *   * Destructive / state-changing actions (add_task / save_scan
 *     / mark_complete) ALWAYS set requiresConfirmation:true. The
 *     host must show a yes/no prompt before performing them.
 *   * Forbidden actions (delete_farm, change_settings, sell_produce,
 *     submit_funding, send_buyer_message, prescribe_chemicals)
 *     have NO mapping. An unsupported command falls through to a
 *     calm "I can help with..." reply.
 *   * Watering advice never claims exact soil moisture unless
 *     the soil sensor / API supports it (we don't have one in
 *     V2; the answer always hedges with "feels dry").
 *   * NO agronomy hallucination. Every spoken sentence is
 *     composed from data we ALREADY hold (recommendation /
 *     lastScan / tasks / weather). Missing data -> calm "no
 *     info yet" copy, never invented advice.
 *
 * Strict-rule audit
 *   * Pure function. Never throws. Frozen output.
 *   * Low-literacy copy: short sentences, one action per reply.
 *   * No raw API output reaches spokenText.
 */

export const VOICE_COMMANDS = Object.freeze({
  WHAT_TO_DO_TODAY:    'what_to_do_today',
  READ_MY_TASK:        'read_my_task',
  NEXT_TASK:           'next_task',
  NEEDS_ATTENTION:     'needs_attention',
  SHOULD_WATER:        'should_water_today',
  READ_SCAN_RESULT:    'read_scan_result',
  LAST_SCAN_SAID:      'last_scan_said',
  WEATHER_ADVICE:      'weather_advice',
  SAVE_THIS_SCAN:      'save_this_scan',
  ADD_TO_TASKS:        'add_to_tasks',
  UNSUPPORTED:         'unsupported',
});

export const VOICE_ACTIONS = Object.freeze({
  READ:                'read',          // pure read — no side effect
  NAVIGATE:            'navigate',      // host routes to a path
  CREATE_TASK_FROM_SCAN: 'create_task_from_scan',
  SAVE_CURRENT_SCAN:   'save_current_scan',
  MARK_TASK_COMPLETE:  'mark_task_complete',
});

// ─── Intent routing ──────────────────────────────────────────
//
// Each entry: ordered list of keyword phrases. The longest match
// wins so "what is my next task" hits NEXT_TASK before
// WHAT_TO_DO_TODAY (which would otherwise grab "what").

const _PHRASE_MAP = Object.freeze([
  // Most specific first — order MATTERS.
  { intent: VOICE_COMMANDS.LAST_SCAN_SAID,    phrases: ['last scan said', 'what did my last scan', 'previous scan'] },
  { intent: VOICE_COMMANDS.READ_SCAN_RESULT,  phrases: ['read my scan', 'read the scan', 'read scan result'] },
  { intent: VOICE_COMMANDS.SAVE_THIS_SCAN,    phrases: ['save this scan', 'save the scan', 'save my scan'] },
  { intent: VOICE_COMMANDS.ADD_TO_TASKS,      phrases: ['add this to tasks', 'add to tasks', 'add to my tasks', 'create task'] },
  { intent: VOICE_COMMANDS.NEXT_TASK,         phrases: ['next task', 'what is my next task'] },
  { intent: VOICE_COMMANDS.READ_MY_TASK,      phrases: ['read my task', 'read the task', 'read today task'] },
  { intent: VOICE_COMMANDS.NEEDS_ATTENTION,   phrases: ['needs attention', 'what needs my attention'] },
  { intent: VOICE_COMMANDS.SHOULD_WATER,      phrases: ['should i water', 'do i need to water', 'water today'] },
  { intent: VOICE_COMMANDS.WEATHER_ADVICE,    phrases: ['weather advice', 'what about the weather', 'weather today'] },
  { intent: VOICE_COMMANDS.WHAT_TO_DO_TODAY,  phrases: ['what should i do today', 'what to do today', 'today plan'] },
]);

function _routeIntent(command) {
  const c = typeof command === 'string' ? command.toLowerCase().trim() : '';
  if (!c) return VOICE_COMMANDS.UNSUPPORTED;
  let best = null;
  let bestLen = 0;
  for (const row of _PHRASE_MAP) {
    for (const phrase of row.phrases) {
      if (c.includes(phrase) && phrase.length > bestLen) {
        best = row.intent;
        bestLen = phrase.length;
      }
    }
  }
  return best || VOICE_COMMANDS.UNSUPPORTED;
}

// ─── Helpers ─────────────────────────────────────────────────

function _str(v) { return typeof v === 'string' && v.trim() ? v.trim() : null; }

function _cropName(ctx) {
  return _str(ctx && ctx.farmContext && ctx.farmContext.crop)
      || _str(ctx && ctx.farmContext && ctx.farmContext.farm && ctx.farmContext.farm.crop)
      || 'crop';
}

function _hasFarm(ctx) {
  const f = ctx && ctx.farmContext;
  if (!f) return false;
  return !!(f.farm && (f.farm.id || f.farm.name));
}

// ─── Watering advice ─────────────────────────────────────────
//
// Spec §9 — never claims exact soil moisture (no sensor yet).
// Always hedges with "feels dry" + factors in weather rain
// chance + temperature + farm/backyard type.

function _wateringAnswer(ctx) {
  const w = (ctx && ctx.weather) || {};
  const fc = (ctx && ctx.farmContext) || {};
  const crop = _cropName(ctx);
  const rain = Number.isFinite(w.rainChance) ? w.rainChance : null;
  const temp = Number.isFinite(w.temp) ? w.temp : null;
  const isBackyard = fc.farmType === 'backyard'
                  || fc.backyardType === 'pots'
                  || fc.backyardType === 'balcony_patio';

  if (rain != null && rain >= 60) {
    return `Rain is likely later, so hold off watering your ${crop}. Check soil first — only water if it feels very dry.`;
  }
  if (temp != null && temp >= 32) {
    return `It is hot today. Check soil under your ${crop}. If it feels dry, water early or late, not midday.`;
  }
  if (isBackyard) {
    return `For pots and backyard beds, the soil dries faster. Check the top inch — if it feels dry, water lightly.`;
  }
  return `Check soil first. Rain may come later, so water only if the soil feels dry around your ${crop}.`;
}

// ─── Per-intent composers ────────────────────────────────────

function _composeWhatToDoToday(ctx) {
  const rec = ctx && ctx.recommendation;
  if (!_hasFarm(ctx)) {
    return {
      spoken: 'Add your farm first so I can guide you better.',
      action: VOICE_ACTIONS.NAVIGATE,
      payload: { path: '/my-farm' },
    };
  }
  if (rec && _str(rec.title)) {
    const reason = _str(rec.reason);
    const cta    = _str(rec.cta);
    const lines = [`Today: ${rec.title}.`];
    if (reason) lines.push(reason);
    if (cta)    lines.push(`Then tap "${cta}".`);
    return { spoken: lines.join(' '), action: VOICE_ACTIONS.READ };
  }
  return {
    spoken: `Walk your ${_cropName(ctx)} and look for anything new. A short check is a good start.`,
    action: VOICE_ACTIONS.READ,
  };
}

function _composeReadMyTask(ctx) {
  const tasks = Array.isArray(ctx && ctx.tasks) ? ctx.tasks : [];
  const current = tasks.find((t) => t && t.status !== 'completed');
  if (!current) {
    return {
      spoken: 'You have no open tasks. A short walk around your farm is a good idea.',
      action: VOICE_ACTIONS.READ,
    };
  }
  const title = _str(current.title) || _str(current.label);
  const why   = _str(current.why) || _str(current.reason);
  const lines = [];
  if (title) lines.push(title + '.');
  if (why)   lines.push(why);
  return {
    spoken: lines.join(' ') || 'You have a task open today.',
    action: VOICE_ACTIONS.READ,
  };
}

function _composeNextTask(ctx) {
  const tasks = Array.isArray(ctx && ctx.tasks) ? ctx.tasks : [];
  const pending = tasks.filter((t) => t && t.status !== 'completed');
  if (pending.length === 0) {
    return { spoken: 'You have no upcoming tasks. Enjoy a calm day.', action: VOICE_ACTIONS.READ };
  }
  if (pending.length === 1) {
    return {
      spoken: `Your current task is: ${_str(pending[0].title) || 'a check'}.`,
      action: VOICE_ACTIONS.READ,
    };
  }
  const next = pending[1];
  return {
    spoken: `Your next task after this one is: ${_str(next.title) || 'another check'}.`,
    action: VOICE_ACTIONS.READ,
  };
}

function _composeNeedsAttention(ctx) {
  const scan = ctx && ctx.lastScan;
  const rec  = ctx && ctx.recommendation;
  if (rec && _str(rec.urgency) === 'high' && _str(rec.title)) {
    return { spoken: rec.title + '. Check it as soon as you can.', action: VOICE_ACTIONS.READ };
  }
  if (scan && _str(scan.category) && scan.category !== 'healthy') {
    return {
      spoken: `Your last scan flagged ${_str(scan.category) || 'an issue'} on your ${_cropName(ctx)}. Take a closer look today.`,
      action: VOICE_ACTIONS.READ,
    };
  }
  return {
    spoken: 'Nothing urgent right now. A short check is still a good habit.',
    action: VOICE_ACTIONS.READ,
  };
}

function _composeReadScanResult(ctx) {
  const scan = ctx && ctx.lastScan;
  if (!scan) {
    return {
      spoken: 'No scan yet. Tap Scan to take a photo of your crop.',
      action: VOICE_ACTIONS.NAVIGATE,
      payload: { path: '/scan' },
    };
  }
  const issue   = _str(scan.possibleIssue) || _str(scan.summary) || 'Possible issue';
  const action  = Array.isArray(scan.recommendedActions) && _str(scan.recommendedActions[0])
                  ? _str(scan.recommendedActions[0]) : null;
  const lines = [issue + '.'];
  if (action) lines.push(action);
  return { spoken: lines.join(' '), action: VOICE_ACTIONS.READ };
}

function _composeLastScanSaid(ctx) {
  // Same composition as read_scan_result; the intent is recognised
  // separately because farmers ask it differently.
  return _composeReadScanResult(ctx);
}

function _composeWeatherAdvice(ctx) {
  const w = (ctx && ctx.weather) || {};
  const cond = _str(w.condition);
  const rain = Number.isFinite(w.rainChance) ? w.rainChance : null;
  const temp = Number.isFinite(w.temp) ? w.temp : null;
  if (!cond && rain == null && temp == null) {
    return {
      spoken: 'I do not have weather yet, but you can still check your crop today.',
      action: VOICE_ACTIONS.READ,
    };
  }
  if (rain != null && rain >= 60) {
    return { spoken: 'Rain is likely later. Hold off watering and protect any drying produce.', action: VOICE_ACTIONS.READ };
  }
  if (temp != null && temp >= 32) {
    return { spoken: 'It is hot today. Work early or late, and keep an eye on water needs.', action: VOICE_ACTIONS.READ };
  }
  if (cond && cond.toLowerCase().includes('frost')) {
    return { spoken: 'Frost risk tonight. Cover tender plants if you can.', action: VOICE_ACTIONS.READ };
  }
  return { spoken: `Today looks ${cond || 'mild'}. A short check on your ${_cropName(ctx)} is a good plan.`, action: VOICE_ACTIONS.READ };
}

function _composeSaveThisScan(ctx) {
  const scan = ctx && ctx.lastScan;
  if (!scan) {
    return {
      spoken: 'I do not see a scan to save. Tap Scan to take a photo first.',
      action: VOICE_ACTIONS.NAVIGATE,
      payload: { path: '/scan' },
    };
  }
  return {
    spoken: 'Do you want me to save this scan?',
    action: VOICE_ACTIONS.SAVE_CURRENT_SCAN,
    payload: { scanId: _str(scan.scanId) || _str(scan.id) || null },
    requiresConfirmation: true,
  };
}

function _composeAddToTasks(ctx) {
  const scan = ctx && ctx.lastScan;
  if (!scan) {
    return {
      spoken: 'I do not see a scan to turn into a task. Tap Scan first.',
      action: VOICE_ACTIONS.NAVIGATE,
      payload: { path: '/scan' },
    };
  }
  return {
    spoken: 'Do you want me to add this to your tasks?',
    action: VOICE_ACTIONS.CREATE_TASK_FROM_SCAN,
    payload: { scanId: _str(scan.scanId) || _str(scan.id) || null },
    requiresConfirmation: true,
  };
}

function _composeWatering(ctx) {
  return { spoken: _wateringAnswer(ctx), action: VOICE_ACTIONS.READ };
}

function _unsupportedReply() {
  return {
    spoken: 'I can help with today’s farm tasks, scan results, weather advice, and watering guidance.',
    action: null,
  };
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Map a free-form command to a structured response envelope.
 * Pure, never throws, frozen output.
 *
 * @param {object} input
 * @param {string} input.command         the spoken or typed command
 * @param {object} [input.farmContext]   active farm + crop snapshot
 * @param {object} [input.weather]       { condition, temp, rainChance }
 * @param {Array}  [input.tasks]
 * @param {object} [input.lastScan]
 * @param {object} [input.recommendation]
 * @param {string} [input.language]
 * @returns {object} frozen envelope
 */
export function answerCommand(input) {
  try {
    const safe = (input && typeof input === 'object') ? input : {};
    const intent = _routeIntent(safe.command);

    let composed;
    switch (intent) {
      case VOICE_COMMANDS.WHAT_TO_DO_TODAY: composed = _composeWhatToDoToday(safe); break;
      case VOICE_COMMANDS.READ_MY_TASK:     composed = _composeReadMyTask(safe);    break;
      case VOICE_COMMANDS.NEXT_TASK:        composed = _composeNextTask(safe);      break;
      case VOICE_COMMANDS.NEEDS_ATTENTION:  composed = _composeNeedsAttention(safe);break;
      case VOICE_COMMANDS.SHOULD_WATER:     composed = _composeWatering(safe);      break;
      case VOICE_COMMANDS.READ_SCAN_RESULT: composed = _composeReadScanResult(safe);break;
      case VOICE_COMMANDS.LAST_SCAN_SAID:   composed = _composeLastScanSaid(safe);  break;
      case VOICE_COMMANDS.WEATHER_ADVICE:   composed = _composeWeatherAdvice(safe); break;
      case VOICE_COMMANDS.SAVE_THIS_SCAN:   composed = _composeSaveThisScan(safe);  break;
      case VOICE_COMMANDS.ADD_TO_TASKS:     composed = _composeAddToTasks(safe);    break;
      default:                              composed = _unsupportedReply();         break;
    }

    return Object.freeze({
      intent,
      spokenText:   composed.spoken,
      displayText:  composed.spoken,
      actionType:   composed.action   || null,
      actionPayload: composed.payload || null,
      requiresConfirmation: !!composed.requiresConfirmation,
      confidenceTone: intent === VOICE_COMMANDS.UNSUPPORTED ? 'limited-data' : 'likely',
    });
  } catch {
    return Object.freeze({
      intent:               VOICE_COMMANDS.UNSUPPORTED,
      spokenText:           'I can help with today’s farm tasks, scan results, weather advice, and watering guidance.',
      displayText:          'I can help with today’s farm tasks, scan results, weather advice, and watering guidance.',
      actionType:           null,
      actionPayload:        null,
      requiresConfirmation: false,
      confidenceTone:       'limited-data',
    });
  }
}

const _module = {
  VOICE_COMMANDS,
  VOICE_ACTIONS,
  answerCommand,
};
export default _module;
