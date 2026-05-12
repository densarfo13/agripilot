/**
 * weatherUnits.js — temperature-unit resolver + conversion helpers.
 *
 *   const { unit, source } = resolveTemperatureUnit({
 *     countryCode: 'US',
 *     userPreference: getUserTemperatureUnitPreference(),
 *   });
 *   const display = formatTemperature(26, 'C', unit);   // → "79°F"
 *
 * Why a helper, not "always Celsius"
 * ──────────────────────────────────
 *   Most of Farroway's farmer base reads Celsius — that's the
 *   global default for agriculture + every metric country. But the
 *   US, Liberia, and Myanmar still primarily use Fahrenheit
 *   (Liberia and Myanmar by historical default; US by convention).
 *   A Ghana farmer expects 28°C; a US farmer expects 82°F. Mixing
 *   either way reads as a software bug to that user.
 *
 *   The resolver is the single source of truth so every surface
 *   (Home weather hero, daily briefing, task weather context,
 *   scan weather caution, notifications) renders the SAME unit on
 *   the same screen. The whole point is to never mix.
 *
 * Strict-rule audit
 *   • Pure functions for resolveTemperatureUnit / cToF / fToC /
 *     formatTemperature. Never throw.
 *   • null / undefined / NaN inputs → return an empty string, NOT
 *     "NaN°F". Caller renders the empty state cleanly.
 *   • Display is rounded to the nearest whole number — fractional
 *     precision is noise at this scale and confuses farmers.
 *   • User-preference override is stored under a STABLE key + read
 *     synchronously so the unit doesn't flicker between hydrations.
 *   • Language is intentionally NOT a resolver input. A French
 *     farmer in the US still sees Fahrenheit; an English farmer in
 *     Ghana still sees Celsius. Unit follows region, not locale.
 */

// ─── Fahrenheit-default country list ──────────────────────────
// Conservative. The other ~190 countries default to Celsius.
// We use ISO 3166-1 alpha-2 codes.
//
//   US — United States
//   LR — Liberia
//   MM — Myanmar (Burma)
//
// (The Bahamas, Belize, Cayman Islands keep Celsius despite some
// public-broadcast Fahrenheit use — agricultural guidance there
// almost always uses metric. We default them to Celsius unless
// the farmer overrides.)
const _FAHRENHEIT_COUNTRIES = new Set(['US', 'LR', 'MM']);

// localStorage key for the user override. Stable across sessions.
export const TEMPERATURE_UNIT_STORAGE_KEY = 'farroway_temperature_unit_preference';

// In-session cache so the resolver stays stable across re-renders
// even if the user's profile briefly hydrates as null. Cleared by
// _resetUnitCache() (test helper).
let _sessionUnit = null;
let _sessionSource = null;

// ─── Helpers ──────────────────────────────────────────────────

function _normCountry(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase();
  if (s.length !== 2) return null;
  return s;
}

function _normUnit(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase();
  if (s === 'C' || s === 'CELSIUS')    return 'C';
  if (s === 'F' || s === 'FAHRENHEIT') return 'F';
  return null;
}

function _isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// ─── Resolver ─────────────────────────────────────────────────

/**
 * Decide which temperature unit to display.
 *
 * @param {object} [input]
 * @param {string} [input.countryCode]   — ISO 3166-1 alpha-2 (e.g. 'US')
 * @param {string} [input.region]        — region code (currently unused;
 *                                          reserved for future state-level
 *                                          overrides).
 * @param {string} [input.locale]        — accepted but DELIBERATELY ignored
 *                                          (a French user in the US still
 *                                          sees °F).
 * @param {string} [input.userPreference] — 'C' / 'F' / 'Celsius' /
 *                                           'Fahrenheit'. Overrides
 *                                           country default.
 * @param {boolean} [input.session]       — when true, the resolver caches
 *                                           the answer for the rest of
 *                                           the session so it stays
 *                                           stable across re-renders.
 *                                           Default true.
 * @returns {{ unit: 'C'|'F', source: 'user'|'country'|'fallback' }}
 */
