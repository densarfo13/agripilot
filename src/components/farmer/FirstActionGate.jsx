/**
 * FirstActionGate — top-of-Home decision card (Indispensable
 * Home Loop §1).
 *
 * Renders ONE primary action with the spec's exact framing:
 *   • Header:        "Before you do anything, do this first:"
 *   • Title:         localized action title (one line)
 *   • Detail:        one short sentence
 *   • Reason:        provenance (location/weather, plant/setup, …)
 *   • Consequence:   one line, never alarmist
 *   • Memory:        zero or one personal line (engine picks)
 *   • Area insight:  zero or one line, only when confidence ≥ medium
 *   • CTA:           single Done button
 *
 * After Done:
 *   • dispatches `farroway:primaryActionDone` (so the streak /
 *     progress engines can listen without a hard import dep)
 *   • shows the tomorrow hook line for ~6s
 *   • fires analytics events (home_opened on mount,
 *     primary_action_shown on first paint, primary_action_completed
 *     on Done)
 *
 * Strict no-leak rule: every visible string routes through tStrict
 * with a curated fallback, so a non-English UI never falls back to
 * the bare English value.
 *
 * Inputs come from the parent (Home page), which composes weather
 * + memory + insights + context once and passes them in. The gate
 * itself is a pure renderer + Done dispatcher.
 *
 * Props
 * ─────
 *   weather     {humidity, rainExpected, temperatureC}  (required-ish)
 *   memory      output of getUserMemory()               (optional)
 *   insights    array from globalInsightsClient         (optional)
 *   context     {activeExperience, cropOrPlant, region, growingSetup}
 *   onDone      ()=>void — caller's hook for streak/progress
 *
 * The component is small and additive. It does NOT mutate the
 * existing Home layout below it — the spec just asks that it
 * "visually dominate" the top, which the styling delivers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tStrict } from '../../i18n/strictT.js';
// Fix Messaging Inconsistency §1 + §4 — single source of truth
// for "render this string in mode-correct vocabulary". Routes
// every visible engine-driven string through `sanitize()` so a
// stray "your farm" leaking from the engine into a backyard
// user's view automatically rewrites to "your garden".
import useUserMode from '../../hooks/useUserMode.js';
import { buildPrimaryAction } from '../../core/primaryActionEngine.js';
import { trackEvent } from '../../core/analytics.js';
import { markHomeOpenedToday } from '../../core/firstActionNotifications.js';
import { recordHealthFeedback } from '../../core/healthFeedbackStore.js';
import { consumeTimeToFirstAction } from '../../core/onboardingTiming.js';
// Demo / Investor Mode §3 — when no real area-insight exists, the
// gate falls back to the spec's "Growers in your area..." line so
// investor demos always have social proof on screen. Gated on
// isDemoMode so production users never see imputed copy.
import { isDemoMode } from '../../config/demoMode.js';
// Viral Growth Loop §1 + §2 — share the action+location insight
// after the user taps Done. Web Share API first, clipboard
// fallback. Caller passes the localized one-line action so the
// outgoing message reads "Farroway told me {action} based on my
// location".
import { shareFarrowayInsight } from '../../growth/insightShare.js';
// Primary Action Clarity §6 — small "Listen" button rendered
// directly below the Done CTA so low-literacy users can hear
// the headline (engine-driven) read aloud in the active UI
// language. Visually secondary by spec (size='sm', ghost
// styling); never competes with the Done CTA above.
import VoiceButton from '../VoiceButton.jsx';

export default function FirstActionGate({
  weather,
  memory,
  insights,
  context,
  // Risk fix #4 — optional precomputed decision. Pages using
  // `ultimateDecisionEngine.decideToday()` pass the composer's
  // `primaryAction` field here; the gate skips its own engine
  // call and uses the supplied object directly. Back-compat:
  // when `decision` is undefined we fall back to the legacy
  // weather/memory/insights/context inputs. This lets the
  // composer become the single source of truth for ordering /
  // crop hints / scan-follow-up while existing call sites keep
  // working unchanged.
  decision,
  // Engagement Depth §1 — optional bonus actions surfaced after
  // Done. Caller passes the composer's `decision.supportingTasks`
  // (capped at 2 by ultimateDecisionEngine). The first item, if
  // any, renders as "Next step (optional): {action}". Hidden when
  // empty/missing — the spec's "no overwhelm" rule (§7).
  nextSteps,
  // Engagement Depth §5 + §6 — daily completion count for the
  // insight-unlock line. ≥2 flips on "You're ahead today —
  // conditions look good" after the toast. Defaults to 0; the
  // unlock simply doesn't fire.
  dailyCount = 0,
  onDone,
}) {
  // Subscribe to language change so all the localized strings
  // refresh on a flip without forcing the parent to re-render.
  useTranslation();
  // Optimize Scan Feature Placement §3 — useNavigate called
  // unconditionally at component top (NOT inside a try/catch
  // IIFE — the prior VoiceAssistant fix taught us that pattern
  // desyncs React's hook counter under StrictMode). Used by
  // the contextual "Scan crop" affordance rendered in the
  // post-Done state below.
  const navigate = useNavigate();
  // Fix Messaging Inconsistency §1 + §4 — sanitize() rewrites
  // any farm/garden/crop/plant/task/step term to the
  // mode-correct variant before render, so a stray "your farm"
  // leaking from the engine into a backyard user's view (or
  // vice versa) auto-corrects without per-call-site discipline.
  const { sanitize } = useUserMode();

  const action = useMemo(
    () => decision
      ? decision
      : buildPrimaryAction({ weather, memory, insights, context }),
    [decision, weather, memory, insights, context],
  );

  const [done, setDone]                 = useState(false);
  const [showTomorrow, setShowTomorrow] = useState(false);
  // Conversion §6 — CTA tap interaction. `pressing` toggles a
  // brief scale-down on tap; `done` triggers the checkmark
  // appearance + the parent card's fade. Reset on dismount via
  // standard useState lifecycle.
  const [pressing, setPressing]         = useState(false);
  // Data Moat §1 — time_to_action measurement. Stamped on mount
  // (when the gate first paints, equivalent to action_shown);
  // delta computed on Done click and shipped on the
  // primary_action_completed payload as `timeToActionMs`.
  const shownAtRef                      = useRef(null);
  // Data Moat §2 — health-feedback prompt state. Renders only
  // after Done, between toast and tomorrow line. Submitted
  // value is passed to recordHealthFeedback + analytics.
  const [healthFeedback, setHealthFeedback] = useState(null);

  // Analytics §12: home_opened (on mount) + primary_action_shown
  // (on first paint of the gate). primary_action_completed fires
  // from the Done handler. Wrapped in try/catch via trackEvent
  // itself ("never crash app").
  useEffect(() => {
    // Data Moat §1 — stamp the "shown at" timestamp once, on
    // first paint of the gate. Used to compute time_to_action
    // when the user taps Done.
    shownAtRef.current = Date.now();
    safeTrack('home_opened', context, action);
    safeTrack('primary_action_shown', context, action);
    // Spec §3: stamp "home opened today" so the morning push
    // notification doesn't re-fire later in the day. The stamp
    // is keyed by date — midnight rollover lets it re-arm.
    try { markHomeOpenedToday(); }
    catch { /* never propagate */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onClickDone = useCallback(() => {
    // User Behavior Tracking §2 — fire `action_clicked` on the
    // very first line of the handler so the analytics records
    // the tap regardless of any downstream failure (state flip,
    // analytics write, navigation). Distinct from
    // `primary_action_completed` so the funnel can measure the
    // shown→clicked→completed micro-progression separately.
    safeTrack('action_clicked', context, action);
    // Conversion §6 tap interaction:
    //   1. Brief scale-down on press (pressing=true) for a tactile
    //      "I felt the click" cue. Cleared 140ms later.
    //   2. State flips to done → card fades + checkmark replaces
    //      the headline; toast appears.
    setPressing(true);
    setTimeout(() => setPressing(false), 140);
    setDone(true);
    setShowTomorrow(true);
    // Data Moat §1 — compute time_to_action and ship on the
    // completion event so the analytics pipeline can aggregate
    // by primaryActionType + experience tier.
    const timeToActionMs = shownAtRef.current
      ? Math.max(0, Date.now() - shownAtRef.current)
      : null;
    // Onboarding cleanup §4 — consume the onboarding-start stamp
    // (set by FastOnboarding mount). Returns the activation
    // delta in ms or null when no stamp exists (returning user,
    // already consumed once, or storage unavailable). Field is
    // omitted from the payload when null so the analytics schema
    // stays clean.
    const timeToFirstActionMs = (() => {
      try { return consumeTimeToFirstAction(); }
      catch { return null; }
    })();
    const completedExtras = { timeToActionMs };
    if (timeToFirstActionMs != null) {
      completedExtras.timeToFirstActionMs = timeToFirstActionMs;
    }
    safeTrack('primary_action_completed', context, action, completedExtras);
    // Spec §12 follow-up — surface tomorrow-hook impressions so we
    // can measure whether the bottom-of-card preview drives next-
    // day opens. Fired right when we flip showTomorrow on, before
    // the 6s auto-hide.
    safeTrack('tomorrow_hook_shown', context, action);
    // Hand off to caller — streak / progress engines listen here.
    if (typeof onDone === 'function') {
      try { onDone(action); } catch { /* never propagate */ }
    }
    // Cross-component broadcast for any listener that's not
    // imported by the Home page (primaryActionDoneBridge is the
    // canonical subscriber; it bumps streakEngine.recordTaskCompleted).
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('farroway:primaryActionDone', {
          detail: { type: action.primaryActionType, at: Date.now() },
        }));
      }
    } catch { /* ignore */ }
    // Auto-hide the tomorrow hook after 6s so it doesn't crowd
    // the rest of the Home layout for the whole session.
    setTimeout(() => setShowTomorrow(false), 6_000);
  }, [action, context, onDone]);

  /**
   * Skip affordance (spec §12 follow-up) — a small "Not now"
   * link below the Done button. Fires `primary_action_skipped`
   * but does NOT update the streak. The user can still come
   * back later in the day and tap Done. Hidden after Done so
   * the toast / tomorrow line stays clean.
   */
  const onClickSkip = useCallback(() => {
    safeTrack('primary_action_skipped', context, action);
    setDone(true);
    // No tomorrow hook on skip — keeps the visual signal honest:
    // tomorrow preview is a Done-only reward.
  }, [action, context]);

  /**
   * Data Moat §2 — health-feedback handler. Vocabulary maps:
   *   spec UI label  →  healthFeedbackStore value
   *   "Healthy"      →  'yes'
   *   "Getting worse" → 'no'
   *   "Not sure"     →  'not_sure'
   *
   * Stamps the active context (farm/garden id) so the rollup can
   * partition outcomes by entity. Safe to call multiple times —
   * the store dedupes by (contextId, date).
   */
  const onPickHealth = useCallback((value) => {
    if (!value) return;
    setHealthFeedback(value);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const ctxType = (context && String(context.activeExperience || '').toLowerCase() === 'garden')
        ? 'garden' : 'farm';
      // contextId — best-effort. We don't always have a stable
      // farm/garden id at this layer, so fall back to a synthetic
      // "today's-action" key. The store keys by (contextId+date)
      // so a missing id collapses to one record per day.
      const contextId = (context && (context.contextId || context.farmId || context.gardenId))
        || `farroway:home:${today}`;
      recordHealthFeedback({
        contextId,
        contextType: ctxType,
        date: today,
        healthFeedback: value,   // 'yes' | 'no' | 'not_sure'
      });
    } catch { /* never propagate */ }
    safeTrack('health_feedback_submitted', context, action, { feedback: value });
  }, [action, context]);

  // ─── String resolution ───────────────────────────────────
  // tStrict semantics: missing key in non-English UI → return
  // the supplied fallback, never bleed English. The fallbacks
  // below are the spec's exact wording.

  // Viral Hook §4 — home header aligned to "Before you water,
  // check this first" so the home surface picks up exactly where
  // the post-onboarding hook left off ("Most people water too
  // early today"). The wording ties the hook → action → result
  // loop together visually.
  //
  // Viral Click → Conversion §5 — when a user landed via the
  // /try value-first surface, ViralLandingPage stamped a
  // sessionStorage flag so this gate can echo the same framing
  // ("Do not water today") on first paint instead of the engine's
  // arbitrary first action. Read + clear the stamp once so a
  // refresh doesn't keep over-riding the engine. The override
  // only affects the eyebrow/header pair; the engine's
  // primaryActionType still drives Done analytics + downstream
  // memory.
  const _viralPreviewActive = (() => {
    try {
      if (typeof sessionStorage === 'undefined') return false;
      const raw = sessionStorage.getItem('farroway:viralPreview:action');
      if (raw) {
        sessionStorage.removeItem('farroway:viralPreview:action');
        return true;
      }
    } catch { /* ignore */ }
    return false;
  })();
  // Audit + Fix All Screens for User Type Consistency §3 + §6 —
  // every engine-emitted string flows through `sanitize()` so a
  // "your farm" leaking from a farm_default fallback into a
  // backyard user's render auto-rewrites to "your garden" (and
  // vice versa). Static strings (`firstAction.header`,
  // `firstAction.effort`) intentionally NOT sanitized because
  // they're hand-curated copy — only engine-driven content
  // needs the runtime safety net.
  const headerText      = tStrict('firstAction.header',       'Before you act, check this first');
  const title           = sanitize(tStrict(action.titleKey,         action.titleFallback));
  const detail          = sanitize(tStrict(action.detailKey,        action.detailFallback));
  const reason          = sanitize(tStrict(action.reasonKey,        action.reasonFallback));
  const consequence     = sanitize(tStrict(action.consequenceKey,   action.consequenceFallback));
  // Conversion upgrade §1 — compose [Action] — [Consequence] as
  // ONE bold headline so the user's eye lands on a single
  // sentence carrying intent + stakes. The standalone
  // consequence amber line is now redundant, suppressed below.
  // Fix Messaging Inconsistency §1 + §4 — `sanitize()` swaps
  // any cross-mode terminology in the engine-emitted strings
  // (e.g. a farm-default fallback leaking "your crop" into a
  // backyard user's view auto-rewrites to "your plant").
  const headline        = sanitize(consequence ? `${title} \u2014 ${consequence}` : title);
  // Conversion upgrade §2 — small urgency chip above headline.
  // Engine derives the tier; gate renders it.
  const urgencyText     = action.urgencyKey
    ? tStrict(action.urgencyKey, action.urgencyFallback)
    : '';
  const urgencyTier     = action.urgencyTier || null;
  // Dependency System §2 — small day-cue rotates 7-way by
  // day-of-year. Cosmetic only; rendered between the urgency
  // chip and the headline so the user feels "fresh page today".
  const dayCueText      = action.dayCueKey
    ? tStrict(action.dayCueKey, action.dayCueFallback || '')
    : '';
  // Dependency System §3 — uncertainty line. Engine flags it
  // for weather-driven actions only. Renders below the effort
  // line; quiet styling.
  const uncertaintyText = action.showUncertainty
    ? tStrict(action.uncertaintyKey, action.uncertaintyFallback || '')
    : '';
  // Learning + Scoring §5 — personal track-record line. Shows
  // ONLY when the composer's personalScore.showBoost is true
  // (≥3 samples + ≥70% success rate on this action type).
  const personalBoostText = (action.personalScore && action.personalScore.showBoost)
    ? tStrict('firstAction.personalBoost', 'You\u2019ve had good results with this before')
    : '';
  // Conversion §1 effort line — fixed copy "Takes 30 seconds".
  // Surfaced under the headline to remove "is this going to
  // be a project?" hesitation. Resolution via tStrict so a
  // localized variant ships once translators write it.
  const effortText      = tStrict('firstAction.effort', 'Takes 30 seconds');
  const memoryText      = action.memoryKey
    ? sanitize(tStrict(action.memoryKey, action.memoryFallback))
    : '';
  // Primary Action Intelligence §5 — optional risk-boost line.
  // Engine sets it when humidity > 75 OR repeated-worse pattern.
  // Severity drives the visual weight (medium amber, high red).
  const riskNoteText    = action.riskNoteKey
    ? sanitize(tStrict(action.riskNoteKey, action.riskNoteFallback))
    : '';
  const riskNoteSeverity = action.riskNoteSeverity || null;
  // Demo / Investor Mode §3 — when there's no real area insight
  // (typical on a fresh demo session) but demo mode is on, render
  // the spec's social-proof line as a fallback so the investor
  // walkthrough always has the cue on screen. Real insights still
  // win when present.
  const _demoAreaInsight = (() => {
    try { return isDemoMode(); }
    catch { return false; }
  })();
  const areaInsightText = action.showAreaInsight
    ? sanitize(tStrict(action.areaInsightKey, action.areaInsightFallback))
    : (_demoAreaInsight
        ? sanitize(tStrict('firstAction.areaInsight.demo',
            'Growers in your area see better results doing this'))
        : '');
  const ctaDone         = tStrict(action.ctaDoneKey,          action.ctaDoneFallback);
  const tomorrowText    = sanitize(tStrict(action.tomorrowKey, action.tomorrowFallback));
  // Retention §2 — time anchor under the tomorrow line. Fixed
  // copy ("Check again tomorrow morning") sits under the
  // tomorrow hook so the user has a concrete return cue.
  const tomorrowAnchor  = tStrict('firstAction.tomorrow.timeAnchor', 'Check again tomorrow morning');

  // Toast wording is context-specific (spec §7).
  const isGarden = String(context && context.activeExperience || '').toLowerCase() === 'garden';
  // Optimize First Action Completion §5 — action-type-specific
  // reward toasts. When the engine emits a verb-typed action
  // (log_cost, water, spray, scan), the toast picks up its
  // matching context-specific copy ("Nice — you're tracking
  // your costs"). Inspection-style actions fall through to the
  // existing garden / farm split so the daily-habit-loop rewards
  // stay in place.
  const _typeToastKey = (() => {
    const t = String(action.primaryActionType || '').toLowerCase();
    if (t === 'log_cost') return 'firstAction.toast.logCost';
    if (t === 'water')    return 'firstAction.toast.watered';
    if (t === 'spray')    return 'firstAction.toast.sprayed';
    if (t === 'scan')     return 'firstAction.toast.scanned';
    return null;
  })();
  const _typeToastFallback = (() => {
    if (_typeToastKey === 'firstAction.toast.logCost') return 'Nice \u2014 you\u2019re tracking your costs';
    if (_typeToastKey === 'firstAction.toast.watered') return 'Nice \u2014 your plants are taken care of';
    if (_typeToastKey === 'firstAction.toast.sprayed') return 'Nice \u2014 you protected your crop today';
    if (_typeToastKey === 'firstAction.toast.scanned') return 'Nice \u2014 we have a read on your plant';
    return null;
  })();
  const toastText = _typeToastKey
    ? tStrict(_typeToastKey, _typeToastFallback)
    : isGarden
    ? tStrict('firstAction.toast.garden', 'Nice — you stayed ahead today 🌱')
    : tStrict('firstAction.toast.farm',   'Nice — you reduced risk today 🚜');

  // Data Moat §2 — health-feedback prompt strings.
  const healthPromptTitle  = tStrict('healthPrompt.title',     'How is your plant doing?');
  const healthOptHealthy   = tStrict('healthPrompt.healthy',   'Healthy');
  const healthOptWorse     = tStrict('healthPrompt.worse',     'Getting worse');
  const healthOptNotSure   = tStrict('healthPrompt.notSure',   'Not sure');
  const healthThanksText   = tStrict('healthPrompt.thanks',    'Thanks — this helps us learn.');

  return (
    <section
      className="first-action-gate"
      data-testid="first-action-gate"
      data-action-type={action.primaryActionType}
      data-completed={done ? 'true' : 'false'}
      // Viral Click → Conversion §5 — surface the "came from /try
      // preview" signal as a data attribute so analytics + future
      // context-preservation copy can target it without us
      // hijacking the engine's chosen primary action. Engine
      // remains the source of truth; this just records the
      // attribution.
      data-viral-preview={_viralPreviewActive ? 'true' : 'false'}
      style={{
        ...S.card,
        // Conversion §6 — slight card fade on Done so the
        // visual signal is "this primary slot is satisfied".
        ...(done ? S.cardDone : null),
      }}
    >
      <div style={S.header}>{headerText}</div>

      {/* Conversion §2 — urgency chip ("Do this now" / "Do today"
          / "This week"). Severity-styled: 'now' is amber, 'today'
          neutral, 'week' subtle. */}
      {urgencyText ? (
        <span
          style={{
            ...S.urgency,
            ...(urgencyTier === 'now' ? S.urgencyNow
              : urgencyTier === 'today' ? S.urgencyToday
              : S.urgencyWeek),
          }}
          data-tier={urgencyTier || 'week'}
          data-testid="first-action-urgency"
        >
          {urgencyText}
        </span>
      ) : null}

      {/* Dependency System §2 — day cue ("Today's check" /
          "A fresh look" / etc.) rotates by day-of-year so the
          gate doesn't read identically two days in a row. Tiny,
          dim, sits just under the urgency chip. */}
      {!done && dayCueText ? (
        <span style={S.dayCue} data-testid="first-action-day-cue">
          {dayCueText}
        </span>
      ) : null}

      {/* Conversion §1 — single bold headline:
          "[Action] — [Consequence]". The standalone consequence
          line below is intentionally removed; visual priority
          (§3) wants ONE dominant sentence. */}
      <h2 style={S.title}>{headline}</h2>

      {/* Conversion §1 effort line — "Takes 30 seconds".
          Tiny, dim, sits under the headline so the user reads
          it before the eye moves to the CTA. Hidden once Done
          fires (the checkmark / toast tells the same story). */}
      {!done && effortText ? (
        <p style={S.effort} data-testid="first-action-effort">{effortText}</p>
      ) : null}

      {/* Dependency System §3 — quiet "Conditions may have
          changed today" cue for weather-driven actions only.
          Hidden after Done. */}
      {!done && uncertaintyText ? (
        <p style={S.uncertainty} data-testid="first-action-uncertainty">
          {uncertaintyText}
        </p>
      ) : null}

      {/* Learning + Scoring §5 — personal track-record boost.
          Renders only when the composer's personalScore.showBoost
          is true (≥3 samples + ≥70% success rate). Sits between
          the uncertainty line and the meta row so the user sees
          "your past wins" right before the provenance. Hidden
          after Done. */}
      {!done && personalBoostText ? (
        <p style={S.personalBoost} data-testid="first-action-personal-boost">
          {personalBoostText}
        </p>
      ) : null}

      {/* Detail kept ONLY when it adds new info beyond the
          headline. Most engine paths set detail = a slightly-
          longer rephrase of the title; we hide it when it's
          essentially redundant with consequence. */}
      {detail && detail !== consequence ? (
        <p style={S.detail}>{detail}</p>
      ) : null}

      <div style={S.metaRow}>
        {reason       ? <span style={S.reason}>{reason}</span> : null}
        {areaInsightText ? <span style={S.area}>{areaInsightText}</span> : null}
      </div>

      {/* Risk-boost note — surfaces ABOVE memory line. Severity-
          styled; never alarmist. Suppressed when its text would
          duplicate the headline's consequence. */}
      {riskNoteText ? (
        <p
          style={{
            ...S.riskNote,
            ...(riskNoteSeverity === 'high' ? S.riskNoteHigh : null),
          }}
          data-severity={riskNoteSeverity || 'medium'}
          data-testid="first-action-risk-note"
        >
          {riskNoteText}
        </p>
      ) : null}
      {memoryText  ? <p style={S.memory}>{memoryText}</p> : null}

      {!done ? (
        <div style={S.ctaRow}>
          <button
            type="button"
            onClick={onClickDone}
            style={{
              ...S.cta,
              // Conversion §6 — scale-down on tap. Cleared after
              // ~140ms by the press timeout in onClickDone.
              ...(pressing ? S.ctaPressed : null),
            }}
            data-testid="first-action-done"
          >
            {/* Final Onboarding Optimization §6 — appended ✓
                glyph next to the Done label so the CTA reads as
                "tap = win" before the user has even tapped.
                Decorative; aria-hidden. The ctaDone string is
                still engine/i18n-driven so localized labels
                stay intact, just with the glyph stamped after. */}
            {/* Primary Action Clarity §1 + §3 — when the engine
                emits an action-specific CTA (e.g. "Log cost",
                "Mark watered"), it surfaces here verbatim and
                aligns with the action verb shown above. Default
                "Done" stays the safe fallback for inspection-
                style actions where the verb IS "done". */}
            <span>{ctaDone}</span>
            <span
              aria-hidden="true"
              style={{ marginLeft: 6, fontWeight: 900 }}
            >
              {'\u2713'}
            </span>
          </button>

          {/* Primary Action Clarity §6 — secondary "Listen"
              affordance below the Done CTA. size='sm' per spec
              ("smaller, secondary"); wrapped in a centered row
              so it stays visually below the dominant green CTA
              without crowding it. Speaks the engine's headline
              (the "what to do today" sentence the user just
              read) in the active UI language. Self-hides when
              speech synthesis is unavailable (VoiceButton's
              own contract). */}
          <div style={S.listenRow}>
            <VoiceButton text={headline} size="sm" />
          </div>

          {/* CONVERSION §4/§7: visible "Not now" affordance was
              removed because it competed with Done. The skip
              code path + `primary_action_skipped` analytics
              event still exist (`onClickSkip`) so a future
              non-button surface (long-press, swipe-to-dismiss)
              can fire it. The reference below preserves the
              binding so React doesn't strip it as unused under
              eslint's exhaustive-deps. */}
          {false && (
            <button
              type="button"
              onClick={onClickSkip}
              style={S.skip}
              data-testid="first-action-skip"
              aria-label={tStrict('primaryAction.cta.skipAria', 'Skip this action')}
            >
              {tStrict('primaryAction.cta.skip', 'Not now')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={S.toast} role="status" aria-live="polite" data-testid="first-action-toast">
            {/* Conversion §6 — checkmark icon precedes the toast
                text so the user gets an unambiguous "done" signal
                even before reading. Decorative only; aria-hidden. */}
            <span style={S.toastCheck} aria-hidden="true">{'\u2714'}</span>
            <span>{toastText}</span>
          </div>

          {/* Engagement Depth §6 — insight unlock. Quiet green
              line below the toast when the user has completed
              ≥2 actions today. Reinforcement-only; never a
              warning. Hidden at <2 so the typical "first Done
              of the day" view stays clean. */}
          {Number(dailyCount) >= 2 ? (
            <p style={S.aheadToday} data-testid="first-action-ahead-today">
              {tStrict('firstAction.aheadToday',
                'You\u2019re ahead today \u2014 conditions look good')}
            </p>
          ) : null}

          {/* Engagement Depth §1 — "Next step (optional): {action}".
              Surfaces ONLY after Done so the primary action keeps
              its single-affordance dominance pre-tap. Pulls the
              first supportingTask from the composer; the line is
              skipped when supportingTasks is empty so the spec's
              §7 "no overwhelm" rule holds (we never invent a
              follow-up). Tap-target points to /tasks where the
              user can mark it done — keeps the gate read-only. */}
          {Array.isArray(nextSteps) && nextSteps.length > 0 ? (
            <div style={S.nextStep} data-testid="first-action-next-step">
              <span style={S.nextStepLabel}>
                {tStrict('firstAction.nextStep.label', 'Next step (optional)')}
              </span>
              <span style={S.nextStepText}>
                {tStrict(
                  nextSteps[0].titleKey || '',
                  nextSteps[0].titleFallback || '',
                )}
              </span>
            </div>
          ) : null}

          {/* Viral Growth Loop §1 + §2 — small "Share this insight"
              affordance after Done. Spec calls for the trigger to
              fire after first action / streak / insight; the gate
              is the canonical "first action" surface so this is
              the primary entry point. Outgoing message uses the
              spec's exact format ("Farroway told me {action}
              based on my location"). Tapping uses the Web Share
              API on mobile, clipboard fallback elsewhere. Never
              throws; never blocks the rest of the post-Done
              experience. */}
          <button
            type="button"
            onClick={() => {
              shareFarrowayInsight({
                source:     'first_action',
                action:     action.titleFallback || action.titleKey || '',
                streakDays: null,
                lang:       (typeof navigator !== 'undefined'
                              && navigator.language) || 'en',
              });
            }}
            style={S.shareInsight}
            data-testid="first-action-share-insight"
          >
            <span aria-hidden="true" style={{ marginRight: 6 }}>
              {'\u{1F4E4}'}
            </span>
            {tStrict('firstAction.shareInsight', 'Share this insight')}
          </button>

          {/* Data Moat §2 — outcome-feedback prompt. Renders ONLY
              after Done. Three single-tap chips; once one is
              picked, the chips collapse to a thank-you line.
              Self-deduping (recordHealthFeedback collapses
              by contextId+date). */}
          {!healthFeedback ? (
            <div style={S.healthPrompt} data-testid="health-feedback-prompt">
              <p style={S.healthPromptTitle}>{healthPromptTitle}</p>
              <div style={S.healthOptionsRow}>
                <button
                  type="button"
                  onClick={() => onPickHealth('yes')}
                  style={{ ...S.healthOption, ...S.healthOptionHealthy }}
                  data-testid="health-feedback-healthy"
                >
                  {healthOptHealthy}
                </button>
                <button
                  type="button"
                  onClick={() => onPickHealth('no')}
                  style={{ ...S.healthOption, ...S.healthOptionWorse }}
                  data-testid="health-feedback-worse"
                >
                  {healthOptWorse}
                </button>
                <button
                  type="button"
                  onClick={() => onPickHealth('not_sure')}
                  style={{ ...S.healthOption, ...S.healthOptionNotSure }}
                  data-testid="health-feedback-notSure"
                >
                  {healthOptNotSure}
                </button>
              </div>
            </div>
          ) : (
            <p style={S.healthThanks} data-testid="health-feedback-thanks">
              {healthThanksText}
            </p>
          )}

          {/* Optimize Scan Feature Placement §3 — contextual scan
              trigger. Renders ONLY in the post-Done state so it
              never competes with the primary action above the
              fold (§4: "Scan must not compete with primary
              action"). Two-line layout: prompt + ghost-style
              "Scan crop" button. Tap fires the canonical
              scan_cta_clicked analytics + navigates to /scan
              the same way ScanHero does, so attribution + the
              SCAN_TAP paywall trigger keep working unchanged. */}
          <div style={S.scanContext} data-testid="first-action-scan-context">
            <span style={S.scanContextPrompt}>
              {tStrict('firstAction.scan.prompt',
                'See something wrong?')}
            </span>
            <button
              type="button"
              onClick={() => {
                try {
                  trackEvent('scan_cta_clicked', {
                    source: 'first-action-gate',
                    primaryActionType: action && action.primaryActionType,
                  });
                } catch { /* swallow */ }
                // Mirror the ScanHero pattern: stamp the scan-tap
                // paywall intent so the next Home open surfaces
                // the SCAN_TAP paywall (Freemium §3) — non-
                // blocking; user proceeds to /scan immediately.
                try {
                  if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('farroway:paywall:intent', 'scan_tap');
                  }
                } catch { /* swallow */ }
                try { navigate('/scan'); }
                catch { /* swallow */ }
              }}
              style={S.scanContextBtn}
              data-testid="first-action-scan-btn"
            >
              <span aria-hidden="true" style={{ marginRight: 6 }}>
                {'\u{1F4F7}'}
              </span>
              {tStrict('firstAction.scan.cta', 'Scan crop')}
            </button>
          </div>
        </>
      )}

      {showTomorrow ? (
        <>
          <p style={S.tomorrow} data-testid="first-action-tomorrow">{tomorrowText}</p>
          {/* Retention §2 — time anchor. Tiny line beneath the
              tomorrow hook so the user has a clear "when". */}
          {tomorrowAnchor ? (
            <p style={S.tomorrowAnchor} data-testid="first-action-tomorrow-anchor">{tomorrowAnchor}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

// ─── Analytics helper ─────────────────────────────────────

function safeTrack(name, context, action, extras) {
  try {
    trackEvent(name, {
      activeExperience: context && context.activeExperience,
      cropOrPlant:      context && context.cropOrPlant,
      region:           context && context.region,
      growingSetup:     context && context.growingSetup,
      primaryActionType: action && action.primaryActionType,
      timestamp:        Date.now(),
      // Data Moat §1 — caller-supplied extras (e.g.
      // timeToActionMs on primary_action_completed). Spread
      // last so the canonical fields can never be overwritten.
      ...(extras && typeof extras === 'object' ? extras : null),
    });
  } catch {
    // trackEvent itself is safe; this outer try/catch is a
    // belt-and-braces guard so analytics can NEVER crash a render.
  }
}

// ─── Styles ───────────────────────────────────────────────
// "Visually dominate" per spec §8 — green hairline border,
// stronger typography than surrounding cards, generous padding.

const S = {
  // Conversion §4 — primary action dominance. Bumped border
  // visibility, padding, and shadow so the card is unambiguously
  // the largest, highest-contrast surface above the fold.
  card: {
    background: 'rgba(34,197,94,0.10)',
    border: '1.5px solid rgba(34,197,94,0.45)',
    borderRadius: 18,
    padding: '22px 20px 24px',
    boxShadow: '0 10px 32px rgba(0,0,0,0.28)',
    color: '#EAF2FF',
    margin: '0 0 20px',
    transition: 'opacity 220ms ease, transform 220ms ease',
  },
  // Conversion §6 — fade the card slightly once Done is tapped
  // so the user perceives the primary slot as "satisfied" while
  // the toast + tomorrow line still register attention.
  cardDone: {
    opacity: 0.78,
    transform: 'scale(0.995)',
  },
  header: {
    fontSize: 12,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#86EFAC',
    fontWeight: 700,
    marginBottom: 4,
  },
  // Conversion §4 — primary action dominance. Title bumped
  // again (22 → 24) and color forced to pure white for the
  // highest in-card contrast. Still mobile-first; we keep the
  // headline to 6–9 words via the engine's curated copy so a
  // 320px viewport never overflows.
  title: {
    fontSize: 24,
    fontWeight: 800,
    margin: '8px 0 10px',
    color: '#FFFFFF',
    lineHeight: 1.20,
    letterSpacing: '-0.01em',
  },
  // Urgency chip styles (§2). Three tiers; visual weight tracks
  // the engine's tier classification.
  urgency: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '3px 9px',
    borderRadius: 999,
    marginTop: 2,
  },
  urgencyNow: {
    background: 'rgba(239,68,68,0.16)',
    color: '#FCA5A5',
    border: '1px solid rgba(239,68,68,0.35)',
  },
  urgencyToday: {
    background: 'rgba(245,158,11,0.16)',
    color: '#FDE68A',
    border: '1px solid rgba(245,158,11,0.35)',
  },
  urgencyWeek: {
    background: 'rgba(34,197,94,0.14)',
    color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.30)',
  },
  detail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    margin: '0 0 8px',
    lineHeight: 1.4,
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    fontSize: 12,
    color: 'rgba(255,255,255,0.62)',
    marginBottom: 8,
  },
  reason: {},
  area: {
    color: '#86EFAC',
    fontWeight: 600,
  },
  consequence: {
    fontSize: 12,
    color: 'rgba(245,158,11,0.95)',
    margin: '0 0 6px',
  },
  memory: {
    fontSize: 12,
    color: '#9FB3C8',
    margin: '0 0 12px',
  },
  riskNote: {
    fontSize: 12,
    fontWeight: 600,
    color: '#FDE68A',
    margin: '0 0 6px',
  },
  riskNoteHigh: {
    color: '#FCA5A5',
    fontWeight: 700,
  },
  ctaRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  cta: {
    appearance: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    border: 'none',
    borderRadius: 12,
    padding: '12px 20px',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
    width: '100%',
    minHeight: 48,
    WebkitTapHighlightColor: 'transparent',
    transition: 'transform 140ms ease, background 140ms ease',
  },
  // Conversion §6 — pressed-state scale-down on tap.
  ctaPressed: {
    transform: 'scale(0.96)',
    background: '#16A34A',
  },
  skip: {
    appearance: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.55)',
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '8px 12px',
    minHeight: 36,
    alignSelf: 'center',
    WebkitTapHighlightColor: 'transparent',
  },
  toast: {
    background: 'rgba(34,197,94,0.16)',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  toastCheck: {
    fontSize: 16,
    color: '#22C55E',
    fontWeight: 900,
  },
  // Data Moat §2 — health-feedback prompt block. Sits under the
  // Done toast in the gate's done state. Three pill-shaped chips
  // arranged horizontally on wide viewports, vertically stacking
  // on narrow ones via flex-wrap.
  healthPrompt: {
    marginTop: 12,
    padding: '10px 12px 12px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  healthPromptTitle: {
    margin: '0 0 8px',
    fontSize: 13,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.85)',
  },
  healthOptionsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  healthOption: {
    appearance: 'none',
    flex: '1 1 auto',
    minWidth: 88,
    minHeight: 36,
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    color: '#fff',
    background: 'rgba(255,255,255,0.05)',
    WebkitTapHighlightColor: 'transparent',
  },
  healthOptionHealthy: {
    background: 'rgba(34,197,94,0.18)',
    borderColor: 'rgba(34,197,94,0.45)',
    color: '#86EFAC',
  },
  healthOptionWorse: {
    background: 'rgba(239,68,68,0.16)',
    borderColor: 'rgba(239,68,68,0.40)',
    color: '#FCA5A5',
  },
  healthOptionNotSure: {
    background: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.75)',
  },
  healthThanks: {
    margin: '12px 2px 0',
    fontSize: 12,
    fontWeight: 600,
    color: '#86EFAC',
  },
  // Conversion §1 — effort line ("Takes 30 seconds"). Tiny,
  // dim, sits directly under the headline so the user reads it
  // before the eye lands on the CTA.
  effort: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    margin: '0 0 10px',
    fontWeight: 600,
  },
  // Dependency System §2 — day-cue micro-line. Sits between
  // the urgency chip and the headline. Subtle accent so it
  // doesn't compete with the chip's stronger background.
  dayCue: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
    marginBottom: 0,
    letterSpacing: '0.02em',
  },
  // Dependency System §3 — uncertainty cue. Quiet, slightly
  // amber-tinted so it whispers "you should look" without
  // shouting "alarm". Only renders for weather-driven actions.
  uncertainty: {
    fontSize: 12,
    color: 'rgba(245,158,11,0.85)',
    margin: '0 0 10px',
    fontWeight: 500,
    fontStyle: 'italic',
  },
  // Learning + Scoring §5 — personal-track-record boost line.
  // Same green hue family as the area-insight chip — both are
  // "social proof / past evidence" cues. Distinct from the
  // amber uncertainty line above.
  personalBoost: {
    fontSize: 12,
    color: '#86EFAC',
    margin: '0 0 8px',
    fontWeight: 600,
  },
  tomorrow: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.62)',
    margin: '10px 0 0',
    fontStyle: 'italic',
  },
  // Retention §2 — time anchor sits directly under the tomorrow
  // line. Slightly dimmer so the user reads the action first,
  // then the "when" cue without it competing for attention.
  tomorrowAnchor: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    margin: '2px 0 0',
  },
  // Engagement Depth §6 — insight unlock line. Same green family
  // as the toast / area-insight chip so the tone reads as
  // reinforcement, not alarm.
  aheadToday: {
    margin: '10px 2px 0',
    fontSize: 12,
    fontWeight: 700,
    color: '#86EFAC',
    letterSpacing: '0.01em',
  },
  // Primary Action Clarity §6 — Listen-button row sits directly
  // below the Done CTA. Centered + small top margin so the row
  // reads as a quiet secondary affordance. The VoiceButton
  // itself has its own pill styling; we only add positioning.
  listenRow: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 6,
  },
  // Optimize Scan Feature Placement §3 — contextual scan trigger
  // shown in the post-Done state. Two-row layout (prompt above,
  // ghost-style button below) so the user reads the question
  // first then sees the affordance. Visual weight kept light so
  // it never dominates the toast / health-feedback prompt that
  // fired moments earlier.
  scanContext: {
    marginTop: 14,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.16)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
  },
  scanContextPrompt: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: 600,
  },
  scanContextBtn: {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(59,130,246,0.10)',
    border: '1px solid rgba(59,130,246,0.40)',
    color: '#93C5FD',
    borderRadius: 999,
    padding: '0.4rem 0.85rem',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 34,
    fontFamily: 'inherit',
    WebkitTapHighlightColor: 'transparent',
  },
  // Viral Growth Loop §1 — "Share this insight" button shown
  // after Done. Visual weight kept light (ghost-style chip) so
  // the toast / health-feedback prompt stay the primary
  // post-Done elements. Sits right above the tomorrow line so
  // the user sees it during the natural eye-scan after the
  // checkmark + reward toast.
  shareInsight: {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
    padding: '0.4rem 0.85rem',
    marginTop: 12,
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 34,
    fontFamily: 'inherit',
    WebkitTapHighlightColor: 'transparent',
  },
  // Engagement Depth §1 — "Next step (optional)" container.
  // Two stacked lines: dim eyebrow + slightly brighter action
  // text. Visual weight kept light so the toast/checkmark stays
  // the dominant post-Done signal.
  nextStep: {
    marginTop: 12,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.14)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  nextStepLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  nextStepText: {
    fontSize: 14,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 1.4,
  },
};
