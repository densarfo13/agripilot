/**
 * scanRecoveryEnvelope.js — produces the spec-shaped recovery
 * envelope ScanResultPage / IntelligentScanResult consume.
 *
 * Audit gap §6.3 closed: server emits four parallel verdicts today
 * (verdict, verdictV2, verdictV3, decision); only the legacy
 * `verdict` reached the UI because IntelligentScanResult was gated.
 *
 * This module produces ONE canonical envelope:
 *
 *   {
 *     plantName:          string,
 *     scientificName:     string,
 *     confidence:         number,        // 0..100 percent
 *     confidenceBand:     'low'|'medium'|'high',
 *     diseaseCandidates:  Array<{ name, score, description, source }>,
 *     severity:           'low'|'medium'|'high'|null,
 *     recommendations:    string[],
 *     nextAction:         string,
 *     candidates:         Array<{ commonName, scientificName, score, source }>,
 *     consensusMode:      'multi'|'single'|'rule',
 *     sources:            Array<{ source, ok, latencyMs, error }>,
 *   }
 *
 * Pure. Never throws.
 */

function _str(v) { return typeof v === 'string' ? v : ''; }
function _num(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }
function _arr(v) { return Array.isArray(v) ? v : []; }
function _safe(fn, fb) { try { return fn(); } catch { return fb; } }

function _severityFromSafeVerdict(safe) {
  const urgency = String(safe && (safe.urgency || safe.hybridUrgency) || '')
    .toLowerCase();
  if (urgency === 'high')   return 'high';
  if (urgency === 'medium') return 'medium';
  if (urgency === 'low')    return 'low';
  return null;
}

function _nextActionFromTasks(safe, fused, consensus) {
  // Prefer the explicit followUpTask attached server-side; fall back
  // to the first recommended action; final fallback is a generic
  // re-check string. NEVER returns empty.
  const followUp = (safe && safe.followUpTask) || (fused && fused.followUpTask) || null;
  if (followUp && followUp.title) return _str(followUp.title);
  const actions = _arr(safe && safe.recommendedActions);
  if (actions.length > 0 && typeof actions[0] === 'string') return actions[0];
  if (consensus && consensus.symptom === 'healthy') {
    return 'Re-scan in 7 days to monitor plant health.';
  }
  return 'Check this plant again tomorrow.';
}

/**
 * Build the spec envelope from the consensus result + the safe verdict
 * + the fused context. Each input may be partial — every field has a
 * fall-back so the envelope is always renderable.
 *
 * @param {object} args
 * @param {object} args.consensus    Output from runConsensus()
 * @param {object} args.safe         Output from applySafetyFilter()
 * @param {object} args.fused        Output from fuseContext()
 * @param {string} [args.cropNameHint]
 * @returns {object} frozen envelope
 */
