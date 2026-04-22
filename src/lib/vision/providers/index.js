/**
 * providers/index.js — provider registry for the crop detector.
 *
 * To add a new provider (TFLite, server endpoint, hosted ML API):
 *   1. Build a module that exports { name, detect(imageInput, options) }.
 *   2. Register it in the PROVIDERS map below.
 *   3. Set FARROWAY_VISION_PROVIDER (env or localStorage) to the name.
 *
 * The detect() contract is intentionally minimal:
 *
 *   detect(imageInput, options) →
 *     Promise<{ candidates: [{cropKey, label, confidence}], reason? }>
 *
 * Providers MUST:
 *   • Never throw uncaught — return empty candidates instead
 *   • Never claim high confidence they can't substantiate
 *   • Be safe to call offline (heuristic provider sets this bar)
 */

import { heuristicProvider } from './heuristicProvider.js';

// Register every available provider here.
const PROVIDERS = Object.freeze({
  heuristic: heuristicProvider,
});

const DEFAULT_PROVIDER = 'heuristic';

function readEnvProvider() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const v = window.localStorage.getItem('farroway:visionProvider');
      if (v && PROVIDERS[v]) return v;
    }
  } catch (_) { /* no-op */ }
  try {
    if (typeof process !== 'undefined' && process.env && process.env.FARROWAY_VISION_PROVIDER) {
      const v = process.env.FARROWAY_VISION_PROVIDER;
      if (v && PROVIDERS[v]) return v;
    }
  } catch (_) { /* no-op */ }
  return null;
}

/**
 * getActiveProvider(explicit?) — returns the provider instance to use.
 *   Priority: explicit argument → env/localStorage → DEFAULT_PROVIDER.
 *   Unknown names silently fall back to the default so the UI never
 *   breaks because of a typo in an override.
 */
export function getActiveProvider(explicit) {
  const name = (explicit && PROVIDERS[explicit])
    ? explicit
    : (readEnvProvider() || DEFAULT_PROVIDER);
  return PROVIDERS[name] || PROVIDERS[DEFAULT_PROVIDER];
}

/** listProviders — used by tests + ops tools. */
export function listProviders() {
  return Object.keys(PROVIDERS);
}

export { PROVIDERS, DEFAULT_PROVIDER };
