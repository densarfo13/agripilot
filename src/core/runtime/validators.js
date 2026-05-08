/**
 * validators.js — runtime input validators for API responses and
 * component props.
 *
 * PROBLEM SOLVED
 * ──────────────
 * API responses are untrusted. A backend schema change, a null
 * DB column, or a network glitch can cause any field to be:
 *   • undefined        → TypeError on first property read
 *   • null             → silent failure
 *   • wrong type       → subtle render bugs or NaN displays
 *   • empty string     → looks like a value, acts like missing
 *   • nested null      → chains of `?.` or runtime crashes
 *
 * Every piece of API data that flows into a component SHOULD
 * pass through a validator before it's used. Validators coerce
 * bad input to a safe typed fallback — they never throw.
 *
 * USAGE
 * ─────
 *   import { safeArray, safeObject, safeString } from '../core/runtime/validators.js';
 *
 *   // In a hook:
 *   const farms = safeArray(apiData.farms);           // never undefined
 *   const user  = safeObject(apiData.user, SAFE_USER); // never undefined
 *   const name  = safeString(apiData.user?.name);      // '' if missing
 *
 * PERFORMANCE
 * ───────────
 *   All validators are O(1) — no deep clone, no iteration.
 *   safeObject does a single spread for the merge (top-level only).
 *   safeArray is a reference equality check + fallback — zero copy.
 *
 * STRICT-RULE AUDIT
 * ─────────────────
 *   • Pure functions. No side effects. No imports.
 *   • Never throw. Every code path returns a typed value.
 *   • SSR-safe — no window/document access.
 */

// ─── safeArray ────────────────────────────────────────────────────
/**
 * Ensures the value is a real JavaScript array.
 *
 * @template T
 * @param {unknown} val       — the value to validate
 * @param {T[]} [fallback=[]] — returned when val is not an array
 * @returns {T[]}
 *
 * @example
 *   safeArray(undefined)     // []
 *   safeArray(null)          // []
 *   safeArray('oops')        // []
 *   safeArray([1, 2, 3])     // [1, 2, 3]
 *   safeArray([], ['x'])     // []   ← empty array IS valid
 */
export function safeArray(val, fallback) {
  if (Array.isArray(val)) return val;
  return Array.isArray(fallback) ? fallback : [];
}

// ─── safeObject ───────────────────────────────────────────────────
/**
 * Ensures the value is a plain object (not an array, not null).
 * When val is a valid object, it is MERGED over the fallback so
 * any missing keys from val are filled in from fallback.
 *
 * @template {object} T
 * @param {unknown} val     — the value to validate
 * @param {T} fallback      — base shape; also returned when val is invalid
 * @returns {T}
 *
 * @example
 *   safeObject(undefined, SAFE_USER)        // SAFE_USER
 *   safeObject({ name: 'Ali' }, SAFE_USER)  // { ...SAFE_USER, name: 'Ali' }
 *   safeObject([], SAFE_USER)               // SAFE_USER  (array is rejected)
 */
export function safeObject(val, fallback) {
  const base = (fallback && typeof fallback === 'object' && !Array.isArray(fallback))
    ? fallback
    : {};
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return { ...base, ...val };
  }
  return base;
}

// ─── safeString ───────────────────────────────────────────────────
/**
 * Ensures the value is a non-null string.
 * Trims whitespace by default; pass `{ trim: false }` to skip.
 *
 * @param {unknown} val           — the value to validate
 * @param {string}  [fallback=''] — returned when val is not a string
 * @param {{ trim?: boolean }} [opts] — options
 * @returns {string}
 *
 * @example
 *   safeString(undefined)       // ''
 *   safeString(42)              // ''
 *   safeString('  hello  ')     // 'hello'
 *   safeString('', 'default')   // '' (empty string IS valid)
 */
export function safeString(val, fallback = '', opts = {}) {
  if (typeof val !== 'string') {
    return typeof fallback === 'string' ? fallback : '';
  }
  return opts.trim === false ? val : val.trim();
}

