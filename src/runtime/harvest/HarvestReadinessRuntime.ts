/**
 * src/runtime/harvest/HarvestReadinessRuntime.ts — top-level
 * facade for the Harvest Readiness suite.
 *
 *   import { evaluate, harvestReadinessHealth }
 *     from './HarvestReadinessRuntime';
 *
 *   const result = evaluate(scanResult, plantContext);
 *
 * Composes:
 *   • RipenessEngine     — visual-signal classifier
 *   • HarvestStageEngine — window estimator
 *   • HarvestTaskEngine  — task suggestions
 *   • localStorage       — harvest history (read-only by everything
 *                          except recordEvaluation)
 *   • ArtifactRuntime    — createHarvestArtifact (composed at call-site;
 *                          this runtime returns the artifact context but
 *                          does not register it itself)
 *
 * Strict-rule audit
 *   • Composition over architecture. Never owns the camera. Never
 *     calls Plant.id directly. Never bypasses ScanRuntime. Never
 *     writes tasks from the UI; only returns recommended-task
 *     envelopes that the canonical Task Runtime persists.
 *   • Pure runtime. Never throws — every public function has a
 *     try/catch with a frozen fallback.
 *   • Frozen envelopes only.
 *   • Single window global: __harvestReadinessHealth.
 *   • Wording: SAFE verbs only — banned wording is statically
 *     enforced by check-harvest-readiness-ownership.mjs.
 *   • Idempotency: every result carries a deterministic key so
 *     reconnect-replay never doubles up.
 */

import {
  HARVEST_RUNTIME_VERSION,
  RIPENESS_STATUS,
  HARVEST_CATEGORY,
  SUPPORTED_PLANTS,
  PLANT_CATEGORY,
  HARVEST_STORAGE_KEY,
  HARVEST_HISTORY_CAP,
  idemEvaluate,
  type HarvestReadinessResult,
  type HarvestReadinessHealth,
  type HarvestVisualSignals,
  type PlantContext,
  type RipenessStatusValue,
} from './harvestContracts';
import { evaluateRipeness } from './RipenessEngine';
import { estimateHarvestWindow } from './HarvestStageEngine';
import { generateHarvestTasks } from './HarvestTaskEngine';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().trim() : '';
}

function _str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function _frozenSignals(input: any): HarvestVisualSignals {
  return Object.freeze({
    color:        _str(input?.color)        || undefined,
    size:         _str(input?.size)         || undefined,
    texture:      _str(input?.texture)      || undefined,
    defects:      Array.isArray(input?.defects)
                    ? Object.freeze([...input.defects]) : undefined,
    diseaseSigns: Array.isArray(input?.diseaseSigns)
                    ? Object.freeze([...input.diseaseSigns]) : undefined,
    pestSigns:    Array.isArray(input?.pestSigns)
                    ? Object.freeze([...input.pestSigns]) : undefined,
  });
}

/**
 * _deriveSignals — wave-28 risk-fix #1. The live scan envelope
 * rarely carries explicit color/texture/defects fields today; the
 * classifier mostly emits `possibleIssue` (free text) + `category`
 * (yellowing / pests / disease / unknown). Without derived signals
 * the ripeness engine falls to UNKNOWN+needsReview for most fruit
 * scans. Surface what we CAN safely infer from the existing
 * envelope without making overconfident claims:
 *   • category 'yellowing' → color hint 'yellow'
 *   • possibleIssue containing 'blight'/'rot'/'spot' → defect
 *   • possibleIssue containing 'pest'/'beetle'/'aphid' → pest sign
 *   • possibleIssue containing 'wilt'/'mold'/'mildew' → defect
 *   • category 'pests' → pest sign 'pest damage'
 *
 * Pure. SSR-safe via _safe. Returns a frozen partial signals
 * envelope merged with caller-supplied fields (caller wins).
 */
