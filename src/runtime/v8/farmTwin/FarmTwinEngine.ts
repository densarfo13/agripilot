/**
 * Farroway · Farm Twin Engine (farm-twin-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()`, `_ls()` and `_winVar()` helpers below, and never fabricates
 * history.
 *
 * The "twin" is a digital reflection of what is ACTUALLY stored on this
 * device — the farm, its fields/plots, crops, scans, tasks, interventions and
 * outcomes. When data is missing it is shown honestly (false readiness flags
 * and an honest "Not enough data yet" message), never invented.
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

export const FARM_TWIN_ENGINE_VERSION = 'farm-twin-v1';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export interface FarmTwinEnvelope {
  runtimeVersion: 'farm-twin-v1';
  initialized: true;
  farmTimelineReady: boolean;
  cropHistoryReady: boolean;
  scanHistoryReady: boolean;
  taskHistoryReady: boolean;
  outcomeHistoryReady: boolean;
  weatherContextReady: boolean;
  buyerReadinessContextReady: boolean;
  value: any;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

// --- honest, constant limitations note (never invented) -------------------
const LIMITATIONS =
  'This twin only reflects what has actually been saved on this device so far. ' +
  'It does not include other devices, deleted records, or anything you have not ' +
  'yet logged. It is a calm reflection of your own stored farm history, not a ' +
  'yield, revenue, or treatment recommendation. ' +
  GUIDANCE_TAIL;

const EMPTY_VALUE = Object.freeze({
  summary: 'No farm twin yet.',
  farm: null,
  fieldsOrPlots: 0,
  crops: 0,
  scans: 0,
  tasks: 0,
  interventions: 0,
  outcomes: 0,
  guidance:
    'Set up your farm and log activity to start building its twin. Once you do, ' +
    'this will gently reflect what is actually stored. ' +
    GUIDANCE_TAIL,
});

const FALLBACK_ENVELOPE: FarmTwinEnvelope = Object.freeze({
  runtimeVersion: 'farm-twin-v1',
  initialized: true as const,
  farmTimelineReady: false,
  cropHistoryReady: false,
  scanHistoryReady: false,
  taskHistoryReady: false,
  outcomeHistoryReady: false,
  weatherContextReady: false,
  buyerReadinessContextReady: false,
  value: EMPTY_VALUE,
  confidence: 'low' as Confidence,
  dataSources: Object.freeze([]) as unknown as string[],
  explanation: 'Not enough data yet — set up your farm and log activity to build its twin.',
  limitations: LIMITATIONS,
}) as FarmTwinEnvelope;

export function farmTwinHealth(): FarmTwinEnvelope {
  return _safe(
    () => {
      // --- real stored data (any of these may be absent) ---
      const activeFarm = _obj(_ls('farroway_active_farm'));
      const managedPlants = _arr(_ls('farroway_managed_plants'));
      const scanHistory = _arr(_ls('farroway_scan_history_v1'));
      const cachedTasks = _arr(_ls('farroway_cached_tasks'));
      const eventLog = _arr(_ls('farroway_event_log'));
      const lastWeather = _obj(_winVar('__farrowayLastWeather'));

      // --- buyer readiness context probes (either may be null) ---
      const buyerTrust = _probe('__buyerTrustHealth');
      const marketplaceIntel = _probe('__marketplaceIntelligenceHealth');

      // --- derive fields/plots count from the real farm object only ---
      const fieldsOrPlots = _safe(() => {
        if (!activeFarm) return 0;
        const f: any = activeFarm;
        const fields = _arr(f.fields);
        if (fields.length > 0) return fields.length;
        const plots = _arr(f.plots);
        if (plots.length > 0) return plots.length;
        return 0;
      }, 0);

      // --- split the real event log into interventions vs outcomes ---
      // Honest classification: anything explicitly marked as an outcome/result
      // counts as an outcome; everything else logged is treated as an
      // intervention/action. No events are invented.
      let interventionCount = 0;
      let outcomeCount = 0;
      for (let i = 0; i < eventLog.length; i++) {
        const e: any = eventLog[i];
        if (!e || typeof e !== 'object') continue;
        const isOutcome = _safe(() => {
          const kind = String(
            e.kind ?? e.type ?? e.category ?? e.eventType ?? '',
          ).toLowerCase();
          if (kind.indexOf('outcome') >= 0 || kind.indexOf('result') >= 0)
            return true;
          if (kind.indexOf('harvest') >= 0) return true;
          return e.outcome != null || e.result != null;
        }, false);
        if (isOutcome) outcomeCount++;
        else interventionCount++;
      }

      // --- counts/summaries from real data only ---
      const counts = {
        fieldsOrPlots,
        crops: managedPlants.length,
        scans: scanHistory.length,
        tasks: cachedTasks.length,
        interventions: interventionCount,
        outcomes: outcomeCount,
      };

      // --- readiness flags: true ONLY if the real data exists ---
      const farmTimelineReady = _safe(() => {
        if (!activeFarm) return false;
        const f: any = activeFarm;
        return !!(
          f.id ||
          f.name ||
          f.crop ||
          f.cropStage ||
          f.lifecycleStage ||
          fieldsOrPlots > 0
        );
      }, false);

      const cropHistoryReady = counts.crops > 0;
      const scanHistoryReady = counts.scans > 0;
      const taskHistoryReady = counts.tasks > 0;
      const outcomeHistoryReady = counts.outcomes > 0;

      const weatherContextReady = _safe(
        () => !!(lastWeather && lastWeather.snapshotAt),
        false,
      );

      const buyerReadinessContextReady = !!(buyerTrust || marketplaceIntel);

      // --- assemble honest data sources (only what we actually saw) ---
      const dataSources: string[] = [];
      if (farmTimelineReady) dataSources.push('farroway_active_farm');
      if (cropHistoryReady) dataSources.push('farroway_managed_plants');
      if (scanHistoryReady) dataSources.push('farroway_scan_history_v1');
      if (taskHistoryReady) dataSources.push('farroway_cached_tasks');
      if (counts.interventions > 0 || counts.outcomes > 0)
        dataSources.push('farroway_event_log');
      if (weatherContextReady) dataSources.push('window.__farrowayLastWeather');
      if (buyerTrust) dataSources.push('__buyerTrustHealth');
      if (marketplaceIntel) dataSources.push('__marketplaceIntelligenceHealth');

      const totalRecords =
        counts.fieldsOrPlots +
        counts.crops +
        counts.scans +
        counts.tasks +
        counts.interventions +
        counts.outcomes;

      const hasAnyReflection = totalRecords > 0 || farmTimelineReady;

      // --- honest empty fallback: nothing real to reflect yet ---
      if (!hasAnyReflection) {
        return Object.freeze({
          runtimeVersion: 'farm-twin-v1',
          initialized: true as const,
          farmTimelineReady,
          cropHistoryReady,
          scanHistoryReady,
          taskHistoryReady,
          outcomeHistoryReady,
          weatherContextReady,
          buyerReadinessContextReady,
          value: EMPTY_VALUE,
          confidence: 'low' as Confidence,
          dataSources: Object.freeze([]) as unknown as string[],
          explanation:
            'Not enough data yet — set up your farm and log activity to build its twin.',
          limitations: LIMITATIONS,
        }) as FarmTwinEnvelope;
      }

      // --- summarize the REAL farm object (defensively, no invention) ---
      const farm = _safe(() => {
        if (!activeFarm) return null;
        const f: any = activeFarm;
        const name = _safe(() => {
          const n = f.name ?? f.farmName ?? f.title ?? null;
          return n != null && String(n).trim() ? String(n).trim() : null;
        }, null);
        const crop = _safe(() => {
          const c = f.crop ?? null;
          return c != null && String(c).trim() ? String(c).trim() : null;
        }, null);
        const stage = _safe(() => {
          const s = f.cropStage ?? f.lifecycleStage ?? null;
          return s != null && String(s).trim() ? String(s).trim() : null;
        }, null);
        const region = _safe(() => {
          const r = f.region ?? f.location ?? f.area ?? null;
          return r != null && String(r).trim() ? String(r).trim() : null;
        }, null);
        if (!name && !crop && !stage && !region && fieldsOrPlots === 0)
          return null;
        return Object.freeze({ name, crop, stage, region, fieldsOrPlots });
      }, null);

      // --- newest scan time from REAL scan history (defensively) ---
      const newestScanAt = _safe(() => {
        let newest = NaN;
        for (let i = 0; i < scanHistory.length; i++) {
          const s: any = scanHistory[i];
          if (!s || typeof s !== 'object') continue;
          const t = _safe(() => {
            const raw =
              s.timestamp ?? s.scannedAt ?? s.date ?? s.createdAt ?? null;
            if (raw == null) return NaN;
            const n = typeof raw === 'number' ? raw : Date.parse(String(raw));
            return Number.isFinite(n) ? n : NaN;
          }, NaN);
          if (Number.isFinite(t) && (!Number.isFinite(newest) || t > newest))
            newest = t;
        }
        return Number.isFinite(newest) ? new Date(newest).toISOString() : null;
      }, null);

      // --- confidence from how much real history is reflected -------------
      // Honest scaling: a single record / bare farm stays "low".
      let confidence: Confidence = 'low';
      const readySignals =
        (farmTimelineReady ? 1 : 0) +
        (cropHistoryReady ? 1 : 0) +
        (scanHistoryReady ? 1 : 0) +
        (taskHistoryReady ? 1 : 0) +
        (outcomeHistoryReady ? 1 : 0) +
        (weatherContextReady ? 1 : 0) +
        (buyerReadinessContextReady ? 1 : 0);

      if (readySignals >= 5 && totalRecords >= 5) {
        confidence = 'high';
      } else if (readySignals >= 3 || totalRecords >= 2) {
        confidence = 'medium';
      }

      // --- calm, non-scary, farmer-facing guidance ------------------------
      const guidance = _safe(() => {
        const parts: string[] = [];
        if (farm && farm.name) {
          parts.push('Your farm "' + farm.name + '" twin is taking shape.');
        } else if (farmTimelineReady) {
          parts.push('Your farm twin is taking shape.');
        } else {
          parts.push('Some activity is saved, though no farm profile yet.');
        }
        if (counts.crops > 0) {
          parts.push(counts.crops + ' crop(s) tracked.');
        }
        if (counts.scans > 0) {
          parts.push(counts.scans + ' scan(s) reflected.');
        }
        if (!outcomeHistoryReady) {
          parts.push(
            'No outcome history yet — keep logging to round out the picture.',
          );
        }
        parts.push('Keep logging activity to keep this reflection current.');
        return parts.join(' ') + ' ' + GUIDANCE_TAIL;
      }, 'Keep logging activity to keep your farm twin current. ' + GUIDANCE_TAIL);

      const value = Object.freeze({
        summary: 'Farm twin reflecting ' + totalRecords + ' saved record(s).',
        farm,
        fieldsOrPlots: counts.fieldsOrPlots,
        crops: counts.crops,
        scans: counts.scans,
        tasks: counts.tasks,
        interventions: counts.interventions,
        outcomes: counts.outcomes,
        newestScanAt,
        guidance,
      });

      const explanation = _safe(() => {
        const bits: string[] = [];
        bits.push(
          'This is a reflection of the real history saved on this device: ' +
            counts.fieldsOrPlots +
            ' field/plot(s), ' +
            counts.crops +
            ' tracked crop(s), ' +
            counts.scans +
            ' scan(s), ' +
            counts.tasks +
            ' task(s), ' +
            counts.interventions +
            ' logged intervention(s), and ' +
            counts.outcomes +
            ' recorded outcome(s).',
        );
        if (farm && (farm.crop || farm.stage)) {
          bits.push(
            'Active farm context: ' +
              [farm.crop, farm.stage].filter(Boolean).join(' / ') +
              '.',
          );
        }
        if (newestScanAt) {
          bits.push('Most recent scan recorded ' + newestScanAt + '.');
        }
        if (weatherContextReady) {
          bits.push('Recent weather context is available.');
        }
        if (buyerReadinessContextReady) {
          bits.push('Buyer-readiness context is available.');
        }
        return bits.join(' ');
      }, 'Reflection of the real farm history saved on this device.');

      return Object.freeze({
        runtimeVersion: 'farm-twin-v1',
        initialized: true as const,
        farmTimelineReady,
        cropHistoryReady,
        scanHistoryReady,
        taskHistoryReady,
        outcomeHistoryReady,
        weatherContextReady,
        buyerReadinessContextReady,
        value,
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations: LIMITATIONS,
      }) as FarmTwinEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    FALLBACK_ENVELOPE,
  );
}

export function installFarmTwinHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__farmTwinHealth !== 'function') {
      w.__farmTwinHealth = function () {
        const out = farmTwinHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Farm Twin]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
