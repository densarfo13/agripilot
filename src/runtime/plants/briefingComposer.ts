/**
 * src/runtime/plants/briefingComposer.ts — Daily Briefing
 * merger.
 *
 *   import {
 *     composeFullBriefing, FULL_BRIEFING_VERSION,
 *   } from 'src/runtime/plants/briefingComposer';
 *
 *   composeFullBriefing({ plants, dailyGrow, weatherForecast })
 *
 * What this is
 * ────────────
 *   Merges the plant-runtime `plantsForBriefing()` output with
 *   the (existing) `dailyGrowEngine` envelope into ONE briefing
 *   payload the Today screen can render.
 *
 *   Why a separate composer instead of modifying dailyGrowEngine?
 *   Strict rule — do not modify existing engines. dailyGrowEngine
 *   is already shipped and stable; this composer is additive and
 *   sits on top of both envelopes.
 *
 *   The Today screen calls `composeFullBriefing({ ..., dailyGrow:
 *   dailyGrowEngine(ctx) })` to get one merged surface.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — does NOT modify dailyGrowEngine.
 *   • Wave-5 single-writer preserved.
 *   • Frozen envelopes.
 */

import { plantsForBriefing } from './index';

export const FULL_BRIEFING_VERSION = 'plants-briefing-composer-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface ComposerCtx {
  plants?:           any[];
  dailyGrow?:        any;     // existing dailyGrowEngine output
  weatherForecast?:  any;
  now?:              number;
}

function _headline(plantCount: number, dailyGrow: any): { key: string; def: string } {
  const todayCount = _isObj(dailyGrow) && Array.isArray(dailyGrow.todayTasks)
    ? dailyGrow.todayTasks.length : 0;
  const warningCount = _isObj(dailyGrow) && Array.isArray(dailyGrow.warnings)
    ? dailyGrow.warnings.length : 0;
  if (plantCount === 0 && todayCount === 0 && warningCount === 0) {
    return { key: 'briefing.full.allWell', def: 'A calm day across your garden.' };
  }
  if (plantCount > 0 && todayCount > 0) {
    return {
      key: 'briefing.full.plantsAndTasks',
      def: plantCount + ' plant(s) need attention. '
        + todayCount + ' task(s) due today.',
    };
  }
  if (plantCount > 0) {
    return {
      key: 'briefing.full.plantsOnly',
      def: plantCount + ' plant(s) need attention today.',
    };
  }
  if (todayCount > 0) {
    return {
      key: 'briefing.full.tasksOnly',
      def: todayCount + ' task(s) due today.',
    };
  }
  return {
    key: 'briefing.full.warningsOnly',
    def: 'A few signals to watch today.',
  };
}

export function composeFullBriefing(ctx: ComposerCtx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {} as ComposerCtx;
    const plant = plantsForBriefing({ plants: _arr(c.plants) });
    const grow  = _isObj(c.dailyGrow) ? c.dailyGrow : null;
    const plantCount = (plant as any).count || 0;
    const headline = _headline(plantCount, grow);

    return Object.freeze({
      runtimeVersion: FULL_BRIEFING_VERSION,
      headline:       Object.freeze(headline),
      // Plant attention pulled straight from plantsForBriefing
      plantsNeedingAttention: (plant as any).needsAttention,
      attentionByCategory:    (plant as any).attentionByCategory,
      plantCount,
      // Existing dailyGrowEngine surfaces — pass through if the
      // caller supplied them; never invent.
      todayTasks:        grow ? grow.todayTasks    : Object.freeze([]),
      warnings:          grow ? grow.warnings      : Object.freeze([]),
      opportunities:     grow ? grow.opportunities : Object.freeze([]),
      recommendations:   grow ? grow.recommendations : Object.freeze([]),
      // What changed in this composer — the merge surface.
      mergedAt:        _safe(() => new Date().toISOString(), ''),
      sources: Object.freeze({
        plantsRuntime: (plant as any).runtimeVersion,
        dailyGrow:     grow ? _str(grow.runtimeVersion) : '',
      }),
      deferred: Object.freeze({
        todayUiWiring:
          'composer ready to consume; Today screen wiring to call '
          + 'composeFullBriefing({plants: managedList, dailyGrow: '
          + 'dailyGrowEngine(ctx)}) is the next-step UI integration',
      }),
    });
  }, Object.freeze({
    runtimeVersion: FULL_BRIEFING_VERSION,
    headline: Object.freeze({
      key: 'briefing.full.error', def: 'Briefing unavailable.',
    }),
    plantsNeedingAttention: Object.freeze([]),
    attentionByCategory:    Object.freeze({}),
    plantCount: 0,
    todayTasks: Object.freeze([]),
    warnings: Object.freeze([]),
    opportunities: Object.freeze([]),
    recommendations: Object.freeze([]),
    mergedAt: '',
    sources: Object.freeze({}),
  }));
}
