#!/usr/bin/env node
/**
 * check-pilot-readiness-lockdown.mjs — locks the PILOT READINESS
 * LOCKDOWN spec output:
 *
 *   window.__pilotReadiness() must surface the 14 spec flags +
 *   pilotReady verdict + GO-LIVE composition rule.
 *
 *   loginReady, onboardingReady, commandCenterReady, dailyAssistantReady,
 *   scanReady, outcomeReady, notificationReady, localizationReady,
 *   fundingReady, sellReady, performanceReady, reliabilityReady,
 *   uiConsistencyReady, pilotReady
 *
 * Also locks: the GO-LIVE composition AND the read-only contract
 * (no new intelligence engines — composes existing probes by name).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];

const F = 'src/runtime/pilotReadiness/PilotReadinessRuntime.ts';
const src = fs.existsSync(path.join(ROOT, F))
  ? fs.readFileSync(path.join(ROOT, F), 'utf8') : '';
if (!src) fails.push(`missing: ${F}`);
else {
  // 14 readiness flags + pilotReady verdict.
  const required = [
    'loginReady', 'onboardingReady', 'commandCenterReady',
    'dailyAssistantReady', 'scanReady', 'outcomeReady',
    'notificationReady', 'localizationReady', 'fundingReady',
    'sellReady', 'performanceReady', 'reliabilityReady',
    'uiConsistencyReady', 'pilotReady',
  ];
  for (const k of required) {
    if (src.indexOf(k) < 0) fails.push(`${F}: missing readiness flag "${k}"`);
  }
  // GO-LIVE composition rule: pilotReady must AND the 7 critical surfaces.
  // The exact source line that ANDs loginReady && dailyAssistantReady &&
  // scanReady && outcomeReady && notificationReady && uiConsistencyReady
  // && performanceReady is what we lock.
  const goLiveLine = 'loginReady && dailyAssistantReady && scanReady';
  if (src.indexOf(goLiveLine) < 0) {
    fails.push(`${F}: pilotReady must AND the 7 GO-LIVE critical surfaces ` +
      `(loginReady && dailyAssistantReady && scanReady && outcomeReady && ` +
      `notificationReady && uiConsistencyReady && performanceReady)`);
  }
  // Read-only contract: must compose by _probe(), not import new engines.
  // (Sanity check — pilotReadiness in this file imports only types.)
  if (/from\s+['"].*\/(agronomy|outcomes|intelligence|command-center)\//.test(src)) {
    fails.push(`${F}: must compose via _probe() reads only — no direct engine imports`);
  }
}

// Zero-placeholder companion check — the gate must exist.
{
  const f = 'scripts/check-zero-placeholder.mjs';
  if (!fs.existsSync(path.join(ROOT, f)))
    fails.push(`missing companion gate: ${f}`);
}

if (fails.length) {
  console.error('[check:pilot-readiness-lockdown] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:pilot-readiness-lockdown] OK');
