/**
 * Activity Aggregator — computes admin metrics from activity logs.
 *
 * Pure functions: activity log in, metrics out.
 * No React, no API calls, no side effects.
 *
 * Reads from the activityLogger's localStorage ring buffer.
 * When a server-side analytics API is connected, these functions
 * can be replaced with server queries — the API surface stays the same.
 *
 * Metrics:
 *   - totalFarmers           — unique user_ids with user_registered events
 *   - newFarmersToday        — registrations in the last 24h
 *   - newFarmersByDay        — registrations grouped by date (last 30 days)
 *   - activeFarmersToday     — unique user_ids with any event in last 24h
 *   - onboardingCompletionRate — onboarding_completed / user_registered
 *   - eventCounts            — count per event_type
 *   - recentActivity         — last N events (for activity feed)
 */

import {
  getActivityLog,
  getActivitiesByType,
  getRecentActivities,
} from './activityLogger.js';

// ─── Helpers ────────────────────────────────────────────────

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function dateStr(iso) {
  return (iso || '').slice(0, 10);
}

function isToday(iso) {
  return dateStr(iso) === todayDateStr();
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ─── Core metrics ───────────────────────────────────────────

/**
 * Total registered farmers (unique user_ids from user_registered events).
 */
export function getTotalFarmers() {
  const registrations = getActivitiesByType('user_registered');
  const ids = new Set(registrations.filter(e => e.user_id).map(e => e.user_id));
  return ids.size;
}

/**
 * New farmers registered today.
 */
export function getNewFarmersToday() {
  const registrations = getActivitiesByType('user_registered');
  return registrations.filter(e => isToday(e.created_at)).length;
}

/**
 * New farmers per day for the last N days.
 * @param {number} days — default 30
 * @returns {Array<{date: string, count: number}>}
 */
export function getNewFarmersByDay(days = 30) {
  const registrations = getActivitiesByType('user_registered');
  const cutoff = daysAgo(days);

  // Init buckets
  const buckets = {};
  for (let i = 0; i < days; i++) {
    buckets[daysAgo(i)] = 0;
  }

  for (const e of registrations) {
    const d = dateStr(e.created_at);
    if (d >= cutoff && buckets[d] !== undefined) {
      buckets[d]++;
    }
  }

  return Object.entries(buckets)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Active farmers today (unique user_ids with any event in last 24h).
 */
export function getActiveFarmersToday() {
  const recent = getRecentActivities(24);
  const ids = new Set(recent.filter(e => e.user_id).map(e => e.user_id));
  return ids.size;
}

/**
 * Active farmers in last N days.
 * @param {number} days
 */
export function getActiveFarmers(days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const entries = getActivityLog().filter(e => e.created_at >= cutoff);
  const ids = new Set(entries.filter(e => e.user_id).map(e => e.user_id));
  return ids.size;
}

/**
 * Onboarding completion rate (0-100%).
 * = users who completed onboarding / users who registered
 */
export function getOnboardingCompletionRate() {
  const registered = new Set(
    getActivitiesByType('user_registered').filter(e => e.user_id).map(e => e.user_id)
  );
  if (registered.size === 0) return 0;

  const completed = new Set(
    getActivitiesByType('onboarding_completed').filter(e => e.user_id).map(e => e.user_id)
  );

  const rate = (completed.size / registered.size) * 100;
  return Math.min(100, Math.round(rate));
}

/**
 * Count of each event type.
 * @returns {Object} — { event_type: count }
 */
export function getEventCounts() {
  const entries = getActivityLog();
  const counts = {};
  for (const e of entries) {
    counts[e.event_type] = (counts[e.event_type] || 0) + 1;
  }
  return counts;
}

/**
 * Most recent activity entries for an admin feed.
 * @param {number} limit — max entries to return (default 20)
 * @returns {Array<Object>}
 */
export function getRecentActivityFeed(limit = 20) {
  const entries = getActivityLog();
  // Return newest first
  return entries.slice(-limit).reverse();
}

/**
 * Full dashboard snapshot — all metrics in one call.
 * @returns {Object}
 */
export function getDashboardMetrics() {
  return {
    totalFarmers: getTotalFarmers(),
    newFarmersToday: getNewFarmersToday(),
    activeFarmersToday: getActiveFarmersToday(),
    activeFarmersWeek: getActiveFarmers(7),
    onboardingRate: getOnboardingCompletionRate(),
    eventCounts: getEventCounts(),
    newFarmersByDay: getNewFarmersByDay(14),
    recentActivity: getRecentActivityFeed(15),
  };
}

// ─── Extended metrics (admin dashboard) ─────────────────────

/**
 * Growth summary — registrations by period.
 * @returns {{ today: number, thisWeek: number, thisMonth: number, total: number }}
 */
export function getGrowthSummary() {
  const registrations = getActivitiesByType('user_registered');
  const today = todayDateStr();
  const weekCutoff = daysAgo(7);
  const monthCutoff = daysAgo(30);

  return {
    today: registrations.filter(e => dateStr(e.created_at) === today).length,
    thisWeek: registrations.filter(e => dateStr(e.created_at) >= weekCutoff).length,
    thisMonth: registrations.filter(e => dateStr(e.created_at) >= monthCutoff).length,
    total: new Set(registrations.filter(e => e.user_id).map(e => e.user_id)).size,
  };
}

/**
 * Onboarding funnel — unique users who reached each stage.
 * @returns {Array<{ step: string, label: string, count: number }>}
 */
export function getOnboardingFunnel() {
  const log = getActivityLog();
  const unique = (type) =>
    new Set(log.filter(e => e.event_type === type && e.user_id).map(e => e.user_id)).size;

  return [
    { step: 'registered',     label: 'admin.evtRegistered',  count: unique('user_registered') },
    { step: 'onboarded',      label: 'admin.evtOnboarded',   count: unique('onboarding_completed') },
    { step: 'farm_created',   label: 'admin.evtFarmCreated', count: unique('farm_created') },
    { step: 'stage_updated',  label: 'admin.evtStageUpdate', count: unique('crop_stage_updated') },
    { step: 'pest_report',    label: 'admin.evtPestReport',  count: unique('pest_report_submitted') },
  ];
}

/**
 * Activity counts for today, broken out by type.
 */
export function getActivityToday() {
  const todayEntries = getActivityLog().filter(e => isToday(e.created_at));
  const count = (type) => todayEntries.filter(e => e.event_type === type).length;

  return {
    stageUpdates: count('crop_stage_updated'),
    pestReports: count('pest_report_submitted'),
    farmsCreated: count('farm_created'),
    actionsCompleted: count('action_completed'),
    logins: count('login'),
  };
}

/**
 * Crop breakdown from farm_created event metadata.
 * @returns {Array<{ crop: string, count: number }>}
 */
export function getCropBreakdown() {
  const farms = getActivitiesByType('farm_created');
  const counts = {};
  for (const e of farms) {
    const crop = e.metadata?.crop || 'unknown';
    counts[crop] = (counts[crop] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([crop, count]) => ({ crop, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Risk indicators derived from activity patterns.
 * Compares user sets across event types to find gaps.
 */
export function getRiskIndicators() {
  const log = getActivityLog();
  const byType = (type) =>
    new Set(log.filter(e => e.event_type === type && e.user_id).map(e => e.user_id));

  const registered = byType('user_registered');
  const hasFarm = byType('farm_created');
  const hasOnboarded = byType('onboarding_completed');
  const hasPestCheck = byType('pest_report_submitted');

  // Active in last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const activeRecently = new Set(
    log.filter(e => e.created_at >= weekAgo && e.user_id).map(e => e.user_id)
  );

  return {
    noFarm: [...registered].filter(id => !hasFarm.has(id)).length,
    notOnboarded: [...registered].filter(id => !hasOnboarded.has(id)).length,
    noPestCheck: [...hasFarm].filter(id => !hasPestCheck.has(id)).length,
    inactive: [...registered].filter(id => !activeRecently.has(id)).length,
  };
}

/**
 * Gender breakdown from onboarding_completed event metadata.
 * Only counts users who provided a gender value.
 * @returns {Array<{ gender: string, count: number }>}
 */
export function getGenderBreakdown() {
  const events = getActivitiesByType('onboarding_completed');
  // Deduplicate by user_id — take the latest entry per user
  const byUser = {};
  for (const e of events) {
    const g = e.metadata?.gender;
    if (g && e.user_id) byUser[e.user_id] = g;
  }
  const counts = {};
  for (const g of Object.values(byUser)) {
    counts[g] = (counts[g] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([gender, count]) => ({ gender, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Age range breakdown from onboarding_completed event metadata.
 * Only counts users who provided an ageGroup value.
 * @returns {Array<{ ageGroup: string, count: number }>}
 */
export function getAgeBreakdown() {
  const events = getActivitiesByType('onboarding_completed');
  const byUser = {};
  for (const e of events) {
    const a = e.metadata?.ageGroup;
    if (a && e.user_id) byUser[e.user_id] = a;
  }
  const counts = {};
  for (const a of Object.values(byUser)) {
    counts[a] = (counts[a] || 0) + 1;
  }
  // Sort by a known order rather than count
  const ORDER = ['under_25', '25_34', '35_44', '45_54', '55_plus', 'prefer_not_to_say'];
  return Object.entries(counts)
    .map(([ageGroup, count]) => ({ ageGroup, count }))
    .sort((a, b) => ORDER.indexOf(a.ageGroup) - ORDER.indexOf(b.ageGroup));
}

/**
 * New farmers by gender — registrations today broken down by gender.
 * Gender is taken from onboarding_completed events (same session as registration).
 * @returns {Array<{ gender: string, count: number }>}
 */
export function getNewFarmersByGender() {
  const today = todayDateStr();
  const events = getActivitiesByType('onboarding_completed')
    .filter(e => dateStr(e.created_at) === today);
  const byUser = {};
  for (const e of events) {
    const g = e.metadata?.gender;
    if (g && e.user_id) byUser[e.user_id] = g;
  }
  const counts = {};
  for (const g of Object.values(byUser)) {
    counts[g] = (counts[g] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([gender, count]) => ({ gender, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Onboarding completion rate by age range.
 * For each age group, computes what % of registered users completed onboarding.
 * @returns {Array<{ ageGroup: string, registered: number, completed: number, rate: number }>}
 */
export function getOnboardingByAgeRange() {
  const log = getActivityLog();

  // Collect age group from onboarding_completed events (where it's stored)
  const completedUsers = {};  // user_id → ageGroup
  const registeredUsers = {}; // user_id → ageGroup (from their completion, if any)

  // First pass: identify completed users and their age groups
  for (const e of log) {
    if (e.event_type === 'onboarding_completed' && e.user_id && e.metadata?.ageGroup) {
      completedUsers[e.user_id] = e.metadata.ageGroup;
      registeredUsers[e.user_id] = e.metadata.ageGroup;
    }
  }

  // Second pass: registered users who completed also have an age group
  // For users who registered but didn't complete, we don't know their age group
  // So we can only show completion counts per age group (not a true funnel rate)
  const ORDER = ['under_25', '25_34', '35_44', '45_54', '55_plus', 'prefer_not_to_say'];
  const counts = {};
  for (const ag of Object.values(completedUsers)) {
    counts[ag] = (counts[ag] || 0) + 1;
  }

  return ORDER
    .filter(ag => counts[ag] > 0)
    .map(ageGroup => ({ ageGroup, completed: counts[ageGroup] || 0 }));
}

/**
 * Full dashboard — all metrics for the comprehensive admin analytics page.
 * Single call that returns everything the dashboard needs.
 */
export function getFullDashboard() {
  return {
    ...getDashboardMetrics(),
    newFarmersByDay: getNewFarmersByDay(30),
    growth: getGrowthSummary(),
    funnel: getOnboardingFunnel(),
    activityToday: getActivityToday(),
    cropBreakdown: getCropBreakdown(),
    risk: getRiskIndicators(),
    genderBreakdown: getGenderBreakdown(),
    ageBreakdown: getAgeBreakdown(),
    newFarmersByGender: getNewFarmersByGender(),
    onboardingByAge: getOnboardingByAgeRange(),
  };
}
