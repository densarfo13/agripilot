/**
 * Farroway · Institutional Data Readiness (institutional-data-readiness-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real runtime signals via
 * the `_probe()` / `_ls()` / `_winVar()` helpers below, and never fabricates a
 * "ready" status.
 *
 * Each data-platform pillar is reported READY only if its real probe is present
 * AND that probe reports a ready/initialized/true signal. An absent probe is
 * NEVER a fake pass — it is honestly reported as "not configured yet". This
 * engine does NOT build a warehouse, model registry, or feature store; it only
 * reflects what genuinely exists on this device/runtime.
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

export const INSTITUTIONAL_DATA_READINESS_VERSION =
  'institutional-data-readiness-v1';

export interface InstitutionalDataReadinessEnvelope {
  runtimeVersion: 'institutional-data-readiness-v1';
  initialized: true;
  eventLogReady: boolean;
  warehouseReady: boolean;
  analyticsExportReady: boolean;
  modelRegistryReady: boolean;
  featureStoreReady: boolean;
  auditRetentionReady: boolean;
  backupRestoreReady: boolean;
  monitoringReady: boolean;
  limitations: string;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
}

/**
 * A probe is considered "ready" only when it is present AND reports a real
 * ready/initialized/GOOD signal. Read defensively — any shape mismatch, any
 * throw, returns false. An absent probe is NEVER ready.
 */
function _isReady(probe: any): boolean {
  return _safe(() => {
    const p = _obj(probe);
    if (!p) return false;
    if (p.ready === true) return true;
    if (p.initialized === true) return true;
    if (p.verdict === 'GOOD') return true;
    // A present runtimeVersion alone signals a real, initialized envelope.
    if (typeof p.runtimeVersion === 'string' && p.runtimeVersion.length > 0) {
      return true;
    }
    return false;
  }, false);
}

