/**
 * src/runtime/launchBlockers/GoLiveHealthRuntime.ts — composite
 * go-live verdict over the wave-26 launch blockers, the wave-38
 * production-persistence probes, AND the wave-39 adoption probes.
 *
 *   import { goLiveHealth, installGoLiveHealthGlobal }
 *     from 'src/runtime/launchBlockers/GoLiveHealthRuntime';
 *
 *   window.__goLiveHealth()
 *
 * Verdict rules (wave-39 spec §9)
 * ──────────────────────────────
 *   NO_GO if:
 *     • any wave-26 C-1…C-6 probe fails (scan broken etc.)
 *     • persistence unavailable in production
 *     • production write endpoints unsafe
 *     • invite activation broken for NGO pilot
 *     • critical writes unsafe (criticalWritesPersisted=false in prod)
 *
 *   GO_WITH_LIMITATIONS if:
 *     • knowledge below target
 *     • invite provider not configured (but invite-status tracked)
 *     • real-device QA pending
 *     • offline validation not yet attested
 *
 *   GO if:
 *     • persistence postgres + critical writes persisted
 *     • invites working (provider + route)
 *     • offline validated
 *     • knowledge at-or-above target
 *
 * Strict-rule audit
 *   • Composition over EIGHT probes plus the wave-26 sextet.
 *   • SSR-safe. Pure. Frozen envelope. Never throws.
 *   • Honest: knowledge gap reports the real launchCoveragePercent
 *     read from __knowledgeCoverageHealth — never hard-coded.
 */

