/**
 * Farroway · Institutional Readiness Engine (institutional-readiness-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real runtime signals via
 * the `_probe()` helper below, and never fabricates a "ready" status.
 *
 * A check is reported READY only if its real probe is present AND that probe
 * reports a ready/initialized/true signal. An absent probe is NEVER a fake
 * pass: it becomes a WARNING for non-critical checks, or a BLOCKER for the
 * critical ones. The institutional verdict is honest and gated on
 * persistence + audit + tenant-isolation + role-based access.
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

type Verdict =
  | 'PILOT_READY'
  | 'PROGRAM_READY'
  | 'INSTITUTIONAL_READY'
  | 'NOT_READY';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

/**
 * Honest readiness test for a probe result.
 * Returns true ONLY when the probe object is present and carries a real
 * positive signal. A null/absent probe is never "ready". Never throws.
 */
function _isReady(probe: any): boolean {
  return _safe(() => {
    const o = _obj(probe);
    if (!o) return false;

    // Explicit negative signals always win.
    if (o.ready === false) return false;
    if (o.initialized === false) return false;
    if (o.ok === false) return false;
    if (o.healthy === false) return false;
    if (o.enabled === false) return false;

    // Common positive boolean shapes.
    if (o.ready === true) return true;
    if (o.initialized === true) return true;
    if (o.ok === true) return true;
    if (o.healthy === true) return true;
    if (o.enabled === true) return true;

    // Verdict / status string shapes (accept clearly-good values only).
    const verdict = o.verdict ?? o.status ?? o.state ?? null;
    if (verdict != null) {
      const v = String(verdict).toUpperCase();
      if (
        v === 'GOOD' ||
        v === 'READY' ||
        v === 'OK' ||
        v === 'HEALTHY' ||
        v === 'PASS' ||
        v === 'GREEN' ||
        v === 'ACTIVE'
      ) {
        return true;
      }
    }

    return false;
  }, false);
}

interface ReadinessChecks {
  multiTenantIsolation: boolean;
  auditLogs: boolean;
  eventArtifacts: boolean;
  roleBasedAccess: boolean;
  persistenceMode: boolean;
  offlineSync: boolean;
  dataExportReadiness: boolean;
  complianceNotes: boolean;
  monitoring: boolean;
  backupReadiness: boolean;
}

