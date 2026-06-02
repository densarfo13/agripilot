/**
 * insectProvider.js — Kindwise insect identification adapter.
 *
 * Scan Intelligence V2 §1 — closes audit gap "INSECT_ID_API_KEY
 * NEVER USED".
 *
 *   import { detectInsect, insectKeyPresent, insectProviderInfo }
 *     from './insectProvider.js';
 *
 *   const res = await detectInsect({ image, mime, cropName });
 *
 * Reads process.env.INSECT_ID_API_KEY DIRECTLY. POSTs to
 * https://insect.kindwise.com/api/v1/identification with the same
 * Api-Key header convention used by Plant.id v3.
 *
 * Response normalised into a single envelope the consensus engine
 * + the scan recovery envelope can consume:
 *   {
 *     pest:              string,                      // canonical name
 *     pestCategory:      'aphid'|'thrip'|'whitefly'|'armyworm'
 *                      | 'beetle'|'mite'|'leaf_miner'|'unknown',
 *     scientificName:    string,
 *     confidence:        number,                      // 0..1
 *     confidencePct:     number,                      // 0..100
 *     severity:          'low'|'medium'|'high',
 *     recommendedAction: string,
 *     candidates:        Array<{ name, scientificName, score }>,
 *     limitations:       'Decision support, not a guarantee.',
 *   }
 *
 * Strict rules
 *   - No PII forwarded.
 *   - Never throws.
 *   - Returns { ok: false } envelope when key missing OR API
 *     unreachable. Caller treats as "no insect info available".
 *   - 6000 ms AbortController timeout.
 */

const INSECT_ENDPOINT = 'https://insect.kindwise.com/api/v1/identification';
const REQUEST_TIMEOUT_MS = 6000;

// Canonical pest category mapping. Names come from Kindwise + the
// sprint spec (aphids / thrips / whiteflies / armyworms / beetles /
// mites / leaf miners). Regex matches BOTH common + scientific
// keywords so we catch most synonyms (e.g. "aphididae", "spider mite",
// "agromyzidae"). Caller never lies — when the match is uncertain,
// pestCategory is 'unknown'.
// V3 spec — split spider_mites + caterpillar into their own
// categories so the result page can render distinct treatment
// guidance. Order matters: more-specific patterns FIRST so
// spider_mite matches before the generic mite pattern, and
// caterpillar matches before the armyworm pattern.
const PEST_CATEGORY_PATTERNS = Object.freeze([
  { key: 'aphid',        pattern: /aphid|aphididae|greenfly|blackfly/i },
  { key: 'thrip',        pattern: /thrip|thysanoptera|frankliniella/i },
  { key: 'whitefly',     pattern: /whitefly|aleyrodidae|bemisia|trialeurodes/i },
  { key: 'spider_mite',  pattern: /spider\s*mite|tetranychus/i },
  { key: 'caterpillar',  pattern: /caterpillar|larva(e)?|lepidoptera|hornworm|loopers?\b/i },
  { key: 'armyworm',     pattern: /armyworm|spodoptera|cutworm/i },
  { key: 'beetle',       pattern: /beetle|coleoptera|weevil|curculio|leptinotarsa|chrysomelidae/i },
  { key: 'mite',         pattern: /\bmite\b|acari/i },
  { key: 'leaf_miner',   pattern: /leaf\s*miner|liriomyza|agromyzidae/i },
]);

// V3 — lifecycle stage hints per pest category. Drives the
// `lifecycle` field on the response envelope. Honest "unknown"
// when no signal in the provider response (we never fabricate
// a stage from a still photo).
function _lifecycleFor(pestCategory, scientificName) {
  const sci = String(scientificName || '').toLowerCase();
  // Larva-bearing pests — armyworm + caterpillar + leaf_miner.
  if (pestCategory === 'caterpillar' || pestCategory === 'armyworm'
      || pestCategory === 'leaf_miner') {
    if (/larva|caterpillar|instar/.test(sci)) return 'larva';
    if (/pupa/.test(sci))                    return 'pupa';
    if (/moth|adult/.test(sci))               return 'adult';
    return 'larva_or_adult';
  }
  // Mites + aphids + whiteflies + thrips are all incomplete-
  // metamorphosis sap-feeders; nymph and adult look similar.
  if (pestCategory === 'spider_mite' || pestCategory === 'mite'
      || pestCategory === 'aphid' || pestCategory === 'thrip'
      || pestCategory === 'whitefly') {
    return 'nymph_or_adult';
  }
  if (pestCategory === 'beetle') {
    if (/larva|grub/.test(sci)) return 'larva';
    return 'adult';
  }
  return 'unknown';
}

