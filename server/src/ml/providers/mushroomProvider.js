/**
 * mushroomProvider.js — Kindwise mushroom.id adapter.
 *
 * Reads process.env.MUSHROOM_ID_API_KEY DIRECTLY and POSTs to the Kindwise
 * mushroom.id endpoint with the same Api-Key convention as the other adapters.
 *
 *   import { detectMushroom, mushroomKeyPresent } from './mushroomProvider.js';
 *   const res = await detectMushroom({ image, mime });
 *
 * Returns: { ok, status, species, edibility, confidence, confidencePct,
 *            warnings, candidates, latencyMs }
 *   edibility ∈ 'edible' | 'toxic' | 'inedible' | 'unknown'
 *   status    ∈ READY | AUTH_FAILED | RATE_LIMITED | NO_RESULT | UNSUPPORTED
 *
 * SAFETY: mushroom edibility is life-critical. This adapter NEVER asserts
 * "edible" on its own — when toxicity is unknown it returns 'unknown' with a
 * strong "do not eat without an expert" warning. It never fabricates a verdict.
 */
const MUSHROOM_ENDPOINT = process.env.MUSHROOM_ID_ENDPOINT
  || 'https://mushroom.kindwise.com/api/v1/identification';
const REQUEST_TIMEOUT_MS = 6000;

const NEVER_EAT_WARNING =
  'Never eat a wild mushroom based on an app. Confirm with a local expert — '
  + 'some toxic species look almost identical to edible ones.';

function _key() { return (process.env.MUSHROOM_ID_API_KEY || '').trim(); }
export function mushroomKeyPresent() {
  try { return !!_key(); } catch { return false; }
}

function _imageToBase64(image) {
  try {
    if (!image) return '';
    if (typeof image === 'string') return image.replace(/^data:[^;]+;base64,/, '');
    if (Buffer.isBuffer(image)) return image.toString('base64');
    if (image.buffer) return Buffer.from(image.buffer).toString('base64');
    return '';
  } catch { return ''; }
}

function _empty(status, reason, latencyMs) {
  return Object.freeze({
    ok: status === 'READY' || status === 'NO_RESULT',
    status, reason: reason || null,
    species: '', edibility: 'unknown', confidence: 0, confidencePct: 0,
    warnings: Object.freeze([NEVER_EAT_WARNING]),
    candidates: Object.freeze([]),
    latencyMs: latencyMs || 0,
    limitations: 'Identification support only — NOT an edibility guarantee.',
  });
}
function _statusFromHttp(http) {
  if (http === 401 || http === 403) return 'AUTH_FAILED';
  if (http === 429) return 'RATE_LIMITED';
  return 'UNSUPPORTED';
}

// Map provider edibility text → a conservative bucket. Anything not clearly
// edible/inedible stays 'unknown' (we never upgrade an unknown to edible).
function _edibility(details) {
  const raw = String((details && (details.edibility || details.toxicity)) || '').toLowerCase();
  if (/deadly|poison|toxic|not edible|inedible/.test(raw)) return /deadly|poison|toxic/.test(raw) ? 'toxic' : 'inedible';
  if (/\bedible\b/.test(raw) && !/not\s+edible|inedible/.test(raw)) return 'edible';
  return 'unknown';
}
function _warningsFor(edibility, details) {
  const out = [NEVER_EAT_WARNING];
  if (edibility === 'toxic') out.unshift('⚠ This may be TOXIC. Do not touch or eat it.');
  else if (edibility === 'unknown') out.unshift('Edibility could not be confirmed. Treat as unsafe.');
  const note = details && details.toxicity_note;
  if (note) out.push(String(note));
  return Object.freeze(out);
}

export async function detectMushroom({ image, mime: _mime } = {}) {
  if (!mushroomKeyPresent()) return _empty('UNSUPPORTED', 'MUSHROOM_ID_API_KEY missing', 0);
  const b64 = _imageToBase64(image);
  if (!b64) return _empty('NO_RESULT', 'empty_image', 0);

  const body = JSON.stringify({
    images: [b64], similar_images: true,
    details: ['edibility', 'toxicity', 'common_names', 'description'],
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(MUSHROOM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': _key() },
      body, signal: ctrl.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - startedAt;
    if (!res || !res.ok) return _empty(_statusFromHttp(res ? res.status : 0), 'http_' + (res ? res.status : 0), latencyMs);

    const json = await res.json();
    const result = (json && json.result) || {};
    const classification = result.classification || {};
    const suggestions = Array.isArray(classification.suggestions) ? classification.suggestions : [];
    const top = suggestions[0] || null;
    if (!top) return _empty('NO_RESULT', 'no_suggestion', latencyMs);

    const details = top.details || {};
    const score = Number(top.probability) || 0;
    const cn = Array.isArray(details.common_names) ? details.common_names : [];
    const species = String(cn[0] || top.name || '');
    const edibility = _edibility(details);

    const candidates = suggestions.slice(0, 5).map((s) => {
      const d = s && s.details || {};
      const c = Array.isArray(d.common_names) ? d.common_names : [];
      return Object.freeze({
        name: String(c[0] || s.name || ''), scientificName: String(s.name || ''),
        score: Number(s.probability) || 0, edibility: _edibility(d), source: 'mushroom_kindwise',
      });
    });

    return Object.freeze({
      ok: true, status: 'READY', reason: null,
      species, edibility,
      confidence: score, confidencePct: Math.round(score * 100),
      warnings: _warningsFor(edibility, details),
      candidates: Object.freeze(candidates),
      latencyMs,
      limitations: 'Identification support only — NOT an edibility guarantee.',
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err && err.name === 'AbortError';
    return _empty('UNSUPPORTED', aborted ? 'timeout' : ('error:' + (err && err.message || 'unknown')),
      Date.now() - startedAt);
  }
}

export function mushroomProviderInfo() {
  return Object.freeze({
    name: 'mushroom_kindwise', endpoint: MUSHROOM_ENDPOINT,
    envVar: 'MUSHROOM_ID_API_KEY', keyPresent: mushroomKeyPresent(), timeoutMs: REQUEST_TIMEOUT_MS,
  });
}
