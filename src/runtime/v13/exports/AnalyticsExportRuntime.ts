/**
 * Farroway · Analytics Export Runtime (analytics-export-v13)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real live state via
 * the `_probe()` and `_ls()` helpers below, and never fabricates data.
 *
 * Purpose: describe which organization-scoped, privacy-filtered analytics
 * exports are ready to generate (NGO program, farmer activity, outcome,
 * regional risk, buyer trust, audit), in CSV / JSON. Every export is
 * organization-scoped, privacy-filtered, and audited on creation.
 *
 * Privacy: the Buyer trust report exposes ONLY coarse trust signals,
 * never PII or scan detail. No PII field ever appears as an output key.
 * When a source is absent the corresponding report is honestly NOT ready.
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

const FORMATS = Object.freeze(['CSV', 'JSON'] as const);

export const ANALYTICS_EXPORT_RUNTIME_VERSION = 'analytics-export-v13' as const;

export interface AnalyticsExportType {
  name: string;
  formats: readonly ['CSV', 'JSON'];
  organizationScoped: true;
  privacyFiltered: true;
  ready: boolean;
}

export interface AnalyticsExportEnvelope {
  runtimeVersion: 'analytics-export-v13';
  initialized: true;
  exportTypes: ReadonlyArray<AnalyticsExportType>;
  organizationScoped: true;
  privacyFiltered: true;
  auditOnExport: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _ready(v: any): boolean {
  // A source is "ready" only if a probe / store actually returned object/array data.
  const o = _obj(v);
  if (o) return true;
  return _arr(v).length > 0;
}

function _exportType(
  name: string,
  ready: boolean,
): AnalyticsExportType {
  return Object.freeze({
    name,
    formats: FORMATS,
    organizationScoped: true as const,
    privacyFiltered: true as const,
    ready: ready === true,
  }) as AnalyticsExportType;
}

export function analyticsExportHealth(): AnalyticsExportEnvelope {
  return _safe(
    () => {
      // --- real live sources (any of these may be absent) ---
      const ngoImpact = _probe('__ngoImpactHealth');
      const farmerActivity =
        _probe('__farmerActivityHealth') ?? _probe('__taskStoreHealth');
      const outcome =
        _probe('__outcomeHealth') ?? _probe('__outcomeLearningHealth');
      const regionalRisk =
        _probe('__regionalRiskHealth') ?? _probe('__regionalNetworkHealth');
      const buyerTrust =
        _probe('__buyerTrustHealth') ?? _probe('__trustHealth');
      const audit =
        _probe('__auditHealth') ?? _probe('__auditLogHealth');

      const ngoReady = _ready(ngoImpact);
      const farmerReady = _ready(farmerActivity);
      const outcomeReady = _ready(outcome);
      const regionalReady = _ready(regionalRisk);
      const buyerReady = _ready(buyerTrust);
      const auditReady = _ready(audit);

      const exportTypes = Object.freeze([
        _exportType('NGO program report', ngoReady),
        _exportType('Farmer activity report', farmerReady),
        _exportType('Outcome report', outcomeReady),
        _exportType('Regional risk report', regionalReady),
        _exportType('Buyer trust report', buyerReady),
        _exportType('Audit report', auditReady),
      ]) as ReadonlyArray<AnalyticsExportType>;

      const readyCount = exportTypes.filter((t) => t.ready).length;

      const confidence: Confidence =
        readyCount >= 4 ? 'high' : readyCount >= 1 ? 'medium' : 'low';

      const explanation =
        readyCount === 0
          ? 'Not enough data yet — no analytics sources are available to export. ' +
            'Reports become ready as their underlying organization data appears.'
          : readyCount +
            ' of ' +
            exportTypes.length +
            ' report types are ready to export (CSV or JSON). ' +
            'Each export is organization-scoped, privacy-filtered, and audited when created.';

      const limitations =
        'Exports are organization-scoped and privacy-filtered: buyer-facing reports ' +
        'expose only coarse trust signals, never personally identifiable information ' +
        'or individual scan detail. A report is only marked ready when its source ' +
        'data is actually present on this device, and every export is logged for audit. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: ANALYTICS_EXPORT_RUNTIME_VERSION,
        initialized: true as const,
        exportTypes,
        organizationScoped: true as const,
        privacyFiltered: true as const,
        auditOnExport: true as const,
        confidence,
        explanation,
        limitations,
      }) as AnalyticsExportEnvelope;
    },
    Object.freeze({
      runtimeVersion: ANALYTICS_EXPORT_RUNTIME_VERSION,
      initialized: true as const,
      exportTypes: Object.freeze([
        _exportType('NGO program report', false),
        _exportType('Farmer activity report', false),
        _exportType('Outcome report', false),
        _exportType('Regional risk report', false),
        _exportType('Buyer trust report', false),
        _exportType('Audit report', false),
      ]) as ReadonlyArray<AnalyticsExportType>,
      organizationScoped: true as const,
      privacyFiltered: true as const,
      auditOnExport: true as const,
      confidence: 'low' as Confidence,
      explanation:
        'Not enough data yet — no analytics sources are available to export.',
      limitations:
        'Exports are organization-scoped and privacy-filtered: buyer-facing reports ' +
        'expose only coarse trust signals, never personally identifiable information ' +
        'or individual scan detail. ' +
        GUIDANCE_TAIL,
    }) as AnalyticsExportEnvelope,
  );
}

export function installAnalyticsExportHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__analyticsExportHealth !== 'function') {
      w.__analyticsExportHealth = function () {
        const out = analyticsExportHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Analytics Export]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
