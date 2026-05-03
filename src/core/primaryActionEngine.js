/**
 * primaryActionEngine.js — composes a single "First-Action Gate"
 * decision for the farmer Home screen (Indispensable Home Loop §2).
 *
 *   import { buildPrimaryAction } from '../core/primaryActionEngine.js';
 *
 *   const action = buildPrimaryAction({
 *     weather:  { humidity, rainExpected, temperatureC },
 *     memory:   getUserMemory(),
 *     insights: globalInsightsArray,   // optional, from /api/insights
 *     context:  { activeExperience: 'garden'|'farm', cropOrPlant, region, growingSetup },
 *   });
 *
 *   // → {
 *   //     primaryActionType: 'no_water'|'check_leaves'|'simple_check'|...,
 *   //     titleKey, titleFallback,
 *   //     detailKey, detailFallback,
 *   //     reasonKey, reasonFallback,        // provenance line
 *   //     consequenceKey, consequenceFallback, // one short line
 *   //     memoryKey?, memoryFallback?,      // 0 or 1 personal line
 *   //     showAreaInsight: boolean,         // "growers in your area …"
 *   //     ctaDoneKey, ctaDoneFallback,      // primary button label
 *   //     tomorrowKey, tomorrowFallback,    // hook shown after Done
 *   //   }
 *
 * Why a separate engine
 * ─────────────────────
 * `dailyPlanEngine.generateDailyPlan` already returns a `priority`
 * string + `tasks[]` array + `riskLevel`. The First-Action Gate
 * sits ABOVE that — it picks ONE micro-action that's actionable
 * in under 60 seconds and frames it with a consequence + memory
 * line. Putting the logic here keeps the existing engine's
 * contract intact (it stays the source of `tasks` / `priority` /
 * `riskLevel`); this module is a thin decision layer on top.
 *
 * Strict rules honoured (per spec):
 *   • Decision language only — no "you may want to" / "consider"
 *   • Max one memory line at a time
 *   • Area-insight line only when confidence ≥ medium (curated tag)
 *   • Garden / farm wording never mixed (uses `activeExperience`)
 *   • Never throws — every defensive read wrapped
 */

import { getConfidenceLabel } from './globalInsightsClient.js';

// ─── Curated decision table ────────────────────────────────
// Each entry is the spec's exact wording. Keys are added to
// translations.js with full 6-language coverage; fallbacks here
// guarantee a sensible English string when a translator hasn't
// shipped a locale yet.
//
// Moisture-driven entries (no_water_moist / check_soil_moist /
// check_early_moist) were added by the Primary Action Intelligence
// upgrade (combined-signal heuristic). They sit ahead of the
// original rain / humidity branches in the decision precedence,
// firing whenever the moisture estimator can produce a confident
// state from `weatherToday` + `weatherYesterday` + `setup`.

