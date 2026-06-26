/**
 * PlantSafetyEngine.ts — farmer safety classification from the botanical reference.
 *
 * `PlantReference` holds REAL safety facts (cassava is cyanogenic → process before
 * eating; tomato/pepper leaves contain solanine; onion/cocoa are toxic to animals).
 * Today those never reach the farmer. This engine turns the real edibility/toxicity
 * strings into a LANGUAGE-NEUTRAL category + a universal icon, so the safety signal
 * is understood regardless of literacy or language — the icon (⚠️/✅) carries the
 * meaning; the detail text is translated through the normal i18n flow.
 *
 * Hard rules: a safety category is produced ONLY on a CONFIDENT, KNOWN-reference
 * match. Low confidence or an unlisted plant → `UNKNOWN` (we never invent a safety
 * claim — a wrong "safe to eat" could harm a farmer). Composes PlantReference (single
 * source of truth). Pure, total, browser-safe.
 */
import { lookupPlantReference } from '../v12/PlantReference';

export type SafetyCategory =
  | 'EDIBLE'                 // edible, no known caution
  | 'PROCESS_BEFORE_EATING'  // edible ONLY after processing (cassava…)
  | 'PARTS_NOT_EDIBLE'       // some parts toxic (tomato/pepper leaves…)
  | 'TOXIC_TO_ANIMALS'       // toxic to dogs/cats/livestock, not humans
  | 'ALLERGEN'               // common allergen / mould-toxin risk (groundnut…)
  | 'CAUTION'                // a real caveat that doesn't fit the above
  | 'UNKNOWN';               // not confidently identified / not in reference

export interface PlantSafety {
  category: SafetyCategory;
  icon: string;              // language-neutral: '✅' safe · '⚠️' caution · '' unknown
  severity: 'info' | 'caution';
  edibility: string | null;  // the REAL reference phrase (English; translated downstream)
  toxicity: string | null;   // the REAL reference phrase
  reason: string;            // farmer-facing, evidence-based
  confident: boolean;
}

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

const UNKNOWN: PlantSafety = Object.freeze({
  category: 'UNKNOWN', icon: '', severity: 'info', edibility: null, toxicity: null,
  reason: 'Not confidently identified — no safety claim (unknown is safer than a wrong one).', confident: false,
});

function _confidentPct(confidence: unknown): boolean {
  if (typeof confidence === 'number') return (confidence <= 1 ? confidence * 100 : confidence) >= 70;
  const s = String(confidence || '').toLowerCase();
  return s === 'high' || s === 'medium';   // low / unknown → not confident
}

/** Classify the REAL reference strings into a category. Keyword-driven, honest. */
function _categorize(edibility: string, toxicity: string): SafetyCategory {
  const e = edibility.toLowerCase(), t = toxicity.toLowerCase();
  if (/only after|process|soaking|cyanogenic|cyanide/.test(e + ' ' + t)) return 'PROCESS_BEFORE_EATING';
  if (/aflatoxin|allergen/.test(t)) return 'ALLERGEN';
  if (/leaves|stems|shoots|solanine|not for eating|young/.test(t)) return 'PARTS_NOT_EDIBLE';
  if (/toxic to (dogs|cats|animals|livestock)/.test(t)) return 'TOXIC_TO_ANIMALS';
  if (/none known/.test(t) && /edible/.test(e)) return 'EDIBLE';
  return 'CAUTION';
}

const ICON: Record<SafetyCategory, { icon: string; severity: 'info' | 'caution' }> = {
  EDIBLE:                { icon: '✅', severity: 'info' },
  PROCESS_BEFORE_EATING: { icon: '⚠️', severity: 'caution' },
  PARTS_NOT_EDIBLE:      { icon: '⚠️', severity: 'caution' },
  TOXIC_TO_ANIMALS:      { icon: '⚠️', severity: 'caution' },
  ALLERGEN:              { icon: '⚠️', severity: 'caution' },
  CAUTION:               { icon: '⚠️', severity: 'caution' },
  UNKNOWN:               { icon: '',   severity: 'info' },
};

/**
 * @param name        identified plant/crop name
 * @param confidence  the scan confidence (number 0..100/0..1 or 'high'|'medium'|'low')
 */
export function classifyPlantSafety(name: unknown, confidence: unknown): PlantSafety {
  return _safe(() => {
    if (!_confidentPct(confidence)) return UNKNOWN;
    const ref = lookupPlantReference(name);
    if (!ref) return UNKNOWN;
    const category = _categorize(ref.edibility, ref.toxicity);
    const meta = ICON[category];
    const reason = category === 'EDIBLE'
      ? ref.edibility
      : ref.toxicity || ref.edibility;
    return Object.freeze({
      category, icon: meta.icon, severity: meta.severity,
      edibility: ref.edibility, toxicity: ref.toxicity,
      reason, confident: true,
    });
  }, UNKNOWN);
}

export function plantSafetyHealth() {
  const cassava = classifyPlantSafety('cassava', 'high');
  const tomato = classifyPlantSafety('tomato', 92);
  const maize = classifyPlantSafety('maize', 'high');
  const lowConf = classifyPlantSafety('cassava', 'low');
  const unlisted = classifyPlantSafety('rare-orchid-xyz', 'high');
  return Object.freeze({
    ok: true, categories: 7,
    cassavaProcessed: cassava.category === 'PROCESS_BEFORE_EATING' && cassava.icon === '⚠️',
    tomatoPartsToxic: tomato.category === 'PARTS_NOT_EDIBLE',
    maizeEdible: maize.category === 'EDIBLE' && maize.icon === '✅',
    // Honesty: low confidence or an unlisted plant NEVER gets a safety claim.
    lowConfidenceUnknown: lowConf.category === 'UNKNOWN' && lowConf.icon === '',
    unlistedUnknown: unlisted.category === 'UNKNOWN',
  });
}

export function installPlantSafetyHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__plantSafetyHealth) return;
    Object.defineProperty(window, '__plantSafetyHealth', {
      configurable: true, enumerable: false, writable: false, value: () => plantSafetyHealth(),
    });
  }, undefined);
}
