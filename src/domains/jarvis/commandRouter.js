/**
 * commandRouter.js — Jarvis MVP router (honest kernel).
 *
 * Pure intent → action mapping onto EXISTING app routes. Jarvis navigates; it never
 * mutates farm data itself (JOURNAL_ADD opens the journal entry flow — the farmer
 * saves explicitly). Consent-gated intents are flagged, not silently routed.
 */
import { CONSENT_GATED } from './intents.js';

// Every path below is a real route registered in App.jsx.
const ROUTES = Object.freeze({
  SCAN_PLANT:       Object.freeze({ path: '/scan?mode=camera', labelKey: 'jarvis.action.scan',    labelFallback: 'Open Scan' }),
  TODAY_TASKS:      Object.freeze({ path: '/tasks',            labelKey: 'jarvis.action.tasks',   labelFallback: "See today's plan" }),
  FARM_STATUS:      Object.freeze({ path: '/my-farm',          labelKey: 'jarvis.action.farm',    labelFallback: 'Open My Farm' }),
  WEATHER_ADVICE:   Object.freeze({ path: '/home',             labelKey: 'jarvis.action.weather', labelFallback: 'See weather advice' }),
  MARKETPLACE_SELL: Object.freeze({ path: '/sell',             labelKey: 'jarvis.action.sell',    labelFallback: 'Open Sell' }),
  FUNDING_SEARCH:   Object.freeze({ path: '/funding',          labelKey: 'jarvis.action.funding', labelFallback: 'Find funding' }),
  INSURANCE_SEARCH: Object.freeze({ path: '/funding',          labelKey: 'jarvis.action.insurance', labelFallback: 'See insurance options' }),
  JOURNAL_ADD:      Object.freeze({ path: '/journal',          labelKey: 'jarvis.action.journal', labelFallback: 'Open Journal' }),
  LANGUAGE_CHANGE:  Object.freeze({ path: '/settings',         labelKey: 'jarvis.action.language', labelFallback: 'Change language' }),
  HELP:             Object.freeze({ path: '/help',             labelKey: 'jarvis.action.help',    labelFallback: 'Open Help' }),
});

/**
 * route(intent) → { type: 'navigate'|'clarify', path?, labelKey?, labelFallback?, requiresConsent }
 */
export function route(intent) {
  const target = ROUTES[intent];
  if (!target) {
    return Object.freeze({ type: 'clarify', requiresConsent: false });
  }
  return Object.freeze({
    type: 'navigate',
    path: target.path,
    labelKey: target.labelKey,
    labelFallback: target.labelFallback,
    requiresConsent: CONSENT_GATED.includes(intent),
  });
}

export default route;
