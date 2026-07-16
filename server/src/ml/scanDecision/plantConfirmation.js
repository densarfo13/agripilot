/**
 * plantConfirmation.js — provisional plant-confirmation logic (P0–P6).
 *
 * Pure, testable helpers for the provisional → confirm → health flow. The DB
 * reads/writes live in the route (app.js); everything decision-shaped lives here
 * so it is unit-testable without a database.
 *
 *   - normalizeCandidates()      provider candidates → the confirmation contract shape (+ stable taxonId)
 *   - buildProvisionalContract() the P0 response block for identificationState === PROVISIONAL
 *   - findConfirmableCandidate() validate a client taxonId against the STORED candidates (reject arbitrary)
 *   - deriveScanHealth()         scan-time disease/health signals → gated health state (revealed on confirm)
 *   - recommendationLevel()      P6 safe recommendation level from confirmation + condition evidence
 *
 * Never fabricates a candidate, a disease, or a taxon. No PII, no image bytes.
 */

// A stable, deterministic taxon id derived from the scientific name (providers
// don't always return one). Lets the confirm endpoint match a client choice
// against the stored list without trusting a client-supplied name.
export function taxonIdFor(scientificName, commonName) {
  const base = String(scientificName || commonName || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return base ? 'taxon:' + base : '';
}

function _num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function _pct01(v) { const n = _num(v); if (n == null) return null; return n > 1 && n <= 100 ? n / 100 : n; }

/**
 * Map provider candidates (consensus/topCandidates shape) to the confirmation
 * contract: { taxonId, commonName, scientificName, providerConfidence }.
 * Keeps up to `max` (default 3). Drops entries with no usable name.
 */
export function normalizeCandidates(rawCandidates, max = 3) {
  const arr = Array.isArray(rawCandidates) ? rawCandidates : [];
  const out = [];
  for (const c of arr) {
    if (!c || typeof c !== 'object') continue;
    const scientificName = String(c.scientificName || '').trim();
    const commonName = String(c.commonName || c.name || '').trim();
    if (!scientificName && !commonName) continue;
    const taxonId = taxonIdFor(scientificName, commonName);
    if (!taxonId) continue;
    const providerConfidence = _pct01(c.providerConfidence != null ? c.providerConfidence : c.score);
    out.push(Object.freeze({
      taxonId,
      commonName: commonName || scientificName,
      scientificName,
      providerConfidence: providerConfidence == null ? null : Math.round(providerConfidence * 100) / 100,
    }));
    if (out.length >= max) break;
  }
  return Object.freeze(out);
}

export const PROVISIONAL_ACTIONS = Object.freeze([
  'CONFIRM_TOP_CANDIDATE', 'SELECT_ALTERNATE', 'SCAN_AGAIN', 'REQUEST_EXPERT_REVIEW',
]);

/**
 * The P0 response block for an identification that needs FARMER confirmation.
 * Covers PROVISIONAL and — Scan Intelligence upgrade — LOW_IDENTIFICATION_
 * CONFIDENCE: a valid photo whose top candidate sits below the provisional
 * threshold still carries the provider's REAL ranked candidates, so the farmer
 * (who is looking at the plant) can resolve what the model could not. This
 * surfaces existing provider output — it does NOT change thresholds, scores,
 * or ranking. Returns null for any other state. Never invents candidates —
 * an empty list yields null.
 */
export function buildProvisionalContract(identificationState, rawCandidates) {
  if (identificationState !== 'PROVISIONAL'
    && identificationState !== 'LOW_IDENTIFICATION_CONFIDENCE') return null;
  const candidates = normalizeCandidates(rawCandidates, 3);
  if (!candidates.length) return null;
  return Object.freeze({
    requiresConfirmation: true,
    candidates,
    allowedActions: PROVISIONAL_ACTIONS,
  });
}

/**
 * Validate a client-supplied candidateTaxonId against the STORED provider
 * candidates. Returns the matched candidate (frozen) or null. This is the guard
 * that makes "reject candidates not present in the original result" true.
 */
export function findConfirmableCandidate(storedCandidates, candidateTaxonId) {
  const id = String(candidateTaxonId || '').trim();
  if (!id) return null;
  const arr = Array.isArray(storedCandidates) ? storedCandidates : [];
  const match = arr.find((c) => c && String(c.taxonId) === id);
  return match ? Object.freeze({ ...match }) : null;
}

// Evidence floors. A disease suggestion below this is not treated as an "issue".
const HEALTH_EVIDENCE_FLOOR = 0.35;
// Treatment-grade condition confidence (P6 LEVEL 3). Env-tunable, safe default.
export function treatmentThreshold() {
  const raw = process.env.SCAN_TREATMENT_CONFIDENCE_THRESHOLD;
  const n = Number(raw);
  return (Number.isFinite(n) && n > 0 && n <= 1) ? n : 0.70;
}

function _category(name) {
  const s = String(name || '').toLowerCase();
  if (/aphid|mite|whitefly|thrip|worm|beetle|caterpillar|pest|insect|mealybug/.test(s)) return 'pest';
  if (/nitrogen|phosphor|potassium|deficien|nutrient|chloros/.test(s)) return 'nutrient_stress';
  if (/drought|water\s*stress|wilt|dehydr/.test(s)) return 'water_stress';
  if (/scorch|sunburn|hail|wind|physical|mechanical|breakage/.test(s)) return 'physical_damage';
  if (/spot|lesion|blight|rust|mildew|mosaic|rot|virus|bacteri|fungal|disease/.test(s)) return 'disease';
  return 'unknown_stress';
}

/**
 * Derive the GATED scan-time health state from what the scan already computed.
 * Revealed only after confirmation. `providerError` maps to PROVIDER_ERROR —
 * NEVER to HEALTH_UNCERTAIN (P4).
 *
 * @returns {{ state:'HEALTHY'|'ISSUE_POSSIBLE'|'HEALTH_UNCERTAIN'|'PROVIDER_ERROR', conditions:Array }}
 */
export function deriveScanHealth({ diseaseCandidates, healthStatus, providerError } = {}) {
  if (providerError) return Object.freeze({ state: 'PROVIDER_ERROR', conditions: Object.freeze([]) });
  const cands = Array.isArray(diseaseCandidates) ? diseaseCandidates : [];
  const scored = cands
    .map((d) => ({ name: String(d && (d.name) || '').trim(), score: _pct01(d && d.score) }))
    .filter((d) => d.name && d.score != null)
    .sort((a, b) => b.score - a.score);
  const top = scored[0] || null;

  if (top && top.score >= HEALTH_EVIDENCE_FLOOR) {
    const conditions = scored.slice(0, 3).map((d) => Object.freeze({
      name: d.name,
      category: _category(d.name),
      confidence: Math.round(d.score * 100) / 100,
      provider: 'plantid',
      treatmentGrade: d.score >= treatmentThreshold(),
    }));
    return Object.freeze({ state: 'ISSUE_POSSIBLE', conditions: Object.freeze(conditions) });
  }
  const hs = String(healthStatus || '').toLowerCase();
  if (hs === 'healthy') return Object.freeze({ state: 'HEALTHY', conditions: Object.freeze([]) });
  return Object.freeze({ state: 'HEALTH_UNCERTAIN', conditions: Object.freeze([]) });
}

/**
 * P6 safe recommendation level.
 *   1 — observation only (health uncertain / provider error)
 *   2 — low-risk guidance (confirmed plant, condition not treatment-grade)
 *   3 — treatment allowed (confirmed plant AND a treatment-grade condition)
 */
export function recommendationLevel({ confirmed, healthState, conditions } = {}) {
  if (!confirmed) return 1;
  if (healthState === 'PROVIDER_ERROR' || healthState === 'HEALTH_UNCERTAIN') return 1;
  const arr = Array.isArray(conditions) ? conditions : [];
  const treatmentGrade = arr.some((c) => c && c.treatmentGrade === true);
  if (healthState === 'ISSUE_POSSIBLE' && treatmentGrade) return 3;
  return 2;
}

export default {
  taxonIdFor, normalizeCandidates, buildProvisionalContract,
  findConfirmableCandidate, deriveScanHealth, recommendationLevel, treatmentThreshold,
  PROVISIONAL_ACTIONS,
};
