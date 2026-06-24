/**
 * plantIdProvider.js — real Plant.id (Kindwise) v3 adapter.
 *
 * Audit gap §6.1 closed: previously, setting PLANT_ID_API_KEY alone
 * caused pickProvider() to return the `generic` adapter, which then
 * reads SCAN_PROVIDER_URL + SCAN_API_KEY — companion vars the env
 * schema never named. Result: every scan silently fell through to
 * the rule-based fallback no matter how many "Plant.id" keys were
 * set on Railway.
 *
 * This adapter reads (process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY) DIRECTLY and
 * POSTs to https://plant.id/api/v3/identification with:
 *   - Header: Api-Key: <key>
 *   - Body:   { images: [base64], similar_images: true,
 *               health: 'all', classification_level: 'all' }
 *
 * Response shape (v3, abridged):
 *   {
 *     id, status, model_version,
 *     result: {
 *       classification: {
 *         suggestions: [ { id, name, probability, details:{common_names,...} } ]
 *       },
 *       disease: {
 *         suggestions: [ { id, name, probability, details:{...} } ]
 *       },
 *       is_plant: { probability, binary, threshold },
 *       is_healthy: { probability, binary, threshold }
 *     }
 *   }
 *
 * Adapter contract — same as siblings in scanProviders.js:
 *   buildRequest({ image, mime, cropName, country, region })
 *     → { url, headers, body }
 *   parseResponse(rawJson)
 *     → { symptom, confidence,
 *         identification: { commonName, scientificName, score },
 *         disease:        { name, score } | null,
 *         candidates:     [ { commonName, scientificName, score } ],
 *         raw }
 *
 * Strict rules
 *   - No PII forwarded (image bytes + crop/country/region only).
 *   - Never throws. Bad responses normalize to
 *     { symptom: 'unclear', confidence: 'low' }.
 *   - Uses ONLY (process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY) — no fallback aliases
 *     at the auth layer, so an operator who set the canonical name
 *     gets the canonical behaviour.
 */

const PLANT_ID_ENDPOINT = 'https://plant.id/api/v3/identification';

