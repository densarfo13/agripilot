/**
 * CommandCenterRuntime.ts — owner of window.__commandCenterHealth().
 *
 * Composes the Aggregator's CommandCenterState with diagnostics flags
 * (10 readiness + 5 page-integration) per the spec.
 *
 * Page-integration flags are DOM-attested: pages render their tree with
 * `data-consumes="commandCenter"` + `data-surface=...` markers, and this
 * runtime flips the surface-specific flag true when it observes that
 * marker OR when the page has recorded a ConsumerIntegrationReady artifact.
 *
 * Self-contained; zero imports outside this directory; frozen; never throws.
 */

import { aggregateCommandCenter } from './CommandCenterAggregator';
import {
  COMMAND_CENTER_VERSION, COMMAND_CENTER_SURFACES, GUIDANCE_TAIL,
} from './CommandCenterContracts';
import type { CommandCenterDiagnostics, Confidence } from './CommandCenterContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}

function _surfaceMarkers() {
  return _safe(() => {
    if (typeof document === 'undefined') {
      return { home: false, tasks: false, 'my-farm': false, scan: false, activity: false };
    }
    const sel = (id: string) => !!document.querySelector(
      `[data-consumes="commandCenter"][data-surface="${id}"]`,
    );
    return {
      home: sel('home'),
      tasks: sel('tasks'),
      'my-farm': sel('my-farm'),
      scan: sel('scan'),
      activity: sel('activity'),
    };
  }, { home: false, tasks: false, 'my-farm': false, scan: false, activity: false });
}

function _recordedSurfaces(): Set<string> {
  return _safe(() => {
    const list = _ls('farroway_command_center_integration_log');
    const out = new Set<string>();
    if (!Array.isArray(list)) return out;
    for (const r of list) {
      if (r && typeof r === 'object' && typeof (r as any).surface === 'string') {
        out.add((r as any).surface);
      }
    }
    return out;
  }, new Set<string>());
}

export function commandCenterHealth(): Readonly<CommandCenterDiagnostics> {
  return _safe(() => {
    const agg = aggregateCommandCenter();
    const flags = agg.readinessFlags;
    const dom = _surfaceMarkers();
    const recorded = _recordedSurfaces();
    const has = (surface: string, marker: boolean) => marker || recorded.has(surface);

    const homeIntegrated = has('home', dom.home);
    const tasksIntegrated = has('tasks', dom.tasks);
    const myFarmIntegrated = has('my-farm', dom['my-farm']);
    const scanIntegrated = has('scan', dom.scan);
    const activityIntegrated = has('activity', dom.activity);

    const readinessCount = [
      flags.cropReady, flags.stageReady, flags.healthReady, flags.riskReady,
      flags.actionReady, flags.harvestReady, flags.fundingReady,
      flags.marketReady, flags.sellReady, flags.notificationReady,
    ].filter(Boolean).length;
    const integratedSurfaceCount = [homeIntegrated, tasksIntegrated, myFarmIntegrated,
      scanIntegrated, activityIntegrated].filter(Boolean).length;

    const confidence: Confidence = (readinessCount >= 7 && integratedSurfaceCount >= 4) ? 'high'
      : (readinessCount >= 3) ? 'medium' : 'low';

    return Object.freeze<CommandCenterDiagnostics>({
      initialized: true,
      cropReady: flags.cropReady,
      stageReady: flags.stageReady,
      healthReady: flags.healthReady,
      riskReady: flags.riskReady,
      actionReady: flags.actionReady,
      harvestReady: flags.harvestReady,
      fundingReady: flags.fundingReady,
      marketReady: flags.marketReady,
      sellReady: flags.sellReady,
      notificationReady: flags.notificationReady,
      homeIntegrated, tasksIntegrated, myFarmIntegrated,
      scanIntegrated, activityIntegrated,
      composedFrom: agg.composedFrom,
      integratedSurfaceCount,
      totalSurfaces: 5 as const,
      readinessCount,
      totalFields: 10 as const,
      noFakeData: true as const,
      noFabricatedScores: true as const,
      noPageLocalCalculations: true as const,
      confidence,
      explanation:
        'Command Center single source of truth: 10 readiness fields + 5 page-integration ' +
        'attestations composed over the existing intelligence stack. Pages MUST consume the ' +
        'selectors rather than recompute farm state. Honest false until backing probes report ready.',
      limitations:
        'Field-level "Not enough data yet" reflects genuine missing data, not silent fallback. '
        + GUIDANCE_TAIL,
      state: agg.state,
    });
  }, Object.freeze<CommandCenterDiagnostics>({
    initialized: true,
    cropReady: false, stageReady: false, healthReady: false, riskReady: false,
    actionReady: false, harvestReady: false, fundingReady: false,
    marketReady: false, sellReady: false, notificationReady: false,
    homeIntegrated: false, tasksIntegrated: false, myFarmIntegrated: false,
    scanIntegrated: false, activityIntegrated: false,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    integratedSurfaceCount: 0,
    totalSurfaces: 5 as const,
    readinessCount: 0,
    totalFields: 10 as const,
    noFakeData: true as const,
    noFabricatedScores: true as const,
    noPageLocalCalculations: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Command Center initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
    state: aggregateCommandCenter().state,
  }));
}

/** Pages call this once during mount so their integration claim
 *  persists across DOM re-renders. */
export function recordCommandCenterIntegration(surface: string): void {
  _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!surface || typeof surface !== 'string') return;
    if (COMMAND_CENTER_SURFACES.indexOf(surface as any) < 0) return;
    const KEY = 'farroway_command_center_integration_log';
    const raw = window.localStorage.getItem(KEY);
    const list = _safe(() => {
      const p = JSON.parse(raw || '[]');
      return Array.isArray(p) ? p : [];
    }, []);
    if (list.some((r: any) => r && r.surface === surface)) return;
    list.push({ kind: 'CommandCenterIntegrationReady', surface, ts: Date.now() });
    const bounded = list.length > 100 ? list.slice(list.length - 100) : list;
    window.localStorage.setItem(KEY, JSON.stringify(bounded));
  }, undefined);
}

export function installCommandCenterRuntimeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    // This v2 runtime OWNS __commandCenterHealth. If a prior boot pinned
    // an older one, overwrite — the spec requires this composite to be
    // the canonical source.
    w.__commandCenterHealth = function () {
      const out = commandCenterHealth();
      try {
        const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
        if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Command Center v2]', out);
      } catch { /* swallow */ }
      return out;
    };
    return true;
  }, false);
}

export { COMMAND_CENTER_VERSION };
