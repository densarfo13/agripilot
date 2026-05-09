/**
 * memoryMoment.js — emotional-continuity helper.
 *
 *   import { resolveMemoryMoment } from './lib/memoryMoment.js';
 *
 *   const moment = resolveMemoryMoment({
 *     mode, weather, recentScan, lastTaskCompletedAt, streak,
 *   });
 *   // → { key, fallback, emoji } | null
 *
 * The platform-refinement spec (May 2026 §4 "Emotional continuity")
 * asks Home to remember the user's growing journey and surface
 * SMALL, helpful moments — never a history dashboard. This helper
 * does that decision purely:
 *
 *   • Reads the inputs the page already has (no new fetches, no
 *     new context wiring).
 *   • Returns AT MOST ONE moment per render, with a stable
 *     priority order (recent scan signal → recent weather impact
 *     → care streak milestone) so the same context doesn't
 *     produce a flickering ribbon.
 *   • Returns `null` silently when no signal qualifies — caller
 *     just renders nothing and the page stays calm.
 *
 * Strict-rule audit
 *   * Pure function. Never throws.
 *   * No localStorage access — caller passes data in.
 *   * Output strings are { i18nKey, fallback } pairs so the
 *     renderer can localise via tSafe().
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * HOUR_MS;

function _safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function _hoursSince(timestamp) {
  if (timestamp == null) return null;
  const t = (timestamp instanceof Date) ? timestamp.getTime()
          : (typeof timestamp === 'number') ? timestamp
          : Date.parse(timestamp);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (Date.now() - t) / HOUR_MS);
}

/**
 * resolveMemoryMoment(ctx) → { key, fallback, emoji } | null
 *
 * @param {object} ctx
 * @param {'farm'|'garden'} [ctx.mode='farm']
 * @param {object} [ctx.weather]            Live weather envelope.
 * @param {object} [ctx.recentScan]         { issue?, severity?, daysAgo?, fromMode? }
 * @param {number|string} [ctx.lastTaskCompletedAt]   Timestamp.
 * @param {number} [ctx.streak]             Care streak (days).
 */
export function resolveMemoryMoment(ctx) {
  const c = (ctx && typeof ctx === 'object') ? ctx : {};
  const isGarden = c.mode === 'garden';

  // ── 1. Recent scan signal ─────────────────────────────────────
  // If the last scan flagged something, surface a calm reminder
  // to follow up — never a fear-based diagnosis.
  if (c.recentScan && typeof c.recentScan === 'object') {
    const scan = c.recentScan;
    const daysAgo = _safeNumber(scan.daysAgo);
    const issue   = typeof scan.issue === 'string' ? scan.issue.toLowerCase() : '';
    if (daysAgo != null && daysAgo <= 3 && issue) {
      // Specific yellowing / leaf-issue path.
      if (issue.includes('yellow') || issue.includes('leaf')) {
        return Object.freeze({
          key: isGarden ? 'memory.scanYellowingGarden' : 'memory.scanYellowingFarm',
          fallback: isGarden
            ? 'Your last scan showed yellowing. Check soil moisture today.'
            : 'Your last scan flagged yellowing leaves. Check soil moisture today.',
          emoji: '🌿',
        });
      }
      // Generic recent-scan follow-up.
      return Object.freeze({
        key: isGarden ? 'memory.scanFollowUpGarden' : 'memory.scanFollowUpFarm',
        fallback: isGarden
          ? 'Your last scan suggested a follow-up. Take a closer look today.'
          : 'Your last scan suggested a follow-up. Walk the field today.',
        emoji: '🔍',
      });
    }
  }

  // ── 2. Recent weather impact ──────────────────────────────────
  // Yesterday's rain → drainage check today; yesterday's heat →
  // moisture check today. Reads from the live `weather.condition`
  // + the rain-chance signal as a coarse "did it rain" proxy.
  if (c.weather && typeof c.weather === 'object') {
    const w = c.weather;
    const cond = String(w.condition || '').toLowerCase();
    const rainPct = _safeNumber(w.rainChance);
    const hadRain = cond.includes('rain')
      || (rainPct != null && rainPct >= 60);
    const hadHeat = _safeNumber(w.temp) != null && Number(w.temp) >= 32;
    if (hadRain) {
      return Object.freeze({
        key: isGarden ? 'memory.rainHelpedGarden' : 'memory.rainHelpedFarm',
        fallback: isGarden
          ? 'Rain helped your plants yesterday. Check drainage in the pots today.'
          : 'Rain helped your field yesterday. Check drainage today.',
        emoji: '🌧️',
      });
    }
    if (hadHeat) {
      return Object.freeze({
        key: isGarden ? 'memory.heatYesterdayGarden' : 'memory.heatYesterdayFarm',
        fallback: isGarden
          ? 'Hot day ahead — small pots may dry quickly. Check before noon.'
          : 'Hot day ahead — check field moisture before midday heat.',
        emoji: '☀️',
      });
    }
  }

  // ── 3. Care-streak milestone ──────────────────────────────────
  // Surface only at meaningful breakpoints (3 / 7 / 14 / 30) so
  // the ribbon doesn't fire every day.
  const streak = _safeNumber(c.streak);
  if (streak != null) {
    if ([3, 7, 14, 30].includes(Math.floor(streak))) {
      return Object.freeze({
        key: 'memory.streakMilestone',
        fallback: `${Math.floor(streak)} days of consistent care — keep it going.`,
        emoji: '🌱',
      });
    }
  }

  // ── 4. Last-task recency ──────────────────────────────────────
  // If the user completed a task within the past 18 hours, gently
  // acknowledge it. Quiet bridge between "yesterday" and "today".
  const hoursSinceTask = _hoursSince(c.lastTaskCompletedAt);
  if (hoursSinceTask != null && hoursSinceTask < DAY_MS / HOUR_MS && hoursSinceTask > 1) {
    return Object.freeze({
      key: isGarden ? 'memory.recentTaskGarden' : 'memory.recentTaskFarm',
      fallback: isGarden
        ? 'Yesterday’s care made a difference. Take a look today.'
        : 'Yesterday’s task helped. Walk the field again today.',
      emoji: '✓',
    });
  }

  return null;
}

export default resolveMemoryMoment;
