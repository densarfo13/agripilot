/**
 * Farroway · NGO Enterprise Engine (ngo-enterprise-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()`, `_ls()` and `_winVar()` helpers below, and never fabricates
 * any metric.
 *
 * It rolls up ORGANIZATION-SCOPED enterprise-program signals for an NGO
 * operator: cohorts / communities / villages reached, field-officer workload,
 * intervention progress, evidence completion, and the readiness of donor
 * reporting and the program risk map. Every number is derived from a real
 * org-scoped probe envelope or from device-local data; when a real source is
 * absent the field is 0 / "unknown" / "Not enough data yet" with an honest
 * note — never invented. There is no exact yield, revenue, or per-area
 * forecast anywhere in this engine.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * NO-CROSS-TENANT-LEAKAGE + NO-PII CONTRACT (gate-enforced)
 * ──────────────────────────────────────────────────────────────────────────
 * • This engine reads ONLY:
 *     (a) org-scoped probe envelopes already published on `window`
 *         (`__ngoIntelligenceHealth`, `__ngoImpactHealth`,
 *          `__fieldOfficerHealth`, `__programEvidenceHealth`,
 *          `__ngoCommandHealth`), each of which is the CURRENT tenant's own
 *         scope, and
 *     (b) device-local data for THIS device/session only
 *         (`farroway_event_log`).
 * • It NEVER reads another tenant's data, NEVER joins across organizations,
 *   and surfaces `organizationScoped: true` + `crossTenantLeakage: false`.
 * • It NEVER resolves or exposes PII: no farmer id, name, phone, email,
 *   latitude/longitude, household, or device id is read or emitted. Only
 *   aggregate counts, readiness labels, and coarse 'low'|'medium'|'high'
 *   labels cross the boundary. Cohort / community / village figures are
 *   read as already-aggregated counts off org-scoped probes — this engine
 *   does NOT enumerate or attach any individual identifier or coordinate.
 * • Pure, SSR-safe, never throws, every returned envelope is Object.freeze'd.
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
type Readiness = 'ready' | 'not_ready';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

const NOT_ENOUGH = 'Not enough data yet';

export const NGO_ENTERPRISE_ENGINE_VERSION = 'ngo-enterprise-v1';

export interface NGOEnterpriseEnvelope {
  runtimeVersion: 'ngo-enterprise-v1';
  initialized: true;
  organizationScoped: true;
  crossTenantLeakage: false;
  value: {
    cohorts: number | string;
    communities: number | string;
    villages: number | string;
    fieldOfficerWorkload: number | string;
    interventionProgress: string;
    evidenceCompletion: string;
    donorReportReadiness: Readiness;
    programRiskMapReadiness: Readiness;
  };
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

/**
 * Read a finite numeric aggregate out of one or more org-scoped probe
 * envelopes without ever touching PII. Tries the envelope root and a nested
 * `value` object only, across a small allow-list of aggregate field names.
 * Returns null if no real, finite numeric source is present (the caller then
 * reports honestly). Negative values are treated as absent.
 */
function _metricFrom(envelopes: any[], keys: string[]): number | null {
  return _safe(() => {
    for (let e = 0; e < envelopes.length; e++) {
      const env = _obj(envelopes[e]);
      if (!env) continue;
      const scopes = [env, _obj((env as any).value)];
      for (let s = 0; s < scopes.length; s++) {
        const scope: any = scopes[s];
        if (!scope) continue;
        for (let k = 0; k < keys.length; k++) {
          const raw = scope[keys[k]];
          if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw;
        }
      }
    }
    return null;
  }, null);
}

/**
 * Read a finite percentage (0..100) out of org-scoped probe envelopes.
 * Accepts a 0..1 fraction (multiplied to a percent) or a 0..100 value.
 * Returns null when no real percentage is present.
 */
function _percentFrom(envelopes: any[], keys: string[]): number | null {
  return _safe(() => {
    for (let e = 0; e < envelopes.length; e++) {
      const env = _obj(envelopes[e]);
      if (!env) continue;
      const scopes = [env, _obj((env as any).value)];
      for (let s = 0; s < scopes.length; s++) {
        const scope: any = scopes[s];
        if (!scope) continue;
        for (let k = 0; k < keys.length; k++) {
          const raw = scope[keys[k]];
          if (typeof raw === 'number' && Number.isFinite(raw)) {
            if (raw < 0) continue;
            if (raw <= 1) return Math.round(raw * 100);
            if (raw <= 100) return Math.round(raw);
          }
        }
      }
    }
    return null;
  }, null);
}

