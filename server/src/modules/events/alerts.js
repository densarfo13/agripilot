/**
 * events/alerts.js — alert-rule evaluator + system-status rollup.
 *
 *   import { buildAlerts, rollupSystemStatus } from './alerts.js';
 *
 *   const m       = await buildMetrics(prisma, opts);
 *   const alerts  = buildAlerts(m);
 *   const status  = rollupSystemStatus(alerts);  // 'green'|'yellow'|'red'
 *
 * Why a separate module
 * ─────────────────────
 *   `buildMetrics` produces NUMBERS. `buildAlerts` consumes those
 *   numbers and produces ACTIONABLE ALERTS — each one tagged with
 *   severity, the affected surface, a one-line description, and a
 *   suggested operator action. Splitting them keeps the metrics
 *   shape stable (the existing dashboard + tests don't move) and
 *   makes the alert-rule additions a one-line edit per rule here.
 *
 * Alert shape
 *   {
 *     id:          string,        // stable id (e.g. 'crashes-red')
 *     severity:    'red' | 'yellow' | 'green',
 *     category:    'crashes' | 'stuck' | 'completion' | … ,
 *     title:       short headline,
 *     description: one-line context (numbers + threshold),
 *     affected:    array<string>, // routes / screens implicated
 *     action:      string,         // operator next step
 *     metric:      number | null,  // raw value the rule fired on
 *     threshold:   number | null,
 *   }
 *
 * Strict-rule audit
 *   • Pure function over a metrics envelope — no I/O.
 *   • Never throws on partial input — missing fields default to
 *     0 / null and the rule simply doesn't fire.
 *   • Every alert carries a stable `id` so the frontend can
 *     dedupe across refreshes (and operators can mute by id
 *     in v2 without breaking existing tests).
 *   • Pure ESM, top-level imports only.
 */

// ─── Thresholds (spec rule §3) ────────────────────────────
//
// Red beats yellow beats green; the rollup picks the worst
// severity present. Numbers are the LOWER bound of each band:
//   < lowerBound → green (rule doesn't fire)
//   ≥ lowerBound → fires at the corresponding severity
const THRESHOLDS = Object.freeze({
  crashesYellow:   1,        // any crash → yellow
  crashesRed:      3,        // ≥ 3 in 24 h → red
  stuckYellow:     1,        // any stuck → yellow
  completionYellow: 0.40,    // < 40 % → yellow
  completionRed:    0.20,    // < 20 % → red
  uploadYellow:    5,        // > 5 / day → yellow
  rateLimitYellow: 5,        // ≥ 5 hits → yellow
  onboardingYellow: 0.60,    // < 60 % → yellow
  onboardingRed:    0.40,    // < 40 % → red
});

// Severity ordering helper used by the rollup.
const SEVERITY_RANK = { green: 0, yellow: 1, red: 2 };

// ─── Suggested actions (spec rule §"Suggested actions examples") ──
//
// Each rule has a stable suggested action. Wording stays short
// (one sentence) so operators can action it without reading a
// novel.
const ACTIONS = Object.freeze({
  crashes:   'Check the most recent deployment + the top error reason. Roll back if regressions are recent.',
  stuck:     'Review the route/state flow on the implicated screen — users can\u2019t get past it.',
  upload:    'Inspect MIME / file-size validation and the magic-byte sniffer logs.',
  rateLimit: 'Inspect for abuse OR a runaway client retry loop. Check `rate_limit_hit` payloads.',
  completionLow:  'Simplify task wording or CTA. The engine\u2019s `task_generated` → `task_completed` ratio is below soft-launch target.',
  onboardingLow:  'Inspect onboarding funnel — users picking a userType but not finishing setup. Audit the FastOnboarding completion path.',
  uploadSpike: 'Spike in upload failures suggests a regression in the upload pipeline OR a broken client build.',
  noDataYet: 'Soak the staging cluster — DAU is 0 in the current window.',
});

/**
 * buildAlerts(metrics) → alerts[]
 *
 * Walks a fixed list of rules. Each rule reads a slice of the
 * metrics envelope and either appends an alert or no-ops.
 * Output is sorted by severity (red first) then by category.
 */
