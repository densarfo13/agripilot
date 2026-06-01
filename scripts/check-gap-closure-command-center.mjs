#!/usr/bin/env node
/**
 * check-gap-closure-command-center.mjs — Command Center must never
 * break when SoilGrids / Weekly Review / Field Officer integrations
 * are unavailable. Locks the nonBlocking literal-true contract and
 * confirms the gap-closure composite is wired.
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

// Composite must exist + declare nonBlocking literal-true.
{
  const f = 'src/runtime/command-center/CommandCenterGapClosure.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__commandCenterGapClosureHealth',
      'installCommandCenterGapClosureGlobal',
      'soilIntegrated', 'weeklyReviewIntegrated', 'fieldOfficerIntegrated',
      'nonBlocking: true as const',
      '__soilGridsHealth', '__weeklyFarmReviewHealth',
      '__weeklyReviewPageHealth', '__fieldOfficerDashboardHealth',
      '__fieldOfficerSupervisorMetricsHealth',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// App.jsx must wire all 5 new install fns.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    const required = [
      'installSoilGridsGlobal',
      'installWeeklyReviewPageGlobal',
      'installFieldOfficerDashboardGlobal',
      'installFieldOfficerSupervisorMetricsGlobal',
      'installCommandCenterGapClosureGlobal',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}()" install`);
    }
  }
}

// CommandCenterDeck (Home) MUST NOT directly probe the gap-closure
// surfaces — they belong to the gap-closure composite, not Home.
{
  const f = 'src/components/commandCenter/CommandCenterDeck.jsx';
  const src = read(f);
  if (src) {
    const forbidden = [
      '__soilGridsHealth(',
      '__fieldOfficerDashboardHealth(',
      '__fieldOfficerSupervisorMetricsHealth(',
    ];
    for (const k of forbidden) {
      if (src.indexOf(k) >= 0)
        fails.push(`${f}: forbidden direct probe "${k}" — Home composes via Command Center only`);
    }
  }
}

if (fails.length) {
  console.error('[check:gap-closure-command-center] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:gap-closure-command-center] OK');
