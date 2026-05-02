/**
 * scanInferenceService.js — pluggable image-classification
 * provider with a rule-based fallback.
 *
 *   import { analyzePlantImage } from './scanInferenceService.js';
 *   const result = await analyzePlantImage({
 *     imageUrl, imageBase64,
 *     cropName, plantName,
 *     country, region, weather,
 *     activeExperience,
 *   });
 *
 * Provider strategy (spec §3, staged)
 *   V1: external vision API or pretrained plant model
 *   V2: custom Farroway-trained model
 *   V3: confidence calibration + severity scoring
 *
 * This module is V1 plumbing. Three providers ship today:
 *   • 'rule'     — local rule-based classifier (always available)
 *   • 'external' — HTTPS provider configured via env
 *   • 'local'    — placeholder for an in-process model (e.g.
 *                   a TensorFlow.js MobileNet) — stubbed for
 *                   now so callers can wire it without a code
 *                   change at integration time
 *
 * Selection order:
 *   1. provider arg (caller override — used by tests)
 *   2. process.env.SCAN_API_KEY set → 'external'
 *   3. fall back to 'rule'
 *
 * Strict rules
 *   * Never throws — every provider path returns a safe
 *     `{ ok: false, fallback: <ruleResult> }` so the caller
 *     can render the rule-based output without try/catch.
 *   * Wall-clock budget: 4000 ms per inference. After that
 *     the abort controller fires and we return the rule
 *     fallback. Callers running this in a queue can
 *     re-trigger the external attempt asynchronously.
 *   * No PII in payloads. The image bytes flow through; we
 *     do NOT pass user names, phone numbers, or coordinates
 *     to the external provider. The country / region / crop
 *     fields ARE forwarded as they are needed for context.
 */

const INFERENCE_TIMEOUT_MS = 4000;

// Symptom labels the providers + fallback both speak.
const SYMPTOMS = Object.freeze([
  'spots', 'yellow', 'holes', 'wilt', 'discoloration', 'healthy', 'unclear',
]);

function _now() { return Date.now(); }

function _selectProvider(override) {
  if (typeof override === 'string' && override) return override;
  if (process.env.SCAN_API_KEY) return 'external';
  return 'rule';
}

// ── Rule-based fallback classifier ────────────────────────────
//
// Pure heuristic. Always available. Reads optional caller-
// supplied hints (e.g. crop name, region) and returns one of
// our safe symptom labels. Real image analysis happens in the
// external / local providers; this is the floor.
function _ruleClassify({ cropName, plantName, weather }) {
  const w = weather && typeof weather === 'object' ? weather : {};
  const recentRain = !!(w.recentRain || (Number.isFinite(w.rainMm) && w.rainMm >= 5));
  const humid      = Number.isFinite(w.humidity) && w.humidity >= 70;
  const hot        = Number.isFinite(w.temperatureC) && w.temperatureC >= 30;
  const soilDry    = String(w.soil || '').toLowerCase() === 'dry';

  // Without an actual image classifier the floor is "unclear" —
  // hybrid rules in contextFusionEngine layer the weather signal
  // on top to produce a useful verdict for the user.
  let symptom = 'unclear';
  if (recentRain || humid)   symptom = 'unclear';      // weather alone isn't enough
  if (hot && soilDry)        symptom = 'wilt';

  return {
    symptom,
    confidence: 'low',
    meta: {
      provider:    'rule',
      crop:        cropName || plantName || null,
      reasonNotes: 'Rule fallback — no image classifier available.',
    },
  };
}

