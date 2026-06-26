/**
 * DiseaseTreatmentEngine.ts — surface REAL treatment guidance for a detected issue.
 *
 * The repo already ships a curated disease knowledge base (src/data/diseases — 30
 * diseases, each with treatmentOrganic / prevention / treatmentChemical). It was
 * never wired into the scan result, so a farmer who scans a sick plant gets the
 * diagnosis but NOT the specific, actionable treatment that's already on disk. This
 * engine matches a detected issue to that KB and returns the organic + cultural
 * treatment + prevention.
 *
 * Safety: a treatment is returned ONLY on a confident scan AND a real, reasonably
 * certain KB match (no fuzzy guessing — a wrong treatment wastes a farmer's effort).
 * CHEMICAL options are deliberately NOT pushed: recommending specific agrochemicals
 * to a low-literacy farmer with no agronomist present is unsafe — we surface a
 * "ask your extension officer" line instead. No match → no treatment (never fabricated).
 *
 * Composes the existing disease DB (single source of truth). Pure, total.
 */
// Access the disease data through the knowledge layer (not src/data directly) —
// the layer-boundary the platform enforces. listDiseases() wraps DISEASE_DB.
import { listDiseases } from '../../../knowledge/diseases/DiseaseKnowledgeService';

export interface DiseaseTreatment {
  matched: boolean;
  diseaseId: string | null;
  diseaseName: string | null;
  organic: ReadonlyArray<string>;     // organic + cultural steps (safe to act on)
  prevention: ReadonlyArray<string>;  // how to stop it recurring
  chemicalNote: string | null;        // a CAUTION line, never a specific chemical/dose
  reason: string;
  confident: boolean;
}

const NONE: DiseaseTreatment = Object.freeze({
  matched: false, diseaseId: null, diseaseName: null,
  organic: Object.freeze([]), prevention: Object.freeze([]), chemicalNote: null,
  reason: 'No confident match to the treatment library — not guessing a treatment.', confident: false,
});

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _norm = (s: unknown): string => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const _arr = (v: any): any[] => (Array.isArray(v) ? v : []);

function _confident(confidence: unknown): boolean {
  if (typeof confidence === 'number') return (confidence <= 1 ? confidence * 100 : confidence) >= 70;
  const s = String(confidence || '').toLowerCase();
  return s === 'high' || s === 'medium';
}

/**
 * Conservative bidirectional match: the issue text and a disease name must share the
 * full name as a substring (either direction) and be long enough to be specific.
 * Avoids fuzzy mismatches that would surface the WRONG treatment.
 */
function _matchDisease(issueText: string): any | null {
  const q = _norm(issueText);
  if (q.length < 3) return null;
  let best: any = null, bestScore = -1;
  for (const d of (listDiseases() as any[])) {
    const id = _norm(d && d.id), name = _norm(d && d.name);
    if (!name) continue;
    let score = -1;
    if (q === name || q === id) score = 100;
    else if (name.length >= 4 && q.includes(name)) score = 80;     // "northern leaf blight" ⊇ "leaf blight"
    else if (q.length >= 4 && name.includes(q)) score = 70;        // "maize leaf blight" ⊇ "leaf blight"
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return bestScore >= 70 ? best : null;
}

/**
 * @param issueText   the detected disease / possible-issue text from the scan
 * @param confidence  the scan confidence (number 0..100/0..1 or 'high'|'medium'|'low')
 */
export function treatmentForIssue(issueText: unknown, confidence: unknown): DiseaseTreatment {
  return _safe(() => {
    if (!_confident(confidence)) return NONE;
    const d = _matchDisease(String(issueText || ''));
    if (!d) return NONE;
    const organic = _arr(d.treatmentOrganic).map(String).filter(Boolean).slice(0, 4);
    const prevention = _arr(d.prevention).map(String).filter(Boolean).slice(0, 3);
    if (organic.length === 0 && prevention.length === 0) return NONE;
    const hasChemical = _arr(d.treatmentChemical).length > 0;
    return Object.freeze({
      matched: true, diseaseId: d.id || null, diseaseName: d.name || null,
      organic: Object.freeze(organic), prevention: Object.freeze(prevention),
      chemicalNote: hasChemical ? 'For chemical options, ask your local extension officer first.' : null,
      reason: 'Matched "' + (d.name || '') + '" in the treatment library.', confident: true,
    });
  }, NONE);
}

export function diseaseTreatmentHealth() {
  // Sample against the real DB — names depend on the curated data, so assert structure.
  const blight = treatmentForIssue('leaf blight', 'high');
  const lowConf = treatmentForIssue('leaf blight', 'low');
  const nonsense = treatmentForIssue('zzz not a disease', 'high');
  return Object.freeze({
    ok: true, diseaseCount: (listDiseases() as any[]).length,
    // When matched, organic steps are present + chemical is a caution, not a recipe.
    matchReturnsOrganic: !blight.matched || blight.organic.length > 0,
    chemicalNeverPrescribed: !blight.chemicalNote || /officer/i.test(blight.chemicalNote),
    // Honesty: low confidence + nonsense never get a treatment.
    lowConfidenceNoTreatment: lowConf.matched === false,
    nonsenseNoTreatment: nonsense.matched === false,
  });
}

export function installDiseaseTreatmentHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__diseaseTreatmentHealth) return;
    Object.defineProperty(window, '__diseaseTreatmentHealth', {
      configurable: true, enumerable: false, writable: false, value: () => diseaseTreatmentHealth(),
    });
  }, undefined);
}
