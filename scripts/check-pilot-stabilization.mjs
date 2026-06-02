#!/usr/bin/env node
/**
 * check-pilot-stabilization.mjs — Pilot Stabilization Verdict gate.
 *
 *   • PilotStabilizationVerdictRuntime pins __pilotStabilizationVerdict
 *     with all 9 spec Go-Live checks, the 3-tier verdict ladder
 *     (go / go_with_limitations / no_go), and literal-true safety
 *     constants (noFakeGoVerdicts, noBypassing, architectureFrozen).
 *   • App.jsx wires the install.
 *
 * No new intelligence — pure projection over existing probes. This
 * gate also acts as a freeze marker: the spec mandates "freeze major
 * architecture, no new AI engines" — architectureFrozen literal-true
 * is enforced in the runtime envelope.
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
  const f = 'src/runtime/pilotObservability/PilotStabilizationVerdictRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__pilotStabilizationVerdict',
      'installPilotStabilizationVerdictGlobal',
      'pilotStabilizationVerdict',
      'PilotStabilizationVerdictEnvelope',
      // 9 spec checks.
      'loginWorks', 'onboardingWorks', 'dailyAssistantWorks',
      'scanWorks', 'taskCompletionWorks', 'outcomeCaptureWorks',
      'notificationsWork', 'localizationWorks', 'pilotAnalyticsWork',
      // Aggregate + verdict.
      'passedCount', 'totalChecks: 9 as const',
      'overallVerdict',
      // 3-tier verdict labels.
      "'go'", "'go_with_limitations'", "'no_go'",
      // Honesty.
      'noFakeGoVerdicts: true as const',
      'noBypassing: true as const',
      'architectureFrozen: true as const',
      // Composes existing probes.
      '__authStartupHealth',
      '__scanPilotFreezeHealth',
      '__scanOutcomeLoopHealth',
      '__notificationRuntimeHealth',
      '__pilotHealth',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Verdict ladder must reject 'go' when criticals fail.
    if (src.indexOf('criticalsOk') < 0)
      fails.push(`${f}: must compute criticalsOk and gate 'go' on it`);
  }
}

// 2. App.jsx wires the install.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src && src.indexOf('installPilotStabilizationVerdictGlobal') < 0)
    fails.push(`${f}: missing installPilotStabilizationVerdictGlobal() install`);
}

if (fails.length) {
  console.error('[check:pilot-stabilization] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:pilot-stabilization] OK');