export function buildAlerts(metrics) {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const alerts = [];

  // ─── Rule 1: crashes ────────────────────────────────────
  const crashes = Number(m.appErrors) || 0;
  if (crashes >= THRESHOLDS.crashesRed) {
    alerts.push({
      id:          'crashes-red',
      severity:    'red',
      category:    'crashes',
      title:       'Crash spike',
      description: `${crashes} app_error events in the current window (threshold: ${THRESHOLDS.crashesRed}).`,
      affected:    (m.topErrors || []).slice(0, 3).map((r) => r.key),
      action:      ACTIONS.crashes,
      metric:      crashes,
      threshold:   THRESHOLDS.crashesRed,
    });
  } else if (crashes >= THRESHOLDS.crashesYellow) {
    alerts.push({
      id:          'crashes-yellow',
      severity:    'yellow',
      category:    'crashes',
      title:       'Crash detected',
      description: `${crashes} app_error event(s) in the current window.`,
      affected:    (m.topErrors || []).slice(0, 3).map((r) => r.key),
      action:      ACTIONS.crashes,
      metric:      crashes,
      threshold:   THRESHOLDS.crashesYellow,
    });
  }

  // ─── Rule 2: stuck screens ──────────────────────────────
  const stuck = Number(m.screenStuck) || 0;
  if (stuck >= THRESHOLDS.stuckYellow) {
    alerts.push({
      id:          'stuck-yellow',
      severity:    'yellow',
      category:    'stuck',
      title:       'Users getting stuck',
      description: `${stuck} screen_stuck event(s) — primary CTA didn\u2019t catch a tap within 30 s.`,
      affected:    (m.topStuckRoutes || []).slice(0, 3).map((r) => r.key),
      action:      ACTIONS.stuck,
      metric:      stuck,
      threshold:   THRESHOLDS.stuckYellow,
    });
  }

  // ─── Rule 3: task completion ────────────────────────────
  const completion = (typeof m.completionRate === 'number') ? m.completionRate : null;
  // Skip the rule when there's NO traffic — fires would be noise.
  const hasTaskTraffic = (Number(m.taskViewed) || 0) > 0;
  if (completion != null && hasTaskTraffic) {
    if (completion < THRESHOLDS.completionRed) {
      alerts.push({
        id:          'completion-red',
        severity:    'red',
        category:    'completion',
        title:       'Task completion critical',
        description: `Completion ${(completion * 100).toFixed(1)}% — below ${THRESHOLDS.completionRed * 100}% red line.`,
        affected:    ['/tasks', '/dashboard'],
        action:      ACTIONS.completionLow,
        metric:      completion,
        threshold:   THRESHOLDS.completionRed,
      });
    } else if (completion < THRESHOLDS.completionYellow) {
      alerts.push({
        id:          'completion-yellow',
        severity:    'yellow',
        category:    'completion',
        title:       'Task completion below target',
        description: `Completion ${(completion * 100).toFixed(1)}% — below ${THRESHOLDS.completionYellow * 100}% yellow line.`,
        affected:    ['/tasks', '/dashboard'],
        action:      ACTIONS.completionLow,
        metric:      completion,
        threshold:   THRESHOLDS.completionYellow,
      });
    }
  }

  // ─── Rule 4: upload failures ────────────────────────────
  const uploadFailed   = Number(m.uploadFailed) || 0;
  const photoUploaded  = Number(m.photoUploaded) || 0;
  const uploadFailRate = (photoUploaded + uploadFailed) > 0
    ? uploadFailed / (photoUploaded + uploadFailed) : 0;
  if (uploadFailed > THRESHOLDS.uploadYellow || uploadFailRate > 0.10) {
    alerts.push({
      id:          'upload-yellow',
      severity:    'yellow',
      category:    'upload',
      title:       'Upload failures',
      description: uploadFailed > THRESHOLDS.uploadYellow
        ? `${uploadFailed} upload_failed events (threshold: ${THRESHOLDS.uploadYellow}).`
        : `${(uploadFailRate * 100).toFixed(1)}% of uploads failed (${uploadFailed} of ${photoUploaded + uploadFailed}).`,
      affected:    ['/api/scan/analyze', '/api/farmers/*/photo'],
      action:      ACTIONS.upload,
      metric:      uploadFailed,
      threshold:   THRESHOLDS.uploadYellow,
    });
  }

  // ─── Rule 5: rate-limit spike ───────────────────────────
  const rateLimitHits = Number(m.rateLimitHits) || 0;
  if (rateLimitHits >= THRESHOLDS.rateLimitYellow) {
    alerts.push({
      id:          'ratelimit-yellow',
      severity:    'yellow',
      category:    'rateLimit',
      title:       'API rate-limit spike',
      description: `${rateLimitHits} rate_limit_hit events — limiter rejected the caller.`,
      affected:    ['/api/*'],
      action:      ACTIONS.rateLimit,
      metric:      rateLimitHits,
      threshold:   THRESHOLDS.rateLimitYellow,
    });
  }

  // ─── Rule 6: onboarding drop-off ────────────────────────
  // Numerator: users who FINISHED onboarding (`onboarding_completed`
  // is in the events allow-list and fires when FastOnboarding
  // hands off to /home).
  // Denominator: users who picked a userType (`user_type_selected`).
  // The split below is computed from the metrics envelope's
  // userTypeSplit (sum across categories), which the existing
  // service.buildMetrics already exposes.
  const userTypeStarts = (() => {
    const split = m.userTypeSplit || {};
    return Object.values(split).reduce((sum, n) => sum + (Number(n) || 0), 0);
  })();
  const completed = Number(m.onboardingCompleted);
  if (Number.isFinite(completed) && userTypeStarts > 0) {
    const ratio = completed / userTypeStarts;
    if (ratio < THRESHOLDS.onboardingRed) {
      alerts.push({
        id:          'onboarding-red',
        severity:    'red',
        category:    'onboarding',
        title:       'Onboarding completion critical',
        description: `${(ratio * 100).toFixed(1)}% of new users finish onboarding (${completed} of ${userTypeStarts}). Threshold: ${THRESHOLDS.onboardingRed * 100}%.`,
        affected:    ['/onboarding', '/onboarding/fast'],
        action:      ACTIONS.onboardingLow,
        metric:      ratio,
        threshold:   THRESHOLDS.onboardingRed,
      });
    } else if (ratio < THRESHOLDS.onboardingYellow) {
      alerts.push({
        id:          'onboarding-yellow',
        severity:    'yellow',
        category:    'onboarding',
        title:       'Onboarding drop-off',
        description: `${(ratio * 100).toFixed(1)}% complete onboarding (${completed} of ${userTypeStarts}).`,
        affected:    ['/onboarding', '/onboarding/fast'],
        action:      ACTIONS.onboardingLow,
        metric:      ratio,
        threshold:   THRESHOLDS.onboardingYellow,
      });
    }
  }

  // ─── Rule 7: zero-traffic guard ────────────────────────
  // Surface a green-coded note when DAU is 0 so the operator
  // knows the dashboard ISN'T broken — there just isn't traffic
  // yet. Rendered with a neutral status colour by the dashboard.
  if ((Number(m.dau) || 0) === 0 && (Number(m.sampleSize) || 0) === 0) {
    alerts.push({
      id:          'no-traffic',
      severity:    'green',
      category:    'noTraffic',
      title:       'No traffic in the current window',
      description: 'DAU is 0 and 0 events were aggregated. The dashboard is wired but the cluster is quiet.',
      affected:    [],
      action:      ACTIONS.noDataYet,
      metric:      0,
      threshold:   null,
    });
  }

  // Sort: red > yellow > green; within band, alphabetical by id.
  alerts.sort((a, b) => {
    const s = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
    if (s !== 0) return s;
    return String(a.id).localeCompare(String(b.id));
  });

  return alerts;
}

