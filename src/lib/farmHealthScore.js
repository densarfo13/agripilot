/**
 * farmHealthScore.js — pure aggregate "farm health" score in [0, 100].
 *
 *   const { score, band, factors } = computeFarmHealthScore({
 *     scanHistory: getScanUsefulHistory(),
 *     scanTasks:   getActiveScanTasks(),
 *     completedTaskCount,
 *     weatherRisk: { droughtSignal: true },     // optional
 *   });
 *
 * Why this exists (spec §4)
 * ─────────────────────────
 *   The dashboard needs a single calm signal that summarises how
 *   the farm is doing. Not a marketing metric — a real readout
 *   over the data we already have on-device:
 *
 *     • recent disease frequency (last 30 days)
 *     • recent severity mix (low / medium / high)
 *     • pending-task pressure (open scan tasks)
 *     • completion rate (% of scan tasks the farmer finished)
 *     • weather risk (drought / heat-stress signal, when present)
 *     • recovery signal (latest scan severity vs. the one before it
 *                       for the same crop — improving / worsening)
 *
 *   We don't pretend to model crop yield or pest pressure curves —
 *   that's a server-side data pipeline that doesn't exist yet.
 *   This is the honest, on-device aggregate.
 *
 * Score interpretation
 * ────────────────────
 *   85–100  excellent   "Everything is on track"
 *   65–84   good        "Mostly healthy — a couple things to watch"
 *   40–64   needs care  "Some open issues need attention"
 *    0–39   urgent      "Several signs need immediate care"
 *
 * Strict-rule audit
 *   • Pure function. Never throws. Never reads from storage.
 *   • All inputs optional — missing data degrades the confidence,
 *     not the call. A first-time user with zero history gets a
 *     neutral 75 + "Start by scanning your crop" hint.
 *   • Returns the breakdown so the UI can render WHY the score
 *     is what it is — no black-box number.
 */

// ─── Tunables (frozen for tests + future ops adjustment) ─────────

export const HEALTH_THRESHOLDS = Object.freeze({
  RECENT_WINDOW_MS: 30 * 24 * 60 * 60 * 1000,    // 30-day lookback
  NEUTRAL_BASELINE: 75,                            // empty-history score
  BAND_EXCELLENT:   85,
  BAND_GOOD:        65,
  BAND_NEEDS_CARE:  40,
});

// Each severity has a calm penalty — high severity hurts the most.
// Low severity is essentially "we noticed something to check," not
// "your farm is in danger," so its penalty is small.
const _SEVERITY_PENALTY = Object.freeze({
  high:   12,
  medium: 6,
  low:    2,
});

// Per-pending-task penalty caps at 5 tasks (over that, the farmer
// is already overwhelmed and adding more weight doesn't help).
const _PENDING_TASK_PENALTY = 3;
const _PENDING_TASK_CAP = 5;

// Weather risk signals — additive penalty so multiple risks compound.
const _WEATHER_DROUGHT_PENALTY = 8;
const _WEATHER_HEAT_PENALTY    = 6;
const _WEATHER_FLOOD_PENALTY   = 8;

// Recovery bonus / penalty (per crop, comparing the two most recent
// scans). Recovery is a strong positive signal — we boost generously
// so the farmer sees the score climb after acting on guidance.
const _RECOVERY_BONUS_IMPROVED  = 6;
const _RECOVERY_PENALTY_WORSE   = 5;

// Task completion rate bonus — calm reward for following through.
const _COMPLETION_BONUS_MAX = 5;   // at 100% completion

// ─── Helpers ──────────────────────────────────────────────────

const _SEVERITY_RANK = Object.freeze({ low: 1, medium: 2, high: 3 });

