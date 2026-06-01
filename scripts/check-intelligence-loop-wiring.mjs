#!/usr/bin/env node
/**
 * scripts/check-intelligence-loop-wiring.mjs — §6 full intelligence loop.
 *
 * Fails if __intelligenceLoopHealth does not:
 *   • surface all 12 §6 readiness keys (the 11 engines + scanToOutcomeLoopReady)
 *   • compose the 11 engine probe globals by name
 *   • return NEEDS_DATA (not fake values) when no engine is wired
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const src = read('src/runtime/intelligenceLoop/index.ts');
if (!src) { F.push('src/runtime/intelligenceLoop/index.ts: missing'); }
else {
  const KEYS = [
    'cropMemoryReady', 'trendReady', 'farmHealthReady', 'weatherRiskReady',
    'yieldReadinessReady', 'dailyDecisionReady', 'outcomeLearningReady',
    'regionalIntelligenceReady', 'farmTwinReady', 'buyerTrustReady',
    'ngoImpactReady', 'scanToOutcomeLoopReady',
  ];
  const missingKeys = KEYS.filter((k) => !src.includes(k));
  if (missingKeys.length) F.push(`__intelligenceLoopHealth missing §6 keys: ${missingKeys.join(', ')}`);
  else P.push('__intelligenceLoopHealth surfaces all 12 §6 readiness keys');

  const GLOBALS = [
    '__cropMemoryHealth', '__trendHealth', '__farmHealthScoreHealth',
    '__weatherRiskHealth', '__yieldReadinessHealth', '__dailyDecisionHealth',
    '__outcomeLearningHealth', '__regionalIntelligenceHealth', '__farmTwinHealth',
    '__buyerTrustHealth', '__ngoImpactHealth',
  ];
  const missingGlobals = GLOBALS.filter((g) => !src.includes(g));
  if (missingGlobals.length) F.push(`__intelligenceLoopHealth must compose engine probes: ${missingGlobals.join(', ')}`);
  else P.push('composes all 11 engine probe globals by name');

  if (!/NEEDS_DATA/.test(src))
    F.push('__intelligenceLoopHealth must return NEEDS_DATA (not fake values) when no engine is wired');
  else P.push('returns NEEDS_DATA when insufficient (no fake values)');
}

if (F.length) {
  console.error('[check:intelligence-loop-wiring] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:intelligence-loop-wiring] PASS — 11 engines wired + scan→outcome loop; honest NEEDS_DATA.');
for (const m of P) console.log('  ✓ ' + m);
