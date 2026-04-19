/**
 * formatLocation({ country, state, city }) — one canonical renderer
 * for the "City, State, Country" chip the UI shows in multiple
 * places. Every callsite MUST use this so we can't ship a screen
 * that leaks "Frederick" alone or skips the state when it exists.
 *
 * Accepts either the structured object or partial records (e.g.
 * country-only). Returns null when nothing rendering-worthy is
 * available so callers can branch to an empty state.
 */

import { findCountry, resolveRegion } from './locationData.js';

/**
 * @param {Object} loc
 * @param {string} [loc.country]    ISO-2 or friendly name
 * @param {string} [loc.state]      state code or name
 * @param {string} [loc.stateCode]  alternative slot for state
 * @param {string} [loc.city]       free-text city
 */
export function formatLocation(loc = {}) {
  if (!loc) return null;

  const country = findCountry(loc.country) || (loc.country ? { code: loc.country, name: friendlyCountry(loc.country) } : null);
  const stateKey = loc.state || loc.stateCode;
  const region = country && stateKey ? resolveRegion(country.code, stateKey) : null;
  const city = typeof loc.city === 'string' && loc.city.trim() ? loc.city.trim() : null;

  const parts = [city, region?.name, country?.name].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(', ');
}

/** Short form — just the state + country (no city). */
export function formatLocationShort(loc = {}) {
  if (!loc) return null;
  const country = findCountry(loc.country);
  const stateKey = loc.state || loc.stateCode;
  const region = country && stateKey ? resolveRegion(country.code, stateKey) : null;
  const parts = [region?.name, country?.name].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(', ');
}

function friendlyCountry(raw) {
  const c = String(raw).toUpperCase();
  const map = { USA: 'United States', GB: 'United Kingdom' };
  return map[c] || raw;
}
