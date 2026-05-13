/**
 * farmHealthStatus.js — calm 3-tone farm health label for the UI.
 *
 *   const status = getFarmHealthStatus(healthScoreOutput);
 *   // → { tone: 'WATCH', label: 'Watch', summary: '…' }
 *
 * Why a separate adapter
 * ──────────────────────
 *   farmHealthScore.computeFarmHealthScore() returns a 0–100 number
 *   with 4 bands (excellent / good / needs_care / urgent) and an
 *   explanatory `factors[]` list. That's the right *engine* shape —
 *   it lets future surfaces sort by score and show breakdown
 *   reasoning when needed.
 *
 *   The Final Gap Closure spec §16 calls for a SIMPLER 3-tone
 *   status on Home: "Stable / Watch / Needs attention. Avoid
 *   complex scores on Home." This adapter is the boundary:
 *
 *     excellent + good   → STABLE
 *     needs_care         → WATCH
 *     urgent             → NEEDS_ATTENTION
 *
 *   Plus a qualitative fallback so callers that don't have the
 *   full numeric score (e.g. Home tile that just knows "any open
 *   high-urgency task?") can still surface the same calm label.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Output NEVER contains the numeric score (pinned by tests).
 *   • Returns null when nothing actionable to surface — caller
 *     hides the block cleanly rather than rendering a placeholder.
 *   • Calm summary uses locked vocabulary — no "critical" /
 *     "dangerous" / "fatal" wording.
 */

export const FARM_HEALTH_TONES = Object.freeze({
  STABLE:           'STABLE',
  WATCH:            'WATCH',
  NEEDS_ATTENTION:  'NEEDS_ATTENTION',
});

const _TONE_LABEL = Object.freeze({
  STABLE:          'Stable',
  WATCH:           'Watch',
  NEEDS_ATTENTION: 'Needs attention',
});

const _TONE_SUMMARY = Object.freeze({
  STABLE:          'Things look on track today.',
  WATCH:           'A couple of signs are worth checking in on.',
  NEEDS_ATTENTION: 'Several signs need your attention today.',
});

// ─── Band → tone mapping ──────────────────────────────────────

const _BAND_TO_TONE = Object.freeze({
  excellent:  FARM_HEALTH_TONES.STABLE,
  good:       FARM_HEALTH_TONES.STABLE,
  needs_care: FARM_HEALTH_TONES.WATCH,
  urgent:     FARM_HEALTH_TONES.NEEDS_ATTENTION,
});

function _safeStr(v) {
  const s = String(v == null ? '' : v).trim();
  return s ? s : null;
}

function _safeLower(v) {
  return _safeStr(v) ? _safeStr(v).toLowerCase() : null;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Map a farmHealthScore output (or a partial qualitative signal
 * bundle) to the calm 3-tone label the UI consumes.
 *
 * @param {object} input
 * @param {string} [input.band]                — from computeFarmHealthScore
 * @param {Array}  [input.factors]
 * @param {object} [input.signals]             — qualitative fallback
 *   @param {number} [input.signals.openHighUrgencyTasks]
 *   @param {number} [input.signals.recentHighSeverityScans]
 *   @param {boolean} [input.signals.weatherFlagged]
 *   @param {string} [input.signals.recoveryTrend]  — 'improving' / 'worsening' / 'stable'
 * @returns {{ tone: string, label: string, summary: string }|null}
 */
export function getFarmHealthStatus(input) {
  const safe = (input && typeof input === 'object') ? input : {};

  // 1. Direct band mapping — when caller passed the full score output.
  const band = _safeLower(safe.band);
  if (band && _BAND_TO_TONE[band]) {
    const tone = _BAND_TO_TONE[band];
    return Object.freeze({
      tone,
      label:   _TONE_LABEL[tone],
      summary: _TONE_SUMMARY[tone],
    });
  }

  // 2. Qualitative fallback — for surfaces that don't compute the
  //    full score, infer the tone from a small bundle of signals.
  const signals = (safe.signals && typeof safe.signals === 'object') ? safe.signals : null;
  if (!signals) return null;

  const openHigh = Math.max(0, Number(signals.openHighUrgencyTasks) || 0);
  const severeScans = Math.max(0, Number(signals.recentHighSeverityScans) || 0);
  const weatherFlagged = signals.weatherFlagged === true;
  const recovery = _safeLower(signals.recoveryTrend);

  // Strongest negative signals → NEEDS_ATTENTION
  if (severeScans >= 2 || openHigh >= 3 || recovery === 'worsening') {
    return Object.freeze({
      tone:    FARM_HEALTH_TONES.NEEDS_ATTENTION,
      label:   _TONE_LABEL.NEEDS_ATTENTION,
      summary: _TONE_SUMMARY.NEEDS_ATTENTION,
    });
  }

  // Mid signals → WATCH
  if (severeScans >= 1 || openHigh >= 1 || weatherFlagged) {
    return Object.freeze({
      tone:    FARM_HEALTH_TONES.WATCH,
      label:   _TONE_LABEL.WATCH,
      summary: _TONE_SUMMARY.WATCH,
    });
  }

  // Calm path → STABLE (only when SOME positive signal exists)
  if (recovery === 'improving' || recovery === 'stable') {
    return Object.freeze({
      tone:    FARM_HEALTH_TONES.STABLE,
      label:   _TONE_LABEL.STABLE,
      summary: _TONE_SUMMARY.STABLE,
    });
  }

  // Nothing actionable → null (caller hides the block)
  return null;
}

/**
 * Whether the status warrants surfacing in the UI. STABLE on a
 * brand-new user is often noise — this helper lets the surface
 * decide whether to render anything.
 *
 * @param {object|null} status   — getFarmHealthStatus() return
 * @returns {boolean}
 */
export function shouldShowHealthStatus(status) {
  if (!status || typeof status !== 'object') return false;
  // STABLE-only surfaces (e.g. a daily "everything's fine" tile)
  // are still allowed to render; the caller decides. This helper
  // just confirms the shape is intact.
  return typeof status.tone === 'string' && status.tone in FARM_HEALTH_TONES;
}

export default {
  FARM_HEALTH_TONES,
  getFarmHealthStatus,
  shouldShowHealthStatus,
};