// Symptom + confidence normalisers — kept in sync with the
// siblings in scanProviders.js so consensusEngine sees one shape.
function _normalizeSymptom(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return 'unclear';
  if (/spot|lesion|mildew|rust|blight|mold/.test(s))            return 'spots';
  if (/yellow|chloros|nitrogen|deficien/.test(s))               return 'yellow';
  if (/hole|chew|nibble|insect|pest|aphid|caterpillar/.test(s)) return 'holes';
  if (/wilt|droop|limp/.test(s))                                return 'wilt';
  if (/brown|burn|scorch|crisp|necros|sunburn/.test(s))         return 'discoloration';
  if (/healthy|normal|fine|ok\b/.test(s))                       return 'healthy';
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

function _imageToBase64(image) {
  if (typeof image === 'string') {
    // already base64 / data url
    return image.startsWith('data:')
      ? image.split(',').slice(1).join(',')
      : image;
  }
  if (image && typeof Buffer !== 'undefined' && Buffer.isBuffer(image)) {
    return image.toString('base64');
  }
  return '';
}

export const plantid = Object.freeze({
  name: 'plantid',

  /**
   * Build the request envelope. Returns { url, headers, body } where
   * `body` is a JSON STRING (Plant.id v3 accepts JSON bodies). The
   * scanInferenceService caller fetches with these directly.
   */
  buildRequest({ image, mime: _mime, cropName, country: _country, region: _region }) {
    const key = (process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY);
    const b64 = _imageToBase64(image);
    const body = JSON.stringify({
      // Plant.id v3 accepts `images` as an array of base64 strings.
      images: b64 ? [b64] : [],
      similar_images: true,
      // health: 'all' enables the disease module IN THE SAME CALL,
      // so we get plant identification + disease suggestions in one
      // round-trip. Closes audit gap §7.
      health: 'all',
      classification_level: 'all',
      // Hints — Plant.id uses these to bias toward the user's crop.
      // We do NOT send country/region as those would be PII when
      // combined with exact coords; cropName is non-identifying.
      ...(cropName ? { crop: String(cropName) } : {}),
    });

    return {
      url: PLANT_ID_ENDPOINT,
      headers: {
        'Content-Type': 'application/json',
        // Plant.id v3 expects Api-Key header (NOT Authorization).
        // Read DIRECTLY from PLANT_ID_API_KEY — no aliasing.
        'Api-Key': key || '',
      },
      body,
    };
  },

  /**
   * Parse the v3 response into the adapter contract. Surfaces both
   * the top plant identification and the top disease suggestion so
   * the consensus engine + disease engine can consume them.
   */
  parseResponse(json) {
    const empty = Object.freeze({
      symptom: 'unclear',
      confidence: 'low',
      identification: null,
      disease: null,
      candidates: Object.freeze([]),
      raw: json || null,
    });
    if (!json || typeof json !== 'object') return empty;
    const result = json.result || {};
    const classification = result.classification || {};
    const diseaseBlock = result.disease || {};
    const suggestions = Array.isArray(classification.suggestions)
      ? classification.suggestions : [];
    const top = suggestions[0] || null;

    // Build the top-N candidate list the consensus engine consumes.
    const candidates = suggestions.slice(0, 5).map((s) => {
      const details = s && s.details || {};
      const commonNamesArr = Array.isArray(details.common_names)
        ? details.common_names : [];
      return Object.freeze({
        commonName:     String(commonNamesArr[0] || s && s.name || ''),
        scientificName: String(s && s.name || ''),
        score:          Number(s && s.probability) || 0,
        source:         'plantid',
      });
    });

    // Top disease suggestion (when health module returned anything).
    const diseaseSuggestions = Array.isArray(diseaseBlock.suggestions)
      ? diseaseBlock.suggestions : [];
    const topDisease = diseaseSuggestions[0] || null;
    const disease = topDisease ? Object.freeze({
      name:  String(topDisease.name || ''),
      score: Number(topDisease.probability) || 0,
      // Keep up to 5 disease candidates for the result envelope.
      candidates: Object.freeze(diseaseSuggestions.slice(0, 5).map((d) => Object.freeze({
        name:        String(d.name || ''),
        score:       Number(d.probability) || 0,
        description: String((d.details && d.details.description) || ''),
        source:      'plantid',
      }))),
    }) : null;

    // The symptom signal comes from the disease module when
    // available; otherwise we fall back to the species-level
    // common-name keyword scan.
    let symptom = 'unclear';
    if (disease && disease.name) {
      symptom = _normalizeSymptom(disease.name);
    } else if (top) {
      const details = top.details || {};
      const commonName = (Array.isArray(details.common_names)
        ? details.common_names[0] : null) || top.name || '';
      symptom = _normalizeSymptom(commonName);
      // Plant.id reports is_healthy independently. When >0.7 and no
      // disease above 0.35, we trust the healthy verdict.
      const isHealthy = result.is_healthy && Number(result.is_healthy.probability);
      if (Number.isFinite(isHealthy) && isHealthy >= 0.7
          && (!topDisease || (Number(topDisease.probability) || 0) < 0.35)) {
        symptom = 'healthy';
      }
    }

    // Confidence: prefer disease probability when present (that's the
    // signal driving the symptom); otherwise plant-id probability.
    const confidence = _normalizeConfidence(
      disease && disease.score ? disease.score
        : (top && top.probability) || 0
    );

    const identification = top ? Object.freeze({
      commonName: String(
        (top.details && Array.isArray(top.details.common_names)
          && top.details.common_names[0])
        || top.name || ''
      ),
      scientificName: String(top.name || ''),
      score: Number(top.probability) || 0,
    }) : null;

    return Object.freeze({
      symptom,
      confidence,
      identification,
      disease,
      candidates: Object.freeze(candidates),
      raw: json,
    });
  },
});

/** Boolean — does the PLANT_ID_API_KEY env var have a value? Pure;
 *  never throws. Consumed by pickProvider() in scanProviders.js. */
export function plantIdKeyPresent() {
  try { return !!((process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY) && String((process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY)).trim()); }
  catch { return false; }
}

/** Public diagnostic — what does this adapter look like? Used by
 *  /api/health/scan-provider + the scan-health admin page. */
export function plantIdProviderInfo() {
  return Object.freeze({
    name:          'plantid',
    endpoint:      PLANT_ID_ENDPOINT,
    envVar:        'PLANT_ID_API_KEY',
    keyPresent:    plantIdKeyPresent(),
    diseaseModule: true,
    candidatesMax: 5,
  });
}

export const _internal = Object.freeze({
  _normalizeSymptom, _normalizeConfidence, _imageToBase64,
  PLANT_ID_ENDPOINT,
});

export default plantid;
