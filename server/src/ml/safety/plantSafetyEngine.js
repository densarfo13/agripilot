/**
 * plantSafetyEngine.js — production-grade, reusable SERVER-SIDE plant safety service.
 *
 * Turns a confident plant identification into structured, NON-FABRICATED safety guidance
 * derived only from the curated safety reference. Hard rules:
 *   • A safety claim is produced ONLY on a CONFIDENT (≥70 / 'high'|'medium') KNOWN-reference
 *     match. Low confidence OR an unlisted plant → UNKNOWN (the safe default).
 *   • Warnings are derived ONLY from the real edibility/toxicity reference phrases — never
 *     invented.
 *   • The engine is language-NEUTRAL: business logic emits stable enums + translation KEYS,
 *     with English fallback text. Other languages are added in the i18n layer without
 *     touching this file.
 *   • Pure + total: no I/O, no network, no provider calls → zero scan-latency cost.
 *
 * @typedef {'EDIBLE'|'NOT_EDIBLE'|'TOXIC'|'PROCESS_BEFORE_EATING'|'MEDICINAL_USE_ONLY'|'ALLERGEN_RISK'|'UNKNOWN'} SafetyCategory
 * @typedef {'INFO'|'CAUTION'|'WARNING'|'DANGER'} SafetySeverity
 */
import {
  lookupSafetyReference,
  safetyReferenceCount,
  SAFETY_REFERENCE,
  SAFETY_REFERENCE_REVIEWED_ON,
  SAFETY_REFERENCE_SOURCE,
} from './plantSafetyReference.js';

export const SAFETY_CATEGORY = Object.freeze({
  EDIBLE: 'EDIBLE',
  NOT_EDIBLE: 'NOT_EDIBLE',
  TOXIC: 'TOXIC',
  PROCESS_BEFORE_EATING: 'PROCESS_BEFORE_EATING',
  MEDICINAL_USE_ONLY: 'MEDICINAL_USE_ONLY',
  ALLERGEN_RISK: 'ALLERGEN_RISK',
  UNKNOWN: 'UNKNOWN',
});
export const SAFETY_SEVERITY = Object.freeze({ INFO: 'INFO', CAUTION: 'CAUTION', WARNING: 'WARNING', DANGER: 'DANGER' });

// The exact required disclaimer — always returned, regardless of category.
export const SAFETY_DISCLAIMER =
  'Safety guidance is based only on verified plant matches. If identification confidence is low, do not consume the plant.';
export const SAFETY_DISCLAIMER_KEY = 'scan.safety.disclaimer';

const SEVERITY_ICON = Object.freeze({ INFO: '✅', CAUTION: '⚠️', WARNING: '⚠️', DANGER: '⛔' });

// English fallback labels + actions per category (translation keys derive from the enum).
const CATEGORY_LABEL = Object.freeze({
  EDIBLE: 'Edible', NOT_EDIBLE: 'Not edible', TOXIC: 'Toxic',
  PROCESS_BEFORE_EATING: 'Process before eating', MEDICINAL_USE_ONLY: 'Medicinal use only',
  ALLERGEN_RISK: 'Allergen risk', UNKNOWN: 'Not confirmed',
});
const CATEGORY_ACTION = Object.freeze({
  EDIBLE: 'Safe to eat when prepared the normal way.',
  NOT_EDIBLE: 'Do not eat this plant.',
  TOXIC: 'Do not eat. Keep it away from children and animals.',
  PROCESS_BEFORE_EATING: 'Do not eat it raw. Soak and cook it thoroughly first.',
  MEDICINAL_USE_ONLY: 'Not a food — traditional medicinal use only. Ask a health worker first.',
  ALLERGEN_RISK: 'A common allergen. Avoid if you react to it, and throw away any mouldy seeds.',
  UNKNOWN: 'Identity not confirmed. Do not eat it unless a trusted person confirms what it is.',
});

const _str = (s) => (typeof s === 'string' ? s : '');
const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

