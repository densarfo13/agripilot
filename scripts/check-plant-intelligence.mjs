#!/usr/bin/env node
/**
 * check-plant-intelligence.mjs — Scan V5 contract lock.
 *
 *   • PlantConsensusRuntime returns spec-canonical output shape:
 *     {primaryMatch, confidence, alternatives, rationale, limitations}.
 *     Always returns a result (never null). noFabricatedConsensus +
 *     alwaysReturnsResult literal-true.
 *   • ScanSuccessMetricsRuntime computes 5 spec completion rates over
 *     real artifacts. null when denominator is 0 (insufficientDataHandled).
 *     noFakeMetrics + noFabricatedRates literal-true.
 *   • PlantIntelligenceHealth pins __plantIntelligenceHealth with all 10
 *     spec flags + noFakeIntelligence + noFabricatedConfidence +
 *     alwaysExposesLimitations literal-true.
 *   • App.jsx wires the 3 new installs.
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

// 1. PlantConsensusRuntime.
{
  const f = 'src/runtime/scanAccuracy/PlantConsensusRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__plantConsensusHealth',
      'installPlantConsensusGlobal',
      'runPlantConsensus',
      'plantConsensusReady',
      'PlantConsensusResult',
      // Spec output shape fields.
      'primaryMatch', 'confidence', 'alternatives', 'rationale', 'limitations',
      'noFabricatedConsensus: true as const',
      'alwaysReturnsResult: true as const',
      // Composition.
      'MultiPassIdentificationRuntime',
      'FarmContextBiasRuntime',
      'UnknownHandlingRuntime',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 2. ScanSuccessMetricsRuntime.
{
  const f = 'src/runtime/scanAccuracy/ScanSuccessMetricsRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__scanSuccessMetricsHealth',
      'installScanSuccessMetricsGlobal',
      'computeScanSuccessMetrics',
      'scanSuccessMetricsReady',
      'ScanSuccessMetrics',
      // 5 spec rates.
      'identificationSuccessRatePct',
      'problemDetectionRatePct',
      'taskCompletionRatePct',
      'outcomeCompletionRatePct',
      'followUpCompletionRatePct',
      // Honesty.
      'noFakeMetrics: true as const',
      'noFabricatedRates: true as const',
      'insufficientDataHandled: true as const',
      '_pctOrNull',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // No hardcoded percentage literals as fallback (would be fake data).
    if (/(?:\?\?|\|\|)\s*\d{2,3}\s*[,;)]/.test(src))
      fails.push(`${f}: forbidden hardcoded percentage fallback`);
  }
}

// 3. PlantIntelligenceHealth composite.
{
  const f = 'src/runtime/scanAccuracy/PlantIntelligenceHealth.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__plantIntelligenceHealth',
      'installPlantIntelligenceHealthGlobal',
      'PlantIntelligenceHealthEnvelope',
      // 10 spec flags.
      'plantIdReady', 'plantNetReady', 'cropLibraryReady',
      'consensusReady', 'contextBoostingReady', 'diseaseReady',
      'taskGenerationReady', 'followUpReady',
      'escalationReady', 'outcomeReady',
      // Safety.
      'noFakeIntelligence: true as const',
      'noFabricatedConfidence: true as const',
      'alwaysExposesLimitations: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 4. App.jsx wires all 3.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    const required = [
      'installPlantConsensusGlobal',
      'installScanSuccessMetricsGlobal',
      'installPlantIntelligenceHealthGlobal',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}()" install`);
    }
  }
}

if (fails.length) {
  console.error('[check:plant-intelligence] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:plant-intelligence] OK');
