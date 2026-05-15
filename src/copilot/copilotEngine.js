/**
 * copilotEngine.js — the Conversational Farm Copilot Beta engine.
 *
 *   import { askCopilot, SUGGESTED_PROMPTS } from 'src/copilot/copilotEngine.js';
 *   const reply = askCopilot('What should I do today?');
 *
 * What this is
 * ────────────
 *   A thin, deterministic orchestrator. It does NOT call an open
 *   LLM and cannot hallucinate. It wires three engines that already
 *   exist and are tested:
 *
 *     getUnifiedIntelligence()  — src/core/intelligence — assembles
 *         the farm context: country, region, language, weather,
 *         crop, growth stage, tasks, scan history, recommendation,
 *         connectivity.  (spec §5, §11)
 *     answerCommand()           — src/services/voiceAssistant
 *         ResponseEngine — maps the question to a calm, structured,
 *         low-literacy reply envelope.  (spec §4, §6, §9)
 *     copilotSafety.makeSafe()  — scrubs unsafe claims + gates a
 *         low-confidence hedge.  (spec §8)
 *
 *   Because every input is read from local caches and every step is
 *   pure, the copilot works fully OFFLINE (spec §13) — it just
 *   reports connectivity so the UI can say so.
 *
 * Why not 10 separate engine files
 *   The spec lists copilotEngine / copilotMemory / copilotPrompt
 *   Builder / copilotContext / copilotActions / copilotVoice / …
 *   Every one of those maps to an engine that already ships
 *   (unifiedIntelligence = context+prompt+region, voiceAssistant
 *   ResponseEngine = actions+intents, voice* utils = voice). Adding
 *   parallel files would duplicate tested code. This single engine
 *   is the wiring; the Beta sheet holds short-term conversation
 *   memory in component state (capped — spec §15).
 *
 * Strict-rule audit
 *   • Pure (modulo the cache reads inside getUnifiedIntelligence).
 *   • Never throws — every step is guarded; failure yields a calm
 *     fallback reply.
 *   • No PII, no raw API output, no open-internet calls.
 *   • Frozen output.
 */

import { getUnifiedIntelligence } from '../core/intelligence/unifiedIntelligence.js';
import { answerCommand } from '../services/voiceAssistantResponseEngine.js';
import { makeSafe, assessConfidence, LOW_CONFIDENCE_NOTE } from './copilotSafety.js';

// Spec §4 — the starter prompts shown in the copilot sheet. Every
// one routes to a supported intent in the response engine.
export const SUGGESTED_PROMPTS = Object.freeze([
  'What should I do today?',
  'Explain my scan.',
  'Should I water today?',
  'What needs attention?',
  'What task is most urgent?',
  'Read my scan result.',
]);

/** Normalise the unified weather block into the small shape the
 *  response engine expects: { condition, temp, rainChance }. */
function _weatherFor(intel) {
  const w = (intel && intel.weather) || null;
  if (!w || typeof w !== 'object') return null;
  const num = (vals) => vals.find((v) => typeof v === 'number' && isFinite(v));
  return {
    condition:  w.weatherType || w.type || w.condition || w.summary || null,
    temp:       num([w.temp, w.tempC, w.currentTempC, w.temperature]) ?? null,
    rainChance: num([w.rainChance, w.precipChance, w.pop, w.rainProbability]) ?? null,
  };
}

/**
 * Assemble the copilot context once, from the unified intelligence
 * facade. Exposed so the sheet can show "what I'm using" if needed.
 *
 * @param {object} [opts]  forwarded to getUnifiedIntelligence
 * @returns {object} copilot context
 */
export function buildCopilotContext(opts) {
  let intel;
  try {
    intel = getUnifiedIntelligence(opts);
  } catch {
    intel = null;
  }
  const farm = (intel && intel.farm) || {};
  const geo  = (intel && intel.geo)  || {};
  const ie   = (intel && intel.intelligence) || {};
  const ctx  = (intel && intel.context) || null;

  return {
    farmContext: {
      crop:      farm.crop || null,
      cropStage: farm.cropStage || null,
      country:   geo.country || null,
      region:    geo.region || null,
      mode:      farm.mode || 'farm',
    },
    weather:        _weatherFor(intel),
    tasks:          Array.isArray(ie.scanTasks) ? ie.scanTasks : [],
    lastScan:       ie.latestScan || null,
    recommendation: ctx && ctx.recommendation ? ctx.recommendation : null,
    language:       geo.language || 'en',
    connectivity:   (intel && intel.connectivity) || 'online',
  };
}

/**
 * Answer a free-form copilot question. Never throws.
 *
 * @param {string} question
 * @param {object} [opts]  forwarded to getUnifiedIntelligence (tests
 *                         can inject nowMs / weatherOverride)
 * @returns {{
 *   question: string,
 *   answer: string,
 *   intent: string,
 *   action: ?string,
 *   actionPayload: ?object,
 *   requiresConfirmation: boolean,
 *   confidence: 'likely'|'limited',
 *   language: string,
 *   connectivity: 'online'|'offline',
 *   answeredAt: number
 * }}
 */
export function askCopilot(question, opts) {
  const q = (typeof question === 'string') ? question.trim() : '';
  const answeredAt = Date.now();

  // Empty question — calm guide reply, no engine call.
  if (!q) {
    return Object.freeze({
      question: '',
      answer: 'Ask me about today’s tasks, your last scan, watering, or what needs attention.',
      intent: 'empty',
      action: null,
      actionPayload: null,
      requiresConfirmation: false,
      confidence: 'likely',
      language: 'en',
      connectivity: 'online',
      answeredAt,
    });
  }

  let ctx;
  try {
    ctx = buildCopilotContext(opts);
  } catch {
    ctx = {
      farmContext: {}, weather: null, tasks: [], lastScan: null,
      recommendation: null, language: 'en', connectivity: 'online',
    };
  }

  let envelope;
  try {
    envelope = answerCommand({
      command:        q,
      farmContext:    ctx.farmContext,
      weather:        ctx.weather,
      tasks:          ctx.tasks,
      lastScan:       ctx.lastScan,
      recommendation: ctx.recommendation,
      language:       ctx.language,
    });
  } catch {
    envelope = null;
  }

  if (!envelope || typeof envelope !== 'object') {
    return Object.freeze({
      question: q,
      answer: LOW_CONFIDENCE_NOTE,
      intent: 'error',
      action: null,
      actionPayload: null,
      requiresConfirmation: false,
      confidence: 'limited',
      language: ctx.language,
      connectivity: ctx.connectivity,
      answeredAt,
    });
  }

  const confidence = assessConfidence(envelope);
  const answer = makeSafe(envelope.displayText || envelope.spokenText, { confidence });

  return Object.freeze({
    question: q,
    answer,
    intent: envelope.intent || 'unsupported',
    action: envelope.actionType || null,
    actionPayload: envelope.actionPayload || null,
    requiresConfirmation: !!envelope.requiresConfirmation,
    confidence,
    language: ctx.language,
    connectivity: ctx.connectivity,
    answeredAt,
  });
}

const _module = { SUGGESTED_PROMPTS, buildCopilotContext, askCopilot };
export default _module;
