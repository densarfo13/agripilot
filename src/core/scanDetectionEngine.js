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
export async function analyzeScan(input = {}) {
  // Defensive — accept null/undefined input.
  const safeInput = input && typeof input === 'object' ? input : {};
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
        return Object.freeze({
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
        });
      }
    }
  } catch { /* fall through to safe fallback */ }
  return getRuleBasedFallback(safeInput);
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