// ─── safeNumber ───────────────────────────────────────────────────
/**
 * Ensures the value is a finite number (not NaN, not Infinity).
 *
 * @param {unknown}        val           — the value to validate
 * @param {number | null}  [fallback=null] — returned when val is not a finite number
 * @returns {number | null}
 *
 * @example
 *   safeNumber(undefined)  // null
 *   safeNumber(NaN)        // null
 *   safeNumber(Infinity)   // null
 *   safeNumber('32')       // 32     (string coercion)
 *   safeNumber('bad')      // null
 *   safeNumber(0, -1)      // 0      (0 IS valid)
 */
export function safeNumber(val, fallback = null) {
  if (val == null) return fallback;
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

// ─── safeBoolean ─────────────────────────────────────────────────
/**
 * Ensures the value is a boolean. Accepts boolean-ish values
 * ('true'/'false' strings, 1/0) and coerces them.
 *
 * @param {unknown} val            — the value to validate
 * @param {boolean} [fallback=false] — returned when val cannot be coerced
 * @returns {boolean}
 *
 * @example
 *   safeBoolean(undefined)   // false
 *   safeBoolean(null)        // false
 *   safeBoolean(true)        // true
 *   safeBoolean(1)           // true
 *   safeBoolean('true')      // true
 *   safeBoolean('false')     // false
 *   safeBoolean('yes')       // false  (unknown string → fallback)
 */
export function safeBoolean(val, fallback = false) {
  if (val === true  || val === 1 || val === '1' || val === 'true')  return true;
  if (val === false || val === 0 || val === '0' || val === 'false') return false;
  return typeof fallback === 'boolean' ? fallback : false;
}

// ─── safeId ───────────────────────────────────────────────────────
/**
 * Ensures the value is a non-empty string (for UUID / numeric IDs).
 * Returns null if the value is missing or not a string.
 *
 * @param {unknown} val
 * @returns {string | null}
 *
 * @example
 *   safeId(undefined)          // null
 *   safeId('')                 // null  (empty string is not a valid ID)
 *   safeId('uuid-1234')        // 'uuid-1234'
 *   safeId(42)                 // null  (numeric IDs must be explicitly converted)
 */
export function safeId(val) {
  if (typeof val !== 'string') return null;
  const v = val.trim();
  return v.length > 0 ? v : null;
}

// ─── safeEnum ─────────────────────────────────────────────────────
/**
 * Ensures the value is one of an explicit set of allowed strings.
 *
 * @template {string} T
 * @param {unknown}   val
 * @param {T[]}       allowed    — exhaustive list of valid values
 * @param {T}         fallback   — returned when val is not in allowed
 * @returns {T}
 *
 * @example
 *   safeEnum(undefined, ['farmer', 'ngo', 'buyer'], 'farmer')  // 'farmer'
 *   safeEnum('ngo', ['farmer', 'ngo', 'buyer'], 'farmer')       // 'ngo'
 *   safeEnum('hacker', ['farmer', 'ngo', 'buyer'], 'farmer')    // 'farmer'
 */
export function safeEnum(val, allowed, fallback) {
  if (typeof val === 'string' && allowed.includes(val)) return val;
  return fallback;
}

// ─── validateApiResponse ──────────────────────────────────────────
/**
 * Validates a full API response object against an expected shape.
 * Returns the response merged over the shape (fills missing keys
 * with shape values), never throws.
 *
 * @template {object} T
 * @param {unknown} response   — raw API response
 * @param {T}       shape      — expected shape (used as fallback)
 * @returns {T}
 *
 * @example
 *   const user = validateApiResponse(await fetchUser(), SAFE_USER);
 *   // user.id may be null if the API didn't return it
 */
export function validateApiResponse(response, shape) {
  return safeObject(response, shape);
}

// ─── Test hooks ───────────────────────────────────────────────────
export const _internal = Object.freeze({
  safeArray,
  safeObject,
  safeString,
  safeNumber,
  safeBoolean,
  safeId,
  safeEnum,
  validateApiResponse,
});
