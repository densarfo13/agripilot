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

// Production-Dependency-Fix §4 — single resolver for the bearer
// key. Any of PLANT_ID_API_KEY / PLANTNET_API_KEY / SCAN_API_KEY
// /  OPENAI_API_KEY can wire the external scan path; the first
// alias matched in priority order wins. Pure read; never throws.
function _resolveScanApiKey() {
  return (process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY)
      || process.env.PLANTNET_API_KEY
      || process.env.SCAN_API_KEY
      || process.env.OPENAI_API_KEY
      || null;
}

// ── PlantNet adapter ───────────────────────────────────────────
//   docs: https://my.plantnet.org/account/doc
const plantnet = Object.freeze({
  name: 'plantnet',
  buildRequest({ image, mime, cropName }) {
    const project = process.env.PLANTNET_PROJECT || 'all';
    // Prefer the dedicated PLANTNET_API_KEY when present, fall
    // back to SCAN_API_KEY for back-compat with the old wiring.
    const apiKey  = process.env.PLANTNET_API_KEY || process.env.SCAN_API_KEY;
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

// ── Plant.id adapter ───────────────────────────────────────────
// Audit gap §6.1 closed — the real Plant.id v3 adapter reads
// (process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY) DIRECTLY (no SCAN_PROVIDER_URL +
// SCAN_API_KEY indirection trap). Lives in ./providers/ so the
// adapter is self-contained and unit-testable.
import { plantid } from './providers/plantIdProvider.js';

// ── Registry + selector ────────────────────────────────────────
const REGISTRY = Object.freeze({
  // Plant.id is FIRST in the registry so auto-pick prefers it when
  // PLANT_ID_API_KEY is set (carries the disease module).
  plantid,
  plantnet, plantix, cropsense, generic,
});

/**
 * pickProvider() — returns the adapter matching the current env
 * configuration. Returns null when no scan key is set at all
 * (caller falls back to the rule-based classifier).
 *
 * Resolution order (Production-Dependency-Fix §4):
 *   1. SCAN_PROVIDER_PROFILE env wins when explicitly set.
 *   2. Otherwise auto-pick from the alias actually present:
 *        PLANT_ID_API_KEY  → 'generic' (Plant.id treated as
 *                            generic Authorization-Bearer JSON
 *                            until a dedicated adapter lands;
 *                            request shape is compatible).
 *        PLANTNET_API_KEY  → 'plantnet'
 *        SCAN_API_KEY      → 'generic' (legacy default)
 *        OPENAI_API_KEY    → 'generic' (vision fallback path
 *                            via the same Bearer envelope)
 *   3. Fall through to 'generic' on any unrecognised profile.
 */
export function pickProvider() {
  if (!_resolveScanApiKey()) return null;
  const explicit = String(process.env.SCAN_PROVIDER_PROFILE || '')
    .toLowerCase().trim();
  if (explicit && REGISTRY[explicit]) return REGISTRY[explicit];
  // Auto-pick from the most-specific alias that's set. Plant.id wins
  // over PlantNet because the v3 adapter carries the disease module
  // (audit gap §6.1 closed — previously this returned `generic` for
  // PLANT_ID_API_KEY, which then needed SCAN_PROVIDER_URL + SCAN_API_KEY
  // to fire, producing the silent fall-through-to-rule bug).
  if ((process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY))  return REGISTRY.plantid;
  if (process.env.PLANTNET_API_KEY)  return REGISTRY.plantnet;
  return REGISTRY.generic;
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
    apiKeySet: !!_resolveScanApiKey(),
  };
}

export const _internal = Object.freeze({
  REGISTRY, _normalizeSymptom, _normalizeConfidence,
});

export default pickProvider;
