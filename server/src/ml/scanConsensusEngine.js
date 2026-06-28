/**
 * scanConsensusEngine.js — combine Plant.id + PlantNet results.
 *
 * Audit gap §7 closed: "Missing — multi-source consensus".
 *
 *   import { runConsensus } from './scanConsensusEngine.js';
 *   const verdict = await runConsensus({
 *     image, mime, cropName, country, region, plantNameHint,
 *   });
 *
 * Behaviour:
 *   - Fires Plant.id (if PLANT_ID_API_KEY present) AND PlantNet
 *     (if PLANTNET_API_KEY present) IN PARALLEL.
 *   - Picks the highest-confidence species identification.
 *   - Computes a weighted-average confidence (Plant.id weighted
 *     higher because it carries the disease module).
 *   - Returns top-5 merged candidates with per-source attribution.
 *   - When ONLY one provider is available, returns that provider's
 *     verdict with `consensusMode: 'single'`.
 *   - When neither is available, returns `consensusMode: 'rule'`
 *     and the caller falls back to the rule-based classifier.
 *
 * Pure. Never throws. No PII. Each provider call has its own
 * 6000ms timeout via AbortController.
 */

import { plantid, plantIdKeyPresent } from './providers/plantIdProvider.js';

const CONSENSUS_TIMEOUT_MS = 6000;

// Weights when both providers return. Plant.id earns more weight
// because (a) it carries the disease module and (b) its training
// distribution covers more crop diseases than PlantNet's species-
// only model.
const WEIGHT_PLANTID  = 0.6;
const WEIGHT_PLANTNET = 0.4;

function _safeNum(v, fb) {
  return Number.isFinite(Number(v)) ? Number(v) : fb;
}

function _confToScore(conf) {
  if (typeof conf === 'number') return Math.max(0, Math.min(1, conf));
  const s = String(conf || '').toLowerCase();
  if (s === 'high')   return 0.85;
  if (s === 'medium') return 0.55;
  return 0.25;
}

function _scoreToBand(n) {
  if (n >= 0.75) return 'high';
  if (n >= 0.45) return 'medium';
  return 'low';
}

