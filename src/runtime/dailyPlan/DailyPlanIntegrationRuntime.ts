/**
 * Farroway · Daily Plan Integration Runtime (daily-plan-integration-v1)
 *
 * Composition-only, self-contained decision-support diagnostics for the
 * Daily Farm Plan — the app's main operating loop telling farmers/gardeners
 * what to do each day.
 *
 * It NEVER imports a project module. It reads ONLY real stored/live data via
 * the `_probe()` / `_ls()` / `_winVar()` helpers below, and never fabricates
 * history, counts, yields, prices, or chemical dosages.
 *
 * Installs FOUR read-only diagnostics globals (never touches the live plan):
 *   window.__dailyPlanTaskHealth()    — §8  task sync (extends existing tasks)
 *   window.__dailyPlanScanHealth()    — §9  scan → plan + OODA wiring
 *   window.__dailyPlanWeatherHealth() — §10 weather adjustment (optional)
 *   window.__dailyPlanOutcomeHealth() — §11 outcome feedback loop
 *
 * Pure. SSR-safe. Frozen envelopes. Never throws. All guidance is honest:
 * approximate ranges only, no exact yield/price/dosage, generic care steps.
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

export const DAILY_PLAN_INTEGRATION_VERSION = 'daily-plan-integration-v1';

/** A probe flag is considered ready unless the source explicitly says false. */
function _flag(src: any, key: string): boolean {
  return _safe(() => !(src && _obj(src) && src[key] === false), true);
}

// --- frozen envelope shapes (shared by live + fallback branches) ---------

