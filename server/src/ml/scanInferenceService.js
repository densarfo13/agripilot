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

// Production-Dependency-Fix §4 — provider priority order. Any of
// the four canonical scan keys puts the inference into 'external'
// mode; the rule-based fallback only fires when ALL are missing.
// scanProviders.js resolves the actual adapter + reads the right
// key (via _resolveScanApiKey() below).
function _hasAnyScanKey() {
  return !!((process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY)
         || process.env.PLANTNET_API_KEY
         || process.env.SCAN_API_KEY
         || process.env.OPENAI_API_KEY);
}

function _selectProvider(override) {
  if (typeof override === 'string' && override) return override;
  if (_hasAnyScanKey()) return 'external';
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
// Sprint #221 — last-call provider diagnostics (no secrets). Surfaced
// via getScanProviderDiagnostics() + /api/scan/diagnostics so a P0
// "every clear photo reads unclear" can be root-caused in production
// without guessing. NEVER stores the key — only its presence/length.
const _lastProviderDiag = {
  providerName: null,
  httpStatus: null,
  candidateCount: null,
  confidence: null,
  failureReason: null,
  latencyMs: null,
  at: null,
};
function _recordDiag(patch) {
  try { Object.assign(_lastProviderDiag, patch, { at: new Date().toISOString() }); }
  catch { /* never throw from diagnostics */ }
}

// First-6-char fingerprint, never more. Lets the operator compare the
// runtime key against the one configured in Kindwise without exposing it.
function _fingerprint(v) {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s.slice(0, 6) : null;
}

/** Is the Plant.id (or any scan) provider configured at runtime? */
export function getScanProviderDiagnostics() {
  // Sprint #221b — the P0 was an env-var NAME mismatch: code read
  // PLANT_ID_API_KEY, the key was set as PLANT_API_KEY. Report BOTH so a
  // name mismatch is impossible to miss. Resolver prefers the canonical
  // PLANT_ID_API_KEY, then falls back to the PLANT_API_KEY alias.
  const idVal    = (process.env.PLANT_ID_API_KEY || '').trim();
  const aliasVal = (process.env.PLANT_API_KEY || '').trim();
  const key = idVal || aliasVal;
  const envVarUsed = idVal ? 'PLANT_ID_API_KEY' : (aliasVal ? 'PLANT_API_KEY' : null);
  return Object.freeze({
    providerConfigured: !!key,
    // Which env var actually supplied the key at runtime.
    envVarUsed,
    // Presence + length for BOTH accepted names (value never exposed).
    plantIdApiKeyLength: idVal.length,       // PLANT_ID_API_KEY (canonical)
    plantApiKeyLength:   aliasVal.length,    // PLANT_API_KEY (alias)
    keyPresent: !!key,
    keyLength: key ? key.length : 0,
    keyLooksTruncated: !!key && key.length < 20,
    // First 6 chars ONLY — compare against the Kindwise dashboard key.
    keyFingerprint: _fingerprint(key),
    anyScanKey: _hasAnyScanKey(),
    providerName: _lastProviderDiag.providerName,
    lastHttpStatus: _lastProviderDiag.httpStatus,
    lastCandidateCount: _lastProviderDiag.candidateCount,
    lastConfidence: _lastProviderDiag.confidence,
    lastFailureReason: _lastProviderDiag.failureReason,
    lastLatencyMs: _lastProviderDiag.latencyMs,
    lastCallAt: _lastProviderDiag.at,
  });
}

/**
 * Execute a REAL authenticated provider call (Kindwise usage_info) to
 * prove the key works — WITHOUT consuming identification credits.
 *   200 → key valid + mounted   401/403 → key invalid/expired
 *   no key → not_configured
 * Returns { provider, httpStatus, candidateCount, responseBody, failureReason }.
 */
export async function pingScanProvider() {
  const key = (process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY || '').trim();
  const out = {
    provider: 'plantid',
    httpStatus: null,
    candidateCount: null,   // usage_info is a key-validation ping, not an identification
    responseBody: null,
    failureReason: null,
    keyFingerprint: _fingerprint(key),
    envVarUsed: process.env.PLANT_ID_API_KEY ? 'PLANT_ID_API_KEY'
              : (process.env.PLANT_API_KEY ? 'PLANT_API_KEY' : null),
  };
  if (!key) { out.failureReason = 'not_configured'; return out; }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), INFERENCE_TIMEOUT_MS);
  try {
    const res = await fetch('https://plant.id/api/v3/usage_info', {
      method: 'GET', headers: { 'Api-Key': key }, signal: ctrl.signal,
    });
    clearTimeout(t);
    out.httpStatus = res.status;
    let body = '';
    try { body = (await res.text()).slice(0, 300); } catch { /* ignore */ }
    out.responseBody = body;
    out.failureReason = res.ok ? null : `provider_http_${res.status}`;
    console.log('[scan.provider.ping] HTTP', res.status, 'fp=' + (out.keyFingerprint || 'none'),
      'via=' + out.envVarUsed);
  } catch (err) {
    clearTimeout(t);
    const aborted = err && err.name === 'AbortError';
    out.failureReason = aborted ? 'provider_timeout' : 'provider_exception';
    out.responseBody = err && err.message ? String(err.message).slice(0, 200) : null;
  } finally {
    clearTimeout(t);
  }
  return out;
}

