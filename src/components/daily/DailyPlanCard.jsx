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
// Final Home + Review Copy Polish \u00a75 \u2014 daily-freshness toast
// tracker. Reads/writes farroway_last_home_open_date so the
// "Your plan is updated for today" toast fires once per day.
import {
  isFirstHomeOpenToday, markHomeOpenedToday,
} from '../../core/dailyFreshness.js';
// Final Home Dashboard Polish \u00a72 \u2014 reuse the spec-shaped
// formatters so the active-context strip displays a clean
// "Maryland, USA" + "2 acres" / "Small farm" readout instead
// of the raw values stored on the farm row.
import {
  formatLocation,
  formatFarmSize,
  normalizeFarmSizeBucket,
} from '../../utils/formatDisplay.js';
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

// Final Home + Review Copy Polish \u00a76\u2013\u00a77 \u2014 risk-tag tone.
// Calm by default (low). Medium reads amber; high reads red.
// Kept small per spec ("not scary").
const RISK_TONE = {
  low:    { background: 'rgba(34,197,94,0.10)',  borderColor: 'rgba(34,197,94,0.30)' },
  medium: { background: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.32)' },
  high:   { background: 'rgba(239,68,68,0.10)',  borderColor: 'rgba(239,68,68,0.32)' },
};

// Final Home Dashboard Polish \u00a72 + \u00a79 \u2014 helpers for the
// active-context strip. Each takes the farm row and returns a
// short display string OR null. Garden helpers never touch
// farm-only fields and vice versa, so the spec's context-
// isolation rule is enforced by construction (the readers
// pull from the right key set; the wrong key set returns
// null and that branch is skipped at render time).

function formatLocationCompact(farm) {
  if (!farm) return null;
  const loc = formatLocation({
    region:  farm.region || farm.state || '',
    country: farm.country || farm.countryCode || '',
  });
  // formatLocation returns 'Not set' for missing data; in the
  // context strip we'd rather hide the label entirely than
  // show "Not set" next to the plant name.
  return (loc && loc !== 'Not set') ? loc : null;
}

const GARDEN_SETUP_LABEL = Object.freeze({
  container:      'Pots / containers',
  raised_bed:     'Raised bed',
  ground:         'Backyard soil',
  indoor_balcony: 'Indoor / balcony',
});

function _gardenSetupLabel(setup) {
  if (!setup || setup === 'unknown') return null;
  // Legacy aliases the engine already migrates.
  const aliased = setup === 'bed' ? 'raised_bed'
                : setup === 'indoor' ? 'indoor_balcony'
                : setup;
  return GARDEN_SETUP_LABEL[aliased] || null;
}

