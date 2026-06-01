/**
 * Farroway · Yield Prediction Readiness Runtime (yield-prediction-readiness-v13)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via the
 * `_probe()`, `_ls()` and `_winVar()` helpers below, and never fabricates data.
 *
 * READINESS ONLY. This runtime does NOT build, run, or imitate a yield model.
 * It honestly reports whether enough REAL data exists across the inputs a
 * future yield model would need (crop cycles, planting dates, crop type,
 * weather history, scan history, task completion, outcome history, harvest
 * records). When data is short it returns the honest "Not enough data yet"
 * text with confidence 'low'.
 *
 * No yield/revenue figures, no fake ML output, no random numbers, no network.
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

export const YIELD_PREDICTION_READINESS_VERSION =
  'yield-prediction-readiness-v13' as const;

// --- minimum thresholds a future yield model would need ------------------
// Honest pilot-stage minimums. These intentionally stay modest, but at the
// pilot stage they are still rarely all met, so readiness is usually false.
const MIN_CROP_CYCLES = 3;
const MIN_HARVEST_OUTCOMES = 3;
const MIN_PLANTING_DATES = 3;
const MIN_CROP_TYPES = 1;
const MIN_SCANS = 5;
const MIN_COMPLETED_TASKS = 3;

export interface YieldPredictionReadinessEnvelope {
  runtimeVersion: typeof YIELD_PREDICTION_READINESS_VERSION;
  initialized: true;
  readyForYieldModel: boolean;
  cropCycleCount: number;
  harvestOutcomeCount: number;
  requiredMinimumsMet: boolean;
  missingData: string[];
  recommendation: string;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

function _isFiniteTime(raw: any): number {
  return _safe(() => {
    if (raw == null) return NaN;
    const n = typeof raw === 'number' ? raw : Date.parse(String(raw));
    return Number.isFinite(n) ? n : NaN;
  }, NaN);
}

export function yieldPredictionReadinessHealth(): YieldPredictionReadinessEnvelope {
  return _safe(
    () => {
      // --- real stored data (any of these may be absent) ---
      const managedPlants = _arr(_ls('farroway_managed_plants'));
      const scanHistory = _arr(_ls('farroway_scan_history_v1'));
      const cachedTasks = _arr(_ls('farroway_cached_tasks'));
      const eventLog = _arr(_ls('farroway_event_log'));

      // --- probes / window vars (any may be null) ---
      const harvestReadiness = _probe('__harvestReadinessHealth');
      const lastWeather = _obj(_winVar('__farrowayLastWeather'));

      // --- crop cycles + planting dates + crop types (from managed plants) ---
      let plantingDateCount = 0;
      const cropTypeSet: Record<string, true> = {};
      for (let i = 0; i < managedPlants.length; i++) {
        const p: any = managedPlants[i];
        if (!p || typeof p !== 'object') continue;

        const planted = _isFiniteTime(
          p.plantedAt ?? p.plantingDate ?? p.plantedDate ?? p.sowDate ?? p.startedAt ?? null,
        );
        if (Number.isFinite(planted)) plantingDateCount++;

        const cropType = _safe(() => {
          const c =
            p.crop ?? p.cropType ?? p.plant ?? p.plantName ?? p.species ?? p.cropName ?? null;
          return c != null && String(c).trim() ? String(c).trim().toLowerCase() : null;
        }, null);
        if (cropType) cropTypeSet[cropType] = true;
      }
      // A managed plant with a planting date is treated as one crop cycle of
      // record. We never invent cycles beyond what is actually stored.
      const cropCycleCount = plantingDateCount;
      const cropTypeCount = Object.keys(cropTypeSet).length;

      // --- harvest / outcome history (from event log + harvest probe) ---
      let eventOutcomeCount = 0;
      for (let i = 0; i < eventLog.length; i++) {
        const e: any = eventLog[i];
        if (!e || typeof e !== 'object') continue;
        const type = _safe(() => {
          const t = e.type ?? e.event ?? e.name ?? e.kind ?? null;
          return t != null ? String(t) : '';
        }, '');
        if (type === 'OutcomeRecorded' || type === 'HarvestReadinessChecked') {
          eventOutcomeCount++;
        }
      }

      // The harvest readiness probe may report its own count of recorded
      // harvest evaluations. Read it defensively; treat it as additive,
      // honest evidence (never fabricated when absent).
      const harvestProbeCount = _safe(() => {
        if (!harvestReadiness || typeof harvestReadiness !== 'object') return 0;
        const h: any = harvestReadiness;
        const candidates = [
          h.harvestRecordCount,
          h.evaluationCount,
          h.recordsCount,
          h.recordCount,
          h.harvestCount,
          h.value && h.value.recordCount,
          h.value && h.value.evaluationCount,
        ];
        for (let i = 0; i < candidates.length; i++) {
          const n = candidates[i];
          if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return n;
        }
        return 0;
      }, 0);

      const harvestProbeAvailable = !!(
        harvestReadiness && typeof harvestReadiness === 'object'
      );

      const harvestOutcomeCount = eventOutcomeCount + harvestProbeCount;

      // --- scan history count ---
      const scanCount = scanHistory.length;

      // --- completed task count (defensive over multiple shapes) ---
      let completedTaskCount = 0;
      for (let i = 0; i < cachedTasks.length; i++) {
        const t: any = cachedTasks[i];
        if (!t || typeof t !== 'object') continue;
        const done = _safe(() => {
          if (t.completed === true || t.done === true || t.isComplete === true) return true;
          const status = t.status ?? t.state ?? null;
          if (status != null) {
            const s = String(status).toLowerCase();
            return s === 'completed' || s === 'complete' || s === 'done';
          }
          return false;
        }, false);
        if (done) completedTaskCount++;
      }

      // --- weather history readiness (relative recency only) ---
      const weatherContextReady = _safe(() => {
        if (!lastWeather) return false;
        const w: any = lastWeather;
        const stamp = _isFiniteTime(w.snapshotAt ?? w.timestamp ?? w.fetchedAt ?? w.at ?? null);
        if (!Number.isFinite(stamp)) {
          // No timestamp but a weather object exists — count it as present.
          return !!(w.snapshotAt || w.temp || w.temperature || w.summary || w.conditions);
        }
        // Use the current time ONLY as a recency cutoff against the record's
        // own stored timestamp (30 days). Never used as a data signal.
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        return _safe(() => Date.now() - stamp <= THIRTY_DAYS, true);
      }, false);

      // --- per-input minimum checks ---
      const checks: { ok: boolean; missing: string }[] = [
        {
          ok: cropCycleCount >= MIN_CROP_CYCLES,
          missing:
            'crop cycles (' + cropCycleCount + ' of ' + MIN_CROP_CYCLES + ' needed)',
        },
        {
          ok: plantingDateCount >= MIN_PLANTING_DATES,
          missing:
            'planting dates (' + plantingDateCount + ' of ' + MIN_PLANTING_DATES + ' needed)',
        },
        {
          ok: cropTypeCount >= MIN_CROP_TYPES,
          missing: 'crop type on tracked plants',
        },
        {
          ok: harvestOutcomeCount >= MIN_HARVEST_OUTCOMES,
          missing:
            'harvest / outcome records (' +
            harvestOutcomeCount +
            ' of ' +
            MIN_HARVEST_OUTCOMES +
            ' needed)',
        },
        {
          ok: scanCount >= MIN_SCANS,
          missing: 'scan history (' + scanCount + ' of ' + MIN_SCANS + ' needed)',
        },
        {
          ok: completedTaskCount >= MIN_COMPLETED_TASKS,
          missing:
            'completed tasks (' +
            completedTaskCount +
            ' of ' +
            MIN_COMPLETED_TASKS +
            ' needed)',
        },
        {
          ok: weatherContextReady,
          missing: 'recent weather history',
        },
      ];

      const missingData: string[] = [];
      for (let i = 0; i < checks.length; i++) {
        if (!checks[i].ok) missingData.push(checks[i].missing);
      }

      const requiredMinimumsMet = missingData.length === 0;
      const readyForYieldModel = requiredMinimumsMet;

      // --- honest data sources (only what we actually saw) ---
      const dataSources: string[] = [];
      if (managedPlants.length > 0) dataSources.push('farroway_managed_plants');
      if (scanCount > 0) dataSources.push('farroway_scan_history_v1');
      if (cachedTasks.length > 0) dataSources.push('farroway_cached_tasks');
      if (eventLog.length > 0) dataSources.push('farroway_event_log');
      if (harvestProbeAvailable) dataSources.push('__harvestReadinessHealth');
      if (weatherContextReady) dataSources.push('window.__farrowayLastWeather');

      // --- honest limitations (constant) ---
      const limitations =
        'This only reports whether enough real, locally-stored history exists to ' +
        'support a future yield model — it does not forecast any yield, tonnage, ' +
        'bag count, or revenue, and it is not a yield prediction. It reflects only ' +
        'records saved on this device so far, not other devices or deleted records. ' +
        GUIDANCE_TAIL;

      // --- honest empty / insufficient fallback ---
      const anyData =
        managedPlants.length > 0 ||
        scanCount > 0 ||
        cachedTasks.length > 0 ||
        eventLog.length > 0 ||
        harvestProbeAvailable ||
        weatherContextReady;

      if (!anyData) {
        return Object.freeze({
          runtimeVersion: YIELD_PREDICTION_READINESS_VERSION,
          initialized: true as const,
          readyForYieldModel: false,
          cropCycleCount: 0,
          harvestOutcomeCount: 0,
          requiredMinimumsMet: false,
          missingData: Object.freeze(
            missingData.slice(),
          ) as unknown as string[],
          recommendation:
            'Start tracking plants with planting dates, scan regularly, and log ' +
            'harvest outcomes to begin building the history a yield model would need. ' +
            GUIDANCE_TAIL,
          confidence: 'low' as Confidence,
          dataSources: Object.freeze([]) as unknown as string[],
          explanation:
            'Not enough data yet — no crop cycles, scans, tasks, or harvest ' +
            'outcomes have been saved on this device.',
          limitations,
        }) as YieldPredictionReadinessEnvelope;
      }

      // --- confidence: a LABEL describing how complete the inputs are ---
      const metCount = checks.length - missingData.length;
      let confidence: Confidence = 'low';
      if (requiredMinimumsMet) {
        confidence = 'high';
      } else if (metCount >= Math.ceil(checks.length / 2)) {
        confidence = 'medium';
      }

      // --- plain next-step recommendation ---
      const recommendation = _safe(() => {
        if (requiredMinimumsMet) {
          return (
            'Enough real history is now saved across crop cycles, scans, tasks, ' +
            'weather, and harvest outcomes to consider a yield model in a later ' +
            'release. Keep logging consistently to keep this picture current. ' +
            GUIDANCE_TAIL
          );
        }
        const next = missingData.length > 0 ? missingData[0] : 'more history';
        return (
          'Not enough data yet for a yield model. Next, focus on adding ' +
          next +
          '. Keep tracking plants, scanning, and logging harvest outcomes over ' +
          'full crop cycles. ' +
          GUIDANCE_TAIL
        );
      }, 'Keep tracking plants and logging outcomes to build readiness. ' + GUIDANCE_TAIL);

      // --- explanation (honest summary of what was counted) ---
      const explanation = _safe(() => {
        if (!requiredMinimumsMet) {
          return (
            'Not enough data yet — this device has ' +
            cropCycleCount +
            ' crop cycle(s) with planting dates, ' +
            cropTypeCount +
            ' crop type(s), ' +
            scanCount +
            ' scan(s), ' +
            completedTaskCount +
            ' completed task(s), and ' +
            harvestOutcomeCount +
            ' harvest/outcome record(s). Several inputs a yield model would need ' +
            'are still short.'
          );
        }
        return (
          'This device has ' +
          cropCycleCount +
          ' crop cycle(s) with planting dates, ' +
          cropTypeCount +
          ' crop type(s), ' +
          scanCount +
          ' scan(s), ' +
          completedTaskCount +
          ' completed task(s), and ' +
          harvestOutcomeCount +
          ' harvest/outcome record(s). The minimum inputs a yield model would ' +
          'need now appear present. This remains a readiness check, not a forecast.'
        );
      }, 'Summary of the real readiness inputs saved on this device.');

      return Object.freeze({
        runtimeVersion: YIELD_PREDICTION_READINESS_VERSION,
        initialized: true as const,
        readyForYieldModel,
        cropCycleCount,
        harvestOutcomeCount,
        requiredMinimumsMet,
        missingData: Object.freeze(missingData) as unknown as string[],
        recommendation,
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as YieldPredictionReadinessEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: YIELD_PREDICTION_READINESS_VERSION,
      initialized: true as const,
      readyForYieldModel: false,
      cropCycleCount: 0,
      harvestOutcomeCount: 0,
      requiredMinimumsMet: false,
      missingData: Object.freeze([
        'crop cycles',
        'planting dates',
        'crop type on tracked plants',
        'harvest / outcome records',
        'scan history',
        'completed tasks',
        'recent weather history',
      ]) as unknown as string[],
      recommendation:
        'Start tracking plants with planting dates, scan regularly, and log ' +
        'harvest outcomes to begin building the history a yield model would need. ' +
        GUIDANCE_TAIL,
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        'Not enough data yet — readiness inputs could not be read on this device.',
      limitations:
        'This only reports whether enough real, locally-stored history exists to ' +
        'support a future yield model — it does not forecast any yield, tonnage, ' +
        'bag count, or revenue, and it is not a yield prediction. It reflects only ' +
        'records saved on this device so far, not other devices or deleted records. ' +
        GUIDANCE_TAIL,
    }) as YieldPredictionReadinessEnvelope,
  );
}

export function installYieldPredictionReadinessHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__yieldPredictionReadinessHealth !== 'function') {
      w.__yieldPredictionReadinessHealth = function () {
        const out = yieldPredictionReadinessHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Yield Prediction Readiness]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
