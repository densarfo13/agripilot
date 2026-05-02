/**
 * scanProviders.js — provider registry for the ML inference layer.
 *
 * Lets the team pick a concrete external vision provider without
 * touching scanInferenceService.js. Selected via env:
 *
 *   SCAN_PROVIDER_PROFILE = 'plantnet' | 'plantix' | 'cropsense' | 'generic'
 *
 *   Required for any external profile:
 *     SCAN_API_KEY        — bearer / api-key
 *
 *   Per-profile required vars:
 *     plantnet:    PLANTNET_PROJECT (default: 'all')
 *     plantix:     (none beyond SCAN_API_KEY)
 *     cropsense:   (none beyond SCAN_API_KEY)
 *     generic:     SCAN_PROVIDER_URL — POST endpoint
 *
 * Each adapter exports:
 *   {
 *     name:       string,
 *     buildRequest({ image, mime, cropName, country, region }) → { url, headers, body }
 *     parseResponse(rawJson) → { symptom, confidence, raw }
 *   }
 *
 * Adapters DO NOT call fetch — scanInferenceService owns the
 * network call so timeouts + abort handling stay centralised.
 *
 * Strict rules
 *   * No PII forwarded — only image bytes + crop/country/region.
 *   * Adapters never throw. Bad responses normalise to
 *     `{ symptom: 'unclear', confidence: 'low' }`.
 *   * Adding a new provider is a pure data change here; no
 *     edits to scanInferenceService required.
 */