/**
 * rollupSystemStatus(alerts) → 'green' | 'yellow' | 'red'
 *
 * Picks the worst severity present in the alerts array.
 * Empty array → 'green'. Pure function — no I/O.
 */
export function rollupSystemStatus(alerts) {
  let worst = 0;
  for (const a of (alerts || [])) {
    const r = SEVERITY_RANK[a && a.severity] ?? 0;
    if (r > worst) worst = r;
  }
  switch (worst) {
    case 2: return 'red';
    case 1: return 'yellow';
    default: return 'green';
  }
}

/**
 * topConfusionSignals(metrics) → array<string>
 *
 * Derives the spec's "Top user confusion signals" — the routes
 * that most often trigger BOTH `screen_stuck` and `app_error`
 * in the same window. A purely-rendering signal that the
 * dashboard surfaces alongside the alerts list.
 */
export function topConfusionSignals(metrics, limit = 5) {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const stuckMap  = new Map();
  const errorMap  = new Map();
  for (const r of (m.topStuckRoutes || [])) stuckMap.set(r.key, r.count || 0);
  for (const r of (m.topErrors      || [])) errorMap.set(r.key, r.count || 0);
  const seen = new Set([...stuckMap.keys(), ...errorMap.keys()]);
  const out = [];
  for (const key of seen) {
    const stuckCount = stuckMap.get(key) || 0;
    const errorCount = errorMap.get(key) || 0;
    out.push({
      route: key,
      stuckCount,
      errorCount,
      // Confusion score: stuck-events count more than crashes
      // because the user got there but couldn't progress; a
      // crash usually implies a code regression that the
      // crashes alert already covers.
      score: stuckCount * 2 + errorCount,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

export const _internal = Object.freeze({
  THRESHOLDS,
  SEVERITY_RANK,
  ACTIONS,
});
