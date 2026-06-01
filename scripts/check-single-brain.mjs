#!/usr/bin/env node
/**
 * scripts/check-single-brain.mjs — single-brain page contract.
 *
 * Fails if:
 *   - FarrowayBrainHealthRuntime is missing or doesn't pin __farrowayBrainHealth
 *   - the envelope lacks any of the 10 connectivity flags
 *   - the runtime doesn't compose __dailyAssistantHealth + the consumer probe
 *   - Simple Mode renderers (home/tasks) still call buildDailyPlan() — they
 *     must consume buildTaskChain() exclusively (single source of truth)
 *   - the boot install isn't wired in App.jsx
 *
 * This gate locks the single-brain contract: pages that have migrated MUST
 * consume the runtime; pages that haven't are honestly reported as
 * disconnected by the brain health envelope (no fake green).
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rt = read('src/runtime/dailyAssistant/FarrowayBrainHealthRuntime.ts');
if (!rt) F.push('FarrowayBrainHealthRuntime.ts: missing');
else {
  if (!/__farrowayBrainHealth/.test(rt))
    F.push('runtime must pin __farrowayBrainHealth global');
  else P.push('__farrowayBrainHealth pinned');
  for (const flag of ['homeConnected', 'tasksConnected', 'myFarmConnected',
    'activityConnected', 'fundingConnected', 'sellConnected', 'scanConnected',
    'notificationConnected', 'progressConnected', 'voiceConnected']) {
    if (!new RegExp('\\b' + flag + '\\b').test(rt))
      F.push(`envelope must declare ${flag}`);
  }
  if (!F.some((m) => /envelope must declare/.test(m)))
    P.push('all 10 connectivity flags present');
  if (!/singleBrainReady/.test(rt))
    F.push('envelope must surface singleBrainReady aggregate verdict');
  else P.push('singleBrainReady verdict surfaced');
  // Composition must read the canonical probes by name.
  for (const probe of ['__dailyAssistantHealth', '__dailyAssistantConsumerHealth',
    '__taskChainProgressHealth', '__notificationTemplateHealth', '__taskVoiceUIHealth']) {
    if (!rt.includes(probe))
      F.push(`runtime must compose ${probe} by name`);
  }
  if (!F.some((m) => /must compose/.test(m)))
    P.push('composes all 5 source probes by name');
}

// Single-source-of-truth check — Simple Mode home + tasks MUST consume
// buildTaskChain(), not buildDailyPlan(). This is the "no local task state"
// contract — pages that have migrated are gate-locked to the runtime.
const MIGRATED_CONSUMERS = [
  'src/components/simpleMode/SimpleModeHomeSection.jsx',
  'src/components/simpleMode/SimpleTasks.jsx',
];
for (const rel of MIGRATED_CONSUMERS) {
  const body = strip(read(rel));
  if (!body) continue;
  if (/buildDailyPlan\(/.test(body))
    F.push(`${rel}: migrated consumer must NOT call buildDailyPlan() — use buildTaskChain()`);
  if (!/buildTaskChain\(/.test(body))
    F.push(`${rel}: migrated consumer must call buildTaskChain()`);
  if (!/data-consumes=['"]dailyAssistant['"]/.test(body))
    F.push(`${rel}: must carry data-consumes="dailyAssistant" marker`);
}
if (!F.some((m) => /MIGRATED_CONSUMERS|migrated consumer/.test(m)))
  P.push('migrated consumers (home + tasks Simple) consume buildTaskChain exclusively');

// Boot install wired.
const app = read('src/App.jsx');
if (app && !/installFarrowayBrainHealthGlobal/.test(app))
  F.push('App.jsx must wire installFarrowayBrainHealthGlobal in boot');
else if (app) P.push('App.jsx wires installFarrowayBrainHealthGlobal');

if (F.length) {
  console.error('[check:single-brain] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:single-brain] PASS — single-brain composite pinned, 10 connectivity flags, migrated consumers gate-locked.');
for (const m of P) console.log('  ✓ ' + m);