export function ngoEnterpriseHealth(): NGOEnterpriseEnvelope {
  return _safe(
    () => {
      // --- org-scoped probe envelopes (any may be null) ---
      // Each is the CURRENT tenant's own scope. We never reach into another
      // organization and we never read PII fields off these envelopes.
      const ngoIntelligence = _probe('__ngoIntelligenceHealth');
      const ngoImpact = _probe('__ngoImpactHealth');
      const fieldOfficer = _probe('__fieldOfficerHealth');
      const programEvidence = _probe('__programEvidenceHealth');
      const ngoCommand = _probe('__ngoCommandHealth');

      const orgEnvelopes = [
        ngoIntelligence,
        ngoImpact,
        programEvidence,
        ngoCommand,
      ];

      // --- device-local data (THIS device/session only; may be absent) ---
      const eventLog = _arr(_ls('farroway_event_log'));

      // --- aggregate reach counts (org-scoped probes only) -------------------
      // These are already-aggregated counts; we never enumerate individuals,
      // households, or coordinates to derive them.
      const cohortsReal = _metricFrom(orgEnvelopes, [
        'cohorts',
        'cohortCount',
        'totalCohorts',
        'programCohorts',
      ]);
      const communitiesReal = _metricFrom(orgEnvelopes, [
        'communities',
        'communityCount',
        'totalCommunities',
        'communitiesReached',
      ]);
      const villagesReal = _metricFrom(orgEnvelopes, [
        'villages',
        'villageCount',
        'totalVillages',
        'villagesReached',
      ]);

      // --- field-officer workload (from its own org-scoped probe) ------------
      const fieldOfficerWorkload: number | string = _safe(() => {
        const env = _obj(fieldOfficer);
        if (!env) return 'unknown';
        const scopes = [env, _obj((env as any).value)];
        const keys = ['workload', 'openFollowUps', 'pendingFollowUps', 'caseload', 'assignedCount'];
        for (let s = 0; s < scopes.length; s++) {
          const scope: any = scopes[s];
          if (!scope) continue;
          for (let k = 0; k < keys.length; k++) {
            const raw = scope[keys[k]];
            if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw;
          }
          // Coarse label is also acceptable (already a safe 'low'|'medium'|'high'-style label).
          const label = scope.workloadLabel ?? scope.workloadLevel;
          if (typeof label === 'string') {
            const l = label.trim().toLowerCase();
            if (l === 'low' || l === 'medium' || l === 'high') return l;
          }
        }
        return 'unknown';
      }, 'unknown');

      // --- intervention progress (label only, never a fabricated number) -----
      const interventionPct = _percentFrom(orgEnvelopes, [
        'interventionProgress',
        'interventionCompletion',
        'interventionsCompletedRate',
        'programProgress',
      ]);
      const interventionProgress: string = _safe(() => {
        if (interventionPct == null) return NOT_ENOUGH;
        if (interventionPct >= 67) return 'high';
        if (interventionPct >= 34) return 'medium';
        return 'low';
      }, NOT_ENOUGH);

      // --- evidence completion (percent LABEL from the evidence probe) -------
      const evidencePct = _percentFrom(
        [programEvidence, ngoImpact],
        [
          'evidenceCompletion',
          'evidenceCompletionRate',
          'evidenceCompletePct',
          'completionRate',
          'completeness',
        ],
      );
      const evidenceCompletion: string = _safe(() => {
        if (evidencePct == null) return NOT_ENOUGH;
        return String(evidencePct) + '%';
      }, NOT_ENOUGH);

      // --- whether the evidence/impact probes report SUFFICIENT data ---------
      // donorReportReadiness is 'ready' ONLY when a real evidence/impact probe
      // actually reports enough backing data. We look for an explicit readiness
      // signal on the org-scoped evidence/impact probes, or a high evidence
      // completion percentage. Absence => 'not_ready' (never optimistic).
      const evidenceReadySignal = _safe(() => {
        const envs = [programEvidence, ngoImpact];
        for (let e = 0; e < envs.length; e++) {
          const env = _obj(envs[e]);
          if (!env) continue;
          const scopes = [env, _obj((env as any).value)];
          for (let s = 0; s < scopes.length; s++) {
            const scope: any = scopes[s];
            if (!scope) continue;
            // explicit boolean readiness flags published by the real probe
            if (scope.donorReportReady === true) return true;
            if (scope.evidenceReady === true) return true;
            if (scope.reportReady === true) return true;
            if (scope.sufficientData === true) return true;
            const r = scope.donorReportReadiness ?? scope.evidenceReadiness;
            if (typeof r === 'string' && r.trim().toLowerCase() === 'ready') return true;
          }
        }
        return false;
      }, false);

      const donorReportReadiness: Readiness = _safe(() => {
        // Real data must exist AND be sufficient: either the probe explicitly
        // says it is ready, or the real evidence completion is high enough.
        const completionSufficient = evidencePct != null && evidencePct >= 80;
        return (evidenceReadySignal || completionSufficient) ? 'ready' : 'not_ready';
      }, 'not_ready');

      // --- program risk map readiness ----------------------------------------
      // 'ready' only when a real org-scoped risk signal exists (an explicit
      // readiness flag, or a real high-risk-farms / risk-coverage figure off
      // the intelligence/command probes). Otherwise 'not_ready'.
      const riskSignalReal = _metricFrom([ngoIntelligence, ngoCommand], [
        'highRiskFarms',
        'highRiskFarmCount',
        'atRiskFarms',
        'riskCoverage',
        'riskZones',
        'mappedRiskAreas',
      ]);
      const riskReadyFlag = _safe(() => {
        const envs = [ngoIntelligence, ngoCommand];
        for (let e = 0; e < envs.length; e++) {
          const env = _obj(envs[e]);
          if (!env) continue;
          const scopes = [env, _obj((env as any).value)];
          for (let s = 0; s < scopes.length; s++) {
            const scope: any = scopes[s];
            if (!scope) continue;
            if (scope.riskMapReady === true || scope.programRiskMapReady === true) return true;
            const r = scope.programRiskMapReadiness ?? scope.riskMapReadiness;
            if (typeof r === 'string' && r.trim().toLowerCase() === 'ready') return true;
          }
        }
        return false;
      }, false);
      const programRiskMapReadiness: Readiness = _safe(() => {
        return (riskReadyFlag || (riskSignalReal != null && riskSignalReal > 0)) ? 'ready' : 'not_ready';
      }, 'not_ready');

      // --- honest mapping: real source → number, else honest label -----------
      const cohorts: number | string = cohortsReal != null ? cohortsReal : NOT_ENOUGH;
      const communities: number | string = communitiesReal != null ? communitiesReal : NOT_ENOUGH;
      const villages: number | string = villagesReal != null ? villagesReal : NOT_ENOUGH;

      // --- honest data sources (only what we actually saw) -------------------
      const dataSources: string[] = [];
      if (ngoIntelligence) dataSources.push('__ngoIntelligenceHealth');
      if (ngoImpact) dataSources.push('__ngoImpactHealth');
      if (fieldOfficer) dataSources.push('__fieldOfficerHealth');
      if (programEvidence) dataSources.push('__programEvidenceHealth');
      if (ngoCommand) dataSources.push('__ngoCommandHealth');
      if (eventLog.length > 0) dataSources.push('farroway_event_log');

      // --- confidence from how many real signals exist -----------------------
      let confidence: Confidence = 'low';
      const orgSignals =
        (ngoIntelligence ? 1 : 0) +
        (ngoImpact ? 1 : 0) +
        (fieldOfficer ? 1 : 0) +
        (programEvidence ? 1 : 0) +
        (ngoCommand ? 1 : 0);
      const realReach =
        (cohortsReal != null ? 1 : 0) +
        (communitiesReal != null ? 1 : 0) +
        (villagesReal != null ? 1 : 0);

      if (orgSignals >= 3 && realReach >= 1 && (evidencePct != null || evidenceReadySignal)) {
        confidence = 'high';
      } else if (orgSignals >= 1 || realReach >= 1) {
        confidence = 'medium';
      }

      // --- explanation (honest about what is and isn't backed) ---------------
      const explanation = _safe(() => {
        const bits: string[] = [];
        bits.push(
          'Organization-scoped enterprise roll-up from ' +
            (dataSources.length === 1 ? '1 source' : dataSources.length + ' sources') +
            '.',
        );
        if (realReach === 0) {
          bits.push(
            'Cohort, community and village reach are not available from the NGO probes yet — shown as "' +
              NOT_ENOUGH +
              '".',
          );
        } else {
          bits.push(
            'Reach figures come solely from organization-scoped probes: ' +
              'cohorts ' + String(cohorts) + ', communities ' + String(communities) +
              ', villages ' + String(villages) + '.',
          );
        }
        bits.push(
          'Intervention progress is "' + interventionProgress + '"; evidence completion is "' +
            evidenceCompletion + '".',
        );
        bits.push(
          'Donor report is ' + donorReportReadiness.replace('_', ' ') +
            ' and the program risk map is ' + programRiskMapReadiness.replace('_', ' ') +
            ' based on what the real evidence, impact, and risk probes report.',
        );
        if (fieldOfficerWorkload === 'unknown') {
          bits.push('Field-officer workload is unknown — no field-officer probe published.');
        }
        return bits.join(' ');
      }, 'Organization-scoped enterprise roll-up of the real data available so far.');

      // --- honest fallback when no real source at all ------------------------
      const haveAnyRealSource = orgSignals > 0 || eventLog.length > 0;

      // --- limitations note (constant, honest) -------------------------------
      const limitations =
        'Reach (cohorts, communities, villages), intervention progress, evidence ' +
        'completion, and readiness come solely from organization-scoped probes ' +
        'when present, and are otherwise "' + NOT_ENOUGH + '", "unknown", or ' +
        '"not_ready". This is a coarse program-management summary, not an exact ' +
        'yield, revenue, or per-area forecast, and not advice about chemicals or ' +
        'treatments. This engine is organization-scoped: it never reads another ' +
        'tenant\'s data and never exposes any personally identifying information ' +
        'about farmers (no name, phone, email, household, or location). ' +
        GUIDANCE_TAIL;

      if (!haveAnyRealSource) {
        return Object.freeze({
          runtimeVersion: 'ngo-enterprise-v1',
          initialized: true as const,
          organizationScoped: true as const,
          crossTenantLeakage: false as const,
          value: Object.freeze({
            cohorts: NOT_ENOUGH,
            communities: NOT_ENOUGH,
            villages: NOT_ENOUGH,
            fieldOfficerWorkload: 'unknown',
            interventionProgress: NOT_ENOUGH,
            evidenceCompletion: NOT_ENOUGH,
            donorReportReadiness: 'not_ready' as Readiness,
            programRiskMapReadiness: 'not_ready' as Readiness,
          }),
          confidence: 'low' as Confidence,
          dataSources: Object.freeze([]) as unknown as string[],
          explanation:
            NOT_ENOUGH + ' — no organization-scoped NGO probes or on-device program history available.',
          limitations,
        }) as NGOEnterpriseEnvelope;
      }

      return Object.freeze({
        runtimeVersion: 'ngo-enterprise-v1',
        initialized: true as const,
        organizationScoped: true as const,
        crossTenantLeakage: false as const,
        value: Object.freeze({
          cohorts,
          communities,
          villages,
          fieldOfficerWorkload,
          interventionProgress,
          evidenceCompletion,
          donorReportReadiness,
          programRiskMapReadiness,
        }),
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as NGOEnterpriseEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: 'ngo-enterprise-v1',
      initialized: true as const,
      organizationScoped: true as const,
      crossTenantLeakage: false as const,
      value: Object.freeze({
        cohorts: NOT_ENOUGH,
        communities: NOT_ENOUGH,
        villages: NOT_ENOUGH,
        fieldOfficerWorkload: 'unknown',
        interventionProgress: NOT_ENOUGH,
        evidenceCompletion: NOT_ENOUGH,
        donorReportReadiness: 'not_ready' as Readiness,
        programRiskMapReadiness: 'not_ready' as Readiness,
      }),
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        NOT_ENOUGH + ' — no organization-scoped NGO probes or on-device program history available.',
      limitations:
        'This engine is organization-scoped and never exposes farmer PII. ' +
        'No real source is available yet, so every figure is "' + NOT_ENOUGH + '", ' +
        '"unknown", or "not_ready". It is not an exact yield, revenue, or per-area ' +
        'forecast. ' +
        GUIDANCE_TAIL,
    }) as NGOEnterpriseEnvelope,
  );
}

export function installNGOEnterpriseHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__ngoEnterpriseHealth !== 'function') {
      w.__ngoEnterpriseHealth = function () {
        const out = ngoEnterpriseHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · NGO Enterprise]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
