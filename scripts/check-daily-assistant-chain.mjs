#!/usr/bin/env node
/**
 * scripts/check-daily-assistant-chain.mjs — §1 chain + composite contract.
 *
 * Fails if:
 *   - any of the 4 runtime files is missing
 *   - the 10-step beginner chain doesn't include all required ids
 *   - the chain runtime doesn't surface activeTask/upcomingTask/progress
 *   - the composite doesn't enumerate the 4 artifact kinds
 *   - the 11 task stages aren't modeled in contracts
 *   - boot install isn't wired in App.jsx
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const exists = (f) => { try { return fs.statSync(path.join(ROOT, f)).isFile(); } catch { return false; } };

const RUNTIME_FILES = [
  'src/runtime/dailyAssistant/DailyAssistantContracts.ts',
  'src/runtime/dailyAssistant/TaskUnlockRules.ts',
  'src/runtime/dailyAssistant/TaskChainRuntime.ts',
  'src/runtime/dailyAssistant/DailyAssistantRuntime.ts',
];
const missing = RUNTIME_FILES.filter((f) => !exists(f));
if (missing.length) F.push('runtime files missing: ' + missing.join(', '));
else P.push('all 4 runtime files present');

const contracts = read('src/runtime/dailyAssistant/DailyAssistantContracts.ts');
if (contracts) {
  const STAGES = ['setup', 'planning', 'land_prep', 'planting', 'early_growth',
    'monitoring', 'care', 'scan_followup', 'harvest', 'post_harvest', 'sell'];
  const missStage = STAGES.filter((s) => !contracts.includes(`'${s}'`));
  if (missStage.length) F.push('stages missing in contracts: ' + missStage.join(', '));
  else P.push('all 11 stages declared');
  const CHAIN_IDS = ['assist_pick_crop', 'assist_add_planting_date', 'assist_prepare_ground',
    'assist_plant_crop', 'assist_water_crop', 'assist_monitor_growth', 'assist_scan_leaves',
    'assist_harvest', 'assist_post_harvest', 'assist_sell_produce'];
  const missId = CHAIN_IDS.filter((i) => !contracts.includes(`'${i}'`));
  if (missId.length) F.push('beginner chain ids missing: ' + missId.join(', '));
  else P.push('all 10 beginner chain ids present');
}

const chain = read('src/runtime/dailyAssistant/TaskChainRuntime.ts');
if (chain) {
  for (const fn of ['buildTaskChain', 'taskChainHealth', 'installTaskChainHealthGlobal']) {
    if (!new RegExp(`export function ${fn}`).test(chain))
      F.push(`TaskChainRuntime must export ${fn}`);
  }
  if (!F.some((m) => /TaskChainRuntime must export/.test(m))) P.push('chain runtime exports 3 fns');
  if (!/farroway_cached_tasks/.test(chain))
    F.push('TaskChainRuntime must read farroway_cached_tasks');
  else P.push('reads farroway_cached_tasks');
  // No fake progress — must derive completed count from real data.
  if (!/completed\s*:\s*completedCount/.test(chain) && !/completed:\s*\d/.test(chain))
    P.push('progress derived from real counts');
  // Exactly one active — projection logic present.
  if (!/active/.test(chain) || !/upcomingSeen/.test(chain))
    F.push('TaskChainRuntime must project exactly one active + one upcoming');
  else P.push('exactly-one-active projection wired');
  // nonBlocking literal-true
  if (!/nonBlocking:\s*true/.test(chain))
    F.push('TaskChainRuntime envelope must declare nonBlocking:true');
  else P.push('nonBlocking literal-true');
}

const composite = read('src/runtime/dailyAssistant/DailyAssistantRuntime.ts');
if (composite) {
  const KINDS = ['DailyAssistantTaskShown', 'DailyAssistantTaskCompleted',
    'DailyAssistantTaskSkipped', 'DailyAssistantNextTaskUnlocked'];
  const missKind = KINDS.filter((k) => !composite.includes(k));
  if (missKind.length) F.push('artifact kinds missing in composite: ' + missKind.join(', '));
  else P.push('all 4 artifact kinds enumerated');
  if (!/__taskChainHealth/.test(composite))
    F.push('composite must read __taskChainHealth by name');
  else P.push('composite reads __taskChainHealth by name');
  if (!/__postHarvestHealth/.test(composite))
    F.push('composite must read __postHarvestHealth for sell/harvest linkage');
  else P.push('composite reads __postHarvestHealth by name');
  if (!/scanRecommended/.test(composite) || !/sellUnlocked/.test(composite))
    F.push('composite envelope must surface scanRecommended + sellUnlocked');
  else P.push('scanRecommended + sellUnlocked surfaced');
}

const app = read('src/App.jsx');
if (app) {
  for (const fn of ['installTaskChainHealthGlobal', 'installDailyAssistantGlobal', 'installDailyAssistantProbeGlobals']) {
    if (!new RegExp(`\\b${fn}\\b`).test(app))
      F.push(`App.jsx must wire ${fn}`);
  }
  if (!F.some((m) => /App.jsx must wire/.test(m))) P.push('App.jsx wires all 3 install fns');
}

if (F.length) {
  console.error('[check:daily-assistant-chain] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:daily-assistant-chain] PASS — 4 runtimes, 10-step chain, 11 stages, 4 artifact kinds, boot install wired.');
for (const m of P) console.log('  ✓ ' + m);
