/**
 * scanStreakEngine.js — scan-streak + cohort engagement helper.
 *
 *   import { computeScanStreak, scanReminderDue }
 *     from 'src/core/scan/scanStreakEngine.js';
 *
 *   const s = computeScanStreak({ scanHistory, nowMs: Date.now() });
 *   // s = { currentStreakDays, longestStreakDays, lastScanMs, isHotStreak }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure helper that summarises the cadence of a farm's scans
 *   so the surface can render a small "scan streak" badge AND so
 *   the notification engine can decide when to send a "haven't
 *   scanned in a while" gentle reminder.
 *
 *   It is NOT gamification. The streak is informational only —
 *   we don't punish the user for missing a day. Hedged copy:
 *   "you've scanned X days in a row" — never "don't break your
 *   streak!".
 *
 *   It is NOT a notification scheduler — the engine returns
 *   "due / not due" + the suggested envelope; the notification
 *   layer decides whether to actually send.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

const _DAY = 86400000;
const _REMINDER_INTERVAL_DAYS = 7;   // gentle nudge after 7 days idle
const _HOT_STREAK_DAYS = 3;

function _toDateKey(ms) {
  try { return new Date(ms).toISOString().slice(0, 10); }
  catch { return null; }
}

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

/**
 * @param {object} ctx
 * @returns {object}
 */
export function computeScanStreak(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const scans = Array.isArray(c.scanHistory) ? c.scanHistory : [];
    const nowMs = Number.isFinite(c.nowMs) ? c.nowMs : Date.now();
    if (scans.length === 0) {
      return {
        ok: true, currentStreakDays: 0, longestStreakDays: 0,
        lastScanMs: null, isHotStreak: false,
      };
    }

    // Reduce scans to a set of distinct yyyy-mm-dd days.
    const daySet = new Set();
    let lastScanMs = 0;
    for (const s of scans) {
      if (!s) continue;
      const ts = Number(s.createdAt) || Number(s.atMs) || 0;
      if (!ts) continue;
      if (ts > lastScanMs) lastScanMs = ts;
      const k = _toDateKey(ts);
      if (k) daySet.add(k);
    }
    const days = Array.from(daySet).sort();

    // Longest historical streak via single pass.
    let longest = 0, cur = 0, prevDay = null;
    for (const d of days) {
      if (prevDay == null) { cur = 1; }
      else {
        const prevMs = Date.UTC(+prevDay.slice(0,4), +prevDay.slice(5,7)-1, +prevDay.slice(8,10));
        const curMs  = Date.UTC(+d.slice(0,4), +d.slice(5,7)-1, +d.slice(8,10));
        cur = (curMs - prevMs === _DAY) ? cur + 1 : 1;
      }
      if (cur > longest) longest = cur;
      prevDay = d;
    }

    // Current streak — walk BACK from today/yesterday.
    let currentStreakDays = 0;
    const today = _toDateKey(nowMs);
    let cursorMs = Date.UTC(+today.slice(0,4), +today.slice(5,7)-1, +today.slice(8,10));
    for (let i = 0; i < 365; i += 1) {
      const key = _toDateKey(cursorMs);
      if (daySet.has(key)) {
        currentStreakDays += 1;
        cursorMs -= _DAY;
      } else if (currentStreakDays === 0 && i === 0) {
        // Today missing — allow yesterday to count if present
        cursorMs -= _DAY;
      } else {
        break;
      }
    }

    return {
      ok: true,
      currentStreakDays,
      longestStreakDays: longest,
      lastScanMs:        lastScanMs || null,
      isHotStreak:       currentStreakDays >= _HOT_STREAK_DAYS,
    };
  } catch {
    return {
      ok: false, currentStreakDays: 0, longestStreakDays: 0,
      lastScanMs: null, isHotStreak: false,
    };
  }
}

/**
 * Decide whether the surface should show a calm "haven't scanned
 * in a while" reminder. Returns null when no nudge is appropriate.
 */
export function scanReminderDue(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const summary = computeScanStreak(c);
    const nowMs = Number.isFinite(c.nowMs) ? c.nowMs : Date.now();
    if (!summary.lastScanMs) {
      // No scans yet — gentle prompt for the first one.
      return {
        due:     true,
        kind:    'first_scan',
        message: _msg('scan.reminder.firstScan',
          'A quick photo of any plant tells us how to help — try your first scan.'),
      };
    }
    const daysSince = Math.floor((nowMs - summary.lastScanMs) / _DAY);
    if (daysSince >= _REMINDER_INTERVAL_DAYS) {
      return {
        due:     true,
        kind:    'gentle_nudge',
        daysSince,
        message: _msg('scan.reminder.gentleNudge',
          'It has been a few days since your last scan — a fresh photo helps us catch changes early.',
          { daysSince }),
      };
    }
    return { due: false, daysSince };
  } catch { return null; }
}

const _module = { computeScanStreak, scanReminderDue };
export default _module;