const ACTIONS = Object.freeze({
  // ─── Moisture-driven (combined signal) ─────────────────────
  no_water_moist: {
    titleKey:        'primaryAction.noWaterMoist.title',
    titleFallback:   'Do not water today',
    detailKey:       'primaryAction.noWaterMoist.detail',
    detailFallback:  'Soil likely still moist from recent conditions.',
    reasonKey:       'primaryAction.reason.recentRainHumidity',
    reasonFallback:  'Based on recent rain and humidity.',
    consequenceKey:  'primaryAction.consequence.rain',
    consequenceFallback: 'Watering now may harm roots.',
  },
  check_soil_moist: {
    titleKey:        'primaryAction.checkSoilMoist.title',
    titleFallback:   'Check soil before watering',
    detailKey:       'primaryAction.checkSoilMoist.detail',
    detailFallback:  'Soil may still hold moisture.',
    reasonKey:       'primaryAction.reason.humidityConditions',
    reasonFallback:  'Based on humidity and recent conditions.',
    consequenceKey:  'primaryAction.consequence.default',
    consequenceFallback: 'This quick check helps prevent problems early.',
  },
  check_early_moist: {
    titleKey:        'primaryAction.checkEarlyMoist.title',
    titleFallback:   'Check soil early today',
    detailKey:       'primaryAction.checkEarlyMoist.detail',
    detailFallback:  'Warm conditions may dry soil faster.',
    reasonKey:       'primaryAction.reason.tempSetup',
    reasonFallback:  'Based on temperature and your setup.',
    consequenceKey:  'primaryAction.consequence.default',
    consequenceFallback: 'This quick check helps prevent problems early.',
  },
  // ─── Scan follow-up (Ultimate Decision §4) ─────────────────
  // Highest priority — when memory.lastIssueType is set (the
  // most recent scan flagged something), surface a re-check
  // task before any moisture / weather decision.
  scan_followup: {
    titleKey:        'primaryAction.scanFollowup.title',
    titleFallback:   'Check the same leaves again today',
    detailKey:       'primaryAction.scanFollowup.detail',
    detailFallback:  'Look at the leaves you scanned earlier — has it improved or spread?',
    reasonKey:       'primaryAction.reason.recentScan',
    reasonFallback:  'Recent scan showed a possible issue that needs follow-up.',
    consequenceKey:  'primaryAction.consequence.default',
    consequenceFallback: 'This quick check helps prevent problems early.',
  },
  // ─── Behaviour override (water+worse) ──────────────────────
  no_water_behavior: {
    titleKey:        'primaryAction.noWaterBehavior.title',
    titleFallback:   'Do not water today',
    detailKey:       'primaryAction.noWaterBehavior.detail',
    detailFallback:  'Recent watering may be causing stress.',
    reasonKey:       'primaryAction.reason.recentWatering',
    reasonFallback:  'Based on your recent watering and feedback.',
    consequenceKey:  'primaryAction.consequence.rain',
    consequenceFallback: 'Watering now may harm roots.',
  },
  // ─── Original rain-only fallback (kept for back-compat) ────
  no_water: {
    titleKey:        'primaryAction.noWater.title',
    titleFallback:   'Do not water today',
    detailKey:       'primaryAction.noWater.detail',
    detailFallback:  'Rain is expected — overwatering may harm roots.',
    reasonKey:       'primaryAction.reason.weather',
    reasonFallback:  'Based on your location and today\u2019s weather.',
    consequenceKey:  'primaryAction.consequence.rain',
    consequenceFallback: 'Watering now may harm roots.',
  },
  check_leaves_humid: {
    titleKey:        'primaryAction.checkLeaves.title',
    titleFallback:   'Check leaves now',
    detailKey:       'primaryAction.checkLeaves.detail',
    detailFallback:  'High humidity increases leaf spot risk.',
    reasonKey:       'primaryAction.reason.weather',
    reasonFallback:  'Based on your location and today\u2019s weather.',
    consequenceKey:  'primaryAction.consequence.humidity',
    consequenceFallback: 'Skipping this check can lead to leaf spots.',
  },
  simple_check: {
    titleKey:        'primaryAction.simpleCheck.title',
    titleFallback:   'Start with a quick check',
    detailKey:       'primaryAction.simpleCheck.detail',
    detailFallback:  'Inspect leaves for 30 seconds.',
    reasonKey:       'primaryAction.reason.consistency',
    reasonFallback:  'Keep it simple to stay consistent.',
    consequenceKey:  'primaryAction.consequence.default',
    consequenceFallback: 'This quick check helps prevent problems early.',
  },
  garden_default: {
    titleKey:        'primaryAction.gardenDefault.title',
    titleFallback:   'Check soil before watering',
    detailKey:       'primaryAction.gardenDefault.detail',
    detailFallback:  'Only water if the top soil feels dry.',
    reasonKey:       'primaryAction.reason.context',
    reasonFallback:  'Based on your plant and setup.',
    consequenceKey:  'primaryAction.consequence.default',
    consequenceFallback: 'This quick check helps prevent problems early.',
  },
  farm_default: {
    titleKey:        'primaryAction.farmDefault.title',
    titleFallback:   'Check crop leaves today',
    detailKey:       'primaryAction.farmDefault.detail',
    detailFallback:  'Look for spots, holes, insects, or unusual color.',
    reasonKey:       'primaryAction.reason.cropConditions',
    reasonFallback:  'Based on your crop and conditions.',
    consequenceKey:  'primaryAction.consequence.default',
    consequenceFallback: 'This quick check helps prevent problems early.',
  },
  // Optimize First Action Completion (log_cost) — verb-typed
  // action template for the cost-tracking entry point. Spec
  // mapping:
  //   §1 ACTION TEXT          → titleFallback
  //   §2 ADD WHY              → consequenceFallback
  //   §3 MICRO COMMITMENT     → detailFallback
  //   §4 CTA "Log cost ✓"    → CTA_BY_TYPE.log_cost (above)
  //   §5 REWARD               → firstAction.toast.logCost (i18n)
  // The engine emission rule that picks `log_cost` as the active
  // primaryActionType is intentionally NOT wired here — that
  // requires backend cost-storage + a "user has logged 0 costs"
  // signal which is a separate feature. The TEMPLATE lives here
  // so the moment cost-tracking ships, a single one-line rule
  // can switch the engine onto it without copy churn.
  log_cost: {
    titleKey:        'primaryAction.logCost.title',
    titleFallback:   'Log your first cost (30 sec)',
    detailKey:       'primaryAction.logCost.detail',
    detailFallback:  'Just add one cost \u2014 that\u2019s it.',
    reasonKey:       'primaryAction.logCost.reason',
    reasonFallback:  'Tracking your spending.',
    consequenceKey:  'primaryAction.logCost.consequence',
    consequenceFallback: 'Helps you see if you\u2019re making profit.',
  },
});

const CTA_DONE = Object.freeze({
  ctaDoneKey:      'primaryAction.cta.done',
  ctaDoneFallback: 'Done',
});

