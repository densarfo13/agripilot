/**
 * NutrientDeficiencyEngine.ts — surface SAFE nutrient-deficiency guidance for a
 * detected deficiency. Completes the diagnose→treat trio (disease / pest / nutrient).
 *
 * The repo ships a curated nutrient KB (src/data/nutrients — 20 deficiencies, each
 * with treatment / prevention / severityGuidance / followUpScanDays), reached via the
 * knowledge layer. It was never wired into the scan.
 *
 * HONESTY + SAFETY — nutrient guidance is higher-stakes than disease/pest because the
 * curated `treatment` array MIXES synthetic-fertiliser prescriptions WITH DOSES
 * ("urea 46-0-0", "foliar 1-2%") in with organic amendments, and a photo cannot
 * measure soil N/P/K. So this engine is deliberately conservative:
 *   • Correction steps use an ALLOWLIST — only clearly farmer-safe amendments
 *     (compost, manure, mulch, lime, gypsum, wood ash, green manure, cover crop,
 *     mycorrhizae, crop residue) ever surface. A synthetic-fertiliser line with a
 *     dose can NEVER leak to the farmer.
 *   • If the KB had any synthetic option, we set fertiliserDeferred and show an
 *     "ask your extension officer about fertiliser amounts; confirm with a soil test"
 *     caution — never a specific fertiliser or dose.
 *   • Returned ONLY on a confident scan + a real, conservative KB match. No match →
 *     nothing (never fabricated).
 *
 * Composes the nutrient knowledge layer (single source of truth). Pure, total.
 */
import { listNutrients } from '../../../knowledge/nutrients/NutrientKnowledgeService';

export interface NutrientGuidance {
  matched: boolean;
  nutrientId: string | null;
  nutrientName: string | null;
  organic: ReadonlyArray<string>;     // farmer-safe amendment steps only (allowlist)
  prevention: ReadonlyArray<string>;  // cultural prevention (synthetic lines stripped)
  severity: string | null;            // honest urgency guidance from the KB
  followUpDays: number | null;        // when to check the plant again
  fertiliserDeferred: boolean;        // KB had synthetic options → defer to officer
  reason: string;
  confident: boolean;
}

const NONE: NutrientGuidance = Object.freeze({
  matched: false, nutrientId: null, nutrientName: null,
  organic: Object.freeze([]), prevention: Object.freeze([]),
  severity: null, followUpDays: null, fertiliserDeferred: false,
  reason: 'No confident match to the nutrient library — not guessing.', confident: false,
});

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _norm = (s: unknown): string => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const _arr = (v: any): any[] => (Array.isArray(v) ? v : []);

function _confident(confidence: unknown): boolean {
  if (typeof confidence === 'number') return (confidence <= 1 ? confidence * 100 : confidence) >= 70;
  const s = String(confidence || '').toLowerCase();
  return s === 'high' || s === 'medium';
}

// A synthetic fertiliser / dose line — NEVER shown to the farmer.
const SYNTHETIC = /\burea\b|\bnpk\b|\bdap\b|\bssp\b|\bmop\b|\bsop\b|superphosphate|muriate|sulphate of potash|sulfate of potash|potassium nitrate|calcium chloride|ammonium\b|foliar|\d+\s*-\s*\d+\s*-\s*\d+|\d+(\.\d+)?\s*%/i;
// A clearly farmer-safe organic / mineral amendment or cultural practice.
const SAFE_AMENDMENT = /compost|manure|mulch|\blime\b|liming|gypsum|wood ash|green[- ]?manure|cover crop|mycorrhiz|legume|crop residue|residues?|organic matter|rotat|drip irrigation|consistent water|even (soil )?moisture/i;

const _organicOnly = (lines: any[]): string[] =>
  lines.map(String).filter((l) => l && SAFE_AMENDMENT.test(l) && !SYNTHETIC.test(l));
const _safePrevention = (lines: any[]): string[] =>
  lines.map(String).filter((l) => l && !SYNTHETIC.test(l));
const _hadSynthetic = (lines: any[]): boolean =>
  lines.map(String).some((l) => SYNTHETIC.test(l));

/**
 * Conservative bidirectional match against name / id / aliases.
 */
function _matchNutrient(issueText: string): any | null {
  const q = _norm(issueText);
  if (q.length < 3) return null;
  let best: any = null, bestScore = -1;
  for (const n of (listNutrients() as any[])) {
    const candidates = [n && n.name, n && n.id, ..._arr(n && n.aliases)].map(_norm).filter(Boolean);
    let score = -1;
    for (const c of candidates) {
      if (q === c) { score = Math.max(score, 100); }
      else if (c.length >= 4 && q.includes(c)) { score = Math.max(score, 80); }
      else if (q.length >= 4 && c.includes(q)) { score = Math.max(score, 70); }
    }
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return bestScore >= 70 ? best : null;
}

/**
 * @param issueText   the detected deficiency / possible-issue text from the scan
 * @param confidence  the scan confidence (number 0..100/0..1 or 'high'|'medium'|'low')
 */
export function nutrientGuidanceForIssue(issueText: unknown, confidence: unknown): NutrientGuidance {
  return _safe(() => {
    if (!_confident(confidence)) return NONE;
    const n = _matchNutrient(String(issueText || ''));
    if (!n) return NONE;
    const treatment = _arr(n.treatment);
    const organic = _organicOnly(treatment).slice(0, 4);
    const prevention = _safePrevention(_arr(n.prevention)).slice(0, 3);
    if (organic.length === 0 && prevention.length === 0) return NONE;
    const followUp = (typeof n.followUpScanDays === 'number' && n.followUpScanDays > 0) ? n.followUpScanDays : null;
    return Object.freeze({
      matched: true, nutrientId: n.id || null, nutrientName: n.name || null,
      organic: Object.freeze(organic), prevention: Object.freeze(prevention),
      severity: (typeof n.severityGuidance === 'string' && n.severityGuidance) ? n.severityGuidance : null,
      followUpDays: followUp,
      fertiliserDeferred: _hadSynthetic(treatment),
      reason: 'Matched "' + (n.name || '') + '" in the nutrient library.', confident: true,
    });
  }, NONE);
}

export function nutrientGuidanceHealth() {
  const nitro = nutrientGuidanceForIssue('nitrogen deficiency', 'high');
  const lowConf = nutrientGuidanceForIssue('nitrogen deficiency', 'low');
  const nonsense = nutrientGuidanceForIssue('zzz not a nutrient', 'high');
  // CRITICAL: no surfaced organic line may ever contain a synthetic fertiliser/dose.
  const allOrganicSafe = (listNutrients() as any[]).every((n) =>
    _organicOnly(_arr(n.treatment)).every((l) => !SYNTHETIC.test(l)));
  return Object.freeze({
    ok: true, nutrientCount: (listNutrients() as any[]).length,
    organicNeverSynthetic: allOrganicSafe,
    defersFertiliser: !nitro.matched || nitro.fertiliserDeferred === true, // nitrogen KB has urea → must defer
    lowConfidenceNoGuidance: lowConf.matched === false,
    nonsenseNoGuidance: nonsense.matched === false,
  });
}

export function installNutrientGuidanceHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__nutrientGuidanceHealth) return;
    Object.defineProperty(window, '__nutrientGuidanceHealth', {
      configurable: true, enumerable: false, writable: false, value: () => nutrientGuidanceHealth(),
    });
  }, undefined);
}
