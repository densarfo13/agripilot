#!/usr/bin/env node
/**
 * scripts/check-outcome-intelligence-composite.mjs — outcome-intelligence
 * composite contract. Fails if the composite is missing, doesn't pin the
 * global, lacks any of the 8 spec readiness flags, or could fabricate
 * scores / yield.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const rt = read('src/runtime/outcomes/OutcomeIntelligenceComposite.ts');
if (!rt) F.push('OutcomeIntelligenceComposite.ts: missing');
else {
  if (!/__outcomeIntelligenceHealth/.test(rt))
    F.push('runtime must pin window.__outcomeIntelligenceHealth');
  else P.push('__outcomeIntelligenceHealth pinned');

  // §HEALTH CHECK — the 8 spec flags.
  for (const flag of ['outcomeRuntimeReady', 'outcomeCaptureReady',
    'outcomeScoringReady', 'outcomeArtifactsReady', 'scanOutcomeReady',
    'yieldReady', 'harvestReady', 'fundingReadinessReady']) {
    if (!new RegExp('\\b' + flag + '\\b').test(rt))
      F.push(`envelope must declare ${flag}`);
  }
  if (!F.some((m) => /envelope must declare/.test(m)))
    P.push('all 8 §HEALTH-CHECK flags present');

  // Aggregate verdict + safety constants.
  if (!/outcomeIntelligenceReady/.test(rt))
    F.push('envelope must surface outcomeIntelligenceReady aggregate verdict');
  else P.push('aggregate verdict surfaced');
  if (!/noFakeScores:\s*true/.test(rt))
    F.push('envelope must declare noFakeScores:true literal');
  else P.push('noFakeScores literal-true');
  if (!/noFabricatedYield:\s*true/.test(rt))
    F.push('envelope must declare noFabricatedYield:true literal');
  else P.push('noFabricatedYield literal-true');

  // Composition: must read the canonical source probes by name.
  for (const probe of ['__outcomeHealth', '__outcomeCaptureHealth',
    '__outcomeLearningLoopHealth', '__farmHealthScoreHealth',
    '__yieldReadinessHealth', '__postHarvestHealth', '__fundingHealth',
    '__artifactHealth']) {
    if (!rt.includes(probe))
      F.push(`runtime must compose ${probe} by name`);
  }
  if (!F.some((m) => /must compose/.test(m)))
    P.push('composes 8 source probes by name');

  // No fabrication — must not call random / fetch.
  if (/Math\.random|\bfetch\s*\(/.test(rt))
    F.push('runtime must not fabricate or call the network');
  else P.push('no fabrication, no network');

  // Artifact contract — 4 spec kinds enumerated.
  for (const kind of ['OutcomeRecorded', 'OutcomeImprovementRecorded',
    'OutcomeFollowUpRequested', 'OutcomeLearningSnapshotCreated']) {
    if (!rt.includes(kind))
      F.push(`artifact kind ${kind} must be enumerated`);
  }
  if (!F.some((m) => /artifact kind/.test(m)))
    P.push('4 artifact kinds enumerated');
}

// Boot install wired.
const app = read('src/App.jsx');
if (app && !/installOutcomeIntelligenceCompositeGlobal/.test(app))
  F.push('App.jsx must wire installOutcomeIntelligenceCompositeGlobal in boot');
else if (app) P.push('App.jsx wires installOutcomeIntelligenceCompositeGlobal');

if (F.length) {
  console.error('[check:outcome-intelligence-composite] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:outcome-intelligence-composite] PASS — composite pinned, 8 flags, 8 probes, 4 artifact kinds, no fake scores.');
for (const m of P) console.log('  ✓ ' + m);
