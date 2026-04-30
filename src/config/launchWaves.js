/**
 * launchWaves.js — declarative rollout schedule for the
 * Global Expansion System (spec §13).
 *
 * Pure data + lookup helpers. Read-only for the rest of the
 * app — the `status` field on each REGION_CONFIG entry is
 * the source of truth for "is this country live?". This
 * file is the marketing / strategy view of how those rows
 * group together.
 */

export const LAUNCH_WAVES = Object.freeze({
  wave1: Object.freeze({
    id: 'wave1',
    name: 'Proof of Usage',
    countries: ['Ghana', 'United States'],
    goal: 'Validate daily usage, onboarding, voice, photo, and daily plan.',
  }),
  wave2: Object.freeze({
    id: 'wave2',
    name: 'Regional Expansion',
    countries: ['Nigeria', 'Kenya'],
    goal: 'Expand into high-overlap African markets.',
  }),
  wave3: Object.freeze({
    id: 'wave3',
    name: 'Scale Markets',
    countries: ['India', 'Philippines'],
    goal: 'Enter large mobile-first farmer markets after system maturity.',
  }),
  wave4: Object.freeze({
    id: 'wave4',
    name: 'Global Enterprise Markets',
    countries: ['Brazil', 'Mexico', 'Indonesia'],
    goal: 'Expand into large agriculture economies with export and enterprise potential.',
  }),
});

/**
 * waveForCountry — reverse lookup. Returns the wave row that
 * contains the country, or null when the country isn't in
 * any wave (e.g. ad-hoc Default fallback).
 */
export function waveForCountry(country) {
  if (!country) return null;
  for (const w of Object.values(LAUNCH_WAVES)) {
    if (Array.isArray(w.countries) && w.countries.includes(country)) {
      return w;
    }
  }
  return null;
}

export function listWaves() {
  return Object.values(LAUNCH_WAVES);
}