// Primary Action Clarity §1 + §3 — typed CTA registry. The
// generic "Done" works for inspection-style actions ("Check
// moisture today" → tap "Done ✓"), but action types whose verb
// IS the work (water / log cost / spray) read clearer when the
// CTA mirrors that verb: "Watered ✓", "Log cost ✓", "Sprayed ✓".
//
// Keys are primaryActionType values; values are the i18n key +
// fallback to use INSTEAD of the generic CTA_DONE. Anything
// not in the table falls back to CTA_DONE so existing action
// types keep working unchanged.
//
// Adding a new entry is a one-line change here + an i18n key
// in translations.js. The render path in FirstActionGate is
// already engine-driven; no JSX edits needed.
const CTA_BY_TYPE = Object.freeze({
  water: {
    ctaDoneKey:      'primaryAction.cta.watered',
    ctaDoneFallback: 'Watered',
  },
  spray: {
    ctaDoneKey:      'primaryAction.cta.sprayed',
    ctaDoneFallback: 'Sprayed',
  },
  log_cost: {
    ctaDoneKey:      'primaryAction.cta.logCost',
    ctaDoneFallback: 'Log cost',
  },
  scan: {
    ctaDoneKey:      'primaryAction.cta.scanned',
    ctaDoneFallback: 'Scanned',
  },
});

/**
 * Pick the CTA for an action. Single point of truth so
 * inspection-style actions ("Done") and verb-typed actions
 * ("Watered ✓") share one resolution path.
 */
function _pickCta(primaryActionType) {
  const t = String(primaryActionType || '').toLowerCase();
  return CTA_BY_TYPE[t] || CTA_DONE;
}

const TOMORROW = Object.freeze({
  tomorrowKey:      'primaryAction.tomorrow.hook',
  tomorrowFallback: 'Tomorrow: quick leaf check (30s)',
});

// ─── Urgency derivation (Conversion upgrade §2) ────────────
//
// Spec asks for a small label above the action: "Do this now",
// "Do today", or "This week". Derive from the primaryActionType
// so the engine remains the single source of truth for which
// action gets which urgency.
//
//   now     → high-stakes / time-sensitive (rain expected, scan
//              follow-up, behaviour override, humidity > 70)
//   today   → moisture-driven moderate-stakes (check soil before
//              watering, check soil early in heat)
//   week    → routine baseline (simple check, garden / farm
//              default — no acute signal)
//
// Keys map to firstAction.urgency.{now,today,week}; fallbacks
// match the spec wording verbatim.

const URGENCY_BY_TYPE = Object.freeze({
  scan_followup:      { key: 'firstAction.urgency.now',    fallback: 'Do this now', tier: 'now' },
  no_water_behavior:  { key: 'firstAction.urgency.now',    fallback: 'Do this now', tier: 'now' },
  no_water_moist:     { key: 'firstAction.urgency.now',    fallback: 'Do this now', tier: 'now' },
  no_water:           { key: 'firstAction.urgency.now',    fallback: 'Do this now', tier: 'now' },
  check_leaves_humid: { key: 'firstAction.urgency.now',    fallback: 'Do this now', tier: 'now' },
  check_soil_moist:   { key: 'firstAction.urgency.today',  fallback: 'Do today',    tier: 'today' },
  check_early_moist:  { key: 'firstAction.urgency.today',  fallback: 'Do today',    tier: 'today' },
  simple_check:       { key: 'firstAction.urgency.week',   fallback: 'This week',   tier: 'week' },
  garden_default:     { key: 'firstAction.urgency.week',   fallback: 'This week',   tier: 'week' },
  farm_default:       { key: 'firstAction.urgency.week',   fallback: 'This week',   tier: 'week' },
});

function _urgencyFor(type) {
  return URGENCY_BY_TYPE[type] || URGENCY_BY_TYPE.farm_default;
}

// ─── Daily variation (Dependency System §2) ────────────────
//
// Rotates a small subordinate "day cue" line so the gate doesn't
// look identical two days in a row. The cue is purely cosmetic —
// it says nothing the user can't infer from the action itself —
// but it gives the page texture and reinforces "this is a fresh
// daily check, not a stale page".
//
// Pick is deterministic on day-of-year so all surfaces that
// re-resolve the engine on the same calendar day see the same
// cue (no within-day flicker).
//
// Seven cues — one per slot. Translators ship a localised
// counterpart for each `firstAction.dayCue.{0..6}` key.

const DAY_CUE_COUNT = 7;

function _dayOfYear(now = new Date()) {
  // Days since Jan 1 in the LOCAL timezone — UTC drift would
  // cause a midnight flip earlier than the user's experience.
  const start = new Date(now.getFullYear(), 0, 0);
  const diff  = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60_000);
  return Math.floor(diff / 86_400_000);
}

function _dailyCue() {
  const idx = ((_dayOfYear() % DAY_CUE_COUNT) + DAY_CUE_COUNT) % DAY_CUE_COUNT;
  return {
    key:      `firstAction.dayCue.${idx}`,
    fallback: _DEFAULT_DAY_CUES[idx] || '',
  };
}

const _DEFAULT_DAY_CUES = Object.freeze([
  'Today\u2019s check',
  'A fresh look',
  'Daily snapshot',
  'Quick read',
  'Today\u2019s status',
  'Brief check-in',
  'Today\u2019s update',
]);

// ─── Uncertainty signal (Dependency System §3) ─────────────
//
// Subtle "Conditions may have changed today" line shown ONLY for
// weather-driven actions, where the implication is meaningful.
// Stable phrasing across days; this line is the engine's quiet
// "trust me, recheck" cue.

