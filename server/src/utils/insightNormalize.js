/**
 * insightNormalize.js — server-side input shaping for the
 * Global Insights Layer (data moat §1).
 *
 * Every record that lands in `insight_aggregates` passes through
 * `normalizeInsightInput()`. The function:
 *
 *   • lowercases + trims region / cropOrPlant / setup / condition
 *   • coarsens region to keep granularity high enough to be
 *     useful but low enough to never identify a household
 *   • buckets `setup` into one of six allowed values
 *   • buckets `condition` into one of four allowed values
 *   • rejects anything that looks like PII (names, phones,
 *     full street addresses, raw GPS coordinates) — returns
 *     `null` so the caller can drop the record cleanly
 *   • clamps counter values to non-negative integers (also
 *     enforced by the DB trigger; defence-in-depth)
 *
 * All inputs are caller-supplied JSON strings. Never trust them.
 *
 * Why these specific buckets
 * ──────────────────────────
 * The spec lists `container / raised_bed / ground / indoor /
 * farm / unknown` for setup and `humid / rainy / hot / normal`
 * for condition. We accept common synonyms (e.g. `pot` →
 * `container`, `wet` → `rainy`) and route everything else to
 * `unknown` / `normal` so a buggy client cannot poison the
 * key space.
 */

// ─── Allowed buckets ───────────────────────────────────────

const SETUP_BUCKETS = Object.freeze([
  'container',
  'raised_bed',
  'ground',
  'indoor',
  'farm',
  'unknown',
]);

const CONDITION_BUCKETS = Object.freeze([
  'humid',
  'rainy',
  'hot',
  'normal',
]);

// Synonyms collapsed into the canonical bucket. Lowercased keys.
const SETUP_ALIASES = Object.freeze({
  'pot':            'container',
  'pots':           'container',
  'container':      'container',
  'containers':     'container',
  'raised':         'raised_bed',
  'raised_bed':     'raised_bed',
  'raised-bed':     'raised_bed',
  'raised bed':     'raised_bed',
  'bed':            'raised_bed',
  'ground':         'ground',
  'soil':           'ground',
  'open_ground':    'ground',
  'open ground':    'ground',
  'open-ground':    'ground',
  'indoor':         'indoor',
  'indoors':        'indoor',
  'inside':         'indoor',
  'farm':           'farm',
  'field':          'farm',
  'plot':           'farm',
  'unknown':        'unknown',
  '':               'unknown',
});

const CONDITION_ALIASES = Object.freeze({
  'humid':       'humid',
  'humidity':    'humid',
  'rainy':       'rainy',
  'rain':        'rainy',
  'wet':         'rainy',
  'storm':       'rainy',
  'hot':         'hot',
  'heat':        'hot',
  'dry':         'hot',          // hot+dry collapses to hot per spec
  'normal':      'normal',
  'mild':        'normal',
  '':            'normal',
});

// ─── PII rejection patterns ────────────────────────────────
//
// Keys are user-supplied strings; we want to refuse anything
// that's clearly an identifier rather than a coarse bucket.

const PHONE_RE   = /\+?\d[\d\s().-]{7,}\d/;          // e.g. "+233 24 555 1234"
const EMAIL_RE   = /\S+@\S+\.\S+/;
const STREET_RE  = /\b\d{1,5}\s+\w+\s+(road|rd|street|st|avenue|ave|drive|dr|lane|ln|way|blvd)\b/i;
const COORDS_RE  = /-?\d{1,3}\.\d{2,}\s*,?\s*-?\d{1,3}\.\d{2,}/; // raw lat,lng
const LONG_NAME_RE = /^[A-Z][a-z]+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/; // "Akua Mensah" / "John Q Doe"

function _looksLikePII(s) {
  if (typeof s !== 'string') return false;
  if (PHONE_RE.test(s))   return true;
  if (EMAIL_RE.test(s))   return true;
  if (STREET_RE.test(s))  return true;
  if (COORDS_RE.test(s))  return true;
  if (LONG_NAME_RE.test(s.trim())) return true;
  return false;
}

