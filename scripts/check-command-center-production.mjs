#!/usr/bin/env node
/**
 * check-command-center-production.mjs — production-fix gate.
 *
 * Locks the spec-canonical Command Center architecture:
 *   1. 4 files under src/runtime/command-center/ exist with their
 *      key exports (Contracts, Aggregator, Selectors, Runtime).
 *   2. 15 diagnostics flags + 17 state output fields are surfaced.
 *   3. 3 literal-true safety constants
 *      (noFakeData / noFabricatedScores / noPageLocalCalculations).
 *   4. WeeklyFarmReviewRuntime + FieldOfficerCommandCenter present.
 *   5. CommandCenterDeck + FarmStatusCard consume the runtime ONLY
 *      (no direct upstream probe calls).
 *   6. Home / MyFarm / Tasks / Activity / Sell / Scan render the
 *      data-consumes="commandCenter" data-surface="<X>" marker.
 *   7. App.jsx wires installCommandCenterRuntimeGlobal +
 *      installWeeklyFarmReviewGlobal +
 *      installFieldOfficerCommandCenterGlobal.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fails.push(`missing: ${rel}`); return ''; }
  return fs.readFileSync(p, 'utf8');
}

// 1. 4 spec-canonical files.
const f_contracts = 'src/runtime/command-center/CommandCenterContracts.ts';
const f_agg = 'src/runtime/command-center/CommandCenterAggregator.ts';
const f_sel = 'src/runtime/command-center/CommandCenterSelectors.ts';
const f_rt  = 'src/runtime/command-center/CommandCenterRuntime.ts';
const src_contracts = read(f_contracts);
const src_agg = read(f_agg);
const src_sel = read(f_sel);
const src_rt  = read(f_rt);

// Contracts must define every spec type + flag.
{
  const required = [
    // 17 output state fields
    'crop:', 'cropStage', 'farmHealth', 'riskLevel', 'daysToHarvest',
    'todayAction', 'why:', 'estimatedTime', 'nextAction', 'marketDemand',
    'fundingMatches', 'sellReadiness', 'latestOutcome', 'latestScan',
    'progress:', 'confidence:', 'limitations:',
    // 15 diagnostic flags
    'cropReady', 'stageReady', 'healthReady', 'riskReady',
    'actionReady', 'harvestReady', 'fundingReady', 'marketReady',
    'sellReady', 'notificationReady',
    'homeIntegrated', 'tasksIntegrated', 'myFarmIntegrated',
    'scanIntegrated', 'activityIntegrated',
    // Honesty
    'noFakeData', 'noFabricatedScores', 'noPageLocalCalculations',
    'CommandCenterDiagnostics', 'CommandCenterState',
    'GUIDANCE_TAIL', 'COMMAND_CENTER_VERSION', 'COMMAND_CENTER_SURFACES',
  ];
  for (const k of required) {
    if (src_contracts.indexOf(k) < 0) fails.push(`${f_contracts}: missing "${k}"`);
  }
}

// Aggregator must read every spec input + compose them.
{
  const required = [
    'aggregateCommandCenter',
    '__dailyAssistantHealth', '__taskChainHealth',
    '__outcomeHealth', '__outcomeLearningLoopHealth',
    '__agronomyHealth',
    '__scanIntelligenceHealth',
    '__fundingHealth',
    '__postHarvestHealth',
    '__notificationRuntimeHealth',
    '__marketIntelligenceCompositeHealth',
    '__soilIntelligenceHealth',
    '__regionalIntelligenceFieldHealth',
    '__farmRiskHealth', '__farmHealthScoreHealth',
    '__cropLifecycleHealth', '__growTimeframeHealth',
    'AggregatorResult',
  ];
  for (const k of required) {
    if (src_agg.indexOf(k) < 0) fails.push(`${f_agg}: missing "${k}"`);
  }
}

// Selectors must export the canonical reads pages consume.
{
  const required = [
    'selectCrop', 'selectCropStage', 'selectFarmHealth', 'selectRiskLevel',
    'selectDaysToHarvest', 'selectTodayAction', 'selectWhy',
    'selectEstimatedTime', 'selectNextAction', 'selectMarketDemand',
    'selectFundingMatches', 'selectSellReadiness', 'selectLatestOutcome',
    'selectLatestScan', 'selectProgress', 'selectFarmStatus',
    'selectMorningNotification', 'selectFundingTopMatches',
  ];
  for (const k of required) {
    if (src_sel.indexOf(k) < 0) fails.push(`${f_sel}: missing "${k}"`);
  }
}

// Runtime must own __commandCenterHealth + emit 15 diagnostic flags.
{
  const required = [
    '__commandCenterHealth',
    'commandCenterHealth',
    'installCommandCenterRuntimeGlobal',
    'recordCommandCenterIntegration',
    'aggregateCommandCenter',
    // 15 diagnostic flags (mirrors Contracts list)
    'cropReady', 'stageReady', 'healthReady', 'riskReady',
    'actionReady', 'harvestReady', 'fundingReady', 'marketReady',
    'sellReady', 'notificationReady',
    'homeIntegrated', 'tasksIntegrated', 'myFarmIntegrated',
    'scanIntegrated', 'activityIntegrated',
    // Literal-true safety constants.
    'noFakeData: true as const',
    'noFabricatedScores: true as const',
    'noPageLocalCalculations: true as const',
  ];
  for (const k of required) {
    if (src_rt.indexOf(k) < 0) fails.push(`${f_rt}: missing "${k}"`);
  }
}

// 2. WeeklyFarmReview + FieldOfficer present.
{
  const f = 'src/runtime/command-center/WeeklyFarmReviewRuntime.ts';
  const src = read(f);
  const required = [
    '__weeklyFarmReviewHealth', 'installWeeklyFarmReviewGlobal',
    'tasksCompleted', 'scansCompleted', 'outcomesImproved',
    'healthTrend', 'riskTrend', 'nextWeekFocus',
    'noFakeMetrics', 'noFabricatedTrends',
  ];
  for (const k of required) if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
}
{
  const f = 'src/runtime/command-center/FieldOfficerCommandCenter.ts';
  const src = read(f);
  const required = [
    '__fieldOfficerCommandCenterHealth', 'installFieldOfficerCommandCenterGlobal',
    'farmersAssigned', 'highRiskFarms', 'scansPending',
    'outcomesMissing', 'interventionsNeeded',
    'noFakeFieldData', 'noFabricatedSupervisorScores',
  ];
  for (const k of required) if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
}

// 3. Notification helper present + uses CC selectors.
{
  const f = 'src/runtime/command-center/CommandCenterNotifications.ts';
  const src = read(f);
  if (src) {
    if (src.indexOf('selectMorningNotification') < 0)
      fails.push(`${f}: morning notification must read from selectMorningNotification`);
    if (src.indexOf('buildMorningNotificationPayload') < 0)
      fails.push(`${f}: must export buildMorningNotificationPayload`);
  }
}

// 4. Home deck + FarmStatusCard consume runtime ONLY.
function _checkPageConsumer(f, surface, mustHaveImport) {
  const src = read(f);
  if (!src) return;
  // Must carry the data-consumes="commandCenter" data-surface="X" marker.
  if (src.indexOf('data-consumes="commandCenter"') < 0)
    fails.push(`${f}: missing data-consumes="commandCenter"`);
  // Surface marker — Sell uses data-cc-surface (legacy attr name) to
  // coexist with the dailyAssistant marker on the same element; check
  // either form.
  const hasSurface = src.indexOf(`data-surface="${surface}"`) >= 0
    || src.indexOf(`data-cc-surface="${surface}"`) >= 0;
  if (!hasSurface) fails.push(`${f}: missing data-surface="${surface}"`);
  if (mustHaveImport && src.indexOf(mustHaveImport) < 0)
    fails.push(`${f}: missing required import "${mustHaveImport}"`);
  // Pages MUST NOT recompute farm state locally. Forbid direct probes
  // of the upstream globals that the CC composite covers.
  const FORBIDDEN_DIRECT_PROBES = [
    '__agronomyHealth(',
    '__farmRiskHealth(',
    '__farmHealthScoreHealth(',
    '__growTimeframeHealth(',
    '__cropLifecycleHealth(',
    '__marketIntelligenceCompositeHealth(',
  ];
  for (const k of FORBIDDEN_DIRECT_PROBES) {
    if (src.indexOf(k) >= 0)
      fails.push(`${f}: forbidden direct probe "${k}" — consume CC selectors instead`);
  }
}

_checkPageConsumer('src/components/commandCenter/CommandCenterDeck.jsx', 'home',
  'command-center/CommandCenterRuntime');
_checkPageConsumer('src/components/commandCenter/FarmStatusCard.jsx', 'my-farm',
  'command-center/CommandCenterSelectors');

// 5. Page integration markers — Home/Tasks/Activity/Scan/Sell.
{
  const f = 'src/components/simpleMode/SimpleModeHomeSection.jsx';
  const src = read(f);
  if (src && src.indexOf('CommandCenterDeck') < 0)
    fails.push(`${f}: must mount <CommandCenterDeck />`);
}
{
  const f = 'src/pages/MyFarmPage.jsx';
  const src = read(f);
  if (src && src.indexOf('FarmStatusCard') < 0)
    fails.push(`${f}: must mount <FarmStatusCard /> (top of /my-farm)`);
}
{
  const f = 'src/components/simpleMode/SimpleTasks.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('data-consumes="commandCenter"') < 0)
      fails.push(`${f}: Tasks must carry data-consumes="commandCenter"`);
    if (src.indexOf('recordCommandCenterIntegration') < 0)
      fails.push(`${f}: Tasks must call recordCommandCenterIntegration("tasks")`);
  }
}
{
  const f = 'src/pages/FarmerProgressPage.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('data-consumes="commandCenter"') < 0)
      fails.push(`${f}: Activity must carry data-consumes="commandCenter"`);
    if (src.indexOf('recordCommandCenterIntegration') < 0)
      fails.push(`${f}: Activity must call recordCommandCenterIntegration("activity")`);
  }
}
{
  const f = 'src/pages/ScanResultPage.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('data-consumes="commandCenter"') < 0)
      fails.push(`${f}: Scan result must carry data-consumes="commandCenter"`);
    if (src.indexOf('recordCommandCenterIntegration') < 0)
      fails.push(`${f}: Scan result must call recordCommandCenterIntegration("scan")`);
  }
}
{
  const f = 'src/pages/Sell.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('selectSellReadiness') < 0
        && src.indexOf('selectMarketDemand') < 0)
      fails.push(`${f}: Sell must consume selectSellReadiness or selectMarketDemand`);
    if (src.indexOf('recordCommandCenterIntegration') < 0)
      fails.push(`${f}: Sell must call recordCommandCenterIntegration("sell")`);
  }
}

// 6. App.jsx wiring.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    const required = [
      'installCommandCenterRuntimeGlobal',
      'installWeeklyFarmReviewGlobal',
      'installFieldOfficerCommandCenterGlobal',
      'command-center/CommandCenterRuntime',
      'command-center/WeeklyFarmReviewRuntime',
      'command-center/FieldOfficerCommandCenter',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

if (fails.length) {
  console.error('[check:command-center-production] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:command-center-production] OK');
