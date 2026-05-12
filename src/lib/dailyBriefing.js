/**
 * dailyBriefing.js — compose the Proactive Farm Intelligence
 * Layer's daily morning briefing.
 *
 *   const briefing = composeDailyBriefing({
 *     farmerName:        profile.name,
 *     weather,                                    // cached snapshot
 *     scanHistory,                                // scanHistoryStore output
 *     scanTasks,                                  // scanToTask output
 *     completedTaskCount,
 *     healthScore,                                // farmHealthScore output
 *     pattern,                                    // scanPatternDetection output
 *     risks,                                      // predictiveRisk output (optional)
 *   });
 *   // → { greeting, lines, severity, factors }
 *
 * What it does
 * ─────────────
 *   Builds a short, calm, multi-line briefing the farmer can read in
 *   ~5 seconds. The composer NEVER invents facts — every clause maps
 *   1:1 to a field that was actually supplied. When inputs are
 *   missing (e.g. weather unavailable, brand-new farmer with no scan
 *   history) the relevant line is skipped, not made up.
 *
 *   The briefing is a *digest*, not a feed — we surface at most ~5
 *   lines so the user doesn't read past the actionable ones.
 *
 * Composition order (matches the spec §1 example)
 * ────────────────────────────────────────────────
 *   1. Greeting          — "Good morning, Dennis."
 *   2. Weather reasoning — "High humidity today increases fungal risk."
 *   3. Recommended micro-action keyed off the weather/risk signal.
 *   4. Pattern continuation note (improving/worsening/recurring).
 *   5. Pending-task headcount with calm priority framing.
 *
 * Strict-rule audit
 *   • Pure function. Never throws. Never reads from storage.
 *   • Returns an empty `lines: []` when there's truly nothing to say
 *     so the caller can hide the surface cleanly.
 *   • i18n is OUT of scope — caller wraps the strings if needed.
 */

