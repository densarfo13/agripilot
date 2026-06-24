/**
 * scanDetectionEngine.js — pure detection layer for the new
 * /scan route.
 *
 * Position
 * ────────
 * Coexists with the existing scan stack at `/scan-crop`
 * (`CameraScanPage` + `cameraDiagnosisHistory`). That stack ships
 * today and has its own follow-up task scheduling. THIS engine is
 * the spec-aligned shape that the new surface consumes:
 *
 *     analyzeScan(input) → ScanResult
 *
 * Strict-rule audit
 *   • Pure / no I/O / no React / no global state.
 *   • Never claims confirmed disease — wording uses "possible
 *     issue", "may indicate", "consider checking".
 *   • Returns the SAFE fallback whenever no API path is reachable.
 *   • Never throws.
 *
 * Public API
 * ──────────
 *   analyzeScan(input) → Promise<ScanResult>
 *   getRuleBasedFallback(input)  ← pure, sync
 *   suggestTasksForResult(result, opts) ← pure, sync, max 2
 */

/**
 * @typedef {'low' | 'medium' | 'high'} ScanConfidence
 *
 * @typedef {object} ScanInput
 * @property {string} [imageBase64]
 * @property {string} [imageUrl]
 * @property {string} [cropId]
 * @property {string} [plantName]
 * @property {string} [country]
 * @property {'farm'|'backyard'|'generic'} [experience]
 * @property {string} [language]
 *
 * @typedef {object} ScanResult
 * @property {string}          scanId
 * @property {string}          possibleIssue
 * @property {ScanConfidence}  confidence
 * @property {string}          explanation
 * @property {string[]}        recommendedActions
 * @property {string|null}     safetyWarning
 * @property {boolean}         shouldSeekHelp
 * @property {Array<{id:string, title:string, reason:string, urgency:string}>} suggestedTasks
 * @property {object}          [meta]      diagnostic info (engine version, source)
 */

const ENGINE_VERSION = 'scan-engine-1.0.0';

function _mintScanId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'scan_' + crypto.randomUUID();
    }
  } catch { /* ignore */ }
  return 'scan_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

// FARM_BRAIN_RUNTIME_V2 — pure composition runtime. Every scan result is
// returned through _withFarmBrain() (below), so there is NO bypass path:
// both the API result and the rule fallback carry result.farmBrain.
import { runFarmBrainV2 } from '../runtime/farmBrain/FarmBrainRuntimeV2';

function _withFarmBrain(result, input) {
  try {
    if (!result || typeof result !== 'object') return result;
    return Object.freeze({ ...result, farmBrain: runFarmBrainV2(result, input || {}) });
  } catch { return result; }
}

/**
 * Per-experience action sets for the fallback path. Wording is
 * deliberately conservative — every line is something a farmer
 * can act on without specialised tools.
 */
const FALLBACK_ACTIONS = Object.freeze({
  farm: Object.freeze([
    'Retake the photo in better light, close to the affected area.',
    'Check under leaves for insects or eggs.',
    'Check whether the soil is too dry or too wet.',
    'Mark the affected plants and watch if the problem spreads.',
  ]),
  backyard: Object.freeze([
    'Retake the photo in bright daylight, close to the leaf.',
    'Look under leaves and on stems for bugs or sticky residue.',
    'Touch the soil — water only if the top inch feels dry.',
    'Watch the plant for two days to see if it gets worse.',
  ]),
  generic: Object.freeze([
    'Retake the photo in better light.',
    'Check under leaves for insects.',
    'Check soil moisture.',
    'Monitor for spread over the next few days.',
  ]),
});

/**
 * The conservative, non-API answer. Returned whenever the API
 * is disabled, unreachable, or returns an unrecognisable shape.
 *
 * @param {ScanInput} input
 * @returns {ScanResult}
 */
