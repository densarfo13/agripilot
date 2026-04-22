/**
 * progressTracker.js — orchestrator that ties the progress engines
 * together into one view the UI can render.
 *
 *   getDailyProgress({ farm, tasks, completions, issues, risk,
 *                       now, language }) → ProgressView
 *
 * ProgressView:
 *   {
 *     streak:     { currentStreak, longestStreak, lastActiveDate,
 *                   todayActive, gracePending, message:{key,fallback} }
 *     score:      { score, label, explanation, reasons[] }
 *     today:      { total, completed, remaining, summary:{key,fallback} }
 *     nextAction: { key, fallback, kind: 'task' | 'bridge' | 'tomorrow' }
 *     milestones: { unseen: Milestone[], allAchieved: Milestone[] }
 *     motivation: { key, fallback }   // after-task reinforcement line
 *     farmType:   'backyard' | 'small_farm' | 'commercial',
 *     generatedAt: ISO string,
 *   }
 *
 * Persistence: the tracker stores a tiny "seen-milestones" ledger in
 * localStorage so the UI only celebrates each milestone once. The
 * ledger is keyed per-user — multi-farm users keep a single milestone
 * history, which matches how users think about "my farming journey".
 *
 * Backward compatibility: every branch defaults to a neutral
 * onboarding state when its inputs are empty, so a brand-new farmer
 * sees encouraging copy instead of crashes or blank UI.
 */

import { getStreak, streakMessage } from './streakEngine.js';
import { getProgressScore } from './progressScoreEngine.js';
import { detectMilestones } from './milestoneEngine.js';

const SEEN_KEY = 'farroway.milestones.seen.v1';

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readSeen() {
  if (!hasStorage()) return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function writeSeen(set) {
  if (!hasStorage()) return;
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set))); }
  catch { /* quota / privacy mode — non-fatal */ }
}

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

function todaySummary({ total, completed, simple }) {
  if (total === 0) {
    return {
      key: 'progress.today.empty',
      fallback: simple
        ? 'Open your farm page for today\u2019s task.'
        : 'No tasks yet today — your plan refreshes each morning.',
    };
  }
  if (completed === total) {
    return {
      key: 'progress.today.allDone',
      fallback: `All ${total} task${total > 1 ? 's' : ''} done today — great.`,
    };
  }
  if (completed === 0) {
    return {
      key: 'progress.today.start',
      fallback: `You have ${total} task${total > 1 ? 's' : ''} to complete today.`,
    };
  }
  return {
    key: 'progress.today.partial',
    fallback: `You completed ${completed} of ${total} tasks today.`,
  };
}

function nextBestAction({ todayTasks, allDone, farmType }) {
  const pending = todayTasks.filter((t) => t.status === 'pending');
  if (pending.length > 0) {
    // Prefer the highest-priority pending task.
    const pri = { high: 0, medium: 1, low: 2 };
    pending.sort((a, b) => (pri[a.priority] ?? 3) - (pri[b.priority] ?? 3));
    const pick = pending[0];
    return {
      key:      pick.titleKey || `progress.next.task.${pick.templateId || pick.id}`,
      fallback: pick.title || 'Open your next task.',
      kind:     'task',
      taskId:   pick.id,
      templateId: pick.templateId || null,
    };
  }
  if (allDone) {
    // Never a dead-end: preview tomorrow.
    return {
      key:      'progress.next.tomorrow',
      fallback: farmType === 'backyard'
        ? 'You\u2019re done for today. Check back tomorrow for your next task.'
        : 'Today is wrapped. Tomorrow\u2019s plan is already being prepared.',
      kind:     'tomorrow',
    };
  }
  return {
    key:      'progress.next.bridge',
    fallback: 'Open your farm page to review today\u2019s actions.',
    kind:     'bridge',
  };
}

function motivationLine({ justCompleted, allDone, farmType }) {
  if (allDone) {
    return {
      key: 'progress.motivation.allDone',
      fallback: farmType === 'commercial'
        ? 'Great discipline — today\u2019s operations are complete.'
        : 'Nice work — every task done helps your farm thrive.',
    };
  }
  if (justCompleted) {
    return {
      key: 'progress.motivation.task',
      fallback: farmType === 'backyard'
        ? 'Good job — small daily actions add up.'
        : 'Nice work — today\u2019s action helps reduce future risk.',
    };
  }
  return { key: null, fallback: '' };
}

export function getDailyProgress({
  user         = null,
  farm         = null,
  tasks        = [],
  completions  = [],
  issues       = [],
  risk         = null,
  now          = null,
  language     = 'en',
  justCompleted = false,
} = {}) {
  void language;  // placeholders use i18n keys; language only informs callers
  const todayStr = ymd(now || Date.now());
  const farmType = canonicalFarmType(farm && farm.farmType);
  const simple   = farmType === 'backyard';

  // ── Streak ─────────────────────────────────────────────────────
  const streak  = getStreak({ completions, now });
  const streakMsg = streakMessage({
    currentStreak: streak.currentStreak,
    gracePending:  streak.gracePending,
    farmType,
  });

  // ── Progress score ─────────────────────────────────────────────
  const score = getProgressScore({
    tasks, completions, issues, streak, risk, farmType, now,
  });

  // ── Today summary ──────────────────────────────────────────────
  const todayTasks = (Array.isArray(tasks) ? tasks : [])
    .filter((t) => t && t.date === todayStr);
  const completedToday = todayTasks.filter((t) => t.status === 'complete').length;
  const todayBlock = {
    total:     todayTasks.length,
    completed: completedToday,
    remaining: todayTasks.length - completedToday,
    summary:   todaySummary({ total: todayTasks.length,
                              completed: completedToday, simple }),
  };

  // ── Next best action ───────────────────────────────────────────
  const allDone = todayTasks.length > 0 && completedToday === todayTasks.length;
  const nextAction = nextBestAction({ todayTasks, allDone, farmType });

  // ── Milestones ─────────────────────────────────────────────────
  const achieved = detectMilestones({ completions, tasks, streak, farm, issues, now });
  const seen = readSeen();
  const unseen = achieved.filter((m) => !seen.has(m.type));
  for (const m of unseen) seen.add(m.type);
  if (unseen.length > 0) writeSeen(seen);   // mark as seen

  // ── Motivation ─────────────────────────────────────────────────
  const motivation = motivationLine({ justCompleted, allDone, farmType });

  return Object.freeze({
    userId:      (user && (user.id || user._id)) || null,
    farmId:      (farm && (farm.id || farm._id)) || null,
    farmType,
    streak: Object.freeze({
      ...streak,
      message: streakMsg,
    }),
    score,
    today: Object.freeze(todayBlock),
    nextAction,
    milestones: Object.freeze({
      unseen:       Object.freeze(unseen),
      allAchieved:  Object.freeze(achieved),
    }),
    motivation,
    generatedAt: new Date().toISOString(),
  });
}

/**
 * acknowledgeMilestone — manual dismissal hook. Adds the type to the
 * seen ledger so the UI won't show it again on next render.
 */
export function acknowledgeMilestone(type) {
  if (!type) return false;
  const seen = readSeen();
  if (seen.has(type)) return true;
  seen.add(type);
  writeSeen(seen);
  return true;
}

/**
 * resetProgressLedger — testing / debugging convenience; never wired
 * to a real button in production UI.
 */
export function resetProgressLedger() {
  if (!hasStorage()) return;
  try { window.localStorage.removeItem(SEEN_KEY); } catch { /* noop */ }
}

export const _internal = Object.freeze({
  SEEN_KEY, readSeen, writeSeen, todaySummary, nextBestAction, motivationLine,
});