const _WEATHER_DRIVEN_TYPES = new Set([
  'no_water_moist',
  'no_water',
  'check_soil_moist',
  'check_early_moist',
  'check_leaves_humid',
]);

function _shouldShowUncertainty(type) {
  return _WEATHER_DRIVEN_TYPES.has(type);
}

// ─── Moisture heuristic (Primary Action Intelligence §2) ──
//
// Combined-signal estimator. Rules (per spec):
//
//   rainYesterday OR rainToday          → 'high'
//   humidity > 70                        → 'medium-high'
//   temperature > 28 AND no rain         → 'low'
//   setup === 'container'                → drop one step (containers
//                                          dry faster than ground)
//
// Returns null when none of the inputs is finite — the caller
// falls through to the older rain/humidity branches in
// `buildPrimaryAction` so we never produce a moisture-based
// action from missing data.
//
// "One step down" mapping for containers:
//   high        → medium-high
//   medium-high → medium
//   medium      → low
//   low         → low (floor)
//
// `medium` is an internal-only state that maps to the same
// curated action as `medium-high` (check_soil_moist) — exposed
// here so the heuristic stays composable for future tuning.

const _MOISTURE_LEVELS = Object.freeze(['low', 'medium', 'medium-high', 'high']);

function _stepDown(level) {
  const i = _MOISTURE_LEVELS.indexOf(level);
  if (i <= 0) return 'low';
  return _MOISTURE_LEVELS[i - 1];
}

function _rained(w) {
  if (!w || typeof w !== 'object') return false;
  if (w.rainExpected === true)             return true;   // today's forecast
  if (w.rainedYesterday === true)          return true;   // explicit yesterday flag
  if (w.rainedToday === true)              return true;
  // Fall-back: any precipitation > 0 today or yesterday.
  if (Number(w.precipitationMm) > 0)       return true;
  if (Number(w.precipitationMmYesterday) > 0) return true;
  return false;
}

function _humidityOf(w) {
  if (!w || typeof w !== 'object') return null;
  const h = Number(w.humidity);
  return Number.isFinite(h) ? h : null;
}

function _tempOf(w) {
  if (!w || typeof w !== 'object') return null;
  const t = Number(w.temperatureC ?? w.tempC);
  return Number.isFinite(t) ? t : null;
}

/**
 * estimateSoilMoisture(input) — pure rule-based estimate.
 *
 * @param {{
 *   weatherToday?: object, weatherYesterday?: object,
 *   setup?: 'container'|'raised_bed'|'ground'|'indoor'|'farm'|string,
 *   cropOrPlant?: string,
 * }} input
 * @returns {'high'|'medium-high'|'medium'|'low'|null}
 */
export function estimateSoilMoisture(input = {}) {
  const today     = input.weatherToday     || input.weather || null;
  const yesterday = input.weatherYesterday || null;
  const setup     = String(input.setup || '').toLowerCase();

  const rainedNow   = _rained(today);
  const rainedPrior = _rained(yesterday);
  const humidity    = _humidityOf(today);
  const temp        = _tempOf(today);

  let level;
  if (rainedNow || rainedPrior) {
    level = 'high';
  } else if (Number.isFinite(humidity) && humidity > 70) {
    level = 'medium-high';
  } else if (Number.isFinite(temp) && temp > 28) {
    level = 'low';
  } else if (Number.isFinite(humidity) || Number.isFinite(temp)) {
    // We have weather signal but neither extreme — treat as
    // medium so the engine can ask the user to check rather
    // than silently fall through.
    level = 'medium';
  } else {
    // No usable signal.
    return null;
  }

  // Containers dry faster — drop one step.
  if (setup === 'container' || setup === 'pot' || setup === 'pots') {
    level = _stepDown(level);
  }
  return level;
}

// ─── Memory-line picker (max one) ──────────────────────────
//
// Spec §6: at most ONE personal line. Priority order (only the
// first match renders):
//   • streak >= 3 days       → "checked N days in a row — keep going"
//   • lastFeedback healthy   → "last time, your plant looked healthy"
//   • missed 2+ days         → "let's get back on track with one quick check"