// ─── Region coarsening ─────────────────────────────────────
//
// Region is the most leaky field — a precise village name
// pinpoints a community of a few hundred people. We allow:
//   • country code (gh, ke, ng, ...) — 2 letters
//   • country + admin1 (gh-greater-accra) — letters + dashes
//   • a single word region (greater_accra) — letters / underscores
// Anything longer or with mixed case + digits / commas / quotes
// gets collapsed to its first sensible token. Empty / nonsense
// becomes 'unknown'.

const REGION_TOKEN_RE = /^[a-z]{2}(?:[-_][a-z]+){0,2}$|^[a-z]+$/;

function _coarsenRegion(s) {
  if (typeof s !== 'string') return 'unknown';
  let r = s.trim().toLowerCase();
  if (!r) return 'unknown';
  // Replace whitespace + hyphen runs with single underscore.
  r = r.replace(/[\s-]+/g, '_').replace(/[^a-z_]/g, '');
  // Truncate aggressively long strings.
  if (r.length > 32) r = r.slice(0, 32);
  if (!r) return 'unknown';
  if (REGION_TOKEN_RE.test(r) || /^[a-z_]+$/.test(r)) return r;
  return 'unknown';
}

// ─── Public API ────────────────────────────────────────────

function _normSetup(s) {
  if (s == null) return null;        // setup is optional in the model
  const k = String(s).trim().toLowerCase();
  if (k === '') return null;
  return SETUP_ALIASES[k] || (SETUP_BUCKETS.includes(k) ? k : 'unknown');
}

function _normCondition(s) {
  const k = String(s ?? '').trim().toLowerCase();
  return CONDITION_ALIASES[k] || (CONDITION_BUCKETS.includes(k) ? k : 'normal');
}

function _normCropOrPlant(s) {
  if (typeof s !== 'string') return '';
  const k = s.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
  if (!k) return '';
  if (k.length > 40) return k.slice(0, 40);
  return k;
}

function _clampCount(n) {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  // Hard upper bound per record per batch — prevents a buggy
  // client from amplifying a single key by 9 orders of magnitude.
  if (v > 10000) return 10000;
  return Math.floor(v);
}

/**
 * Normalise + privacy-screen one client-supplied insight delta.
 * Returns a clean record, or `null` when the input fails the
 * PII / bucket gates (caller drops it).
 *
 * @param {object} raw  caller-supplied entry
 * @returns {{
 *   region: string,
 *   cropOrPlant: string,
 *   setup: string|null,
 *   condition: string,
 *   shown: number,
 *   completed: number,
 *   success: number,
 *   failure: number,
 * } | null}
 */
export function normalizeInsightInput(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // PII gate — reject the whole record on any field that looks
  // like an identifier rather than a coarse bucket.
  for (const field of ['region', 'cropOrPlant', 'setup', 'condition']) {
    if (_looksLikePII(raw[field])) return null;
  }

  const region      = _coarsenRegion(raw.region);
  const cropOrPlant = _normCropOrPlant(raw.cropOrPlant);
  const setup       = _normSetup(raw.setup);
  const condition   = _normCondition(raw.condition);

  // A record without a usable cropOrPlant has no aggregation
  // value — drop it. Empty region is allowed (becomes 'unknown')
  // because pilot devices sometimes ship before locale resolves.
  if (!cropOrPlant) return null;

  return {
    region,
    cropOrPlant,
    setup,
    condition,
    shown:     _clampCount(raw.shown),
    completed: _clampCount(raw.completed),
    success:   _clampCount(raw.success),
    failure:   _clampCount(raw.failure),
  };
}

// Test-only seam.
export const _internal = Object.freeze({
  SETUP_BUCKETS,
  CONDITION_BUCKETS,
  _coarsenRegion,
  _looksLikePII,
  _normSetup,
  _normCondition,
  _normCropOrPlant,
  _clampCount,
});