function _deriveSignals(scan: any): HarvestVisualSignals {
  return _safe(() => {
    if (!scan || typeof scan !== 'object') return Object.freeze({});
    const issue = (_str(scan.possibleIssue) || _str(scan.issue)
                  || _str(scan.diagnosis) || '').toLowerCase();
    const category = (_str(scan.category) || '').toLowerCase();
    const defects: string[] = [];
    const pestSigns: string[] = [];
    const diseaseSigns: string[] = [];
    let color: string | undefined;

    // Color hint from category.
    if (category.includes('yellow')) color = 'yellow';
    // Defect hints — disease keywords.
    if (issue.includes('blight'))   { defects.push('blight signs');   diseaseSigns.push('blight'); }
    if (issue.includes('rot'))      { defects.push('rot');            diseaseSigns.push('rot'); }
    if (issue.includes('mold'))     { defects.push('mold');           diseaseSigns.push('mold'); }
    if (issue.includes('mildew'))   { defects.push('mildew');         diseaseSigns.push('mildew'); }
    if (issue.includes('wilt'))     { defects.push('wilting');        diseaseSigns.push('wilt'); }
    if (issue.includes('spot'))     { defects.push('spotting');       diseaseSigns.push('leaf spot'); }
    if (issue.includes('black'))    { defects.push('black discoloration'); }
    if (issue.includes('soft'))     { defects.push('soft texture'); }
    // Pest hints.
    if (category === 'pests' || category.includes('pest')) {
      pestSigns.push('pest damage');
    }
    if (issue.includes('aphid'))    pestSigns.push('aphids');
    if (issue.includes('beetle'))   pestSigns.push('beetles');
    if (issue.includes('caterpil')) pestSigns.push('caterpillars');
    if (issue.includes('mite'))     pestSigns.push('mites');

    return Object.freeze({
      color,
      defects:      defects.length      > 0 ? Object.freeze([...defects])      : undefined,
      diseaseSigns: diseaseSigns.length > 0 ? Object.freeze([...diseaseSigns]) : undefined,
      pestSigns:    pestSigns.length    > 0 ? Object.freeze([...pestSigns])    : undefined,
    });
  }, Object.freeze({}));
}

function _mergeSignals(
  derived: HarvestVisualSignals,
  caller:  HarvestVisualSignals,
): HarvestVisualSignals {
  // Caller-supplied fields always win.
  return Object.freeze({
    color:        caller.color        ?? derived.color,
    size:         caller.size,         // derived has no size today
    texture:      caller.texture,      // derived has no texture today
    defects:      caller.defects      ?? derived.defects,
    diseaseSigns: caller.diseaseSigns ?? derived.diseaseSigns,
    pestSigns:    caller.pestSigns    ?? derived.pestSigns,
  });
}

// ─── Persistence — single-writer for harvest history ──────────────

function _hasLocal(): boolean {
  return _safe(() => typeof localStorage !== 'undefined'
                     && !!localStorage, false);
}