function _pickMemoryLine(memory, opts = {}) {
  if (!memory || typeof memory !== 'object') return null;

  // Reinforcement (Primary Action Intelligence §4): when the
  // user recently SKIPPED watering AND the plant feedback was
  // healthy, surface a positive line tied to that decision.
  // This wins over the existing streak / lastHealthy / backOnTrack
  // priorities because it's tightly coupled to the action being
  // shown ("waiting paid off").
  if (opts.reinforceSkipHealthy === true) {
    return {
      key:      'primaryAction.memory.skippedHealthy',
      fallback: 'Last time you waited, your plant stayed healthy.',
    };
  }

  // Daily Habit Loop §5 (revised) — streak format tightened to
  // "{n}-day streak" per the spec wording. Threshold ≥2 kept
  // so the line fires on the second consecutive day. Still
  // minimal — no exclamation, no progress bar, no badge.
  const streak = Number(memory.currentStreakDays || memory.streak || 0);
  if (Number.isFinite(streak) && streak >= 2) {
    return {
      key:      'primaryAction.memory.streak',
      fallback: `${streak}-day streak`,
      vars:     { count: streak },
    };
  }
  const last = String(memory.lastHealthyFeedback || '').toLowerCase();
  // Dependency System §4 — Trust confirmation. When the user has
  // a track record (≥2 completed actions) AND last feedback was
  // healthy AND they're not on a fresh streak (covered above),
  // surface "Good call — this helped prevent issues" so the user
  // attributes the healthy outcome to their action history.
  // Sits ahead of the generic lastHealthy line so the more
  // specific praise wins when both apply.
  const completedForTrust = Number(memory.completedTasksCount || memory.completedTasks || 0);
  if (completedForTrust >= 2
      && (last === 'looks_healthy' || last === 'yes' || last === 'healthy')) {
    return {
      key:      'primaryAction.memory.goodCall',
      fallback: 'Good call \u2014 this helped prevent issues.',
    };
  }
  if (last === 'looks_healthy' || last === 'yes' || last === 'healthy') {
    return {
      key:      'primaryAction.memory.lastHealthy',
      fallback: 'Last time, your plant looked healthy.',
    };
  }
  const missed    = Number(memory.missedDays || 0);
  const completed = Number(memory.completedTasksCount || memory.completedTasks || 0);

  // Retention §4 — single-day gap returner. User has prior
  // activity history AND was away yesterday. Welcomes them
  // back with a positive consistency cue, sitting between the
  // streak line (≥3 day streak) and the backOnTrack line
  // (multi-day gap, more remedial).
  if (Number.isFinite(missed) && missed === 1 && completed >= 1) {
    return {
      key:      'primaryAction.memory.welcomeBack',
      fallback: 'Back again \u2014 nice consistency.',
    };
  }
  // Daily Habit Loop §7 — multi-day gap. Wording updated to ask
  // the user to do ONE small thing on return ("start with one
  // quick check") instead of nudging them on conditions; the
  // habit-loop spec wants the missed-day prompt to feel light,
  // not remedial.
  if (Number.isFinite(missed) && missed >= 2) {
    return {
      key:      'primaryAction.memory.backOnTrack',
      fallback: 'Let\u2019s get back on track \u2014 start with one quick check',
    };
  }
  return null;
}

// ─── Scan-follow-up detector (Ultimate Decision §4 + risk fix) ──
//
// Two-source signal:
//   1. `recentScans` array (preferred when supplied) — each entry
//      `{ issueType, ts? }`. We honour any `ts` in the past 72h as
//      "fresh"; older entries are filtered out. When ts is missing
//      we trust the order — newest first.
//   2. `memory.lastIssueType` (fallback) — most recent issue with
//      no freshness window today.
//
// Returns:
//   { fresh: boolean,           // any open recent issue at all
//     count: number,             // # of recent issues (drives §10
//                                  "repeated scan issue → high")
//     latest: string|null }      // most recent issue label
//
// Treating empty / 'none' / 'no_issue' / 'unknown' as not-an-issue
// is consistent across both sources.

const SCAN_FRESH_WINDOW_MS = 72 * 60 * 60 * 1000;
const NULL_ISSUE_TOKENS = new Set(['', 'none', 'no_issue', 'unknown', 'healthy']);

function _isMeaningfulIssue(issue) {
  if (typeof issue !== 'string') return false;
  return !NULL_ISSUE_TOKENS.has(issue.trim().toLowerCase());
}

function _readScanSignal(memory, recentScans) {
  const out = { fresh: false, count: 0, latest: null };

  // Source 1: recentScans (preferred — gives us a count + freshness).
  if (Array.isArray(recentScans) && recentScans.length > 0) {
    const cutoff = Date.now() - SCAN_FRESH_WINDOW_MS;
    let count = 0;
    let latest = null;
    for (const s of recentScans) {
      if (!s || typeof s !== 'object') continue;
      const issue = s.issueType || s.disease || s.diagnosis;
      if (!_isMeaningfulIssue(issue)) continue;
      const ts = Number(s.ts || s.timestamp || 0);
      // No timestamp → trust the position (caller orders newest-first).
      if (Number.isFinite(ts) && ts > 0 && ts < cutoff) continue;
      count += 1;
      if (latest == null) latest = String(issue).trim().toLowerCase();
    }
    if (count > 0) {
      out.fresh = true;
      out.count = count;
      out.latest = latest;
      return out;
    }
  }

  // Source 2: memory fallback (no count, no freshness window).
  if (memory && _isMeaningfulIssue(memory.lastIssueType)) {
    out.fresh = true;
    out.count = 1;
    out.latest = String(memory.lastIssueType).trim().toLowerCase();
  }
  return out;
}

// Back-compat wrapper for callers that just want the boolean.
function _hasOpenScanIssue(memory, recentScans) {
  return _readScanSignal(memory, recentScans).fresh;
}

// ─── Crop-specific supporting hint (Ultimate Decision §6) ──
//
// Returns a curated supporting task for known crops. The hint
// is one short imperative line — no chemicals, no dosage. The
// composer (ultimateDecisionEngine) decides whether to surface
// it as a supporting task; the engine itself just exposes the
// curated table.