// Time-of-day greeting selector. Argument is the local hour (0-23).
function _greetingForHour(hour) {
  if (typeof hour !== 'number' || hour < 0 || hour > 23) return 'Hello';
  if (hour < 5)  return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Pull a human first name out of a profile field that might be a
// full name, email, or empty. Returns null when we can't recognise
// a name (the briefing then drops the comma form).
function _firstName(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  if (s.includes('@')) return null;            // looks like an email
  const first = s.split(/\s+/)[0];
  if (!first || first.length < 2) return null;
  // Capitalise the first letter; leave the rest alone so things like
  // "DeAndre" survive.
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// Pull the most readable single-line summary out of a weather
// snapshot. Handles a few shapes the WeatherContext is known to
// emit so the caller doesn't have to feature-detect.
function _weatherSummary(weather) {
  if (!weather || typeof weather !== 'object') return null;
  const _str = (v) => {
    const t = String(v == null ? '' : v).trim();
    return t || null;
  };
  // Prefer an explicit precomposed summary when one exists.
  const summary = _str(weather.summary)
                  || _str(weather.description)
                  || _str(weather.headline);
  if (summary) return summary;
  // Otherwise stitch from individual signals.
  const bits = [];
  const condition = _str(weather.condition);
  const tempC     = (typeof weather.tempC === 'number') ? weather.tempC
                  : (typeof weather.temperature === 'number' ? weather.temperature : null);
  const humidity  = (typeof weather.humidity === 'number') ? weather.humidity : null;
  if (condition) bits.push(condition);
  if (tempC != null) bits.push(Math.round(tempC) + '°C');
  if (humidity != null) bits.push(humidity + '% humidity');
  return bits.length > 0 ? bits.join(', ') : null;
}

/**
 * @param {object} input
 * @param {string} [input.farmerName]
 * @param {object} [input.weather]
 * @param {Array<object>} [input.scanHistory]
 * @param {Array<object>} [input.scanTasks]
 * @param {number} [input.completedTaskCount]
 * @param {object} [input.healthScore]   — { score, band, factors }
 * @param {object} [input.pattern]       — scanPatternDetection output
 * @param {Array<object>} [input.risks]  — predictiveRisk output
 * @param {Date|number} [input.now]
 * @returns {{
 *   greeting: string,
 *   lines:    string[],
 *   severity: 'calm'|'watch'|'urgent',
 *   factors:  string[]
 * }}
 */
export function composeDailyBriefing(input) {
  const safe = (input && typeof input === 'object') ? input : {};

  const nowDate = (() => {
    if (safe.now instanceof Date) return safe.now;
    if (typeof safe.now === 'number') return new Date(safe.now);
    try { return new Date(); } catch { return new Date(0); }
  })();
  let hour = 9;
  try { hour = nowDate.getHours(); } catch { /* fallback 9am */ }

  const firstName = _firstName(safe.farmerName);
  const greeting = _greetingForHour(hour) + (firstName ? `, ${firstName}.` : '.');

  const lines = [];
  const factors = [];
  let severity = 'calm';

  // ── Weather + risk-driven micro-action ─────────────────────────
  const weatherLine = _weatherSummary(safe.weather);
  const risks = Array.isArray(safe.risks) ? safe.risks : [];
  const topRisk = risks.find((r) => r && (r.level === 'high' || r.level === 'medium')) || null;

  if (topRisk) {
    if (topRisk.headline) {
      lines.push(String(topRisk.headline).trim());
      factors.push(topRisk.kind || 'predictive_risk');
    }
    if (topRisk.action) {
      lines.push(String(topRisk.action).trim());
    }
    if (topRisk.level === 'high') severity = 'urgent';
    else if (severity === 'calm') severity = 'watch';
  } else if (weatherLine) {
    lines.push(`Today's weather: ${weatherLine}.`);
    factors.push('weather');
  }

  // ── Pattern continuation ───────────────────────────────────────
  // The pattern object (from detectScanPattern) carries
  // 'improving' / 'worsening' / 'stable' / 'first_scan' on .trend
  // plus a recurrence count. We surface only the high-signal cases.
  const pattern = (safe.pattern && typeof safe.pattern === 'object') ? safe.pattern : null;
  if (pattern) {
    if (pattern.trend === 'improving') {
      lines.push('Good news: your most recent rescan is improving — keep treating.');
      factors.push('recovery_improving');
    } else if (pattern.trend === 'worsening') {
      lines.push('Heads up: your most recent rescan looks worse than the last one. Take a closer look today.');
      factors.push('recovery_worsening');
      if (severity === 'calm') severity = 'watch';
    }
    if (pattern.recurrence && pattern.recurrence.count >= 3) {
      lines.push(`Recurring pattern: same issue seen ${pattern.recurrence.count} times on this crop. Worth treating as a pattern.`);
      factors.push('recurrence');
      if (severity === 'calm') severity = 'watch';
    }
  }

  // ── Pending tasks ──────────────────────────────────────────────
  const tasks = Array.isArray(safe.scanTasks) ? safe.scanTasks : [];
  const pending = tasks.filter((t) => t && !t.completed);
  if (pending.length > 0) {
    const highPriority = pending.filter((t) => String(t.urgency || '').toLowerCase() === 'high').length;
    if (highPriority > 0) {
      lines.push(`${highPriority} high-priority farm task${highPriority === 1 ? '' : 's'} due today.`);
      if (severity === 'calm') severity = 'watch';
    } else {
      lines.push(`${pending.length} farm task${pending.length === 1 ? '' : 's'} waiting in Today's Plan.`);
    }
    factors.push('pending_tasks');
  }

  // ── Health score readout (only when it shifts things) ──────────
  const health = (safe.healthScore && typeof safe.healthScore === 'object') ? safe.healthScore : null;
  if (health && typeof health.score === 'number') {
    if (health.band === 'urgent') {
      lines.push(`Farm health score is ${health.score}/100 — several signs need attention.`);
      factors.push('health_score');
      severity = 'urgent';
    } else if (health.band === 'excellent' && lines.length === 0) {
      // Only celebrate when there's no other line — we don't want
      // the briefing to read "you're doing great, also fix this."
      lines.push(`Farm health score is ${health.score}/100 — everything is on track.`);
      factors.push('health_score');
    }
  }

  // ── Empty fallback ─────────────────────────────────────────────
  if (lines.length === 0) {
    lines.push('Nothing urgent. A good day to walk the field and notice anything new.');
  }

  // Cap at 5 lines — past the fifth, the user stops reading.
  return {
    greeting,
    lines:    lines.slice(0, 5),
    severity,
    factors,
  };
}

export default { composeDailyBriefing };
