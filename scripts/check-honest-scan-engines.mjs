#!/usr/bin/env node
/**
 * check-honest-scan-engines.mjs — locks the honesty contract on the
 * two local scan engines that close the §STAGE 3 multi-pass gap.
 *
 * Required:
 *   • LocalCropMatcherEngine pins __cropMatcherHealth, caps confidence
 *     at FARM_PROFILE_CAP (= 40), declares noVisionClaim + capAtFortyPct
 *     literal-true. Sources its data from __commandCenterHealth() ONLY.
 *   • LeafColorAnalyzer pins __leafAnalysisHealth with real pixel-ratio
 *     measurements (greenRatio / yellowRatio / brownRatio / darkRatio),
 *     declares noFakeDiagnosis + measurementOnly literal-true, and
 *     returns an HONESTLY EMPTY candidates array (color is not a crop ID).
 *   • Both wired in App.jsx.
 *   • No hardcoded confidence numbers > 40 in LocalCropMatcher.
 *   • LeafColorAnalyzer must NOT push any items into its candidates array.
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

// 1. LocalCropMatcherEngine.
{
  const f = 'src/runtime/scanAccuracy/LocalCropMatcherEngine.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__cropMatcherHealth',
      'installLocalCropMatcherGlobal',
      'cropMatcherHealth',
      'FARM_PROFILE_CAP',
      'noVisionClaim: true as const',
      'capAtFortyPct: true as const',
      "source: 'farm-profile'",
      '__commandCenterHealth',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Hard cap must be exactly 40.
    if (src.indexOf('FARM_PROFILE_CAP = 40') < 0)
      fails.push(`${f}: FARM_PROFILE_CAP must equal 40`);
    // Forbid any literal confidence number > 40 in the file body.
    const bigConf = src.match(/confidencePct\s*:\s*(\d{2,3})/g) || [];
    for (const m of bigConf) {
      const n = parseInt(m.replace(/[^0-9]/g, ''), 10);
      if (n > 40) fails.push(`${f}: confidencePct ${n} exceeds 40% cap`);
    }
  }
}

// 2. LeafColorAnalyzer.
{
  const f = 'src/runtime/scanAccuracy/LeafColorAnalyzer.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__leafAnalysisHealth',
      'installLeafColorAnalyzerGlobal',
      'leafAnalysisHealth',
      'analyzeLeafColor',
      'greenRatio', 'yellowRatio', 'brownRatio', 'darkRatio',
      'leafSignals', 'LeafSignal',
      'noFakeDiagnosis: true as const',
      'measurementOnly: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Honest empty candidates — must not push crop IDs into the
    // candidates array. We look for any pattern that would do so.
    if (/candidates\s*\.\s*push\s*\(/.test(src))
      fails.push(`${f}: candidates array must remain empty (color is not a crop ID)`);
    // Hard rule: no severity 'high' — color alone is never high severity.
    if (/severity\s*:\s*['"]high['"]/.test(src))
      fails.push(`${f}: color-only signals must never claim 'high' severity`);
  }
}

// 3. App.jsx wires both.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    for (const k of ['installLocalCropMatcherGlobal', 'installLeafColorAnalyzerGlobal']) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}()" install`);
    }
  }
}

if (fails.length) {
  console.error('[check:honest-scan-engines] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:honest-scan-engines] OK');
