#!/usr/bin/env node
/**
 * scripts/check-daily-plan-safety.mjs — §7/§9/§10 cross-cutting safety.
 *
 * Across ALL five daily-plan runtimes, fails if any:
 *   • states an exact yield (tons/acre, kg/ha, "<n> bags", revenue);
 *   • gives a chemical / fertilizer / pesticide dosage or concentration;
 *   • REQUIRES GPS / weather / a scan before showing guidance;
 *   • lets scan / weather integration BLOCK (must be non-blocking);
 *   • fabricates (Math.random / network);
 *   • omits the disclaimer.
 * Comments are stripped first (the files legitimately describe these in
 * negation prose).
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const FILES = [
  'src/runtime/dailyPlan/GrowTimeframeEngine.ts',
  'src/runtime/dailyPlan/CropLifecycleEngine.ts',
  'src/runtime/dailyPlan/PostHarvestEngine.ts',
  'src/runtime/dailyPlan/DailyFarmPlanRuntime.ts',
  'src/runtime/dailyPlan/DailyPlanIntegrationRuntime.ts',
];

const RE_YIELD = /\b\d+(\.\d+)?\s*(tons?|tonnes?)\s*(per|\/)\s*(acre|ha|hectare)|\b\d+(\.\d+)?\s*kg\s*(per|\/)\s*(acre|ha|hectare|plant)|\b\d+\s*bags?\s*(per|\/)\s*(acre|ha|hectare|plant)|revenue of\s+\d|profit of\s+\d/i;
const RE_DOSAGE = /\b\d+(\.\d+)?\s*(ml|mg|g|kg|l)\s*(per|\/)\s*(l|litre|liter|kg|ton|tonne|bag|crate|m2|m²|plant|acre|ha)|apply\s+\d+(\.\d+)?\s*(ml|g|kg|l)\b|dilute\s+\d/i;
const RE_REQUIRE = /(require|requires|must have|need|needs)\s+(a\s+)?(gps|location|weather|scan)\b/i;

for (const rel of FILES) {
  const raw = read(rel);
  if (!raw) { F.push(`${rel}: missing`); continue; }
  const src = strip(raw);
  const name = rel.split('/').pop();
  if (RE_YIELD.test(src)) F.push(`${name}: must not state an exact yield`);
  if (RE_DOSAGE.test(src)) F.push(`${name}: must not give a chemical/fertilizer dosage`);
  if (RE_REQUIRE.test(src)) F.push(`${name}: must not require GPS / weather / scan before guidance`);
  if (/Math\.random\s*\(|\bfetch\s*\(|XMLHttpRequest/.test(src)) F.push(`${name}: must not fabricate / call the network`);
  if (!/Decision support, not a guarantee/.test(raw)) F.push(`${name}: must carry the disclaimer`);
}
if (!F.length) P.push('no exact yield / no dosage / no required GPS-weather-scan / no fabrication / disclaimer in all 5');

// The plan composite must positively declare it works without weather/scan/GPS.
const plan = read('src/runtime/dailyPlan/DailyFarmPlanRuntime.ts');
for (const k of ['worksWithoutWeather', 'worksWithoutScan', 'worksWithoutGps']) {
  if (!plan.includes(k)) F.push(`DailyFarmPlanRuntime must declare ${k}`);
}
if (!F.some((m) => m.includes('worksWithout'))) P.push('plan declares works-without weather/scan/GPS');

// Scan + weather integration must be non-blocking.
const integ = read('src/runtime/dailyPlan/DailyPlanIntegrationRuntime.ts');
if (integ && !/nonBlocking/.test(integ)) F.push('scan/weather integration must be non-blocking');
else if (integ) P.push('scan/weather integration non-blocking');

if (F.length) {
  console.error('[check:daily-plan-safety] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:daily-plan-safety] PASS — no exact yield/dosage, no required GPS/weather/scan, non-blocking, honest, disclaimers.');
for (const m of P) console.log('  ✓ ' + m);
