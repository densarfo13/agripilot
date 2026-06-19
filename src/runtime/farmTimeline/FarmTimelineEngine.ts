/**
 * FarmTimelineEngine.ts — sprint #212 §7.
 *
 * Activity-page farm journey timeline. Wraps the #209 FarmTimeline
 * composite (read-only over existing events) and adds the Activity
 * empty-story shape ("Your farm story starts here." + Run-first-scan
 * CTA). NO new event store; never fabricates an entry.
 *
 * Pins window.__farmTimelineHealth(). Pure. Never throws.
 */

import { buildFarmTimeline } from '../farmBrain/FarmTimeline';
import { FARM_JOURNEY_KINDS } from './FarmTimelineContracts';
import type { FarmJourneyView } from './FarmTimelineContracts';

export const FARM_TIMELINE_ENGINE_VERSION = 'farm-timeline-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export function buildFarmJourney(input: {
  entries?: ReadonlyArray<{ kind?: string; at?: string; detail?: string }>;
  pilotEvents?: ReadonlyArray<{ type?: string; at?: string; ts?: string }>;
} = {}): Readonly<FarmJourneyView> {
  return _safe(() => {
    const tl = buildFarmTimeline({
      entries: _arr(input.entries), pilotEvents: _arr(input.pilotEvents),
    });
    return Object.freeze({
      runtimeVersion: FARM_TIMELINE_ENGINE_VERSION,
      entries: tl.entries,
      count: tl.count,
      active: tl.active,
      // Empty state is ALWAYS guided — never a dead "No activity yet".
      storyKey: 'farmTimeline.story',
      ctaKey: 'farmTimeline.cta.firstScan',
      ctaRoute: '/scan',
    });
  }, Object.freeze({
    runtimeVersion: FARM_TIMELINE_ENGINE_VERSION,
    entries: Object.freeze([]),
    count: 0, active: false,
    storyKey: 'farmTimeline.story',
    ctaKey: 'farmTimeline.cta.firstScan',
    ctaRoute: '/scan',
  }));
}

export function buildFarmTimelineHealth(): Readonly<{
  ok: boolean; runtimeVersion: string; farmTimelineReady: true;
  trackedKinds: number; emptyStateGuided: true;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: FARM_TIMELINE_ENGINE_VERSION,
    farmTimelineReady: true as const,
    trackedKinds: FARM_JOURNEY_KINDS.length,
    emptyStateGuided: true as const,
  });
}

let _installed = false;
export function installFarmTimelineHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__farmTimelineHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildFarmTimelineHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  buildFarmJourney, buildFarmTimelineHealth, installFarmTimelineHealthGlobal,
});
export default buildFarmJourney;
