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

    // Wave-38 — Production go-live preconditions.
    // Production persistence MUST be writable + write endpoints
    // MUST be safe before public launch. Probed via the wave-38
    // persistence runtime; falls back to "fail closed" when probe
    // hasn't resolved yet.
    const persistence = _probe('__persistenceHealth');
    const persistenceProductionSafe =
      !!(persistence
         && (persistence.productionWritesEnabled === true
             || persistence.isProduction === false)
         && persistence.writeEndpointsSafe === true);

    // Invite providers — invites are GO-with-limitations gate, not
    // a blocker. Activation flow needs at least one provider for
    // public launch but doesn't block soft launch.
    const invites = _probe('__inviteHealth');
    const invitesActivationReady =
      !!(invites && invites.activationFlowReady === true
         && invites.fakeDelivery === false);

    // Offline validation — soft signal; surfaces in warnings.
    const offline = _probe('__offlineValidationHealth');
    const offlineWired = !!offline && offline.initialized === true;

    const allWaveTwentySix = c1 && c2 && c3 && c4 && c5 && c6;
    const allPass = allWaveTwentySix && persistenceProductionSafe;

    // Launch caveats — true today. Closing each is its own sprint:
    const knowledgeGap        = true;
    const ngoRolloutGated     = !invitesActivationReady;
    const buyerRolloutPending = true;

    let verdict: 'NO_GO' | 'GO_WITH_LIMITATIONS' | 'GO';
    if (!allPass) verdict = 'NO_GO';
    else if (knowledgeGap || ngoRolloutGated || buyerRolloutPending
             || !invitesActivationReady || !offlineWired) {
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
    if (!persistenceProductionSafe) {
      blockers.push('W38_persistenceProductionUnsafe');
    }

    const warnings: string[] = [];
    if (!invitesActivationReady) warnings.push('W38_invitesNotConfigured');
    if (!offlineWired)            warnings.push('W38_offlineValidationOffline');

    return Object.freeze({
      runtimeVersion:       GO_LIVE_HEALTH_RUNTIME_VERSION,
      verdict,
      allBlockersResolved:  allPass,
      blockers:             Object.freeze(blockers),
      warnings:             Object.freeze(warnings),
      checks: Object.freeze({
        c1_onboardingGuard: c1,
        c2_taskStore:       c2,
        c3_activityKey:     c3,
        c4_scanResult:      c4,
        c5_scanCta:         c5,
        c6_sync:            c6,
        w38_persistenceProductionSafe: persistenceProductionSafe,
        w38_invitesActivationReady:    invitesActivationReady,
        w38_offlineWired:               offlineWired,
      }),
      caveats: Object.freeze({
        knowledgeGap,
        ngoRolloutGated,
        buyerRolloutPending,
      }),
      // Wave-38 — sub-probe envelopes for QA / production-console
      // verification.
      persistence:     persistence    || null,
      invites:         invites        || null,
      offline:         offline        || null,
      bulkOnboarding:  _probe('__bulkOnboardingHealth'),
      releaseLock:     _probe('__releaseLock'),
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
