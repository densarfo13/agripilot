/**
 * Farroway · Crop Memory Engine (crop-memory-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()` and `_ls()` helpers below, and never fabricates history.
 *
 * For each plant / farm it summarizes the REAL stored history that exists,
 * and otherwise returns an honest "Not enough data yet" fallback.
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

export interface CropMemoryEnvelope {
  runtimeVersion: 'crop-memory-v1';
  initialized: true;
  scanHistoryReady: boolean;
  taskHistoryReady: boolean;
  outcomeHistoryReady: boolean;
  weatherContextReady: boolean;
  cropStageContextReady: boolean;
  counts: { scans: number; plants: number; events: number; tasks: number };
  value: any;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

export function cropMemoryHealth(): CropMemoryEnvelope {
  return _safe(
    () => {
      // --- real stored data (any of these may be absent) ---
      const scanHistory = _arr(_ls('farroway_scan_history_v1'));
      const managedPlants = _arr(_ls('farroway_managed_plants'));
      const eventLog = _arr(_ls('farroway_event_log'));
      const cachedTasks = _arr(_ls('farroway_cached_tasks'));
      const activeFarm = _obj(_ls('farroway_active_farm'));
      const lastWeather = _obj(_winVar('__farrowayLastWeather'));

      // --- probes (any may be null) ---
      const taskStore = _probe('__taskStoreHealth');
      const outcome = _probe('__outcomeHealth');
      const outcomeCapture = _probe('__outcomeCaptureHealth');

      // --- readiness flags ---
      const counts = {
        scans: scanHistory.length,
        plants: managedPlants.length,
        events: eventLog.length,
        tasks: cachedTasks.length,
      };

      const scanHistoryReady = counts.scans > 0;

      const taskStoreInitialized = _safe(
        () => !!(taskStore && (taskStore as any).initialized === true),
        false,
      );
      const taskHistoryReady = counts.tasks > 0 || taskStoreInitialized;

      const outcomeHistoryReady = !!(outcome || outcomeCapture);

      const weatherContextReady = _safe(
        () => !!(lastWeather && lastWeather.snapshotAt),
        false,
      );

      const cropStageContextReady = _safe(() => {
        if (!activeFarm) return false;
        const f: any = activeFarm;
        return !!(f.crop || f.cropStage || f.lifecycleStage);
      }, false);

      // --- assemble honest data sources (only what we actually saw) ---
      const dataSources: string[] = [];
      if (scanHistoryReady) dataSources.push('farroway_scan_history_v1');
      if (counts.plants > 0) dataSources.push('farroway_managed_plants');
      if (counts.events > 0) dataSources.push('farroway_event_log');
      if (counts.tasks > 0) dataSources.push('farroway_cached_tasks');
      if (cropStageContextReady) dataSources.push('farroway_active_farm');
      if (weatherContextReady) dataSources.push('window.__farrowayLastWeather');
      if (taskStoreInitialized) dataSources.push('__taskStoreHealth');
      if (outcome) dataSources.push('__outcomeHealth');
      if (outcomeCapture) dataSources.push('__outcomeCaptureHealth');

      const totalRecords =
        counts.scans + counts.plants + counts.events + counts.tasks;

      // --- limitations note (constant, honest) ---
      const limitations =
        'This memory only reflects what has been saved on this device so far. ' +
        'It does not include other devices, deleted records, or anything you have ' +
        'not yet scanned or logged. It is a summary of your own history, not advice ' +
        'about chemicals or treatments. ' +
        GUIDANCE_TAIL;

      // --- honest empty fallback ---
      if (totalRecords === 0) {
        const value = {
          summary: 'No crop memory yet.',
          plantsTracked: 0,
          scansRemembered: 0,
          eventsRemembered: 0,
          tasksRemembered: 0,
          newestScanAt: null,
          oldestScanAt: null,
          recentCrops: [],
          activeCrop: null,
          guidance:
            'Scan a plant to start building its memory. Once you do, this will ' +
            'gently show what you have seen and done over time. ' +
            GUIDANCE_TAIL,
        };

        return Object.freeze({
          runtimeVersion: 'crop-memory-v1',
          initialized: true as const,
          scanHistoryReady,
          taskHistoryReady,
          outcomeHistoryReady,
          weatherContextReady,
          cropStageContextReady,
          counts,
          value: Object.freeze(value),
          confidence: 'low' as Confidence,
          dataSources: Object.freeze([]) as unknown as string[],
          explanation: 'Not enough data yet — scan a plant to start its memory.',
          limitations,
        }) as CropMemoryEnvelope;
      }

      // --- summarize REAL scan history (defensively) ---
      const scanTimes: number[] = [];
      const cropTally: Record<string, number> = {};
      for (let i = 0; i < scanHistory.length; i++) {
        const s: any = scanHistory[i];
        if (!s || typeof s !== 'object') continue;
        const t = _safe(() => {
          const raw = s.timestamp ?? s.scannedAt ?? s.date ?? s.createdAt ?? null;
          if (raw == null) return NaN;
          const n = typeof raw === 'number' ? raw : Date.parse(String(raw));
          return Number.isFinite(n) ? n : NaN;
        }, NaN);
        if (Number.isFinite(t)) scanTimes.push(t);

        const cropName = _safe(() => {
          const c =
            s.crop ?? s.plant ?? s.plantName ?? s.species ?? s.cropName ?? null;
          return c != null && String(c).trim() ? String(c).trim() : null;
        }, null);
        if (cropName) cropTally[cropName] = (cropTally[cropName] || 0) + 1;
      }

      scanTimes.sort((a, b) => a - b);
      const oldestScanAt =
        scanTimes.length > 0 ? new Date(scanTimes[0]).toISOString() : null;
      const newestScanAt =
        scanTimes.length > 0
          ? new Date(scanTimes[scanTimes.length - 1]).toISOString()
          : null;

      const recentCrops = _safe(() => {
        return Object.keys(cropTally)
          .map((name) => ({ name, scans: cropTally[name] }))
          .sort((a, b) => b.scans - a.scans)
          .slice(0, 5);
      }, [] as { name: string; scans: number }[]);

      const activeCrop = _safe(() => {
        if (!activeFarm) return null;
        const f: any = activeFarm;
        const crop = f.crop ?? null;
        const stage = f.cropStage ?? f.lifecycleStage ?? null;
        if (!crop && !stage) return null;
        return {
          crop: crop ? String(crop) : null,
          stage: stage ? String(stage) : null,
        };
      }, null);

      // --- confidence from how much real memory exists ---
      // Honest scaling: a single record stays "low".
      let confidence: Confidence = 'low';
      const readySignals =
        (scanHistoryReady ? 1 : 0) +
        (taskHistoryReady ? 1 : 0) +
        (outcomeHistoryReady ? 1 : 0) +
        (weatherContextReady ? 1 : 0) +
        (cropStageContextReady ? 1 : 0);

      if (counts.scans >= 5 && readySignals >= 3) {
        confidence = 'high';
      } else if (counts.scans >= 2 || readySignals >= 2) {
        confidence = 'medium';
      }

      // --- farmer-facing guidance (calm, non-scary) ---
      const guidance = _safe(() => {
        const parts: string[] = [];
        if (counts.scans === 1) {
          parts.push('You have started this plant’s memory with one scan.');
        } else if (counts.scans > 1) {
          parts.push(
            'Your plant memory is growing — ' +
              counts.scans +
              ' scans saved so far.',
          );
        } else {
          parts.push('Some history is saved, though no scans yet.');
        }
        if (recentCrops.length > 0) {
          parts.push('Most-seen so far: ' + recentCrops[0].name + '.');
        }
        parts.push('Keep scanning to make this picture clearer over time.');
        return parts.join(' ') + ' ' + GUIDANCE_TAIL;
      }, 'Keep scanning to build a clearer picture over time. ' + GUIDANCE_TAIL);

      const explanation = _safe(() => {
        const bits: string[] = [];
        bits.push(
          'This is a summary of the real history saved on this device: ' +
            counts.scans +
            ' scan(s), ' +
            counts.plants +
            ' tracked plant(s), ' +
            counts.events +
            ' logged event(s), and ' +
            counts.tasks +
            ' saved task(s).',
        );
        if (newestScanAt) {
          bits.push('Most recent scan recorded ' + newestScanAt + '.');
        }
        if (activeCrop && (activeCrop.crop || activeCrop.stage)) {
          bits.push(
            'Active farm context: ' +
              [activeCrop.crop, activeCrop.stage].filter(Boolean).join(' / ') +
              '.',
          );
        }
        if (!outcomeHistoryReady) {
          bits.push('No outcome history is available yet.');
        }
        return bits.join(' ');
      }, 'Summary of the real history saved on this device.');

      const value = {
        summary:
          counts.scans > 0
            ? 'Crop memory summary across ' + counts.scans + ' scan(s).'
            : 'Crop memory summary from saved history.',
        plantsTracked: counts.plants,
        scansRemembered: counts.scans,
        eventsRemembered: counts.events,
        tasksRemembered: counts.tasks,
        newestScanAt,
        oldestScanAt,
        recentCrops,
        activeCrop,
        guidance,
      };

      return Object.freeze({
        runtimeVersion: 'crop-memory-v1',
        initialized: true as const,
        scanHistoryReady,
        taskHistoryReady,
        outcomeHistoryReady,
        weatherContextReady,
        cropStageContextReady,
        counts,
        value: Object.freeze(value),
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as CropMemoryEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: 'crop-memory-v1',
      initialized: true as const,
      scanHistoryReady: false,
      taskHistoryReady: false,
      outcomeHistoryReady: false,
      weatherContextReady: false,
      cropStageContextReady: false,
      counts: { scans: 0, plants: 0, events: 0, tasks: 0 },
      value: Object.freeze({
        summary: 'No crop memory yet.',
        plantsTracked: 0,
        scansRemembered: 0,
        eventsRemembered: 0,
        tasksRemembered: 0,
        newestScanAt: null,
        oldestScanAt: null,
        recentCrops: [],
        activeCrop: null,
        guidance:
          'Scan a plant to start building its memory. ' + GUIDANCE_TAIL,
      }),
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation: 'Not enough data yet — scan a plant to start its memory.',
      limitations:
        'This memory only reflects what has been saved on this device so far. ' +
        GUIDANCE_TAIL,
    }) as CropMemoryEnvelope,
  );
}

export function installCropMemoryHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__cropMemoryHealth !== 'function') {
      w.__cropMemoryHealth = function () {
        const out = cropMemoryHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Crop Memory]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