// V3 — separate organic vs chemical treatments. Generic
// non-chemical-first organic recommendations + chemical CLASS
// hints only (never product names). Caller may append "consider
// escalating" via severity gate.
function _organicTreatmentFor(pestCategory) {
  switch (pestCategory) {
    case 'aphid':       return 'Spray a soap-and-water solution; release ladybugs / lacewings; prune heavily infested shoots.';
    case 'thrip':       return 'Yellow sticky traps; introduce predatory mites (Amblyseius cucumeris); kaolin clay barrier.';
    case 'whitefly':    return 'Yellow sticky traps; reflective mulch; release Encarsia formosa parasitoids.';
    case 'spider_mite': return 'Mist plants daily; introduce predatory mites (Phytoseiulus persimilis); neem oil weekly.';
    case 'caterpillar': return 'Hand-pick at dusk; Bacillus thuringiensis (Bt) spray on leaves; row covers on seedlings.';
    case 'armyworm':    return 'Bt spray; pheromone traps for adult moths; encourage parasitoid wasps.';
    case 'beetle':      return 'Hand-pick into soapy water; check undersides for eggs; trap crops nearby.';
    case 'mite':        return 'Mist canopy; introduce predatory mites; neem oil rotation.';
    case 'leaf_miner':  return 'Remove and destroy affected leaves; fine mesh row covers; sticky traps for adults.';
    default:            return 'Photograph the pest from closer and re-scan to confirm.';
  }
}

function _chemicalTreatmentFor(pestCategory) {
  // CLASS hints only — never product names. Caller decides whether
  // to escalate; gardener UI strips this branch entirely.
  switch (pestCategory) {
    case 'aphid':       return 'Insecticidal soap or systemic neonicotinoid (consult local extension before use).';
    case 'thrip':       return 'Spinosad or pyrethrin contact spray; rotate IRAC groups to avoid resistance.';
    case 'whitefly':    return 'Insecticidal soap or pyrethroid; systemic if infestation is widespread.';
    case 'spider_mite': return 'Acaricide rotation (consult IRAC table); never use neonicotinoids alone — kills predators.';
    case 'caterpillar': return 'Bt is the first-line "chemical"; spinosad as escalation; rotate IRAC groups.';
    case 'armyworm':    return 'Bt subspecies kurstaki; spinosad as escalation.';
    case 'beetle':      return 'Carbaryl or pyrethroid as escalation; consider trap crops first.';
    case 'mite':        return 'Acaricide rotation; consult IRAC table.';
    case 'leaf_miner':  return 'Systemic neonicotinoid for severe infestations (consult local extension).';
    default:            return '';
  }
}

function _imageToBase64(image) {
  if (typeof image === 'string') {
    return image.startsWith('data:')
      ? image.split(',').slice(1).join(',')
      : image;
  }
  if (image && typeof Buffer !== 'undefined' && Buffer.isBuffer(image)) {
    return image.toString('base64');
  }
  return '';
}

function _classifyPest(name, scientificName) {
  const combined = String((name || '') + ' ' + (scientificName || ''));
  for (const entry of PEST_CATEGORY_PATTERNS) {
    if (entry.pattern.test(combined)) return entry.key;
  }
  return 'unknown';
}

function _severityFromScore(score) {
  // Map probability → severity. 0.75+ → 'high' (confident pest
  // present → urgent action). 0.45+ → 'medium'. Else 'low'.
  const n = Number(score);
  if (!Number.isFinite(n)) return 'low';
  if (n >= 0.75) return 'high';
  if (n >= 0.45) return 'medium';
  return 'low';
}

function _recommendedActionFor(pestCategory, severity) {
  // Cautious non-chemical-first wording. Chemical class hints
  // appear ONLY when severity is 'high' so the floor copy stays
  // safe for the gardener experience.
  const base = (() => {
    switch (pestCategory) {
      case 'aphid':      return 'Check leaf undersides; spray plants with water or soap solution to dislodge.';
      case 'thrip':      return 'Inspect new growth; introduce predatory mites or sticky traps.';
      case 'whitefly':   return 'Shake affected leaves to confirm; use yellow sticky traps near the plant.';
      case 'armyworm':   return 'Inspect at dusk; hand-pick larvae and use Bt spray as a non-chemical first option.';
      case 'beetle':     return 'Hand-pick adults into soapy water; check undersides for eggs.';
      case 'mite':       return 'Mist plants and check for fine webbing; introduce predatory mites if confirmed.';
      case 'leaf_miner': return 'Remove and destroy affected leaves; cover plants with fine mesh.';
      default:           return 'Photograph the pest from closer and re-scan to confirm.';
    }
  })();
  if (severity === 'high') {
    return base + ' Consider escalating if damage spreads.';
  }
  return base;
}

export function insectKeyPresent() {
  try { return !!(process.env.INSECT_ID_API_KEY
                  && String(process.env.INSECT_ID_API_KEY).trim()); }
  catch { return false; }
}

/**
 * Detect insect from an image. Returns a normalized envelope.
 * Returns `{ ok: false, reason }` when the key is missing or the
 * remote call fails — never throws.
 */
