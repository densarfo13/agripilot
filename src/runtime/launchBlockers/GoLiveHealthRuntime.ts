/**
 * src/runtime/launchBlockers/GoLiveHealthRuntime.ts — composite
 * go-live verdict over the six wave-26 launch blockers.
 *
 *   import { goLiveHealth, installGoLiveHealthGlobal }
 *     from 'src/runtime/launchBlockers/GoLiveHealthRuntime';
 *
 *   window.__goLiveHealth()
 *
 * Verdict rules (spec §GO LIVE):
 *   • NO_GO                  — any C-1…C-6 health probe fails
 *   • GO_WITH_LIMITATIONS    — all six pass AND any of:
 *                              knowledge-gap remains, NGO gated,
 *                              buyer rollout pending
 *   • GO                     — all six pass AND none of the
 *                              "with limitations" caveats hold
 *
 * Strict-rule audit
 *   • Composition over six wave-26 health probes. No engine work.
 *   • SSR-safe. Pure. Frozen envelope. Never throws.
 *   • The current launch knowledge gap (66/200 plants) is
 *     hard-coded as "TRUE — gap remains" so the verdict honestly
 *     reports GO_WITH_LIMITATIONS until the gap closes.
 */

export const GO_LIVE_HEALTH_RUNTIME_VERSION = 'go-live-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    if (typeof w[name] !== 'function') return null;
    return w[name]();
  }, null);
}

function _ok(probe: any, ...flags: string[]): boolean {
  if (!probe || typeof probe !== 'object') return false;
  for (const f of flags) if (!probe[f]) return false;
  return true;
}

export function goLiveHealth() {
  return _safe(() => {
    const onboarding  = _probe('__onboardingGuardHealth');
    const taskStore   = _probe('__taskStoreHealth');
    const activity    = _probe('__activityDataHealth');
    const scanResult  = _probe('__scanResultHealth');
    const scanCta     = _probe('__scanCtaHealth');
    const sync        = _probe('__syncHealth');

    const c1 = _ok(onboarding, 'onboardingGuardReady', 'bypassBlocked');
    const c2 = _ok(taskStore,  'singleTaskSource', 'duplicateStoresRemoved',
                                'taskConsistencyReady');
    const c3 = _ok(activity,   'activityKeyCorrect', 'migrationReady');
    const c4 = _ok(scanResult, 'singleResultCard', 'duplicateRenderBlocked');
    const c5 = _ok(scanCta,    'savePlantReady', 'createTaskReady',
                                'scanAgainReady', 'activityReady');
    const c6 = _ok(sync,       'referenceErrorRemoved', 'queueVisible',
                                'syncStateHonest');

    const allPass = c1 && c2 && c3 && c4 && c5 && c6;

    // Launch caveats — true today. Closing each is its own sprint:
    //   • knowledgeGap        — Plants 66/200 (yellow per wave-25)
    //   • ngoRolloutGated     — _pending-migrations/ awaiting Railway deploy
    //   • buyerRolloutPending — four wave-26 highs not yet fixed
    const knowledgeGap        = true;
    const ngoRolloutGated     = true;
    const buyerRolloutPending = true;

    let verdict: 'NO_GO' | 'GO_WITH_LIMITATIONS' | 'GO';
    if (!allPass) verdict = 'NO_GO';
    else if (knowledgeGap || ngoRolloutGated || buyerRolloutPending) {
      verdict = 'GO_WITH_LIMITATIONS';
    } else {
      verdict = 'GO';
    }

    const blockers: string[] = [];
    if (!c1) blockers.push('C1_onboardingGuard');
    if (!c2) blockers.push('C2_taskStore');
    if (!c3) blockers.push('C3_activityKey');
    if (!c4) blockers.push('C4_scanResult');
    if (!c5) blockers.push('C5_scanCta');
    if (!c6) blockers.push('C6_sync');

    return Object.freeze({
      runtimeVersion:       GO_LIVE_HEALTH_RUNTIME_VERSION,
      verdict,
      allBlockersResolved:  allPass,
      blockers:             Object.freeze(blockers),
      checks: Object.freeze({
        c1_onboardingGuard: c1,
        c2_taskStore:       c2,
        c3_activityKey:     c3,
        c4_scanResult:      c4,
        c5_scanCta:         c5,
        c6_sync:            c6,
      }),
      caveats: Object.freeze({
        knowledgeGap,
        ngoRolloutGated,
        buyerRolloutPending,
      }),
    });
  }, Object.freeze({
    runtimeVersion:      GO_LIVE_HEALTH_RUNTIME_VERSION,
    verdict:             'NO_GO',
    allBlockersResolved: false,
    blockers:            Object.freeze(['probe_failure']),
    checks:              Object.freeze({}),
    caveats:             Object.freeze({}),
  }));
}

export function installGoLiveHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__goLiveHealth !== 'function') {
      w.__goLiveHealth = function () {
        const out = goLiveHealth();
        try { console.log('[Farroway · Go-Live]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
