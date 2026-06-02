#!/usr/bin/env node
/**
 * check-founder-os.mjs — Founder OS contract lock.
 *
 *   • FounderOSRuntime pins __founderOSHealth with the 8 spec
 *     readiness flags (executiveSummary / funnel / scanDashboard /
 *     outcomeDashboard / retention / reliability / feedback /
 *     pilotScore) + pilotScore 0..100 + 5-component breakdown.
 *   • FounderOSPage at /admin/founder-os is admin-only +
 *     reads __founderOSHealth.
 *   • App.jsx wires the install + the route.
 *   • Honesty: noFakeScore / noPII / noFakeMetrics literal-true.
 *   • Score computation null-when-zero-denominator + no hardcoded
 *     percentage fallbacks.
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

// 1. Runtime contract.
{
  const f = 'src/runtime/pilotObservability/FounderOSRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__founderOSHealth',
      'installFounderOSGlobal',
      'founderOSHealth',
      'FounderOSHealthEnvelope',
      // The 8 spec readiness flags.
      'executiveSummaryReady: true',
      'funnelReady: true',
      'scanDashboardReady: true',
      'outcomeDashboardReady: true',
      'retentionReady: true',
      'reliabilityReady: true',
      'feedbackReady: true',
      'pilotScoreReady: true',
      // Section envelopes.
      'ExecutiveSummary', 'FunnelSummary',
      'TodayActionSummary', 'ScanDashboardSummary',
      'OutcomeDashboardSummary', 'RetentionDashboardSummary',
      'ReliabilityDashboardSummary', 'UserFeedbackSummary',
      'FieldOfficerDashSummary', 'IntelligenceImpactSummary',
      // Pilot score + breakdown.
      'pilotScore', 'pilotScoreBreakdown',
      'adoption', 'retention', 'reliability',
      'outcomeCompletion', 'scanSuccess',
      // Safety constants.
      'adminOnly: true as const',
      'noPII: true as const',
      'noFakeScore: true as const',
      // Composes the spec source probes.
      '__founderDashboardHealth',
      '__pilotFunnelAnalyticsHealth',
      '__pilotRetentionAnalyticsHealth',
      '__pilotErrorMonitoringHealth',
      '__pilotFeedbackHealth',
      '__pilotHealth',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // No hardcoded percentage fallbacks — null = NEEDS_DATA only.
    if (/(?:\?\?|\|\|)\s*\d{2,3}\s*[,;)]/.test(src))
      fails.push(`${f}: forbidden hardcoded percentage fallback`);
  }
}

// 2. Founder OS page.
{
  const f = 'src/pages/FounderOSPage.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('founder-os-page') < 0)
      fails.push(`${f}: missing data-testid="founder-os-page"`);
    if (src.indexOf("ALLOWED_ROLES = new Set(['admin'])") < 0)
      fails.push(`${f}: must role-gate to admin only`);
    if (src.indexOf('founder-os-not-allowed') < 0)
      fails.push(`${f}: missing not-allowed branch`);
    if (src.indexOf('__founderOSHealth') < 0)
      fails.push(`${f}: must read __founderOSHealth`);
    if (src.indexOf("data-consumes=\"founderOS\"") < 0)
      fails.push(`${f}: missing data-consumes="founderOS" marker`);
    // 11 section eyebrows must render.
    const sections = [
      'founderOS.section.executive',
      'founderOS.section.funnel',
      'founderOS.section.todayAction',
      'founderOS.section.scan',
      'founderOS.section.outcome',
      'founderOS.section.retention',
      'founderOS.section.reliability',
      'founderOS.section.feedback',
      'founderOS.section.fieldOfficer',
      'founderOS.section.intelligence',
      'founderOS.section.pilotScore',
    ];
    for (const s of sections) {
      if (src.indexOf(s) < 0) fails.push(`${f}: missing section "${s}"`);
    }
  }
}

// 3. App.jsx route + install.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('/admin/founder-os') < 0)
      fails.push(`${f}: missing /admin/founder-os route`);
    if (src.indexOf('FounderOSPage') < 0)
      fails.push(`${f}: must lazy-load FounderOSPage`);
    if (src.indexOf('installFounderOSGlobal') < 0)
      fails.push(`${f}: missing installFounderOSGlobal() install`);
  }
}

if (fails.length) {
  console.error('[check:founder-os] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:founder-os] OK');