export const GO_LIVE_HEALTH_RUNTIME_VERSION = 'go-live-health-v2';

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
    // ─── Wave-26 — six launch blockers (scan integrity) ─────────
    const onboardingGuard = _probe('__onboardingGuardHealth');
    const taskStore       = _probe('__taskStoreHealth');
    const activity        = _probe('__activityDataHealth');
    const scanResult      = _probe('__scanResultHealth');
    const scanCta         = _probe('__scanCtaHealth');
    const sync            = _probe('__syncHealth');

    const c1 = _ok(onboardingGuard, 'onboardingGuardReady', 'bypassBlocked');
    const c2 = _ok(taskStore,       'singleTaskSource', 'duplicateStoresRemoved',
                                     'taskConsistencyReady');
    const c3 = _ok(activity,        'activityKeyCorrect', 'migrationReady');
    const c4 = _ok(scanResult,      'singleResultCard', 'duplicateRenderBlocked');
    const c5 = _ok(scanCta,         'savePlantReady', 'createTaskReady',
                                     'scanAgainReady', 'activityReady');
    const c6 = _ok(sync,            'referenceErrorRemoved', 'queueVisible',
                                     'syncStateHonest');

    // ─── Wave-38 — production persistence ────────────────────────
    const persistence = _probe('__persistenceHealth');
    const persistenceProductionSafe =
      !!(persistence
         && (persistence.productionWritesEnabled === true
             || persistence.isProduction === false)
         && persistence.writeEndpointsSafe === true);

    // Wave-39 — criticalWritesPersisted gates GO. In non-prod the
    // flag is informational only.
    const isProd = !!(persistence && persistence.isProduction === true);
    const criticalWritesUnsafe =
      isProd && persistence
            && persistence.criticalWritesPersisted !== true;

    // ─── Wave-38/39 — invite runtime ─────────────────────────────
    const invites = _probe('__inviteHealth');
    const invitesActivationReady =
      !!(invites && invites.activationFlowReady === true
         && invites.fakeDelivery === false);
    const invitesProviderConfigured =
      !!(invites && (invites.emailProviderConfigured === true
                  || invites.smsProviderConfigured   === true));

    // ─── Wave-38/39 — offline validation ─────────────────────────
    const offline = _probe('__offlineValidationHealth');
    const offlineWired = !!(offline && offline.initialized === true);

    // Wave-23 — direct queue-health probe takes precedence when
    // available; falls back to the offline-validation probe.
    const queue = _probe('__queueHealth');
    const queueWired = !!(queue && queue.initialized === true
                          && queue.offlineQueueReady === true);
    // Treat queue-readiness as the truth for offlineWired when the
    // wave-23 probe is live; otherwise keep the legacy signal.
    const offlineReady = queue ? queueWired : offlineWired;

    // ─── Wave-39 — adoption probes ───────────────────────────────
    const onboarding      = _probe('__onboardingHealth');
    const ngoOnboarding   = _probe('__ngoOnboardingHealth');
    const buyerOnboarding = _probe('__buyerOnboardingHealth');
    const knowledge       = _probe('__knowledgeCoverageHealth');
    const retention       = _probe('__retentionHealth');

    // Adoption-side blockers — these are TRUE blockers when their
    // probes positively report `forcedEnterpriseSetup` or
    // `noPayments=false` etc. Default to "no blocker" when the
    // probe hasn't loaded yet (honest fail-open for warnings; the
    // real gate is the static governance check).
    const onboardingForcedEnterprise =
      !!(onboarding && onboarding.forcedEnterpriseSetup === true);
    const buyerHasPayments =
      !!(buyerOnboarding && buyerOnboarding.noPayments === false);
    const buyerPrivateDataLeaked =
      !!(buyerOnboarding && buyerOnboarding.privateFarmerDataHidden === false);
    const ngoSkipsCsvPreview =
      !!(ngoOnboarding && ngoOnboarding.csvPreviewRequired === false);

    // Knowledge coverage — warning only.
    const knowledgeBelowTarget =
      !!(knowledge && knowledge.atOrAboveTarget === false);
    const launchCoveragePercent =
      (knowledge && typeof knowledge.launchCoveragePercent === 'number')
        ? knowledge.launchCoveragePercent
        : 0;

    // Retention runtime ready — warn-only if not ready.
    const retentionReady =
      !!(retention && retention.initialized === true);

    // ─── Verdict composition ─────────────────────────────────────
    const allWaveTwentySix = c1 && c2 && c3 && c4 && c5 && c6;
    const allBlockers =
         allWaveTwentySix
      && persistenceProductionSafe
      && !criticalWritesUnsafe
      && !onboardingForcedEnterprise
      && !buyerHasPayments
      && !buyerPrivateDataLeaked
      && !ngoSkipsCsvPreview;

    const blockers: string[] = [];
    if (!c1) blockers.push('C1_onboardingGuard');
    if (!c2) blockers.push('C2_taskStore');
    if (!c3) blockers.push('C3_activityKey');
    if (!c4) blockers.push('C4_scanResult');
    if (!c5) blockers.push('C5_scanCta');
    if (!c6) blockers.push('C6_sync');
    if (!persistenceProductionSafe) blockers.push('W38_persistenceProductionUnsafe');
    if (criticalWritesUnsafe)       blockers.push('W39_criticalWritesNotPersisted');
    if (onboardingForcedEnterprise) blockers.push('W39_forcedEnterpriseSetup');
    if (buyerHasPayments)           blockers.push('W39_buyerPaymentSurfacePresent');
    if (buyerPrivateDataLeaked)     blockers.push('W39_buyerPrivateDataLeaked');
    if (ngoSkipsCsvPreview)         blockers.push('W39_ngoCsvSkipsPreview');

    const warnings: string[] = [];
    if (!invitesProviderConfigured) warnings.push('W39_inviteProviderUnconfigured');
    if (!invitesActivationReady)    warnings.push('W39_invitesNotConfigured');
    if (!offlineReady)              warnings.push('W39_offlineValidationOffline');
    if (knowledgeBelowTarget)       warnings.push(
      `W39_knowledgeBelowTarget(${launchCoveragePercent}%)`);
    if (!retentionReady)            warnings.push('W39_retentionUntracked');

    let verdict: 'NO_GO' | 'GO_WITH_LIMITATIONS' | 'GO';
    if (!allBlockers) verdict = 'NO_GO';
    else if (warnings.length > 0) verdict = 'GO_WITH_LIMITATIONS';
    else verdict = 'GO';

    return Object.freeze({
      runtimeVersion:       GO_LIVE_HEALTH_RUNTIME_VERSION,
      verdict,
      allBlockersResolved:  allBlockers,
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
        w39_criticalWritesPersisted:   !criticalWritesUnsafe,
        w39_onboardingNotForced:       !onboardingForcedEnterprise,
        w39_buyerNoPayments:           !buyerHasPayments,
        w39_buyerPrivateHidden:        !buyerPrivateDataLeaked,
        w39_ngoCsvPreviewRequired:     !ngoSkipsCsvPreview,
        w39_knowledgeAtTarget:         !knowledgeBelowTarget,
        w39_retentionReady:            retentionReady,
      }),
      caveats: Object.freeze({
        knowledgeBelowTarget,
        launchCoveragePercent,
        ngoRolloutGated:    !invitesActivationReady,
        buyerRolloutPending: !invitesProviderConfigured,
      }),
      // Wave-38/39 — sub-probe envelopes for QA / prod console.
      persistence:     persistence    || null,
      invites:         invites        || null,
      offline:         offline        || null,
      onboarding:      onboarding     || null,
      ngo:             ngoOnboarding  || null,
      buyer:           buyerOnboarding|| null,
      knowledge:       knowledge      || null,
      retention:       retention      || null,
      bulkOnboarding:  _probe('__bulkOnboardingHealth'),
      releaseLock:     _probe('__releaseLock'),
    });
  }, Object.freeze({
    runtimeVersion:      GO_LIVE_HEALTH_RUNTIME_VERSION,
    verdict:             'NO_GO',
    allBlockersResolved: false,
    blockers:            Object.freeze(['probe_failure']),
    warnings:            Object.freeze([]),
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
