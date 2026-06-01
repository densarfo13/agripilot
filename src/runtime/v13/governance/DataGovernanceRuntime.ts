/**
 * Farroway · Data Governance Runtime (data-governance-v13)
 *
 * Composition-only, self-contained readiness diagnostic.
 * It NEVER imports a project module. It reads ONLY real, live signals via
 * the `_probe()` (window-global health functions) and `_ls()` (localStorage)
 * helpers below, and never fabricates a readiness signal.
 *
 * It reports whether the data-governance posture of the platform is wired up:
 * org/tenant scoping, buyer privacy, field-officer scope, admin access logging,
 * consent checks, export privacy, anonymization, and retention policy.
 * An ABSENT probe is treated as NOT ready (honest, never assumed).
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

export const DATA_GOVERNANCE_RUNTIME_VERSION = 'data-governance-v13';

export interface DataGovernanceEnvelope {
  runtimeVersion: 'data-governance-v13';
  initialized: true;
  orgScopingReady: boolean;
  buyerPrivacyReady: boolean;
  fieldOfficerScopeReady: boolean;
  adminAccessLoggingReady: boolean;
  consentChecksReady: boolean;
  exportPrivacyReady: boolean;
  anonymizationReady: boolean;
  dataRetentionPolicyReady: boolean;
  verdict: 'READY' | 'PARTIAL' | 'NOT_READY';
  blockers: string[];
  warnings: string[];
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

// A probe is "good" only if it actually reports a healthy/ready posture.
// We read defensively across the common shapes a health envelope may expose.
function _probeGood(p: any): boolean {
  const o = _obj(p);
  if (!o) return false;
  return _safe(() => {
    if (o.ready === true) return true;
    if (o.initialized === true && o.ready !== false) return true;
    if (o.verdict === 'GOOD') return true;
    if (o.verdict === 'READY') return true;
    if (o.crossTenantLeakage === false) return true;
    return false;
  }, false);
}

// As above, but also requires a specific sub-flag to be explicitly true.
function _probeGoodWith(p: any, flag: string): boolean {
  const o = _obj(p);
  if (!o) return false;
  return _safe(() => o[flag] === true && _probeGood(o), false);
}

export function dataGovernanceHealth(): DataGovernanceEnvelope {
  return _safe(
    () => {
      // --- live probes (any may be null/absent) ---
      const tenantIsolation = _probe('__tenantIsolationHealth');
      const buyerTrust = _probe('__buyerTrustHealth');
      const fieldOfficer = _probe('__fieldOfficerHealth');
      const audit = _probe('__auditHealth');
      const consent = _probe('__consentHealth');
      const analyticsExport = _probe('__analyticsExportHealth');
      const warehouse = _probe('__warehouseHealth');
      const retention = _probe('__retentionHealth');
      const backup = _probe('__backupHealth');

      // --- readiness flags (absent probe is NOT ready) ---
      const orgScopingReady = _probeGood(tenantIsolation);
      const buyerPrivacyReady = _probeGood(buyerTrust);
      const fieldOfficerScopeReady = _probeGood(fieldOfficer);
      const adminAccessLoggingReady = _probeGood(audit);
      const consentChecksReady = _probeGood(consent);
      const exportPrivacyReady = _probeGoodWith(analyticsExport, 'privacyFiltered');
      const anonymizationReady = _probeGoodWith(warehouse, 'anonymizationReady');
      const dataRetentionPolicyReady =
        _probeGood(retention) || _probeGood(backup);

      // --- critical vs non-critical gates ---
      const criticalReady =
        orgScopingReady &&
        buyerPrivacyReady &&
        adminAccessLoggingReady &&
        exportPrivacyReady;

      const blockers: string[] = [];
      if (!orgScopingReady)
        blockers.push('Org/tenant scoping not verified — cross-tenant isolation health is missing or not ready.');
      if (!buyerPrivacyReady)
        blockers.push('Buyer privacy not verified — buyer-trust health is missing or not ready.');
      if (!adminAccessLoggingReady)
        blockers.push('Admin access logging not verified — audit health is missing or not ready.');
      if (!exportPrivacyReady)
        blockers.push('Export privacy not verified — analytics export is not confirmed privacy-filtered.');

      const warnings: string[] = [];
      if (!fieldOfficerScopeReady)
        warnings.push('Field-officer scoping not verified — field-officer health is missing or not ready.');
      if (!consentChecksReady)
        warnings.push('Consent checks not verified — consent health is missing or not ready.');
      if (!anonymizationReady)
        warnings.push('Anonymization not verified — warehouse anonymization is not confirmed ready.');
      if (!dataRetentionPolicyReady)
        warnings.push('Data-retention policy not verified — neither retention nor backup health reports ready.');

      let verdict: 'READY' | 'PARTIAL' | 'NOT_READY';
      if (criticalReady) {
        verdict = 'READY';
      } else if (blockers.length >= 3) {
        verdict = 'NOT_READY';
      } else {
        verdict = 'PARTIAL';
      }

      // confidence is a LABEL, never a number.
      // High only when every governance signal is wired and ready.
      const allReady =
        orgScopingReady &&
        buyerPrivacyReady &&
        fieldOfficerScopeReady &&
        adminAccessLoggingReady &&
        consentChecksReady &&
        exportPrivacyReady &&
        anonymizationReady &&
        dataRetentionPolicyReady;

      let confidence: Confidence;
      if (allReady) confidence = 'high';
      else if (criticalReady) confidence = 'medium';
      else confidence = 'low';

      const explanation = criticalReady
        ? 'All critical data-governance signals (org scoping, buyer privacy, admin access logging, export privacy) are wired and reporting ready; remaining items are advisory.'
        : blockers.length > 0
          ? 'One or more critical data-governance signals are missing or not ready. Governance is not yet confirmed for release. Resolve the listed blockers to advance.'
          : 'Not enough data yet — governance health signals are not yet wired up on this device.';

      const limitations =
        'Reflects only the governance health signals currently exposed on this device; an absent signal is treated as not ready, never assumed. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: 'data-governance-v13',
        initialized: true as const,
        orgScopingReady,
        buyerPrivacyReady,
        fieldOfficerScopeReady,
        adminAccessLoggingReady,
        consentChecksReady,
        exportPrivacyReady,
        anonymizationReady,
        dataRetentionPolicyReady,
        verdict,
        blockers: Object.freeze(blockers) as unknown as string[],
        warnings: Object.freeze(warnings) as unknown as string[],
        confidence,
        explanation,
        limitations,
      }) as DataGovernanceEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: 'data-governance-v13',
      initialized: true as const,
      orgScopingReady: false,
      buyerPrivacyReady: false,
      fieldOfficerScopeReady: false,
      adminAccessLoggingReady: false,
      consentChecksReady: false,
      exportPrivacyReady: false,
      anonymizationReady: false,
      dataRetentionPolicyReady: false,
      verdict: 'NOT_READY' as const,
      blockers: Object.freeze([
        'Org/tenant scoping not verified — cross-tenant isolation health is missing or not ready.',
        'Buyer privacy not verified — buyer-trust health is missing or not ready.',
        'Admin access logging not verified — audit health is missing or not ready.',
        'Export privacy not verified — analytics export is not confirmed privacy-filtered.',
      ]) as unknown as string[],
      warnings: Object.freeze([]) as unknown as string[],
      confidence: 'low' as Confidence,
      explanation:
        'Not enough data yet — governance health signals are not yet wired up on this device.',
      limitations:
        'Reflects only the governance health signals currently exposed on this device; an absent signal is treated as not ready, never assumed. ' +
        GUIDANCE_TAIL,
    }) as DataGovernanceEnvelope,
  );
}

export function installDataGovernanceHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__v13GovernanceHealth !== 'function') {
      w.__v13GovernanceHealth = function () {
        const out = dataGovernanceHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Data Governance]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
