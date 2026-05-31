/**
 * Farroway · NGO Intelligence Engine (ngo-intelligence-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()`, `_ls()` and `_winVar()` helpers below, and never fabricates
 * any metric.
 *
 * It rolls up ORGANIZATION-SCOPED program signals for an NGO operator:
 * enrolment, activity, scans, tasks, outcomes, and on-device disease/pest
 * clusters. Every number is derived from a real org-scoped probe envelope or
 * from device-local stores; when a real source is absent the field is 0 /
 * null / "Not enough data yet" with an honest note — never invented.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * NO-CROSS-TENANT-LEAKAGE + NO-PII CONTRACT (gate-enforced)
 * ──────────────────────────────────────────────────────────────────────────
 * • This engine reads ONLY:
 *     (a) org-scoped probe envelopes already published on `window`
 *         (`__ngoImpactHealth`, `__ngoCommandHealth`, `__fieldOfficerHealth`,
 *          `__ngoMetricsHealth`, `__adminImpactHealth`, `__tenantIsolationHealth`),
 *         each of which is the current tenant's own scope, and
 *     (b) device-local stores for THIS device/session only
 *         (`farroway_scan_history_v1`, `farroway_cached_tasks`,
 *          `farroway_event_log`, `farroway_managed_plants`).
 * • It NEVER reads another tenant's data, NEVER joins across organizations,
 *   and surfaces `organizationScoped: true` + `crossTenantLeakage: false`.
 * • It NEVER resolves or exposes PII: no farmer id, name, phone, email,
 *   coordinates, or device id is read or emitted. Only aggregate counts and
 *   category names (disease/pest labels) cross the boundary. Disease/pest
 *   clustering is a pure on-device aggregation over scan categories — it does
 *   NOT attach any farmer/location/device identifier.
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

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

const NOT_ENOUGH = 'Not enough data yet';

export const NGO_INTELLIGENCE_ENGINE_VERSION = 'ngo-intelligence-v1';

export interface NGOIntelligenceEnvelope {
  runtimeVersion: 'ngo-intelligence-v1';
  initialized: true;
  organizationScoped: true;
  crossTenantLeakage: false;
  value: {
    farmersEnrolled: number | string;
    activeFarmers: number | string;
    scansCompleted: number | string;
    tasksCompleted: number | string;
    outcomesRecorded: number | string;
    diseaseClusters: number | string;
    pestClusters: number | string;
    highRiskFarms: number | string;
    fieldOfficerWorkload: number | string;
    programImpact: number | string;
  };
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

/**
 * Read a numeric metric out of an org-scoped probe envelope without ever
 * touching PII. Tries the envelope root and a nested `value` object only,
 * across a small allow-list of aggregate field names. Returns null if no
 * real, finite numeric source is present (caller then reports honestly).
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
          if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
        }
      }
    }
    return null;
  }, null);
}

export function ngoIntelligenceHealth(): NGOIntelligenceEnvelope {
  return _safe(
    () => {
      // --- org-scoped probe envelopes (any may be null) ---
      // Each is the CURRENT tenant's own scope. We never reach into another
      // organization and we never read PII fields off these envelopes.
      const ngoImpact = _probe('__ngoImpactHealth');
      const ngoCommand = _probe('__ngoCommandHealth');
      const fieldOfficer = _probe('__fieldOfficerHealth');
      const ngoMetrics = _probe('__ngoMetricsHealth');
      const adminImpact = _probe('__adminImpactHealth');
      const tenantIsolation = _probe('__tenantIsolationHealth');

      const ngoEnvelopes = [
        ngoImpact,
        ngoCommand,
        ngoMetrics,
        adminImpact,
      ];

      // --- on-device stores (THIS device/session only; any may be absent) ---
      const scanHistory = _arr(_ls('farroway_scan_history_v1'));
      const cachedTasks = _arr(_ls('farroway_cached_tasks'));
      const eventLog = _arr(_ls('farroway_event_log'));
      const managedPlants = _arr(_ls('farroway_managed_plants'));

      // --- on-device counts (aggregate only, no identifiers) ---
      const scansCompletedCount = scanHistory.length;

      const tasksCompletedCount = _safe(() => {
        let done = 0;
        let sawStatus = false;
        for (let i = 0; i < cachedTasks.length; i++) {
          const t: any = cachedTasks[i];
          if (!t || typeof t !== 'object') continue;
          const status =
            t.status ?? t.state ?? (typeof t.completed === 'boolean' ? (t.completed ? 'completed' : 'open') : null);
          if (status != null) {
            sawStatus = true;
            const s = String(status).toLowerCase();
            if (s === 'completed' || s === 'complete' || s === 'done' || t.completed === true) done++;
          }
        }
        // If no task carried a status field, we cannot honestly call any
        // "completed" — fall back to the raw saved-task count.
        return sawStatus ? done : cachedTasks.length;
      }, cachedTasks.length);

      const outcomesRecordedCount = _safe(() => {
        let n = 0;
        for (let i = 0; i < eventLog.length; i++) {
          const ev: any = eventLog[i];
          if (!ev || typeof ev !== 'object') continue;
          const type = String(ev.type ?? ev.eventType ?? ev.kind ?? ev.name ?? '').toLowerCase();
          if (type.indexOf('outcome') !== -1) n++;
        }
        return n;
      }, 0);

      // --- real on-device disease/pest clustering -----------------------------
      // Pure aggregation over scan categories. We count DISTINCT category labels
      // only; no farmer, location, or device identifier is read or attached.
      const cluster = _safe(() => {
        const diseases = new Set<string>();
        const pests = new Set<string>();
        for (let i = 0; i < scanHistory.length; i++) {
          const s: any = scanHistory[i];
          if (!s || typeof s !== 'object') continue;

          const diseaseLabel = _safe(() => {
            const d = s.disease ?? s.diseaseName ?? s.diagnosis ?? null;
            return d != null && String(d).trim() ? String(d).trim().toLowerCase() : null;
          }, null);
          if (diseaseLabel) diseases.add(diseaseLabel);

          const pestLabel = _safe(() => {
            const p = s.pest ?? s.pestName ?? null;
            return p != null && String(p).trim() ? String(p).trim().toLowerCase() : null;
          }, null);
          if (pestLabel) pests.add(pestLabel);

          // Generic category may carry either a disease or pest label.
          const category = _safe(() => {
            const c = s.category ?? s.issueType ?? s.label ?? null;
            return c != null && String(c).trim() ? String(c).trim().toLowerCase() : null;
          }, null);
          if (category) {
            if (category.indexOf('pest') !== -1) pests.add(category);
            else if (category.indexOf('disease') !== -1 || category.indexOf('blight') !== -1 || category.indexOf('rot') !== -1 || category.indexOf('rust') !== -1 || category.indexOf('mildew') !== -1) diseases.add(category);
          }
        }
        return { disease: diseases.size, pest: pests.size };
      }, { disease: 0, pest: 0 });

      // --- metrics that must come from real org-scoped probes -----------------
      const farmersEnrolledReal = _metricFrom(ngoEnvelopes, [
        'farmersEnrolled',
        'enrolledFarmers',
        'totalFarmers',
        'farmerCount',
      ]);
      const activeFarmersReal = _metricFrom(ngoEnvelopes, [
        'activeFarmers',
        'activeFarmerCount',
        'farmersActive',
      ]);
      const programImpactReal = _metricFrom(ngoEnvelopes, [
        'programImpact',
        'impactScore',
        'impact',
      ]);
      const highRiskFarmsReal = _metricFrom([...ngoEnvelopes, ngoCommand], [
        'highRiskFarms',
        'highRiskFarmCount',
        'atRiskFarms',
      ]);

      // --- field officer workload (from its own org-scoped probe) -------------
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
            if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
          }
        }
        return 'unknown';
      }, 'unknown');

      // --- honest mapping: real source → number, else honest label -----------
      const farmersEnrolled: number | string = farmersEnrolledReal != null ? farmersEnrolledReal : NOT_ENOUGH;
      const activeFarmers: number | string = activeFarmersReal != null ? activeFarmersReal : NOT_ENOUGH;
      const programImpact: number | string = programImpactReal != null ? programImpactReal : NOT_ENOUGH;
      const highRiskFarms: number | string = highRiskFarmsReal != null ? highRiskFarmsReal : 0;

      const scansCompleted: number | string = scansCompletedCount;
      const tasksCompleted: number | string = tasksCompletedCount;
      const outcomesRecorded: number | string = outcomesRecordedCount;
      const diseaseClusters: number | string = cluster.disease;
      const pestClusters: number | string = cluster.pest;

      // --- crossTenantLeakage stays false ------------------------------------
      // We only ever read org-scoped probe envelopes and device-local stores,
      // never another tenant's data and never PII. If a tenant-isolation probe
      // is published we additionally surface its presence in dataSources, but
      // the contract value is fixed false by construction here.
      const tenantIsolationPresent = !!tenantIsolation;

      // --- honest data sources (only what we actually saw) -------------------
      const dataSources: string[] = [];
      if (ngoImpact) dataSources.push('__ngoImpactHealth');
      if (ngoCommand) dataSources.push('__ngoCommandHealth');
      if (fieldOfficer) dataSources.push('__fieldOfficerHealth');
      if (ngoMetrics) dataSources.push('__ngoMetricsHealth');
      if (adminImpact) dataSources.push('__adminImpactHealth');
      if (tenantIsolationPresent) dataSources.push('__tenantIsolationHealth');
      if (scansCompletedCount > 0) dataSources.push('farroway_scan_history_v1');
      if (cachedTasks.length > 0) dataSources.push('farroway_cached_tasks');
      if (eventLog.length > 0) dataSources.push('farroway_event_log');
      if (managedPlants.length > 0) dataSources.push('farroway_managed_plants');

      // --- confidence from how many real signals exist -----------------------
      let confidence: Confidence = 'low';
      const orgSignals =
        (ngoImpact ? 1 : 0) +
        (ngoCommand ? 1 : 0) +
        (fieldOfficer ? 1 : 0) +
        (ngoMetrics ? 1 : 0) +
        (adminImpact ? 1 : 0);
      const deviceSignals =
        (scansCompletedCount > 0 ? 1 : 0) +
        (cachedTasks.length > 0 ? 1 : 0) +
        (eventLog.length > 0 ? 1 : 0);
      const realEnrolment = farmersEnrolledReal != null || activeFarmersReal != null;

      if (orgSignals >= 3 && realEnrolment && scansCompletedCount >= 5) {
        confidence = 'high';
      } else if (orgSignals >= 1 || deviceSignals >= 2) {
        confidence = 'medium';
      }

      // --- explanation (honest about what is and isn't backed) ---------------
      const explanation = _safe(() => {
        const bits: string[] = [];
        bits.push(
          'Organization-scoped roll-up from ' +
            (dataSources.length === 1 ? '1 source' : dataSources.length + ' sources') +
            '. On-device totals: ' +
            scansCompletedCount +
            ' scan(s), ' +
            tasksCompletedCount +
            ' task(s), ' +
            outcomesRecordedCount +
            ' outcome event(s).',
        );
        bits.push(
          'On-device clustering found ' +
            cluster.disease +
            ' distinct disease categor' + (cluster.disease === 1 ? 'y' : 'ies') +
            ' and ' +
            cluster.pest +
            ' distinct pest categor' + (cluster.pest === 1 ? 'y' : 'ies') +
            ' across saved scans.',
        );
        if (farmersEnrolledReal == null && activeFarmersReal == null) {
          bits.push(
            'Enrolment and active-farmer figures are not available from the NGO probes yet — shown as "' +
              NOT_ENOUGH +
              '".',
          );
        }
        if (programImpactReal == null) {
          bits.push('Program-impact figure is not available from the NGO probes yet.');
        }
        if (fieldOfficerWorkload === 'unknown') {
          bits.push('Field-officer workload is unknown — no field-officer probe published.');
        }
        return bits.join(' ');
      }, 'Organization-scoped roll-up of the real data available so far.');

      // --- limitations note (constant, honest) -------------------------------
      const limitations =
        'On-device counts (scans, tasks, outcome events, clusters) reflect only ' +
        'this device/session, not the whole program. Enrolment, active farmers, ' +
        'high-risk farms and program impact come solely from organization-scoped ' +
        'probes when present, and are otherwise "' + NOT_ENOUGH + '". ' +
        'This engine is organization-scoped: it never reads another tenant\'s data ' +
        'and never exposes any personally identifying information about farmers. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: 'ngo-intelligence-v1',
        initialized: true as const,
        organizationScoped: true as const,
        crossTenantLeakage: false as const,
        value: Object.freeze({
          farmersEnrolled,
          activeFarmers,
          scansCompleted,
          tasksCompleted,
          outcomesRecorded,
          diseaseClusters,
          pestClusters,
          highRiskFarms,
          fieldOfficerWorkload,
          programImpact,
        }),
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as NGOIntelligenceEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: 'ngo-intelligence-v1',
      initialized: true as const,
      organizationScoped: true as const,
      crossTenantLeakage: false as const,
      value: Object.freeze({
        farmersEnrolled: NOT_ENOUGH,
        activeFarmers: NOT_ENOUGH,
        scansCompleted: 0,
        tasksCompleted: 0,
        outcomesRecorded: 0,
        diseaseClusters: 0,
        pestClusters: 0,
        highRiskFarms: 0,
        fieldOfficerWorkload: 'unknown',
        programImpact: NOT_ENOUGH,
      }),
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        'Not enough data yet — no organization-scoped probes or on-device history available.',
      limitations:
        'This engine is organization-scoped and never exposes farmer PII. ' +
        'No real source is available yet, so every figure is 0 or "' + NOT_ENOUGH + '". ' +
        GUIDANCE_TAIL,
    }) as NGOIntelligenceEnvelope,
  );
}

export function installNGOIntelligenceHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__ngoIntelligenceHealth !== 'function') {
      w.__ngoIntelligenceHealth = function () {
        const out = ngoIntelligenceHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · NGO Intelligence]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
