/**
 * farmBrainResponder.js — Jarvis MVP responder (honest kernel).
 *
 * Composes the answer + ONE next action from templates over REAL context only.
 * It never generates agronomy content: no diagnosis, no prices, no yields, no
 * approvals. Answers are i18n template keys resolved by the panel via tSafe, so
 * every farmer-visible word passes the same localization gates as the rest of
 * the app. Pure; never throws.
 */
import { route } from './commandRouter.js';

const ANSWERS = Object.freeze({
  SCAN_PLANT:       ['jarvis.answer.scan',      "Let's look at your plant. Take one close photo of a single leaf in daylight."],
  TODAY_TASKS:      ['jarvis.answer.tasks',     'Here is your plan for today.'],
  FARM_STATUS:      ['jarvis.answer.farm',      'Here is how your farm is doing.'],
  WEATHER_ADVICE:   ['jarvis.answer.weather',   'Here is the weather advice for your area.'],
  MARKETPLACE_SELL: ['jarvis.answer.sell',      'You can list your harvest and see who has shown interest.'],
  FUNDING_SEARCH:   ['jarvis.answer.funding',   'Here are funding programs you can look at. Eligibility guidance only — approval always comes from the lender.'],
  INSURANCE_SEARCH: ['jarvis.answer.insurance', 'Here is insurance information from licensed partners. Buying cover always happens with the partner.'],
  JOURNAL_ADD:      ['jarvis.answer.journal',   'Open your journal to write this down. You save the entry yourself.'],
  LANGUAGE_CHANGE:  ['jarvis.answer.language',  'You can change your language here.'],
  HELP:             ['jarvis.answer.help',      'You can ask me to open Scan, show your plan, weather, selling, funding, or your journal.'],
});

const CLARIFY = Object.freeze(['jarvis.answer.clarify', "I didn't catch that. Do you want to scan a plant, see today's plan, or check the weather?"]);
const CONSENT = Object.freeze(['jarvis.answer.consentNeeded', 'Before I open insurance options, I need your OK to use your farm details for this.']);

/**
 * respond(intent, ctx) → {
 *   answerKey, answerFallback, action?: {path, labelKey, labelFallback},
 *   needsConsent, clarify, contextLine?: {key, fallback, value}
 * }
 */
export function respond(intent, ctx) {
  const r = route(intent);
  if (r.type === 'clarify') {
    return Object.freeze({
      answerKey: CLARIFY[0], answerFallback: CLARIFY[1],
      action: null, needsConsent: false, clarify: true, contextLine: null,
    });
  }
  const a = ANSWERS[intent] || CLARIFY;
  // One REAL context line where the kernel already knows it — never invented.
  let contextLine = null;
  if (intent === 'TODAY_TASKS' && ctx && ctx.todayTaskTitle) {
    contextLine = Object.freeze({ key: 'jarvis.context.firstTask', fallback: 'First task', value: String(ctx.todayTaskTitle) });
  }
  if (r.requiresConsent) {
    return Object.freeze({
      answerKey: CONSENT[0], answerFallback: CONSENT[1],
      action: Object.freeze({ path: r.path, labelKey: r.labelKey, labelFallback: r.labelFallback }),
      needsConsent: true, clarify: false, contextLine,
    });
  }
  return Object.freeze({
    answerKey: a[0], answerFallback: a[1],
    action: Object.freeze({ path: r.path, labelKey: r.labelKey, labelFallback: r.labelFallback }),
    needsConsent: false, clarify: false, contextLine,
  });
}

export default respond;