async function _externalClassify(input) {
  const { pickProvider } = await import('./scanProviders.js');
  const adapter = pickProvider();
  if (!adapter) {
    _recordDiag({ providerName: null, failureReason: 'provider_unconfigured', httpStatus: null });
    return { ok: false, error: 'provider_unconfigured', serviceUnavailable: false, providerConfigured: false };
  }
  const providerConfigured = !!(process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY);

  let req;
  try { req = adapter.buildRequest(input); }
  catch (err) {
    _recordDiag({ providerName: adapter.name, failureReason: 'adapter_request_build_failed' });
    return { ok: false, error: 'adapter_request_build_failed', message: err && err.message };
  }
  if (!req || !req.url) {
    _recordDiag({ providerName: adapter.name, failureReason: 'adapter_url_missing' });
    return { ok: false, error: 'adapter_url_missing' };
  }
  // Outbound log — URL + whether an Api-Key was actually attached. NO
  // key value, NO image bytes.
  const _hasAuth = !!(req.headers && (req.headers['Api-Key'] || req.headers.Authorization));
  console.log('[scan.provider] →', adapter.name, req.url, 'auth=' + (_hasAuth ? 'yes' : 'MISSING'));

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), INFERENCE_TIMEOUT_MS);
  const _t0 = Date.now();
  try {
    const res = await fetch(req.url, {
      method:  'POST',
      headers: req.headers || {},
      body:    req.body,
      signal:  ctrl.signal,
    });
    clearTimeout(t);
    const latencyMs = Date.now() - _t0;
    if (!res || !res.ok) {
      const status = res ? res.status : 0;
      // Read a short body snippet for the log (auth errors carry a
      // useful message); never log more than 240 chars.
      let bodySnip = '';
      try { bodySnip = (await res.text()).slice(0, 240); } catch { /* ignore */ }
      console.error('[scan.provider] ← HTTP', status, adapter.name, 'latency=' + latencyMs + 'ms', bodySnip);
      _recordDiag({
        providerName: adapter.name, httpStatus: status, candidateCount: 0,
        confidence: null, latencyMs,
        failureReason: `provider_http_${status || 'no_response'}`,
      });
      // configured-but-failing → service unavailable (NOT "unknown plant").
      return {
        ok: false, error: `provider_http_${status || 'no_response'}`,
        serviceUnavailable: providerConfigured, httpStatus: status, providerConfigured,
      };
    }
    const data = await res.json();
    const parsed = adapter.parseResponse(data) || {};
    const candidateCount = Array.isArray(parsed.candidates) ? parsed.candidates.length : 0;
    const symptom = _normalizeSymptom(parsed.symptom);
    const conf    = _normalizeConfidence(parsed.confidence);
    console.log('[scan.provider] ←', adapter.name, 'HTTP 200 candidates=' + candidateCount,
      'conf=' + conf, 'latency=' + latencyMs + 'ms');
    _recordDiag({
      providerName: adapter.name, httpStatus: 200, candidateCount,
      confidence: conf, latencyMs, failureReason: candidateCount > 0 ? null : 'zero_candidates',
    });
    return {
      ok: true,
      httpStatus: 200,
      candidateCount,
      providerConfigured,
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
    clearTimeout(t);
    const aborted = err && err.name === 'AbortError';
    console.error('[scan.provider] ✗', adapter.name, aborted ? 'timeout' : (err && err.message));
    _recordDiag({
      providerName: adapter.name, httpStatus: null,
      failureReason: aborted ? 'provider_timeout' : 'provider_exception',
      latencyMs: Date.now() - _t0,
    });
    return {
      ok: false, error: aborted ? 'provider_timeout' : 'provider_exception',
      message: err && err.message, serviceUnavailable: providerConfigured, providerConfigured,
    };
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
        // Sprint #221 — surface provider availability so the route +
        // envelope can distinguish "service temporarily unavailable"
        // (provider configured but the call failed) from "unknown plant".
        providerConfigured: !!(attempt && attempt.providerConfigured),
        providerHttpStatus: (attempt && attempt.httpStatus) ?? null,
      },
      // True when a configured provider FAILED (401/403/429/5xx/timeout),
      // NOT when it's simply unconfigured or returned a clean no-result.
      serviceUnavailable: !!(attempt && attempt.serviceUnavailable),
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
