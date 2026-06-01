#!/usr/bin/env node
/**
 * scripts/check-action-context-pages.mjs — §3 ACTION CONTEXT.
 *
 * Fails if the runtime is missing, doesn't compose existing probes by
 * name, or doesn't expose the §3 readiness flags.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const rel = 'src/runtime/actionContext/FarrowayActionContextRuntime.ts';
const src = read(rel);
if (!src) F.push(`${rel}: missing`);
else {
  for (const fn of ['buildActionContext', 'actionContextHealth', 'installActionContextGlobal']) {
    if (!new RegExp(`export function ${fn}`).test(src))
      F.push(`must export ${fn}`);
  }
  if (!F.some((m) => /must export/.test(m))) P.push('3 public fns exported');

  for (const f of ['activeGrowReady', 'topActionReady', 'lifecycleReady',
    'taskLinkReady', 'scanLinkReady', 'harvestLinkReady']) {
    if (!new RegExp(`\\b${f}\\b`).test(src))
      F.push(`envelope must declare ${f}`);
  }
  if (!F.some((m) => /envelope must declare/.test(m))) P.push('all 6 readiness flags present');

  if (!/nonBlocking:\s*true/.test(src))
    F.push('envelope must declare nonBlocking:true');
  else P.push('nonBlocking literal-true');

  for (const probe of ['__dailyFarmPlanHealth', '__cropLifecycleHealth',
    '__growTimeframeHealth', '__postHarvestHealth']) {
    if (!src.includes(probe)) F.push(`runtime must read ${probe} by name`);
  }
  if (!F.some((m) => /by name/.test(m))) P.push('composes 4 source probes by name');

  // The output shape — must include the fields the spec listed
  for (const f of ['activeGrowId', 'cropKey', 'cropName', 'stage', 'topAction',
    'reason', 'nextMilestone', 'harvestWindow', 'sellReadiness',
    'fundingRelevance', 'scanRecommended', 'dataGaps']) {
    if (!new RegExp(`\\b${f}\\b`).test(src))
      F.push(`ActionContext shape must include ${f}`);
  }
  if (!F.some((m) => /shape must include/.test(m))) P.push('ActionContext shape complete');
}

if (F.length) {
  console.error('[check:action-context-pages] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:action-context-pages] PASS — context runtime composes real probes, surfaces all 6 readiness flags.');
for (const m of P) console.log('  ✓ ' + m);
