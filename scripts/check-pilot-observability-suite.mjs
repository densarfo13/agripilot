#!/usr/bin/env node
/**
 * check-pilot-observability-suite.mjs — Pilot Observability Suite gate.
 *
 * Locks the 8 new observability runtimes shipped in the pilot
 * analytics + observability wave:
 *   1. FounderDashboardRuntime           (__founderDashboardHealth)
 *   2. PilotRetentionAnalyticsRuntime    (__pilotRetentionAnalyticsHealth)
 *   3. PilotFunnelAnalyticsRuntime       (__pilotFunnelAnalyticsHealth)
 *   4. PilotErrorMonitoringRuntime       (__pilotErrorMonitoringHealth)
 *   5. PilotPerformanceMonitoringRuntime (__pilotPerformanceMonitoringHealth)
 *   6. PilotFeedbackRuntime              (__pilotFeedbackHealth)
 *   7. PilotFieldTestSessionRuntime      (__pilotFieldTestSessionHealth)
 *   8. PilotHealthRuntime                (__pilotHealth) — top composite
 *
 * Plus Founder Dashboard page at /admin/founder-dashboard with
 * admin-only role gating, and App.jsx wires all 8 install fns.
 *
 * Distinct from the existing check-pilot-observability gate (wave-38)
 * which locks a different PilotObservabilityRuntime surface.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];
const read = (rel) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fails.push(`missing: ${rel}`); return ''; }
  return fs.readFileSync(p, 'utf8');
};

const RUNTIMES = [
  {
    file: 'src/runtime/pilotObservability/FounderDashboardRuntime.ts',
    globals: ['__founderDashboardHealth'],
    required: [
      'installFounderDashboardGlobal',
      'computeFounderDashboard',
      'FounderDashboardMetrics',
      'adminOnly: true as const',
      'noFakeMetrics: true as const',
      'noPII: true as const',
      'activeFarmers', 'activeGardeners', 'organizations',
      'scansToday', 'scansThisWeek', 'tasksCompleted',
      'outcomesRecorded', 'followUpScansCompleted',
      'weeklyReviewsGenerated', 'fundingViews',
      'listingsCreated', 'harvestEvents',
    ],
  },
  {
    file: 'src/runtime/pilotObservability/PilotRetentionAnalyticsRuntime.ts',
    globals: ['__pilotRetentionAnalyticsHealth'],
    required: [
      'installPilotRetentionAnalyticsGlobal',
      'computePilotRetention',
      'PilotRetentionMetrics',
      'dailyActiveUsers', 'weeklyActiveUsers', 'monthlyActiveUsers',
      'd1Retention', 'd7Retention', 'd30Retention',
      'noPII: true as const',
      'noFakeRates: true as const',
      'insufficientDataHandled: true as const',
    ],
  },
  {
    file: 'src/runtime/pilotObservability/PilotFunnelAnalyticsRuntime.ts',
    globals: ['__pilotFunnelAnalyticsHealth'],
    required: [
      'installPilotFunnelAnalyticsGlobal',
      'computePilotFunnel',
      'FunnelStage', 'PilotFunnel',
      'biggestDropOffIndex',
      'dropOffFromPrevPct',
      'noFakeStages: true as const',
      'noPII: true as const',
    ],
  },
  {
    file: 'src/runtime/pilotObservability/PilotErrorMonitoringRuntime.ts',
    globals: ['__pilotErrorMonitoringHealth'],
    required: [
      'installPilotErrorMonitoringGlobal',
      'recordPilotError', 'listPilotErrors',
      'PilotErrorKind', 'PilotErrorRecord',
      "'frontend'", "'api'", "'scan'",
      "'notification'", "'localization'", "'offline_sync'",
      'noPII: true as const',
      'sanitizedBeforeWrite: true as const',
      'farroway_pilot_error_log',
    ],
  },
  {
    file: 'src/runtime/pilotObservability/PilotPerformanceMonitoringRuntime.ts',
    globals: ['__pilotPerformanceMonitoringHealth'],
    required: [
      'installPilotPerformanceMonitoringGlobal',
      'recordPilotPerfSample', 'listPerfSamples',
      'PilotPerfMetric', 'PERF_THRESHOLDS_MS',
      "'home_render'", "'task_complete'", "'scan_result'",
      "'notification_open'", "'timeline_load'", "'weekly_review_load'",
      'thresholdsExceeded',
      'noFakeTiming: true as const',
    ],
  },
  {
    file: 'src/runtime/pilotObservability/PilotFeedbackRuntime.ts',
    globals: ['__pilotFeedbackHealth'],
    required: [
      'installPilotFeedbackGlobal',
      'recordPilotFeedback', 'listPilotFeedback',
      'sanitizeFeedbackText',
      'PilotFeedbackArtifact',
      'averageRating',
      'noPII: true as const',
      'sanitizedBeforeWrite: true as const',
      'farroway_pilot_feedback_log',
    ],
  },
  {
    file: 'src/runtime/pilotObservability/PilotFieldTestSessionRuntime.ts',
    globals: ['__pilotFieldTestSessionHealth'],
    required: [
      'installPilotFieldTestSessionGlobal',
      'startFieldSession', 'tickFieldSession',
      'endFieldSession', 'listFieldSessions',
      'PilotFieldSession',
      'abandonmentPoint',
      'mostCommonAbandonmentPoint',
      'noPII: true as const',
      'farroway_pilot_field_sessions',
    ],
  },
  {
    file: 'src/runtime/pilotObservability/PilotHealthRuntime.ts',
    globals: ['__pilotHealth'],
    required: [
      'installPilotHealthGlobal',
      'PilotHealthEnvelope',
      'loginHealthy', 'onboardingHealthy', 'dailyAssistantHealthy',
      'scanHealthy', 'outcomeHealthy', 'notificationHealthy',
      'localizationHealthy', 'fundingHealthy', 'sellHealthy',
      'syncHealthy', 'performanceHealthy', 'reliabilityHealthy',
      'pilotReady',
      'noFakeGreens: true as const',
      '__pilotPerformanceMonitoringHealth',
      '__pilotErrorMonitoringHealth',
    ],
  },
];

for (const rt of RUNTIMES) {
  const src = read(rt.file);
  if (!src) continue;
  for (const g of rt.globals) {
    if (src.indexOf(g) < 0) fails.push(`${rt.file}: missing global "${g}"`);
  }
  for (const k of rt.required) {
    if (src.indexOf(k) < 0) fails.push(`${rt.file}: missing "${k}"`);
  }
}

// Founder Dashboard page.
{
  const f = 'src/pages/FounderDashboardPage.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('founder-dashboard-page') < 0)
      fails.push(`${f}: missing data-testid="founder-dashboard-page"`);
    if (src.indexOf("ALLOWED_ROLES = new Set(['admin'])") < 0)
      fails.push(`${f}: must role-gate to admin only`);
    if (src.indexOf('founder-dashboard-not-allowed') < 0)
      fails.push(`${f}: missing not-allowed branch`);
    if (src.indexOf('__founderDashboardHealth') < 0)
      fails.push(`${f}: must read __founderDashboardHealth`);
  }
}

// App.jsx route + installs.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('/admin/founder-dashboard') < 0)
      fails.push(`${f}: missing /admin/founder-dashboard route`);
    if (src.indexOf('FounderDashboardPage') < 0)
      fails.push(`${f}: must lazy-load FounderDashboardPage`);
    const installs = [
      'installFounderDashboardGlobal',
      'installPilotRetentionAnalyticsGlobal',
      'installPilotFunnelAnalyticsGlobal',
      'installPilotErrorMonitoringGlobal',
      'installPilotPerformanceMonitoringGlobal',
      'installPilotFeedbackGlobal',
      'installPilotFieldTestSessionGlobal',
      'installPilotHealthGlobal',
    ];
    for (const i of installs) {
      if (src.indexOf(i) < 0) fails.push(`${f}: missing "${i}()" install`);
    }
  }
}

if (fails.length) {
  console.error('[check:pilot-observability-suite] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:pilot-observability-suite] OK');
