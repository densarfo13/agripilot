/**
 * Decision Engine — the core brain of farmer guidance.
 *
 * Pure function: takes farm state in, returns decision out.
 * No React, no side effects, no API calls.
 * Deterministic and easy to test.
 *
 * Priority order (highest first):
 *   1. Onboarding incomplete (no profile at all)
 *   2. Profile incomplete (missing required fields)
 *   3. Crop stage missing (never set)
 *   4. Severe pest issue (high-priority pest task from server)
 *   5. Crop stage outdated (>14 days)
 *   6. Unread alert (high-priority non-pest task)
 *   7. Normal daily task
 *   8. Stale farm activity (>30 days no updates)
 *   9. All done
 */
import { STAGE_EMOJIS, STAGE_KEYS } from '../utils/cropStages.js';
import { getTaskIcon, getTaskIconBg } from '../lib/taskPresentation.js';
import {
  isProfileComplete, isStageSet, isStageOutdated, isFarmStale, needsCheckIn,
  getStage, stageDaysAgo, isPestTask, isAlertTask, farmProgress, daysSinceUpdate,
} from './decisionHelpers.js';
import { getWeatherGuidance, getWeatherTaskAdjustment } from './weatherEngine.js';
import { getLocalizedTaskTitle, shortenDescription } from '../utils/taskTranslations.js';
import { getCurrentLang } from '../utils/i18n.js';

/**
 * Resolve the primary action for the farmer.
 *
 * @param {import('./decisionTypes.js').DecisionInput} input
 * @param {Function} t - i18n translation function
 * @returns {import('./decisionTypes.js').DecisionResult}
 */
export function resolveDecision(input, t) {
  const { profile, setupComplete, primaryTask, taskCount, completedCount, weather } = input;

  // Weather intelligence — runs alongside task resolution
  const crop = profile?.cropType || profile?.crop || '';
  const stage = getStage(profile);
  const weatherGuidance = getWeatherGuidance({ weather, crop, stage });

  const primary = resolvePrimaryAction(input, t, weatherGuidance);
  const plan = buildTodayPlan(primary, profile, taskCount, t);
  const status = buildFarmStatus(input, t);
  const secondary = buildSecondaryActions(input, primary, t);

  return { primaryAction: primary, todaysPlan: plan, farmStatus: status, secondaryActions: secondary, weatherGuidance };
}

