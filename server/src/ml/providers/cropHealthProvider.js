/**
 * cropHealthProvider.js — Kindwise crop.health adapter.
 *
 * Closes the "CROP_HEALTH_API_KEY read but no adapter" gap. Reads
 * process.env.CROP_HEALTH_API_KEY (alias CROP_ID_API_KEY) DIRECTLY and POSTs to
 * the Kindwise crop.health endpoint with the same Api-Key convention as the
 * Plant.id / insect.id adapters.
 *
 *   import { detectCropHealth, cropHealthKeyPresent, cropHealthProviderInfo }
 *     from './cropHealthProvider.js';
 *   const res = await detectCropHealth({ image, mime, cropName });
 *
 * Returns a normalized envelope the consensus engine + FarmBrain consume:
 *   { ok, status, disease, confidence, confidencePct, severity, affectedArea,
 *     treatment, prevention, nutrition, irrigation, candidates, latencyMs }
 *
 * status ∈ READY | AUTH_FAILED | RATE_LIMITED | NO_RESULT | UNSUPPORTED.
 * Strict: no PII forwarded, never throws, 6s timeout, returns an honest
 * envelope (never a fabricated diagnosis) when the key is missing or the API
 * is unreachable.
 */
const CROP_HEALTH_ENDPOINT = process.env.CROP_HEALTH_ENDPOINT
  || 'https://crop.kindwise.com/api/v1/identification';
const REQUEST_TIMEOUT_MS = 6000;

function _key() {
  return (process.env.CROP_HEALTH_API_KEY || process.env.CROP_ID_API_KEY || '').trim();
}
export function cropHealthKeyPresent() {
  try { return !!_key(); } catch { return false; }
}

// Diagnostic — mirrors the identification provider's [scan.provider] lines so
// the crop-health/disease stage is PROVABLE from runtime logs. Logs the
// endpoint + HTTP status + disease name/count/confidence + latency ONLY —
// never the image, the key, or any PII.
function _plog(msg) { try { console.log('[scan.provider] ' + msg); } catch { /* ignore */ } }

function _imageToBase64(image) {
  try {
    if (!image) return '';
    if (typeof image === 'string') return image.replace(/^data:[^;]+;base64,/, '');
    if (Buffer.isBuffer(image)) return image.toString('base64');
    if (image.buffer) return Buffer.from(image.buffer).toString('base64');
    return '';
  } catch { return ''; }
}

function _severityFromScore(score) {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function _empty(status, reason, latencyMs) {
  return Object.freeze({
    ok: status === 'READY' || status === 'NO_RESULT',
    status, reason: reason || null,
    disease: '', confidence: 0, confidencePct: 0, severity: 'low',
    affectedArea: '', treatment: '', prevention: '', nutrition: '', irrigation: '',
    candidates: Object.freeze([]),
    latencyMs: latencyMs || 0,
    limitations: 'Decision support, not a guarantee.',
  });
}

/** Map an HTTP status to the provider status taxonomy. */
function _statusFromHttp(http) {
  if (http === 401 || http === 403) return 'AUTH_FAILED';
  if (http === 429) return 'RATE_LIMITED';
  return 'UNSUPPORTED';
}

export async function detectCropHealth({ image, mime: _mime, cropName } = {}) {
  if (!cropHealthKeyPresent()) {
    _plog('→ crop.health SKIPPED reason=no_key');
    return _empty('UNSUPPORTED', 'CROP_HEALTH_API_KEY missing', 0);
  }
  const b64 = _imageToBase64(image);
  if (!b64) {
    _plog('→ crop.health SKIPPED reason=empty_image');
    return _empty('NO_RESULT', 'empty_image', 0);
  }

  const body = JSON.stringify({
    images: [b64],
    similar_images: true,
    // Ask crop.health for the rich detail blocks the spec needs.
    details: ['treatment', 'prevention', 'cause', 'common_names', 'description'],
    ...(cropName ? { crop: String(cropName) } : {}),
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  _plog('→ crop.health ' + CROP_HEALTH_ENDPOINT + ' auth=yes');
  try {
    const res = await fetch(CROP_HEALTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': _key() },
      body, signal: ctrl.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - startedAt;

    if (!res || !res.ok) {
      const http = res ? res.status : 0;
      _plog('← crop.health HTTP ' + http + ' status=' + _statusFromHttp(http) + ' latency=' + latencyMs + 'ms');
      return _empty(_statusFromHttp(http), 'http_' + http, latencyMs);
    }

    const json = await res.json();
    const result = (json && json.result) || {};
    // crop.health returns a `disease` classification block.
    const disease = result.disease || result.classification || {};
    const suggestions = Array.isArray(disease.suggestions) ? disease.suggestions : [];
    const top = suggestions[0] || null;
    if (!top) {
      _plog('← crop.health HTTP 200 disease=none candidates=0 latency=' + latencyMs + 'ms');
      return _empty('NO_RESULT', 'no_suggestion', latencyMs);
    }

    const details = top.details || {};
    const score = Number(top.probability) || 0;
    const cn = Array.isArray(details.common_names) ? details.common_names : [];
    const diseaseName = String(cn[0] || top.name || '');
    const t = details.treatment || {};
    const chem = Array.isArray(t.chemical) ? t.chemical.join('; ') : (t.chemical || '');
    const bio = Array.isArray(t.biological) ? t.biological.join('; ') : (t.biological || '');
    const prev = Array.isArray(t.prevention) ? t.prevention.join('; ')
      : (Array.isArray(details.prevention) ? details.prevention.join('; ') : (t.prevention || details.prevention || ''));

    const candidates = suggestions.slice(0, 5).map((s) => {
      const d = s && s.details || {};
      const c = Array.isArray(d.common_names) ? d.common_names : [];
      return Object.freeze({
        name: String(c[0] || s.name || ''), scientificName: String(s.name || ''),
        score: Number(s.probability) || 0, source: 'crop_kindwise',
      });
    });

    _plog('← crop.health HTTP 200 disease="' + diseaseName + '" candidates=' + candidates.length
      + ' conf=' + Math.round(score * 100) + ' latency=' + latencyMs + 'ms');
    return Object.freeze({
      ok: true, status: 'READY', reason: null,
      disease: diseaseName,
      confidence: score, confidencePct: Math.round(score * 100),
      severity: _severityFromScore(score),
      affectedArea: String(details.affected_area || result.affected_area || ''),
      treatment: [chem, bio].filter(Boolean).join(' | '),
      prevention: String(prev || ''),
      nutrition: String(details.nutrition || ''),
      irrigation: String(details.irrigation || ''),
      candidates: Object.freeze(candidates),
      latencyMs,
      limitations: 'Decision support, not a guarantee.',
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err && err.name === 'AbortError';
    _plog('← crop.health ERROR ' + (aborted ? 'timeout' : (err && err.message || 'unknown'))
      + ' latency=' + (Date.now() - startedAt) + 'ms');
    return _empty('UNSUPPORTED', aborted ? 'timeout' : ('error:' + (err && err.message || 'unknown')),
      Date.now() - startedAt);
  }
}

export function cropHealthProviderInfo() {
  return Object.freeze({
    name: 'crop_health_kindwise',
    endpoint: CROP_HEALTH_ENDPOINT,
    envVar: 'CROP_HEALTH_API_KEY',
    envAlias: 'CROP_ID_API_KEY',
    keyPresent: cropHealthKeyPresent(),
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
}