const _CROP_HINTS = Object.freeze({
  pepper: [
    { key: 'crop.hint.pepper.underside',  fallback: 'Inspect underside of leaves' },
    { key: 'crop.hint.pepper.humidSpots', fallback: 'Watch for leaf spots in humidity', when: 'humid' },
  ],
  tomato: [
    { key: 'crop.hint.tomato.lower',    fallback: 'Check lower leaves for spots' },
    { key: 'crop.hint.tomato.dryLeaves', fallback: 'Avoid wetting leaves when watering' },
  ],
  maize: [
    { key: 'crop.hint.maize.streaks',  fallback: 'Check leaves for streaks, holes, or dry edges' },
  ],
  corn: [
    { key: 'crop.hint.maize.streaks',  fallback: 'Check leaves for streaks, holes, or dry edges' },
  ],
  herbs: [
    { key: 'crop.hint.herbs.overwater', fallback: 'Avoid overwatering' },
    { key: 'crop.hint.herbs.light',     fallback: 'Check light exposure' },
  ],
  basil:    [{ key: 'crop.hint.herbs.light', fallback: 'Check light exposure' }],
  mint:     [{ key: 'crop.hint.herbs.light', fallback: 'Check light exposure' }],
  rosemary: [{ key: 'crop.hint.herbs.overwater', fallback: 'Avoid overwatering' }],
});

/**
 * Get supporting hints for a crop. `weatherFlag` filters
 * conditional hints (e.g. the "humid spots" pepper hint only
 * appears when the moisture estimate or humidity flags humid).
 *
 * @param {string} cropOrPlant
 * @param {{humid?: boolean}} [opts]
 * @returns {Array<{key:string, fallback:string}>}
 */
export function getCropHints(cropOrPlant, opts = {}) {
  if (!cropOrPlant) return [];
  const norm = String(cropOrPlant).trim().toLowerCase().replace(/\s+/g, '_');
  const list = _CROP_HINTS[norm];
  if (!Array.isArray(list)) return [];
  return list.filter((h) => {
    if (!h.when) return true;
    if (h.when === 'humid' && opts.humid === true) return true;
    return false;
  }).map(h => ({ key: h.key, fallback: h.fallback }));
}

// ─── Behaviour signal extractor ────────────────────────────
//
// Reads userMemory + weather to decide:
//   • behaviorOverride: 'no_water_behavior' when "user watered
//     frequently" AND lastFeedback === 'getting_worse'
//   • reinforceSkipHealthy: when "user skipped watering" AND
//     lastFeedback === 'looks_healthy'
//
// "User watered frequently" / "user skipped watering" are
// approximated from the existing `lastWateringAdvice` text +
// completion counters, since userMemory doesn't materialise a
// dedicated counter for these axes today. The proxies are
// conservative: we only flag when the signal is strong enough
// that mis-firing is low-cost.

function _readBehaviorSignal(memory) {
  const out = { behaviorOverride: null, reinforceSkipHealthy: false };
  if (!memory || typeof memory !== 'object') return out;
  const last = String(memory.lastHealthyFeedback || '').toLowerCase();

  // "Watered frequently" proxy: lastWateringAdvice is non-null
  // (a recent watering task was completed) AND the most recent
  // feedback is getting_worse. Override the action.
  const recentlyWatered = !!memory.lastWateringAdvice;
  if (recentlyWatered && (last === 'getting_worse' || last === 'no' || last === 'worse')) {
    out.behaviorOverride = 'no_water_behavior';
    return out;
  }

  // "Skipped watering" proxy: the user has more skipped tasks
  // than completed this period, AND the most recent feedback
  // was healthy. We DON'T override the action here — we just
  // flag the memory line for reinforcement.
  const completed = Number(memory.completedTasksCount || memory.completedTasks || 0);
  const skipped   = Number(memory.skippedTasksCount   || memory.skippedTasks   || 0);
  if (skipped >= 2 && skipped >= completed
      && (last === 'looks_healthy' || last === 'yes' || last === 'healthy')) {
    out.reinforceSkipHealthy = true;
  }
  return out;
}

// ─── Risk boost extractor (§5) ─────────────────────────────
//
// Two independent boosts:
//   • humidity > 75 → add "also check leaves for spots" note
//   • repeated "worse" feedback → escalate to high-risk note.
//     We approximate "repeated" with a single getting_worse
//     plus `skippedTasksCount >= 3` (the persistent-pattern
//     proxy used elsewhere in the engine). Future work: track
//     a worseFeedbackCount in userMemory.

