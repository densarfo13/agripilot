/**
 * src/runtime/plants/plantsBriefing.ts — `plantsForBriefing()`
 * extracted into its own concrete module to BREAK the circular
 * import that lived between the barrel and briefingComposer:
 *
 *   index.ts ──(export … from './briefingComposer')──▶ briefingComposer.ts
 *   briefingComposer.ts ──(import { plantsForBriefing } from './index')──▶ index.ts
 *
 * That cycle perturbed Rollup's module-initialization order and was a
 * source of "ReferenceError: Cannot access 'o' before initialization"
 * in chunks that pulled the plants barrel (e.g. the scan chunk).
 *
 * Both the barrel AND briefingComposer now import `plantsForBriefing`
 * from THIS leaf module, which imports nothing from either of them —
 * so the cycle is gone.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws. Frozen envelopes.
 *   • Imports nothing from the plants barrel (no back-edge).
 */

export const PLANTS_BRIEFING_VERSION = 'plants-briefing-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * A plant needs attention when:
 *   • riskScore >= 60, OR
 *   • healthScore < 50, OR
 *   • lifecycleStage === 'fruiting' (harvest window upcoming), OR
 *   • lifecycleStage === 'harvest'  (act now)
 */
export function plantsForBriefing(ctx: any) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {};
    const plants  = _arr((c as any).plants);
    const needsAttention: any[] = [];
    const byCat: Record<string, number> = {};
    for (const p of plants) {
      if (!_isObj(p)) continue;
      const risk   = typeof (p as any).riskScore   === 'number'
                      ? (p as any).riskScore : 0;
      const health = typeof (p as any).healthScore === 'number'
                      ? (p as any).healthScore : 0;
      const stage  = _str((p as any).lifecycleStage
                      || (p as any).growthStage);
      const flag =
        risk >= 60 ||
        health < 50 ||
        stage === 'fruiting' ||
        stage === 'harvest';
      if (!flag) continue;
      needsAttention.push(Object.freeze(p));
      const cat = _str((p as any).category) || 'unknown';
      byCat[cat] = (byCat[cat] || 0) + 1;
    }
    const count = needsAttention.length;
    const headline = count === 0
      ? Object.freeze({
          key: 'briefing.plants.allWell',
          def: 'Your plants are doing well.',
        })
      : Object.freeze({
          key: 'briefing.plants.needAttention',
          def: count + (count === 1
                ? ' plant needs attention.'
                : ' plants need attention.'),
        });
    return Object.freeze({
      runtimeVersion:       PLANTS_BRIEFING_VERSION,
      count,
      needsAttention:       Object.freeze(needsAttention),
      attentionByCategory:  Object.freeze(byCat),
      headline,
    });
  }, Object.freeze({
    runtimeVersion: PLANTS_BRIEFING_VERSION,
    count: 0,
    needsAttention: Object.freeze([]),
    attentionByCategory: Object.freeze({}),
    headline: Object.freeze({
      key: 'briefing.plants.allWell',
      def: 'Your plants are doing well.',
    }),
  }));
}
