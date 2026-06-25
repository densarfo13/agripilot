/**
 * DecisionExplainer.ts — FARROWAY DECISION ENGINE, §5 explanation.
 *
 * Turns evidence into a farmer-facing reason and strips ALL jargon. The farmer
 * never sees AI / LLM / model / Plant.id / Crop.health / Insect.id — only clear,
 * plain language. This is the last line of defence against jargon leaking into
 * a decision (the build gate check:decision-no-jargon enforces it too).
 */
const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

/** Banned farmer-facing terms (case-insensitive). */
export const JARGON_TERMS = Object.freeze([
  'ai', 'a.i.', 'llm', 'model', 'machine learning', 'neural', 'algorithm',
  'plant.id', 'plantid', 'crop.health', 'crophealth', 'insect.id', 'insectid',
  'provider', 'api', 'inference', 'classifier',
]);

const _RE = new RegExp('\\b(' + JARGON_TERMS
  .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');

/** Remove jargon from any farmer-facing string. */
export function sanitizeFarmerText(text: string): string {
  return _safe(() => {
    if (typeof text !== 'string') return '';
    // Replace provider/AI words with neutral language, then tidy whitespace.
    return text
      .replace(/\b(plant\.id|crop\.health|insect\.id)\b/gi, 'the scan')
      .replace(/\b(ai|a\.i\.|llm|model|machine learning|neural|algorithm|inference|classifier)\b/gi, 'Farroway')
      .replace(/\bprovider\b/gi, 'check')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }, '');
}

export function containsJargon(text: string): boolean {
  return _safe(() => _RE.test(String(text || '')), false);
}

/** Compose a plain reason from evidence + the chosen action. */
export function explainDecision(
  action: string, evidence: ReadonlyArray<string>,
): string {
  return _safe(() => {
    const facts = (Array.isArray(evidence) ? evidence : [])
      .map((e) => e.replace(/^✓\s*/, '').toLowerCase())
      .slice(0, 2);
    const base = facts.length
      ? facts.join(' and ') + '.'
      : 'this keeps your crop on track.';
    return sanitizeFarmerText(base.charAt(0).toUpperCase() + base.slice(1));
  }, 'Recommended to keep your crop on track.');
}
