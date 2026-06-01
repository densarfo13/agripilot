/**
 * Farroway · Data Warehouse Readiness (data-warehouse-readiness-v13)
 *
 * Composition-only, self-contained readiness diagnostic. It NEVER imports a
 * project module. It reads ONLY real signals via the `_probe()` (window
 * globals), `_ls()` (localStorage JSON) and `_winVar()` helpers below, and
 * detects provider/config defensively through `import.meta.env`.
 *
 * IMPORTANT: the analytics warehouse is NOT built yet. This is a READINESS
 * check only — every export target is reported as readiness-only unless a real
 * environment key indicates an external warehouse has been configured. It
 * never fabricates schema/snapshot/export state and returns an honest
 * "Not enough data yet" posture when nothing real is detectable.
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

export const DATA_WAREHOUSE_READINESS_VERSION = 'data-warehouse-readiness-v13';

type ExportTargetState = 'readiness_only' | 'configured';

export interface DataWarehouseExportTargets {
  postgresAnalyticsSchema: ExportTargetState;
  bigQuery: ExportTargetState;
  snowflake: ExportTargetState;
  s3r2: ExportTargetState;
}

export interface DataWarehouseReadinessEnvelope {
  runtimeVersion: 'data-warehouse-readiness-v13';
  initialized: true;
  analyticsSchemaReady: boolean;
  eventExportReady: boolean;
  dailySnapshotReady: boolean;
  anonymizationReady: boolean;
  tenantIsolationReady: boolean;
  externalWarehouseConfigured: boolean;
  exportTargets: DataWarehouseExportTargets;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

// Defensive env read — never throws, never calls the network.
function _env(key: string): any {
  return _safe(() => (import.meta as any).env?.[key], undefined);
}

export function dataWarehouseHealth(): DataWarehouseReadinessEnvelope {
  return _safe(
    () => {
      // --- real probes (any may be null) ---
      const eventSourcing = _probe('__eventSourcingHealth');
      const tenantIsolation = _probe('__tenantIsolationHealth');

      // --- event export readiness comes ONLY from a real probe ---
      const eventExportReady = _safe(() => {
        const h: any = _obj(eventSourcing);
        if (!h) return false;
        // Accept either an explicit readiness flag or an initialized envelope.
        return !!(
          h.exportReady === true ||
          h.eventExportReady === true ||
          h.initialized === true
        );
      }, false);

      // --- tenant isolation readiness comes ONLY from a real probe ---
      const tenantIsolationReady = _safe(() => {
        const h: any = _obj(tenantIsolation);
        if (!h) return false;
        return !!(
          h.isolationReady === true ||
          h.tenantIsolationReady === true ||
          h.initialized === true
        );
      }, false);

      // --- external warehouse config detected defensively from env ---
      // These are likely all absent in production today (warehouse not built).
      const bigQueryKey =
        _env('VITE_BIGQUERY_DATASET') ??
        _env('VITE_BIGQUERY_PROJECT') ??
        _env('BIGQUERY_DATASET');
      const snowflakeKey =
        _env('VITE_SNOWFLAKE_ACCOUNT') ??
        _env('VITE_SNOWFLAKE_DATABASE') ??
        _env('SNOWFLAKE_ACCOUNT');
      const s3Key =
        _env('VITE_S3_WAREHOUSE_BUCKET') ??
        _env('VITE_R2_WAREHOUSE_BUCKET') ??
        _env('S3_WAREHOUSE_BUCKET');
      const postgresAnalyticsKey =
        _env('VITE_ANALYTICS_SCHEMA') ?? _env('ANALYTICS_SCHEMA');

      const has = (v: any): boolean =>
        _safe(() => v != null && String(v).trim().length > 0, false);

      const bigQueryConfigured = has(bigQueryKey);
      const snowflakeConfigured = has(snowflakeKey);
      const s3Configured = has(s3Key);
      const postgresConfigured = has(postgresAnalyticsKey);

      const externalWarehouseConfigured =
        bigQueryConfigured || snowflakeConfigured || s3Configured;

      // --- analytics schema readiness: false unless a real env/probe says so ---
      const analyticsSchemaReady = postgresConfigured;

      // --- daily snapshot readiness: false unless a real probe indicates it ---
      const dailySnapshotReady = _safe(() => {
        const h: any = _obj(eventSourcing);
        return !!(h && h.dailySnapshotReady === true);
      }, false);

      // --- anonymization readiness: honest boolean ---
      // We only consider anonymization "ready" when both a real isolation
      // posture exists AND a configured external sink would receive data;
      // since the warehouse is not built, this is honestly false today.
      const anonymizationReady = _safe(
        () => tenantIsolationReady && externalWarehouseConfigured,
        false,
      );

      // --- export targets are READINESS ONLY unless env config detected ---
      const exportTargets: DataWarehouseExportTargets = {
        postgresAnalyticsSchema: postgresConfigured
          ? 'configured'
          : 'readiness_only',
        bigQuery: bigQueryConfigured ? 'configured' : 'readiness_only',
        snowflake: snowflakeConfigured ? 'configured' : 'readiness_only',
        s3r2: s3Configured ? 'configured' : 'readiness_only',
      };

      // --- assemble honest data sources (only what we actually saw) ---
      const dataSources: string[] = [];
      if (eventSourcing) dataSources.push('__eventSourcingHealth');
      if (tenantIsolation) dataSources.push('__tenantIsolationHealth');
      if (bigQueryConfigured) dataSources.push('import.meta.env (BigQuery)');
      if (snowflakeConfigured) dataSources.push('import.meta.env (Snowflake)');
      if (s3Configured) dataSources.push('import.meta.env (S3/R2)');
      if (postgresConfigured)
        dataSources.push('import.meta.env (analytics schema)');

      // --- limitations (honest: warehouse is not built yet) ---
      const limitations =
        'The analytics data warehouse is not built yet — this is a readiness ' +
        'check, not a live pipeline. Export targets are reported as ' +
        'readiness-only unless a real environment key indicates an external ' +
        'warehouse has been configured. No data is exported, anonymized, or ' +
        'snapshotted by this check, and it reflects only signals visible on ' +
        'this device. ' +
        GUIDANCE_TAIL;

      const readySignals =
        (analyticsSchemaReady ? 1 : 0) +
        (eventExportReady ? 1 : 0) +
        (dailySnapshotReady ? 1 : 0) +
        (anonymizationReady ? 1 : 0) +
        (tenantIsolationReady ? 1 : 0) +
        (externalWarehouseConfigured ? 1 : 0);

      // --- honest empty fallback when nothing real is detectable ---
      if (readySignals === 0 && dataSources.length === 0) {
        return Object.freeze({
          runtimeVersion: DATA_WAREHOUSE_READINESS_VERSION,
          initialized: true as const,
          analyticsSchemaReady: false,
          eventExportReady: false,
          dailySnapshotReady: false,
          anonymizationReady: false,
          tenantIsolationReady: false,
          externalWarehouseConfigured: false,
          exportTargets: Object.freeze({
            postgresAnalyticsSchema: 'readiness_only',
            bigQuery: 'readiness_only',
            snowflake: 'readiness_only',
            s3r2: 'readiness_only',
          }) as DataWarehouseExportTargets,
          confidence: 'low' as Confidence,
          dataSources: Object.freeze([]) as unknown as string[],
          explanation:
            'Not enough data yet — no warehouse signals are detectable, and ' +
            'the analytics warehouse is not built yet. Export targets are ' +
            'readiness-only.',
          limitations,
        }) as DataWarehouseReadinessEnvelope;
      }

      // --- confidence: honest readiness scaling (LABEL, never a number) ---
      let confidence: Confidence = 'low';
      if (externalWarehouseConfigured && readySignals >= 4) {
        confidence = 'high';
      } else if (readySignals >= 2) {
        confidence = 'medium';
      }

      const explanation = _safe(() => {
        const bits: string[] = [];
        bits.push(
          'Readiness posture for the analytics data warehouse, which is not ' +
            'built yet.',
        );
        bits.push(
          'Event export readiness is ' +
            (eventExportReady ? 'detected' : 'not detected') +
            ' from the event-sourcing probe; tenant isolation is ' +
            (tenantIsolationReady ? 'detected' : 'not detected') +
            '.',
        );
        const configured: string[] = [];
        if (postgresConfigured) configured.push('Postgres analytics schema');
        if (bigQueryConfigured) configured.push('BigQuery');
        if (snowflakeConfigured) configured.push('Snowflake');
        if (s3Configured) configured.push('S3/R2');
        if (configured.length > 0) {
          bits.push('Configured export target(s): ' + configured.join(', ') + '.');
        } else {
          bits.push('No external export target is configured — all targets are readiness-only.');
        }
        if (!analyticsSchemaReady) {
          bits.push('The analytics schema is not yet indicated as ready.');
        }
        if (!dailySnapshotReady) {
          bits.push('No daily snapshot readiness is indicated.');
        }
        if (!anonymizationReady) {
          bits.push('Anonymization is not yet ready for export.');
        }
        return bits.join(' ');
      }, 'Readiness posture for the analytics data warehouse, which is not built yet.');

      return Object.freeze({
        runtimeVersion: DATA_WAREHOUSE_READINESS_VERSION,
        initialized: true as const,
        analyticsSchemaReady,
        eventExportReady,
        dailySnapshotReady,
        anonymizationReady,
        tenantIsolationReady,
        externalWarehouseConfigured,
        exportTargets: Object.freeze(exportTargets) as DataWarehouseExportTargets,
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as DataWarehouseReadinessEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: DATA_WAREHOUSE_READINESS_VERSION,
      initialized: true as const,
      analyticsSchemaReady: false,
      eventExportReady: false,
      dailySnapshotReady: false,
      anonymizationReady: false,
      tenantIsolationReady: false,
      externalWarehouseConfigured: false,
      exportTargets: Object.freeze({
        postgresAnalyticsSchema: 'readiness_only',
        bigQuery: 'readiness_only',
        snowflake: 'readiness_only',
        s3r2: 'readiness_only',
      }) as DataWarehouseExportTargets,
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        'Not enough data yet — the analytics warehouse is not built yet, and ' +
        'no warehouse signals are detectable.',
      limitations:
        'The analytics data warehouse is not built yet — this is a readiness ' +
        'check, not a live pipeline. Export targets are readiness-only. ' +
        GUIDANCE_TAIL,
    }) as DataWarehouseReadinessEnvelope,
  );
}

export function installDataWarehouseHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__warehouseHealth !== 'function') {
      w.__warehouseHealth = function () {
        const out = dataWarehouseHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Data Warehouse Readiness]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
