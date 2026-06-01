#!/usr/bin/env node
/**
 * scripts/check-daily-assistant-consumers.mjs — page consumer integration.
 *
 * Fails if:
 *   - DailyAssistantConsumerRuntime missing or doesn't pin the global
 *   - Home / Tasks Simple Mode renderers still consume DailyFarmPlanRuntime
 *     (the migration target was TaskChainRuntime — single source of truth)
 *   - Sell.jsx doesn't react to __dailyAssistantHealth().sellUnlocked
 *   - the consumer envelope is missing the 8 required flags
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// Consumer runtime.
const rt = read('src/runtime/dailyAssistant/DailyAssistantConsumerRuntime.ts');
if (!rt) F.push('DailyAssistantConsumerRuntime.ts: missing');
else {
  for (const flag of ['homeIntegrated', 'tasksIntegrated', 'myFarmIntegrated',
    'activityIntegrated', 'fundingIntegrated', 'sellIntegrated',
    'progressIntegrated', 'voiceIntegrated']) {
    if (!new RegExp('\\b' + flag + '\\b').test(rt))
      F.push(`envelope must declare ${flag}`);
  }
  if (!F.some((m) => /envelope must declare/.test(m)))
    P.push('all 8 consumer flags present in envelope');
  if (!/__dailyAssistantConsumerHealth/.test(rt))
    F.push('runtime must pin __dailyAssistantConsumerHealth global');
  else P.push('__dailyAssistantConsumerHealth pinned');
  if (!/recordConsumerIntegration/.test(rt))
    F.push('runtime must export recordConsumerIntegration helper');
  else P.push('recordConsumerIntegration exported');
  if (!/data-consumes=["\\']dailyAssistant["\\']/.test(rt))
    F.push('runtime must query DOM marker data-consumes="dailyAssistant"');
  else P.push('DOM-marker contract in place');
}

// Home consumer (SimpleModeHomeSection).
const home = read('src/components/simpleMode/SimpleModeHomeSection.jsx');
if (!home) F.push('SimpleModeHomeSection.jsx: missing');
else {
  if (!/TaskChainRuntime/.test(home))
    F.push('SimpleModeHomeSection must consume TaskChainRuntime');
  else P.push('SimpleModeHomeSection consumes TaskChainRuntime');
  if (/buildDailyPlan\(/.test(home))
    F.push('SimpleModeHomeSection must NOT consume buildDailyPlan (migrated to task chain)');
  else P.push('SimpleModeHomeSection no longer consumes daily-plan');
  if (!/data-surface=["\']home["\']/.test(home))
    F.push('SimpleModeHomeSection must mark data-surface="home"');
  else P.push('home surface marker present');
  if (!/recordConsumerIntegration\(\s*['"]home['"]/.test(home))
    F.push('SimpleModeHomeSection must call recordConsumerIntegration("home")');
  else P.push('records home consumer integration on mount');
}

// Tasks consumer (SimpleTasks).
const tasks = read('src/components/simpleMode/SimpleTasks.jsx');
if (!tasks) F.push('SimpleTasks.jsx: missing');
else {
  if (!/TaskChainRuntime/.test(tasks))
    F.push('SimpleTasks must consume TaskChainRuntime');
  else P.push('SimpleTasks consumes TaskChainRuntime');
  if (/buildDailyPlan\(/.test(tasks))
    F.push('SimpleTasks must NOT consume buildDailyPlan (migrated)');
  else P.push('SimpleTasks no longer consumes daily-plan');
  if (!/data-surface=["\']tasks["\']/.test(tasks))
    F.push('SimpleTasks must mark data-surface="tasks"');
  else P.push('tasks surface marker present');
  if (!/recordConsumerIntegration\(\s*['"]tasks['"]/.test(tasks))
    F.push('SimpleTasks must call recordConsumerIntegration("tasks")');
  else P.push('records tasks consumer integration on mount');
}

// Sell consumer.
const sell = read('src/pages/Sell.jsx');
if (!sell) F.push('Sell.jsx: missing');
else {
  if (!/__dailyAssistantHealth/.test(sell))
    F.push('Sell.jsx must read __dailyAssistantHealth() for sellUnlocked');
  else P.push('Sell.jsx reads __dailyAssistantHealth');
  if (!/sellUnlocked/.test(sell))
    F.push('Sell.jsx must surface a sellUnlocked state');
  else P.push('sellUnlocked state surfaced');
  if (!/market\.draftPrompt/.test(sell))
    F.push('Sell.jsx must show draft prompt when harvest not ready (market.draftPrompt)');
  else P.push('draft-prompt copy wired');
  if (!/data-surface=["\']sell["\']/.test(sell))
    F.push('Sell.jsx must mark data-surface="sell"');
  else P.push('sell surface marker present');
  if (!/recordConsumerIntegration\(\s*['"]sell['"]/.test(sell))
    F.push('Sell.jsx must call recordConsumerIntegration("sell")');
  else P.push('records sell consumer integration on mount');
}

// App.jsx boot install.
const app = read('src/App.jsx');
if (!app) F.push('App.jsx: missing');
else if (!/installDailyAssistantConsumerGlobal/.test(app))
  F.push('App.jsx must call installDailyAssistantConsumerGlobal in boot');
else P.push('App.jsx wires installDailyAssistantConsumerGlobal');

if (F.length) {
  console.error('[check:daily-assistant-consumers] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:daily-assistant-consumers] PASS — Home, Tasks, Sell consume the chain runtime; consumer health pinned.');
for (const m of P) console.log('  ✓ ' + m);
