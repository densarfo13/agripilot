#!/usr/bin/env node
/**
 * check-scan-trust.mjs — Scan V6 Trust + Accuracy contract lock.
 *
 *   • ConfidenceBandRuntime: 4 spec labels + FORBIDDEN_BAND_WORDS list
 *     (never uses 'Confirmed' / 'Guaranteed' / '100% accurate').
 *   • ActionSafetyRuntime: FORBIDDEN_ACTION_PATTERNS + SAFE_DEFAULT_ACTION
 *     + isSafeAction + safeActionOrFallback. Literal-true: no chemical /
 *     dosage / unsafe treatment recommendations.
 *   • FarmMemoryTrendRuntime: 4 trend labels + min-2-outcomes rule.
 *   • ScanTrustPanelRuntime: 7-field envelope + ALWAYS exposes
 *     confidence + limitations + nextAction. Action passes through
 *     ActionSafetyRuntime.
 *   • ScanTrustHealth: 8 spec flags + 3 literal-true safety constants.
 *   • App.jsx wires all 5 installs.
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

// 1. ConfidenceBandRuntime.
{
  const f = 'src/runtime/scanAccuracy/ConfidenceBandRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__confidenceBandHealth',
      'installConfidenceBandGlobal',
      'bandForConfidence',
      'confidenceBandsReady',
      'FORBIDDEN_BAND_WORDS',
      // 4 spec labels.
      "'High Confidence'",
      "'Likely Match'",
      "'Needs Confirmation'",
      "'Review Recommended'",
      'noOverstatedLanguage: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Forbidden words must be enumerated in the array.
    for (const w of ["'Confirmed'", "'Guaranteed'", "'100% accurate'"]) {
      if (src.indexOf(w) < 0) fails.push(`${f}: FORBIDDEN_BAND_WORDS must list ${w}`);
    }
    // The runtime must NOT use these words in user-facing label/rationale
    // strings. Strip comments + the FORBIDDEN_BAND_WORDS array + the
    // explanation string (which describes the rule, by design).
    let stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')              // /* ... */ block comments
      .replace(/^\s*\/\/.*$/gm, '')                  // // line comments
      .replace(/FORBIDDEN_BAND_WORDS[\s\S]*?\]\)?/, '') // the rule array itself
      .replace(/explanation:\s*'[^']*'/g, '')        // explanation strings
      .replace(/explanation:\s*\n[\s\S]*?\.\s*,/g, ''); // multi-line explanations
    // Now any remaining occurrence is a leak into label/rationale text.
    const leak = stripped.match(/'Confirmed'|'Guaranteed'|'100% accurate'/);
    if (leak)
      fails.push(`${f}: forbidden overstated language ${leak[0]} leaked into label/rationale text`);
  }
}

// 2. ActionSafetyRuntime.
{
  const f = 'src/runtime/scanAccuracy/ActionSafetyRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__actionSafetyHealth',
      'installActionSafetyGlobal',
      'isSafeAction',
      'safeActionOrFallback',
      'FORBIDDEN_ACTION_PATTERNS',
      'SAFE_DEFAULT_ACTION',
      'noChemicalRecommendations: true as const',
      'noDosageRecommendations: true as const',
      'noUnsafeTreatmentAdvice: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Forbidden patterns must include common chemicals + dosage units.
    for (const p of ["'kg/ha'", "'fungicide'", "'pesticide'", "'glyphosate'"]) {
      if (src.indexOf(p) < 0)
        fails.push(`${f}: FORBIDDEN_ACTION_PATTERNS must include ${p}`);
    }
  }
}

// 3. FarmMemoryTrendRuntime.
{
  const f = 'src/runtime/scanAccuracy/FarmMemoryTrendRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__farmMemoryTrendHealth',
      'installFarmMemoryTrendGlobal',
      'trendForPlant',
      'farmMemoryTrendReady',
      // 4 trend labels.
      "'Improving'",
      "'Stable'",
      "'Needs Attention'",
      "'Not enough data yet'",
      'noFakeTrends: true as const',
      'noFabricatedVerdicts: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Must require at least 2 outcomes before assigning a non-trivial trend.
    if (src.indexOf('total < 2') < 0)
      fails.push(`${f}: must require at least 2 outcomes before computing trend`);
  }
}

// 4. ScanTrustPanelRuntime.
{
  const f = 'src/runtime/scanAccuracy/ScanTrustPanelRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__scanTrustPanelHealth',
      'installScanTrustPanelGlobal',
      'buildTrustPanel',
      'TrustPanelEnvelope',
      // Spec 7 fields + extras.
      'plant', 'confidence', 'confidenceLabel',
      'issue', 'severity', 'why', 'limitations', 'nextAction',
      'photoQuality', 'followUpDays',
      // Literal-true contracts.
      'alwaysCarriesConfidence: true as const',
      'alwaysCarriesLimitations: true as const',
      'alwaysCarriesNextAction: true as const',
      'actionSafetyEnforced: true as const',
      'noFabricatedTrust: true as const',
      // Composition.
      'PlantConsensusRuntime',
      'ConfidenceBandRuntime',
      'ActionSafetyRuntime',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 5. ScanTrustHealth composite.
{
  const f = 'src/runtime/scanAccuracy/ScanTrustHealth.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__scanTrustHealth',
      'installScanTrustHealthGlobal',
      'ScanTrustHealthEnvelope',
      // 8 spec flags.
      'trustPanelReady: true as const',
      'confidenceBandsReady: true as const',
      'imageQualityReady',
      'explanationsReady: true as const',
      'actionSafetyReady: true as const',
      'followUpReady',
      'farmMemoryReady',
      'analyticsReady',
      // Safety constants.
      'noFabricatedTrust: true as const',
      'noOverstatedLanguage: true as const',
      'alwaysExplains: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 6. App.jsx wires all 5.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    const required = [
      'installConfidenceBandGlobal',
      'installActionSafetyGlobal',
      'installFarmMemoryTrendGlobal',
      'installScanTrustPanelGlobal',
      'installScanTrustHealthGlobal',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}()" install`);
    }
  }
}

if (fails.length) {
  console.error('[check:scan-trust] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:scan-trust] OK');