export interface InstitutionalReadinessEnvelope {
  runtimeVersion: 'institutional-readiness-v1';
  initialized: true;
  checks: ReadinessChecks;
  value: { verdict: Verdict };
  verdict: Verdict;
  blockers: string[];
  warnings: string[];
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

export const INSTITUTIONAL_READINESS_ENGINE_VERSION =
  'institutional-readiness-v1';

export function institutionalReadinessHealth(): InstitutionalReadinessEnvelope {
  return _safe(
    () => {
      // --- real runtime probes (any of these may be null/absent) ---
      const tenantProbe = _probe('__tenantIsolationHealth');
      const auditProbe = _probe('__auditHealth');
      const artifactProbe = _probe('__artifactHealth');
      const rbacProbe = _probe('__rbacHealth') || _probe('__roleHealth');
      const persistenceProbe = _probe('__persistenceHealth');
      const offlineProbe =
        _probe('__offlineValidationHealth') || _probe('__syncHealth');
      const exportProbe = _probe('__reportHealth');
      const complianceProbe = _probe('__consentHealth');
      const monitoringProbe = _probe('__monitoringHealth');
      const backupProbe = _probe('__backupHealth');

      // --- presence (probe actually exists) vs readiness (probe says ready) ---
      const present = {
        multiTenantIsolation: _obj(tenantProbe) != null,
        auditLogs: _obj(auditProbe) != null,
        eventArtifacts: _obj(artifactProbe) != null,
        roleBasedAccess: _obj(rbacProbe) != null,
        persistenceMode: _obj(persistenceProbe) != null,
        offlineSync: _obj(offlineProbe) != null,
        dataExportReadiness: _obj(exportProbe) != null,
        complianceNotes: _obj(complianceProbe) != null,
        monitoring: _obj(monitoringProbe) != null,
        backupReadiness: _obj(backupProbe) != null,
      };

      const checks: ReadinessChecks = {
        multiTenantIsolation: _isReady(tenantProbe),
        auditLogs: _isReady(auditProbe),
        eventArtifacts: _isReady(artifactProbe),
        roleBasedAccess: _isReady(rbacProbe),
        persistenceMode: _isReady(persistenceProbe),
        offlineSync: _isReady(offlineProbe),
        dataExportReadiness: _isReady(exportProbe),
        complianceNotes: _isReady(complianceProbe),
        monitoring: _isReady(monitoringProbe),
        backupReadiness: _isReady(backupProbe),
      };

      // --- human-readable labels for messaging ---
      const labels: Record<keyof ReadinessChecks, string> = {
        multiTenantIsolation: 'Multi-tenant isolation',
        auditLogs: 'Audit logs',
        eventArtifacts: 'Event artifacts',
        roleBasedAccess: 'Role-based access',
        persistenceMode: 'Persistence mode',
        offlineSync: 'Offline sync',
        dataExportReadiness: 'Data export readiness',
        complianceNotes: 'Compliance notes',
        monitoring: 'Monitoring',
        backupReadiness: 'Backup readiness',
      };

      // --- critical set gates the verdict ---
      const criticalKeys: (keyof ReadinessChecks)[] = [
        'multiTenantIsolation',
        'auditLogs',
        'roleBasedAccess',
        'persistenceMode',
      ];

      const allKeys = Object.keys(checks) as (keyof ReadinessChecks)[];

      // blockers = critical checks not ready; warnings = non-critical not ready.
      const blockers: string[] = [];
      const warnings: string[] = [];
      for (let i = 0; i < allKeys.length; i++) {
        const k = allKeys[i];
        if (checks[k]) continue;
        if (criticalKeys.indexOf(k) >= 0) {
          blockers.push(labels[k]);
        } else {
          warnings.push(labels[k]);
        }
      }

      const totalReady = allKeys.reduce(
        (n, k) => n + (checks[k] ? 1 : 0),
        0,
      );

      const criticalsReady = criticalKeys.every((k) => checks[k]);

      // --- honest verdict logic (persistence/audit/isolation/RBAC gated) ---
      let verdict: Verdict;
      if (!criticalsReady || totalReady === 0) {
        // Any critical not ready (or nothing ready at all) blocks everything.
        verdict = 'NOT_READY';
      } else if (totalReady >= 10) {
        verdict = 'INSTITUTIONAL_READY';
      } else if (totalReady >= 7) {
        verdict = 'PROGRAM_READY';
      } else {
        verdict = 'PILOT_READY';
      }

      // --- confidence scales with how many probes were actually PRESENT ---
      // (presence of real signal, not merely a true value we can't trust).
      const presentCount = allKeys.reduce(
        (n, k) => n + (present[k] ? 1 : 0),
        0,
      );
      let confidence: Confidence = 'low';
      if (presentCount >= 8) {
        confidence = 'high';
      } else if (presentCount >= 4) {
        confidence = 'medium';
      }

      // --- honest data sources (only probes we actually observed) ---
      const dataSources: string[] = [];
      if (present.multiTenantIsolation) dataSources.push('__tenantIsolationHealth');
      if (present.auditLogs) dataSources.push('__auditHealth');
      if (present.eventArtifacts) dataSources.push('__artifactHealth');
      if (present.roleBasedAccess) dataSources.push('__rbacHealth/__roleHealth');
      if (present.persistenceMode) dataSources.push('__persistenceHealth');
      if (present.offlineSync) {
        dataSources.push('__offlineValidationHealth/__syncHealth');
      }
      if (present.dataExportReadiness) dataSources.push('__reportHealth');
      if (present.complianceNotes) dataSources.push('__consentHealth');
      if (present.monitoring) dataSources.push('__monitoringHealth');
      if (present.backupReadiness) dataSources.push('__backupHealth');

      // --- explanation (honest, count-based) ---
      const explanation = _safe(() => {
        const bits: string[] = [];
        bits.push(
          'Readiness verdict: ' +
            verdict +
            '. ' +
            totalReady +
            ' of ' +
            allKeys.length +
            ' checks report ready, from ' +
            presentCount +
            ' probe(s) actually present.',
        );
        if (blockers.length > 0) {
          bits.push(
            'Critical gaps blocking institutional readiness: ' +
              blockers.join(', ') +
              '.',
          );
        } else {
          bits.push('All critical checks (isolation, audit, access, persistence) are ready.');
        }
        if (warnings.length > 0) {
          bits.push('Non-critical gaps: ' + warnings.join(', ') + '.');
        }
        return bits.join(' ');
      }, 'Readiness verdict: ' + verdict + '.');

      // --- limitations (constant, honest) ---
      const limitations =
        'This readiness check reflects only the runtime signals present on this ' +
        'device right now. Probes that are absent are treated as not-ready, not as ' +
        'passing. A favorable verdict does not certify legal, security, or ' +
        'regulatory compliance and does not replace a formal audit. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: 'institutional-readiness-v1',
        initialized: true as const,
        checks: Object.freeze(checks) as ReadinessChecks,
        value: Object.freeze({ verdict }) as { verdict: Verdict },
        verdict,
        blockers: Object.freeze(blockers) as unknown as string[],
        warnings: Object.freeze(warnings) as unknown as string[],
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as InstitutionalReadinessEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: 'institutional-readiness-v1',
      initialized: true as const,
      checks: Object.freeze({
        multiTenantIsolation: false,
        auditLogs: false,
        eventArtifacts: false,
        roleBasedAccess: false,
        persistenceMode: false,
        offlineSync: false,
        dataExportReadiness: false,
        complianceNotes: false,
        monitoring: false,
        backupReadiness: false,
      }) as ReadinessChecks,
      value: Object.freeze({ verdict: 'NOT_READY' as Verdict }) as {
        verdict: Verdict;
      },
      verdict: 'NOT_READY' as Verdict,
      blockers: Object.freeze([
        'Multi-tenant isolation',
        'Audit logs',
        'Role-based access',
        'Persistence mode',
      ]) as unknown as string[],
      warnings: Object.freeze([]) as unknown as string[],
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        'Readiness could not be evaluated; treating all checks as not-ready.',
      limitations:
        'This readiness check reflects only the runtime signals present on this ' +
        'device right now. Absent probes are treated as not-ready, never as ' +
        'passing. ' +
        GUIDANCE_TAIL,
    }) as InstitutionalReadinessEnvelope,
  );
}

export function installInstitutionalReadinessHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__institutionalReadinessHealth !== 'function') {
      w.__institutionalReadinessHealth = function () {
        const out = institutionalReadinessHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Institutional Readiness]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
