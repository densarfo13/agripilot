/**
 * Farroway · Farm Digital Twin Runtime (farm-digital-twin-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()`, `_ls()` and `_winVar()` helpers below, and never fabricates
 * history.
 *
 * It assembles an honest, read-only "digital twin" view of the ACTIVE farm by
 * summarizing the REAL stored history that exists (plants, scans, tasks,
 * outcomes, weather context) plus coarse summaries lifted from existing health
 * probes. Where the real data does not exist, the matching value is null and
 * the matching *Ready flag is false. Nothing is invented.
 *
 * PRIVACY / TENANT CONTRACT (enforced by this file's output shape):
 *   - No personally identifiable information (PII) is ever read into output.
 *     This runtime never exposes a farmer's name, phone, email, GPS / coords,
 *     or deviceId. `farmerId` is ALWAYS null here (no PII surrogate either).
 *   - `farmId` is either null or an OPAQUE reference taken from the active farm
 *     record (its own id field), never PII.
 *   - The view is tenant-scoped: it reflects only the single active farm stored
 *     on THIS device for THIS signed-in tenant. `tenantScoped: true` documents
 *     that contract. It does not aggregate across farmers or devices.
 *   - `noInventedHistory: true` documents that counts/history are read 1:1 from
 *     real stored data; missing fields are null / 'NEEDS_DATA', never guessed.
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

export const FARM_DIGITAL_TWIN_VERSION = 'farm-digital-twin-v1';

export interface FarmDigitalTwinEnvelope {
  runtimeVersion: 'farm-digital-twin-v1';
  initialized: true;
  farmProfileReady: boolean;
  plantHistoryReady: boolean;
  scanHistoryReady: boolean;
  taskHistoryReady: boolean;
  outcomeHistoryReady: boolean;
  weatherContextReady: boolean;
  noInventedHistory: true;
  tenantScoped: true;
  value: {
    farmId: string | null;
    farmerId: null;
    activePlants: number;
    scanHistory: number;
    taskHistory: number;
    outcomeHistory: number;
    weatherContext: string | null;
    healthSummary: string;
    riskSummary: string;
  };
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

// Derive an OPAQUE farm id from the active farm record. Only accepts an id-like
// field — never name/phone/email/coords/deviceId. Returns null when absent.
function _opaqueFarmId(activeFarm: any): string | null {
  return _safe(() => {
    const f = _obj(activeFarm);
    if (!f) return null;
    const candidates = [f.id, f.farmId, f.uid, f.ref, f.slug];
    for (const c of candidates) {
      if (c != null && (typeof c === 'string' || typeof c === 'number')) {
        const s = String(c).trim();
        if (s) return s;
      }
    }
    return null;
  }, null);
}

// Pull a coarse, human note off an existing health probe without leaking shape.
function _probeNote(probe: any): string | null {
  return _safe(() => {
    if (probe == null || typeof probe !== 'object') return null;
    const candidates = [
      (probe as any).summary,
      (probe as any).healthSummary,
      (probe as any).riskSummary,
      (probe as any).label,
      (probe as any).explanation,
      (probe as any).value && (probe as any).value.summary,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return null;
  }, null);
}

// Count OutcomeRecorded events in the real event log. No invention.
function _countOutcomes(eventLog: any[]): number {
  return _safe(() => {
    let n = 0;
    for (let i = 0; i < eventLog.length; i++) {
      const e: any = eventLog[i];
      if (!e || typeof e !== 'object') continue;
      const t = e.type ?? e.eventType ?? e.event ?? null;
      if (t != null && String(t) === 'OutcomeRecorded') n++;
    }
    return n;
  }, 0);
}

// Coarse weather note (no coords, no precise location) — or null.
function _weatherNote(lastWeather: any): string | null {
  return _safe(() => {
    const w = _obj(lastWeather);
    if (!w || !w.snapshotAt) return null;
    const parts: string[] = [];
    const cond = w.condition ?? w.summary ?? w.weather ?? null;
    if (cond != null && String(cond).trim()) parts.push(String(cond).trim());
    const temp = w.temp ?? w.temperature ?? null;
    if (typeof temp === 'number' && isFinite(temp)) {
      parts.push(Math.round(temp) + '°');
    }
    if (parts.length === 0) return 'Recent weather context available.';
    return parts.join(', ');
  }, null);
}

export function farmDigitalTwinHealth(): FarmDigitalTwinEnvelope {
  return _safe(
    () => {
      // --- real stored data (any of these may be absent) ---
      const activeFarm = _obj(_ls('farroway_active_farm'));
      const managedPlants = _arr(_ls('farroway_managed_plants'));
      const scanHistoryArr = _arr(_ls('farroway_scan_history_v1'));
      const cachedTasks = _arr(_ls('farroway_cached_tasks'));
      const eventLog = _arr(_ls('farroway_event_log'));
      const lastWeather = _obj(_winVar('__farrowayLastWeather'));

      // --- probes (any may be null) — coarse summaries only ---
      const farmHealth = _probe('__farmHealthScoreHealth');
      const weatherRisk = _probe('__weatherRiskHealth');
      const predictive = _probe('__predictiveHealth');
      const buyerTrust = _probe('__buyerTrustHealth');

      // --- counts from real data only (NEVER invented) ---
      const activePlants = managedPlants.length;
      const scanHistory = scanHistoryArr.length;
      const taskHistory = cachedTasks.length;
      const outcomeHistory = _countOutcomes(eventLog);

      // --- opaque farm id (or null) — never PII ---
      const farmId = _opaqueFarmId(activeFarm);

      // --- readiness flags: true ONLY if the real data exists ---
      const farmProfileReady = _safe(() => {
        if (!activeFarm) return false;
        const f: any = activeFarm;
        return !!(farmId || f.crop || f.cropStage || f.lifecycleStage);
      }, false);
      const plantHistoryReady = activePlants > 0;
      const scanHistoryReady = scanHistory > 0;
      const taskHistoryReady = taskHistory > 0;
      const outcomeHistoryReady = outcomeHistory > 0;

      const weatherContext = _weatherNote(lastWeather);
      const weatherContextReady = weatherContext != null;

      // --- coarse summaries lifted from existing probes (honest fallbacks) ---
      const healthSummary =
        _probeNote(farmHealth) ?? 'Not enough data yet';

      const riskSummary =
        _probeNote(weatherRisk) ?? _probeNote(predictive) ?? 'Not enough data yet';

      // coarse buyer-readiness context (used only to enrich explanation)
      const buyerReadinessNote = _probeNote(buyerTrust);

      // --- assemble honest data sources (only what we actually saw) ---
      const dataSources: string[] = [];
      if (farmProfileReady) dataSources.push('farroway_active_farm');
      if (plantHistoryReady) dataSources.push('farroway_managed_plants');
      if (scanHistoryReady) dataSources.push('farroway_scan_history_v1');
      if (taskHistoryReady) dataSources.push('farroway_cached_tasks');
      if (outcomeHistoryReady) dataSources.push('farroway_event_log');
      if (weatherContextReady) dataSources.push('window.__farrowayLastWeather');
      if (_probeNote(farmHealth)) dataSources.push('__farmHealthScoreHealth');
      if (_probeNote(weatherRisk)) dataSources.push('__weatherRiskHealth');
      if (_probeNote(predictive)) dataSources.push('__predictiveHealth');
      if (buyerReadinessNote) dataSources.push('__buyerTrustHealth');

      // --- readiness signal scaling (honest; single record stays "low") ---
      const readySignals =
        (farmProfileReady ? 1 : 0) +
        (plantHistoryReady ? 1 : 0) +
        (scanHistoryReady ? 1 : 0) +
        (taskHistoryReady ? 1 : 0) +
        (outcomeHistoryReady ? 1 : 0) +
        (weatherContextReady ? 1 : 0);

      let confidence: Confidence = 'low';
      if (readySignals >= 4 && (scanHistory >= 5 || outcomeHistory >= 2)) {
        confidence = 'high';
      } else if (readySignals >= 2) {
        confidence = 'medium';
      }

      // --- limitations note (constant, honest) ---
      const limitations =
        'This digital twin only reflects the single active farm saved on this ' +
        'device for the signed-in account. It is tenant-scoped and does not ' +
        'include other farms, other devices, deleted records, or anything not ' +
        'yet scanned or logged. No private farmer details (name, phone, email, ' +
        'location, or device id) are shown — the farm id is an opaque reference ' +
        'and farmer id is intentionally omitted. Counts and history are read ' +
        'directly from saved data and never invented. ' +
        GUIDANCE_TAIL;

      // --- honest empty fallback when no real signal exists at all ---
      const anyData =
        farmProfileReady ||
        plantHistoryReady ||
        scanHistoryReady ||
        taskHistoryReady ||
        outcomeHistoryReady ||
        weatherContextReady;

      const explanation = _safe(() => {
        if (!anyData) {
          return 'Not enough data yet — set up a farm and start scanning to ' +
            'build its digital twin.';
        }
        const bits: string[] = [];
        bits.push(
          'Read-only digital twin of the active farm on this device: ' +
            activePlants + ' active plant(s), ' +
            scanHistory + ' scan(s), ' +
            taskHistory + ' task(s), and ' +
            outcomeHistory + ' recorded outcome(s).',
        );
        if (weatherContext) bits.push('Weather context: ' + weatherContext + '.');
        if (healthSummary !== 'Not enough data yet') {
          bits.push('Health: ' + healthSummary + '.');
        }
        if (riskSummary !== 'Not enough data yet') {
          bits.push('Risk: ' + riskSummary + '.');
        }
        if (buyerReadinessNote) {
          bits.push('Buyer readiness context available.');
        }
        return bits.join(' ');
      }, 'Read-only digital twin of the active farm on this device.');

      const value = {
        farmId: anyData ? farmId : null,
        farmerId: null as null, // NO PII — intentionally always null
        activePlants,
        scanHistory,
        taskHistory,
        outcomeHistory,
        weatherContext: weatherContext ?? null,
        healthSummary,
        riskSummary,
      };

      return Object.freeze({
        runtimeVersion: 'farm-digital-twin-v1' as const,
        initialized: true as const,
        farmProfileReady,
        plantHistoryReady,
        scanHistoryReady,
        taskHistoryReady,
        outcomeHistoryReady,
        weatherContextReady,
        noInventedHistory: true as const,
        tenantScoped: true as const,
        value: Object.freeze(value),
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as FarmDigitalTwinEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: 'farm-digital-twin-v1' as const,
      initialized: true as const,
      farmProfileReady: false,
      plantHistoryReady: false,
      scanHistoryReady: false,
      taskHistoryReady: false,
      outcomeHistoryReady: false,
      weatherContextReady: false,
      noInventedHistory: true as const,
      tenantScoped: true as const,
      value: Object.freeze({
        farmId: null,
        farmerId: null as null,
        activePlants: 0,
        scanHistory: 0,
        taskHistory: 0,
        outcomeHistory: 0,
        weatherContext: null,
        healthSummary: 'Not enough data yet',
        riskSummary: 'Not enough data yet',
      }),
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        'Not enough data yet — set up a farm and start scanning to build its ' +
        'digital twin.',
      limitations:
        'This digital twin only reflects the single active farm saved on this ' +
        'device for the signed-in account. It is tenant-scoped and never shows ' +
        'private farmer details; the farm id is an opaque reference and farmer ' +
        'id is omitted. ' +
        GUIDANCE_TAIL,
    }) as FarmDigitalTwinEnvelope,
  );
}

export function installFarmDigitalTwinHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__farmDigitalTwinHealth !== 'function') {
      w.__farmDigitalTwinHealth = function () {
        const out = farmDigitalTwinHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Farm Digital Twin]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
