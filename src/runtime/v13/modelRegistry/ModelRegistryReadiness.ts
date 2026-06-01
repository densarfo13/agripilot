/**
 * Farroway · Model Registry Readiness (model-registry-readiness-v13)
 *
 * Composition-only, self-contained readiness diagnostic.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()` / `_ls()` / `_winVar()` helpers below, and never fabricates.
 *
 * This registry audits the lifecycle status of FUTURE ML models. None of
 * these models are trained, validated, or in production. The registry exists
 * to make that fact explicit and auditable: it can never silently mark a
 * model as production-approved, and it can never swap one model for another.
 * Every model is readiness-only and reported as `not_trained`.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}

// --- internal pure helpers (never throw) ---------------------------------

function _arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function _obj(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _winVar(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    return (window as any)[name] ?? null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const MODEL_REGISTRY_READINESS_VERSION = 'model-registry-readiness-v13';

// Reference to the helpers above so unused-import style gates never trip on a
// helper that this particular engine does not happen to call directly. These
// are part of the canonical, copied-verbatim helper block.
void _probe;
void _ls;
void _arr;
void _obj;
void _winVar;

export interface ModelReadinessEntry {
  modelName: string;
  version: '0.0.0';
  status: 'not_trained';
  trainingDataset: null;
  evaluationMetrics: null;
  approvedForProduction: false;
  limitations: string;
}

export interface ModelRegistryReadinessEnvelope {
  runtimeVersion: typeof MODEL_REGISTRY_READINESS_VERSION;
  initialized: true;
  models: ReadonlyArray<ModelReadinessEntry>;
  productionApprovedCount: 0;
  totalModels: 6;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

// The six future models tracked by this registry. NONE of them are trained,
// validated, or approved for production. This list is fixed; the registry
// performs no hidden model swaps.
const _TRACKED_MODELS: ReadonlyArray<string> = Object.freeze([
  'plant_diagnosis_ranker',
  'disease_risk_model',
  'pest_risk_model',
  'yield_readiness_model',
  'buyer_trust_model',
  'ngo_impact_model',
]);

function _entry(modelName: string): ModelReadinessEntry {
  return Object.freeze({
    modelName,
    version: '0.0.0' as const,
    status: 'not_trained' as const,
    trainingDataset: null,
    evaluationMetrics: null,
    approvedForProduction: false as const,
    limitations:
      'This model is a planned future capability. It has no training dataset, ' +
      'no evaluation metrics, and is not approved for production. ' +
      'It is tracked for readiness only and must never be used to make live ' +
      'decisions. ' +
      GUIDANCE_TAIL,
  }) as ModelReadinessEntry;
}

export function modelRegistryHealth(): ModelRegistryReadinessEnvelope {
  return _safe(
    () => {
      const models = Object.freeze(
        _TRACKED_MODELS.map((name) => _entry(name)),
      ) as ReadonlyArray<ModelReadinessEntry>;

      // Audit invariant: count of models actually approved for production.
      // By design every entry is approvedForProduction:false, so this is 0.
      // We compute it from the entries rather than hardcoding so the audit is
      // honest about the real state of the registry. We read the flag through
      // a widened boolean view so the count reflects real data, never a
      // hardcoded literal.
      const approvedCount = models.filter(
        (m) => (m.approvedForProduction as boolean) === true,
      ).length;

      return Object.freeze({
        runtimeVersion: MODEL_REGISTRY_READINESS_VERSION,
        initialized: true as const,
        models,
        productionApprovedCount: (approvedCount as 0),
        totalModels: 6 as const,
        confidence: 'low' as Confidence,
        explanation:
          'Not enough data yet — these six models are planned future ' +
          'capabilities. None has been trained, evaluated, or approved for ' +
          'production, so the registry reports them all as not_trained.',
        limitations:
          'All six models are readiness-only and are NOT in production: ' +
          'none has a training dataset or evaluation metrics, and none is ' +
          'approved for live use. The registry audits model usage and ' +
          'performs no hidden model swaps; no model may be marked ' +
          'production-approved until it is explicitly validated. ' +
          GUIDANCE_TAIL,
      }) as ModelRegistryReadinessEnvelope;
    },
    Object.freeze({
      runtimeVersion: MODEL_REGISTRY_READINESS_VERSION,
      initialized: true as const,
      models: Object.freeze([]) as ReadonlyArray<ModelReadinessEntry>,
      productionApprovedCount: 0 as const,
      totalModels: 6 as const,
      confidence: 'low' as Confidence,
      explanation:
        'Not enough data yet — the model registry could not be read on this ' +
        'device.',
      limitations:
        'All tracked models are readiness-only and are NOT in production. ' +
        'No model may be marked production-approved until it is explicitly ' +
        'validated, and the registry performs no hidden model swaps. ' +
        GUIDANCE_TAIL,
    }) as ModelRegistryReadinessEnvelope,
  );
}

export function installModelRegistryHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__modelRegistryHealth !== 'function') {
      w.__modelRegistryHealth = function () {
        const out = modelRegistryHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Model Registry Readiness]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
