#!/usr/bin/env node
/**
 * check-command-center.mjs — v1 baseline gate (deprecated by
 * check:command-center-production which checks the full spec).
 *
 * After the v2 migration the canonical Command Center owner lives at
 * src/runtime/command-center/CommandCenterRuntime.ts. The legacy
 * src/runtime/commandCenter/ path is a thin re-export shim. This gate
 * now points at the canonical path so the v1 baseline keeps passing.
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

// 1. Runtime contract — read the v2 canonical file. Selectors carry the
// value-field names (crop, stage, etc); Contracts carry the diagnostic
// flag list; Runtime carries the install + safety constants.
{
  const fRt   = 'src/runtime/command-center/CommandCenterRuntime.ts';
  const fSel  = 'src/runtime/command-center/CommandCenterSelectors.ts';
  const fCt   = 'src/runtime/command-center/CommandCenterContracts.ts';
  const srcRt   = read(fRt);
  const srcSel  = read(fSel);
  const srcCt   = read(fCt);
  // Runtime must own the pin + diagnostic flags.
  const rtRequired = [
    '__commandCenterHealth',
    'installCommandCenterRuntimeGlobal',
    'cropReady', 'stageReady', 'healthReady', 'riskReady',
    'actionReady', 'harvestReady', 'fundingReady', 'marketReady',
    'sellReady',
    'noFakeData: true as const',
    'noFabricatedScores: true as const',
    'noPageLocalCalculations: true as const',
  ];
  for (const k of rtRequired) {
    if (srcRt.indexOf(k) < 0) fails.push(`${fRt}: missing "${k}"`);
  }
  // Selectors / Contracts carry value fields.
  const valueFields = [
    'crop', 'cropStage', 'farmHealth', 'riskLevel', 'daysToHarvest',
    'todayAction', 'why', 'estimatedTime', 'nextAction',
    'marketDemand', 'fundingMatches', 'sellReadiness',
    'latestOutcome', 'latestScan', 'progress',
    'confidence', 'limitations',
  ];
  for (const k of valueFields) {
    if (srcCt.indexOf(k) < 0 && srcSel.indexOf(k) < 0) {
      fails.push(`command-center: value field "${k}" missing from Contracts + Selectors`);
    }
  }
  if (srcCt.indexOf('Decision support, not a guarantee') < 0)
    fails.push(`${fCt}: missing limitations tail`);
}

// 2. Home deck component.
{
  const f = 'src/components/commandCenter/CommandCenterDeck.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('command-center/CommandCenterRuntime') < 0
        && src.indexOf('command-center/CommandCenterSelectors') < 0)
      fails.push(`${f}: must consume command-center runtime/selectors`);
    const forbidden = [
      '__agronomyHealth(',
      '__farmRiskHealth(',
      '__farmHealthScoreHealth(',
      '__growTimeframeHealth(',
      '__taskChainHealth(',
      '__cropLifecycleHealth(',
      '__fundingHealth(',
      '__marketIntelligenceCompositeHealth(',
      '__dailyAssistantHealth(',
    ];
    for (const k of forbidden) {
      if (src.indexOf(k) >= 0)
        fails.push(`${f}: forbidden direct probe "${k}" — use selectors instead`);
    }
    // Spec labels still present.
    const labels = [
      'commandCenter.crop', 'commandCenter.stage', 'commandCenter.risk',
      'commandCenter.health', 'commandCenter.daysToHarvest',
      'commandCenter.marketDemand',
    ];
    for (const k of labels) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing i18n label "${k}"`);
    }
    if (src.indexOf('data-consumes="commandCenter"') < 0)
      fails.push(`${f}: missing data-consumes="commandCenter" marker`);
  }
}

// 3. Home mounts the deck.
{
  const f = 'src/components/simpleMode/SimpleModeHomeSection.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('CommandCenterDeck') < 0)
      fails.push(`${f}: Home must mount <CommandCenterDeck />`);
  }
}

// 4. App.jsx wiring (canonical install name).
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('installCommandCenterRuntimeGlobal') < 0)
      fails.push(`${f}: missing installCommandCenterRuntimeGlobal() install`);
  }
}

if (fails.length) {
  console.error('[check:command-center] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:command-center] OK');
