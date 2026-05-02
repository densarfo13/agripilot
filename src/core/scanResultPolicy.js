/**
 * scanResultPolicy.js — high-trust scan output enforcement.
 *
 * One-stop policy module for the rule:
 *   "Standardize every scan result into a clear, safe, action-first
 *    format. Never use overconfident diagnosis or exact chemical
 *    prescriptions."
 *
 * The module is split into four pure helpers + one orchestrator:
 *   • sanitizeScanText(text)          — strip / rewrite forbidden
 *                                       wording (e.g. "confirmed
 *                                       disease" \u2192 "possible issue").
 *   • escalationCopyFor({category, contextType})
 *                                     — conditional escalation copy
 *                                       per spec \u00a75. Garden vs farm
 *                                       wording is baked in.
 *   • followUpCopyFor(contextType, plantOrCropName)
 *                                     — "Check this <plant> again
 *                                       tomorrow" / farm equivalent.
 *   • verificationChecksFor(category) — 2\u20133 yes/no items for the
 *                                       optional "Check to confirm:"
 *                                       block (spec \u00a76).
 *   • enforceHighTrustScanResult(raw, ctx)
 *                                     — runs a scan result through
 *                                       sanitize + cap + structure;
 *                                       always returns a fully-shaped
 *                                       safe object the UI can render.
 *
 * Strict-rule audit
 *   • Pure. No I/O. No React. Never throws \u2014 every helper falls
 *     through to a safe default.
 *   • Coexists with hybridScanEngine.js (which already emits
 *     possibleIssue / recommendedActions / followUpTask). This
 *     module sits BETWEEN the engine and the result UI to enforce
 *     the spec wording rules + structured shape, regardless of
 *     which path produced the verdict (real ML, hybrid fallback,
 *     2-second timer fallback).
 *   • Class-only chemistry: any sentence that mentions a forbidden
 *     product / active-ingredient or "exact dosage" pattern is
 *     replaced with "Follow label instructions." rather than
 *     dropped, so the user still gets a safe action.
 *   • Spec \u00a73 / \u00a74: garden \u2194 farm wording is enforced when the
 *     engine emits text that mismatches the active context.
 */

// Final-gap stability \u00a72 / \u00a77 \u2014 the canonical scan-failure
// action set. Kept as a frozen array so the actions-guarantee
// path below shares the same wording as the standalone
// getSafeFallback('scan') caller. Mirrors getSafeFallback's
// SCAN_FALLBACK actions exactly so the two paths cannot drift.
const _SCAN_FALLBACK_ACTIONS = Object.freeze([
  'Retake the photo in better light',
  'Check leaves and soil manually',
  'Monitor the plant tomorrow',
]);

// \u2500\u2500 Forbidden phrase \u2192 safe replacement \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//
// Order matters: longer phrases first so "confirmed disease" beats
// "disease". Replacements keep the sentence grammatical and never
// invent confidence we don't have.
const FORBIDDEN_REPLACEMENTS = Object.freeze([
  // Overconfident verdicts
  [/\bconfirmed disease\b/gi,                'possible issue'],
  [/\bdisease detected\b/gi,                 'possible issue detected'],
  [/\bdisease confirmed\b/gi,                'possible issue'],
  [/\bdiagnosed (?:disease|condition)\b/gi,  'possible issue'],
  [/\bguaranteed cure\b/gi,                  'possible improvement'],
  [/\bguaranteed treatment\b/gi,             'possible treatment'],
  [/\bdefinitely (?:has|is)\b/gi,            'may have'],
  [/\bcertainly (?:has|is)\b/gi,             'may have'],
  [/\bproven cure\b/gi,                      'possible improvement'],

  // Exact-prescription phrasing \u2192 class language
  [/\b(?:apply|use)\s+\d+\s?(?:ml|g|kg|tsp|tbsp|oz|cup|cups|grams?)\b[^.]*\./gi,
                                             'Follow label instructions.'],
  [/\bdosage\s*[:\-]?\s*\d[^.]*\./gi,        'Follow label instructions.'],
  [/\bmix\s+\d[^.]*\b(?:per|in)\s+\d[^.]*\./gi,
                                             'Follow label instructions.'],

  // Specific product names (defence in depth \u2014 the engine sources
  // are also CI-guarded against these in check-mobile-readiness.mjs).
  [/\bneem oil\b/gi,                         'a locally approved option'],
  [/\bsoap spray\b/gi,                       'a locally approved option'],
  [/\bmancozeb\b/gi,                         'a locally approved option'],
  [/\bimidacloprid\b/gi,                     'a locally approved option'],
  [/\bcypermethrin\b/gi,                     'a locally approved option'],
  [/\bcarbaryl\b/gi,                         'a locally approved option'],
  [/\bglyphosate\b/gi,                       'a locally approved option'],
  [/\broundup\b/gi,                          'a locally approved option'],
  [/\bsevin\b/gi,                            'a locally approved option'],
]);