export function getRuleBasedFallback(input = {}) {
  const experience = input.experience === 'farm' || input.experience === 'backyard'
    ? input.experience
    : 'generic';
  const isBackyard = experience === 'backyard';
  const isFarm = experience === 'farm';

  const possibleIssue = isBackyard
    ? 'Possible plant issue \u2014 needs closer inspection'
    : isFarm
      ? 'Possible crop issue \u2014 needs closer inspection'
      : 'Needs closer inspection';

  const explanation = isBackyard
    ? 'We could not confirm the issue from this photo. Take a closer look at the leaves, stems, and soil — small details often help.'
    : isFarm
      ? 'We could not confirm the issue from this photo. Inspect leaves, stems, soil moisture, and look for pests or unusual marks.'
      : 'We could not confirm the issue from this photo. Check leaves, stems, soil moisture, and signs of pests.';

  const recommendedActions = FALLBACK_ACTIONS[experience].slice();

  return Object.freeze({
    scanId:             _mintScanId(),
    possibleIssue,
    confidence:         'low',
    explanation,
    recommendedActions,
    safetyWarning:      null,
    shouldSeekHelp:     false,
    suggestedTasks:     suggestTasksForResult(
      { possibleIssue, confidence: 'low', recommendedActions },
      { experience }
    ),
    meta: Object.freeze({
      engine:  ENGINE_VERSION,
      source:  'rule_based_fallback',
      cropId:  input.cropId || null,
      plant:   input.plantName || null,
    }),
  });
}

/**
 * Given a result + experience, return up to 2 suggested follow-up
 * tasks shaped like the existing taskGenerator output (id / title /
 * reason / urgency). Spec §7 caps at 2 to keep Today's Plan
 * scannable.
 */
export function suggestTasksForResult(result, { experience = 'generic' } = {}) {
  if (!result) return [];
  const isBackyard = experience === 'backyard';
  const isHighConcern = result.confidence === 'high'
    || /spread|severe|dying|dead|wilting|burn/i.test(String(result.possibleIssue || ''));

  const tasks = [];

  // Task 1 — re-inspect tomorrow (always present).
  tasks.push({
    id:       'scan_recheck_' + Date.now().toString(36),
    title:    isBackyard
      ? 'Check this plant again tomorrow'
      : 'Check the affected crop again tomorrow',
    reason:   'A second look in good light tomorrow will tell you if it is getting worse.',
    urgency:  isHighConcern ? 'high' : 'medium',
    actionType: 'inspect',
    source:   'scan',
  });

  // Task 2 — retake photo OR contact expert (depending on severity).
  if (isHighConcern) {
    tasks.push({
      id:       'scan_seek_help_' + Date.now().toString(36),
      title:    isBackyard
        ? 'Contact a local plant expert if the damage spreads'
        : 'Contact a local agronomist or extension officer',
      reason:   'Severe or spreading damage often needs a trained eye on the actual plant.',
      urgency:  'high',
      actionType: 'support',
      source:   'scan',
    });
  } else {
    tasks.push({
      id:       'scan_retake_' + Date.now().toString(36),
      title:    isBackyard
        ? 'Take a clearer plant photo in 2 days'
        : 'Retake a clearer crop photo in 2 days',
      reason:   'A close-up in better light will help us narrow down the cause.',
      urgency:  'low',
      actionType: 'scan_crop',
      source:   'scan',
    });
  }

  return tasks.slice(0, 2);
}

/**
 * Async entry point. When `scanApiEnabled` is on, delegate to the
 * service layer; on any error or when the service refuses, return
 * the rule-based fallback so the UI never hangs.
 *
 * The caller decides whether to enable the API path — this engine
 * does NOT read feature flags itself; the service layer does.
 *
 * @param {ScanInput} input
 * @returns {Promise<ScanResult>}
 */
// Sprint #189 — pilot analytics. Fire-and-forget; lazy import so
// the analytics chunk never blocks scan analysis; failures swallow.
async function _trackScanEvent(eventType, metadata) {
  try {
    const { trackPilotEvent } = await import('../runtime/analytics/PilotAnalyticsRuntime');
    trackPilotEvent({ eventType, metadata });
  } catch { /* swallow */ }
}

// Sprint #200 — compose the Mythos trust-card decision from the
// envelope + farm context. Async (lazy import); ALWAYS returns null
// on any failure so the scan result is never affected.
async function _composeMythosDecisionSafe(envelope, input) {
  try {
    const mod = await import('../runtime/scanMythos/ScanDecisionComposer');
    if (mod && typeof mod.composeScanMythosDecision === 'function') {
      return mod.composeScanMythosDecision({
        envelope,
        activeCrop: input.activeCrop || input.cropName || input.crop || '',
        cropStage: input.cropStage || '',
        location: input.location || '',
        weatherNote: input.weatherNote || '',
        previousScans: Array.isArray(input.previousScans) ? input.previousScans : [],
        previousOutcomes: Array.isArray(input.previousOutcomes) ? input.previousOutcomes : [],
        photosUsed: Array.isArray(input.photosUsed) ? input.photosUsed : [],
      });
    }
  } catch { /* swallow — composition is decorative, never required */ }
  return null;
}

