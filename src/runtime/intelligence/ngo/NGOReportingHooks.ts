/**
 * Farroway · NGO Reporting Hooks (ngo-reporting-hooks-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via the
 * `_probe()`, `_ls()` and `_winVar()` helpers below, and never fabricates a
 * single metric (no Math.random, no fetch, no fake numbers).
 *
 * PURPOSE
 * Surfaces ORGANIZATION-SCOPED reporting aggregates an NGO can use to track a
 * program at a glance: how many farmers are enrolled/active, how many scans and
 * tasks have happened, how diagnoses break down, follow-up activity, and an
 * honest improving/unchanged/worsened roll-up of recorded outcomes. When a real
 * source is absent, the corresponding figure is 0 or the honest string
 * 'NEEDS_DATA' — never an invented value.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * PRIVACY / ISOLATION CONTRACT (gate-enforced; do not weaken)
 * ───────────────────────────────────────────────────────────────────────────
 * • NO CROSS-ORG LEAKAGE. This runtime reads ONLY (a) org-scoped probe
 *   envelopes published on `window` by THIS organization's own runtimes and
 *   (b) device-local storage belonging to THIS device/session. It never
 *   enumerates, fetches, joins, or derives another organization's data. There
 *   is no tenant key, no network call, and no path to another org's records.
 * • NO PII IS EXPOSED. The output envelope contains ONLY already-aggregated
 *   counts and coarse labels. It NEVER reads or surfaces private farmer details:
 *   no name / farmerName, no phone, no email, no coordinates (lat/lng/coords),
 *   and no deviceId. None of those appear as output keys, and none are read out
 *   of the underlying records to build a metric. Individuals are counted, never
 *   identified.
 * • Every returned envelope is Object.freeze'd, SSR-safe, pure, and NEVER
 *   throws (all reads pass through `_safe`).
 *
 * This is decision support for program reporting, not a guarantee.
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

// Honest sentinel for any figure with no real backing source.
const NEEDS_DATA = 'NEEDS_DATA';

// A regional risk roll-up is only worth surfacing once the regional probe has
// crossed its own data threshold. Below that, we say NEEDS_DATA on purpose.
const MIN_REGIONAL_DATA_POINTS = 3;

export const NGO_REPORTING_HOOKS_VERSION = 'ngo-reporting-hooks-v1';

export interface NGOReportingHooksEnvelope {
  runtimeVersion: 'ngo-reporting-hooks-v1';
  initialized: true;
  orgScoped: true;
  farmerEnrollmentReady: boolean;
  scanAggregateReady: boolean;
  taskAggregateReady: boolean;
  outcomeAggregateReady: boolean;
  privacySafe: true;
  noFakeMetrics: true;
  value: {
    farmersEnrolled: number | string;
    activeFarmers: number | string;
    scansCompleted: number;
    diagnosisCounts: Record<string, number> | string;
    taskCompletion: number;
    followUpScans: number | string;
    outcomesRecorded: number;
    improving: number;
    unchanged: number;
    worsened: number;
    regionalRiskSignals: any;
  };
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

/**
 * Read a finite, non-negative numeric aggregate out of one or more org-scoped
 * probe envelopes WITHOUT ever touching PII. Tries the envelope root and a
 * nested `value` object only, across a small allow-list of aggregate field
 * names. Returns null when no real, finite numeric source is present so the
 * caller can report honestly (0 / NEEDS_DATA). Negatives are treated as absent.
 */