export function resolveTemperatureUnit(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const useSession = safe.session !== false;

  // ── 1. User preference wins everything ──────────────────────
  const userUnit = _normUnit(safe.userPreference);
  if (userUnit) {
    const out = { unit: userUnit, source: 'user' };
    if (useSession) { _sessionUnit = out.unit; _sessionSource = out.source; }
    return out;
  }

  // ── 2. Session cache (only when user preference wasn't set) ─
  if (useSession && _sessionUnit) {
    return { unit: _sessionUnit, source: _sessionSource || 'country' };
  }

  // ── 3. Country default ──────────────────────────────────────
  const country = _normCountry(safe.countryCode);
  if (country) {
    const out = _FAHRENHEIT_COUNTRIES.has(country)
      ? { unit: 'F', source: 'country' }
      : { unit: 'C', source: 'country' };
    if (useSession) { _sessionUnit = out.unit; _sessionSource = out.source; }
    return out;
  }

  // ── 4. Fallback — Celsius (global default) ──────────────────
  const out = { unit: 'C', source: 'fallback' };
  if (useSession) { _sessionUnit = out.unit; _sessionSource = out.source; }
  return out;
}

// ─── Conversion helpers ───────────────────────────────────────

/**
 * Convert Celsius to Fahrenheit. Returns null on non-numeric input.
 *
 * @param {number} c
 * @returns {number|null}
 */
export function cToF(c) {
  if (!_isFiniteNumber(c)) return null;
  return (c * 9 / 5) + 32;
}

/**
 * Convert Fahrenheit to Celsius. Returns null on non-numeric input.
 *
 * @param {number} f
 * @returns {number|null}
 */
export function fToC(f) {
  if (!_isFiniteNumber(f)) return null;
  return (f - 32) * 5 / 9;
}

/**
 * Convert + format a temperature value for display.
 *
 *   formatTemperature(26, 'C', 'F')   → '79°F'
 *   formatTemperature(82, 'F', 'C')   → '28°C'
 *   formatTemperature(null, 'C', 'F') → ''
 *   formatTemperature(NaN, 'C', 'C')  → ''
 *
 * @param {number} value
 * @param {'C'|'F'} fromUnit
 * @param {'C'|'F'} targetUnit
 * @returns {string}  display string or '' on bad input
 */
export function formatTemperature(value, fromUnit, targetUnit) {
  if (!_isFiniteNumber(value)) return '';
  const from = _normUnit(fromUnit) || 'C';
  const target = _normUnit(targetUnit) || from;
  let converted = value;
  if (from !== target) {
    converted = (from === 'C') ? cToF(value) : fToC(value);
    if (!_isFiniteNumber(converted)) return '';
  }
  return `${Math.round(converted)}°${target}`;
}

// ─── User preference store ────────────────────────────────────

/**
 * Read the user's persisted temperature-unit preference. Returns
 * null when the user hasn't set one (and the resolver should fall
 * back to country default).
 *
 * Accepted stored values: 'C', 'F', 'Auto' (or unset).
 *
 * @returns {'C'|'F'|null}
 */
export function getUserTemperatureUnitPreference() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(TEMPERATURE_UNIT_STORAGE_KEY);
    if (!raw) return null;
    const norm = String(raw).trim().toUpperCase();
    if (norm === 'AUTO') return null;
    return _normUnit(norm);
  } catch { return null; }
}

/**
 * Persist (or clear) the user's temperature-unit preference. Accepts
 * 'C', 'F', or 'Auto' (the last clears the override).
 *
 * @param {'C'|'F'|'Auto'|null} preference
 * @returns {boolean} whether the write succeeded
 */
export function setUserTemperatureUnitPreference(preference) {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (preference == null) {
      localStorage.removeItem(TEMPERATURE_UNIT_STORAGE_KEY);
      _sessionUnit = null;
      _sessionSource = null;
      return true;
    }
    const norm = String(preference).trim().toUpperCase();
    if (norm === 'AUTO') {
      localStorage.removeItem(TEMPERATURE_UNIT_STORAGE_KEY);
      _sessionUnit = null;
      _sessionSource = null;
      return true;
    }
    const unit = _normUnit(norm);
    if (!unit) return false;
    localStorage.setItem(TEMPERATURE_UNIT_STORAGE_KEY, unit);
    // Re-prime the session cache so the next resolveTemperatureUnit
    // sees the override immediately.
    _sessionUnit = unit;
    _sessionSource = 'user';
    return true;
  } catch { return false; }
}

/**
 * Test helper — clears the in-memory session cache so tests can
 * reset between cases.
 */
export function _resetUnitCache() {
  _sessionUnit = null;
  _sessionSource = null;
}

export default {
  resolveTemperatureUnit,
  cToF,
  fToC,
  formatTemperature,
  getUserTemperatureUnitPreference,
  setUserTemperatureUnitPreference,
  TEMPERATURE_UNIT_STORAGE_KEY,
  _resetUnitCache,
};
