/**
 * farmProgress.js — surface "things are improving" signals so the
 * farmer SEES progress rather than only seeing problems.
 *
 *   const progress = computeFarmProgress({
 *     scanHistory, scanTasks, healthScore, pattern,
 *   });
 *   // → {
 *   //     completedToday:   number,
 *   //     completedThisWeek: number,
 *   //     recoveryTrend:    'improving' | 'worsening' | 'stable' | 'first_scan',
 *   //     healthBand:       'excellent' | 'good' | 'needs_care' | 'urgent' | null,
 *   //     healthScore:      number | null,
 *   //     positiveSignals:  string[],   // ready-to-render hint lines
 *   //   }
 *
 * Spec §10 — Progress visibility
 * ──────────────────────────────
 *   Farmers should SEE improvement. We surface FOUR honest signals:
 *
 *     • completedToday / completedThisWeek
 *       Count of scan tasks the farmer actually finished — proves
 *       follow-through.
 *
 *     • recoveryTrend
 *       Same-crop scan diff from the pattern detector.
 *
 *     • healthBand / healthScore
 *       The farm-health composite — calm aggregate over all signals.
 *
 *     • positiveSignals[]
 *       A bounded list of one-liners the UI can render as little
 *       wins. We only push a line when the underlying data ACTUALLY
 *       supports it (no celebration when nothing happened).
 *
 *   We DELIBERATELY don't model "yield projection improvement" —
 *   we have no yield data on-device, so any number we showed would
 *   be a fabrication. The spec's "yield projection" item stays
 *   honestly out of scope until real ag-econ data lands.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • All counts default to 0. Trend defaults to 'first_scan'.
 *   • positiveSignals capped at 3 so the UI stays calm.
 */

const _DAY = 24 * 60 * 60 * 1000;

function _isoTime(iso) {
  if (!iso) return null;
  const t = Date.parse(String(iso));
  return Number.isNaN(t) ? null : t;
}

function _startOfDayMs(nowMs) {
  try {
    const d = new Date(nowMs);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  } catch { return nowMs - 12 * 60 * 60 * 1000; }
}

/**
 * @param {object} input
 * @param {Array}  [input.scanHistory]
 * @param {Array}  [input.scanTasks]
 * @param {object} [input.healthScore]
 * @param {object} [input.pattern]
 * @param {number} [input.nowMs]
 * @returns {{
 *   completedToday:    number,
 *   completedThisWeek: number,
 *   recoveryTrend:     'improving'|'worsening'|'stable'|'first_scan',
 *   healthBand:        string|null,
 *   healthScore:       number|null,
 *   positiveSignals:   string[],
 * }}
 */
export function computeFarmProgress(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const nowMs = (typeof safe.nowMs === 'number') ? safe.nowMs : Date.now();
  const startOfToday = _startOfDayMs(nowMs);
  const startOfWeek  = startOfToday - 6 * _DAY;

  const tasks = Array.isArray(safe.scanTasks) ? safe.scanTasks : [];
  let completedToday = 0;
  let completedThisWeek = 0;
  for (const t of tasks) {
    if (!t || !t.completed) continue;
    const at = _isoTime(t.completedAt);
    if (at === null) continue;
    if (at >= startOfToday) completedToday   += 1;
    if (at >= startOfWeek)  completedThisWeek += 1;
  }

  const pattern = (safe.pattern && typeof safe.pattern === 'object') ? safe.pattern : null;
  const recoveryTrend = (pattern && typeof pattern.trend === 'string') ? pattern.trend : 'first_scan';

  const hs = (safe.healthScore && typeof safe.healthScore === 'object') ? safe.healthScore : null;
  const healthBand  = hs && typeof hs.band === 'string'  ? hs.band  : null;
  const healthScore = hs && typeof hs.score === 'number' ? hs.score : null;

  // ── Positive signal composer ─────────────────────────────────
  // Each line is only pushed when the underlying data supports it.
  const positiveSignals = [];

  if (recoveryTrend === 'improving') {
    positiveSignals.push('Your most recent rescan is improving compared to the last one.');
  }
  if (completedToday > 0) {
    positiveSignals.push(`${completedToday} task${completedToday === 1 ? '' : 's'} completed today.`);
  } else if (completedThisWeek > 0) {
    positiveSignals.push(`${completedThisWeek} task${completedThisWeek === 1 ? '' : 's'} completed this week.`);
  }
  if (healthBand === 'excellent') {
    positiveSignals.push(`Farm health score is ${healthScore}/100 — everything on track.`);
  } else if (healthBand === 'good') {
    positiveSignals.push(`Farm health score is ${healthScore}/100 — mostly healthy.`);
  }

  return {
    completedToday,
    completedThisWeek,
    recoveryTrend,
    healthBand,
    healthScore,
    positiveSignals: positiveSignals.slice(0, 3),
  };
}

export default { computeFarmProgress };
