/**
 * analytics.js — NGO / program-level analytics, computed locally
 * from the farroway.* stores.
 *
 * Pure and offline-first: every function reads existing
 * localStorage-backed helpers (farrowayLocal + eventLogger) or
 * explicitly-passed data; none of them hit the network.
 *
 * Exports:
 *   isActiveFarmer(farmId, { now, windowDays })   — spec §3
 *   getProgramSummary(program, opts?)              — spec §5
 *   getExportData(program, opts?) → CSV string    — spec §6
 */

import {
  getFarms,
  getTaskCompletions,
} from '../../store/farrowayLocal.js';
import {
  getEvents,
  isFarmActive,
} from '../events/eventLogger.js';
import { computeProgress } from '../progress/progressEngine.js';
import { getFarmerVerificationSignals } from './verificationSignals.js';
import { getFarmerTrustProfile } from '../trust/trustProfile.js';
import { aggregateTrustProfiles } from '../trust/trustAggregate.js';

const DAY_MS = 24 * 3600 * 1000;

function toNowTs(now) {
  if (Number.isFinite(now)) return Number(now);
  if (now instanceof Date) return now.getTime();
  return Date.now();
}

// ─── Active-farmer detection (spec §3) ────────────────────────────
/**
 * isActiveFarmer — has this farm had any event in the last
 * `windowDays` days (default 7). Delegates to eventLogger.isFarmActive.
 */
export function isActiveFarmer(farmId, { now, windowDays = 7 } = {}) {
  return isFarmActive(farmId, { now, windowDays });
}

// ─── Last activity helper ─────────────────────────────────────────
/** Returns epoch-ms of the most recent event for this farm, or 0. */
export function getLastActivity(farmId, { events } = {}) {
  if (!farmId) return 0;
  const id = String(farmId);
  const list = events || getEvents();
  let max = 0;
  for (const e of list) {
    if (!e || e.farmId !== id) continue;
    if ((e.timestamp || 0) > max) max = e.timestamp || 0;
  }
  return max;
}

// ─── Per-farm facts (internal) ────────────────────────────────────
/**
 * Build the per-farm row we use for both the program summary and
 * the CSV export. One pass over events + completions.
 */
function buildFarmFacts(farm, { now, events, completions, windowDays = 7 } = {}) {
  const farmId = String(farm.id);
  const nowTs  = toNowTs(now);
  const cutoff = nowTs - Math.max(0, windowDays) * DAY_MS;

  // Scan events for this farm.
  let tasksCompleted = 0;
  let lastActivity = 0;
  let anyInWindow  = false;
  const comps = [];
  for (const e of events) {
    if (!e || e.farmId !== farmId) continue;
    if ((e.timestamp || 0) > lastActivity) lastActivity = e.timestamp || 0;
    if ((e.timestamp || 0) >= cutoff)      anyInWindow  = true;
    if (e.type === 'task_completed') {
      tasksCompleted += 1;
      comps.push({
        taskId:    e.payload?.taskId || null,
        farmId,
        completed: true,
        timestamp: e.timestamp || 0,
      });
    }
  }

  // Also merge the flat completions store as a fallback — some
  // callers may have logged completions before the event log existed.
  for (const c of completions || []) {
    if (!c || c.completed === false) continue;
    if (String(c.farmId || '') !== farmId) continue;
    if (comps.some((x) => x.taskId && x.taskId === c.taskId
                        && x.timestamp === c.timestamp)) continue;
    comps.push(c);
  }

  // Use the Progress Engine to compute score + status. The engine
  // works with just `completions` when tasks aren't enumerable.
  const snap = computeProgress({
    farm:        { cropStage: farm.cropStage || null },
    tasks:       [],
    completions: comps,
    feedback:    [],
    now: nowTs,
  });

  return {
    farmId,
    farmerId:         farm.farmerId || null,
    farmName:         farm.name || '',
    crop:             farm.crop || farm.cropType || '',
    program:          farm.program || null,
    progressScore:    snap.progressScore,
    status:           snap.status,
    streak:           0,          // streak is global, not per-farm; see §7
    tasksCompleted,
    lastActivity,
    isActive:         anyInWindow,
  };
}

// ─── Program summary (spec §5) ────────────────────────────────────
/**
 * getProgramSummary — aggregate counts for one program.
 *
 *   getProgramSummary('ngo_zambia_2026') → {
 *     program, totalFarmers, activeFarmers,
 *     avgProgressScore, totalTasksCompleted,
 *   }
 *
 * `program` matches farms where `farm.program === program`. Pass
 * `null` to aggregate across every farm regardless of program.
 */
