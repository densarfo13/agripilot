/**
 * resolveIdentificationState.js — the SINGLE server-owned identification-band
 * resolver (spec P0/P2, Option-1 PR).
 *
 * Replaces the single hard 70% branch with calibrated, environment-configurable
 * bands. This is the ONE place the confidence→state decision is made on the
 * server; the API response carries the resolved state and the client RENDERS it
 * (it must not re-derive thresholds — see scanGuidanceResolver.ts).
 *
 * States (Option-1 requirement #3):
 *   CONFIRMED · PROVISIONAL · LOW_CONFIDENCE · NOT_A_PLANT · PROVIDER_ERROR
 *
 * Env (requirement #1; safe defaults when missing/invalid, requirement #2):
 *   SCAN_IDENTIFICATION_CONFIRMED_THRESHOLD   default 0.70
 *   SCAN_IDENTIFICATION_PROVISIONAL_THRESHOLD default 0.40
 *   SCAN_IDENTIFICATION_MARGIN_THRESHOLD      default 0.10
 *   SCAN_IS_PLANT_THRESHOLD                   default 0.50
 *
 * Pure. Never throws. No secrets, no image bytes.
 */

// Parse a 0..1 threshold from env. Any missing / non-numeric / out-of-range
// value falls back to the safe default (requirement #2). `allowZero` lets the
// margin threshold be disabled (0) while confidence thresholds must be > 0.
function _envFloat(name, def, allowZero = false) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  if (n < 0 || n > 1) return def;
  if (n === 0 && !allowZero) return def;
  return n;
}

/** The active, env-resolved thresholds (safe defaults applied). */
export function getIdentificationThresholds() {
  return Object.freeze({
    confirmed:   _envFloat('SCAN_IDENTIFICATION_CONFIRMED_THRESHOLD', 0.70),
    provisional: _envFloat('SCAN_IDENTIFICATION_PROVISIONAL_THRESHOLD', 0.40),
    margin:      _envFloat('SCAN_IDENTIFICATION_MARGIN_THRESHOLD', 0.10, /*allowZero*/ true),
    isPlant:     _envFloat('SCAN_IS_PLANT_THRESHOLD', 0.50),
  });
}

function _num01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  // Accept 0..1 (provider probability) OR 0..100 (pct) and normalize to 0..1.
  if (n > 1 && n <= 100) return n / 100;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function _band(topConfidence) {
  if (topConfidence == null) return 'low';
  if (topConfidence >= 0.75) return 'high';
  if (topConfidence >= 0.45) return 'medium';
  return 'low';
}

function _out(identificationState, reasonCode, ctx) {
  return Object.freeze({
    identificationState,
    reasonCode,
    confidenceBand:      _band(ctx.topConfidence),
    topConfidence:       ctx.topConfidence,
    secondConfidence:    ctx.secondConfidence,
    margin:              ctx.margin,
    isPlantProbability:  ctx.isPlant,
    thresholds:          ctx.th,
  });
}

// Provider status strings that mean "the call failed" (auth/timeout/quota/
// parse/transport). Matched loosely so callers can pass their own vocab.
const _ERROR_TOKENS = ['error', 'timeout', 'quota', 'auth', 'parse', 'transport', 'unavailable', 'rate_limit'];

/**
 * Resolve the identification band from real, already-normalized signals.
 *
 * @param {object}   input
 * @param {number|null} input.isPlantProbability  provider is_plant probability (0..1) or null (unknown)
 * @param {Array}    input.candidates             provider candidates sorted DESC by score (0..1)
 * @param {string}   input.providerStatus         'ok' | 'error' | 'timeout' | 'no_candidates' | ...
 * @param {boolean}  [input.imageQualityFailed]   optional; the server usually cannot measure this
 *                                                 (the client owns LOW_IMAGE_QUALITY), default false
 * @returns {Readonly<object>} { identificationState, reasonCode, confidenceBand,
 *   topConfidence, secondConfidence, margin, isPlantProbability, thresholds }
 */
export function resolveIdentificationState({
  isPlantProbability,
  candidates,
  providerStatus,
  imageQualityFailed,
} = {}) {
  const th = getIdentificationThresholds();
  const cands = Array.isArray(candidates) ? candidates : [];
  const topConfidence = cands.length ? _num01(cands[0] && cands[0].score) : null;
  const secondConfidence = cands.length > 1 ? _num01(cands[1] && cands[1].score) : null;
  // Single candidate → no competitor → full margin. Two+ → the real gap.
  const margin = (topConfidence != null && secondConfidence != null)
    ? Math.max(0, Math.round((topConfidence - secondConfidence) * 1000) / 1000)
    : topConfidence;
  const isPlant = isPlantProbability == null ? null : _num01(isPlantProbability);
  const ctx = { th, topConfidence, secondConfidence, margin, isPlant };

  // PROVIDER_ERROR — a configured provider failed AND produced no usable
  // candidates. (An error that still returned candidates is treated as a
  // usable result.)
  const ps = String(providerStatus || '').toLowerCase();
  const providerFailed = _ERROR_TOKENS.some((t) => ps.includes(t));
  if (providerFailed && !cands.length) {
    return _out('PROVIDER_ERROR', 'provider_error', ctx);
  }

  // NOT_A_PLANT — an EXPLICIT is_plant reading below threshold. `null` means
  // the provider did not report it → never asserted (no false negatives).
  if (isPlant != null && isPlant < th.isPlant) {
    return _out('NOT_A_PLANT', 'is_plant_below_threshold', ctx);
  }

  // No candidates (and not an error) → nothing to name.
  if (!cands.length || topConfidence == null) {
    return _out('LOW_CONFIDENCE', 'no_candidates', ctx);
  }

  // CONFIRMED — top ≥ confirmed AND the margin over the 2nd candidate clears the
  // margin threshold (requirement #4). is_plant, when known, already passed.
  const marginOk = (secondConfidence == null) || (margin >= th.margin);
  if (topConfidence >= th.confirmed && marginOk) {
    return _out('CONFIRMED', 'confirmed', ctx);
  }

  // PROVISIONAL — top ≥ provisional, image quality not failed, valid plant
  // result, confirmed criteria not met (requirement #5). This includes the
  // "strong but too-close to distinguish safely" case → surface for confirmation
  // rather than auto-picking the wrong species.
  if (topConfidence >= th.provisional && !imageQualityFailed) {
    const reason = (topConfidence >= th.confirmed && !marginOk)
      ? 'confirmed_but_margin_too_close'
      : 'provisional';
    return _out('PROVISIONAL', reason, ctx);
  }

  // Candidates exist but the top is below the provisional floor.
  return _out('LOW_CONFIDENCE', 'below_provisional', ctx);
}

export default resolveIdentificationState;