// Sprint #206 — fuse the composed decision into a two-sided evidence
// view (supporting + contradicting observations). Async (lazy import);
// ALWAYS returns null on any failure. Composition only; no provider,
// no satellite, no fabrication, never inflates confidence.
async function _fuseScanEvidenceSafe(decision, input) {
  if (!decision || typeof decision !== 'object') return null;
  try {
    const mod = await import('../runtime/scanMythos/ScanEvidenceFusionEngine');
    if (mod && typeof mod.fuseScanEvidence === 'function') {
      return mod.fuseScanEvidence({
        decision,
        photosUsed: Array.isArray(input.photosUsed) ? input.photosUsed : [],
      });
    }
  } catch { /* swallow — decorative, never required */ }
  return null;
}

export async function analyzeScan(input = {}) {
  // Defensive — accept null/undefined input.
  const safeInput = input && typeof input === 'object' ? input : {};
  _trackScanEvent('scan_started', {});
  try {
    // Lazy import the service so this module stays test-friendly.
    const mod = await import('../services/scanApiService.js');
    if (mod && typeof mod.requestScanAnalysis === 'function') {
      const apiResult = await mod.requestScanAnalysis(safeInput);
      if (apiResult && _looksValid(apiResult)) {
        const experience = safeInput.experience === 'farm' || safeInput.experience === 'backyard'
          ? safeInput.experience : 'generic';
        // Decorate with scanId + suggestedTasks if the server
        // didn't supply them (older API shapes may omit either).
        const scanId = apiResult.scanId || _mintScanId();
        const suggestedTasks = Array.isArray(apiResult.suggestedTasks) && apiResult.suggestedTasks.length
          ? apiResult.suggestedTasks
          : suggestTasksForResult(apiResult, { experience });
        // ─── SCAN ROOT-CAUSE FIX ─────────────────────────────
        // Pass through the V1+V2+V3+V4 envelope fields the server
        // now emits. Prior to this fix this Object.freeze whitelisted
        // 9 narrow fields and SILENTLY DROPPED scanRecovery /
        // plantName / scientificName / diseaseCandidates / pest /
        // soil / fieldHealth / satellite / growthStage / regional /
        // market — which is why production rendered
        // "Plant: — · Unknown Plant · Needs Review" even after the
        // Scan Recovery Sprint shipped (the rich envelope never
        // reached the UI extractors).
        //
        // Pass-through is additive: legacy callers that read the 9
        // whitelisted fields still get them exactly as before; new
        // callers (IntelligentScanResult, ScanRecoveryRuntime) now
        // find plantName / scanRecovery / diseaseCandidates etc.
        //
        // confidencePct preserves the server's NUMERIC confidence
        // (0..100) alongside the legacy banded `confidence` string
        // so IntelligentScanResult's _extractIdentification can
        // render an honest percent instead of the 25% fallback the
        // band-string maps to.
        const _numConfidence = typeof apiResult.confidence === 'number'
          && Number.isFinite(apiResult.confidence)
            ? Math.max(0, Math.min(100, Math.round(apiResult.confidence)))
            : null;

        // Sprint #189 — scan_completed vs scan_unknown_result.
        // "Unknown" = no plant name AND no candidates (the honest
        // "Scan unclear" path); anything with a name or candidates
        // is a completed detection.
        const _hasSignal = !!(apiResult.plantName
          || (Array.isArray(apiResult.topCandidates) && apiResult.topCandidates.length > 0));
        _trackScanEvent(_hasSignal ? 'scan_completed' : 'scan_unknown_result', {
          topCandidateCount: Array.isArray(apiResult.topCandidates)
            ? apiResult.topCandidates.length : 0,
          confidenceBand: _coerceConfidence(apiResult.confidence),
        });

        // Sprint #200/#206 — compose the Mythos decision, then fuse it
        // into the two-sided evidence view. Awaited (not assigned as a
        // bare Promise) so the result carries resolved objects the UI
        // can read directly. Both helpers swallow faults → null, so a
        // composition error can NEVER break the scan result.
        const _mythosDecision = await _composeMythosDecisionSafe({
          ...apiResult, confidencePct: _numConfidence,
        }, safeInput);
        const _evidenceFusion = await _fuseScanEvidenceSafe(_mythosDecision, safeInput);

        const _result = Object.freeze({
          // ── V1+V2+V3+V4 envelope pass-through ─────────────
          // Spread first so any explicit override below wins;
          // shallow copy avoids freezing the upstream object.
          ...apiResult,
          // ── Legacy 9-field contract preserved verbatim ────
          scanId,
          possibleIssue:      String(apiResult.possibleIssue || 'Possible issue'),
          confidence:         _coerceConfidence(apiResult.confidence),
          explanation:        String(apiResult.explanation || ''),
          recommendedActions: Array.isArray(apiResult.recommendedActions)
            ? apiResult.recommendedActions.map(String)
            : [],
          safetyWarning:      apiResult.safetyWarning ? String(apiResult.safetyWarning) : null,
          shouldSeekHelp:     !!apiResult.shouldSeekHelp,
          suggestedTasks,
          meta: Object.freeze({
            engine: ENGINE_VERSION,
            source: 'api',
            cropId: safeInput.cropId || null,
            plant:  safeInput.plantName || null,
          }),
          // ── New numeric companion for the percent display ─
          confidencePct: _numConfidence,
          // ── Sprint #200 — Mythos trust-card decision ──────
          // Additive composition over the envelope we just built.
          // Composition only; no provider call, no satellite, no
          // fabrication. Resolved above so the UI reads it directly.
          mythosDecision: _mythosDecision,
          // ── Sprint #206 — two-sided evidence fusion ───────
          // Supporting + contradicting observations derived from the
          // decision. Honest decision support; never inflates
          // confidence; satellite never used (Layer 2 frozen).
          evidenceFusion: _evidenceFusion,
        });
        // FARM_BRAIN_RUNTIME_V2 — every result passes through FarmBrain.
        const _final = _withFarmBrain(_result, safeInput);
        // Sprint #219 — capture the end-to-end pipeline state for
        // __scanDebug() so a "Scan unclear" can be root-caused with
        // real data (esp. whether the classifier was available).
        await _recordScanDebugSafe(_final, safeInput);
        return _final;
      }
    }
  } catch { /* fall through to safe fallback */ }
  // FARM_BRAIN_RUNTIME_V2 — the fallback path is NOT a bypass: it is
  // returned through FarmBrain too.
  return _withFarmBrain(getRuleBasedFallback(safeInput), safeInput);
}

