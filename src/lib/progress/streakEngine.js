/**
 * streakEngine.js — computes daily-action streaks from the existing
 * farroway.taskCompletions localStorage stream.
 *
 *   getStreak({ completions, now }) → {
 *     currentStreak,   // consecutive days ending today/yesterday
 *     longestStreak,   // max over all history
 *     lastActiveDate,  // 'YYYY-MM-DD' | null
 *     todayActive,     // true if farmer completed ≥1 meaningful task today
 *     gracePending,    // true when the streak hasn't broken yet but the
 *                      //   farmer has 24h left to act before it does
 *   }
 *
 * Rules (strict + motivational):
 *   • a streak increments by 1 when a new local-date first gets any
 *     completion with type != 'skip' (skips don't count)
 *   • a day with no completion ends the streak the following day
 *   • tolerant: if `now` is today and the last-active date is
 *     yesterday, we report currentStreak unchanged with
 *     `gracePending: true` so the UI can nudge the farmer — the
 *     streak stays intact until *tomorrow* without action
 *
 * The engine never mutates storage — it's a pure read over a list of
 * completion records. Persistence lives with the task scheduler.
 */

function ymd(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
  const d = date instanceof Date ? date : new Date(date || Date.now());
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(ymdStr, deltaDays) {
  // Anchored at local noon so DST shifts can't flip the day.
  const [y, m, d] = ymdStr.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() + deltaDays);
  return ymd(dt);
}

function dayDiff(a, b) {
  if (!a || !b) return null;
  const [ay, am, ad] = a.split('-').map((x) => parseInt(x, 10));
  const [by, bm, bd] = b.split('-').map((x) => parseInt(x, 10));
  const da = new Date(ay, am - 1, ad, 12);
  const db = new Date(by, bm - 1, bd, 12);
  return Math.round((db - da) / 86400000);
}

/**
 * toActiveDateSet — a day counts as "active" when it contains at
 * least one completion whose flag isn't explicitly skipped. We scan
 * both legacy shapes (`{ completed: true }`) and the new shape
 * (`{ status: 'complete' }`) so old records keep working.
 */
function toActiveDateSet(completions) {
  const set = new Set();
  if (!Array.isArray(completions)) return set;
  for (const entry of completions) {
    if (!entry || typeof entry !== 'object') continue;
    const skipped = entry.skipped === true || entry.status === 'skipped';
    if (skipped) continue;
    const done =
         entry.completed === true
      || entry.status === 'complete'
      || entry.status === 'completed'
      || !!entry.completedAt;
    if (!done) continue;
    const ts = entry.timestamp || entry.completedAt || entry.createdAt || entry.at;
    const day = ymd(ts);
    if (day) set.add(day);
  }
  return set;
}

/**
 * walkStreaks — sort the active dates and return
 *   { longest, trailingStreakLength, trailingLastDate }
 * where trailing* refers to the most recent contiguous run.
 */
function walkStreaks(activeSet) {
  const days = Array.from(activeSet).sort();
  if (days.length === 0) {
    return { longest: 0, trailing: 0, trailingLast: null };
  }
  let longest = 1;
  let current = 1;
  let trailingLast = days[0];
  for (let i = 1; i < days.length; i += 1) {
    const diff = dayDiff(days[i - 1], days[i]);
    if (diff === 1) current += 1;
    else current = 1;
    if (current > longest) longest = current;
    trailingLast = days[i];
  }
  return { longest, trailing: current, trailingLast };
}

export function getStreak({ completions = [], now = null } = {}) {
  const today = ymd(now || Date.now());
  const activeSet = toActiveDateSet(completions);
  if (activeSet.size === 0 || !today) {
    return Object.freeze({
      currentStreak: 0, longestStreak: 0,
      lastActiveDate: null, todayActive: false, gracePending: false,
    });
  }

  const { longest, trailing, trailingLast } = walkStreaks(activeSet);
  const diffFromToday = dayDiff(trailingLast, today);

  let currentStreak = 0;
  let gracePending  = false;
  if (diffFromToday === 0) {
    // Farmer was active today — streak reflects the trailing run.
    currentStreak = trailing;
  } else if (diffFromToday === 1) {
    // Last active yesterday — streak still alive; the farmer has
    // until end-of-today to keep it.
    currentStreak = trailing;
    gracePending = true;
  } else {
    currentStreak = 0;       // streak broke
  }

  return Object.freeze({
    currentStreak,
    longestStreak:  Math.max(longest, currentStreak),
    lastActiveDate: trailingLast,
    todayActive:    diffFromToday === 0,
    gracePending,
  });
}

/**
 * streakMessage — a short motivational line for the UI. Localisable
 * via the key; the fallback is English so it's safe before i18n
 * keys land.
 */
export function streakMessage({ currentStreak, gracePending, farmType } = {}) {
  const simple = farmType === 'backyard';
  if (currentStreak <= 0) {
    return {
      key: 'progress.streak.none',
      fallback: simple
        ? 'Complete one task today to start a streak.'
        : 'Finish one task today to kick off a streak.',
    };
  }
  if (gracePending && currentStreak > 0) {
    return {
      key: 'progress.streak.grace',
      fallback: `You still have today to keep your ${currentStreak}-day streak alive.`,
    };
  }
  if (currentStreak === 1) {
    return { key: 'progress.streak.one',
             fallback: 'Nice start — that\u2019s day one.' };
  }
  if (currentStreak < 3) {
    return { key: 'progress.streak.early',
             fallback: `${currentStreak} days in a row — keep it going.` };
  }
  if (currentStreak < 7) {
    return { key: 'progress.streak.building',
             fallback: `${currentStreak} day streak — you\u2019re building a strong habit.` };
  }
  return { key: 'progress.streak.strong',
           fallback: `${currentStreak} days active — incredible consistency.` };
}

export const _internal = Object.freeze({
  ymd, addDays, dayDiff, toActiveDateSet, walkStreaks,
});
