/**
 * DailyPlanCard — Home-screen surface for the Daily
 * Intelligence engine. Shows greeting + farm + crop stage +
 * weather summary + max 3 actions + alerts.
 *
 * Strict-rule audit
 *   • Reads the active farm + weather from existing contexts
 *     (no new fetches).
 *   • Hides itself when FEATURE_DAILY_INTELLIGENCE is off so
 *     existing Home composition is unchanged.
 *   • "Mark done" writes through dailyTaskCompletion only —
 *     no engine modifications.
 *   • "Ask Farroway" + "Scan crop" buttons reuse the existing
 *     VoiceLauncher / PhotoLauncher launchers.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { isFeatureEnabled } from '../../utils/featureFlags.js';
import { generateDailyPlan } from '../../core/dailyIntelligenceEngine.js';
import { generateIntelligentPlan } from '../../core/farrowayIntelligenceEngine.js';
// Final Daily Plan Engine Upgrade \u00a72 \u2014 the new spec-shaped
// engine + its growing-context builder. Imported under aliases
// so they don't collide with the legacy `generateDailyPlan`
// from dailyIntelligenceEngine. The new engine is the primary
// driver of the visible card: priority, reason, tasks, risk
// alerts, and tomorrow preview all flow from it. The legacy
// engines stay mounted for back-compat slots (cropStage,
// confidence, harvestReady) the card still renders below.
import { generateDailyPlan as generatePlanV2 } from '../../core/dailyPlanEngine.js';
import { buildGrowingContext } from '../../core/growingContext.js';
import {
  markActionDone,
  getCompletedActionIdsToday,
} from '../../core/dailyTaskCompletion.js';
// Retention Loop spec \u00a72\u2013\u00a77 \u2014 streak counter, daily progress
// math, adaptive home banner copy, and the micro health-feedback
// store. Each module is pure-by-default + SSR-safe; the card
// composes them on top of the v2 daily plan to produce the
// retention surface (streak pill, progress bar, adaptive
// message, completed-state styling, completion toast, health
// prompt, all-done tomorrow preview).
import {
  getStreak, recordTaskCompleted, daysSinceLastCompletion,
} from '../../core/streakEngine.js';
import { computeDailyProgress } from '../../core/dailyProgress.js';
import {
  pickAdaptiveMessage, pickCompletionFeedback,
  pickAllDoneTomorrowPreview,
} from '../../core/retentionMessages.js';
import {
  recordHealthFeedback, getHealthFeedbackForToday,
} from '../../core/healthFeedbackStore.js';
import { logEvent, EVENT_TYPES } from '../../data/eventLogger.js';

const URGENCY_TONE = {
  high:   { background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.32)',  pill: '#FCA5A5' },
  medium: { background: 'rgba(34,197,94,0.10)',  borderColor: 'rgba(34,197,94,0.32)',  pill: '#86EFAC' },
  low:    { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)', pill: '#9FB3C8' },
};

const SEVERITY_TONE = {
  critical: { background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.32)', color: '#FCA5A5' },
  warning:  { background: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.32)', color: '#FDE68A' },
  info:     { background: 'rgba(59,130,246,0.10)', borderColor: 'rgba(59,130,246,0.32)', color: '#93C5FD' },
};

export default function DailyPlanCard({
  farm,
  weather = null,
  weatherStale = false,
  recentTasks = [],
  greetingName,
  onMarkDone,
  style,
}) {
  const { lang } = useTranslation();
  const navigate = useNavigate();
  const [version, setVersion] = React.useState(0);

  if (!isFeatureEnabled('FEATURE_DAILY_INTELLIGENCE')) return null;
  if (!farm) return null;

  // Re-run the engine when version bumps (after a Mark-done).
  const plan = React.useMemo(() => {
    const base = generateDailyPlan({ farm, weather, weatherStale, recentTasks });
    // Invisible-intelligence layer: compose the new engine on
    // top of the existing daily plan so the user sees a
    // priority + secondary + risks + explanation + follow-up
    // structure instead of the legacy generic 3-task list.
    // The new engine returns the spec shape; we adapt it to
    // the existing `actions[]` + `alerts[]` shape DailyPlanCard
    // already renders, plus add explanation + followUpTask
    // slots below.
    let intel = null;
    try {
      intel = generateIntelligentPlan({
        activeExperience: farm.farmType === 'backyard' ? 'garden' : 'farm',
        cropName:         farm.crop || farm.cropId || null,
        plantName:        farm.plantName || null,
        country:          farm.country || farm.countryCode || null,
        region:           farm.region || farm.state || null,
        plantedAt:        farm.plantingDate || farm.plantedAt || null,
        growingSetup:     farm.growingSetup || null,
        sizeSqFt:         farm.landSizeSqFt || farm.farmSize || null,
        displayUnit:      farm.displayUnit || farm.sizeUnit || null,
        weather,
      });
    } catch { /* never let the engine break the page */ }

    if (!intel) return base;

    // Adapt todaysPriority + secondaryTasks into the legacy
    // actions[] shape. Each gets a stable id derived from the
    // text so Mark-done dedupe still works.
    const slug = (s) => String(s || '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
    const intelTasks = [intel.todaysPriority, ...intel.secondaryTasks].filter(Boolean);
    const adaptedActions = intelTasks.map((t, i) => ({
      id:         `intel_${i}_${slug(t.text)}`,
      title:      t.text,
      reason:     t.detail,
      urgency:    t.type === 'risk' ? 'high'
                : t.type === 'scan' ? 'low'
                : 'medium',
      actionType: t.type || 'inspect',
      source:     'intelligence',
    }));

    // Risk signals fold into the alerts[] array so existing
    // alert render paths surface them.
    const adaptedAlerts = [
      ...(Array.isArray(base.alerts) ? base.alerts : []),
      ...intel.riskSignals.map((r, i) => ({
        id:       `intel_risk_${i}`,
        severity: r.severity || 'warning',
        title:    r.text,
        message:  r.detail,
      })),
    ];

    // Final Daily Plan Engine Upgrade \u2014 the spec-shaped v2
    // engine drives the visible plan. We build the normalised
    // growing context from the same farm + weather inputs, run
    // the engine, and let its output overlay the legacy fields
    // the card already renders (summary, explanation, actions,
    // alerts, followUpTask). Wrapped in try/catch so an engine
    // bug can never blank the card \u2014 we fall back to the
    // legacy `intel`-adapted shape above on any failure.
    let v2 = null;
    try {
      const ctx = buildGrowingContext({ farm, weather });
      v2 = generatePlanV2(ctx);
    } catch { /* never let the engine break the page */ }

    if (!v2 || !v2.priority) {
      // Engine output unusable \u2014 keep the legacy adapter shape.
      return {
        ...base,
        actions:        adaptedActions.slice(0, 3),
        alerts:         adaptedAlerts,
        explanation:    intel.explanation,
        followUpTask:   intel.followUpTask,
        confidence:     intel.confidence || base.confidence,
      };
    }

    // V2 engine produced a plan \u2014 adapt its spec shape into
    // the legacy fields the card render path already knows
    // about. Tasks become action tiles; risk alerts get their
    // own pseudo-alert entries (severity 'warning' so they
    // render in amber, matching the existing tone palette);
    // tomorrowPreview becomes the followUpTask body.
    const slugV2 = (s) => String(s || '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
    const v2Actions = (Array.isArray(v2.tasks) ? v2.tasks : []).map((task, i) => ({
      id:         `v2_${i}_${slugV2(task)}`,
      title:      task,
      // Reason hangs the priority's "why" off the FIRST task so
      // the action tile stays informative without crowding the
      // headline. Subsequent tasks render with no detail \u2014 they
      // are short enough to read at a glance.
      reason:     i === 0 ? v2.reason : '',
      urgency:    i === 0 ? 'medium' : 'low',
      actionType: 'inspect',
      source:     'dailyPlanEngine',
    }));
    const v2Alerts = (Array.isArray(v2.riskAlerts) ? v2.riskAlerts : []).map((text, i) => ({
      id:       `v2_risk_${i}`,
      severity: 'warning',
      title:    text,
      message:  '',
    }));

    return {
      ...base,
      // Spec \u00a77 \u2014 priority becomes the visible headline.
      summary:        v2.priority,
      explanation:    v2.reason,
      actions:        v2Actions.slice(0, 3),
      alerts:         [
        ...(Array.isArray(base.alerts) ? base.alerts : []),
        ...v2Alerts,
      ],
      // Tomorrow preview folds into the existing follow-up
      // task slot the render below already shows. Type
      // 'inspect' so the existing icon mapping works.
      followUpTask:   v2.tomorrowPreview
        ? { type: 'inspect', text: v2.tomorrowPreview, detail: '' }
        : (intel ? intel.followUpTask : null),
      confidence:     (intel && intel.confidence) || base.confidence,
    };
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [farm, weather, weatherStale, recentTasks, version],
  );

  // Telemetry: log once per (farmId, date) so we can see the
  // generation rate in the admin "Daily Intelligence Usage" card.
  const loggedKey = React.useRef('');
  React.useEffect(() => {
    if (!plan || !plan.farmId) return;
    const key = `${plan.farmId}:${plan.date}`;
    if (loggedKey.current === key) return;
    loggedKey.current = key;
    try {
      logEvent(EVENT_TYPES.DAILY_PLAN_GENERATED || 'daily_plan_generated', {
        farmId:     plan.farmId,
        cropId:     plan.cropId,
        cropStage:  plan.cropStage,
        confidence: plan.confidence,
        actions:    plan.actions.length,
        alerts:     plan.alerts.length,
      });
    } catch { /* swallow */ }
  }, [plan]);

  // Retention Loop spec \u00a71 \u2014 the completed-action ids for today
  // drive the progress bar + the per-tile completed state. We
  // recompute them on every version bump so a Mark-done tap
  // immediately reflects in the UI without a full reload.
  const completedIds = React.useMemo(() => {
    if (!farm || !farm.id) return [];
    try {
      const ids = getCompletedActionIdsToday(farm.id);
      return Array.isArray(ids) ? ids : [];
    } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farm, version]);

  // Retention Loop spec \u00a72 \u2014 daily progress math (done / total
  // / percent / allDone / pending). Pure compute on the v2
  // plan's actions array.
  const progress = React.useMemo(() => computeDailyProgress({
    actions:      plan.actions,
    completedIds,
  }), [plan, completedIds]);

  // Retention Loop spec \u00a73 \u2014 streak read. Recompute on every
  // version bump so a Mark-done tap that records a completion
  // immediately surfaces the new "X-day streak" pill.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const streak = React.useMemo(() => getStreak(), [version]);

  // Retention Loop spec \u00a75 \u2014 adaptive home banner. Behaviour
  // signal first (consistency / comeback), weather signal as
  // fallback. Returns null when the card should stay calm.
  const adaptiveMessage = React.useMemo(() => {
    try {
      return pickAdaptiveMessage({
        daysSinceLastCompletion: daysSinceLastCompletion(),
        weather,
      });
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather, version]);

  // Retention Loop spec \u00a74 \u2014 completion-feedback toast. Shown
  // for ~3 s after each Mark-done tap. Garden vs farm wording
  // is picked from the experience the v2 engine inferred.
  const [toast, setToast] = React.useState(null);
  const toastTimerRef = React.useRef(null);
  const experienceType = farm.farmType === 'backyard' ? 'garden' : 'farm';

  // Retention Loop spec \u00a76 \u2014 health-feedback prompt. Visible
  // only AFTER the user has marked at least one task done
  // today AND hasn't already answered for this (gardenId/farmId,
  // date) pair.
  const contextId = farm.id || null;
  const [healthSent, setHealthSent] = React.useState(() => {
    try {
      return !!getHealthFeedbackForToday({ contextId });
    } catch { return false; }
  });

  // Cleanup the toast timer on unmount so a fast nav-away
  // doesn't run setState after the component is gone.
  React.useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  function handleMarkDone(action) {
    if (!isFeatureEnabled('FEATURE_AUTO_TASK_GENERATION')) return;
    markActionDone(farm.id, action);
    try {
      logEvent(EVENT_TYPES.DAILY_PLAN_ACTION_DONE || 'daily_plan_action_done',
        { farmId: farm.id, actionId: action.id, actionType: action.actionType });
    } catch { /* swallow */ }
    // Retention Loop spec \u00a73 \u2014 record streak. Idempotent on
    // the day boundary (calling it a second time on the same
    // day is a no-op) so even with multiple tasks marked done
    // back-to-back the count only advances once per day.
    try { recordTaskCompleted(); } catch { /* swallow */ }
    // Retention Loop spec \u00a74 \u2014 surface the toast.
    try {
      setToast(pickCompletionFeedback(experienceType));
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 3200);
    } catch { /* swallow */ }
    if (typeof onMarkDone === 'function') onMarkDone(action);
    setVersion((v) => v + 1);
  }

  function handleHealthFeedback(value) {
    if (!contextId) return;
    try {
      recordHealthFeedback({
        contextId,
        contextType: experienceType,
        healthFeedback: value,
      });
    } catch { /* swallow */ }
    setHealthSent(true);
  }

  function handleRemindLater(action) {
    // Remind-later doesn't add to completion store — the
    // action will simply re-appear next time the engine runs
    // (which is on every Home open). Lightweight telemetry only.
    try {
      logEvent(EVENT_TYPES.DAILY_PLAN_ACTION_SNOOZED || 'daily_plan_action_snoozed',
        { farmId: farm.id, actionId: action.id });
    } catch { /* swallow */ }
  }

  function handleSellPrep() {
    try { navigate('/sell'); } catch { /* ignore */ }
  }

  const greeting = greetingName
    ? `${tSafe('daily.greeting', 'Good day,')} ${greetingName}`
    : tSafe('daily.greetingNoName', 'Good day');

  const farmName = farm.farmName || farm.name || tSafe('daily.farmFallback', 'Your farm');

  return (
    <section
      style={{ ...S.card, ...(style || {}) }}
      data-testid="daily-plan-card"
    >
      {/* ── Header: greeting + farm + stage + weather ── */}
      <div style={S.headerRow}>
        <div>
          <p style={S.greeting}>{greeting}</p>
          <p style={S.farmLine}>
            {farmName}
            {plan.cropStage && (
              <>
                {' '}·{' '}
                <span style={S.stagePill}>
                  {tSafe(`cropStage.${camelStage(plan.cropStage)}`,
                    humanStage(plan.cropStage))}
                </span>
              </>
            )}
          </p>
        </div>
        <span
          style={{
            ...S.confidencePill,
            ...(plan.confidence === 'high'
              ? { borderColor: 'rgba(34,197,94,0.32)', color: '#86EFAC' }
              : plan.confidence === 'medium'
                ? { borderColor: 'rgba(59,130,246,0.32)', color: '#93C5FD' }
                : { borderColor: 'rgba(245,158,11,0.32)', color: '#FCD34D' }),
          }}
          aria-label={tSafe('daily.confidence', 'Confidence')}
        >
          {tSafe(`daily.confidence.${plan.confidence}`,
            plan.confidence.charAt(0).toUpperCase() + plan.confidence.slice(1))}
        </span>
      </div>

      {/* Retention Loop spec \u00a73 \u2014 streak pill. Hidden when the
          user has no completion history yet (count === 0) so a
          first-time user doesn't see "0-day streak" as their
          first impression of the surface. */}
      {streak.count > 0 ? (
        <div style={S.streakRow} data-testid="daily-streak-pill">
          <span style={S.streakPill}>
            {'\uD83D\uDD25 '}
            {tSafe('daily.streak', '{count}-day streak', { count: streak.count })
              .replace('{count}', String(streak.count))}
          </span>
        </div>
      ) : null}

      {/* Retention Loop spec \u00a72 \u2014 daily progress bar. Hidden
          when there are no actions on the plan (no point
          showing 0/0). The "X of Y complete" line sits above
          the bar so the user reads the count first. */}
      {progress.total > 0 ? (
        <div style={S.progressWrap} data-testid="daily-progress">
          <p style={S.progressLine} data-testid="daily-progress-text">
            {tSafe('daily.progress', 'Today\u2019s progress: {done} of {total} complete')
              .replace('{done}',  String(progress.done))
              .replace('{total}', String(progress.total))}
          </p>
          <div style={S.progressTrack} aria-hidden="true">
            <div
              style={{ ...S.progressFill, width: `${progress.percent}%` }}
              data-testid="daily-progress-fill"
            />
          </div>
        </div>
      ) : null}

      {/* Retention Loop spec \u00a75 \u2014 adaptive message. Single
          banner; null collapses to nothing. Behavioural signal
          (consistency / comeback) takes priority over weather. */}
      {adaptiveMessage ? (
        <p style={S.adaptiveMessage} data-testid="daily-adaptive-message">
          {adaptiveMessage}
        </p>
      ) : null}

      {plan.summary && (
        <p style={S.summary} data-testid="daily-plan-summary">
          {plan.summary}
        </p>
      )}

      {/* Invisible-intelligence \u00a78 \u2014 "Why this matters" line.
          One sentence the engine emits to explain the day's
          plan in context (rain, humidity, stage, setup). The
          existing summary still renders above for the legacy
          per-stage opener; this adds the contextual explanation
          underneath. */}
      {plan.explanation ? (
        <p style={S.explanation} data-testid="daily-plan-explanation">
          {plan.explanation}
        </p>
      ) : null}

      {plan.weatherStale && (
        <p style={S.staleNote}>
          {tSafe('daily.weatherStale',
            'Weather data may be outdated — connect to refresh.')}
        </p>
      )}

      {/* ── Alerts (severity-ordered) ── */}
      {plan.alerts && plan.alerts.length > 0 && (
        <div style={S.alertsRow}>
          {plan.alerts.slice(0, 2).map((al) => (
            <div
              key={al.id}
              style={{ ...S.alert, ...(SEVERITY_TONE[al.severity] || SEVERITY_TONE.info) }}
              data-testid={`daily-alert-${al.id}`}
            >
              <strong>{al.title}</strong>
              <span>{al.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Actions (max 3) ── */}
      {plan.actions && plan.actions.length > 0 && (
        <>
          <p style={S.sectionLabel}>
            {tSafe('daily.topActions', 'Today\u2019s top actions')}
          </p>
          <ul style={S.actionList}>
            {plan.actions.map((a) => {
              // Retention Loop spec \u00a71 \u2014 each completed task
              // shows its completed state. We dim the row,
              // strike-through the title, and replace the Mark
              // done / Remind buttons with a calm "Done"
              // indicator so the user knows their tap landed
              // and they can't double-record the completion.
              const isDone = completedIds.includes(a.id);
              return (
              <li
                key={a.id}
                style={{
                  ...S.actionRow,
                  ...(URGENCY_TONE[a.urgency] || URGENCY_TONE.low),
                  ...(isDone ? S.actionRowDone : null),
                }}
                data-testid={`daily-action-${a.id}`}
                data-done={isDone ? 'true' : 'false'}
              >
                <div style={S.actionBody}>
                  <p style={isDone ? { ...S.actionTitle, ...S.actionTitleDone } : S.actionTitle}>
                    {a.title}
                  </p>
                  <p style={S.actionReason}>{a.reason}</p>
                </div>
                <div style={S.actionButtons}>
                  {isDone ? (
                    <span
                      style={S.donePill}
                      data-testid={`daily-action-done-${a.id}`}
                    >
                      {'\u2713 '}
                      {tSafe('daily.actionDone', 'Done')}
                    </span>
                  ) : (
                  <>
                  <button
                    type="button"
                    onClick={() => handleMarkDone(a)}
                    style={{ ...S.btn, ...S.btnPrimary }}
                    data-testid={`daily-mark-done-${a.id}`}
                  >
                    {tSafe('daily.markDone', 'Mark done')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemindLater(a)}
                    style={{ ...S.btn, ...S.btnGhost }}
                    data-testid={`daily-remind-${a.id}`}
                  >
                    {tSafe('daily.remindLater', 'Remind me later')}
                  </button>
                  {a.actionType === 'sell' && (
                    <button
                      type="button"
                      onClick={handleSellPrep}
                      style={{ ...S.btn, ...S.btnPrimary }}
                      data-testid={`daily-sell-${a.id}`}
                    >
                      {tSafe('daily.prepareToSell', 'Prepare to sell')}
                    </button>
                  )}
                  </>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        </>
      )}

      {(!plan.actions || plan.actions.length === 0) && (
        <p style={S.empty}>
          {tSafe('daily.noActions',
            'No actions for today — keep watching the field and check back tomorrow.')}
        </p>
      )}

      {/* Invisible-intelligence \u00a78 \u2014 follow-up task row. A
          single line of "tomorrow" guidance the engine emits
          alongside today's actions. Sits below the action
          stack so the user reads tomorrow's hint last. */}
      {plan.followUpTask && plan.followUpTask.text ? (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.28)',
            color: '#86EFAC',
            fontSize: 13,
            lineHeight: 1.45,
          }}
          data-testid="daily-followup"
        >
          <strong>
            {tSafe('daily.followUp', 'Tomorrow')}:
          </strong>{' '}
          {plan.followUpTask.text}
        </div>
      ) : null}

      {/* Retention Loop spec \u00a77 \u2014 next-day preview that fires
          ONLY when every task today is complete. Calmer than
          the always-visible follow-up row above (which shows
          tomorrow guidance regardless of progress). Falls
          through to the engine's tomorrowPreview when present
          so the wording stays weather-aware ("Watering may not
          be needed tomorrow."). */}
      {progress.allDone ? (
        <div style={S.allDonePreview} data-testid="daily-all-done-preview">
          {pickAllDoneTomorrowPreview(plan.followUpTask && plan.followUpTask.text)}
        </div>
      ) : null}

      {/* Retention Loop spec \u00a76 \u2014 micro health-feedback prompt.
          Visible after the user has marked at least one task
          done today AND hasn't yet answered for this context.
          Three-button row: Yes / Not sure / No. Non-blocking;
          the rest of the card stays interactive. Tapping any
          option saves to localStorage + flips healthSent. */}
      {(!healthSent && progress.done > 0) ? (
        <div style={S.healthPrompt} data-testid="daily-health-prompt">
          <p style={S.healthQuestion}>
            {experienceType === 'farm'
              ? tSafe('daily.healthFeedback.farm', 'Did your crop look healthy?')
              : tSafe('daily.healthFeedback.garden', 'Did your plant look healthy?')}
          </p>
          <div style={S.healthButtons}>
            <button
              type="button"
              onClick={() => handleHealthFeedback('yes')}
              style={{ ...S.healthBtn, ...S.btnPrimary }}
              data-testid="daily-health-yes"
            >
              {tSafe('daily.healthFeedback.yes', 'Yes')}
            </button>
            <button
              type="button"
              onClick={() => handleHealthFeedback('not_sure')}
              style={{ ...S.healthBtn, ...S.btnGhost }}
              data-testid="daily-health-notsure"
            >
              {tSafe('daily.healthFeedback.notSure', 'Not sure')}
            </button>
            <button
              type="button"
              onClick={() => handleHealthFeedback('no')}
              style={{ ...S.healthBtn, ...S.btnGhost }}
              data-testid="daily-health-no"
            >
              {tSafe('daily.healthFeedback.no', 'No')}
            </button>
          </div>
        </div>
      ) : null}

      {/* Retention Loop spec \u00a74 \u2014 completion toast. Appears for
          ~3 s after each Mark-done tap. Garden vs farm wording
          chosen by the v2 engine's experience inference. Sits
          at the bottom of the card so it never displaces the
          existing layout when it fires. */}
      {toast ? (
        <div
          role="status"
          style={S.toast}
          data-testid="daily-completion-toast"
        >
          {toast}
        </div>
      ) : null}

      {/* Footer intentionally omitted \u2014 the floating Ask Farroway
          and Scan Crop FABs on Home already cover those entry
          points, so rendering them again inside this card was
          duplicate UI (spec \u00a716). When this card mounts on a
          surface that doesn't carry those FABs (e.g. an embedded
          variant on My Farm), wire them in there explicitly. */}
    </section>
  );
}

function camelStage(stage) {
  if (!stage) return '';
  return String(stage).replace(/_(\w)/g, (_, c) => c.toUpperCase());
}
function humanStage(stage) {
  if (!stage) return '';
  return String(stage).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

const S = {
  card: {
    margin: '0.75rem 0',
    padding: '1rem',
    borderRadius: 16,
    background: 'linear-gradient(180deg, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.04) 100%)',
    border: '1px solid rgba(34,197,94,0.22)',
    color: '#EAF2FF',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  headerRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem',
  },
  greeting: { margin: 0, fontSize: '0.8125rem', color: '#9FB3C8', fontWeight: 600 },
  farmLine: { margin: '0.125rem 0 0', fontSize: '1.0625rem', fontWeight: 700 },
  stagePill: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: 999,
    border: '1px solid rgba(34,197,94,0.32)',
    background: 'rgba(34,197,94,0.10)',
    color: '#86EFAC',
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  confidencePill: {
    padding: '0.25rem 0.625rem',
    borderRadius: 999,
    border: '1px solid',
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    flexShrink: 0,
  },
  summary: {
    margin: 0,
    fontSize: '0.9375rem',
    lineHeight: 1.45,
    color: '#F1F5F9',
  },
  // Invisible-intelligence \u00a78 \u2014 "Why this matters" line under
  // the summary. Smaller, medium-opacity grey so the eye reads
  // it as supporting context, not a competing headline.
  explanation: {
    margin: '-2px 0 0',
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    color: '#9FB3C8',
    fontStyle: 'italic',
  },
  staleNote: {
    margin: 0,
    padding: '0.4rem 0.625rem',
    borderRadius: 8,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FDE68A',
    fontSize: '0.75rem',
  },
  alertsRow: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  alert: {
    padding: '0.5rem 0.75rem',
    borderRadius: 10,
    border: '1px solid',
    fontSize: '0.8125rem',
    lineHeight: 1.4,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  sectionLabel: {
    margin: 0,
    fontSize: '0.6875rem', color: '#9FB3C8',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  actionList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  actionRow: {
    padding: '0.625rem 0.75rem',
    borderRadius: 12,
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  actionBody: { display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  actionTitle: { margin: 0, fontSize: '0.9375rem', fontWeight: 700 },
  actionReason: { margin: 0, fontSize: '0.8125rem', color: '#9FB3C8', lineHeight: 1.4 },
  actionButtons: { display: 'flex', gap: '0.375rem', flexWrap: 'wrap' },
  btn: {
    padding: '0.4rem 0.75rem',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.16)',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 32,
  },
  btnPrimary: { background: '#22C55E', color: '#062714', borderColor: '#22C55E' },
  btnGhost: { background: 'transparent', color: '#EAF2FF' },
  empty: { margin: 0, color: '#9FB3C8', fontSize: '0.875rem' },

  // Retention Loop spec \u00a73 \u2014 streak pill. Sits in its own row
  // above the progress bar so the count reads first. Calm
  // amber tone keeps the fire emoji from feeling alarmist.
  streakRow: { display: 'flex', justifyContent: 'flex-start' },
  streakPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.625rem',
    borderRadius: 999,
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FCD34D',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },

  // Retention Loop spec \u00a72 \u2014 progress text + bar. Track is
  // a faint white pill; the green fill animates via inline
  // width so a Mark-done tap visibly advances it.
  progressWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  progressLine: {
    margin: 0,
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    fontWeight: 600,
  },
  progressTrack: {
    height: 6,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #22C55E 0%, #4ADE80 100%)',
    borderRadius: 999,
    transition: 'width 0.4s ease-out',
  },

  // Retention Loop spec \u00a75 \u2014 adaptive message. Single calm
  // line; tone matches the existing weather-stale row but
  // colour stays neutral so it never reads as an alert.
  adaptiveMessage: {
    margin: 0,
    padding: '0.5rem 0.75rem',
    borderRadius: 10,
    background: 'rgba(59,130,246,0.10)',
    border: '1px solid rgba(59,130,246,0.28)',
    color: '#BFDBFE',
    fontSize: '0.8125rem',
    lineHeight: 1.45,
  },

  // Retention Loop spec \u00a71 \u2014 completed-state row + title.
  // Dimmed background + struck-through title signal "done"
  // without removing the line entirely (the user can still
  // see what they did today).
  actionRowDone: {
    opacity: 0.55,
    background: 'rgba(34,197,94,0.06)',
    borderColor: 'rgba(34,197,94,0.20)',
  },
  actionTitleDone: {
    textDecoration: 'line-through',
    color: '#9FB3C8',
  },
  donePill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.625rem',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.18)',
    border: '1px solid rgba(34,197,94,0.32)',
    color: '#86EFAC',
    fontSize: '0.75rem',
    fontWeight: 700,
  },

  // Retention Loop spec \u00a74 \u2014 completion toast. Anchored at
  // the bottom of the card; auto-dismisses via the timer in
  // handleMarkDone.
  toast: {
    margin: '0.5rem 0 0',
    padding: '0.625rem 0.875rem',
    borderRadius: 12,
    background: 'rgba(34,197,94,0.18)',
    border: '1px solid rgba(34,197,94,0.32)',
    color: '#86EFAC',
    fontSize: '0.875rem',
    fontWeight: 600,
    textAlign: 'center',
  },

  // Retention Loop spec \u00a76 \u2014 health-feedback prompt + 3
  // buttons. Calmer background so the prompt never visually
  // shouts at the user; the three buttons sit on one row.
  healthPrompt: {
    marginTop: 8,
    padding: '0.625rem 0.75rem',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  healthQuestion: {
    margin: 0,
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#EAF2FF',
  },
  healthButtons: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  healthBtn: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    padding: '0.4rem 0.75rem',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.16)',
    fontSize: '0.75rem',
    fontWeight: 700,
    minHeight: 32,
    flex: '0 0 auto',
  },

  // Retention Loop spec \u00a77 \u2014 all-done tomorrow preview. Only
  // shown when every task is complete. Slightly warmer green
  // tone than the always-visible follow-up so the user reads
  // "you're done; here's tomorrow" as a reward, not a chore.
  allDonePreview: {
    marginTop: 8,
    padding: '0.625rem 0.875rem',
    borderRadius: 12,
    background: 'rgba(34,197,94,0.16)',
    border: '1px solid rgba(34,197,94,0.36)',
    color: '#BBF7D0',
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.45,
  },
};