function _farmSizeLabel(farm) {
  if (!farm) return null;
  // Read the spec triple from the persisted row first; legacy
  // farms (pre Final Farm Size + Review Normalization) store
  // farmSize/sizeUnit, so we fall through.
  const exact = (farm.exactSize != null) ? farm.exactSize : farm.farmSize;
  const unit  = farm.unit || farm.sizeUnit || null;
  const cat   = farm.sizeCategory
             || normalizeFarmSizeBucket(farm.sizeBucket || farm.farmSizeBucket || null);
  const out = formatFarmSize({ exactSize: exact, unit, sizeCategory: cat });
  return (out && out !== 'Not specified') ? out : null;
}

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
      // Final Home + Review Copy Polish \u00a76 \u2014 thread the
      // retention behavioural signals into the engine so the
      // risk computation can promote MEDIUM (missed yesterday)
      // / HIGH (repeated misses, or humidity + recent scan
      // issue). Read straight off the persisted streak +
      // (best-effort) recent-scan flag so the engine stays
      // pure (no React hooks inside it). Wrapped in try/catch
      // so a missing module never silences the v2 engine.
      try {
        const days = (typeof daysSinceLastCompletion === 'function')
          ? daysSinceLastCompletion()
          : null;
        const recentScan = (() => {
          try {
            if (typeof localStorage === 'undefined') return false;
            const raw = localStorage.getItem('farroway_last_scan_issue');
            if (!raw) return false;
            // Recent = within 3 days. Either an ISO timestamp
            // OR a truthy flag is accepted.
            const t = Date.parse(raw);
            if (Number.isFinite(t)) {
              return (Date.now() - t) < (3 * 24 * 60 * 60 * 1000);
            }
            return raw === 'true';
          } catch { return false; }
        })();
        ctx.retention = {
          missedYesterday:    days != null && days >= 1,
          repeatedMissedDays: days != null && days >= 2,
          hasRecentScanIssue: !!recentScan,
        };
      } catch { /* keep engine input unchanged */ }
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
      // Final Home + Review Copy Polish \u00a76 \u2014 surface the
      // engine's risk decision so the card render path can
      // show the small "Risk: Medium" tag below the priority.
      riskLevel:      v2.riskLevel  || 'low',
      riskReason:     v2.riskReason || '',
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

  // Final Home + Review Copy Polish \u00a75 \u2014 daily-freshness
  // toast. Reads `farroway_last_home_open_date`; if today
  // hasn't been recorded yet, fire the "Your plan is updated
  // for today" toast once. The flag is written AFTER the
  // toast renders so a transient mount that never paints
  // doesn't burn the user's once-per-day window.
  const [freshToast, setFreshToast] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    try {
      if (isFirstHomeOpenToday()) {
        setFreshToast(tSafe(
          'daily.freshness.toast',
          'Your plan is updated for today \uD83C\uDF31',
        ));
        markHomeOpenedToday();
        // Auto-dismiss after ~3.6s so it lingers a touch
        // longer than the per-task completion toast (the
        // freshness message is set-and-forget; the user
        // doesn't need to react to it).
        const id = setTimeout(() => { if (!cancelled) setFreshToast(null); }, 3600);
        return () => { cancelled = true; clearTimeout(id); };
      }
    } catch { /* swallow */ }
    return () => { cancelled = true; };
    // Only run on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Stored as a tSafe-resolved string so a re-render in a
  // different locale doesn't show a stale English toast.
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
    // Retention Loop spec \u00a74 \u2014 surface the toast. Engine
    // returns { key, fallback }; we resolve through tSafe so
    // non-EN locales see the translated wording instead of
    // the English fallback.
    try {
      const fb = pickCompletionFeedback(experienceType);
      setToast(tSafe(fb.key, fb.fallback));
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

  // Final Home Dashboard Polish \u00a72 \u2014 garden vs farm aware
  // greeting copy. Key picked by experienceType (computed
  // earlier from farm.farmType). Falls back to the no-name
  // variant when greetingName is empty so a logged-in farmer
  // who hasn't set their display name still sees a proper
  // line, just without the personalisation.
  const greetingKey = greetingName
    ? (experienceType === 'farm'
      ? 'daily.greeting.farmWithName'
      : 'daily.greeting.gardenWithName')
    : (experienceType === 'farm'
      ? 'daily.greeting.farm'
      : 'daily.greeting.garden');
  const greetingFallback = greetingName
    ? (experienceType === 'farm'
      ? `Good morning, ${greetingName} \u2014 here\u2019s your crop plan.`
      : `Good morning, ${greetingName} \u2014 here\u2019s your plant plan.`)
    : (experienceType === 'farm'
      ? 'Good morning \u2014 here\u2019s your crop plan.'
      : 'Good morning \u2014 here\u2019s your plant plan.');
  // tSafe with a placeholder substitution: legacy tSafe calls
  // {name} interpolation when the third argument is an object.
  const greeting = greetingName
    ? tSafe(greetingKey, greetingFallback, { name: greetingName }).replace('{name}', greetingName)
    : tSafe(greetingKey, greetingFallback);

  const farmName = farm.farmName || farm.name || tSafe('daily.farmFallback', 'Your farm');

  // Final Home Dashboard Polish \u00a72 \u2014 active context strip.
  // Compact line under the greeting showing what the user is
  // growing + where + (garden) growing setup or (farm) size.
  // Spec \u00a79 (context isolation) \u2014 garden never reads
  // farm-only fields; farm never reads garden-only fields.
  const isGardenCard = experienceType === 'garden';
  const contextCropLabel = farm.cropLabel || farm.plantName || farm.crop
                        || farm.cropId || null;
  const contextLocation = formatLocationCompact(farm);
  // Garden surfaces growingSetup (container/raised_bed/etc).
  // Farm surfaces sizeCategory + exactSize via formatFarmSize.
  const contextSetup = isGardenCard
    ? _gardenSetupLabel(farm.growingSetup)
    : null;
  const contextSize  = !isGardenCard
    ? _farmSizeLabel(farm)
    : null;

  return (
    <section
      style={{ ...S.card, ...(style || {}) }}
      data-testid="daily-plan-card"
    >
      {/* ── Header: greeting + active context + stage + weather ──
          Final Home Dashboard Polish \u00a71\u2013\u00a72 \u2014 the greeting
          opens with the experience-aware line ("here's your
          plant plan." / "...crop plan.") and the farm-name
          row carries an active-context strip (plant/crop +
          location + setup or size). Spec \u00a79 isolation: garden
          surfaces growingSetup, farm surfaces sizeCategory. */}
      <div style={S.headerRow}>
        <div>
          <p style={S.greeting} data-testid="home-greeting">{greeting}</p>
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
          {/* Active context strip \u2014 only renders when at least
              one field has a value (so a brand-new farm with
              just a name doesn't surface a row of em-dashes). */}
          {(contextCropLabel || contextLocation || contextSetup || contextSize) ? (
            <p
              style={S.contextLine}
              data-testid="home-context-strip"
              data-experience={isGardenCard ? 'garden' : 'farm'}
            >
              {contextCropLabel ? (
                <span style={S.contextChip}>{contextCropLabel}</span>
              ) : null}
              {contextLocation ? (
                <span style={S.contextChip}>
                  {'\uD83D\uDCCD '}
                  {contextLocation}
                </span>
              ) : null}
              {contextSetup ? (
                <span style={S.contextChip} data-testid="home-context-setup">
                  {contextSetup}
                </span>
              ) : null}
              {contextSize ? (
                <span style={S.contextChip} data-testid="home-context-size">
                  {contextSize}
                </span>
              ) : null}
            </p>
          ) : null}
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
          (consistency / comeback) takes priority over weather.
          Engine returns { key, fallback }; the card resolves
          through tSafe so non-EN locales see translated copy. */}
      {adaptiveMessage ? (
        <p style={S.adaptiveMessage} data-testid="daily-adaptive-message">
          {tSafe(adaptiveMessage.key, adaptiveMessage.fallback)}
        </p>
      ) : null}

      {/* Final Home + Review Copy Polish \u00a72 \u2014 visual hierarchy.
          Today's Priority is the LARGEST element on the card.
          The headline reads BIG (~1.25rem, bold), then the
          "Why this matters" explanation reads MEDIUM
          underneath, then "Other tasks" render as SMALL tiles
          below the alerts. The risk tag sits between priority
          and explanation so the user reads
          "what to do" -> "how serious it is" -> "why" at a glance. */}
      {plan.summary && (
        <p style={S.summaryBig} data-testid="daily-plan-summary">
          {plan.summary}
        </p>
      )}

      {/* Final Home + Review Copy Polish \u00a76\u2013\u00a77 \u2014 risk tag.
          Calm, small ("Risk: Medium" + one-line reason). Always
          renders so a Low-risk day still shows the green dot
          (the user knows the engine ran). */}
      {plan.riskLevel ? (
        <div
          style={{ ...S.riskRow, ...RISK_TONE[plan.riskLevel] }}
          data-testid="daily-risk-tag"
          data-risk={plan.riskLevel}
        >
          <span style={S.riskDot} aria-hidden="true">
            {plan.riskLevel === 'high'   ? '\uD83D\uDD34'
             : plan.riskLevel === 'medium' ? '\uD83D\uDFE1'
             : '\uD83D\uDFE2'}
          </span>
          <span style={S.riskLabel}>
            {tSafe('daily.risk.label', 'Risk')}
            {': '}
            {tSafe(`daily.risk.${plan.riskLevel}`,
              plan.riskLevel.charAt(0).toUpperCase() + plan.riskLevel.slice(1))}
          </span>
          {plan.riskReason ? (
            <span style={S.riskReason}>{plan.riskReason}</span>
          ) : null}
        </div>
      ) : null}

      {/* "Why this matters" \u2014 MEDIUM under the BIG priority. */}
      {plan.explanation ? (
        <p style={S.explanationMedium} data-testid="daily-plan-explanation">
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
            {plan.actions.map((a, idx) => {
              // Retention Loop spec \u00a71 \u2014 each completed task
              // shows its completed state.
              const isDone = completedIds.includes(a.id);
              // Final Home + Review Copy Polish \u00a72 \u2014 visual
              // hierarchy. Action #0 is the priority echo (it
              // carries the same headline as plan.summary above);
              // we keep it visually MEDIUM so it sits between
              // the BIG summary and the SMALL tail. Actions #1
              // and #2 are the SECONDARY tasks \u2014 they render
              // smaller so the eye lands on the priority first.
              const isPrimary = idx === 0;
              return (
              <li
                key={a.id}
                style={{
                  ...S.actionRow,
                  ...(isPrimary ? null : S.actionRowSmall),
                  ...(URGENCY_TONE[a.urgency] || URGENCY_TONE.low),
                  ...(isDone ? S.actionRowDone : null),
                }}
                data-testid={`daily-action-${a.id}`}
                data-done={isDone ? 'true' : 'false'}
                data-primary={isPrimary ? 'true' : 'false'}
              >
                <div style={S.actionBody}>
                  <p style={{
                    ...(isPrimary ? S.actionTitle : S.actionTitleSmall),
                    ...(isDone ? S.actionTitleDone : null),
                  }}>
                    {a.title}
                  </p>
                  {isPrimary && a.reason ? (
                    <p style={S.actionReason}>{a.reason}</p>
                  ) : null}
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

      {/* Final Home Dashboard Polish \u00a76 \u2014 dedicated Scan CTA
          card. Sits BELOW the action tiles + ABOVE the
          progress / streak block so the user reads
          "today's tasks" \u2192 "scan if you see damage" \u2192
          "your progress". Tapping anywhere on the card or the
          button navigates to /scan. The headline reads as a
          direct question; the subtext explains the value. */}
      <button
        type="button"
        onClick={() => { try { navigate('/scan'); } catch { /* ignore */ } }}
        style={S.scanCtaCard}
        data-testid="home-scan-cta"
      >
        <div style={S.scanCtaText}>
          <p style={S.scanCtaHeadline}>
            {tSafe(
              isGardenCard ? 'daily.scanCta.headline.garden' : 'daily.scanCta.headline.farm',
              'See damage or spots?',
            )}
          </p>
          <p style={S.scanCtaSubtext}>
            {tSafe('daily.scanCta.subtext',
              'Take a photo and get clear next steps.')}
          </p>
        </div>
        <span style={S.scanCtaButton} aria-hidden="true">
          {tSafe('daily.scanCta.button', 'Scan now')}
          {' \u2192'}
        </span>
      </button>

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
          tomorrow guidance regardless of progress). Engine
          returns either a verbatim text (when the v2 plan
          produced a weather-aware tomorrow preview \u2014 we don't
          re-key it because the engine already personalised it)
          OR a { key, fallback } pair for the default copy
          which tSafe resolves to the active locale. */}
      {progress.allDone ? (() => {
        const tp = pickAllDoneTomorrowPreview(plan.followUpTask && plan.followUpTask.text);
        const text = tp && tp.text
          ? tp.text
          : (tp && tp.key ? tSafe(tp.key, tp.fallback) : '');
        if (!text) return null;
        return (
          <div style={S.allDonePreview} data-testid="daily-all-done-preview">
            {text}
          </div>
        );
      })() : null}

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

      {/* Final Home + Review Copy Polish \u00a75 \u2014 daily-freshness
          toast. Fires once per day on first Home open. Reuses
          the same calm green tone as the completion toast so
          the visual language stays consistent. */}
      {freshToast ? (
        <div
          role="status"
          style={S.toast}
          data-testid="daily-freshness-toast"
        >
          {freshToast}
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
  // Final Home + Review Copy Polish \u00a72 \u2014 BIG priority headline.
  // Visually dominates the card so the user reads "what to do
  // today" before anything else. Bumped to 1.25rem + heavier
  // weight; tighter line-height so a 2-line headline doesn't
  // double the card height.
  summaryBig: {
    margin: 0,
    fontSize: '1.25rem',
    lineHeight: 1.3,
    fontWeight: 800,
    color: '#F1F5F9',
    letterSpacing: '-0.01em',
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
  // Final Home + Review Copy Polish \u00a72 \u2014 MEDIUM "Why this
  // matters" treatment. Slightly larger than the legacy italic
  // explanation so the hierarchy reads BIG -> MEDIUM -> SMALL.
  // Drop the italic so the line reads as a plain explanation,
  // not a styled aside.
  explanationMedium: {
    margin: 0,
    fontSize: '0.875rem',
    lineHeight: 1.5,
    color: '#CBD5E1',
  },
  // Final Home + Review Copy Polish \u00a76\u2013\u00a77 \u2014 risk tag row.
  // Pill-shaped with the level dot, label and reason on a
  // single line. Wraps gracefully on small screens; reason
  // drops to a second line if needed without breaking layout.
  riskRow: {
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: '0.75rem',
    lineHeight: 1.4,
    color: '#EAF2FF',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  riskDot: { fontSize: '0.75rem' },
  riskLabel: {
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  riskReason: {
    color: '#CBD5E1',
    fontWeight: 500,
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
  // Final Home + Review Copy Polish \u00a72 \u2014 SMALL secondary
  // task title. Used on actions #1 and #2 so the eye stays on
  // the priority above. Same weight, smaller font + slightly
  // muted colour.
  actionTitleSmall: {
    margin: 0,
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#CBD5E1',
  },
  actionReason: { margin: 0, fontSize: '0.8125rem', color: '#9FB3C8', lineHeight: 1.4 },
  // Final Home + Review Copy Polish \u00a72 \u2014 SMALL secondary
  // task row. Tighter padding so two stacked tiles fit in the
  // space the legacy three full-size tiles used to occupy.
  actionRowSmall: {
    padding: '0.4rem 0.625rem',
    borderRadius: 10,
  },
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

  // Final Home Dashboard Polish \u00a72 \u2014 active-context strip.
  contextLine: {
    margin: '0.25rem 0 0',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
    fontSize: '0.75rem',
    color: '#9FB3C8',
  },
  contextChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#CBD5E1',
    fontWeight: 600,
    letterSpacing: '0.01em',
  },

  // Final Home Dashboard Polish \u00a76 \u2014 dedicated Scan CTA card.
  // Reset native button styles so the whole card reads as a
  // tappable surface, not a button-in-a-row.
  scanCtaCard: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '0.75rem 0.875rem',
    borderRadius: 12,
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.32)',
    color: '#EAF2FF',
    textAlign: 'left',
    width: '100%',
  },
  scanCtaText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  scanCtaHeadline: {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#F1F5F9',
  },
  scanCtaSubtext: {
    margin: 0,
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    lineHeight: 1.4,
  },
  scanCtaButton: {
    flex: '0 0 auto',
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#86EFAC',
    letterSpacing: '0.01em',
  },
};
