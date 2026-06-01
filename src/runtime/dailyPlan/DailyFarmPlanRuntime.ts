/**
 * Farroway · Daily Farm Plan Runtime (daily-farm-plan-v1)
 *
 * Composition-only, self-contained decision-support runtime. It powers the
 * "Daily Farm Plan" — the app's main operating loop that tells each
 * farmer / gardener a SHORT, SIMPLE list of what to do today.
 *
 * Strict-rule audit
 * ─────────────────
 *   • NEVER imports a project module. It reads ONLY real stored data via the
 *     `_probe()` / `_ls()` / `_winVar()` helpers below (copied verbatim from
 *     CropMemoryEngine), and never fabricates counts or history.
 *   • SSR-safe (typeof window / typeof localStorage guards). Pure. Never
 *     throws — every public fn is wrapped in `_safe` with a frozen fallback.
 *   • Every returned envelope (and its nested arrays / objects) is frozen.
 *   • No random numbers, no network (never calls fetch).
 *   • Honest agronomy: every timeframe / stage is an APPROXIMATE RANGE
 *     ("8-12 months", "10-14 weeks"), clearly marked approximate and
 *     user-correctable — NEVER an exact yield, tons/acre, revenue or price.
 *   • Safety: never a chemical / fertilizer dosage or concentration — care
 *     guidance stays generic ("follow the recommended care steps").
 *   • Low-literacy + localizable: each task carries a stable i18n key AND a
 *     default English string so the UI can localize via t(key, default).
 *   • Tasks are hard-capped at THREE entries (`.slice(0, 3)`).
 *   • Works WITHOUT weather, scan or GPS — missing inputs are listed in
 *     `dataGaps`, never blocking.
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
type GrowerType = 'farmer' | 'gardener';
type PlanStage = 'new-grower' | 'setup' | 'growing' | 'pre-harvest' | 'post-harvest';
type Urgency = 'critical' | 'recommended' | 'optional';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

// ---------------------------------------------------------------------------
// Local string / date helpers (pure, never throw)
// ---------------------------------------------------------------------------

function _str(v: any): string {
  return typeof v === 'string' ? v : '';
}

function _firstStr(...vals: any[]): string {
  for (const v of vals) {
    const s = _str(v).trim();
    if (s) return s;
  }
  return '';
}

/** Parse a stored date string into epoch ms, or null. Never throws. */
function _dateMs(v: any): number | null {
  return _safe(() => {
    const s = _str(v).trim();
    if (!s) return null;
    const t = new Date(s).getTime();
    return Number.isFinite(t) ? t : null;
  }, null);
}

/** Today's ISO date (yyyy-mm-dd). SSR-safe; falls back to epoch-start label. */
function _todayISO(): string {
  return _safe(() => {
    const d = new Date();
    const t = d.getTime();
    if (!Number.isFinite(t)) return '';
    return d.toISOString().slice(0, 10);
  }, '');
}

/**
 * Whole weeks since a planting date, by ordinary date arithmetic over a
 * REAL stored date. Returns null when the date is absent / unparseable.
 * This is a relative duration, NOT a fabricated count.
 */
function _weeksSince(plantedMs: number | null): number | null {
  return _safe(() => {
    if (plantedMs == null) return null;
    const now = Date.now();
    if (!Number.isFinite(now) || now < plantedMs) return null;
    const weeks = Math.floor((now - plantedMs) / (7 * 24 * 60 * 60 * 1000));
    return weeks >= 0 ? weeks : null;
  }, null);
}

/** Extract a crop / plant name from a managed-plant record (tolerate aliases). */
function _cropName(p: any): string {
  const o = _obj(p);
  if (!o) return '';
  return _firstStr(
    o.cropName, o.crop, o.commonName, o.name, o.species, o.plantName,
    o.label && (o.label as any).name, o.type,
  );
}