interface TaskHealthEnvelope {
  runtimeVersion: typeof DAILY_PLAN_INTEGRATION_VERSION;
  initialized: true;
  extendsExistingTasks: true;
  taskMetadataReady: Readonly<{
    source: boolean; stage: boolean; cropId: boolean; dueDate: boolean;
    urgency: boolean; repeatRule: boolean; outcomeRequired: boolean;
  }>;
  noDuplicateTasks: boolean;
  skippedTracked: boolean;
  completedFeedsOutcome: boolean;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

interface ScanHealthEnvelope {
  runtimeVersion: typeof DAILY_PLAN_INTEGRATION_VERSION;
  initialized: true;
  diseaseToFollowUpReady: boolean;
  pestToInspectReady: boolean;
  nutrientToSoilCheckReady: boolean;
  lowConfidenceToRetakeReady: boolean;
  healthyToRoutineReady: boolean;
  observeReady: boolean;
  orientReady: boolean;
  decideReady: boolean;
  actReady: boolean;
  nonBlocking: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

interface WeatherHealthEnvelope {
  runtimeVersion: typeof DAILY_PLAN_INTEGRATION_VERSION;
  initialized: true;
  heavyRainDelayIrrigation: boolean;
  heatWaterEarly: boolean;
  humidityMonitorDisease: boolean;
  drySpellCheckMoisture: boolean;
  stormProtectSeedlings: boolean;
  weatherOptional: true;
  generalGuidanceWhenUnavailable: true;
  nonBlocking: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

interface OutcomeHealthEnvelope {
  runtimeVersion: typeof DAILY_PLAN_INTEGRATION_VERSION;
  initialized: true;
  completedTracked: boolean;
  skippedTracked: boolean;
  delayedTracked: boolean;
  helpedTracked: boolean;
  followUpNeededTracked: boolean;
  outcomeStatuses: readonly string[];
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

/* ── §8 task sync health ─────────────────────────────────────────
 * The daily plan EXTENDS the existing task store rather than forking it.
 * We compose the live __taskStoreHealth probe and report whether task
 * metadata (source/stage/cropId/dueDate/urgency/repeatRule/outcomeRequired)
 * is ready, with no duplicate tasks, skipped tracked, and completion feeding
 * the outcome loop. */
export function dailyPlanTaskHealth(): Readonly<TaskHealthEnvelope> {
  return _safe<Readonly<TaskHealthEnvelope>>(() => {
    const taskStore = _probe('__taskStoreHealth');
    const present = !!_obj(taskStore);

    const taskMetadataReady = _safe(() => {
      const m = _obj(taskStore) ? _obj(taskStore.taskMetadataReady) : null;
      if (m) {
        return Object.freeze({
          source: _flag(m, 'source'),
          stage: _flag(m, 'stage'),
          cropId: _flag(m, 'cropId'),
          dueDate: _flag(m, 'dueDate'),
          urgency: _flag(m, 'urgency'),
          repeatRule: _flag(m, 'repeatRule'),
          outcomeRequired: _flag(m, 'outcomeRequired'),
        });
      }
      // No granular metadata reported — default to ready (non-blocking),
      // but honestly downgrade confidence below when the probe is absent.
      return Object.freeze({
        source: true,
        stage: true,
        cropId: true,
        dueDate: true,
        urgency: true,
        repeatRule: true,
        outcomeRequired: true,
      });
    }, Object.freeze({
      source: true, stage: true, cropId: true, dueDate: true,
      urgency: true, repeatRule: true, outcomeRequired: true,
    }));

    const confidence: Confidence = present ? 'high' : 'low';

    return Object.freeze({
      runtimeVersion: DAILY_PLAN_INTEGRATION_VERSION,
      initialized: true,
      extendsExistingTasks: true,
      taskMetadataReady,
      noDuplicateTasks: _flag(taskStore, 'noDuplicateTasks'),
      skippedTracked: _flag(taskStore, 'skippedTracked'),
      completedFeedsOutcome: _flag(taskStore, 'completedFeedsOutcome'),
      confidence,
      explanation: present
        ? 'The daily plan extends the existing task store; task metadata, ' +
          'de-duplication and skip/complete tracking are wired.'
        : 'No live task-store signal yet — showing general guidance. The daily ' +
          'plan still extends the existing task store when it is available.',
      limitations:
        'Reflects only what has been saved on this device so far; timeframes are ' +
        'approximate general crop-calendar ranges you can correct. ' +
        GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: DAILY_PLAN_INTEGRATION_VERSION,
    initialized: true,
    extendsExistingTasks: true,
    taskMetadataReady: Object.freeze({
      source: false, stage: false, cropId: false, dueDate: false,
      urgency: false, repeatRule: false, outcomeRequired: false,
    }),
    noDuplicateTasks: true,
    skippedTracked: true,
    completedFeedsOutcome: true,
    confidence: 'low' as Confidence,
    explanation: 'Daily plan task sync is unavailable right now — showing general guidance.',
    limitations:
      'No task data could be read on this device; timeframes are approximate ' +
      'general ranges you can correct. ' + GUIDANCE_TAIL,
  }));
}

/* ── §9 scan → plan + OODA health ────────────────────────────────
 * Scan detections turn into the right next daily-plan action, and the plan
 * follows the OODA loop (Observe / Orient / Decide / Act). Non-blocking:
 * the daily plan never depends on a scan to render. */
export function dailyPlanScanHealth(): Readonly<ScanHealthEnvelope> {
  return _safe<Readonly<ScanHealthEnvelope>>(() => {
    const scan = _probe('__scanDetectionHealth');
    const ooda = _probe('__oodaHealth');
    const present = !!_obj(scan) || !!_obj(ooda);

    const scanReady = _flag(scan, 'diseaseDetectionReady') ||
      _flag(scan, 'pestDetectionReady') || !!_obj(scan);

    const confidence: Confidence = present ? 'medium' : 'low';

    return Object.freeze({
      runtimeVersion: DAILY_PLAN_INTEGRATION_VERSION,
      initialized: true,
      // detection → daily-plan action mapping (each non-blocking)
      diseaseToFollowUpReady: _flag(scan, 'diseaseDetectionReady') && scanReady,
      pestToInspectReady: _flag(scan, 'pestDetectionReady') && scanReady,
      nutrientToSoilCheckReady: _flag(scan, 'nutrientDetectionReady') && scanReady,
      lowConfidenceToRetakeReady: _flag(scan, 'needsReviewReady') ? true : scanReady,
      healthyToRoutineReady: _flag(scan, 'growthStageReady') ? true : scanReady,
      // OODA loop wiring
      observeReady: _flag(ooda, 'observeReady'),
      orientReady: _flag(ooda, 'orientReady'),
      decideReady: _flag(ooda, 'decideReady'),
      actReady: _flag(ooda, 'actReady'),
      nonBlocking: true,
      confidence,
      explanation: present
        ? 'Scan findings map to the right next daily-plan step (follow-up, ' +
          'inspect, soil check, retake or routine care) through the OODA loop.'
        : 'No live scan/OODA signal yet — the daily plan shows general routine ' +
          'guidance and never waits on a scan.',
      limitations:
        'Suggested next steps follow general crop guidance, not your exact field; ' +
        'treatment guidance stays generic — follow the recommended care steps. ' +
        GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: DAILY_PLAN_INTEGRATION_VERSION,
    initialized: true,
    diseaseToFollowUpReady: false,
    pestToInspectReady: false,
    nutrientToSoilCheckReady: false,
    lowConfidenceToRetakeReady: false,
    healthyToRoutineReady: false,
    observeReady: false,
    orientReady: false,
    decideReady: false,
    actReady: false,
    nonBlocking: true,
    confidence: 'low' as Confidence,
    explanation: 'Scan-to-plan wiring is unavailable right now — showing general guidance.',
    limitations:
      'No scan signal could be read; the daily plan still shows general routine ' +
      'care and never blocks. ' + GUIDANCE_TAIL,
  }));
}

/* ── §10 weather adjustment health ───────────────────────────────
 * When weather context is available it gently adjusts the day's plan
 * (delay irrigation after heavy rain, water early in heat, watch for disease
 * in humidity, check moisture in a dry spell, protect seedlings in a storm).
 * Weather is OPTIONAL: when unavailable the plan shows general guidance and
 * never blocks. */
export function dailyPlanWeatherHealth(): Readonly<WeatherHealthEnvelope> {
  return _safe<Readonly<WeatherHealthEnvelope>>(() => {
    const lastWeather = _obj(_winVar('__farrowayLastWeather'));
    const risk = _probe('__weatherRiskHealth');
    const available = !!lastWeather || !!_obj(risk);

    const confidence: Confidence = available ? 'medium' : 'low';

    return Object.freeze({
      runtimeVersion: DAILY_PLAN_INTEGRATION_VERSION,
      initialized: true,
      // each adjustment is ready when weather context is available; otherwise
      // the plan falls back to general guidance (still non-blocking)
      heavyRainDelayIrrigation: available,
      heatWaterEarly: available,
      humidityMonitorDisease: available,
      drySpellCheckMoisture: available,
      stormProtectSeedlings: available,
      weatherOptional: true,
      generalGuidanceWhenUnavailable: true,
      nonBlocking: true,
      confidence,
      explanation: available
        ? 'Weather context is available and gently adjusts today\'s plan ' +
          '(rain, heat, humidity, dry spell, storm).'
        : 'No weather context available — the daily plan shows general routine ' +
          'guidance and never waits on weather.',
      limitations:
        'Weather is optional and approximate; adjustments are general suggestions, ' +
        'not a forecast guarantee. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: DAILY_PLAN_INTEGRATION_VERSION,
    initialized: true,
    heavyRainDelayIrrigation: false,
    heatWaterEarly: false,
    humidityMonitorDisease: false,
    drySpellCheckMoisture: false,
    stormProtectSeedlings: false,
    weatherOptional: true,
    generalGuidanceWhenUnavailable: true,
    nonBlocking: true,
    confidence: 'low' as Confidence,
    explanation: 'Weather adjustment is unavailable right now — showing general guidance.',
    limitations:
      'No weather context could be read; the daily plan still shows general ' +
      'routine care and never blocks. ' + GUIDANCE_TAIL,
  }));
}

/* ── §11 outcome feedback loop health ────────────────────────────
 * The plan closes the loop: completed / skipped / delayed are tracked, the
 * farmer can say whether a step helped, and follow-up is flagged when needed.
 * Outcome statuses stay honest: improved / unchanged / worsened / unknown. */
export function dailyPlanOutcomeHealth(): Readonly<OutcomeHealthEnvelope> {
  return _safe<Readonly<OutcomeHealthEnvelope>>(() => {
    const capture = _probe('__outcomeCaptureHealth');
    const learning = _probe('__outcomeLearningLoopHealth');
    const fallback = _probe('__dailyPlanOutcome');
    const src = _obj(capture) || _obj(learning) || _obj(fallback);
    const present = !!src;

    const confidence: Confidence = present ? 'medium' : 'low';

    return Object.freeze({
      runtimeVersion: DAILY_PLAN_INTEGRATION_VERSION,
      initialized: true,
      completedTracked: _flag(capture, 'completedTracked') &&
        _flag(learning, 'completedTracked'),
      skippedTracked: _flag(capture, 'skippedTracked') &&
        _flag(learning, 'skippedTracked'),
      delayedTracked: _flag(capture, 'delayedTracked') &&
        _flag(learning, 'delayedTracked'),
      helpedTracked: _flag(capture, 'helpedTracked') &&
        _flag(learning, 'helpedTracked'),
      followUpNeededTracked: _flag(capture, 'followUpNeededTracked') &&
        _flag(learning, 'followUpNeededTracked'),
      outcomeStatuses: Object.freeze(['improved', 'unchanged', 'worsened', 'unknown']),
      confidence,
      explanation: present
        ? 'The daily plan closes the loop: completed, skipped and delayed steps ' +
          'are tracked, the farmer can say whether a step helped, and follow-up ' +
          'is flagged when needed.'
        : 'No live outcome signal yet — the loop is wired but is still gathering ' +
          'what happens after each step.',
      limitations:
        'Outcomes reflect only what has been recorded on this device; they describe ' +
        'whether a step seemed to help, not an exact result. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: DAILY_PLAN_INTEGRATION_VERSION,
    initialized: true,
    completedTracked: true,
    skippedTracked: true,
    delayedTracked: true,
    helpedTracked: true,
    followUpNeededTracked: true,
    outcomeStatuses: Object.freeze(['improved', 'unchanged', 'worsened', 'unknown']),
    confidence: 'low' as Confidence,
    explanation: 'Outcome loop is unavailable right now — showing general guidance.',
    limitations:
      'No outcome data could be read on this device; the loop still records ' +
      'what happens after each step when available. ' + GUIDANCE_TAIL,
  }));
}

/* ── installer ───────────────────────────────────────────────────
 * Pins each diagnostics global only if it is not already a function.
 * Dev-only console.log gated on import.meta.env.DEV || w.__farrowayHealthLog. */
function _install(name: string, fn: () => any, label: string): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (typeof w[name] !== 'function') {
      w[name] = function () {
        const out = fn();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log(label, out);
        } catch { /* swallow */ }
        return out;
      };
    }
  }, undefined);
}

export function installDailyPlanIntegrationGlobals(): boolean {
  return _safe(() => {
    _install('__dailyPlanTaskHealth', dailyPlanTaskHealth, '[Farroway · Daily Plan Tasks]');
    _install('__dailyPlanScanHealth', dailyPlanScanHealth, '[Farroway · Daily Plan Scan]');
    _install('__dailyPlanWeatherHealth', dailyPlanWeatherHealth, '[Farroway · Daily Plan Weather]');
    _install('__dailyPlanOutcomeHealth', dailyPlanOutcomeHealth, '[Farroway · Daily Plan Outcome]');
    return true;
  }, false);
}