function _readRiskNote(memory, weather, scanSignal) {
  const humidity = _humidityOf(weather);
  const last = String((memory && memory.lastHealthyFeedback) || '').toLowerCase();
  const skipped = Number((memory && (memory.skippedTasksCount || memory.skippedTasks)) || 0);
  const repeatedWorse = (last === 'getting_worse' || last === 'no' || last === 'worse')
                        && skipped >= 3;

  // Risk fix #2: a single "open" scan issue is medium; **two or
  // more** within the freshness window is "repeated" → high.
  // Lifts the proxy off skippedTasksCount (which was an indirect
  // signal) onto the actual scan history when recentScans is
  // supplied. Memory-only callers see count===1 and route to the
  // medium tier — same wording as §5 humidity boost.
  const scanCount = scanSignal && Number.isFinite(scanSignal.count)
    ? scanSignal.count : 0;
  const repeatedScan = scanCount >= 2;

  if (repeatedWorse || repeatedScan) {
    return {
      key:      'primaryAction.riskNote.high',
      fallback: 'High \u2014 follow up closely today.',
      severity: 'high',
    };
  }
  if (Number.isFinite(humidity) && humidity > 75) {
    return {
      key:      'primaryAction.riskNote.checkLeaves',
      fallback: 'Also check leaves for spots.',
      severity: 'medium',
    };
  }
  if (scanCount === 1) {
    return {
      key:      'primaryAction.riskNote.checkLeaves',
      fallback: 'Also check leaves for spots.',
      severity: 'medium',
    };
  }
  return null;
}

// ─── Area-insight gate ─────────────────────────────────────
//
// Show "growers in your area see better results doing this" ONLY
// when the matching insight's confidence is medium or high. The
// confidence band is computed from the row's `shown` count via
// the same thresholds as the server (≥100 high, ≥20 medium).

function _shouldShowAreaInsight(insights, primaryActionType) {
  if (!Array.isArray(insights) || insights.length === 0) return false;
  // Pick the highest-scored insight whose recommendation tag
  // aligns with the chosen action. The mapping is intentionally
  // conservative — only four tags are honoured (matching the
  // server's curated set).
  const tagFor = {
    no_water:           'tag:protectFromRain',
    check_leaves_humid: 'tag:checkLeavesEarlyHumid',
    farm_default:       'tag:keepRoutine',
    garden_default:     'tag:keepRoutine',
    simple_check:       'tag:keepRoutine',
  };
  const wantedTag = tagFor[primaryActionType];
  if (!wantedTag) return false;
  for (const r of insights) {
    if (!r) continue;
    if (r.recommendation !== wantedTag) continue;
    const band = (r.confidence
      || (typeof r.shown === 'number' ? getConfidenceLabel({ shown: r.shown }) : null));
    if (band === 'medium' || band === 'high') return true;
  }
  return false;
}

// ─── Main picker ──────────────────────────────────────────

/**
 * Decide the single primary action. Returns the curated record
 * for that action plus optional memory + area-insight + risk-note
 * flags.
 *
 * Decision precedence (Primary Action Intelligence upgrade):
 *   0. behaviorOverride (water+worse) → no_water_behavior
 *   1. moisture estimator:
 *        moisture === 'high'        → no_water_moist
 *        moisture === 'medium-high' → check_soil_moist
 *        moisture === 'medium'      → check_soil_moist
 *        moisture === 'low'         → check_early_moist
 *   2. rainExpected → no_water (legacy fallback)
 *   3. humidity > 70 → check_leaves_humid (legacy fallback)
 *   4. memory.skipped > memory.completed (and >= 3) → simple_check
 *   5. activeExperience === 'farm' → farm_default
 *   6. else → garden_default
 *
 * Risk boost (§5): when humidity > 75 OR repeated-worse pattern,
 * attach `riskNoteKey/Fallback` and `riskNoteSeverity` to the
 * output. The renderer surfaces it as a single supporting line
 * under the consequence.
 *
 * @param {{
 *   weather?:          object,            // alias for weatherToday
 *   weatherToday?:     object,            // { humidity, rainExpected, temperatureC, precipitationMm }
 *   weatherYesterday?: object,            // same shape; optional
 *   memory?:           object,
 *   recentScans?:      Array,             // [{ issueType, ts? }, ...] newest-first
 *   insights?:         Array,
 *   context?: {
 *     activeExperience?: 'garden'|'farm',
 *     cropOrPlant?:      string,
 *     region?:           string,
 *     growingSetup?:     string,          // 'container'|'raised_bed'|'ground'|'indoor'|'farm'
 *   },
 * }} input
 */