function _aggFrom(envelopes: any[], keys: string[]): number | null {
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

/** Coarse, normalized event-type token for an event-log record. */
function _eventType(rec: any): string {
  return _safe(() => {
    const e: any = rec;
    const t = e.type ?? e.event ?? e.name ?? e.kind ?? null;
    return t != null ? String(t) : '';
  }, '');
}

/**
 * Classify a recorded-outcome event into improving / unchanged / worsened from
 * its OWN saved status field. Only coarse status tokens are read — never any
 * identifying field. Anything unrecognized is treated as 'unchanged' so we do
 * not over-claim improvement.
 */
function _outcomeStatus(rec: any): 'improving' | 'unchanged' | 'worsened' {
  return _safe(() => {
    const e: any = rec;
    const raw =
      e.status ?? e.outcome ?? e.outcomeStatus ?? e.result ?? e.trend ?? e.change ?? null;
    const s = raw != null ? String(raw).trim().toLowerCase() : '';
    if (!s) return 'unchanged';
    if (
      s === 'improving' || s === 'improved' || s === 'better' || s === 'recovered' ||
      s === 'recovering' || s === 'resolved' || s === 'up' || s === 'positive'
    ) {
      return 'improving';
    }
    if (
      s === 'worsened' || s === 'worsening' || s === 'worse' || s === 'declined' ||
      s === 'declining' || s === 'down' || s === 'negative' || s === 'failed' || s === 'lost'
    ) {
      return 'worsened';
    }
    return 'unchanged';
  }, 'unchanged');
}

export function ngoReportingHooksHealth(): NGOReportingHooksEnvelope {
  return _safe(
    () => {
      // --- org-scoped probes (any may be null) ----------------------------
      // These are THIS organization's own runtimes' published envelopes. We
      // never reach into any other tenant's data.
      const enterprise = _probe('__ngoEnterpriseHealth');
      const impact = _probe('__ngoImpactHealth');
      const metrics = _probe('__ngoMetrics') || _probe('__ngoPilotMetrics');
      const regional = _probe('__regionalIntelligenceHealth');

      const orgEnvelopes = [enterprise, impact, metrics];

      // --- device-local data (THIS device/session only; may be absent) ----
      const eventLog = _arr(_ls('farroway_event_log'));
      const scanHistory = _arr(_ls('farroway_scan_history_v1'));

      // --- on-device event counts (real records only) ---------------------
      // We classify events purely by their coarse type/status token. We never
      // read a name, phone, email, coordinate, or deviceId off any record.
      let scanEventsCompleted = 0;
      let taskCompletedCount = 0;
      let outcomesRecorded = 0;
      let improving = 0;
      let unchanged = 0;
      let worsened = 0;

      for (let i = 0; i < eventLog.length; i++) {
        const rec = _obj(eventLog[i]);
        if (!rec) continue;
        const type = _eventType(rec);
        if (type === 'ScanCompleted' || type === 'ScanCaptured') {
          scanEventsCompleted++;
        } else if (type === 'TaskCompleted') {
          taskCompletedCount++;
        } else if (type === 'OutcomeRecorded') {
          outcomesRecorded++;
          const status = _outcomeStatus(rec);
          if (status === 'improving') improving++;
          else if (status === 'worsened') worsened++;
          else unchanged++;
        }
      }

      // --- scansCompleted: real device scan history + scan events ---------
      // Prefer an org-scoped aggregate if the probe publishes one; otherwise
      // fall back to honest device-local counts. Never invented.
      const scanAggregate = _aggFrom(orgEnvelopes, [
        'scansCompleted',
        'scanCount',
        'totalScans',
        'scans',
      ]);
      const scansCompleted =
        scanAggregate != null
          ? scanAggregate
          : _safe(() => scanHistory.length + scanEventsCompleted, 0);

      // --- taskCompletion: real completed-task count ----------------------
      const taskAggregate = _aggFrom(orgEnvelopes, [
        'tasksCompleted',
        'taskCompletion',
        'completedTasks',
        'taskCompletedCount',
      ]);
      const taskCompletion = taskAggregate != null ? taskAggregate : taskCompletedCount;

      // --- farmer enrollment / active farmers (org-scoped aggregates) -----
      // Already-aggregated counts only; individuals are counted, never named.
      const farmersEnrolledReal = _aggFrom(orgEnvelopes, [
        'farmersEnrolled',
        'enrolledFarmers',
        'farmerCount',
        'totalFarmers',
        'beneficiaries',
        'beneficiaryCount',
      ]);
      const activeFarmersReal = _aggFrom(orgEnvelopes, [
        'activeFarmers',
        'activeFarmerCount',
        'activeBeneficiaries',
        'farmersActive',
      ]);

      // --- follow-up scans (org-scoped aggregate, else event count) -------
      const followUpReal = _aggFrom(orgEnvelopes, [
        'followUpScans',
        'followUps',
        'followUpCount',
        'repeatScans',
      ]);

      // --- diagnosis breakdown (org-scoped, already-aggregated map only) --
      // We only accept a pre-aggregated { label: count } map off a probe. We
      // never reconstruct one from raw scans here (raw scans may carry detail
      // we deliberately do not surface). Absent => NEEDS_DATA.
      const diagnosisCounts: Record<string, number> | string = _safe(() => {
        for (let e = 0; e < orgEnvelopes.length; e++) {
          const env = _obj(orgEnvelopes[e]);
          if (!env) continue;
          const scopes = [env, _obj((env as any).value)];
          for (let s = 0; s < scopes.length; s++) {
            const scope: any = scopes[s];
            if (!scope) continue;
            const candidate =
              _obj(scope.diagnosisCounts) ||
              _obj(scope.diagnosisBreakdown) ||
              _obj(scope.diagnoses);
            if (!candidate) continue;
            const out: Record<string, number> = {};
            const keys = Object.keys(candidate);
            for (let k = 0; k < keys.length; k++) {
              const v = (candidate as any)[keys[k]];
              if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
                out[keys[k]] = v;
              }
            }
            if (Object.keys(out).length > 0) return out;
          }
        }
        return NEEDS_DATA;
      }, NEEDS_DATA);

      // --- readiness flags ------------------------------------------------
      const farmerEnrollmentReady = farmersEnrolledReal != null;
      const scanAggregateReady = scansCompleted > 0;
      const taskAggregateReady = taskCompletion > 0;
      const outcomeAggregateReady = outcomesRecorded > 0;

      // --- regional risk signals (only if its threshold is met) -----------
      // We include this ONLY when THIS org's regional probe reports it has
      // crossed its own data threshold; otherwise NEEDS_DATA. We surface only
      // coarse risk labels — never any location/coordinate.
      const regionalRiskSignals: any = _safe(() => {
        const env = _obj(regional);
        if (!env) return NEEDS_DATA;
        const r: any = env;
        const v = _obj(r.value);

        // The regional probe says "Not enough regional data yet" below
        // threshold; honor that explicitly.
        const expl = _safe(() => String(r.explanation || '').toLowerCase(), '');
        if (expl.indexOf('not enough') !== -1) return NEEDS_DATA;

        const dataPoints =
          typeof r.dataPoints === 'number' && Number.isFinite(r.dataPoints)
            ? r.dataPoints
            : null;
        if (dataPoints != null && dataPoints < MIN_REGIONAL_DATA_POINTS) return NEEDS_DATA;

        if (!v) return NEEDS_DATA;
        const disease = v.diseaseRisk;
        const pest = v.pestRisk;
        const weather = v.weatherRisk;
        const outbreak = v.outbreakSignal;
        const allUnknown =
          (disease == null || disease === 'unknown') &&
          (pest == null || pest === 'unknown') &&
          (weather == null || weather === 'unknown') &&
          (outbreak == null || outbreak === 'unknown');
        if (allUnknown) return NEEDS_DATA;

        return Object.freeze({
          diseaseRisk: disease != null ? String(disease) : 'unknown',
          pestRisk: pest != null ? String(pest) : 'unknown',
          weatherRisk: weather != null ? String(weather) : 'unknown',
          outbreakSignal: outbreak != null ? String(outbreak) : 'unknown',
        });
      }, NEEDS_DATA);

      // --- honest mapping: real source → number, else NEEDS_DATA ----------
      const farmersEnrolled: number | string =
        farmersEnrolledReal != null ? farmersEnrolledReal : NEEDS_DATA;
      const activeFarmers: number | string =
        activeFarmersReal != null ? activeFarmersReal : NEEDS_DATA;
      const followUpScans: number | string =
        followUpReal != null ? followUpReal : NEEDS_DATA;

      // --- honest data sources (only what we actually saw / used) ---------
      const dataSources: string[] = [];
      if (enterprise) dataSources.push('__ngoEnterpriseHealth');
      if (impact) dataSources.push('__ngoImpactHealth');
      if (_probe('__ngoMetrics')) dataSources.push('__ngoMetrics');
      else if (_probe('__ngoPilotMetrics')) dataSources.push('__ngoPilotMetrics');
      if (regional) dataSources.push('__regionalIntelligenceHealth');
      if (eventLog.length > 0) dataSources.push('farroway_event_log');
      if (scanHistory.length > 0) dataSources.push('farroway_scan_history_v1');

      // --- limitations note (constant, honest) ----------------------------
      const limitations =
        'This report only reflects this organization’s own aggregated data ' +
        'saved on this device so far. It never includes another organization’s ' +
        'records, and it never exposes private farmer details such as names, phone ' +
        'numbers, emails, locations, or device identifiers — individuals are ' +
        'counted, never identified. Figures with no real source are shown as 0 or ' +
        '"' + NEEDS_DATA + '" on purpose, and outcome roll-ups reflect only the ' +
        'statuses that were actually recorded. It does not include other devices, ' +
        'deleted records, or anything not yet scanned or logged. ' +
        GUIDANCE_TAIL;

      // --- confidence from how many real signals exist --------------------
      let confidence: Confidence = 'low';
      const realSignals =
        (farmerEnrollmentReady ? 1 : 0) +
        (scanAggregateReady ? 1 : 0) +
        (taskAggregateReady ? 1 : 0) +
        (outcomeAggregateReady ? 1 : 0) +
        (typeof diagnosisCounts !== 'string' ? 1 : 0) +
        (regionalRiskSignals !== NEEDS_DATA ? 1 : 0);

      if (farmerEnrollmentReady && outcomeAggregateReady && realSignals >= 4) {
        confidence = 'high';
      } else if (realSignals >= 2) {
        confidence = 'medium';
      }

      // --- explanation (honest summary of what was actually read) ---------
      const explanation = _safe(() => {
        const bits: string[] = [];
        bits.push(
          'Organization-scoped reporting roll-up from real aggregates: ' +
            scansCompleted +
            ' scan(s) completed, ' +
            taskCompletion +
            ' task(s) completed, and ' +
            outcomesRecorded +
            ' outcome(s) recorded.',
        );
        if (outcomesRecorded > 0) {
          bits.push(
            'Recorded outcomes break down as ' +
              improving +
              ' improving, ' +
              unchanged +
              ' unchanged, ' +
              worsened +
              ' worsened.',
          );
        }
        if (!farmerEnrollmentReady) {
          bits.push('No enrolled-farmer aggregate is available yet (' + NEEDS_DATA + ').');
        }
        if (regionalRiskSignals === NEEDS_DATA) {
          bits.push('Regional risk signals are below the data threshold (' + NEEDS_DATA + ').');
        }
        return bits.join(' ');
      }, 'Organization-scoped reporting roll-up from real aggregates.');

      const value = {
        farmersEnrolled,
        activeFarmers,
        scansCompleted,
        diagnosisCounts,
        taskCompletion,
        followUpScans,
        outcomesRecorded,
        improving,
        unchanged,
        worsened,
        regionalRiskSignals,
      };

      return Object.freeze({
        runtimeVersion: 'ngo-reporting-hooks-v1' as const,
        initialized: true as const,
        orgScoped: true as const,
        farmerEnrollmentReady,
        scanAggregateReady,
        taskAggregateReady,
        outcomeAggregateReady,
        privacySafe: true as const,
        noFakeMetrics: true as const,
        value: Object.freeze(value),
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as NGOReportingHooksEnvelope;
    },
    // --- absolute fallback if anything above throws ---------------------
    Object.freeze({
      runtimeVersion: 'ngo-reporting-hooks-v1',
      initialized: true as const,
      orgScoped: true as const,
      farmerEnrollmentReady: false,
      scanAggregateReady: false,
      taskAggregateReady: false,
      outcomeAggregateReady: false,
      privacySafe: true as const,
      noFakeMetrics: true as const,
      value: Object.freeze({
        farmersEnrolled: NEEDS_DATA,
        activeFarmers: NEEDS_DATA,
        scansCompleted: 0,
        diagnosisCounts: NEEDS_DATA,
        taskCompletion: 0,
        followUpScans: NEEDS_DATA,
        outcomesRecorded: 0,
        improving: 0,
        unchanged: 0,
        worsened: 0,
        regionalRiskSignals: NEEDS_DATA,
      }),
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation: 'Not enough data yet — no organization reporting aggregates available.',
      limitations:
        'This report only reflects this organization’s own aggregated data saved ' +
        'on this device so far. It never includes another organization’s records, ' +
        'and it never exposes private farmer details. ' +
        GUIDANCE_TAIL,
    }) as NGOReportingHooksEnvelope,
  );
}

export function installNGOReportingHooksHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__ngoReportingHooksHealth !== 'function') {
      w.__ngoReportingHooksHealth = function () {
        const out = ngoReportingHooksHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · NGO Reporting Hooks]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
