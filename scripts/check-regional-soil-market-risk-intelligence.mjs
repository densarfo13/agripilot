#!/usr/bin/env node
/**
 * check-regional-soil-market-risk-intelligence.mjs —
 * Locks the contract for the 4 new intelligence runtimes:
 *   1. src/runtime/intelligence/RegionalIntelligenceRuntime.ts pins
 *      __regionalIntelligenceFieldHealth + exposes recommendedCrops /
 *      plantingWindow / regionalRisks / commonDiseases / rainfallPattern /
 *      temperaturePattern + confidence + limitations.
 *   2. src/runtime/intelligence/SoilIntelligenceRuntime.ts pins
 *      __soilIntelligenceHealth + reports soilGridsConfigured (literal
 *      false until a real soil source is wired) + soilRecommendations
 *      with rationale (limitations) + noFabricatedScores literal-true.
 *   3. src/runtime/intelligence/MarketIntelligenceRuntime.ts pins
 *      __marketIntelligenceCompositeHealth + every score has a source
 *      (scoreSource field) + noFabricatedScores literal-true.
 *   4. src/runtime/intelligence/FarmRiskRuntime.ts pins
 *      __farmRiskHealth + every per-category risk carries an explanation
 *      + source + riskCarriesExplanation literal-true.
 *
 * Fails on:
 *   • missing file
 *   • missing global pin
 *   • market score with no source field
 *   • soil recommendation surface missing rationale (limitations)
 *   • regional recommendation surface missing confidence
 *   • risk level surface missing explanation
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

// 1. RegionalIntelligenceRuntime
{
  const f = 'src/runtime/intelligence/RegionalIntelligenceRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__regionalIntelligenceFieldHealth',
      'recommendedCrops',
      'plantingWindow',
      'regionalRisks',
      'commonDiseases',
      'rainfallPattern',
      'temperaturePattern',
      'confidence',
      'limitations',
      'noFabricatedRegionalAdvice',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    if (src.indexOf('Decision support, not a guarantee') < 0)
      fails.push(`${f}: missing limitations tail`);
  }
}

// 2. SoilIntelligenceRuntime
{
  const f = 'src/runtime/intelligence/SoilIntelligenceRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__soilIntelligenceHealth',
      'soilGridsConfigured',
      'soilType',
      'organicMatter',
      'soilPH',
      'waterRetention',
      'drainage',
      'soilHealth',
      'soilLimitations',
      'soilRecommendations',
      'noFabricatedScores',
      'noFabricatedSoilValues',
      'confidence',
      'limitations',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    if (src.indexOf('Decision support, not a guarantee') < 0)
      fails.push(`${f}: missing limitations tail`);
    // Honesty: soilGridsConfigured must be literal false until a real
    // source is wired — fake true is exactly what the spec forbids.
    if (src.indexOf('soilGridsConfigured: false') < 0
        && src.indexOf('soilGridsConfigured: false as const') < 0)
      fails.push(`${f}: soilGridsConfigured must be literal false (no fake data)`);
  }
}

// 3. MarketIntelligenceRuntime
{
  const f = 'src/runtime/intelligence/MarketIntelligenceRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__marketIntelligenceCompositeHealth',
      'marketDemand',
      'buyerInterestScore',
      'recommendedSellingWindow',
      'scoreSource',
      'noFabricatedScores',
      'noFakeBuyerInterest',
      'confidence',
      'limitations',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    if (src.indexOf('Decision support, not a guarantee') < 0)
      fails.push(`${f}: missing limitations tail`);
    // Spec: every market score MUST trace to a source.
    if (src.indexOf('scoreSource') < 0)
      fails.push(`${f}: market score must carry scoreSource attribution`);
  }
}

// 4. FarmRiskRuntime
{
  const f = 'src/runtime/intelligence/FarmRiskRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__farmRiskHealth',
      'weatherRisk',
      'diseaseRisk',
      'soilRisk',
      'marketRisk',
      'overallRiskLevel',
      'overallExplanation',
      'riskCarriesExplanation',
      'noFabricatedRiskScores',
      'RiskAssessment',
      'confidence',
      'limitations',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // The RiskAssessment type itself must require explanation + source.
    if (src.indexOf('explanation: string') < 0)
      fails.push(`${f}: RiskAssessment must require explanation`);
    if (src.indexOf('source: string') < 0)
      fails.push(`${f}: RiskAssessment must require source`);
    if (src.indexOf('Decision support, not a guarantee') < 0)
      fails.push(`${f}: missing limitations tail`);
  }
}

// 5. App.jsx wiring — all 4 install* must be called.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    const requiredCalls = [
      'installRegionalIntelligenceFieldGlobal',
      'installSoilIntelligenceGlobal',
      'installMarketIntelligenceCompositeGlobal',
      'installFarmRiskGlobal',
    ];
    for (const c of requiredCalls) {
      if (src.indexOf(c) < 0) fails.push(`${f}: missing "${c}()" install`);
    }
  }
}

if (fails.length) {
  console.error('[check:regional-soil-market-risk-intelligence] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:regional-soil-market-risk-intelligence] OK');
