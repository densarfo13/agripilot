/**
 * scanPatternDetection.js — derive before/after + recurrence signals
 * from the device's own scan history.
 *
 *   const pattern = detectScanPattern(currentResult, scanHistory);
 *   if (pattern.previous) {                       // §6 — before/after
 *     showProgressLine(pattern.trend);
 *   }
 *   if (pattern.recurrence.count >= 3) {           // §5 — self-pattern
 *     showRecurrenceHint(pattern.recurrence);
 *   }
 *
 * Why this exists
 * ───────────────
 *   The spec §5 ("regional outbreak intelligence") requires
 *   anonymized server-side aggregation across MANY farms — that
 *   needs an endpoint, a privacy model, and a clustering pipeline
 *   that don't exist yet. We honestly defer the regional half.
 *
 *   What we CAN ship today is the SAME-DEVICE pattern detection:
 *
 *     §6 — before/after: when the farmer rescans the same crop,
 *          compare severity to the prior scan and surface a calm
 *          "improving / worsening / stable" line so the user can
 *          see whether the treatment is working.
 *
 *     §5 (local subset) — when the farmer scans the same issue on
 *          the same crop three or more times inside the lookback
 *          window, surface "you've reported this 3 times in 2
 *          weeks" so the user knows it's a real pattern, not noise.
 *
 *   Both signals come from data we already store via
 *   scanHistoryStore.saveScanUseful — no new endpoints, no privacy
 *   trade-offs.
 *
 * Strict-rule audit
 *   • Pure function. Never throws. Never reads from storage —
 *     the caller passes scanHistory in.
 *   • Returns a stable empty shape when there's no useful signal
 *     so consumers can render conditionally without try/catch.
 *   • Tolerates partial entries (missing crop, missing severity)
 *     — those entries are skipped, not rejected.
 */

// Two-week lookback for recurrence — long enough to catch a real
// pattern, short enough that an issue from last season doesn't
// pollute the signal.
export const PATTERN_THRESHOLDS = Object.freeze({
  LOOKBACK_MS:        14 * 24 * 60 * 60 * 1000,
  RECURRENCE_MIN:     3,
  PROGRESS_LOOKBACK_MS: 60 * 24 * 60 * 60 * 1000,  // 60-day prior-scan window
});

const _SEVERITY_RANK = Object.freeze({ low: 1, medium: 2, high: 3 });

function _parseSeverity(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  if (s.includes('high'))   return 'high';
  if (s.includes('medium') || s.includes('moderate')) return 'medium';
  if (s.includes('low')    || s.includes('mild'))     return 'low';
  return null;
}

function _normCrop(raw) {
  return String(raw || '').toLowerCase().trim() || null;
}

function _normIssue(raw) {
  return String(raw || '').toLowerCase().trim() || null;
}

function _isoTime(iso) {
  if (!iso) return null;
  const t = Date.parse(String(iso));
  return Number.isNaN(t) ? null : t;
}

/**
 * @param {object} currentResult   — fresh scan result (with crop +
 *                                    issue + severity + scanId)
 * @param {Array<object>} scanHistory — entries from scanHistoryStore
 *                                       (oldest → newest order tolerated)
 * @param {object} [options]
 * @param {number} [options.nowMs]  — injection point for tests
 * @returns {{
 *   previous: { id, severity, createdAt, daysAgo } | null,
 *   trend:    'improving'|'worsening'|'stable'|'first_scan',
 *   recurrence: { count: number, sinceDays: number|null, issue: string|null },
 * }}
 */
export function detectScanPattern(currentResult, scanHistory, options = {}) {
  const nowMs = (typeof options.nowMs === 'number') ? options.nowMs : Date.now();
  const cur = (currentResult && typeof currentResult === 'object') ? currentResult : {};
  const dec = (cur.decision && typeof cur.decision === 'object') ? cur.decision : {};
  const history = Array.isArray(scanHistory) ? scanHistory : [];

  const currentCrop  = _normCrop(dec.cropDetected || cur.cropName || cur.crop);
  const currentIssue = _normIssue(dec.issueDetected || cur.possibleIssue || cur.issue);
  const currentSeverity = _parseSeverity(dec.severityTone || cur.severity);
  const currentScanId   = String(cur.scanId || '');

  // Empty default shape — consumers can render conditionally.
  const empty = {
    previous: null,
    trend: 'first_scan',
    recurrence: { count: 0, sinceDays: null, issue: null },
  };

  if (history.length === 0) return empty;

  // Sort newest-first; we'll exclude the current scan itself by id.
  const sorted = history
    .filter((e) => e && e.id && e.id !== currentScanId)
    .filter((e) => _isoTime(e.createdAt) !== null)
    .sort((a, b) => _isoTime(b.createdAt) - _isoTime(a.createdAt));

  if (sorted.length === 0) return empty;

  // ── §6 before/after for same crop ─────────────────────────────
  let previous = null;
  let trend = 'first_scan';
  if (currentCrop) {
    const priorSameCrop = sorted.find((e) => {
      if (_normCrop(e.crop) !== currentCrop) return false;
      const t = _isoTime(e.createdAt);
      return t !== null && (nowMs - t) <= PATTERN_THRESHOLDS.PROGRESS_LOOKBACK_MS;
    });
    if (priorSameCrop) {
      const priorT = _isoTime(priorSameCrop.createdAt);
      const daysAgo = priorT ? Math.max(0, Math.round((nowMs - priorT) / (24 * 60 * 60 * 1000))) : null;
      previous = {
        id:        priorSameCrop.id,
        severity:  _parseSeverity(priorSameCrop.severity),
        createdAt: priorSameCrop.createdAt,
        daysAgo,
      };
      const priorRank = _SEVERITY_RANK[previous.severity] || 0;
      const curRank   = _SEVERITY_RANK[currentSeverity]   || 0;
      if (priorRank && curRank) {
        if (curRank < priorRank)       trend = 'improving';
        else if (curRank > priorRank)  trend = 'worsening';
        else                            trend = 'stable';
      } else {
        trend = 'stable';
      }
    }
  }

  // ── §5 (local) recurrence for same crop + same issue ─────────
  let recurrence = { count: 0, sinceDays: null, issue: null };
  if (currentCrop && currentIssue) {
    const matching = sorted.filter((e) => {
      if (_normCrop(e.crop) !== currentCrop) return false;
      const t = _isoTime(e.createdAt);
      if (t === null) return false;
      if ((nowMs - t) > PATTERN_THRESHOLDS.LOOKBACK_MS) return false;
      const eIssue = _normIssue(e.noticed);
      return eIssue && eIssue === currentIssue;
    });
    // We're counting the CURRENT scan + the matching priors so the
    // user reads "3 times in 2 weeks" inclusively. That matches
    // how a farmer thinks about it ("this is the third time").
    const count = matching.length + 1;
    if (count >= PATTERN_THRESHOLDS.RECURRENCE_MIN && matching.length > 0) {
      const oldestT = _isoTime(matching[matching.length - 1].createdAt);
      const sinceDays = oldestT ? Math.max(1, Math.round((nowMs - oldestT) / (24 * 60 * 60 * 1000))) : null;
      recurrence = {
        count,
        sinceDays,
        issue: currentIssue,
      };
    }
  }

  return { previous, trend, recurrence };
}

export default { detectScanPattern, PATTERN_THRESHOLDS };