export function getProgramSummary(program, {
  now,
  windowDays = 7,
  farms,          // override for tests
  events,         // override for tests
  completions,    // override for tests
} = {}) {
  const allFarms       = farms || getFarms();
  const allEvents      = events || getEvents();
  const allCompletions = completions || getTaskCompletions();

  const matching = program == null
    ? allFarms
    : allFarms.filter((f) => f && f.program === program);

  if (matching.length === 0) {
    return Object.freeze({
      program:             program ?? null,
      totalFarmers:        0,
      activeFarmers:       0,
      avgProgressScore:    0,
      totalTasksCompleted: 0,
    });
  }

  let totalScore = 0;
  let active     = 0;
  let totalTasks = 0;

  for (const farm of matching) {
    const f = buildFarmFacts(farm, {
      now, events: allEvents, completions: allCompletions, windowDays,
    });
    totalScore += f.progressScore;
    totalTasks += f.tasksCompleted;
    if (f.isActive) active += 1;
  }

  // Org-level trust aggregate — built from the same farm set so
  // dashboards, CSV exports, and printable reports agree.
  const trust = aggregateTrustProfiles({
    farms: matching,
    events: allEvents,
    completions: allCompletions,
    now,
    activityWindowDays: windowDays,
  });

  return Object.freeze({
    program:             program ?? null,
    totalFarmers:        matching.length,
    activeFarmers:       active,
    avgProgressScore:    Math.round(totalScore / matching.length),
    totalTasksCompleted: totalTasks,
    trust,
  });
}

// ─── CSV export (spec §6) ─────────────────────────────────────────
const EXPORT_HEADERS = Object.freeze([
  'farmerId',
  'farmId',
  'crop',
  'progressScore',
  'streak',
  'lastActivity',
  'tasksCompleted',
  // Verification-signal columns (spec §5 — operational proof of
  // activity, NOT fraud scoring). Five booleans + an integer score.
  'onboardingComplete',
  'locationCaptured',
  'cropSelected',
  'recentActivity',
  'taskActivity',
  'verificationScore',
  // Trust-profile columns — extend the verification view with the
  // org-link signal + a 3-tier level for quick reading.
  'organizationLinked',
  'trustScore',
  'trustLevel',
]);

/** Escape a cell value for CSV — wraps in quotes when needed. */
function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isoOrEmpty(ts) {
  if (!ts || !Number.isFinite(Number(ts))) return '';
  try { return new Date(Number(ts)).toISOString(); } catch { return ''; }
}

/**
 * getExportData — returns a CSV string suitable for download or
 * direct paste into a spreadsheet.
 *
 * Columns: farmerId, farmId, crop, progressScore, streak,
 *          lastActivity (ISO timestamp), tasksCompleted.
 */
export function getExportData(program, {
  now,
  windowDays = 7,
  streak: globalStreak = 0,
  farms,
  events,
  completions,
} = {}) {
  const allFarms       = farms || getFarms();
  const allEvents      = events || getEvents();
  const allCompletions = completions || getTaskCompletions();
  const matching = program == null
    ? allFarms
    : allFarms.filter((f) => f && f.program === program);

  const rows = [EXPORT_HEADERS.join(',')];
  for (const farm of matching) {
    const f = buildFarmFacts(farm, {
      now, events: allEvents, completions: allCompletions, windowDays,
    });
    const v = getFarmerVerificationSignals({
      farm,
      events:      allEvents,
      completions: allCompletions,
      now,
      activityWindowDays: windowDays,
    });
    const trust = getFarmerTrustProfile({
      farm,
      events:      allEvents,
      completions: allCompletions,
      now,
      activityWindowDays: windowDays,
    });
    rows.push([
      csvEscape(f.farmerId || ''),
      csvEscape(f.farmId),
      csvEscape(f.crop),
      csvEscape(f.progressScore),
      csvEscape(globalStreak),                   // streak is global/per-user
      csvEscape(isoOrEmpty(f.lastActivity)),
      csvEscape(f.tasksCompleted),
      csvEscape(v.onboardingComplete ? 'yes' : 'no'),
      csvEscape(v.locationCaptured   ? 'yes' : 'no'),
      csvEscape(v.cropSelected       ? 'yes' : 'no'),
      csvEscape(v.recentActivity     ? 'yes' : 'no'),
      csvEscape(v.taskActivity       ? 'yes' : 'no'),
      csvEscape(v.score),
      csvEscape(trust.signals.organizationLinked ? 'yes' : 'no'),
      csvEscape(trust.score),
      csvEscape(trust.level),
    ].join(','));
  }
  return rows.join('\n') + (rows.length > 1 ? '\n' : '');
}

export const _internal = Object.freeze({ buildFarmFacts, EXPORT_HEADERS });