// ── External provider (HTTPS POST) ─────────────────────────────
//
// Delegates to the provider registry (scanProviders.js) so the
// concrete request/response shape lives next to its adapter.
// Adding a new vendor (PlantNet, Plantix, Cropsense, generic, …)
// is a pure data change in scanProviders.js — no edits here.
//
// Selected via SCAN_PROVIDER_PROFILE env. SCAN_API_KEY required
// for any external profile; per-provider URLs documented in
// scanProviders.js.
async function _externalClassify(input) {
  const { pickProvider } = await import('./scanProviders.js');
  const adapter = pickProvider();
  if (!adapter) return { ok: false, error: 'provider_unconfigured' };

  let req;
  try { req = adapter.buildRequest(input); }
  catch (err) {
    return { ok: false, error: 'adapter_request_build_failed', message: err && err.message };
  }
  if (!req || !req.url) {
    return { ok: false, error: 'adapter_url_missing' };
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), INFERENCE_TIMEOUT_MS);
  try {
    const res = await fetch(req.url, {
      method:  'POST',
      headers: req.headers || {},
      body:    req.body,
      signal:  ctrl.signal,
    });
    clearTimeout(t);
    if (!res || !res.ok) {
      return { ok: false, error: `provider_http_${res ? res.status : 'no_response'}` };
    }
    const data = await res.json();
    const parsed = adapter.parseResponse(data) || {};
    const symptom = _normalizeSymptom(parsed.symptom);
    const conf    = _normalizeConfidence(parsed.confidence);
    return {
      ok: true,
      result: {
        symptom,
        confidence: conf,
        meta: {
          provider:   `external:${adapter.name}`,
          providerId: data?.id || null,
          raw:        parsed.raw || data,
        },
      },
    };
  } catch (err) {
    return { ok: false, error: 'provider_exception', message: err && err.message };
  } finally {
    clearTimeout(t);
  }
}

// ── Local model placeholder ────────────────────────────────────
async function _localClassify(/* opts */) {
  // Hook for an in-process model (e.g. TensorFlow.js MobileNet
  // fine-tuned on Farroway scan_training_events). Not wired in
  // V1 — return a graceful error so the caller falls through
  // to the external provider or the rule fallback.
  return { ok: false, error: 'local_model_not_wired' };
}

function _normalizeSymptom(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return 'unclear';
  // Tolerant matchers — providers use different vocab.
  if (/spot|lesion/.test(s))                  return 'spots';
  if (/yellow|chloros/.test(s))               return 'yellow';
  if (/hole|chew|nibble|insect|pest|aphid/.test(s)) return 'holes';
  if (/wilt|droop|limp/.test(s))              return 'wilt';
  if (/brown|burn|scorch|crisp|necros/.test(s)) return 'discoloration';
  if (/healthy|normal|fine/.test(s))          return 'healthy';
  return 'unclear';
}

function _normalizeConfidence(raw) {
  if (typeof raw === 'number') {
    if (raw >= 0.75) return 'high';
    if (raw >= 0.45) return 'medium';
    return 'low';
  }
  const s = String(raw || '').toLowerCase();
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  return 'low';
}

/**
 * analyzePlantImage(input) — entry point.
 *
 * Returns a normalized shape regardless of which provider ran:
 *
 *   {
 *     symptom:    'spots' | 'yellow' | 'holes' | 'wilt' | 'discoloration' | 'healthy' | 'unclear',
 *     confidence: 'low'   | 'medium' | 'high',
 *     meta:       { provider, latencyMs, ... },
 *     fallbackUsed: boolean,
 *   }
 *
 * NEVER returns a "diagnosis" / "disease" string. The
 * scanSafetyFilter + contextFusionEngine layers turn this raw
 * symptom into a user-facing verdict.
 */
export async function analyzePlantImage(input = {}) {
  const t0 = _now();
  const provider = _selectProvider(input.provider);

  // Try the chosen provider first.
  let attempt;
  if (provider === 'external') {
    attempt = await _externalClassify(input);
  } else if (provider === 'local') {
    attempt = await _localClassify(input);
  } else {
    attempt = { ok: false, error: 'rule_only' };
  }

  // On failure, fall through to rule-based fallback.
  if (!attempt || !attempt.ok) {
    const ruleResult = _ruleClassify(input);
    return {
      ...ruleResult,
      meta: {
        ...ruleResult.meta,
        latencyMs:    _now() - t0,
        fallbackFrom: provider,
        fallbackReason: attempt && attempt.error,
      },
      fallbackUsed: provider !== 'rule',
    };
  }

  return {
    ...attempt.result,
    meta: {
      ...attempt.result.meta,
      latencyMs: _now() - t0,
    },
    fallbackUsed: false,
  };
}

export const _internal = Object.freeze({
  SYMPTOMS,
  INFERENCE_TIMEOUT_MS,
  _ruleClassify,
  _normalizeSymptom,
  _normalizeConfidence,
  _selectProvider,
});

export default analyzePlantImage;