export function buildScanRecoveryEnvelope({ consensus, safe, fused, cropNameHint } = {}) {
  return _safe(() => {
    const c = consensus && typeof consensus === 'object' ? consensus : {};
    const s = safe && typeof safe === 'object' ? safe : {};
    const f = fused && typeof fused === 'object' ? fused : {};

    // Plant identification — consensus is the source of truth.
    const ident = c.identification || null;
    const plantName = _str(ident && ident.commonName)
      || _str(ident && ident.scientificName)
      || _str(cropNameHint)
      || '';
    const scientificName = _str(ident && ident.scientificName);

    // Confidence: prefer consensus percent (which is the weighted
    // multi-source value); fall back to the safe verdict's confidence
    // string.
    let confidence = _num(c.confidencePct);
    if (confidence == null) {
      const band = String(s.confidence || c.confidence || 'low').toLowerCase();
      confidence = band === 'high' ? 85 : band === 'medium' ? 55 : 25;
    }
    confidence = Math.max(0, Math.min(100, Math.round(confidence)));
    const confidenceBand = confidence >= 75 ? 'high'
      : confidence >= 45 ? 'medium' : 'low';

    // Disease candidates — Plant.id's disease module output.
    let diseaseCandidates = [];
    if (c.disease && Array.isArray(c.disease.candidates)) {
      diseaseCandidates = c.disease.candidates.slice(0, 5).map((d) => Object.freeze({
        name:        _str(d.name),
        score:       _num(d.score) || 0,
        description: _str(d.description),
        source:      _str(d.source) || 'plantid',
      }));
    } else if (s.possibleIssue) {
      // Legacy/rule path — produce a single synthetic candidate so the
      // UI always has something to render.
      diseaseCandidates = [Object.freeze({
        name:        _str(s.possibleIssue),
        score:       confidence / 100,
        description: _str(s.explanation || ''),
        source:      'rule',
      })];
    }

    const severity = _severityFromSafeVerdict(s);

    // Recommendations — prefer the safety-filtered list.
    const recommendations = _arr(s.recommendedActions).map(_str).filter(Boolean);

    const nextAction = _nextActionFromTasks(s, f, c);

    // Species candidates — already merged + deduped + sorted by
    // scanConsensusEngine. Strip raw fields, freeze.
    const candidates = _arr(c.candidates).slice(0, 5).map((cand) => Object.freeze({
      commonName:     _str(cand.commonName),
      scientificName: _str(cand.scientificName),
      score:          _num(cand.score) || 0,
      source:         _str(cand.source) || 'unknown',
    }));

    const sources = _arr(c.sources).map((src) => Object.freeze({
      source:    _str(src.source),
      ok:        !!src.ok,
      latencyMs: _num(src.latencyMs) || 0,
      error:     src.error == null ? null : _str(src.error),
    }));

    // Scan Intelligence V2 §1 + §2 — surface insect detection +
    // satellite field health when present. Optional caller args;
    // never overrides species data. Both envelopes already carry
    // their own `limitations: 'Decision support, not a guarantee.'`.
    const pestInfo = arguments[0] && arguments[0].pest && arguments[0].pest.ok
      ? Object.freeze({
          pest:              _str(arguments[0].pest.pest),
          pestCategory:      _str(arguments[0].pest.pestCategory) || 'unknown',
          scientificName:    _str(arguments[0].pest.scientificName),
          confidence:        _num(arguments[0].pest.confidence) || 0,
          confidencePct:     _num(arguments[0].pest.confidencePct) || 0,
          severity:          _str(arguments[0].pest.severity) || 'low',
          recommendedAction: _str(arguments[0].pest.recommendedAction),
        })
      : null;
    const fieldHealth = arguments[0] && arguments[0].fieldHealth
                        && arguments[0].fieldHealth.ok
      ? Object.freeze({
          ndvi:            _num(arguments[0].fieldHealth.ndvi),
          cropVigor:       _str(arguments[0].fieldHealth.cropVigor) || null,
          stressScore:     _num(arguments[0].fieldHealth.stressScore),
          vegetationTrend: _str(arguments[0].fieldHealth.vegetationTrend) || null,
          interpretation:  _str(arguments[0].fieldHealth.interpretation),
          confidence:      _str(arguments[0].fieldHealth.confidence) || 'low',
        })
      : null;
    // Final 3-point gap closure — server-side soil context. Surfaces
    // only when the soilProvider returned ok:true (real SoilGrids
    // reading or cached value). Honest null when unavailable.
    const soil = arguments[0] && arguments[0].soil && arguments[0].soil.ok
      ? Object.freeze({
          soilTexture: arguments[0].soil.soilTexture
            ? Object.freeze({
                clayPct: _num(arguments[0].soil.soilTexture.clayPct),
                sandPct: _num(arguments[0].soil.soilTexture.sandPct),
                siltPct: _num(arguments[0].soil.soilTexture.siltPct),
                label:   _str(arguments[0].soil.soilTexture.label) || 'unknown',
              })
            : Object.freeze({ clayPct: null, sandPct: null, siltPct: null, label: 'unknown' }),
          ph:                 _num(arguments[0].soil.ph),
          organicMatterProxy: _num(arguments[0].soil.organicMatterProxy),
          drainageRisk:       _str(arguments[0].soil.drainageRisk) || 'unknown',
          confidence:         _str(arguments[0].soil.confidence) || 'low',
          interpretation:     _str(arguments[0].soil.interpretation),
        })
      : null;

    return Object.freeze({
      runtimeVersion:    'scan-recovery-envelope-v3',
      plantName,
      scientificName,
      confidence,
      confidenceBand,
      diseaseCandidates: Object.freeze(diseaseCandidates),
      severity,
      recommendations:   Object.freeze(recommendations),
      nextAction,
      candidates:        Object.freeze(candidates),
      consensusMode:     _str(c.consensusMode) || 'rule',
      sources:           Object.freeze(sources),
      // V2 additions — insect + field health.
      pest:              pestInfo,
      fieldHealth,
      // Final closure — soil context (V3 envelope bump).
      soil,
      // Honesty trailer — every envelope carries the limitation
      // sentence the API health contract requires.
      limitations:       'Decision support, not a guarantee.',
    });
  }, Object.freeze({
    runtimeVersion: 'scan-recovery-envelope-v1',
    plantName: '', scientificName: '',
    confidence: 0, confidenceBand: 'low',
    diseaseCandidates: Object.freeze([]),
    severity: null,
    recommendations: Object.freeze([]),
    nextAction: 'Check this plant again tomorrow.',
    candidates: Object.freeze([]),
    consensusMode: 'rule',
    sources: Object.freeze([]),
    limitations: 'Decision support, not a guarantee.',
  }));
}

export default buildScanRecoveryEnvelope;