function _clamp(n, lo, hi) {
  if (typeof n !== 'number' || Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function _parseSeverity(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  // Map verbose severity tones the engine sometimes emits.
  if (s.includes('high')   || s.includes('urgent'))  return 'high';
  if (s.includes('medium') || s.includes('moderate')) return 'medium';
  if (s.includes('low')    || s.includes('mild'))     return 'low';
  return null;
}

function _isRecent(iso, nowMs, windowMs) {
  if (!iso) return false;
  const t = Date.parse(String(iso));
  if (Number.isNaN(t)) return false;
  return (nowMs - t) <= windowMs;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * @param {object} input
 * @param {Array<object>} [input.scanHistory]   — entries from scanHistoryStore
 * @param {Array<object>} [input.scanTasks]     — active tasks from scanToTask
 * @param {number}        [input.completedTaskCount]  — lifetime completed count
 * @param {object}        [input.weatherRisk]   — { droughtSignal, heatStress, floodSignal }
 * @param {number}        [input.nowMs]         — injection point for tests
 * @returns {{
 *   score:   number,                            // 0..100
 *   band:    'excellent'|'good'|'needs_care'|'urgent',
 *   factors: Array<{ label: string, delta: number }>,
 *   stats:   {
 *     totalScans:      number,
 *     recentScans:     number,
 *     highSeverity:    number,
 *     pendingTasks:    number,
 *     completionRate:  number,                  // 0..1, null when no signal
 *     recoveryTrend:   'improving'|'worsening'|'stable'|null,
 *   }
 * }}
 */
export function computeFarmHealthScore(input) {
  // Tolerate null / undefined / primitive misshapes — the helper is
  // called from the dashboard and must NEVER throw.
  const safe = (input && typeof input === 'object') ? input : {};
  const nowMs = (typeof safe.nowMs === 'number') ? safe.nowMs : Date.now();
  const scanHistory = Array.isArray(safe.scanHistory) ? safe.scanHistory : [];
  const scanTasks   = Array.isArray(safe.scanTasks)   ? safe.scanTasks   : [];
  const weather     = (safe.weatherRisk && typeof safe.weatherRisk === 'object')
    ? safe.weatherRisk : {};

  const factors = [];
  let score = HEALTH_THRESHOLDS.NEUTRAL_BASELINE;

  // Stats accumulators
  const recent = scanHistory.filter((e) => _isRecent(e && e.createdAt, nowMs, HEALTH_THRESHOLDS.RECENT_WINDOW_MS));
  const severityCounts = { high: 0, medium: 0, low: 0 };
  for (const e of recent) {
    const sev = _parseSeverity(e && e.severity);
    if (sev) severityCounts[sev] += 1;
  }

  // ── Disease frequency + severity ─────────────────────────────
  // Each severe scan in the last 30 days drops the score by its
  // configured penalty. Multiple "low" scans compound gently.
  let severityDelta = 0;
  if (severityCounts.high)   severityDelta -= severityCounts.high   * _SEVERITY_PENALTY.high;
  if (severityCounts.medium) severityDelta -= severityCounts.medium * _SEVERITY_PENALTY.medium;
  if (severityCounts.low)    severityDelta -= severityCounts.low    * _SEVERITY_PENALTY.low;
  if (severityDelta !== 0) {
    score += severityDelta;
    factors.push({
      label: 'Recent scans flagged issues',
      delta: severityDelta,
    });
  }

  // ── Pending task pressure ────────────────────────────────────
  const pending = scanTasks.filter((t) => t && !t.completed).length;
  const cappedPending = Math.min(pending, _PENDING_TASK_CAP);
  if (cappedPending > 0) {
    const taskDelta = -(cappedPending * _PENDING_TASK_PENALTY);
    score += taskDelta;
    factors.push({
      label: pending === 1 ? '1 open scan task' : `${pending} open scan tasks`,
      delta: taskDelta,
    });
  }

  // ── Completion-rate bonus ────────────────────────────────────
  const completed = (typeof safe.completedTaskCount === 'number')
    ? Math.max(0, Math.floor(safe.completedTaskCount))
    : 0;
  const totalEverTasks = completed + pending;
  let completionRate = null;
  if (totalEverTasks > 0) {
    completionRate = completed / totalEverTasks;
    const completionDelta = Math.round(completionRate * _COMPLETION_BONUS_MAX);
    if (completionDelta > 0) {
      score += completionDelta;
      factors.push({
        label: 'Task completion streak',
        delta: completionDelta,
      });
    }
  }

  // ── Weather risk ─────────────────────────────────────────────
  let weatherDelta = 0;
  if (weather.droughtSignal === true) weatherDelta -= _WEATHER_DROUGHT_PENALTY;
  if (weather.heatStress    === true) weatherDelta -= _WEATHER_HEAT_PENALTY;
  if (weather.floodSignal   === true) weatherDelta -= _WEATHER_FLOOD_PENALTY;
  if (weatherDelta !== 0) {
    score += weatherDelta;
    factors.push({
      label: 'Weather risk in your area',
      delta: weatherDelta,
    });
  }

  // ── Recovery signal (per-crop two-scan diff, latest crop only) ─
  // We don't loop every crop — we just look at the most-recent scan
  // and its prior scan for the same crop. That gives a calm "are
  // things improving?" signal without overweighting one outlier.
  let recoveryTrend = null;
  if (recent.length >= 2) {
    const sorted = recent
      .slice()
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    const latest = sorted[0];
    const latestCrop = (latest && latest.crop) ? String(latest.crop).toLowerCase() : null;
    if (latestCrop) {
      const prior = sorted.slice(1).find((e) => String(e && e.crop || '').toLowerCase() === latestCrop);
      if (prior) {
        const latestRank = _SEVERITY_RANK[_parseSeverity(latest.severity)] || 0;
        const priorRank  = _SEVERITY_RANK[_parseSeverity(prior.severity)]  || 0;
        if (latestRank && priorRank) {
          if (latestRank < priorRank) {
            recoveryTrend = 'improving';
            score += _RECOVERY_BONUS_IMPROVED;
            factors.push({
              label: `${latest.crop} is improving`,
              delta: _RECOVERY_BONUS_IMPROVED,
            });
          } else if (latestRank > priorRank) {
            recoveryTrend = 'worsening';
            score -= _RECOVERY_PENALTY_WORSE;
            factors.push({
              label: `${latest.crop} severity rising`,
              delta: -_RECOVERY_PENALTY_WORSE,
            });
          } else {
            recoveryTrend = 'stable';
          }
        }
      }
    }
  }

  score = _clamp(Math.round(score), 0, 100);

  // ── Band ─────────────────────────────────────────────────────
  let band;
  if      (score >= HEALTH_THRESHOLDS.BAND_EXCELLENT)  band = 'excellent';
  else if (score >= HEALTH_THRESHOLDS.BAND_GOOD)       band = 'good';
  else if (score >= HEALTH_THRESHOLDS.BAND_NEEDS_CARE) band = 'needs_care';
  else                                                  band = 'urgent';

  return {
    score,
    band,
    factors,
    stats: {
      totalScans:     scanHistory.length,
      recentScans:    recent.length,
      highSeverity:   severityCounts.high,
      pendingTasks:   pending,
      completionRate,
      recoveryTrend,
    },
  };
}

export default { computeFarmHealthScore, HEALTH_THRESHOLDS };