function _readHistory(): HarvestReadinessResult[] {
  return _safe(() => {
    if (!_hasLocal()) return [];
    const raw = localStorage.getItem(HARVEST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
}

function _writeHistory(list: HarvestReadinessResult[]): boolean {
  return _safe(() => {
    if (!_hasLocal()) return false;
    const trimmed = list.length > HARVEST_HISTORY_CAP
      ? list.slice(list.length - HARVEST_HISTORY_CAP)
      : list;
    localStorage.setItem(HARVEST_STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  }, false);
}

function _appendHistory(rec: HarvestReadinessResult): void {
  _safe(() => {
    const list = _readHistory();
    const dedup = list.filter((r) => r.idempotencyKey !== rec.idempotencyKey);
    dedup.push(rec);
    _writeHistory(dedup);
  }, undefined as any);
}

/**
 * isSupportedPlant — single decision point for "should the harvest
 * card render at all". UI MUST gate the card on this — the CI
 * gate check-harvest-readiness-ownership.mjs catches violations.
 */
export function isSupportedPlant(plantId: string | null | undefined): boolean {
  const pid = _lower(plantId);
  if (!pid) return false;
  return (SUPPORTED_PLANTS as ReadonlyArray<string>).includes(pid);
}

// ─── Public entry — evaluate ──────────────────────────────────────

export interface EvaluateInput {
  /** The scan result from ScanRuntime (NOT direct from Plant.id). */
  scanResult: any;
  /** Caller-supplied plant context. */
  plantContext?: PlantContext;
  /** ISO timestamp from the caller — runtime never reads system clock. */
  timestamp?: string;
}

/**
 * evaluate — composes the four sub-engines into a single frozen
 * HarvestReadinessResult envelope. Always returns an envelope —
 * even when the plant is unsupported (envelope reports UNKNOWN +
 * needsReview: true so the UI gate can suppress the card).
 *
 * Read-only on the scan result. Never throws.
 */
export function evaluate(input: EvaluateInput): HarvestReadinessResult {
  const fallback = (reason: string, scanId: string, plantName: string): HarvestReadinessResult =>
    Object.freeze({
      scanId,
      plantName,
      category: HARVEST_CATEGORY.UNKNOWN,
      ripenessStatus: RIPENESS_STATUS.UNKNOWN,
      harvestReadinessScore: 0,
      confidence: 0,
      visualSignals: Object.freeze({}),
      recommendationTitle: '',
      recommendationBody:  '',
      recommendedTasks:    Object.freeze([]),
      needsReview:         true,
      idempotencyKey:      idemEvaluate(scanId || `unknown:${reason}`),
      timestamp:           _str(input?.timestamp),
    } as HarvestReadinessResult);

  return _safe(() => {
    const scan = input.scanResult || {};
    const scanId = _str(scan.scanId) || _str(scan.id) || '';
    if (!scanId) return fallback('missing_scanId', '', '');
    // Resolve plant id — caller's context wins; fall back to scan.
    const ctx = input.plantContext || {};
    const plantId = _lower(ctx.plantId)
                  || _lower(scan.plantId)
                  || _lower(scan.crop)
                  || _lower(scan.cropId)
                  || _lower(scan.plantName)
                  || _lower(scan.cropName);
    const plantName = _str(ctx.plantName)
                    || _str(scan.plantName)
                    || _str(scan.cropName)
                    || _str(scan.crop)
                    || plantId;

    // If unsupported → return the unknown envelope with needsReview.
    // The UI MUST gate on result.category !== 'unknown' AND result
    // .needsReview === false before showing the harvest card.
    if (!isSupportedPlant(plantId)) {
      return Object.freeze({
        scanId,
        plantId: plantId || undefined,
        plantName,
        category: HARVEST_CATEGORY.UNKNOWN,
        ripenessStatus: RIPENESS_STATUS.UNKNOWN,
        harvestReadinessScore: 0,
        confidence: 0,
        visualSignals: Object.freeze({}),
        recommendationTitle: '',
        recommendationBody:  '',
        recommendedTasks:    Object.freeze([]),
        needsReview:         true,
        idempotencyKey:      idemEvaluate(scanId),
        timestamp:           _str(input.timestamp),
      } as HarvestReadinessResult);
    }

    // Build signals from the scan result envelope. Defensive reads —
    // every field is optional. Wave-28 risk-fix #1 — merge in
    // signals derived from `possibleIssue` text + `category` so
    // the ripeness engine has SOMETHING to chew on even when the
    // classifier only emits the legacy minimal envelope.
    const callerSignals: HarvestVisualSignals = _frozenSignals({
      color:        scan.color   || scan.dominantColor,
      size:         scan.size    || scan.estimatedSize,
      texture:      scan.texture,
      defects:      scan.defects,
      diseaseSigns: scan.diseaseSigns || (scan.possibleIssue ? [scan.possibleIssue] : undefined),
      pestSigns:    scan.pestSigns,
    });
    const derivedSignals = _deriveSignals(scan);
    const signals: HarvestVisualSignals = _mergeSignals(derivedSignals, callerSignals);

    const rip = evaluateRipeness({
      plantId,
      color:           signals.color,
      size:            signals.size,
      texture:         signals.texture,
      defects:         signals.defects,
      diseaseSigns:    signals.diseaseSigns,
      pestSigns:       signals.pestSigns,
      scanCategory:    _str(scan.category),
      lifecycleStage:  _str(ctx.lifecycleStage) || _str(scan.lifecycleStage),
    });

    const status: RipenessStatusValue = rip.ripenessStatus;
    const window = rip.estimatedHarvestWindow
                || estimateHarvestWindow({
                     plantId,
                     ripenessStatus: status,
                     lifecycleStage: ctx.lifecycleStage,
                     region:         ctx.region,
                     season:         ctx.season,
                   });

    const tasks = generateHarvestTasks({
      scanId, plantName, ripenessStatus: status,
      estimatedWindow: window,
    });

    const result: HarvestReadinessResult = Object.freeze({
      scanId,
      plantId,
      plantName,
      category: rip.category || PLANT_CATEGORY[plantId] || HARVEST_CATEGORY.UNKNOWN,
      ripenessStatus: status,
      bloomStage: rip.bloomStage,
      harvestReadinessScore: rip.harvestReadinessScore,
      estimatedHarvestWindow: window,
      confidence: rip.confidence,
      visualSignals: signals,
      recommendationTitle: rip.recommendationTitle,
      recommendationBody:  rip.recommendationBody,
      recommendedTasks:    tasks,
      needsReview:         !!rip.needsReview,
      idempotencyKey:      idemEvaluate(scanId),
      timestamp:           _str(input.timestamp),
    } as HarvestReadinessResult);

    // Single-writer persistence — record to history for the plant
    // profile + activity timeline composition layer to read.
    _appendHistory(result);

    return result;
  }, fallback('runtime_threw', _str(input?.scanResult?.scanId), ''));
}

// ─── Read helpers — for PlantProfile + Activity ───────────────────

/** All evaluations for one plant, newest-first. */
export function listEvaluationsForPlant(plantId: string): ReadonlyArray<HarvestReadinessResult> {
  return _safe(() => {
    const pid = _lower(plantId);
    if (!pid) return Object.freeze([]);
    const rows = _readHistory()
      .filter((r) => _lower(r.plantId) === pid)
      .sort((a, b) => {
        const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
        const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      });
    return Object.freeze(rows);
  }, Object.freeze([]));
}

/** Latest evaluation for a plant or `null`. */
export function getLatestForPlant(plantId: string): HarvestReadinessResult | null {
  const list = listEvaluationsForPlant(plantId);
  return list.length > 0 ? list[0] : null;
}

/** Lookup by idempotency key — used by Activity timeline. */
export function getByIdempotencyKey(key: string): HarvestReadinessResult | null {
  return _safe(() => {
    if (!key) return null;
    const list = _readHistory();
    return list.find((r) => r.idempotencyKey === key) || null;
  }, null);
}

// ─── Diagnostic envelope ──────────────────────────────────────────

export function harvestReadinessHealth(): HarvestReadinessHealth {
  return _safe(() => Object.freeze({
    runtimeVersion:           HARVEST_RUNTIME_VERSION,
    initialized:              true,
    ripenessEngineReady:      true,
    harvestStageEngineReady:  true,
    scanIntegrated:           true,
    taskIntegrated:           true,
    timelineIntegrated:       true,
    artifactIntegrated:       true,
    offlineSafe:              true,
    supportedPlants:          SUPPORTED_PLANTS.length,
    harvestReadinessReady:    true,
    ripenessDetectionReady:   true,
  }), Object.freeze({
    runtimeVersion:           HARVEST_RUNTIME_VERSION,
    initialized:              false,
    ripenessEngineReady:      false,
    harvestStageEngineReady:  false,
    scanIntegrated:           false,
    taskIntegrated:           false,
    timelineIntegrated:       false,
    artifactIntegrated:       false,
    offlineSafe:              false,
    supportedPlants:          0,
    harvestReadinessReady:    false,
    ripenessDetectionReady:   false,
  }));
}

export function installHarvestReadinessGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__harvestReadinessHealth !== 'function') {
      w.__harvestReadinessHealth = function () {
        const out = harvestReadinessHealth();
        try { console.log('[Farroway · Harvest Readiness]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    // Extend __scanAnalysisHealth so the existing wave-21
    // diagnostic surfaces harvest + wave-29 V2 integration status
    // without requiring separate probes.
    if (typeof w.__scanAnalysisHealth === 'function'
        && !(w as any).__scanAnalysisHealth.__harvestExtended) {
      const prior = w.__scanAnalysisHealth;
      const wrapped: any = function () {
        const base = _safe(() => prior(), {} as any) || {};
        const h    = _safe(() => harvestReadinessHealth(), null as any);
        // Wave-29 — read the four V2 probes (if present) and
        // surface their ready flags here too so QA can read all
        // scan-stack readiness from one place.
        const _readReady = (name: string, key: string): boolean => {
          try {
            const fn = (w as any)[name];
            if (typeof fn !== 'function') return false;
            const o = fn();
            return !!(o && o[key]);
          } catch { return false; }
        };
        return Object.freeze({ ...base,
          harvestReadinessReady:  !!(h && h.harvestReadinessReady),
          ripenessDetectionReady: !!(h && h.ripenessDetectionReady),
          // Wave-29 V2 readiness
          growthStageReady:       _readReady('__growthStageHealth',       'growthStageReady'),
          severityReady:          _readReady('__severityHealth',          'severityReady'),
          outcomeComparisonReady: _readReady('__outcomeComparisonHealth', 'outcomeComparisonReady'),
          weatherRiskReady:       _readReady('__weatherRiskHealth',       'weatherRiskReady'),
          harvestReady:           !!(h && h.harvestReadinessReady),
        });
      };
      wrapped.__harvestExtended = true;
      w.__scanAnalysisHealth = wrapped;
    }
    return true;
  }, false);
}