// Sprint #219 — lazy, fault-isolated scan-debug capture. Computes the
// trust gate + photo quality the UI will use, and records the trace.
// Never throws; a capture fault can NEVER affect the scan result.
async function _recordScanDebugSafe(result, input) {
  try {
    const [tgMod, pqMod, dbgMod] = await Promise.all([
      import('../runtime/scanTrust/ScanTrustGate'),
      import('../runtime/scanQuality/PhotoQualityEngine'),
      import('../runtime/scanDebug/ScanDebugRuntime'),
    ]);
    const photoQuality = pqMod.evaluatePhotoQuality({
      imageQuality: result.imageQuality, objectType: result.objectType,
    });
    const trustGate = tgMod.evaluateScanTrust({
      confidencePct: result.confidencePct, confidence: result.confidence,
      topCandidates: result.topCandidates, plantName: result.plantName,
      issueType: result.issueType, status: result.status,
      hasPhoto: !!(result.imageUrl || result.scanId), photoQuality,
    });
    dbgMod.recordScanDebug({ env: result, photoQuality, trustGate });
  } catch { /* swallow — debug capture never affects the scan */ }
}

function _looksValid(result) {
  if (!result || typeof result !== 'object') return false;
  if (typeof result.possibleIssue !== 'string' || !result.possibleIssue.trim()) return false;
  return true;
}

function _coerceConfidence(c) {
  if (c === 'low' || c === 'medium' || c === 'high') return c;
  return 'low';
}

export const _internal = Object.freeze({ ENGINE_VERSION, FALLBACK_ACTIONS });