/** Normalise a confidence input (0..1, 0..100, or 'high'|'medium'|'low') to 0..100 or null. */
function _pct(confidence) {
  if (typeof confidence === 'number' && Number.isFinite(confidence)) {
    return confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
  }
  const s = String(confidence || '').toLowerCase();
  if (s === 'high') return 90;
  if (s === 'medium') return 75;
  if (s === 'low') return 40;
  return null;
}
const _confident = (confidence) => { const p = _pct(confidence); return p != null && p >= 70; };

/** Build the important-warnings list ONLY from real reference phrases. */
function _warnings(edibility, toxicity) {
  const e = edibility.toLowerCase(), t = toxicity.toLowerCase();
  const out = [];
  const push = (key, text) => out.push({ key: 'scan.safety.warning.' + key, text });
  if (/toxic to (dogs|cats|animals|pets)|theobromine/.test(t))
    push('toxic_to_animals', 'Toxic to dogs, cats and some animals — keep it away from them.');
  if (/(leaves|stems|shoots|green parts).*(solanine|toxic|not for eating|cyanogenic|dhurrin)|solanine/.test(t))
    push('parts_not_edible', 'Only the named edible part is safe — other parts (leaves/stems/shoots) are not for eating.');
  if (/aflatoxin|mould|mold/.test(t)) push('mould_toxin', 'Discard any mouldy seeds — mould can carry harmful toxins.');
  if (/allergen/.test(t) || /allergen/.test(e)) push('allergen', 'A common allergen — avoid if you are sensitive.');
  if (/irritant|capsaicin/.test(t)) push('irritant', 'Can irritate eyes and skin — handle with care.');
  if (/(raw|wild).*(toxic|cyanogenic|dhurrin)/.test(t)) push('raw_or_wild_unsafe', 'Raw or wild forms can be unsafe — only eat the cultivated crop, properly cooked.');
  return out;
}

/**
 * Classify the safety of a plant from its identified name + scan confidence.
 * @param {unknown} plantName
 * @param {unknown} confidence  number (0..1 or 0..100) or 'high'|'medium'|'low'
 * @returns the structured safety envelope (never throws; UNKNOWN on any doubt).
 */
export function classifyPlantSafety(plantName, confidence) {
  return _safe(() => {
    const pct = _pct(confidence);
    const ref = _confident(confidence) ? lookupSafetyReference(plantName) : null;

    if (!ref) return _envelope(SAFETY_CATEGORY.UNKNOWN, SAFETY_SEVERITY.INFO, [], {
      scientificName: null, referenceId: null, confidence: pct,
      source: null, lastReviewed: null, certainty: 'NONE',
    }, null, null);

    const e = _str(ref.edibility), t = _str(ref.toxicity);
    const le = e.toLowerCase(), lt = t.toLowerCase();
    const warnings = _warnings(e, t);

    // Category — edibility-first, then toxicity escalation. Conservative.
    let category = SAFETY_CATEGORY.EDIBLE, severity = SAFETY_SEVERITY.INFO;
    if (/only after|processing|soaking/.test(le) || (/toxic if not processed|cyanogenic glycosides/.test(lt) && /process|ferment|roast|cook/.test(le))) {
      category = SAFETY_CATEGORY.PROCESS_BEFORE_EATING; severity = SAFETY_SEVERITY.WARNING;
    } else if (/aflatoxin|allergen/.test(lt) || /allergen/.test(le)) {
      category = SAFETY_CATEGORY.ALLERGEN_RISK; severity = SAFETY_SEVERITY.CAUTION;
    } else if (/not edible|inedible|do not eat|poisonous|toxic to humans/.test(le) || /toxic to humans|poisonous to humans/.test(lt)) {
      category = /toxic|poison/.test(lt) ? SAFETY_CATEGORY.TOXIC : SAFETY_CATEGORY.NOT_EDIBLE;
      severity = category === SAFETY_CATEGORY.TOXIC ? SAFETY_SEVERITY.DANGER : SAFETY_SEVERITY.WARNING;
    } else if (/edible/.test(le)) {
      category = SAFETY_CATEGORY.EDIBLE;
      // Edible, but escalate severity to CAUTION when a real caveat exists (toxic parts/animals/etc).
      severity = warnings.length > 0 ? SAFETY_SEVERITY.CAUTION : SAFETY_SEVERITY.INFO;
    } else if (/medicinal/.test(le) && !/edible/.test(le)) {
      category = SAFETY_CATEGORY.MEDICINAL_USE_ONLY; severity = SAFETY_SEVERITY.CAUTION;
    } else {
      // Known reference but no clear edibility signal → do not guess.
      return _envelope(SAFETY_CATEGORY.UNKNOWN, SAFETY_SEVERITY.INFO, [], {
        scientificName: ref.scientificName || null, referenceId: ref.id || null, confidence: pct,
        source: SAFETY_REFERENCE_SOURCE, lastReviewed: SAFETY_REFERENCE_REVIEWED_ON, certainty: 'LOW',
      }, e || null, t || null);
    }

    const certainty = pct != null && pct >= 85 ? 'HIGH' : 'MEDIUM';
    return _envelope(category, severity, warnings, {
      scientificName: ref.scientificName || null, referenceId: ref.id || null, confidence: pct,
      source: SAFETY_REFERENCE_SOURCE, lastReviewed: SAFETY_REFERENCE_REVIEWED_ON, certainty,
    }, e || null, t || null);
  }, _envelope(SAFETY_CATEGORY.UNKNOWN, SAFETY_SEVERITY.INFO, [], {
    scientificName: null, referenceId: null, confidence: null, source: null, lastReviewed: null, certainty: 'NONE',
  }, null, null));
}