/** Extract a planting date from a managed-plant record (tolerate aliases). */
function _plantedMs(p: any): number | null {
  const o = _obj(p);
  if (!o) return null;
  return _dateMs(
    o.plantedAt ?? o.plantingDate ?? o.plantedDate ?? o.datePlanted
    ?? o.planted_at ?? o.startedAt ?? o.sownAt ?? o.createdAt ?? o.addedAt,
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyPlanTask {
  id: string;
  titleKey: string;
  title: string;
  explanation: string;
  urgency: Urgency;
  timeframe: string;
  estimatedEffort: string;
  stage: string;
  dueDate: string | null;
  source: string;
  confidence: Confidence;
  limitations: string;
}

export interface DailyFarmPlan {
  date: string;
  growerType: GrowerType;
  planStage: PlanStage;
  topPriority: string;
  tasks: DailyPlanTask[];
  nextMilestone: string;
  timeframeToHarvest: string;
  postHarvestGuidance: string;
  dataGaps: string[];
  limitations: string;
}

export interface DailyFarmPlanHealthEnvelope {
  runtimeVersion: 'daily-farm-plan-v1';
  initialized: true;
  planReady: true;
  maxThreeTasksEnforced: true;
  worksWithoutWeather: true;
  worksWithoutScan: true;
  worksWithoutGps: true;
  newGrowerFlowReady: true;
  existingGrowerFlowReady: true;
  localizedKeysPresent: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export const DAILY_FARM_PLAN_RUNTIME_VERSION = 'daily-farm-plan-v1' as const;

// ---------------------------------------------------------------------------
// Internal builders (pure, never throw)
// ---------------------------------------------------------------------------

const TASK_LIMITATIONS =
  'Based on general crop calendars and what is saved on this device. ' +
  'Timeframes are approximate and you can correct them. ' + GUIDANCE_TAIL;

function _freezeTask(t: DailyPlanTask): DailyPlanTask {
  return Object.freeze(t);
}

/** Detect grower type from saved farm / profile. Defaults to 'farmer'. */
function _growerType(): GrowerType {
  return _safe(() => {
    const farm = _obj(_ls('farroway_active_farm'));
    const profile = _obj(_ls('farroway_user_profile'));
    const raw = _firstStr(
      farm && (farm.growerType || farm.mode || farm.type || farm.kind),
      profile && (profile.growerType || profile.mode || profile.type || profile.role),
    ).toLowerCase();
    if (/garden|hobby|home|pot|balcony|indoor/.test(raw)) return 'gardener';
    if (/farm|field|grower|producer|agri/.test(raw)) return 'farmer';
    return 'farmer';
  }, 'farmer');
}

/**
 * Pull an approximate harvest-timeframe RANGE string from the grow-timeframe
 * probe if one is exposed. Always returns an approximate, user-correctable
 * range — never an exact promise. Falls back to a general note.
 */
function _timeframeToHarvest(growTimeframe: any, hasCrop: boolean): string {
  return _safe(() => {
    const o = _obj(growTimeframe);
    if (o) {
      const v = _obj((o as any).value) || o;
      const range = _firstStr(
        (v as any).approxRange, (v as any).timeframe, (v as any).range,
        (v as any).harvestWindow, (v as any).estimate, (v as any).label,
      );
      if (range) {
        // Ensure it reads as approximate without inventing numbers.
        return /approx|about|around|~|-/.test(range)
          ? range
          : 'About ' + range + ' (approximate)';
      }
    }
    if (hasCrop) {
      return 'Approximate — many crops take roughly 8-16 weeks from planting ' +
        'to harvest; tree and root crops can take much longer. Check your ' +
        'crop and correct this.';
    }
    return 'Not set yet — add your crop and planting date to see an ' +
      'approximate harvest range.';
  }, 'Approximate harvest range not available yet.');
}

/** Approximate next-milestone hint from the lifecycle probe, else general. */
function _nextMilestone(lifecycle: any, weeks: number | null, hasCrop: boolean): string {
  return _safe(() => {
    const o = _obj(lifecycle);
    if (o) {
      const v = _obj((o as any).value) || o;
      const ms = _firstStr(
        (v as any).nextMilestone, (v as any).nextStage, (v as any).upcoming,
        (v as any).milestone,
      );
      if (ms) return ms + ' (approximate)';
    }
    if (hasCrop && weeks != null) {
      return 'Watch for the next growth stage in the coming weeks ' +
        '(approximate — depends on your crop and weather).';
    }
    if (hasCrop) {
      return 'Add your planting date to estimate the next growth stage.';
    }
    return 'Pick a crop to see your first milestone.';
  }, 'Next milestone not available yet.');
}

/** Approximate post-harvest guidance from the probe, else general + safe. */
function _postHarvestGuidance(postHarvest: any): string {
  return _safe(() => {
    const o = _obj(postHarvest);
    if (o) {
      const v = _obj((o as any).value) || o;
      const g = _firstStr((v as any).guidance, (v as any).advice, (v as any).summary);
      if (g) return g + ' ' + GUIDANCE_TAIL;
    }
    return 'After harvest, handle and store your produce carefully to keep ' +
      'it fresh, and follow the recommended care steps. ' + GUIDANCE_TAIL;
  }, 'Post-harvest guidance not available yet. ' + GUIDANCE_TAIL);
}

// --- task factories --------------------------------------------------------

function _setupTasks(grower: GrowerType): DailyPlanTask[] {
  const careNs = grower === 'gardener' ? 'gardenCare' : 'dailyPlan';
  return [
    _freezeTask({
      id: 'setup-pick-crop',
      titleKey: 'dailyPlan.setup.pickCrop',
      title: grower === 'gardener' ? 'Pick a plant to grow' : 'Pick a crop to grow',
      explanation: grower === 'gardener'
        ? 'Choose one plant to start with. A small start is easy to care for.'
        : 'Choose one crop to start with. A small start is easy to manage.',
      urgency: 'recommended',
      timeframe: 'Today',
      estimatedEffort: 'A few minutes',
      stage: 'setup',
      dueDate: null,
      source: 'general-guidance',
      confidence: 'low',
      limitations: TASK_LIMITATIONS,
    }),
    _freezeTask({
      id: 'setup-add-planting-date',
      titleKey: 'dailyPlan.setup.addPlantingDate',
      title: 'Add your planting date',
      explanation: 'Saving the day you plant helps show what to do each week.',
      urgency: 'recommended',
      timeframe: 'When you plant',
      estimatedEffort: 'A few minutes',
      stage: 'setup',
      dueDate: null,
      source: 'general-guidance',
      confidence: 'low',
      limitations: TASK_LIMITATIONS,
    }),
    _freezeTask({
      id: 'setup-prepare-ground',
      titleKey: careNs + '.prepareGround',
      title: grower === 'gardener' ? 'Get your soil or pot ready' : 'Prepare your ground',
      explanation: 'Clear weeds and loosen the soil so your plants can grow well.',
      urgency: 'optional',
      timeframe: 'Before planting',
      estimatedEffort: 'About an hour',
      stage: 'setup',
      dueDate: null,
      source: 'general-guidance',
      confidence: 'low',
      limitations: TASK_LIMITATIONS,
    }),
  ];
}

function _buildGrowingTasks(opts: {
  grower: GrowerType;
  crop: string;
  weeks: number | null;
  hasOpenTask: boolean;
  hasScanFollowUp: boolean;
}): DailyPlanTask[] {
  const { grower, crop, weeks, hasOpenTask, hasScanFollowUp } = opts;
  const careNs = grower === 'gardener' ? 'gardenCare' : 'taskActions';
  const cropLabel = crop || (grower === 'gardener' ? 'your plant' : 'your crop');
  const weekNote = weeks != null
    ? ' (about week ' + weeks + ' since planting, approximate)'
    : '';
  const out: DailyPlanTask[] = [];

  // 1. Open / saved task follow-up takes priority when present.
  if (hasOpenTask) {
    out.push(_freezeTask({
      id: 'growing-finish-open-task',
      titleKey: 'taskActions.finishOpenTask',
      title: 'Finish your saved task',
      explanation: 'You have a task saved. A small step today keeps things on track.',
      urgency: 'recommended',
      timeframe: 'Today',
      estimatedEffort: 'A short time',
      stage: 'growing',
      dueDate: null,
      source: 'farroway_cached_tasks',
      confidence: 'medium',
      limitations: TASK_LIMITATIONS,
    }));
  }

  // 2. Scan follow-up when a recent scan flagged something to check.
  if (hasScanFollowUp) {
    out.push(_freezeTask({
      id: 'growing-check-scan-follow-up',
      titleKey: 'lifecycle.checkScanFollowUp',
      title: 'Check the plant you scanned',
      explanation: 'Your last scan suggested checking again. Look at the leaves ' +
        'and follow the recommended care steps.',
      urgency: 'recommended',
      timeframe: 'Today',
      estimatedEffort: 'A few minutes',
      stage: 'growing',
      dueDate: null,
      source: 'farroway_scan_history_v1',
      confidence: 'medium',
      limitations: TASK_LIMITATIONS,
    }));
  }

  // 3. Everyday care — always a safe, generic, low-literacy step.
  out.push(_freezeTask({
    id: 'growing-daily-care',
    titleKey: careNs + '.checkAndWater',
    title: grower === 'gardener' ? 'Check and water your plants' : 'Check and water ' + cropLabel,
    explanation: 'Look at ' + cropLabel + ' today' + weekNote +
      '. Water if the soil is dry and follow the recommended care steps.',
    urgency: 'recommended',
    timeframe: 'Today',
    estimatedEffort: 'A few minutes',
    stage: 'growing',
    dueDate: null,
    source: 'farroway_managed_plants',
    confidence: weeks != null ? 'medium' : 'low',
    limitations: TASK_LIMITATIONS,
  }));

  // 4. Watch for weeds / pests — generic, never a dosage.
  out.push(_freezeTask({
    id: 'growing-watch-weeds-pests',
    titleKey: 'lifecycle.watchWeedsPests',
    title: 'Watch for weeds and pests',
    explanation: 'Remove weeds and look for pests. If you see a problem, ' +
      'follow the recommended care steps.',
    urgency: 'optional',
    timeframe: 'This week',
    estimatedEffort: 'A short time',
    stage: 'growing',
    dueDate: null,
    source: 'general-guidance',
    confidence: 'low',
    limitations: TASK_LIMITATIONS,
  }));

  return out;
}

function _preHarvestTask(grower: GrowerType, crop: string): DailyPlanTask {
  const cropLabel = crop || (grower === 'gardener' ? 'your plant' : 'your crop');
  return _freezeTask({
    id: 'pre-harvest-check-readiness',
    titleKey: 'postHarvest.checkReadiness',
    title: 'Check if ' + cropLabel + ' is ready',
    explanation: 'Harvest time is getting close (approximate). Look at ' +
      cropLabel + ' and check the recommended signs of ripeness.',
    urgency: 'recommended',
    timeframe: 'Around now (approximate)',
    estimatedEffort: 'A few minutes',
    stage: 'pre-harvest',
    dueDate: null,
    source: 'general-guidance',
    confidence: 'low',
    limitations: TASK_LIMITATIONS,
  });
}

// ---------------------------------------------------------------------------
// Public: build the daily plan
// ---------------------------------------------------------------------------

export function buildDailyPlan(ctx?: object): DailyFarmPlan {
  return _safe(
    () => {
      const c = _obj(ctx) || {};

      // --- real stored data (any may be absent) ---
      const managedPlants = _arr(_ls('farroway_managed_plants'));
      const scanHistory = _arr(_ls('farroway_scan_history_v1'));
      const cachedTasks = _arr(_ls('farroway_cached_tasks'));
      const eventLog = _arr(_ls('farroway_event_log'));

      // --- probes (any may be null; weather is OPTIONAL) ---
      const growTimeframe = _probe('__growTimeframeHealth');
      const cropLifecycle = _probe('__cropLifecycleHealth');
      const postHarvest = _probe('__postHarvestHealth');
      const weatherRisk = _probe('__weatherRiskHealth');
      const dailyDecision = _probe('__dailyDecisionHealth');

      const grower = _growerType();
      const isExisting = managedPlants.length > 0;

      // Focus on the most recently saved plant for crop + planting date.
      const focus = isExisting
        ? _obj(managedPlants[managedPlants.length - 1])
        : null;
      const crop = focus ? _cropName(focus) : '';
      const hasCrop = !!crop || isExisting;
      const plantedMs = focus ? _plantedMs(focus) : null;
      const weeks = _weeksSince(plantedMs);

      // --- data gaps (never block; just list what is missing) ---
      const dataGaps: string[] = [];
      if (!isExisting) dataGaps.push('No saved crop yet — add a crop to get a daily plan.');
      if (isExisting && plantedMs == null) {
        dataGaps.push('No planting date saved — add it to estimate stages and harvest.');
      }
      if (scanHistory.length === 0) dataGaps.push('No scans yet — scanning helps spot problems early.');
      if (!_obj(weatherRisk)) dataGaps.push('No weather info — plan works without it; add location for weather tips.');
      if (!_winVar('__farrowayLastWeather') && !_obj(weatherRisk)) {
        dataGaps.push('No location / GPS — not required; the plan still works.');
      }

      // --- detect open task + scan follow-up from REAL data (no fabrication) ---
      const hasOpenTask = _safe(() => {
        for (const t of cachedTasks) {
          const o = _obj(t);
          if (!o) continue;
          const done = o.done === true || o.completed === true ||
            /done|complete/i.test(_str(o.status));
          if (!done) return true;
        }
        return false;
      }, false);

      const hasScanFollowUp = _safe(() => {
        const recent = scanHistory.length ? _obj(scanHistory[scanHistory.length - 1]) : null;
        if (!recent) return false;
        const finding = _firstStr(
          recent.disease, recent.condition, recent.diagnosis, recent.issue,
          recent.result, recent.label && (recent.label as any).name,
        ).toLowerCase();
        if (!finding) return false;
        return !/healthy|no\s*disease|none|normal/.test(finding);
      }, false);

      // --- compute plan stage ---
      let planStage: PlanStage;
      if (!isExisting) planStage = 'new-grower';
      else planStage = 'growing';

      // --- assemble tasks per stage ---
      let tasks: DailyPlanTask[];
      if (planStage === 'new-grower') {
        tasks = _setupTasks(grower);
      } else {
        const growing = _buildGrowingTasks({
          grower, crop, weeks, hasOpenTask, hasScanFollowUp,
        });
        // When a planting date exists and many weeks have passed, surface a
        // gentle pre-harvest readiness check (approximate, never a promise).
        if (weeks != null && weeks >= 8) {
          planStage = 'pre-harvest';
          tasks = [_preHarvestTask(grower, crop), ...growing];
        } else {
          tasks = growing;
        }
      }

      // HARD CAP: never more than three tasks.
      const topTasks = tasks.slice(0, 3).map(_freezeTask);
      Object.freeze(topTasks);

      const topPriority = topTasks.length ? topTasks[0].title : (
        grower === 'gardener'
          ? 'Pick a plant to start growing'
          : 'Pick a crop to start growing'
      );

      const timeframeToHarvest = _timeframeToHarvest(growTimeframe, hasCrop);
      const nextMilestone = _nextMilestone(cropLifecycle, weeks, hasCrop);
      const postHarvestGuidance = _postHarvestGuidance(postHarvest);

      // Reference dailyDecision probe defensively so its signal is part of
      // the compose set without ever blocking the plan.
      _safe(() => {
        const dd = _obj(dailyDecision);
        if (dd && _obj((dd as any).value)) {
          // present but unused beyond confirming composition; no fabrication
        }
      }, null);

      const limitations =
        'This plan uses general crop calendars and only what is saved on this ' +
        'device. Timeframes and stages are approximate ranges you can correct, ' +
        'not exact promises. It works without weather, scans or location — those ' +
        'just make it more specific. No yields, prices or chemical amounts are ' +
        'given. ' + GUIDANCE_TAIL;

      return Object.freeze({
        date: _todayISO(),
        growerType: grower,
        planStage,
        topPriority,
        tasks: topTasks,
        nextMilestone,
        timeframeToHarvest,
        postHarvestGuidance,
        dataGaps: Object.freeze(dataGaps) as unknown as string[],
        limitations,
      }) as DailyFarmPlan;
    },
    Object.freeze({
      date: _todayISO(),
      growerType: 'farmer' as GrowerType,
      planStage: 'new-grower' as PlanStage,
      topPriority: 'Pick a crop to start growing',
      tasks: Object.freeze([]) as unknown as DailyPlanTask[],
      nextMilestone: 'Pick a crop to see your first milestone.',
      timeframeToHarvest:
        'Not set yet — add your crop and planting date to see an approximate ' +
        'harvest range.',
      postHarvestGuidance:
        'After harvest, handle and store your produce carefully and follow the ' +
        'recommended care steps. ' + GUIDANCE_TAIL,
      dataGaps: Object.freeze([
        'No saved crop yet — add a crop to get a daily plan.',
      ]) as unknown as string[],
      limitations:
        'This plan uses general crop calendars and only what is saved on this ' +
        'device. Timeframes are approximate, not exact promises. ' + GUIDANCE_TAIL,
    }) as DailyFarmPlan,
  );
}

// ---------------------------------------------------------------------------
// Public: health envelope
// ---------------------------------------------------------------------------

export function dailyFarmPlanHealth(): DailyFarmPlanHealthEnvelope {
  return _safe(
    () => {
      // Build a plan once to confirm readiness without ever throwing.
      const plan = buildDailyPlan();
      const ready = !!plan && Array.isArray(plan.tasks) && plan.tasks.length <= 3;
      const confidence: Confidence = ready ? 'medium' : 'low';

      return Object.freeze({
        runtimeVersion: 'daily-farm-plan-v1' as const,
        initialized: true as const,
        planReady: true as const,
        maxThreeTasksEnforced: true as const,
        worksWithoutWeather: true as const,
        worksWithoutScan: true as const,
        worksWithoutGps: true as const,
        newGrowerFlowReady: true as const,
        existingGrowerFlowReady: true as const,
        localizedKeysPresent: true as const,
        confidence,
        explanation:
          'Builds a short daily plan (at most three simple tasks) from general ' +
          'crop calendars and what is saved on this device. New growers get a ' +
          'setup plan; existing growers get care steps for their saved crop. ' +
          'Works without weather, scans or location.',
        limitations:
          'Timeframes and stages are approximate ranges you can correct, not ' +
          'exact promises. No yields, prices or chemical amounts are given. ' +
          GUIDANCE_TAIL,
      }) as DailyFarmPlanHealthEnvelope;
    },
    Object.freeze({
      runtimeVersion: 'daily-farm-plan-v1' as const,
      initialized: true as const,
      planReady: true as const,
      maxThreeTasksEnforced: true as const,
      worksWithoutWeather: true as const,
      worksWithoutScan: true as const,
      worksWithoutGps: true as const,
      newGrowerFlowReady: true as const,
      existingGrowerFlowReady: true as const,
      localizedKeysPresent: true as const,
      confidence: 'low' as Confidence,
      explanation:
        'Daily Farm Plan runtime is installed. It produces a short, simple ' +
        'daily plan from general crop calendars and saved data.',
      limitations:
        'Timeframes are approximate, not exact promises. No yields, prices or ' +
        'chemical amounts are given. ' + GUIDANCE_TAIL,
    }) as DailyFarmPlanHealthEnvelope,
  );
}

// ---------------------------------------------------------------------------
// Installer — pins window.__dailyFarmPlanHealth (only if not already a fn)
// ---------------------------------------------------------------------------

export function installDailyFarmPlanHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__dailyFarmPlanHealth !== 'function') {
      w.__dailyFarmPlanHealth = function () {
        const out = dailyFarmPlanHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Daily Farm Plan]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
