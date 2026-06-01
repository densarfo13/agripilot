#!/usr/bin/env node
/**
 * check-command-center.mjs — locks the Command Center contract.
 *
 * Required:
 *   1. src/runtime/commandCenter/CommandCenterRuntime.ts exists, pins
 *      __commandCenterHealth, exposes the 9 spec readiness flags
 *      (commandCenterReady / cropReady / stageReady / riskReady /
 *      actionReady / harvestReady / fundingReady / marketReady /
 *      sellReady) AND the 9 single-source-of-truth value fields.
 *   2. src/components/commandCenter/CommandCenterDeck.jsx exists and
 *      consumes commandCenterHealth() via the runtime (no per-page
 *      probing of __agronomyHealth / __farmRiskHealth / etc.).
 *   3. src/components/simpleMode/SimpleModeHomeSection.jsx mounts
 *      CommandCenterDeck — Home renders the deck.
 *   4. App.jsx wires installCommandCenterGlobal.
 *   5. Honesty: noFakeData / noFabricatedScores / noPageLocalCalculations
 *      literal-true in the runtime.
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

// 1. Runtime contract.
{
  const f = 'src/runtime/commandCenter/CommandCenterRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__commandCenterHealth',
      'installCommandCenterGlobal',
      // 9 readiness flags
      'commandCenterReady',
      'cropReady',
      'stageReady',
      'riskReady',
      'actionReady',
      'harvestReady',
      'fundingReady',
      'marketReady',
      'sellReady',
      // 9 value fields
      'crop:',
      'stage:',
      'risk:',
      'health:',
      'todaysAction',
      'daysToHarvest',
      'fundingMatch',
      'marketDemand',
      'sellReadiness',
      // honesty constants — every score traceable
      'noFakeData',
      'noFabricatedScores',
      'noPageLocalCalculations',
      'composedFrom',
      'confidence',
      'explanation',
      'limitations',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    if (src.indexOf('Decision support, not a guarantee') < 0)
      fails.push(`${f}: missing limitations tail`);
    // Spec output contract: the literal-true safety constants must be present.
    const litTrue = [
      'noFakeData: true as const',
      'noFabricatedScores: true as const',
      'noPageLocalCalculations: true as const',
    ];
    for (const k of litTrue) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing literal-true "${k}"`);
    }
  }
}

// 2. Home deck component.
{
  const f = 'src/components/commandCenter/CommandCenterDeck.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('commandCenterHealth') < 0
        && src.indexOf('CommandCenterRuntime') < 0)
      fails.push(`${f}: must consume commandCenterHealth() from CommandCenterRuntime`);
    // Pages MUST NOT recompute — the deck must not directly probe the
    // upstream globals; it reads the composite envelope instead.
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
        fails.push(`${f}: forbidden direct probe "${k}" — use commandCenterHealth() instead`);
    }
    // Must render the 9 fields (label keys present).
    const labels = [
      'commandCenter.crop', 'commandCenter.stage', 'commandCenter.risk',
      'commandCenter.health', 'commandCenter.todaysAction',
      'commandCenter.daysToHarvest', 'commandCenter.fundingMatch',
      'commandCenter.marketDemand', 'commandCenter.sellReadiness',
    ];
    for (const k of labels) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing i18n label "${k}"`);
    }
    // Must carry DOM marker for the consumer surface.
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
    if (src.indexOf("from '../commandCenter/CommandCenterDeck") < 0
        && src.indexOf('from "../commandCenter/CommandCenterDeck') < 0)
      fails.push(`${f}: missing CommandCenterDeck import`);
  }
}

// 4. App.jsx wiring.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('installCommandCenterGlobal') < 0)
      fails.push(`${f}: missing installCommandCenterGlobal() install`);
  }
}

if (fails.length) {
  console.error('[check:command-center] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:command-center] OK');
