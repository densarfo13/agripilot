/**
 * Farroway · Crop Lifecycle Engine (crop-lifecycle-v1)
 *
 * Composition-only, self-contained decision-support runtime for the Daily Farm Plan.
 * It NEVER imports a project module. It reads ONLY real stored / live data via the
 * `_probe()`, `_ls()` and `_winVar()` helpers below, and never fabricates history.
 *
 * Given a crop and an optional stored planting date, it estimates where in a coarse,
 * general crop calendar the plant likely is right now. Every timeframe is an
 * APPROXIMATE RANGE, clearly marked, user-correctable, and NEVER an exact guarantee.
 * It never states an exact yield, price, or chemical dosage. When no planting date is
 * known it returns an honest "Not enough data yet" fallback and general guidance.
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

export const CROP_LIFECYCLE_ENGINE_VERSION = 'crop-lifecycle-v1';

// --- ordered lifecycle stages -------------------------------------------

export type LifecycleStage =
  | 'pre_planting'
  | 'planting'
  | 'germination'
  | 'seedling'
  | 'vegetative'
  | 'flowering'
  | 'fruiting'
  | 'maturity'
  | 'harvest_ready'
  | 'post_harvest'
  | 'storage'
  | 'selling_ready';

const LIFECYCLE_STAGES: readonly LifecycleStage[] = Object.freeze([
  'pre_planting',
  'planting',
  'germination',
  'seedling',
  'vegetative',
  'flowering',
  'fruiting',
  'maturity',
  'harvest_ready',
  'post_harvest',
  'storage',
  'selling_ready',
]);

// Short, simple, localizable labels for each stage.
const STAGE_LABELS: Record<LifecycleStage, { key: string; default: string }> = Object.freeze({
  pre_planting: { key: 'lifecycle.stage.prePlanting', default: 'Before planting' },
  planting: { key: 'lifecycle.stage.planting', default: 'Planting' },
  germination: { key: 'lifecycle.stage.germination', default: 'Sprouting' },
  seedling: { key: 'lifecycle.stage.seedling', default: 'Young seedling' },
  vegetative: { key: 'lifecycle.stage.vegetative', default: 'Leafy growth' },
  flowering: { key: 'lifecycle.stage.flowering', default: 'Flowering' },
  fruiting: { key: 'lifecycle.stage.fruiting', default: 'Fruit forming' },
  maturity: { key: 'lifecycle.stage.maturity', default: 'Almost ready' },
  harvest_ready: { key: 'lifecycle.stage.harvestReady', default: 'Ready to harvest' },
  post_harvest: { key: 'lifecycle.stage.postHarvest', default: 'After harvest' },
  storage: { key: 'lifecycle.stage.storage', default: 'In storage' },
  selling_ready: { key: 'lifecycle.stage.sellingReady', default: 'Ready to sell' },
});

interface StageEnvelope {
  stage: LifecycleStage;
  titleKey: string;
  title: string;
}

function _stageInfo(stage: LifecycleStage): StageEnvelope {
  const label = STAGE_LABELS[stage] || STAGE_LABELS.pre_planting;
  return { stage, titleKey: label.key, title: label.default };
}

// --- coarse, general "weeks since planting" -> stage calendar -----------
// APPROXIMATE general ranges only. These are standard general crop-calendar
// bands, never crop-specific guarantees. Each band lists [minWeeks, stage].
// The first band whose minWeeks is <= weeks (scanning from highest down)
// is the current stage. Bands intentionally overlap reality loosely — they
// are starting points the user can correct, not exact timing.
interface CalendarBand {
  fromWeek: number;
  stage: LifecycleStage;
}

// General mapping used when no crop-specific range is available.
const GENERAL_CALENDAR: readonly CalendarBand[] = Object.freeze([
  { fromWeek: 0, stage: 'planting' },
  { fromWeek: 1, stage: 'germination' },
  { fromWeek: 2, stage: 'seedling' },
  { fromWeek: 4, stage: 'vegetative' },
  { fromWeek: 8, stage: 'flowering' },
  { fromWeek: 11, stage: 'fruiting' },
  { fromWeek: 14, stage: 'maturity' },
  { fromWeek: 16, stage: 'harvest_ready' },
]);

// General approximate harvest window (in weeks since planting) used when no
// crop-specific timeframe is available. Marked approximate everywhere.
const GENERAL_HARVEST = Object.freeze({ fromWeek: 14, toWeek: 18 });

function _weekToStage(weeks: number, calendar: readonly CalendarBand[]): LifecycleStage {
  return _safe(() => {
    let current: LifecycleStage = 'planting';
    for (let i = 0; i < calendar.length; i++) {
      const band = calendar[i];
      if (band && typeof band.fromWeek === 'number' && weeks >= band.fromWeek) {
        current = band.stage;
      }
    }
    return current;
  }, 'planting');
}

function _nextStage(stage: LifecycleStage): LifecycleStage | null {
  return _safe(() => {
    const idx = LIFECYCLE_STAGES.indexOf(stage);
    if (idx < 0 || idx >= LIFECYCLE_STAGES.length - 1) return null;
    return LIFECYCLE_STAGES[idx + 1];
  }, null);
}

// Parse a planting date (string or epoch ms/number) into epoch ms, or null.
function _parsePlantingDate(plantingDate?: string | number): number | null {
  return _safe(() => {
    if (plantingDate == null) return null;
    let ms: number;
    if (typeof plantingDate === 'number') {
      ms = plantingDate;
    } else {
      const raw = String(plantingDate).trim();
      if (!raw) return null;
      ms = Date.parse(raw);
    }
    if (!Number.isFinite(ms)) return null;
    // Reject obviously-future planting dates beyond a small clock-skew margin.
    const now = Date.now();
    if (ms > now + 86_400_000) return null; // more than ~1 day in the future
    return ms;
  }, null);
}

// Ordinary relative date arithmetic: whole weeks since planting (>= 0) or null.
function _weeksSince(plantedMs: number | null): number | null {
  return _safe(() => {
    if (plantedMs == null) return null;
    const now = Date.now();
    const diffMs = now - plantedMs;
    if (!Number.isFinite(diffMs) || diffMs < 0) return 0;
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  }, null);
}

// Read an optional crop-specific approximate calendar from a sibling runtime
// global, if one is installed. We make NO assumptions about its exact shape;
// we only accept clearly-numeric, non-fabricated ranges. Returns null if the
// global is absent or does not expose usable approximate weeks.
function _cropSpecific(cropKey: string): {
  calendar: readonly CalendarBand[];
  harvest: { fromWeek: number; toWeek: number };
  source: string;
} | null {
  return _safe(() => {
    const key = String(cropKey || '').trim().toLowerCase();
    if (!key) return null;
    const probed = _probe('__growTimeframeHealth');
    const root = _obj(probed);
    if (!root) return null;

    // Be permissive about where per-crop ranges might live, but only USE the
    // value if it gives finite numeric week bounds. Never invent numbers.
    const byCrop =
      _obj((root as any).byCrop) ||
      _obj((root as any).crops) ||
      _obj((root as any).value) ||
      null;
    const entry = byCrop ? _obj((byCrop as any)[key]) : null;
    if (!entry) return null;

    const harvestFrom = Number(
      (entry as any).harvestFromWeek ??
        (entry as any).fromWeek ??
        (entry as any).minWeeks ??
        NaN,
    );
    const harvestTo = Number(
      (entry as any).harvestToWeek ??
        (entry as any).toWeek ??
        (entry as any).maxWeeks ??
        NaN,
    );
    if (!Number.isFinite(harvestFrom) || !Number.isFinite(harvestTo)) return null;
    if (harvestFrom < 0 || harvestTo < harvestFrom) return null;

    // Build a coarse calendar anchored to the crop's approximate harvest band,
    // scaling the general band ratios so the harvest_ready band lines up.
    const span = harvestFrom > 0 ? harvestFrom : GENERAL_HARVEST.fromWeek;
    const ref = GENERAL_HARVEST.fromWeek || 14;
    const scale = span / ref;
    const calendar: CalendarBand[] = GENERAL_CALENDAR.map((b) => ({
      stage: b.stage,
      fromWeek: Math.max(0, Math.round(b.fromWeek * scale)),
    }));

    return {
      calendar: Object.freeze(calendar) as readonly CalendarBand[],
      harvest: Object.freeze({ fromWeek: harvestFrom, toWeek: harvestTo }),
      source: 'window.__growTimeframeHealth',
    };
  }, null);
}

export interface LifecycleEstimate {
  runtimeVersion: typeof CROP_LIFECYCLE_ENGINE_VERSION;
  cropKey: string | null;
  currentStage: LifecycleStage | 'unknown';
  currentStageLabel: StageEnvelope | null;
  weeksSincePlanting: number | null;
  expectedNextStage: StageEnvelope | null;
  approximateHarvestWindow: {
    approximate: true;
    label: string;
    labelKey: string;
    fromWeek: number | null;
    toWeek: number | null;
    text: string;
  } | null;
  approximateOnly: true;
  userCorrectable: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

const _UNKNOWN_ESTIMATE: LifecycleEstimate = Object.freeze({
  runtimeVersion: CROP_LIFECYCLE_ENGINE_VERSION,
  cropKey: null,
  currentStage: 'pre_planting',
  currentStageLabel: Object.freeze(_stageInfo('pre_planting')),
  weeksSincePlanting: null,
  expectedNextStage: Object.freeze(_stageInfo('planting')),
  approximateHarvestWindow: null,
  approximateOnly: true as const,
  userCorrectable: true as const,
  confidence: 'low' as Confidence,
  explanation:
    'Not enough data yet — add the planting date to see an approximate stage.',
  limitations:
    'Without a planting date this is only general guidance, not tied to your plant. ' +
    'All timeframes are approximate ranges you can correct. ' +
    GUIDANCE_TAIL,
}) as LifecycleEstimate;

export function estimateLifecycle(
  cropKey: string,
  plantingDate?: string | number,
): LifecycleEstimate {
  return _safe(() => {
    const key = _safe(() => {
      const k = String(cropKey ?? '').trim();
      return k ? k : null;
    }, null);

    const plantedMs = _parsePlantingDate(plantingDate);
    const weeks = _weeksSince(plantedMs);

    // No usable planting date -> honest pre-planting / general guidance.
    if (weeks == null) {
      const limitations =
        'Without a planting date this is only general guidance, not tied to your plant. ' +
        'All timeframes are approximate ranges you can correct. ' +
        GUIDANCE_TAIL;
      return Object.freeze({
        runtimeVersion: CROP_LIFECYCLE_ENGINE_VERSION,
        cropKey: key,
        currentStage: 'pre_planting' as const,
        currentStageLabel: Object.freeze(_stageInfo('pre_planting')),
        weeksSincePlanting: null,
        expectedNextStage: Object.freeze(_stageInfo('planting')),
        approximateHarvestWindow: null,
        approximateOnly: true as const,
        userCorrectable: true as const,
        confidence: 'low' as Confidence,
        explanation: key
          ? 'Not enough data yet — add the planting date for ' +
            key +
            ' to see an approximate stage.'
          : 'Not enough data yet — add the crop and planting date to see an approximate stage.',
        limitations,
      }) as LifecycleEstimate;
    }

    // Choose calendar + harvest window: crop-specific if available, else general.
    const specific = key ? _cropSpecific(key) : null;
    const calendar = specific ? specific.calendar : GENERAL_CALENDAR;
    const harvest = specific ? specific.harvest : GENERAL_HARVEST;
    const usedSpecific = !!specific;

    const currentStage = _weekToStage(weeks, calendar);
    const expectedNext = _nextStage(currentStage);

    // Approximate harvest window text (a RANGE, never an exact date or yield).
    const harvestText =
      'About ' +
      String(harvest.fromWeek) +
      '-' +
      String(harvest.toWeek) +
      ' weeks after planting (approximate)';
    const approximateHarvestWindow = Object.freeze({
      approximate: true as const,
      labelKey: 'lifecycle.harvest.approximateWindow',
      label: 'Approximate harvest window',
      fromWeek: harvest.fromWeek,
      toWeek: harvest.toWeek,
      text: harvestText,
    });

    // Confidence is a LABEL only, based on how much we actually know.
    // - high: we have a planting date AND a crop-specific approximate range.
    // - medium: we have a planting date but only the general calendar.
    // - low: very early / past expected harvest where general bands are loosest.
    let confidence: Confidence;
    if (usedSpecific) {
      confidence = 'high';
    } else if (currentStage === 'planting' || weeks > harvest.toWeek) {
      confidence = 'low';
    } else {
      confidence = 'medium';
    }

    const stageLabel = _stageInfo(currentStage);
    const explanation =
      'Based on about ' +
      String(weeks) +
      ' week' +
      (weeks === 1 ? '' : 's') +
      ' since planting' +
      (key ? ' for ' + key : '') +
      ', this is likely around "' +
      stageLabel.title +
      '". ' +
      (usedSpecific
        ? 'Using a crop-specific approximate calendar.'
        : 'Using a general approximate calendar.') +
      ' These are approximate ranges you can correct.';

    const limitations =
      'All stages and timeframes are approximate ranges based on a general crop ' +
      'calendar, not your exact plant or local weather. They are starting points ' +
      'you can correct, never an exact harvest date, yield, or guarantee. ' +
      'This gives no chemical, fertilizer, or treatment amounts — follow the ' +
      'recommended care steps. ' +
      GUIDANCE_TAIL;

    return Object.freeze({
      runtimeVersion: CROP_LIFECYCLE_ENGINE_VERSION,
      cropKey: key,
      currentStage,
      currentStageLabel: Object.freeze(stageLabel),
      weeksSincePlanting: weeks,
      expectedNextStage: expectedNext ? Object.freeze(_stageInfo(expectedNext)) : null,
      approximateHarvestWindow,
      approximateOnly: true as const,
      userCorrectable: true as const,
      confidence,
      explanation,
      limitations,
    }) as LifecycleEstimate;
  }, _UNKNOWN_ESTIMATE);
}

export interface CropLifecycleHealthEnvelope {
  runtimeVersion: typeof CROP_LIFECYCLE_ENGINE_VERSION;
  initialized: true;
  stagesReady: boolean;
  lifecycleMappingReady: boolean;
  approximateOnly: true;
  userCorrectable: true;
  stages: readonly LifecycleStage[];
  cropSpecificRangesAvailable: boolean;
  activePlantingContextReady: boolean;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function cropLifecycleHealth(): CropLifecycleHealthEnvelope {
  return _safe(
    () => {
      const stagesReady = LIFECYCLE_STAGES.length === 12;
      const lifecycleMappingReady = GENERAL_CALENDAR.length > 0;

      // Honest, real context checks (any may be absent).
      const probed = _obj(_probe('__growTimeframeHealth'));
      const cropSpecificRangesAvailable = !!(
        probed &&
        (_obj((probed as any).byCrop) ||
          _obj((probed as any).crops) ||
          _obj((probed as any).value))
      );

      // Do we have any stored planting context to estimate from?
      const activeFarm = _obj(_ls('farroway_active_farm'));
      const managedPlants = _arr(_ls('farroway_managed_plants'));
      const activePlantingContextReady = _safe(() => {
        if (activeFarm) {
          const f: any = activeFarm;
          if (f.plantingDate || f.plantedAt || f.sowDate) return true;
        }
        for (let i = 0; i < managedPlants.length; i++) {
          const p: any = managedPlants[i];
          if (p && typeof p === 'object' && (p.plantingDate || p.plantedAt || p.sowDate))
            return true;
        }
        return false;
      }, false);

      const confidence: Confidence = activePlantingContextReady
        ? cropSpecificRangesAvailable
          ? 'high'
          : 'medium'
        : 'low';

      const explanation = activePlantingContextReady
        ? 'Lifecycle stage estimates are ready and use approximate general ranges' +
          (cropSpecificRangesAvailable ? ', refined per crop where available.' : '.')
        : 'Not enough data yet — add a planting date to estimate the current stage. ' +
          'General approximate guidance is still available.';

      const limitations =
        'Every stage and timeframe is an approximate range from a general crop ' +
        'calendar, not your exact plant, local weather, or a promise. They are ' +
        'starting points you can correct, never an exact harvest date, yield, ' +
        'price, or guarantee. No chemical or treatment amounts are given. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: CROP_LIFECYCLE_ENGINE_VERSION,
        initialized: true as const,
        stagesReady,
        lifecycleMappingReady,
        approximateOnly: true as const,
        userCorrectable: true as const,
        stages: LIFECYCLE_STAGES,
        cropSpecificRangesAvailable,
        activePlantingContextReady,
        confidence,
        explanation,
        limitations,
      }) as CropLifecycleHealthEnvelope;
    },
    Object.freeze({
      runtimeVersion: CROP_LIFECYCLE_ENGINE_VERSION,
      initialized: true as const,
      stagesReady: false,
      lifecycleMappingReady: false,
      approximateOnly: true as const,
      userCorrectable: true as const,
      stages: LIFECYCLE_STAGES,
      cropSpecificRangesAvailable: false,
      activePlantingContextReady: false,
      confidence: 'low' as Confidence,
      explanation: 'Not enough data yet — add a planting date to estimate the current stage.',
      limitations:
        'Every stage and timeframe is an approximate range you can correct, never ' +
        'an exact harvest date, yield, price, or guarantee. ' +
        GUIDANCE_TAIL,
    }) as CropLifecycleHealthEnvelope,
  );
}

export function installCropLifecycleHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__cropLifecycleHealth !== 'function') {
      w.__cropLifecycleHealth = function () {
        const out = cropLifecycleHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Crop Lifecycle]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
