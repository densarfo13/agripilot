/**
 * notificationEngine.js — decides what notifications a farmer should
 * see right now.
 *
 *   generateCandidates({ user, farm, tasks, weather, riskInsight,
 *                        completions, now, language }) → Candidate[]
 *
 * A Candidate is a *decision* — not a delivered message. The
 * scheduler + channel router take the list and (a) dedup against
 * what's already in the store, (b) choose channels, (c) send.
 *
 * Candidate shape:
 *   {
 *     key:        stable dedup key, e.g. 'daily:<farmId>:<YYYY-MM-DD>'
 *     type:       'daily_task_reminder' | 'weather_alert'
 *                  | 'risk_alert' | 'missed_task_reminder'
 *                  | 'invite_notification' | 'password_reset_notification'
 *     priority:   'high' | 'medium' | 'low'
 *     titleKey,   titleFallback,
 *     bodyKey,    bodyFallback,
 *     vars:       { ...i18n placeholders },
 *     data:       payload (taskId, ruleTag, etc.),
 *     meta:       { ruleTag, source, farmType, stage, crop },
 *   }
 *
 * Pure, deterministic. Backyard farmers get fewer / simpler
 * candidates; commercial get an extra nudge when risk is elevated.
 */

import { getWeatherAction } from '../intelligence/weatherActionEngine.js';
import { getRiskInsight }   from '../intelligence/riskInsightEngine.js';
import { getCropTimeline }  from '../timeline/cropTimelineEngine.js';
import { getStageProgress } from '../timeline/stageProgressEngine.js';

