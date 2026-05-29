/**
 * src/intelligence/soilAdvisor.ts — pH / NPK soil advisor.
 *
 *   import { soilAdvisor, SOIL_ADVISOR_VERSION }
 *     from 'src/intelligence/soilAdvisor';
 *
 *   soilAdvisor({
 *     pH, organicMatterPct, nitrogenPpm, phosphorusPpm, potassiumPpm,
 *     plantId,
 *   })
 *
 * Returns frozen envelope:
 *   {
 *     ok, recommendations: [{
 *       kind, urgency, labelKey, labelDefault,
 *     }],
 *     readings:  { pH, om, n, p, k },
 *     ideal:     { pHMin, pHMax, omMin, nMin, pMin, kMin },
 *     runtimeVersion,
 *   }
 *
 * Honest unknown when readings are missing.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No fetch.
 *   • Returns ok:false with reason on insufficient input.
 */

export const SOIL_ADVISOR_VERSION = 'soil-advisor-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface SoilCtx {
  pH?: number;
  organicMatterPct?: number;
  nitrogenPpm?: number;
  phosphorusPpm?: number;
  potassiumPpm?: number;
  plantId?: string;
}

// Generic ideal ranges for vegetable / flower plots. Caller may
// override per plant (advanced — not exposed to UI in this commit).
const IDEAL = Object.freeze({
  pHMin:  6.0,
  pHMax:  7.0,
  omMin:  3.0,
  nMin:  20,  // ppm
  pMin:  20,
  kMin: 100,
});

function _nullEnvelope(reason: string) {
  return Object.freeze({
    runtimeVersion: SOIL_ADVISOR_VERSION,
    ok: false, reason,
    recommendations: Object.freeze([]),
    readings:        Object.freeze({}),
    ideal:           IDEAL,
  });
}

export function soilAdvisor(ctx: SoilCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as SoilCtx;
    const pH = _num(c.pH);
    const om = _num(c.organicMatterPct);
    const n  = _num(c.nitrogenPpm);
    const p  = _num(c.phosphorusPpm);
    const k  = _num(c.potassiumPpm);

    if (pH == null && om == null && n == null && p == null && k == null) {
      return _nullEnvelope('no_readings');
    }

    const recs: any[] = [];

    if (pH != null) {
      if (pH < IDEAL.pHMin - 0.3) {
        recs.push(Object.freeze({
          kind: 'raise_ph', urgency: 'high',
          labelKey: 'grow.soil.task.raisePh',
          labelDefault: 'pH is low — add agricultural lime.',
        }));
      } else if (pH > IDEAL.pHMax + 0.3) {
        recs.push(Object.freeze({
          kind: 'lower_ph', urgency: 'medium',
          labelKey: 'grow.soil.task.lowerPh',
          labelDefault: 'pH is high — add elemental sulfur or compost.',
        }));
      }
    }
    if (om != null && om < IDEAL.omMin) {
      recs.push(Object.freeze({
        kind: 'add_compost', urgency: 'medium',
        labelKey: 'grow.soil.task.addCompost',
        labelDefault: 'Organic matter is low — add compost.',
      }));
    }
    if (n != null && n < IDEAL.nMin) {
      recs.push(Object.freeze({
        kind: 'add_nitrogen', urgency: 'high',
        labelKey: 'grow.soil.task.addNitrogen',
        labelDefault: 'Add nitrogen — leafy growth needs more N.',
      }));
    }
    if (p != null && p < IDEAL.pMin) {
      recs.push(Object.freeze({
        kind: 'add_phosphorus', urgency: 'medium',
        labelKey: 'grow.soil.task.addPhosphorus',
        labelDefault: 'Add phosphorus — supports root and bloom.',
      }));
    }
    if (k != null && k < IDEAL.kMin) {
      recs.push(Object.freeze({
        kind: 'add_potassium', urgency: 'medium',
        labelKey: 'grow.soil.task.addPotassium',
        labelDefault: 'Add potassium — supports fruit and stress tolerance.',
      }));
    }

    return Object.freeze({
      runtimeVersion: SOIL_ADVISOR_VERSION,
      ok: true, reason: '',
      recommendations: Object.freeze(recs),
      readings: Object.freeze({ pH, om, n, p, k }),
      ideal: IDEAL,
      plantId: _str(c.plantId),
    });
  }, _nullEnvelope('error'));
}

export const SOIL_IDEAL = IDEAL;
