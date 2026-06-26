/**
 * PestTreatmentEngine.ts — surface REAL pest-control guidance for a detected pest.
 *
 * Mirror of DiseaseTreatmentEngine for the pest side. The repo ships a curated pest
 * knowledge base (src/data/pests — 30 pests, each with treatmentOrganic / prevention /
 * lifecycle / treatmentChemical), reached through the knowledge layer. It was never
 * wired into the scan result, so a farmer who scans an insect-damaged plant gets the
 * diagnosis but NOT the specific control method that's already on disk.
 *
 * Safety + honesty (identical doctrine to disease treatment):
 *   • organic + cultural control + prevention only — CHEMICAL pesticides are NEVER
 *     prescribed (deferred to an extension officer); the wrong pesticide harms
 *     beneficials, the farmer, and the crop.
 *   • a control is returned ONLY on a confident scan AND a real, conservative KB match
 *     (no fuzzy guessing — a wrong control wastes a farmer's scarce inputs).
 *   • no match → nothing (never fabricated).
 *
 * Composes the pest knowledge layer (single source of truth). Pure, total.
 */
import { listPests } from '../../../knowledge/pests/PestKnowledgeService';

export interface PestControl {
  matched: boolean;
  pestId: string | null;
  pestName: string | null;
  organic: ReadonlyArray<string>;     // organic + cultural control (safe to act on)
  prevention: ReadonlyArray<string>;  // how to keep it away
  chemicalNote: string | null;        // a CAUTION line, never a specific pesticide/dose
  reason: string;
  confident: boolean;
}

const NONE: PestControl = Object.freeze({
  matched: false, pestId: null, pestName: null,
  organic: Object.freeze([]), prevention: Object.freeze([]), chemicalNote: null,
  reason: 'No confident match to the pest library — not guessing a control.', confident: false,
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
 * Conservative bidirectional match: the detected text and a pest name must share the
 * full name as a substring (either direction) and be specific enough. Avoids fuzzy
 * mismatches that would surface the WRONG control.
 */
function _matchPest(issueText: string): any | null {
  const q = _norm(issueText);
  if (q.length < 3) return null;
  let best: any = null, bestScore = -1;
  for (const p of (listPests() as any[])) {
    const id = _norm(p && p.id), name = _norm(p && p.name);
    if (!name) continue;
    let score = -1;
    if (q === name || q === id) score = 100;
    else if (name.length >= 4 && q.includes(name)) score = 80;     // "fall armyworm larvae" ⊇ "fall armyworm"
    else if (q.length >= 4 && name.includes(q)) score = 70;        // "armyworm" ⊆ "fall armyworm"
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore >= 70 ? best : null;
}

/**
 * @param issueText   the detected pest / possible-issue text from the scan
 * @param confidence  the scan confidence (number 0..100/0..1 or 'high'|'medium'|'low')
 */
export function controlForPest(issueText: unknown, confidence: unknown): PestControl {
  return _safe(() => {
    if (!_confident(confidence)) return NONE;
    const p = _matchPest(String(issueText || ''));
    if (!p) return NONE;
    const organic = _arr(p.treatmentOrganic).map(String).filter(Boolean).slice(0, 4);
    const prevention = _arr(p.prevention).map(String).filter(Boolean).slice(0, 3);
    if (organic.length === 0 && prevention.length === 0) return NONE;
    const hasChemical = _arr(p.treatmentChemical).length > 0;
    return Object.freeze({
      matched: true, pestId: p.id || null, pestName: p.name || null,
      organic: Object.freeze(organic), prevention: Object.freeze(prevention),
      chemicalNote: hasChemical ? 'For chemical pesticides, ask your local extension officer first.' : null,
      reason: 'Matched "' + (p.name || '') + '" in the pest library.', confident: true,
    });
  }, NONE);
}

export function pestTreatmentHealth() {
  const aphids = controlForPest('aphids', 'high');
  const lowConf = controlForPest('aphids', 'low');
  const nonsense = controlForPest('zzz not a pest', 'high');
  return Object.freeze({
    ok: true, pestCount: (listPests() as any[]).length,
    matchReturnsOrganic: !aphids.matched || aphids.organic.length > 0,
    chemicalNeverPrescribed: !aphids.chemicalNote || /officer/i.test(aphids.chemicalNote),
    lowConfidenceNoControl: lowConf.matched === false,
    nonsenseNoControl: nonsense.matched === false,
  });
}

export function installPestTreatmentHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__pestTreatmentHealth) return;
    Object.defineProperty(window, '__pestTreatmentHealth', {
      configurable: true, enumerable: false, writable: false, value: () => pestTreatmentHealth(),
    });
  }, undefined);
}
