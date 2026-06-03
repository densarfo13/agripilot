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

    // V3 additions — growth stage / regional intelligence / market.
    const growthStage = arguments[0] && arguments[0].growthStage
      ? Object.freeze({
          stage:             _str(arguments[0].growthStage.stage) || 'unknown',
          confidence:        _str(arguments[0].growthStage.confidence) || 'low',
          nextMilestone:     arguments[0].growthStage.nextMilestone
                              ? Object.freeze({
                                  stage:    _str(arguments[0].growthStage.nextMilestone.stage),
                                  daysAway: _num(arguments[0].growthStage.nextMilestone.daysAway),
                                  hint:     _str(arguments[0].growthStage.nextMilestone.hint),
                                })
                              : null,
          daysSincePlanting: _num(arguments[0].growthStage.daysSincePlanting),
        })
      : null;
    const regional = arguments[0] && arguments[0].regional && arguments[0].regional.ok
      ? Object.freeze({
          country:         _str(arguments[0].regional.country) || null,
          region:          _str(arguments[0].regional.region) || null,
          diseasePressure: _str(arguments[0].regional.diseasePressure) || 'unknown',
          pestPressure:    _str(arguments[0].regional.pestPressure) || 'unknown',
          rainfallTrend:   arguments[0].regional.rainfallTrend || null,
          plantingWindow:  arguments[0].regional.plantingWindow || null,
          harvestWindow:   arguments[0].regional.harvestWindow || null,
          sampleSize:      _num(arguments[0].regional.sampleSize) || 0,
          confidence:      _str(arguments[0].regional.confidence) || 'low',
        })
      : null;
    const market = arguments[0] && arguments[0].market && arguments[0].market.ok
      ? Object.freeze({
          crop:                  _str(arguments[0].market.crop) || null,
          currentPrice:          _num(arguments[0].market.currentPrice),
          currency:              _str(arguments[0].market.currency) || 'USD',
          unit:                  _str(arguments[0].market.unit) || 'per_kg',
          priceSource:           _str(arguments[0].market.priceSource) || 'none',
          referenceOnly:         !!arguments[0].market.referenceOnly,
          priceTrend:            _str(arguments[0].market.priceTrend) || 'unknown',
          nearbyBuyers:          Object.freeze(_arr(arguments[0].market.nearbyBuyers)
                                  .map((b) => Object.freeze(b))),
          recommendedSellWindow: arguments[0].market.recommendedSellWindow || null,
          demandScore:           _num(arguments[0].market.demandScore),
          confidence:            _str(arguments[0].market.confidence) || 'low',
        })
      : null;

    // ═══════════════════════════════════════════════════════
    // PERMANENT DETECTION FIX (envelope v5) — never dead-end.
    // ═══════════════════════════════════════════════════════
    //
    // Spec §2 + §4: when consensus confidence < 80 AND we have at
    // least one candidate, plantName flips to "Needs confirmation"
    // (NOT "Unknown Plant") so the UI shows the candidates panel
    // instead of a dead-end empty state.
    //
    // Spec §4: never show "Unknown Plant" if topCandidates.length > 0.
    //
    // Spec §4 confidence rules:
    //   >= 80  likely match
    //   60-79  needs confirmation
    //   <  60  review recommended
    //
    const hasCandidates = candidates.length > 0;
    const _topCandidates = hasCandidates ? candidates : [];
    let _resolvedPlantName = plantName;
    let _confidenceLabel;
    if (confidence >= 80) {
      _confidenceLabel = 'Likely match';
    } else if (confidence >= 60) {
      _confidenceLabel = 'Needs confirmation';
      // Plant name stays as the top species, but UI surfaces the
      // confirmation prompt because confidenceLabel is the source
      // of truth for the headline.
    } else {
      _confidenceLabel = 'Review recommended';
      // Below 60% confidence: never claim a single plant. Show
      // candidates instead. plantName becomes the spec-mandated
      // "Needs confirmation" placeholder ONLY when no plant name
      // is present at all (so we never write "Needs confirmation"
      // over a real species when candidates exist).
      if (!plantName && hasCandidates) {
        _resolvedPlantName = 'Needs confirmation';
      }
    }
    // Hard floor — never emit empty plantName when candidates exist.
    // This is the gate-enforced "no Plant: —" invariant.
    if (!_resolvedPlantName && hasCandidates) {
      _resolvedPlantName = 'Needs confirmation';
    }

    // Spec §5 "what we noticed" — single farmer-grade sentence
    // derived from the strongest signal available (disease > pest >
    // field-health > satellite > soil). Never claims certainty.
    let _whatWeNoticed = '';
    if (diseaseCandidates.length > 0) {
      const top = diseaseCandidates[0];
      _whatWeNoticed = 'Possible ' + (top.name || 'issue')
        + (top.score ? ' (' + Math.round(top.score * 100) + '% match)' : '')
        + '.';
    } else if (pestInfo && pestInfo.pest) {
      _whatWeNoticed = 'Possible pest activity: ' + pestInfo.pest
        + (pestInfo.severity ? ' (' + pestInfo.severity + ' severity)' : '')
        + '.';
    } else if (fieldHealth && fieldHealth.stressLevel
               && fieldHealth.stressLevel !== 'low') {
      _whatWeNoticed = 'Satellite shows '
        + fieldHealth.stressLevel + ' field stress.';
    } else if (soil && soil.soilRisk && soil.soilRisk.kind !== 'none') {
      _whatWeNoticed = soil.soilRisk.detail || 'Soil condition flagged.';
    } else {
      _whatWeNoticed = 'No clear issue from this photo.';
    }

    // Spec §5 "why it matters" — actionable framing.
    let _whyItMatters = '';
    if (severity === 'high') {
      _whyItMatters = 'Acting in the next 24-48 hours protects yield.';
    } else if (severity === 'medium') {
      _whyItMatters = 'Catching this early is much easier than later.';
    } else if (diseaseCandidates.length > 0 || (pestInfo && pestInfo.pest)) {
      _whyItMatters = 'A second look in a few days will confirm direction.';
    } else if (confidence < 60) {
      _whyItMatters = 'A clearer photo or a second opinion will sharpen this.';
    } else {
      _whyItMatters = 'Routine monitoring keeps small problems small.';
    }

    // Spec §6 image quality — pass-through from caller when present.
    // The route can attach quality scores after preprocessing.
    const _imageQuality = arguments[0] && arguments[0].imageQuality
      ? Object.freeze({
          blur:         _num(arguments[0].imageQuality.blur),
          focus:        _num(arguments[0].imageQuality.focus),
          brightness:   _num(arguments[0].imageQuality.brightness),
          shadow:       _num(arguments[0].imageQuality.shadow),
          leafCoverage: _num(arguments[0].imageQuality.leafCoverage),
          distance:     _str(arguments[0].imageQuality.distance) || 'unknown',
          overall:      _str(arguments[0].imageQuality.overall) || 'good',
          retakeGuidance: _str(arguments[0].imageQuality.retakeGuidance) || null,
        })
      : Object.freeze({
          blur: null, focus: null, brightness: null, shadow: null,
          leafCoverage: null, distance: 'unknown',
          overall: 'unknown',
          retakeGuidance: null,
        });

    // Spec §2 sourceResults — provider attribution (which providers
    // contributed and their independent verdicts). Derived from the
    // consensus.sources field + raw provider parsed outputs when
    // present.
    const _sourceResults = Object.freeze(_arr(c.sources).map((src) =>
      Object.freeze({
        source:    _str(src.source),
        ok:        !!src.ok,
        latencyMs: _num(src.latencyMs) || 0,
        error:     src.error == null ? null : _str(src.error),
      })));

    // Spec §5 healthStatus — three-band derived from severity +
    // signal presence. NEVER says "Confirmed" or "Guaranteed".
    let _healthStatus = 'healthy';
    if (diseaseCandidates.length > 0
        || (pestInfo && pestInfo.pest)
        || severity === 'high' || severity === 'medium') {
      _healthStatus = 'attention_needed';
    } else if (confidence < 60 && !hasCandidates) {
      _healthStatus = 'unclear';
    }

    // Spec §8 followUpDate top-level alias (existing followUpPlan
    // is the structured form). Derived from severity → 3/7/14 days.
    const _fuDays = severity === 'high' ? 3
                  : severity === 'medium' ? 7 : 14;
    const _followUpDate = (() => {
      const d = new Date(Date.now() + _fuDays * 24 * 3600 * 1000);
      return d.toISOString().slice(0, 10);
    })();

    return Object.freeze({
      runtimeVersion:    'scan-recovery-envelope-v5',
      // ── Required output contract (spec §2) ──────────────
      plantName:         _resolvedPlantName,
      scientificName,
      confidence,
      confidenceLabel:   _confidenceLabel,
      topCandidates:     Object.freeze(_topCandidates),
      healthStatus:      _healthStatus,
      issueCandidates:   Object.freeze(diseaseCandidates),
      severity,
      whatWeNoticed:     _whatWeNoticed,
      whyItMatters:      _whyItMatters,
      nextAction,
      followUpDate:      _followUpDate,
      limitations:       'Decision support, not a guarantee.',
      imageQuality:      _imageQuality,
      sourceResults:     _sourceResults,
      // ── Legacy fields preserved (back-compat) ───────────
      confidenceBand,
      diseaseCandidates: Object.freeze(diseaseCandidates),
      recommendations:   Object.freeze(recommendations),
      candidates:        Object.freeze(candidates),
      consensusMode:     _str(c.consensusMode) || 'rule',
      sources:           Object.freeze(sources),
      pest:              pestInfo,
      fieldHealth,
      soil,
      growthStage,
      regional,
      market,
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
