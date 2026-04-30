/**
 * featureFlags.js — single source of truth for runtime feature
 * gates. Reads three layers, in priority order:
 *
 *   1. window.__FARROWAY_FLAGS__   (set by tests / Storybook /
 *                                   admin override consoles)
 *   2. localStorage 'farroway:flag:<NAME>' === '1' | '0'
 *      (per-device opt-in; great for staging dogfooding)
 *   3. import.meta.env.VITE_FEATURE_<NAME> === 'true' | '1'
 *      (default for the build)
 *   4. hard-coded default below
 *
 * No React, no I/O outside the three reads above. Safe in SSR
 * and locked-down browsers.
 */

const DEFAULTS = Object.freeze({
  // §16 of the localization rollout spec — guards the
  // language-suggestion banner, the LanguageSwitcher, and the
  // crop-name overlay. Default ON in development, OFF until
  // explicitly enabled in production builds.
  FEATURE_LOCALIZATION: true,

  // Voice assistant (§14 of the voice rollout spec). The mic
  // launcher + suggested-question sheet ride this flag — when
  // off, the launcher hides quietly and existing UI surfaces
  // are unaffected.
  FEATURE_VOICE_ASSISTANT: true,

  // Open-ended LLM-backed voice chat. MUST stay off until the
  // safety review the spec calls out lands — guided questions
  // only for now.
  FEATURE_OPEN_ENDED_VOICE: false,
});

function safeWindowFlag(name) {
  try {
    if (typeof window === 'undefined') return undefined;
    const bag = window.__FARROWAY_FLAGS__;
    if (bag && Object.prototype.hasOwnProperty.call(bag, name)) {
      return !!bag[name];
    }
  } catch { /* swallow */ }
  return undefined;
}

function safeLocalStorageFlag(name) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    const raw = window.localStorage.getItem(`farroway:flag:${name}`);
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
  } catch { /* swallow */ }
  return undefined;
}

function safeEnvFlag(name) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const raw = import.meta.env[`VITE_${name}`];
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
    }
  } catch { /* SSR / non-Vite */ }
  try {
    if (typeof process !== 'undefined' && process.env) {
      const raw = process.env[name] || process.env[`VITE_${name}`];
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
    }
  } catch { /* swallow */ }
  return undefined;
}

/**
 * isFeatureEnabled — returns whether the named flag is on.
 *
 *   isFeatureEnabled('FEATURE_LOCALIZATION')
 *
 * Unknown flag names default to false.
 */
export function isFeatureEnabled(name) {
  if (!name) return false;
  const w = safeWindowFlag(name);
  if (w !== undefined) return w;
  const ls = safeLocalStorageFlag(name);
  if (ls !== undefined) return ls;
  const env = safeEnvFlag(name);
  if (env !== undefined) return env;
  return !!DEFAULTS[name];
}

/**
 * setFeatureFlagOverride — admin override at the localStorage
 * layer. Persists across reloads on the same device.
 *
 *   setFeatureFlagOverride('FEATURE_LOCALIZATION', true)
 *   setFeatureFlagOverride('FEATURE_LOCALIZATION', null)  // clear
 */
export function setFeatureFlagOverride(name, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const key = `farroway:flag:${name}`;
    if (value == null) { window.localStorage.removeItem(key); return; }
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch { /* swallow */ }
}

export const _internal = Object.freeze({ DEFAULTS });