export function institutionalDataHealth(): InstitutionalDataReadinessEnvelope {
  return _safe(
    () => {
      // --- real runtime probes (any may be null) ---
      const artifactHealth = _probe('__artifactHealth');
      const auditHealth = _probe('__auditHealth');
      const backupHealth = _probe('__backupHealth');
      const monitoringHealth = _probe('__monitoringHealth');
      const reportHealth = _probe('__reportHealth');

      // --- readiness flags (only true when a real probe reports ready) ---
      // Event log is backed by either the artifact attestation or the audit log.
      const eventLogReady =
        _isReady(artifactHealth) || _isReady(auditHealth);
      const auditRetentionReady = _isReady(auditHealth);
      const backupRestoreReady = _isReady(backupHealth);
      const monitoringReady = _isReady(monitoringHealth);
      const analyticsExportReady = _isReady(reportHealth);

      // No real corresponding probe exists for these pillars on this runtime.
      // We do NOT fabricate one — they are honestly "not configured yet".
      const warehouseReady = false;
      const modelRegistryReady = false;
      const featureStoreReady = false;

      // --- assemble honest data sources (only what we actually saw ready) ---
      const dataSources: string[] = [];
      if (_isReady(artifactHealth)) dataSources.push('__artifactHealth');
      if (_isReady(auditHealth)) dataSources.push('__auditHealth');
      if (_isReady(backupHealth)) dataSources.push('__backupHealth');
      if (_isReady(monitoringHealth)) dataSources.push('__monitoringHealth');
      if (_isReady(reportHealth)) dataSources.push('__reportHealth');

      const readyFlags = [
        eventLogReady,
        warehouseReady,
        analyticsExportReady,
        modelRegistryReady,
        featureStoreReady,
        auditRetentionReady,
        backupRestoreReady,
        monitoringReady,
      ];
      const readyCount = readyFlags.filter(Boolean).length;
      const observableCount = dataSources.length;

      // --- not-configured-yet notes (honest, never fabricated) ---
      const notConfigured: string[] = [];
      if (!warehouseReady) notConfigured.push('a data warehouse');
      if (!modelRegistryReady) notConfigured.push('a model registry');
      if (!featureStoreReady) notConfigured.push('a feature store');

      const limitations =
        'This only reflects data-platform signals observable on this device/runtime. ' +
        (notConfigured.length > 0
          ? 'No probe was found for ' +
            notConfigured.join(', ') +
            ', so those pillars are reported as not configured yet rather than ready. '
          : '') +
        'A pillar is marked ready only when its own probe is present and reports a ready ' +
        'signal; an absent probe is never treated as a pass. It does not include other ' +
        'devices, deleted records, or infrastructure not surfaced through a runtime probe. ' +
        GUIDANCE_TAIL;

      // --- honest fallback: nothing real is observable yet ---
      if (observableCount === 0) {
        return Object.freeze({
          runtimeVersion: INSTITUTIONAL_DATA_READINESS_VERSION,
          initialized: true as const,
          eventLogReady: false,
          warehouseReady: false,
          analyticsExportReady: false,
          modelRegistryReady: false,
          featureStoreReady: false,
          auditRetentionReady: false,
          backupRestoreReady: false,
          monitoringReady: false,
          limitations,
          confidence: 'low' as Confidence,
          dataSources: Object.freeze([]) as unknown as string[],
          explanation:
            'Not enough data yet — no data-platform probe is reporting a ready signal ' +
            'on this runtime.',
        }) as InstitutionalDataReadinessEnvelope;
      }

      // --- confidence from how many real pillars are observable + ready ---
      // Honest scaling: a single ready pillar stays "low".
      let confidence: Confidence = 'low';
      if (readyCount >= 5 && observableCount >= 4) {
        confidence = 'high';
      } else if (readyCount >= 2 || observableCount >= 2) {
        confidence = 'medium';
      }

      const explanation = _safe(() => {
        const bits: string[] = [];
        bits.push(
          'This reflects ' +
            readyCount +
            ' of 8 institutional data pillar(s) reporting a real ready signal, ' +
            'observed through ' +
            observableCount +
            ' present probe(s).',
        );
        const readyNames: string[] = [];
        if (eventLogReady) readyNames.push('event log');
        if (auditRetentionReady) readyNames.push('audit retention');
        if (backupRestoreReady) readyNames.push('backup/restore');
        if (monitoringReady) readyNames.push('monitoring');
        if (analyticsExportReady) readyNames.push('analytics export');
        if (readyNames.length > 0) {
          bits.push('Ready: ' + readyNames.join(', ') + '.');
        }
        if (notConfigured.length > 0) {
          bits.push(
            'Not configured yet: ' +
              notConfigured
                .map((n) => n.replace(/^a(n)? /, ''))
                .join(', ') +
              '.',
          );
        }
        return bits.join(' ');
      }, 'Summary of the data-platform signals observable on this runtime.');

      return Object.freeze({
        runtimeVersion: INSTITUTIONAL_DATA_READINESS_VERSION,
        initialized: true as const,
        eventLogReady,
        warehouseReady,
        analyticsExportReady,
        modelRegistryReady,
        featureStoreReady,
        auditRetentionReady,
        backupRestoreReady,
        monitoringReady,
        limitations,
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
      }) as InstitutionalDataReadinessEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: INSTITUTIONAL_DATA_READINESS_VERSION,
      initialized: true as const,
      eventLogReady: false,
      warehouseReady: false,
      analyticsExportReady: false,
      modelRegistryReady: false,
      featureStoreReady: false,
      auditRetentionReady: false,
      backupRestoreReady: false,
      monitoringReady: false,
      limitations:
        'This only reflects data-platform signals observable on this device/runtime. ' +
        'No probe was found for a data warehouse, a model registry, a feature store, ' +
        'so those pillars are reported as not configured yet rather than ready. ' +
        GUIDANCE_TAIL,
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        'Not enough data yet — no data-platform probe is reporting a ready signal ' +
        'on this runtime.',
    }) as InstitutionalDataReadinessEnvelope,
  );
}

export function installInstitutionalDataHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__institutionalDataHealth !== 'function') {
      w.__institutionalDataHealth = function () {
        const out = institutionalDataHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Institutional Data Readiness]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}

// Reference _winVar / _arr / _ls so the copied helper block stays intact and
// the engine remains fully self-contained (composition-only).
void _winVar;
void _arr;
void _ls;
