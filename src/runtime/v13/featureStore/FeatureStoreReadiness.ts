/**
 * Farroway · Feature Store Readiness (feature-store-readiness-v13)
 *
 * Composition-only, self-contained readiness diagnostics runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()` and `_ls()` helpers below, and never fabricates feature values.
 *
 * This engine reports whether each feature GROUP has a real underlying data
 * source available — it is a readiness map, NOT a feature value computation.
 * No computed feature number is ever emitted. Features are computed from real
 * events only; this engine reports readiness, not values. When no source is
 * present, it returns the honest "Not enough data yet" fallback.
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

export const FEATURE_STORE_READINESS_VERSION = 'feature-store-readiness-v13';

const TOTAL_GROUPS = 10 as const;

export interface FeatureGroupStatus {
  ready: boolean;
  source: string;
}

export interface FeatureStoreReadinessEnvelope {
  runtimeVersion: typeof FEATURE_STORE_READINESS_VERSION;
  initialized: true;
  featureGroups: Readonly<Record<string, Readonly<FeatureGroupStatus>>>;
  readyCount: number;
  totalGroups: typeof TOTAL_GROUPS;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

const FEATURE_GROUP_NAMES = [
  'farmer_activity_features',
  'plant_health_features',
  'scan_quality_features',
  'disease_pressure_features',
  'pest_pressure_features',
  'weather_risk_features',
  'task_completion_features',
  'outcome_features',
  'buyer_trust_features',
  'ngo_program_features',
] as const;

function _freezeGroup(ready: boolean, source: string): Readonly<FeatureGroupStatus> {
  return Object.freeze({ ready: !!ready, source: String(source) });
}

export function featureStoreHealth(): FeatureStoreReadinessEnvelope {
  return _safe(
    () => {
      // --- real stored data (any of these may be absent) ---
      const eventLog = _arr(_ls('farroway_event_log'));
      const cachedTasks = _arr(_ls('farroway_cached_tasks'));
      const scanHistory = _arr(_ls('farroway_scan_history_v1'));

      // event/task derived sources
      const hasEventLog = eventLog.length > 0;
      const hasCachedTasks = cachedTasks.length > 0;
      // scan-derived sources
      const hasScanHistory = scanHistory.length > 0;

      // --- probes / window vars (any may be null) ---
      const weatherRisk = _probe('__weatherRiskHealth');
      const lastWeather = _obj(_winVar('__farrowayLastWeather'));
      const outcome = _probe('__outcomeHealth');
      const buyerTrust = _probe('__buyerTrustHealth');
      const ngoImpact = _probe('__ngoImpactHealth');

      const hasWeather = !!weatherRisk || !!lastWeather;
      const hasOutcome = !!outcome;
      const hasBuyerTrust = !!buyerTrust;
      const hasNgo = !!ngoImpact;

      // A group's ready=true ONLY if its underlying real source exists.
      // No feature value is ever computed here — readiness only.
      const groups: Record<string, Readonly<FeatureGroupStatus>> = {
        farmer_activity_features: _freezeGroup(
          hasEventLog,
          'farroway_event_log',
        ),
        plant_health_features: _freezeGroup(
          hasScanHistory,
          'farroway_scan_history_v1',
        ),
        scan_quality_features: _freezeGroup(
          hasScanHistory,
          'farroway_scan_history_v1',
        ),
        disease_pressure_features: _freezeGroup(
          hasScanHistory,
          'farroway_scan_history_v1',
        ),
        pest_pressure_features: _freezeGroup(
          hasScanHistory,
          'farroway_scan_history_v1',
        ),
        weather_risk_features: _freezeGroup(
          hasWeather,
          '__weatherRiskHealth / __farrowayLastWeather',
        ),
        task_completion_features: _freezeGroup(
          hasCachedTasks,
          'farroway_cached_tasks',
        ),
        outcome_features: _freezeGroup(hasOutcome, '__outcomeHealth'),
        buyer_trust_features: _freezeGroup(hasBuyerTrust, '__buyerTrustHealth'),
        ngo_program_features: _freezeGroup(hasNgo, '__ngoImpactHealth'),
      };

      const featureGroups = Object.freeze(groups);

      let readyCount = 0;
      const dataSources: string[] = [];
      for (const name of FEATURE_GROUP_NAMES) {
        const g = featureGroups[name];
        if (g && g.ready) {
          readyCount += 1;
          if (dataSources.indexOf(g.source) === -1) dataSources.push(g.source);
        }
      }

      const confidence: Confidence =
        readyCount === 0 ? 'low' : readyCount >= 6 ? 'high' : 'medium';

      const explanation =
        readyCount === 0
          ? 'Not enough data yet — no feature group has a real source on this device.'
          : 'Feature-store readiness reflects which feature groups have a real underlying data source available on this device. ' +
            String(readyCount) +
            ' of ' +
            String(TOTAL_GROUPS) +
            ' groups are ready. Features are computed from real records only — readiness does not include any computed feature values.';

      const limitations =
        'This map reports whether each feature group has a real source present on this device — it does not compute or expose any feature values, and a ready group still depends on enough underlying records. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: FEATURE_STORE_READINESS_VERSION,
        initialized: true,
        featureGroups,
        readyCount,
        totalGroups: TOTAL_GROUPS,
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as FeatureStoreReadinessEnvelope;
    },
    Object.freeze({
      runtimeVersion: FEATURE_STORE_READINESS_VERSION,
      initialized: true,
      featureGroups: Object.freeze({
        farmer_activity_features: _freezeGroup(false, 'farroway_event_log'),
        plant_health_features: _freezeGroup(false, 'farroway_scan_history_v1'),
        scan_quality_features: _freezeGroup(false, 'farroway_scan_history_v1'),
        disease_pressure_features: _freezeGroup(false, 'farroway_scan_history_v1'),
        pest_pressure_features: _freezeGroup(false, 'farroway_scan_history_v1'),
        weather_risk_features: _freezeGroup(
          false,
          '__weatherRiskHealth / __farrowayLastWeather',
        ),
        task_completion_features: _freezeGroup(false, 'farroway_cached_tasks'),
        outcome_features: _freezeGroup(false, '__outcomeHealth'),
        buyer_trust_features: _freezeGroup(false, '__buyerTrustHealth'),
        ngo_program_features: _freezeGroup(false, '__ngoImpactHealth'),
      }),
      readyCount: 0,
      totalGroups: TOTAL_GROUPS,
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation: 'Not enough data yet — no feature group has a real source on this device.',
      limitations:
        'This map reports whether each feature group has a real source present on this device — it does not compute or expose any feature values, and a ready group still depends on enough underlying records. ' +
        GUIDANCE_TAIL,
    }) as FeatureStoreReadinessEnvelope,
  );
}

export function installFeatureStoreHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__featureStoreHealth !== 'function') {
      w.__featureStoreHealth = function () {
        const out = featureStoreHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Feature Store Readiness]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
