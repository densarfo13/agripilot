/**
 * timelineHelpers.js — small date + stage-label utilities shared by
 * the crop timeline engine + UI.
 */

/**
 * parseDate — accepts Date, ISO string, or YYYY-MM-DD. Returns a
 * valid Date or null (never throws).
 */
export function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) {
    return Number.isFinite(input.getTime()) ? input : null;
  }
  const d = new Date(input);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * daysBetween — signed whole-day delta (to − from). Anchors at local
 * noon so DST shifts never flip the day. Returns null when either
 * side can't be parsed.
 */
export function daysBetween(from, to) {
  const a = parseDate(from);
  const b = parseDate(to || Date.now());
  if (!a || !b) return null;
  const an = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 12).getTime();
  const bn = new Date(b.getFullYear(), b.getMonth(), b.getDate(), 12).getTime();
  return Math.round((bn - an) / 86400000);
}

/**
 * clamp — numeric clamp with null-safety. Returns null when input is
 * non-finite so UI can hide a field instead of rendering "NaN".
 */
export function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return null;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * totalDuration — sum durationDays across the lifecycle.
 */
export function totalDuration(lifecycle) {
  if (!Array.isArray(lifecycle)) return 0;
  return lifecycle.reduce((acc, s) => acc + (Number(s.durationDays) || 0), 0);
}

/**
 * stageAt — given elapsed days since planting + a lifecycle array,
 * return the index of the stage the crop should be in, the days
 * elapsed within that stage, and the days remaining.
 *
 *   stageAt(32, lifecycle) → { index, daysIntoStage, stageDurationDays, daysRemaining }
 *
 * Overshoot: if elapsed exceeds the total lifecycle duration, we
 * lock onto the final stage (harvest) with daysRemaining = 0.
 */
export function stageAt(elapsedDays, lifecycle) {
  if (!Array.isArray(lifecycle) || lifecycle.length === 0) return null;
  if (!Number.isFinite(elapsedDays) || elapsedDays < 0) elapsedDays = 0;

  let acc = 0;
  for (let i = 0; i < lifecycle.length; i += 1) {
    const dur = Math.max(0, Number(lifecycle[i].durationDays) || 0);
    if (elapsedDays < acc + dur || i === lifecycle.length - 1) {
      const inside = Math.max(0, elapsedDays - acc);
      return {
        index: i,
        daysIntoStage: Math.min(inside, dur),
        stageDurationDays: dur,
        daysRemaining: Math.max(0, Math.round(dur - inside)),
        overshoot: elapsedDays > acc + dur,
      };
    }
    acc += dur;
  }
  // B8 — the for-loop's `i === lifecycle.length - 1` branch always
  // returns on the final iteration, so any code after the loop was
  // unreachable. Returning null here preserves the function's
  // documented contract (caller already null-checks the result)
  // while making the dead-code intent explicit.
  return null;
}

/**
 * humanDays — short friendly copy for "about N days left". Uses
 * rounded buckets so the UI doesn't jitter between days on every
 * refresh.
 */
export function humanDays(n) {
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0)  return { key: 'timeline.days.today',    fallback: 'today' };
  if (n === 1)  return { key: 'timeline.days.tomorrow', fallback: 'about 1 day left' };
  if (n <= 7)   return { key: 'timeline.days.week',     fallback: `about ${n} days left` };
  if (n <= 14)  return { key: 'timeline.days.twoWeeks', fallback: 'about 2 weeks left' };
  if (n <= 30)  return { key: 'timeline.days.month',    fallback: `about ${n} days left` };
  return { key: 'timeline.days.longer', fallback: `about ${n} days left` };
}

export const _internal = Object.freeze({ parseDate, daysBetween, clamp, totalDuration, stageAt, humanDays });
