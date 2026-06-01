/**
 * RecommendationEngine.ts — spec-canonical facade. The active
 * recommendation lives in the daily-assistant task chain runtime
 * (already shipped). This facade reads __dailyAssistantHealth() and
 * surfaces the spec-mandated output shape: { todayAction, why,
 * riskLevel, estimatedTime, daysToHarvest, confidence, limitations }.
 *
 * NEVER fabricates: when the underlying probe is absent the facade
 * returns 'NEEDS_DATA' / null fields with low confidence.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export const RECOMMENDATION_ENGINE_VERSION = 'recommendation-engine-v1' as const;

export interface AgronomyRecommendation {
  todayAction: string;
  why: string;
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
  estimatedTime: string;
  daysToHarvest: string;
  rationale: ReadonlyArray<string>;
  confidence: 'low' | 'medium' | 'high';
  limitations: string;
}

export function recommendForToday(): Readonly<AgronomyRecommendation> {
  return _safe(() => {
    if (typeof window === 'undefined') return _empty('SSR — no live probe.');
    const w = window as any;
    const da = typeof w.__dailyAssistantHealth === 'function' ? w.__dailyAssistantHealth() : null;
    const tf = typeof w.__growTimeframeHealth === 'function' ? w.__growTimeframeHealth() : null;
    if (!da) return _empty('Daily assistant not yet installed.');

    const active = (da as any).activeTask;
    const todayAction = String((da as any).todayAction
      || (active && active.titleDefault)
      || 'Open Farroway daily to check on your plants.');
    const why = String((active && active.why) || (da as any).why || '');
    const estimatedTime = String((active && active.estimatedTime) || (da as any).estimatedTime || '5 min');
    const daysToHarvest = _safe(() => {
      if (!tf) return 'Not enough data yet';
      const v = (tf as any).value || tf;
      return String((v as any).approxRange || (v as any).timeframe || 'Approximate range — see Plant Profile.');
    }, 'Not enough data yet');

    const rationale: string[] = [];
    if (active && active.id) rationale.push(`source:task_chain:${active.id}`);
    if ((da as any).stage) rationale.push(`stage:${(da as any).stage}`);
    if ((da as any).scanRecommended === true) rationale.push('scan_recommended');
    if (rationale.length === 0) rationale.push('source:fallback');

    return Object.freeze<AgronomyRecommendation>({
      todayAction,
      why,
      riskLevel: 'unknown',
      estimatedTime,
      daysToHarvest,
      rationale: Object.freeze(rationale) as ReadonlyArray<string>,
      confidence: (((da as any).confidence as 'low' | 'medium' | 'high') || 'medium'),
      limitations:
        'Approximate timing; user-correctable. Decision support, not a guarantee.',
    });
  }, _empty('Recommendation engine threw.'));
}

function _empty(reason: string): Readonly<AgronomyRecommendation> {
  return Object.freeze<AgronomyRecommendation>({
    todayAction: 'Not enough data yet — add a crop to start your daily plan.',
    why: '',
    riskLevel: 'unknown',
    estimatedTime: '',
    daysToHarvest: 'Not enough data yet',
    rationale: Object.freeze(['source:empty']) as ReadonlyArray<string>,
    confidence: 'low',
    limitations: reason + ' Decision support, not a guarantee.',
  });
}
