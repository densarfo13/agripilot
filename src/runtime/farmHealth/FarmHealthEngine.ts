/**
 * FarmHealthEngine.ts — sprint #194 (Digital Agronomist
 * Foundation). Thin COMPOSER over existing pinned globals —
 * no new intelligence, no fabricated factors.
 *
 * Contract (spec):
 *   getFarmHealthBrief() → {
 *     healthScore:  number | null,   // 0-100, null = NEEDS_DATA
 *     confidence:   'high' | 'medium' | 'low',
 *     contributors: string[],        // i18n KEYS of positive factors
 *     risks:        Array<{ key, level }>,  // from FarmRisk composite
 *   }
 *
 * Honesty rules:
 *   - healthScore comes ONLY from __farmHealthScoreHealth(); when
 *     absent it stays null (UI renders "Not enough data yet").
 *   - A contributor key is included ONLY when the underlying probe
 *     actually attests the positive signal. No signal → empty
 *     array → the "Why" line renders nothing. The score is never
 *     decorated with invented reasons.
 *   - risks mirror the FarmRisk composite categories verbatim;
 *     'unknown' levels are dropped.
 *
 * Contributor derivations (each from a REAL probe):
 *   farmHealth.why.healthyScans   ← __retentionHealth/scan events
 *     with the LAST recorded scan healthy OR __scanDetectionHealth
 *     noUnknownDeadEnds + recent healthy status
 *   farmHealth.why.tasksCompleted ← __taskProgressAccuracy /
 *     retention TASK_COMPLETED events in the last 7 days
 *   farmHealth.why.goodWeather    ← FarmRisk weather category low
 *
 * Pure / SSR-safe / frozen / never throws. Pins
 * window.__farmHealthBrief() (idempotent).
 */

export const FARM_HEALTH_ENGINE_VERSION = 'farm-health-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _hasWindow = (): boolean =>
  _safe(() => typeof window !== 'undefined' && !!window, false);

function _readGlobal(name: string): any {
  if (!_hasWindow()) return null;
  return _safe(() => {
    const fn = (window as any)[name];
    if (typeof fn !== 'function') return null;
    const v = fn();
    return v && typeof v === 'object' ? v : null;
  }, null);
}

function _num(v: unknown): number | null {
  return (typeof v === 'number' && Number.isFinite(v)) ? v : null;
}

export interface FarmHealthBrief {
  runtimeVersion: string;
  healthScore: number | null;
  // Sprint #197 — spec #192 4-tier band naming. Derived purely from
  // healthScore; 'Unknown' when no score (never a fabricated band).
  healthBand: 'Excellent' | 'Good' | 'Watch' | 'Critical' | 'Unknown';
  confidence: 'high' | 'medium' | 'low';
  contributors: ReadonlyArray<string>;
  risks: ReadonlyArray<Readonly<{ key: string; level: string }>>;
  neverFabricatesReasons: true;
}

// Spec #192 thresholds: Excellent ≥85 · Good 65-84 · Watch 40-64 ·
// Critical <40. Stronger urgency framing than the prior 3-band
// label — "Critical" reads more actionable than "Needs attention".
function _healthBand(score: number | null):
  'Excellent' | 'Good' | 'Watch' | 'Critical' | 'Unknown' {
  if (score == null) return 'Unknown';
  if (score >= 85) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 40) return 'Watch';
  return 'Critical';
}

export function getFarmHealthBrief(): Readonly<FarmHealthBrief> {
  return _safe(() => {
    // ── Score — only from the real probe ─────────────────────
    const hs = _readGlobal('__farmHealthScoreHealth');
    const healthScore = hs
      ? (_num(hs.score) ?? _num(hs.farmHealthScore)
         ?? _num(hs.healthScore) ?? _num(hs.value))
      : null;
    const boundedScore = healthScore == null ? null
      : Math.max(0, Math.min(100, Math.round(healthScore)));

    // ── Risks — FarmRisk composite categories verbatim ───────
    const fr = _readGlobal('__farmRiskHealth');
    const cats = fr && (fr.categories || fr.subRisks || fr);
    const risks: Array<{ key: string; level: string }> = [];
    for (const k of ['disease', 'weather', 'soil', 'market']) {
      const v = cats && (cats[k + 'Risk'] || cats[k]);
      const level = typeof v === 'string' ? v
        : (v && typeof v.level === 'string' ? v.level : null);
      if (level && level !== 'unknown') {
        risks.push(Object.freeze({ key: k, level }));
      }
    }

    // ── Contributors — only when the probe attests the signal ─
    const contributors: string[] = [];

    // Healthy recent scans: retention runtime tracks scan events;
    // scanDetection health attests dead-end-free pipeline. We only
    // claim "healthy recent scans" when the retention envelope
    // reports recent scan activity AND no degradation flag.
    const ret = _readGlobal('__retentionHealth');
    const recentScans = ret && (_num(ret.scansLast7Days)
      ?? _num(ret.recentScanCount));
    const scansHealthy = ret && ret.lastScanHealthy === true;
    if ((recentScans != null && recentScans > 0 && scansHealthy)
        || (ret && ret.recentScansHealthy === true)) {
      contributors.push('farmHealth.why.healthyScans');
    }

    // Tasks completed: any completed task in the window per the
    // retention/task probes.
    const tasksDone = ret && (_num(ret.tasksCompletedLast7Days)
      ?? _num(ret.taskCompletedCount));
    if (tasksDone != null && tasksDone > 0) {
      contributors.push('farmHealth.why.tasksCompleted');
    }

    // Favorable weather: the FarmRisk weather category is LOW.
    const weatherRisk = risks.find((r) => r.key === 'weather');
    if (weatherRisk && weatherRisk.level === 'low') {
      contributors.push('farmHealth.why.goodWeather');
    }

    // ── Confidence — how many real signals informed this brief ─
    const signals = (boundedScore != null ? 1 : 0)
      + risks.length + contributors.length;
    const confidence: 'high' | 'medium' | 'low' =
      signals >= 4 ? 'high' : signals >= 2 ? 'medium' : 'low';

    return Object.freeze({
      runtimeVersion: FARM_HEALTH_ENGINE_VERSION,
      healthScore: boundedScore,
      healthBand: _healthBand(boundedScore),
      confidence,
      contributors: Object.freeze(contributors),
      risks: Object.freeze(risks),
      neverFabricatesReasons: true as const,
    });
  }, Object.freeze({
    runtimeVersion: FARM_HEALTH_ENGINE_VERSION,
    healthScore: null,
    healthBand: 'Unknown' as const,
    confidence: 'low' as const,
    contributors: Object.freeze([] as string[]),
    risks: Object.freeze([] as Array<{ key: string; level: string }>),
    neverFabricatesReasons: true as const,
  }));
}

let _installed = false;
export function installFarmHealthBriefGlobal(): void {
  if (_installed) return;
  if (!_hasWindow()) return;
  _safe(() => {
    Object.defineProperty(window as any, '__farmHealthBrief', {
      configurable: true,
      enumerable: false,
      writable: false,
      value: () => getFarmHealthBrief(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  getFarmHealthBrief, installFarmHealthBriefGlobal,
});

export default getFarmHealthBrief;
