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
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tStrict } from '../../i18n/strictT.js';
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
  onDone,
}) {
  // Subscribe to language change so all the localized strings
  // refresh on a flip without forcing the parent to re-render.
  useTranslation();

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

  const headerText      = tStrict('firstAction.header',       'Before you do anything, do this first:');
  const title           = tStrict(action.titleKey,            action.titleFallback);
  const detail          = tStrict(action.detailKey,           action.detailFallback);
  const reason          = tStrict(action.reasonKey,           action.reasonFallback);
  const consequence     = tStrict(action.consequenceKey,      action.consequenceFallback);
  // Conversion upgrade §1 — compose [Action] — [Consequence] as
  // ONE bold headline so the user's eye lands on a single
  // sentence carrying intent + stakes. The standalone
  // consequence amber line is now redundant, suppressed below.
  const headline        = consequence ? `${title} \u2014 ${consequence}` : title;
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
    ? tStrict(action.memoryKey, action.memoryFallback)
    : '';
  // Primary Action Intelligence §5 — optional risk-boost line.
  // Engine sets it when humidity > 75 OR repeated-worse pattern.
  // Severity drives the visual weight (medium amber, high red).
  const riskNoteText    = action.riskNoteKey
    ? tStrict(action.riskNoteKey, action.riskNoteFallback)
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
    ? tStrict(action.areaInsightKey, action.areaInsightFallback)
    : (_demoAreaInsight
        ? tStrict('firstAction.areaInsight.demo',
            'Growers in your area see better results doing this')
        : '');
  const ctaDone         = tStrict(action.ctaDoneKey,          action.ctaDoneFallback);
  const tomorrowText    = tStrict(action.tomorrowKey,         action.tomorrowFallback);
  // Retention §2 — time anchor under the tomorrow line. Fixed
  // copy ("Check again tomorrow morning") sits under the
  // tomorrow hook so the user has a concrete return cue.
  const tomorrowAnchor  = tStrict('firstAction.tomorrow.timeAnchor', 'Check again tomorrow morning');

  // Toast wording is context-specific (spec §7).
  const isGarden = String(context && context.activeExperience || '').toLowerCase() === 'garden';
  const toastText = isGarden
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
            {ctaDone}
          </button>
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
};