function _envelope(category, severity, warnings, evidence, edibility, toxicity) {
  return Object.freeze({
    category,
    categoryKey: 'scan.safety.category.' + category,
    categoryLabel: CATEGORY_LABEL[category],
    severity,
    severityKey: 'scan.safety.severity.' + severity,
    icon: SEVERITY_ICON[severity] || '',
    confident: category !== SAFETY_CATEGORY.UNKNOWN,
    warnings: Object.freeze(warnings.map((w) => Object.freeze(w))),
    recommendedAction: CATEGORY_ACTION[category],
    recommendedActionKey: 'scan.safety.action.' + category,
    // Raw reference facts (English, real) — for the Evidence section.
    edibility, toxicity,
    evidence: Object.freeze(evidence),
    disclaimer: SAFETY_DISCLAIMER,
    disclaimerKey: SAFETY_DISCLAIMER_KEY,
  });
}

/**
 * attachSafety — the integration seam used by the Scan API. Mutates `responseObj.safety`
 * ONLY when the feature flag is on; otherwise leaves the response untouched (backward
 * compatible). `enabled` is passed in by the route so this stays pure/testable.
 */
export function attachSafety(responseObj, plantName, confidence, enabled) {
  if (!responseObj || typeof responseObj !== 'object' || !enabled) return responseObj;
  responseObj.safety = classifyPlantSafety(plantName, confidence);
  return responseObj;
}

/** Health/diagnostic snapshot (no PII). */
export function plantSafetyEngineHealth() {
  const cassava = classifyPlantSafety('cassava', 'high');
  const unknown = classifyPlantSafety('made-up-plant-xyz', 'high');
  const lowConf = classifyPlantSafety('cassava', 'low');
  return Object.freeze({
    ok: true,
    version: SAFETY_REFERENCE_VERSION_SAFE(),
    referenceCount: safetyReferenceCount(),
    confidentMatchClassifies: cassava.category === 'PROCESS_BEFORE_EATING',
    unknownNeverFabricates: unknown.category === 'UNKNOWN' && unknown.evidence.certainty === 'NONE',
    lowConfidenceUnknown: lowConf.category === 'UNKNOWN',
    disclaimerAlwaysPresent: !!cassava.disclaimer && !!unknown.disclaimer,
  });
}
function SAFETY_REFERENCE_VERSION_SAFE() { try { return SAFETY_REFERENCE.length ? 'plant-safety-engine-v1' : 'empty'; } catch { return 'unknown'; } }
