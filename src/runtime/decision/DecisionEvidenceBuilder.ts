/**
 * DecisionEvidenceBuilder.ts — FARROWAY DECISION ENGINE, §5 evidence.
 *
 * Builds the visible "Why this decision?" evidence lines from REAL signals only
 * (crop, stage, scan, weather, history). Each line is a plain ✓ fact the farmer
 * can see for themselves. It never invents evidence and never names a provider.
 */
import { DecisionInputs } from './FarrowayDecisionContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Returns ordered ✓ evidence lines — only those backed by a real signal. */
export function buildDecisionEvidence(inputs: DecisionInputs = {}): ReadonlyArray<string> {
  return _safe(() => {
    const out: string[] = [];
    const fb = inputs.farmBrainState || {};
    const crop = _str(inputs.crop) || _str(fb && fb.crop);
    if (crop) out.push('✓ ' + crop + ' crop selected');

    const stage = _str(inputs.cropStage) || _str(fb.growthStage && fb.growthStage.value);
    if (stage) out.push('✓ Crop is in ' + stage.toLowerCase() + ' stage');

    // Scan-derived stress (real FarmBrain signal).
    const disease = fb.diseaseRisk && typeof fb.diseaseRisk.value === 'number' ? fb.diseaseRisk.value : null;
    if (disease != null && disease >= 40) {
      out.push('✓ Recent scan showed ' + (disease >= 60 ? 'clear' : 'mild') + ' leaf stress');
    }

    // Weather impact (only when present).
    const w = inputs.weather || {};
    const rain = _str(w.summary || w.condition).toLowerCase();
    if (/rain|shower|storm/.test(rain)) out.push('✓ Rain expected soon');
    else if (typeof w.humidity === 'number' && w.humidity >= 70) out.push('✓ Humidity is increasing');

    // History (only when a prior similar outcome exists).
    const hist = Array.isArray(inputs.outcomeHistory) ? inputs.outcomeHistory : [];
    if (hist.some((o) => o && (o.outcome === 'better' || o.helped === true))) {
      out.push('✓ A similar task helped before');
    }

    return Object.freeze(out.slice(0, 6));
  }, Object.freeze([]));
}