async function _callProvider(adapter, input) {
  if (!adapter || typeof adapter.buildRequest !== 'function'
      || typeof adapter.parseResponse !== 'function') {
    return { ok: false, error: 'adapter_missing', source: adapter && adapter.name };
  }
  let req;
  try { req = adapter.buildRequest(input); }
  catch (err) {
    return { ok: false, error: 'build_failed',
      message: err && err.message, source: adapter.name };
  }
  if (!req || !req.url) {
    return { ok: false, error: 'url_missing', source: adapter.name };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONSENSUS_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(req.url, {
      method:  'POST',
      headers: req.headers || {},
      body:    req.body,
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    if (!res || !res.ok) {
      return { ok: false, error: 'http_' + (res ? res.status : 'no_response'),
        source: adapter.name, latencyMs: Date.now() - startedAt };
    }
    const data = await res.json();
    const parsed = adapter.parseResponse(data) || {};
    return {
      ok: true,
      source: adapter.name,
      latencyMs: Date.now() - startedAt,
      parsed,
    };
  } catch (err) {
    return { ok: false, error: 'exception',
      message: err && err.message, source: adapter.name,
      latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

// Adapt PlantNet's species result into the candidate shape.
function _plantnetCandidates(parsed) {
  if (!parsed || !parsed.raw) return [];
  const results = Array.isArray(parsed.raw.results) ? parsed.raw.results : [];
  return results.slice(0, 5).map((r) => {
    const species = r && r.species || {};
    const commonNames = Array.isArray(species.commonNames) ? species.commonNames : [];
    return Object.freeze({
      commonName:     String(commonNames[0] || species.scientificNameWithoutAuthor || ''),
      scientificName: String(species.scientificNameWithoutAuthor || ''),
      score:          _safeNum(r && r.score, 0),
      source:         'plantnet',
    });
  });
}

// Merge two candidate lists, prefer higher score on duplicate matches,
// cap at 5 with per-source attribution preserved.
function _mergeCandidates(a, b) {
  const seen = new Map();
  const _key = (c) => String((c.scientificName || c.commonName || '')).toLowerCase().trim();
  for (const c of [...a, ...b]) {
    const k = _key(c);
    if (!k) continue;
    const existing = seen.get(k);
    if (!existing || c.score > existing.score) seen.set(k, c);
  }
  return Object.freeze(
    Array.from(seen.values())
      .sort((x, y) => y.score - x.score)
      .slice(0, 5)
      .map((c) => Object.freeze(c))
  );
}

function _pickTopIdentification(plantIdParsed, plantNetParsed) {
  const pidScore = plantIdParsed && plantIdParsed.identification
    ? _safeNum(plantIdParsed.identification.score, 0) : 0;
  const pntScore = plantNetParsed && plantNetParsed.raw
    && Array.isArray(plantNetParsed.raw.results)
    && plantNetParsed.raw.results[0]
    ? _safeNum(plantNetParsed.raw.results[0].score, 0) : 0;
  if (pidScore === 0 && pntScore === 0) return null;
  if (pidScore >= pntScore) {
    return plantIdParsed && plantIdParsed.identification
      ? plantIdParsed.identification : null;
  }
  const r0 = plantNetParsed.raw.results[0];
  const species = r0 && r0.species || {};
  const commonNames = Array.isArray(species.commonNames) ? species.commonNames : [];
  return Object.freeze({
    commonName:     String(commonNames[0] || species.scientificNameWithoutAuthor || ''),
    scientificName: String(species.scientificNameWithoutAuthor || ''),
    score:          pntScore,
  });
}

/**
 * Main entry. Fires both providers and computes consensus.
 *
 * @param {object} input
 * @param {Buffer|string} input.image          base64 string or Buffer
 * @param {string}        input.mime
 * @param {string}        [input.cropName]
 * @param {string}        [input.country]
 * @param {string}        [input.region]
 * @returns {Promise<{
 *   ok: boolean,
 *   consensusMode: 'multi'|'single'|'rule',
 *   sources: Array<{ source, ok, latencyMs, error? }>,
 *   identification: { commonName, scientificName, score } | null,
 *   confidence: 'low'|'medium'|'high',
 *   confidencePct: number,                   // 0..100
 *   weightedScore: number,                   // 0..1
 *   symptom: string,
 *   disease: { name, score, candidates } | null,
 *   candidates: Array<{ commonName, scientificName, score, source }>,
 *   raw: { plantid: any, plantnet: any },
 * }>}
 */
export async function runConsensus(input = {}) {
  const havePlantId  = plantIdKeyPresent();
  const havePlantNet = !!(process.env.PLANTNET_API_KEY
                       && String(process.env.PLANTNET_API_KEY).trim());

  if (!havePlantId && !havePlantNet) {
    return Object.freeze({
      ok: false,
      consensusMode: 'rule',
      sources: Object.freeze([]),
      identification: null,
      confidence: 'low',
      confidencePct: 0,
      weightedScore: 0,
      symptom: 'unclear',
      disease: null,
      candidates: Object.freeze([]),
      raw: Object.freeze({ plantid: null, plantnet: null }),
    });
  }

  // Lazy-import PlantNet adapter to avoid a circular import with
  // scanProviders.js. PlantNet adapter lives there today.
  let plantnetAdapter = null;
  try {
    const mod = await import('./scanProviders.js');
    plantnetAdapter = (mod && mod._internal && mod._internal.REGISTRY
                       && mod._internal.REGISTRY.plantnet) || null;
  } catch { plantnetAdapter = null; }

  // Fire both in parallel. Each is timeout-bounded by _callProvider.
  const [pid, pnt] = await Promise.all([
    havePlantId  ? _callProvider(plantid, input)         : Promise.resolve({ ok: false, error: 'no_key', source: 'plantid' }),
    havePlantNet ? _callProvider(plantnetAdapter, input) : Promise.resolve({ ok: false, error: 'no_key', source: 'plantnet' }),
  ]);

  const sources = Object.freeze([
    Object.freeze({ source: 'plantid',  ok: !!pid.ok,
      latencyMs: pid.latencyMs || 0,
      error: pid.ok ? null : (pid.error || 'unknown') }),
    Object.freeze({ source: 'plantnet', ok: !!pnt.ok,
      latencyMs: pnt.latencyMs || 0,
      error: pnt.ok ? null : (pnt.error || 'unknown') }),
  ]);

  const pidParsed = (pid.ok && pid.parsed) ? pid.parsed : null;
  const pntParsed = (pnt.ok && pnt.parsed) ? pnt.parsed : null;

  if (!pidParsed && !pntParsed) {
    return Object.freeze({
      ok: false,
      // Neither provider produced a usable parse → rule-based fallback. Use the SAME
      // derivation as the success path (single source of truth). The old key-based ternary
      // wrongly reported 'multi'/'single' here, contradicting both this module's documented
      // contract and the success path — a caller would think two providers corroborated a
      // result when in fact both failed and there is no identification at all.
      consensusMode: _consensusMode(pidParsed, pntParsed),
      sources,
      identification: null,
      confidence: 'low',
      confidencePct: 0,
      weightedScore: 0,
      symptom: 'unclear',
      disease: null,
      candidates: Object.freeze([]),
      raw: Object.freeze({ plantid: pid && pid.parsed && pid.parsed.raw || null,
                           plantnet: pnt && pnt.parsed && pnt.parsed.raw || null }),
    });
  }

  // Determine consensus mode (same helper the failure branch uses).
  const consensusMode = _consensusMode(pidParsed, pntParsed);

  // Pick top identification (highest single-provider score wins
  // for the "which species" question — averaging names doesn't
  // make sense).
  const identification = _pickTopIdentification(pidParsed, pntParsed);

  // Weighted confidence — both providers contribute when present.
  let weightedScore = 0;
  if (pidParsed && pntParsed) {
    const a = _confToScore(pidParsed.confidence);
    const b = _confToScore(pntParsed.confidence);
    weightedScore = (a * WEIGHT_PLANTID) + (b * WEIGHT_PLANTNET);
  } else if (pidParsed) {
    weightedScore = _confToScore(pidParsed.confidence);
  } else if (pntParsed) {
    weightedScore = _confToScore(pntParsed.confidence);
  }
  weightedScore = Math.max(0, Math.min(1, weightedScore));

  const confidence = _scoreToBand(weightedScore);
  const confidencePct = Math.round(weightedScore * 100);

  // Symptom signal: Plant.id wins because it carries the disease
  // module. PlantNet's symptom is always 'healthy' or 'unclear'.
  const symptom = (pidParsed && pidParsed.symptom)
    || (pntParsed && pntParsed.symptom)
    || 'unclear';

  // Disease — Plant.id only (PlantNet doesn't classify disease).
  const disease = pidParsed && pidParsed.disease ? pidParsed.disease : null;

  // Merge candidate lists with per-source attribution.
  const pidCandidates = (pidParsed && Array.isArray(pidParsed.candidates))
    ? pidParsed.candidates : [];
  const pntCandidates = _plantnetCandidates(pntParsed);
  const candidates = _mergeCandidates(pidCandidates, pntCandidates);

  return Object.freeze({
    ok: true,
    consensusMode,
    sources,
    identification,
    confidence,
    confidencePct,
    weightedScore,
    symptom,
    disease,
    candidates,
    raw: Object.freeze({
      plantid:  pidParsed ? pidParsed.raw  : null,
      plantnet: pntParsed ? pntParsed.raw : null,
    }),
  });
}

/** Public diagnostic — boolean flags + provider readiness. */
export function consensusEngineInfo() {
  return Object.freeze({
    name:           'scan-consensus-engine',
    plantIdReady:   plantIdKeyPresent(),
    plantNetReady:  !!(process.env.PLANTNET_API_KEY
                    && String(process.env.PLANTNET_API_KEY).trim()),
    weights:        Object.freeze({ plantid: WEIGHT_PLANTID,
                                    plantnet: WEIGHT_PLANTNET }),
    timeoutMs:      CONSENSUS_TIMEOUT_MS,
    candidatesMax:  5,
  });
}

/**
 * Single source of truth for consensusMode, derived from which providers actually
 * PARSED a result (not from which API keys are configured):
 *   both parsed → 'multi' · one parsed → 'single' · neither parsed → 'rule'.
 * Used by both the success path and the both-failed early return.
 */
function _consensusMode(pidParsed, pntParsed) {
  if (pidParsed && pntParsed) return 'multi';
  if (pidParsed || pntParsed) return 'single';
  return 'rule';
}

export const _internal = Object.freeze({
  _confToScore, _scoreToBand, _mergeCandidates, _pickTopIdentification, _consensusMode,
  WEIGHT_PLANTID, WEIGHT_PLANTNET, CONSENSUS_TIMEOUT_MS,
});

export default runConsensus;
