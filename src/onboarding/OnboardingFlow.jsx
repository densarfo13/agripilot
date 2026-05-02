/**
 * OnboardingFlow — Simple Onboarding orchestrator.
 *
 * Six steps (spec §1):
 *   1. Farmer type
 *   2. Location
 *   3. Language
 *   4. Crop selection
 *   5. Basic farm setup
 *   6. Today's Plan preview
 *
 * Mobile-first: header carries "Step N of 6" + back chevron;
 * footer carries Continue (disabled when required data is
 * missing) and Help / Contact links.
 *
 * Strict-rule audit
 *   • Hides quietly when FEATURE_SIMPLE_ONBOARDING is off so
 *     callers / tests routed here from a paused rollout don't
 *     hit a blank screen — they're forwarded to the existing
 *     /onboarding flow.
 *   • The §8 "save reaches 100% but doesn't redirect" bug is
 *     fixed by ALWAYS navigating regardless of API state, with
 *     a localStorage fallback so the farmer's data is never
 *     lost.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import { isFeatureEnabled } from '../utils/featureFlags.js';
import {
  loadOnboardingProfile,
  patchOnboardingProfile,
  completeOnboarding,
} from './onboardingStore.js';
import {
  saveFarmLanguage, saveUserLanguage,
} from '../utils/localeEngine.js';
import { logEvent, EVENT_TYPES } from '../data/eventLogger.js';
import { persistFarmAfterSetup } from '../core/sessionBootstrap.js';

import StepFarmerType       from './StepFarmerType.jsx';
import StepLocation         from './StepLocation.jsx';
import StepLanguage         from './StepLanguage.jsx';
import StepCropSelection    from './StepCropSelection.jsx';
import StepFarmSetup        from './StepFarmSetup.jsx';
import StepDailyPlanPreview from './StepDailyPlanPreview.jsx';

const TOTAL_STEPS = 6;

// Required-field rules per step. Continue stays disabled
// until each rule passes. Spec §9: "disabled only when
// required field is missing".
function canContinue(step, profile) {
  switch (step) {
    case 1: return !!profile.farmerType;
    case 2: return !!profile.country;       // GPS or manual both OK
    case 3: return !!profile.language;
    case 4:
      if (profile.cropId === 'other') {
        return !!(profile.cropName && profile.cropName.trim());
      }
      return !!profile.cropId;
    case 5: return true;                    // every field optional
    case 6: return true;                    // preview only
    default: return true;
  }
}

export default function OnboardingFlow() {
  const navigate = useNavigate();

  // Forward to the legacy onboarding when the flag is off so
  // anyone who lands here doesn't see a blank screen.
  if (!isFeatureEnabled('FEATURE_SIMPLE_ONBOARDING')) {
    // Risk-fix follow-up to 9874630: when the simple-onboarding
    // flag is off, route to the CANONICAL post-rewrite entry
    // (/onboarding/start \u2192 FastFlow) instead of the legacy
    // /onboarding root. This collapses two parallel onboarding
    // paths into one user-facing flow.
    navigate('/onboarding/start', { replace: true });
    return null;
  }

  const [profile, setProfile] = React.useState(() => loadOnboardingProfile());
  const [step, setStep] = React.useState(1);
  const [busy, setBusy] = React.useState(false);

  // Telemetry — log when each step is reached.
  React.useEffect(() => {
    try {
      logEvent(EVENT_TYPES.ONBOARDING_STEP_VIEWED || 'onboarding_step_viewed',
        { step, farmerType: profile.farmerType, language: profile.language });
    } catch { /* swallow */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function update(patch) {
    setProfile((cur) => {
      const next = { ...cur, ...patch };
      patchOnboardingProfile(patch);
      return next;
    });
  }

  function goNext() {
    if (!canContinue(step, profile)) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }
  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  /**
   * complete — final step's "Go to Home" handler.
   *
   * Spec §8 fix: the legacy "save reaches 100% but doesn't
   * redirect" bug came from awaiting an API call that could
   * hang. We:
   *   1. Persist locally FIRST (synchronous, never throws).
   *   2. Apply the language preference at user + farm scope.
   *   3. Navigate to Home unconditionally.
   *   4. Background-fire any optional sync (when wired).
   *
   * Because the localStorage write is the source of truth,
   * the farmer's data survives even if the page reloads
   * mid-navigation.
   */
  async function complete() {
    if (busy) return;
    setBusy(true);
    try {
      const finalProfile = completeOnboarding({
        // Mirror the spec's data-model field names.
      });

      // Mirror the saved farm onto the standardized session
      // keys (spec §5 + §6) so DashboardSafeLoader sees a
      // ready session immediately after navigation.
      try {
        persistFarmAfterSetup({
          farm: {
            id: finalProfile.activeFarmId,
            farmName: finalProfile.farmName,
            crop: finalProfile.cropId,
            cropName: finalProfile.cropName,
            country: finalProfile.country,
            region: finalProfile.region,
            farmType: finalProfile.farmSize === 'backyard' ? 'backyard' : 'small_farm',
            plantingDate: finalProfile.plantingDate,
            farmSize: finalProfile.farmSize,
          },
          // Backend not wired yet; mark as pending so a future
          // sync pass can promote it.
          pendingSync: true,
        });
      } catch { /* never block the redirect */ }

      if (finalProfile.language) {
        try {
          if (finalProfile.activeFarmId) {
            saveFarmLanguage(
              finalProfile.activeFarmId,
              finalProfile.language,
              finalProfile.locationSource === 'gps' ? 'gps' : 'manual',
              finalProfile.country || null,
              finalProfile.region  || null,
            );
          } else {
            saveUserLanguage(finalProfile.language, 'manual');
          }
        } catch { /* swallow — local save already done */ }
      }

      try {
        logEvent(EVENT_TYPES.ONBOARDING_COMPLETED || 'onboarding_completed', {
          farmerType: finalProfile.farmerType,
          country:    finalProfile.country,
          language:   finalProfile.language,
          cropId:     finalProfile.cropId,
        });
      } catch { /* swallow */ }
    } catch { /* swallow — never block navigation */ }

    // Spec §8: navigate unconditionally. The farmer always
    // reaches Home after pressing the final button.
    navigate('/dashboard', { replace: true });
  }

  // Render the active step.
  let body = null;
  switch (step) {
    case 1: body = (
      <StepFarmerType
        value={profile.farmerType}
        onChange={update}
        onContinue={goNext}
      />
    ); break;
    case 2: body = (
      <StepLocation value={profile} onChange={update} />
    ); break;
    case 3: body = (
      <StepLanguage value={profile} onChange={update} />
    ); break;
    case 4: body = (
      <StepCropSelection value={profile} onChange={update} />
    ); break;
    case 5: body = (
      <StepFarmSetup value={profile} onChange={update} />
    ); break;
    case 6: body = (
      <StepDailyPlanPreview
        value={profile}
        onComplete={complete}
        busy={busy}
        // Review-step spec \u2014 each "Edit your setup" key maps to
        // the step that owns that field. The profile state is
        // preserved across the jump (setStep flips the pointer
        // only); when the user re-reaches step 6, their edits
        // are reflected in the daily-plan preview.
        onEditStep={(key) => {
          const map = {
            crop:         4, // StepCropSelection
            location:     2, // StepLocation
            growingSetup: 5, // StepFarmSetup (closest analogue
                              // in this flow; the canonical
                              // growing-setup picker lives in
                              // QuickGardenSetup, which this
                              // flow doesn't traverse).
            farmSize:     5, // StepFarmSetup also owns the
                              // farm-size field (farm-only edit
                              // option per polish-audit \u00a71).
          };
          const target = map[key];
          if (Number.isFinite(target)) setStep(target);
        }}
      />
    ); break;
    default: body = null;
  }

  // Review-step spec \u2014 the back button MUST be available on
  // step 6 too so the user can step back through the flow
  // without committing. The parent's goBack() preserves all
  // entered data because it only changes the step pointer.
  const showCta = step !== 1 && step !== 6;
  const showBack = step > 1;

  return (
    <main style={S.page} data-testid="onboarding-flow" data-step={step}>
      <div style={S.container}>
        <header style={S.header}>
          {showBack ? (
            <button
              type="button"
              onClick={goBack}
              style={S.backBtn}
              aria-label={tSafe('common.back', 'Back')}
              data-testid="onboarding-back"
            >
              {'\u2190'}
            </button>
          ) : <span style={S.backBtn} aria-hidden="true" />}
          <span style={S.progress} data-testid="onboarding-progress-pill">
            {/* Farm/garden separation spec \u00a73 \u2014 do NOT show
                "Step 4 of 6" / "5 of 6" / "6 of 6"; those read
                long and intimidating just before the commit.
                Steps 1\u20133 still show "Step X of {TOTAL_STEPS}" so
                the user has a sense of position; steps 4\u20135 hide
                the count entirely (progress bar speaks); step 6
                shows "Almost done" so the final commit reads
                positive instead of heavy. */}
            {step === TOTAL_STEPS
              ? tSafe('onboarding.almostDone', 'Almost done')
              : (step <= 3
                  ? tSafe('onboarding.stepOf', 'Step {step} of {total}')
                      .replace('{step}', String(step))
                      .replace('{total}', String(TOTAL_STEPS))
                  : '')}
          </span>
          <span style={S.backBtn} aria-hidden="true" />
        </header>

        <div style={S.progressTrack} aria-hidden="true">
          <div
            style={{
              ...S.progressFill,
              width: `${Math.round((step / TOTAL_STEPS) * 100)}%`,
            }}
          />
        </div>

        <div style={S.body}>{body}</div>

        {showCta && (
          <button
            type="button"
            onClick={goNext}
            disabled={!canContinue(step, profile)}
            style={{
              ...S.continueBtn,
              ...(!canContinue(step, profile) ? S.continueBtnDisabled : null),
            }}
            data-testid="onboarding-continue"
          >
            {tSafe('common.continue', 'Continue')}
          </button>
        )}

        <footer style={S.footer}>
          <button
            type="button"
            onClick={() => navigate('/help')}
            style={S.footerLink}
            data-testid="onboarding-help-link"
          >
            {tSafe('help.needHelp', 'Need help?')}
          </button>
          <span style={S.footerDot} aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => navigate('/help')}
            style={S.footerLink}
            data-testid="onboarding-contact-link"
          >
            {tSafe('help.contactTeam', 'Contact our team')}
          </button>
        </footer>
      </div>
    </main>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1rem 1rem 2rem',
  },
  container: {
    maxWidth: '32rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    fontSize: '0.75rem',
    color: '#9FB3C8',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#22C55E',
    transition: 'width 0.25s ease',
  },
  body: { display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  continueBtn: {
    padding: '0.875rem 1rem',
    borderRadius: 14,
    border: 'none',
    background: '#22C55E',
    color: '#062714',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 52,
    marginTop: '0.25rem',
  },
  continueBtnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  footer: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    paddingTop: '0.5rem',
  },
  footerLink: {
    background: 'transparent',
    border: 'none',
    color: '#86EFAC',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
  footerDot: { color: 'rgba(255,255,255,0.24)' },
};