function ymd(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
  const d = date instanceof Date ? date : new Date(date || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function canonicalFarmType(t) {
  const s = String(t || 'small_farm').toLowerCase().trim();
  if (s === 'backyard' || s === 'home' || s === 'home_food') return 'backyard';
  if (s === 'commercial' || s === 'large' || s === 'enterprise') return 'commercial';
  return 'small_farm';
}

// ─── Individual candidate builders ───────────────────────────────
function dailyTaskCandidate({ farm, tasks, date, farmType }) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  const open = tasks.filter((t) => t && t.status === 'pending');
  if (open.length === 0) return null;   // nothing to nudge about

  const farmId = (farm && (farm.id || farm._id)) || 'nofarm';
  const n = open.length;

  // Backyard farmers get the simpler "one task ready" copy even when
  // there's more; we don't want to overwhelm.
  const simple = farmType === 'backyard' || n === 1;

  return {
    key:  `daily:${farmId}:${date}`,
    type: 'daily_task_reminder',
    priority: 'medium',
    titleKey:      'notif.daily.title',
    titleFallback: simple
      ? 'Today\u2019s farm task is ready'
      : `You have ${n} farm tasks to complete today`,
    bodyKey:       simple ? 'notif.daily.body.one' : 'notif.daily.body.many',
    bodyFallback:  simple
      ? 'Open your farm page to see today\u2019s task.'
      : `You have ${n} tasks on your farm plan for today.`,
    vars: { count: n },
    data: { farmId, date, openCount: n, taskIds: open.map((t) => t.id) },
    meta: { ruleTag: 'daily_task_reminder', source: 'taskScheduler', farmType },
  };
}

function weatherAlertCandidate({ farm, weather, date, farmType, language }) {
  const action = getWeatherAction({
    weather, crop: farm && farm.crop, cropStage: farm && (farm.cropStage || farm.stage),
    farmType, forecastDays: 3,
  });
  if (!action) return null;

  // Backyard: only surface danger-tone weather. Small/commercial get
  // warn + danger. 'info' never becomes a notification — it's just a
  // banner in the UI.
  if (farmType === 'backyard' && action.tone !== 'danger') return null;
  if (action.tone === 'info') return null;

  const farmId = (farm && (farm.id || farm._id)) || 'nofarm';
  const key = `weather:${farmId}:${date}:${action.ruleTag}`;

  return {
    key, type: 'weather_alert',
    priority: action.tone === 'danger' ? 'high' : 'medium',
    titleKey:       action.conditionKey,
    titleFallback:  action.condition,
    bodyKey:        action.primaryActionKey,
    bodyFallback:   action.primaryAction,
    vars: {},
    data: { ruleTag: action.ruleTag, timeWindow: action.timeWindow, farmId },
    meta: { ruleTag: action.ruleTag, source: 'weatherActionEngine',
            farmType, language: language || 'en' },
  };
}

function riskAlertCandidate({ farm, tasks, completions, issues, weather, date, farmType, now }) {
  const insight = getRiskInsight({
    farm, tasks, completions, issues, weather,
    crop: farm && farm.crop, farmType, now,
  });
  if (!insight) return null;
  if (farmType === 'backyard' && insight.level !== 'high') return null;

  const farmId = (farm && (farm.id || farm._id)) || 'nofarm';
  const key = `risk:${farmId}:${date}:${insight.ruleTag}`;

  return {
    key, type: 'risk_alert',
    priority: insight.level === 'high' ? 'high' : 'medium',
    titleKey:       insight.messageKey,
    titleFallback:  insight.message,
    bodyKey:        insight.primaryActionKey,
    bodyFallback:   insight.primaryAction,
    vars: {},
    data: { level: insight.level, type: insight.type, ruleTag: insight.ruleTag, farmId },
    meta: { ruleTag: insight.ruleTag, source: 'riskInsightEngine',
            farmType, requiresReview: insight.requiresReview },
  };
}

function missedTaskCandidate({ farm, tasks, completions, date, farmType }) {
  if (!Array.isArray(tasks)) return null;
  // We care about tasks from prior days (date strictly before today)
  // that were neither completed nor explicitly skipped.
  const yesterday = tasks.filter((t) =>
    t && t.date && t.date < date && t.status === 'pending');
  if (yesterday.length === 0) return null;

  // Require at least 2 missed tasks before nudging (backyard: 3), so
  // one forgotten task doesn't trigger a guilt-trip.
  const threshold = farmType === 'backyard' ? 3 : 2;
  if (yesterday.length < threshold) return null;

  const farmId = (farm && (farm.id || farm._id)) || 'nofarm';
  return {
    key:  `missed:${farmId}:${date}`,
    type: 'missed_task_reminder',
    priority: 'medium',
    titleKey:       'notif.missed.title',
    titleFallback:  'Let\u2019s pick up where you left off',
    bodyKey:        'notif.missed.body',
    bodyFallback:   'You missed yesterday\u2019s farm task. Check today\u2019s task now.',
    vars: { count: yesterday.length },
    data: { farmId, missedCount: yesterday.length,
            missedIds: yesterday.map((t) => t.id) },
    meta: { ruleTag: 'missed_task_reminder', source: 'taskScheduler', farmType },
  };
}

// ─── Stage-transition candidate ──────────────────────────────────
// Fires once per crop × stage transition when the timeline engine
// flags an imminent move (≤ 20% remaining in the current stage). The
// dedup key embeds the NEXT stage so we never retrigger for the same
// upcoming transition, and we don't ping again once the crop has
// actually advanced.
function stageTransitionCandidate({ farm, date, farmType, now }) {
  const timeline = getCropTimeline({ farm, now });
  if (!timeline) return null;
  const progress = getStageProgress({ timeline });
  if (!progress || !progress.transitionImminent) return null;
  if (!timeline.nextStage) return null;

  const farmId = (farm && (farm.id || farm._id)) || 'nofarm';
  const next = String(timeline.nextStage).replace(/[_-]+/g, ' ');
  const pretty = next.charAt(0).toUpperCase() + next.slice(1);

  return {
    key:  `stage_transition:${farmId}:${timeline.nextStage}`,
    type: 'stage_transition',
    priority: timeline.nextStage === 'harvest' ? 'high' : 'medium',
    titleKey:      'notif.stage.title',
    titleFallback: `Your crop is entering ${next} stage soon.`,
    bodyKey:       `notif.stage.body.${timeline.nextStage}`,
    bodyFallback:  timeline.nextStage === 'harvest'
      ? 'Harvest stage is approaching. Prepare storage and planning.'
      : `This week\u2019s focus: prepare for ${next} stage.`,
    vars: { nextStage: pretty },
    data: { farmId, currentStage: timeline.currentStage,
            nextStage: timeline.nextStage,
            daysRemaining: timeline.estimatedDaysRemainingInStage },
    meta: { ruleTag: 'stage_transition', source: 'cropTimelineEngine',
            farmType, confidenceLevel: timeline.confidenceLevel },
  };
}

// ─── Orchestrator ────────────────────────────────────────────────
export function generateCandidates({
  user          = null,
  farm          = null,
  tasks         = [],     // today's plan + any recent tasks
  completions   = [],
  issues        = [],
  weather       = null,
  now           = null,
  language      = 'en',
} = {}) {
  if (!farm) return [];
  const date = ymd(now || Date.now());
  const farmType = canonicalFarmType(farm.farmType);

  const list = [];

  const daily = dailyTaskCandidate({ farm, tasks, date, farmType });
  if (daily) list.push(daily);

  const weatherC = weatherAlertCandidate({ farm, weather, date, farmType, language });
  if (weatherC) list.push(weatherC);

  const risk = riskAlertCandidate({
    farm, tasks, completions, issues, weather, date, farmType, now,
  });
  if (risk) list.push(risk);

  const missed = missedTaskCandidate({ farm, tasks, completions, date, farmType });
  if (missed) list.push(missed);

  const stageTrans = stageTransitionCandidate({ farm, date, farmType, now });
  if (stageTrans) list.push(stageTrans);

  // Mark each with a shared date + ownerUserId for downstream dedup.
  return list.map((c) => ({
    ...c,
    date,
    userId: (user && (user.id || user._id)) || null,
    farmId: (farm && (farm.id || farm._id)) || null,
  }));
}

export const _internal = Object.freeze({
  ymd, canonicalFarmType,
  dailyTaskCandidate, weatherAlertCandidate, riskAlertCandidate, missedTaskCandidate,
});