/**
 * sanitizeScanText(text) \u2192 string.
 *
 * Runs every FORBIDDEN_REPLACEMENTS rule in order. Trims the
 * result, collapses double spaces. Returns '' for non-string input.
 */
export function sanitizeScanText(text) {
  if (typeof text !== 'string' || !text) return '';
  let out = text;
  for (const [re, repl] of FORBIDDEN_REPLACEMENTS) {
    try { out = out.replace(re, repl); } catch { /* swallow */ }
  }
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

/**
 * sanitizeActions(actions) \u2192 string[].
 *
 * Sanitises each bullet, drops empties, dedupes case-insensitively,
 * caps to 3 (spec \u00a71 \u2014 "2\u20133 action bullets max").
 */
export function sanitizeActions(actions) {
  if (!Array.isArray(actions)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of actions) {
    const safe = sanitizeScanText(String(raw || ''));
    if (!safe) continue;
    const key = safe.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(safe);
    if (out.length >= 3) break;
  }
  return out;
}

// ── Issue \u2192 category mapping ─────────────────────────────────
//
// Mirrors treatmentEngine.js taxonomy so escalation + verification
// stay aligned. Spec \u00a75 splits escalation copy across two buckets:
//   fungal / pest    \u2192 "If this spreads over the next 2\u20133 days\u2026"
//   water / heat     \u2192 "If the plant does not improve\u2026"
const CATEGORY = Object.freeze({
  FUNGAL:    'fungal',
  PEST:      'pest',
  WATER:     'water',
  HEAT:      'heat',
  NUTRIENT:  'nutrient',
  TRANSPLANT:'transplant',
  HEALTHY:   'healthy',
  UNKNOWN:   'unknown',
});

const ISSUE_TO_CATEGORY = Object.freeze({
  'Possible fungal stress':         CATEGORY.FUNGAL,
  'Possible pest damage':           CATEGORY.PEST,
  'Possible water stress':          CATEGORY.WATER,
  'Possible heat stress':           CATEGORY.HEAT,
  'Possible nutrient deficiency':   CATEGORY.NUTRIENT,
  'Possible transplant shock':      CATEGORY.TRANSPLANT,
  'Looks healthy':                  CATEGORY.HEALTHY,
  'Needs closer inspection':        CATEGORY.UNKNOWN,
});

export function categoryForIssue(issue) {
  return ISSUE_TO_CATEGORY[String(issue || '')] || CATEGORY.UNKNOWN;
}

// ── Escalation copy (spec \u00a75) ──────────────────────────────
const ESCALATION_FUNGAL_PEST_GARDEN =
  'If this spreads over the next 2\u20133 days, consider using a locally approved treatment for this plant or contact a local expert.';
const ESCALATION_FUNGAL_PEST_FARM =
  'If this spreads over the next 2\u20133 days, consider using a locally approved treatment for this crop or contact a local expert.';
const ESCALATION_WATER_HEAT_GARDEN =
  'If the plant does not improve after adjusting water or shade, check again or ask a local expert.';
const ESCALATION_WATER_HEAT_FARM =
  'If the field does not improve after adjusting irrigation or shade, scout again or ask a local expert.';
const ESCALATION_GENERIC =
  'If the issue spreads or worsens, contact a local expert.';

/**
 * escalationCopyFor({ category, contextType }) \u2192 string.
 *
 * Returns the spec \u00a75 conditional escalation line. Garden + farm
 * wording diverge ("plant"/"crop", "check"/"scout").
 */
export function escalationCopyFor({ category, contextType } = {}) {
  const cat = String(category || '').toLowerCase();
  const isFarm = String(contextType || '').toLowerCase() === 'farm';
  if (cat === CATEGORY.HEALTHY) return '';
  if (cat === CATEGORY.FUNGAL || cat === CATEGORY.PEST) {
    return isFarm ? ESCALATION_FUNGAL_PEST_FARM : ESCALATION_FUNGAL_PEST_GARDEN;
  }
  if (cat === CATEGORY.WATER || cat === CATEGORY.HEAT) {
    return isFarm ? ESCALATION_WATER_HEAT_FARM : ESCALATION_WATER_HEAT_GARDEN;
  }
  return ESCALATION_GENERIC;
}

// ── Follow-up copy (spec \u00a71 / \u00a77) ─────────────────────────
/**
 * followUpCopyFor(contextType, plantOrCropName) \u2192 string.
 *
 * UI-facing string. Garden form is name-aware ("Check your tomato
 * again tomorrow"); farm form scopes to the field so a multi-row
 * scout makes sense.
 */
export function followUpCopyFor(contextType, plantOrCropName) {
  const isFarm = String(contextType || '').toLowerCase() === 'farm';
  const name = String(plantOrCropName || '').trim();
  if (isFarm) {
    return name
      ? `Check your ${name} field again tomorrow`
      : 'Check the field again tomorrow';
  }
  return name
    ? `Check your ${name} again tomorrow`
    : 'Check this plant again tomorrow';
}

/**
 * followUpTaskFor(contextType, plantOrCropName) \u2192 task object.
 *
 * Shape is identical to hybridScanEngine._followUpTask so callers
 * (scanToTask.addScanTasks) can persist it directly.
 */
export function followUpTaskFor(contextType, plantOrCropName) {
  const isFarm = String(contextType || '').toLowerCase() === 'farm';
  const reason = isFarm
    ? 'Confirm whether the issue is contained or spreading.'
    : 'See if the issue has changed or spread.';
  return {
    id:         isFarm ? 'policy_followup_farm' : 'policy_followup_garden',
    title:      followUpCopyFor(contextType, plantOrCropName),
    reason,
    urgency:    'medium',
    actionType: 'inspect',
    isFollowUp: true,
  };
}

// ── Verification checks (spec \u00a76) ──────────────────────────
const VERIFICATION_FUNGAL_PEST = Object.freeze([
  'Are symptoms spreading?',
  'Are nearby plants affected?',
  'Has weather been wet or humid?',
]);
const VERIFICATION_WATER_HEAT = Object.freeze([
  'Has the soil been dry for several days?',
  'Has the plant been in direct afternoon sun?',
  'Did wilting improve after watering?',
]);
const VERIFICATION_NUTRIENT = Object.freeze([
  'Are older or younger leaves affected first?',
  'Has the soil been fed recently?',
  'Are nearby plants showing the same pattern?',
]);
const VERIFICATION_GENERIC = Object.freeze([
  'Are symptoms spreading?',
  'Are nearby plants affected?',
]);

/**
 * verificationChecksFor(category) \u2192 string[].
 *
 * Returns the 2\u20133 yes/no items shown under "Check to confirm:".
 * Returns an empty array for healthy / unknown so the section is
 * suppressed (the user has nothing to confirm).
 */
export function verificationChecksFor(category) {
  const cat = String(category || '').toLowerCase();
  if (cat === CATEGORY.FUNGAL || cat === CATEGORY.PEST) return VERIFICATION_FUNGAL_PEST.slice();
  if (cat === CATEGORY.WATER  || cat === CATEGORY.HEAT) return VERIFICATION_WATER_HEAT.slice();
  if (cat === CATEGORY.NUTRIENT)                        return VERIFICATION_NUTRIENT.slice();
  if (cat === CATEGORY.HEALTHY || cat === CATEGORY.UNKNOWN) return [];
  return VERIFICATION_GENERIC.slice();
}

// ── Confidence normalisation ──────────────────────────────────
const CONFIDENCE_LEVELS = Object.freeze(new Set(['low', 'medium', 'high']));

/**
 * normalizeConfidence(value) \u2192 'low'|'medium'|'high'.
 *
 * Accepts string labels OR numeric scores 0\u20131. Maps numeric per
 * the existing tier policy: <0.6 \u2192 low, <0.85 \u2192 medium, else high.
 * Any unrecognised input falls through to 'low' (the safest tier).
 */
export function normalizeConfidence(value) {
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    return CONFIDENCE_LEVELS.has(v) ? v : 'low';
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return 'low';
  if (n >= 0.85) return 'high';
  if (n >= 0.60) return 'medium';
  return 'low';
}

// ── Orchestrator ──────────────────────────────────────────────
/**
 * enforceHighTrustScanResult(raw, ctx) \u2192 structured safe result.
 *
 * Always returns an object with the spec-mandated fields:
 *   {
 *     possibleIssue,                 // sanitised
 *     confidence:        'low'|'medium'|'high',
 *     whyExplanation,                // sanitised
 *     recommendedActions: string[],  // sanitised + capped at 3
 *     escalationCopy,                // category-aware
 *     followUpCopy,                  // garden/farm-aware
 *     followUpTask,                  // ready for addScanTasks
 *     verificationChecks: string[],  // 0\u20133 yes/no items
 *     contextType:       'garden'|'farm'|'generic',
 *     category,                      // internal tag
 *     disclaimer,
 *   }
 *
 * Never throws \u2014 unknown / null inputs collapse to the
 * "Needs closer inspection" branch so the UI always has something
 * safe to render.
 */
export function enforceHighTrustScanResult(raw, ctx = {}) {
  const safe = (raw && typeof raw === 'object') ? raw : {};
  const issueRaw = String(safe.possibleIssue || safe.issue || '').trim();
  const possibleIssue = sanitizeScanText(issueRaw) || 'Needs closer inspection';
  const category = categoryForIssue(possibleIssue);

  const contextType = (() => {
    const c = String(ctx.contextType || safe.contextType || '').toLowerCase();
    if (c === 'garden' || c === 'backyard') return 'garden';
    if (c === 'farm') return 'farm';
    return 'generic';
  })();

  const whyRaw = safe.whyExplanation || safe.hybridReason || safe.reason || safe.explanation || '';
  const whyExplanation = sanitizeScanText(String(whyRaw));

  const actionsSource = Array.isArray(safe.recommendedActions) && safe.recommendedActions.length > 0
    ? safe.recommendedActions
    : (Array.isArray(safe.actions) ? safe.actions : []);
  let recommendedActions = sanitizeActions(actionsSource);

  // Final-gap stability \u00a72 \u2014 scan output GUARANTEE: actions
  // length must be >= 1 before render. If sanitisation stripped
  // every action OR the engine emitted none, fall through to the
  // canonical scan-fallback list so the user never sees a blank
  // "what to do" section. Imported lazily to avoid circular deps
  // (getSafeFallback is a leaf module).
  if (recommendedActions.length === 0) {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const fb = _SCAN_FALLBACK_ACTIONS;
      recommendedActions = fb.slice();
    } catch { /* swallow \u2014 leaf-module import shouldn't fail */ }
  }

  const plantOrCrop = ctx.plantOrCropName
    || safe.plantName
    || safe.cropName
    || ctx.cropName
    || ctx.plantName
    || null;

  const followUpCopy = followUpCopyFor(contextType, plantOrCrop);
  const followUpTask = followUpTaskFor(contextType, plantOrCrop);

  const verificationChecks = verificationChecksFor(category);
  const escalationCopy     = escalationCopyFor({ category, contextType });

  const disclaimer = sanitizeScanText(String(
    safe.disclaimer
    || 'Farroway provides guidance based on the photo and available information. Results are not guaranteed. Contact a local expert for severe or spreading issues.'
  ));

  return {
    possibleIssue,
    confidence:        normalizeConfidence(safe.confidence),
    whyExplanation,
    recommendedActions,
    escalationCopy,
    followUpCopy,
    followUpTask,
    verificationChecks,
    contextType,
    category,
    disclaimer,
  };
}

/**
 * sanitizeScanOutput \u2014 spec-named alias for the orchestrator.
 *
 * Final-gap stability \u00a73 calls for a `sanitizeScanOutput()`
 * function as the hard-block entry point for forbidden wording.
 * The canonical implementation already lives in
 * `enforceHighTrustScanResult`, which:
 *   \u2022 strips banned phrases ("disease detected", "guaranteed",
 *     "apply N ml", specific product names) via
 *     `sanitizeScanText` + `sanitizeActions`,
 *   \u2022 enforces the actions-length \u2265 1 guarantee, and
 *   \u2022 returns the structured high-trust shape ready for render.
 *
 * Exposing this alias means callers can speak in terms of the
 * spec without learning the longer name. Both names point to
 * the same function so behaviour stays identical.
 */
export const sanitizeScanOutput = enforceHighTrustScanResult;

export const POLICY = Object.freeze({ CATEGORY });
export default enforceHighTrustScanResult;