export function buildPrimaryAction(input = {}) {
  const today  = (input.weatherToday     && typeof input.weatherToday     === 'object')
    ? input.weatherToday
    : (input.weather && typeof input.weather === 'object' ? input.weather : {});
  const ystr   = (input.weatherYesterday && typeof input.weatherYesterday === 'object')
    ? input.weatherYesterday
    : null;
  const m      = (input.memory  && typeof input.memory  === 'object') ? input.memory  : {};
  const c      = (input.context && typeof input.context === 'object') ? input.context : {};

  const humidity      = _humidityOf(today);
  const rainExpected  = today.rainExpected === true;
  const completed     = Number(m.completedTasksCount || m.completedTasks || 0);
  const skipped       = Number(m.skippedTasksCount   || m.skippedTasks   || 0);
  const isGarden      = String(c.activeExperience || '').toLowerCase() === 'garden';
  const setup         = String(c.growingSetup || (isGarden ? 'container' : 'farm')).toLowerCase();

  // ─── Combined-signal moisture estimator ───────────────────
  const moisture = estimateSoilMoisture({
    weatherToday:     today,
    weatherYesterday: ystr,
    setup,
    cropOrPlant:      c.cropOrPlant,
  });

  // ─── Behaviour signals (override + reinforce) ─────────────
  const { behaviorOverride, reinforceSkipHealthy } = _readBehaviorSignal(m);

  // ─── Scan signal (for follow-up branch + risk note) ───────
  // Reads recentScans (preferred) or memory.lastIssueType.
  // Returned object: { fresh, count, latest }.
  const scanSignal = _readScanSignal(m, input.recentScans);

  // ─── Decision precedence ──────────────────────────────────
  // Ultimate Decision §2 priority order:
  //   1. urgent scan follow-up    ← NEW (highest)
  //   2. weather risk (behaviour override / moisture / rain)
  //   3. moisture/watering decision
  //   4. crop-specific inspection (delivered via supporting tasks
  //      by the composer; never a primary)
  //   5. routine check
  let key;
  if (scanSignal.fresh) {
    key = 'scan_followup';
  } else if (behaviorOverride) {
    key = behaviorOverride;
  } else if (moisture === 'high') {
    key = 'no_water_moist';
  } else if (moisture === 'medium-high' || moisture === 'medium') {
    key = 'check_soil_moist';
  } else if (moisture === 'low') {
    key = 'check_early_moist';
  } else if (rainExpected) {
    key = 'no_water';
  } else if (Number.isFinite(humidity) && humidity > 70) {
    key = 'check_leaves_humid';
  } else if (skipped > completed && skipped >= 3) {
    key = 'simple_check';
  } else {
    key = isGarden ? 'garden_default' : 'farm_default';
  }

  const action = ACTIONS[key];
  const memoryLine = _pickMemoryLine(m, { reinforceSkipHealthy });
  const showAreaInsight = _shouldShowAreaInsight(input.insights, key);
  const riskNote = _readRiskNote(m, today, scanSignal);

  return {
    primaryActionType:    key,
    moistureLevel:        moisture,                // null when no signal
    // Conversion upgrade §2 — urgency tag.
    urgencyKey:           _urgencyFor(key).key,
    urgencyFallback:      _urgencyFor(key).fallback,
    urgencyTier:          _urgencyFor(key).tier,   // 'now'|'today'|'week'
    // Dependency System §2 — daily-variation cue rotates by
    // day-of-year. Same calendar day → same cue (deterministic).
    dayCueKey:            _dailyCue().key,
    dayCueFallback:       _dailyCue().fallback,
    // Dependency System §3 — quiet "Conditions may have changed
    // today" line for weather-driven actions only. Engine sets
    // a flag; gate reads the curated key with a curated fallback.
    showUncertainty:      _shouldShowUncertainty(key),
    uncertaintyKey:       'firstAction.uncertainty',
    uncertaintyFallback:  'Conditions may have changed today',
    titleKey:             action.titleKey,
    titleFallback:        action.titleFallback,
    detailKey:            action.detailKey,
    detailFallback:       action.detailFallback,
    // `reasonKey` = the spec's `confidenceLine` field. Same
    // string contract; name kept for back-compat with the gate.
    reasonKey:            action.reasonKey,
    reasonFallback:       action.reasonFallback,
    consequenceKey:       action.consequenceKey,
    consequenceFallback:  action.consequenceFallback,
    memoryKey:            memoryLine ? memoryLine.key      : null,
    memoryFallback:       memoryLine ? memoryLine.fallback : null,
    memoryVars:           memoryLine ? memoryLine.vars     : null,
    riskNoteKey:          riskNote ? riskNote.key      : null,
    riskNoteFallback:     riskNote ? riskNote.fallback : null,
    riskNoteSeverity:     riskNote ? riskNote.severity : null,
    showAreaInsight,
    areaInsightKey:       'primaryAction.areaInsight',
    areaInsightFallback:  'Growers in your area see better results doing this.',
    // Primary Action Clarity §1 + §3 — pick the CTA that matches
    // the action verb. Inspection-style actions still resolve to
    // "Done"; typed actions (water / spray / log_cost / scan)
    // get verb-specific labels so the CTA "Log cost ✓" /
    // "Watered ✓" reads as alignment rather than a generic
    // confirmation.
    ...(() => {
      const cta = _pickCta(action.primaryActionType);
      return {
        ctaDoneKey:      cta.ctaDoneKey,
        ctaDoneFallback: cta.ctaDoneFallback,
      };
    })(),
    tomorrowKey:          TOMORROW.tomorrowKey,
    tomorrowFallback:     TOMORROW.tomorrowFallback,
  };
}

/**
 * Spec §4 — exported for callers that want the band without a
 * full insight row (e.g. notificationDecisionEngine).
 */
export function getConfidenceLabelLocal({ shown = 0 } = {}) {
  if (shown >= 100) return 'high';
  if (shown >= 20)  return 'medium';
  return 'low';
}

export const _internal = Object.freeze({
  ACTIONS, CTA_DONE, TOMORROW,
  _pickMemoryLine, _shouldShowAreaInsight,
  _readBehaviorSignal, _readRiskNote,
  _stepDown, _humidityOf, _tempOf, _rained,
  _hasOpenScanIssue, _readScanSignal,
  SCAN_FRESH_WINDOW_MS, NULL_ISSUE_TOKENS,
  _CROP_HINTS,
});