// ─── Contextual crop name helper ─────────────────────────────
function cropName(profile) {
  const raw = profile?.cropType || profile?.crop || '';
  if (!raw) return '';
  // Strip "OTHER:" prefix, capitalize
  const name = raw.startsWith('OTHER:') ? raw.slice(6).trim() : raw;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

// ─── Primary Action Resolution ───────────────────────────────
function resolvePrimaryAction(input, t, weatherGuidance) {
  const { profile, setupComplete, primaryTask } = input;
  const crop = cropName(profile);
  const lang = getCurrentLang();
  // Localize task title + shorten description for farmer display
  const taskTitle = primaryTask ? getLocalizedTaskTitle(primaryTask.id, primaryTask.title, lang) : '';
  const taskDesc = primaryTask ? shortenDescription(primaryTask.description || primaryTask.reason || '', 60) : '';

  // 1. No profile at all
  if (!profile) {
    return makeAction('onboarding_incomplete', '🌾', 'rgba(250,204,21,0.15)',
      t('guided.setupTitle'), t('guided.setupReason'), t('guided.setupCta'),
      t('guided.setupNext'), 'critical', false);
  }

  // 2. Profile incomplete
  if (!setupComplete) {
    return makeAction('profile_incomplete', '⚠️', 'rgba(250,204,21,0.15)',
      t('guided.setupTitle'), t('guided.setupReason'), t('guided.setupCta'),
      t('guided.setupNext'), 'high', false);
  }

  // 3. Crop stage never set
  const stage = getStage(profile);
  if (!isStageSet(profile)) {
    const reason = crop
      ? t('guided.stageReasonCrop', { crop }) || t('guided.stageReason')
      : t('guided.stageReason');
    return {
      ...makeAction('stage_missing', '🌱', 'rgba(34,197,94,0.15)',
        t('guided.stageTitle'), reason, t('guided.stageCta'),
        t('guided.stageNext'), 'high', false),
      stageInfo: makeStageInfo(stage, null, t),
    };
  }

  // 4. Severe pest issue (check BEFORE stage outdated — pest is more urgent)
  if (primaryTask && isPestTask(primaryTask) && isAlertTask(primaryTask)) {
    return {
      ...makeAction('severe_pest', getTaskIcon(primaryTask), 'rgba(239,68,68,0.15)',
        taskTitle,
        taskDesc || t('guided.pestReason'),
        t('guided.alertCta'), t('guided.taskNext'), 'critical', true),
      task: primaryTask,
    };
  }

  // 5. Crop stage outdated
  const daysAgo = stageDaysAgo(profile);
  if (isStageOutdated(profile)) {
    const reason = crop
      ? t('guided.stageOutdatedReasonCrop', { days: daysAgo, crop }) || t('guided.stageOutdatedReason', { days: daysAgo })
      : t('guided.stageOutdatedReason', { days: daysAgo });
    return {
      ...makeAction('stage_outdated', STAGE_EMOJIS[stage] || '🌱', 'rgba(250,204,21,0.12)',
        t('guided.stageOutdatedTitle'), reason,
        t('guided.stageOutdatedCta'), t('guided.stageNext'), 'medium', false),
      stageInfo: makeStageInfo(stage, daysAgo, t),
    };
  }

  // 6. Unread alert (high-priority non-pest task)
  if (primaryTask && isAlertTask(primaryTask) && !isPestTask(primaryTask)) {
    return {
      ...makeAction('unread_alert', getTaskIcon(primaryTask), 'rgba(239,68,68,0.15)',
        taskTitle,
        taskDesc || t('guided.alertReason'),
        t('guided.alertCta'), t('guided.taskNext'), 'high', true),
      task: primaryTask,
    };
  }

  // 7. Normal daily task — weather conflict resolution
  if (primaryTask) {
    const pest = isPestTask(primaryTask);
    const wxAdj = getWeatherTaskAdjustment(weatherGuidance, primaryTask);
    const titleLower = (primaryTask.title || '').toLowerCase();
    const actionType = primaryTask.actionType || '';

    // ─── Weather conflict: rain + drying/watering/spraying task ───
    const isRainConflict = weatherGuidance && weatherGuidance.status !== 'safe'
      && (weatherGuidance.adjustments?.watering < -3 || weatherGuidance.adjustments?.spraying < -5);
    const isWaterTask = actionType === 'watering' || titleLower.includes('water') || titleLower.includes('irrigat');
    const isDryTask = titleLower.includes('dry') || titleLower.includes('sun') || titleLower.includes('spread');
    const isSprayTask = actionType === 'spraying' || titleLower.includes('spray') || titleLower.includes('pesticide');

    if (isRainConflict && (isWaterTask || isDryTask || isSprayTask)) {
      // Replace with weather-safe alternative
      const altTitle = isWaterTask ? t('wxConflict.skipWatering') : isSprayTask ? t('wxConflict.skipSpraying') : t('wxConflict.skipDrying');
      const altReason = t(weatherGuidance.recommendationKey, weatherGuidance.params);
      return {
        ...makeAction('daily_task', weatherGuidance.icon, 'rgba(14,165,233,0.12)',
          altTitle, altReason,
          t('guided.taskCta'), t('guided.taskNext'), 'medium', false),
        task: primaryTask,
      };
    }

    // ─── Normal task with optional weather note ───
    let reason = taskDesc;
    if (!reason) {
      reason = pest
        ? t('guided.pestReason')
        : (crop ? t('guided.taskReasonCrop', { crop }) || t('guided.taskReason') : t('guided.taskReason'));
    }
    if (wxAdj < -3 && weatherGuidance && weatherGuidance.status !== 'safe') {
      const wxNote = t(weatherGuidance.recommendationKey, weatherGuidance.params);
      if (wxNote && wxNote !== weatherGuidance.recommendationKey) {
        reason = wxNote; // replace, don't append — keep it short
      }
    }

    return {
      ...makeAction('daily_task', getTaskIcon(primaryTask), getTaskIconBg(primaryTask),
        taskTitle, reason,
        t('guided.taskCta'), t('guided.taskNext'), 'medium', false),
      task: primaryTask,
    };
  }

  // 8. Needs check-in (7-30 days idle, softer than stale)
  if (needsCheckIn(profile)) {
    const days = daysSinceUpdate(profile);
    return makeAction('needs_checkin', '👋', 'rgba(14,165,233,0.12)',
      t('guided.checkinTitle'),
      crop ? t('guided.checkinReasonCrop', { days, crop }) || t('guided.checkinReason', { days }) : t('guided.checkinReason', { days }),
      t('guided.checkinCta'), t('guided.checkinNext'), 'low', false);
  }

  // 9. Stale farm activity (>30 days)
  if (isFarmStale(profile)) {
    return makeAction('stale_activity', '📋', 'rgba(250,204,21,0.12)',
      t('guided.staleTitle'), t('guided.staleReason'),
      t('guided.staleCta'), t('guided.staleNext'), 'low', false);
  }

  // 10. All done
  return makeAction('all_done', '✅', 'rgba(34,197,94,0.12)',
    t('guided.doneTitle'), t('guided.doneReason'),
    t('guided.doneCta'), null, 'info', false);
}

// ─── Today's Plan Builder ────────────────────────────────────
function buildTodayPlan(action, profile, taskCount, t) {
  const steps = [];
  const stage = getStage(profile);

  switch (action.key) {
    case 'onboarding_incomplete':
    case 'profile_incomplete':
      steps.push({ icon: '⚠️', label: t('guided.planSetup'), active: true });
      steps.push({ icon: '🌱', label: t('guided.planStage'), active: false });
      steps.push({ icon: '🎯', label: t('guided.planTask'), active: false });
      break;

    case 'stage_missing':
    case 'stage_outdated':
      steps.push({ icon: STAGE_EMOJIS[stage] || '🌱', label: t('guided.planStage'), active: true });
      if (taskCount > 0) steps.push({ icon: '🎯', label: t('guided.planTask'), active: false });
      steps.push({ icon: '🐛', label: t('guided.planPest'), active: false });
      break;

    case 'severe_pest':
      steps.push({ icon: action.icon, label: action.title, active: true });
      steps.push({ icon: '💊', label: t('guided.planTreat'), active: false });
      if (taskCount > 1) steps.push({ icon: '📋', label: t('guided.planMore', { count: taskCount - 1 }), active: false });
      break;

    case 'unread_alert':
    case 'daily_task':
      steps.push({ icon: action.icon, label: action.title, active: true });
      if (taskCount > 1) steps.push({ icon: '📋', label: t('guided.planMore', { count: taskCount - 1 }), active: false });
      if (action.task && !isPestTask(action.task)) steps.push({ icon: '🐛', label: t('guided.planPest'), active: false });
      break;

    case 'needs_checkin':
      steps.push({ icon: '👋', label: t('guided.planCheckin'), active: true });
      steps.push({ icon: '🌱', label: t('guided.planStage'), active: false });
      steps.push({ icon: '🐛', label: t('guided.planPest'), active: false });
      break;

    case 'stale_activity':
      steps.push({ icon: '📋', label: t('guided.planStale'), active: true });
      steps.push({ icon: '🌱', label: t('guided.planStage'), active: false });
      break;

    case 'all_done':
      steps.push({ icon: '✅', label: t('guided.planAllDone'), active: true });
      steps.push({ icon: '🐛', label: t('guided.planPest'), active: false });
      steps.push({ icon: '📋', label: t('guided.planCheckTomorrow'), active: false });
      break;
  }

  return steps;
}

// ─── Farm Status Builder ─────────────────────────────────────
function buildFarmStatus(input, t) {
  const { profile, setupComplete, taskCount = 0, completedCount = 0 } = input;
  if (!profile) return { riskLevel: 'high', label: t('status.needsWork'), description: t('status.needsWorkDesc'), checks: [], progress: 0 };
  const progress = farmProgress(profile, taskCount, completedCount);

  const checks = [];

  // Profile
  checks.push({
    icon: setupComplete ? '✅' : '⚠️',
    label: t('status.profile'),
    ok: setupComplete,
  });

  // Stage
  const stageOk = profile && isStageSet(profile) && !isStageOutdated(profile);
  checks.push({
    icon: stageOk ? '✅' : '⚠️',
    label: t('status.cropStage'),
    ok: !!stageOk,
  });

  // Tasks
  const taskOk = taskCount === 0 && completedCount > 0;
  const taskPartial = completedCount > 0 && taskCount > 0;
  checks.push({
    icon: taskOk ? '✅' : taskPartial ? '🔄' : '⬜',
    label: t('status.tasks'),
    ok: taskOk,
  });

  // Activity freshness
  const fresh = profile && !isFarmStale(profile);
  checks.push({
    icon: fresh ? '✅' : '⚠️',
    label: t('status.activity'),
    ok: !!fresh,
  });

  const okCount = checks.filter(c => c.ok).length;

  let riskLevel = 'none';
  let label = t('status.good');
  let description = t('status.goodDesc');

  if (okCount <= 1) {
    riskLevel = 'high';
    label = t('status.needsWork');
    description = t('status.needsWorkDesc');
  } else if (okCount <= 2) {
    riskLevel = 'moderate';
    label = t('status.almostReady');
    description = t('status.almostReadyDesc');
  } else if (okCount <= 3) {
    riskLevel = 'low';
    label = t('status.onTrack');
    description = t('status.onTrackDesc');
  }

  const lastUpdate = daysSinceUpdate(profile);
  return { riskLevel, label, description, checks, progress, lastUpdate };
}

// ─── Secondary Actions ───────────────────────────────────────
function buildSecondaryActions(input, primary, t) {
  const actions = [];
  const { profile, setupComplete, primaryTask, taskCount } = input;

  // Suggest stage update if not the primary action and stage is outdated
  if (profile && setupComplete && isStageSet(profile) && isStageOutdated(profile)
    && primary.key !== 'stage_outdated') {
    actions.push(makeAction('stage_outdated', '🌱', 'rgba(250,204,21,0.12)',
      t('guided.stageOutdatedTitle'), '', t('guided.stageOutdatedCta'), null, 'low', false));
  }

  // Suggest pest check if not already doing one
  if (profile && setupComplete && isStageSet(profile)
    && primary.key !== 'severe_pest' && (!primary.task || !isPestTask(primary.task))) {
    actions.push(makeAction('pest_check', '🐛', 'rgba(255,255,255,0.06)',
      t('guided.planPest'), '', t('guided.taskCta'), null, 'low', false));
  }

  return actions.slice(0, 3);
}

// ─── Factory helpers ─────────────────────────────────────────
function makeAction(key, icon, iconBg, title, reason, cta, next, priority, isAlert) {
  return { key, icon, iconBg, title, reason, cta, next, priority, isAlert, stageInfo: null, task: null };
}

function makeStageInfo(stage, daysAgo, t) {
  return {
    stage,
    emoji: STAGE_EMOJIS[stage] || '🌱',
    label: t(STAGE_KEYS[stage] || 'cropStage.planning'),
    daysSinceUpdate: daysAgo,
  };
}