// ── Symptom normaliser shared by every adapter ────────────────
function _normalizeSymptom(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return 'unclear';
  if (/spot|lesion|mildew|rust|blight|mold/.test(s))     return 'spots';
  if (/yellow|chloros|nitrogen|deficien/.test(s))         return 'yellow';
  if (/hole|chew|nibble|insect|pest|aphid|caterpillar/.test(s)) return 'holes';
  if (/wilt|droop|limp/.test(s))                          return 'wilt';
  if (/brown|burn|scorch|crisp|necros|sunburn/.test(s))  return 'discoloration';
  if (/healthy|normal|fine|ok\b/.test(s))                 return 'healthy';
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

// ── PlantNet adapter ───────────────────────────────────────────
//   docs: https://my.plantnet.org/account/doc
const plantnet = Object.freeze({
  name: 'plantnet',
  buildRequest({ image, mime, cropName }) {
    const project = process.env.PLANTNET_PROJECT || 'all';
    const apiKey  = process.env.SCAN_API_KEY;
    const url     = `https://my-api.plantnet.org/v2/identify/${encodeURIComponent(project)}?api-key=${encodeURIComponent(apiKey || '')}&include-related-images=false`;

    const form = new FormData();
    const blob = new Blob([image], { type: mime || 'image/jpeg' });
    form.append('images', blob, 'plant.jpg');
    form.append('organs', 'leaf');
    if (cropName) form.append('lang', 'en');

    return {
      url,
      // Don't set Content-Type — fetch sets the multipart boundary.
      headers: {},
      body: form,
    };
  },
  parseResponse(json) {
    const result = (json && Array.isArray(json.results) && json.results[0]) || null;
    if (!result) return { symptom: 'unclear', confidence: 'low', raw: json };
    // PlantNet returns species ID + score; it doesn't classify
    // disease symptoms directly. Map a high-confidence species
    // match → 'healthy' (the plant is well-photographed enough
    // to identify); lower scores → 'unclear' (the rule pipeline
    // + weather rules then drive the actual verdict).
    const score = Number(result.score);
    if (Number.isFinite(score) && score >= 0.75) {
      return { symptom: 'healthy', confidence: 'medium', raw: json };
    }
    return { symptom: 'unclear', confidence: 'low', raw: json };
  },
});

// ── Plantix adapter ────────────────────────────────────────────
//   Plantix Crop Doctor API: closed but vendor docs share a
//   { class, probability, symptoms[] } envelope. Generic mapper.
const plantix = Object.freeze({
  name: 'plantix',
  buildRequest({ image, mime, cropName, country, region }) {
    const url = process.env.PLANTIX_URL
      || 'https://api.plantix.net/v2/diagnose';
    return {
      url,
      headers: {
        'Authorization': `Bearer ${process.env.SCAN_API_KEY || ''}`,
        'Content-Type':  mime || 'application/octet-stream',
        'X-Crop':        cropName  || '',
        'X-Country':     country   || '',
        'X-Region':      region    || '',
      },
      body: image,
    };
  },
  parseResponse(json) {
    const top = (json && (json.top || (Array.isArray(json.diagnoses) && json.diagnoses[0]))) || null;
    if (!top) return { symptom: 'unclear', confidence: 'low', raw: json };
    const label = top.symptoms?.[0] || top.class || top.label || top.name;
    return {
      symptom:    _normalizeSymptom(label),
      confidence: _normalizeConfidence(top.probability ?? top.confidence ?? top.score),
      raw:        json,
    };
  },
});

// ── Cropsense adapter ──────────────────────────────────────────
//   Generic cloud-vision-style classifier with a labels[] array.
const cropsense = Object.freeze({
  name: 'cropsense',
  buildRequest({ image, mime, cropName, country, region }) {
    const url = process.env.CROPSENSE_URL
      || 'https://api.cropsense.ai/v1/classify';
    return {
      url,
      headers: {
        'Authorization': `Bearer ${process.env.SCAN_API_KEY || ''}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        image:   Buffer.isBuffer(image) ? image.toString('base64') : null,
        mime,
        crop:    cropName || null,
        country: country  || null,
        region:  region   || null,
      }),
    };
  },
  parseResponse(json) {
    const labels = (json && Array.isArray(json.labels)) ? json.labels : [];
    const top = labels[0] || null;
    if (!top) return { symptom: 'unclear', confidence: 'low', raw: json };
    return {
      symptom:    _normalizeSymptom(top.name || top.label),
      confidence: _normalizeConfidence(top.score ?? top.confidence),
      raw:        json,
    };
  },
});

// ── Generic adapter (fallback) ─────────────────────────────────
const generic = Object.freeze({
  name: 'generic',
  buildRequest({ image, mime, cropName, country, region }) {
    const url = process.env.SCAN_PROVIDER_URL;
    return {
      url,
      headers: {
        'Authorization': `Bearer ${process.env.SCAN_API_KEY || ''}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        imageBase64: Buffer.isBuffer(image) ? image.toString('base64') : null,
        mime,
        crop:    cropName || null,
        country: country  || null,
        region:  region   || null,
      }),
    };
  },
  parseResponse(json) {
    const symptom = _normalizeSymptom(json?.symptom || json?.label || json?.diagnosis);
    const conf    = _normalizeConfidence(json?.confidence);
    return { symptom, confidence: conf, raw: json };
  },
});

// ── Registry + selector ────────────────────────────────────────
const REGISTRY = Object.freeze({
  plantnet, plantix, cropsense, generic,
});

/**
 * pickProvider() — returns the adapter matching
 * SCAN_PROVIDER_PROFILE, or `generic` when the env value is
 * unrecognised. Returns null when SCAN_API_KEY is unset (caller
 * should use the rule fallback).
 */
export function pickProvider() {
  if (!process.env.SCAN_API_KEY) return null;
  const profile = String(process.env.SCAN_PROVIDER_PROFILE || 'generic')
    .toLowerCase().trim();
  return REGISTRY[profile] || generic;
}

/**
 * describeProviders() — diagnostic. Returns the list of
 * registered profile names + the currently-selected one. Used
 * by the /api/ops/health admin endpoint.
 */
export function describeProviders() {
  const selected = pickProvider();
  return {
    available: Object.keys(REGISTRY),
    selected:  selected ? selected.name : null,
    apiKeySet: !!process.env.SCAN_API_KEY,
  };
}

export const _internal = Object.freeze({
  REGISTRY, _normalizeSymptom, _normalizeConfidence,
});

export default pickProvider;