export async function detectInsect({ image, mime: _mime, cropName }) {
  if (!insectKeyPresent()) {
    return Object.freeze({
      ok: false, reason: 'INSECT_ID_API_KEY not configured',
      pest: '', pestCategory: 'unknown', scientificName: '',
      confidence: 0, confidencePct: 0,
      severity: 'low', recommendedAction: '',
      candidates: Object.freeze([]),
      limitations: 'Decision support, not a guarantee.',
    });
  }

  const b64 = _imageToBase64(image);
  if (!b64) {
    return Object.freeze({
      ok: false, reason: 'empty_image',
      pest: '', pestCategory: 'unknown', scientificName: '',
      confidence: 0, confidencePct: 0,
      severity: 'low', recommendedAction: '',
      candidates: Object.freeze([]),
      limitations: 'Decision support, not a guarantee.',
    });
  }

  const body = JSON.stringify({
    images: [b64],
    similar_images: true,
    classification_level: 'all',
    ...(cropName ? { crop: String(cropName) } : {}),
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(INSECT_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        // Read DIRECTLY — no aliasing.
        'Api-Key':      process.env.INSECT_ID_API_KEY || '',
      },
      body,
      signal:  ctrl.signal,
    });
    clearTimeout(timer);

    if (!res || !res.ok) {
      return Object.freeze({
        ok: false, reason: 'http_' + (res ? res.status : 'no_response'),
        pest: '', pestCategory: 'unknown', scientificName: '',
        confidence: 0, confidencePct: 0,
        severity: 'low', recommendedAction: '',
        candidates: Object.freeze([]),
        latencyMs: Date.now() - startedAt,
        limitations: 'Decision support, not a guarantee.',
      });
    }

    const json = await res.json();
    const result = json && json.result || {};
    const classification = result.classification || {};
    const suggestions = Array.isArray(classification.suggestions)
      ? classification.suggestions : [];
    const top = suggestions[0] || null;

    if (!top) {
      return Object.freeze({
        ok: true,
        pest: '', pestCategory: 'unknown', scientificName: '',
        confidence: 0, confidencePct: 0,
        severity: 'low',
        recommendedAction: _recommendedActionFor('unknown', 'low'),
        candidates: Object.freeze([]),
        latencyMs: Date.now() - startedAt,
        limitations: 'Decision support, not a guarantee.',
      });
    }

    const details = top.details || {};
    const commonNamesArr = Array.isArray(details.common_names)
      ? details.common_names : [];
    const pestName = String(commonNamesArr[0] || top.name || '');
    const scientificName = String(top.name || '');
    const score = Number(top.probability) || 0;
    const pestCategory = _classifyPest(pestName, scientificName);
    const severity = _severityFromScore(score);

    const candidates = suggestions.slice(0, 5).map((s) => {
      const d = s && s.details || {};
      const cn = Array.isArray(d.common_names) ? d.common_names : [];
      return Object.freeze({
        name:           String(cn[0] || s.name || ''),
        scientificName: String(s.name || ''),
        score:          Number(s.probability) || 0,
        source:         'insect_kindwise',
      });
    });

    return Object.freeze({
      ok: true,
      pest:              pestName,
      pestCategory,
      scientificName,
      confidence:        score,
      confidencePct:     Math.round(score * 100),
      severity,
      recommendedAction: _recommendedActionFor(pestCategory, severity),
      // V3 spec additions — lifecycle + per-treatment-class fields.
      lifecycle:         _lifecycleFor(pestCategory, scientificName),
      treatment:         _recommendedActionFor(pestCategory, severity),
      organicTreatment:  _organicTreatmentFor(pestCategory),
      chemicalTreatment: _chemicalTreatmentFor(pestCategory),
      candidates:        Object.freeze(candidates),
      latencyMs:         Date.now() - startedAt,
      limitations:       'Decision support, not a guarantee.',
    });
  } catch (err) {
    return Object.freeze({
      ok: false, reason: 'exception',
      message: err && err.message,
      pest: '', pestCategory: 'unknown', scientificName: '',
      confidence: 0, confidencePct: 0,
      severity: 'low', recommendedAction: '',
      candidates: Object.freeze([]),
      latencyMs: Date.now() - startedAt,
      limitations: 'Decision support, not a guarantee.',
    });
  } finally {
    clearTimeout(timer);
  }
}

export function insectProviderInfo() {
  return Object.freeze({
    name:           'insect_kindwise',
    endpoint:       INSECT_ENDPOINT,
    envVar:         'INSECT_ID_API_KEY',
    keyPresent:     insectKeyPresent(),
    detectedPestCategories: Object.freeze([
      'aphid', 'thrip', 'whitefly', 'armyworm',
      'beetle', 'mite', 'leaf_miner',
    ]),
    timeoutMs:      REQUEST_TIMEOUT_MS,
  });
}

export const _internal = Object.freeze({
  INSECT_ENDPOINT, PEST_CATEGORY_PATTERNS,
  _classifyPest, _severityFromScore, _recommendedActionFor,
});

export default detectInsect;
