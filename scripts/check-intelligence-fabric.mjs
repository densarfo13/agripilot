#!/usr/bin/env node
/**
 * check-intelligence-fabric.mjs — Intelligence Fabric contract lock.
 *
 *   • IntelligenceFabricRuntime pins __intelligenceFabricHealth with
 *     the spec output shape: crop, stage, health, risk, todayAction,
 *     nextAction, daysToHarvest, soilStatus, marketStatus,
 *     regionalStatus, confidence, limitations.
 *   • Composes Command Center state + Intelligence Integration
 *     summaries + the 6 spec source probes (weather, regional,
 *     soil, scan, outcome, market).
 *   • Literal-true safety: noFakeFabric, noFabricatedRecommendations,
 *     noStandalonePages.
 *   • App.jsx wires the install.
 *   • No standalone intelligence pages exist.
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

// 1. Fabric runtime contract.
{
  const f = 'src/runtime/intelligence/IntelligenceFabricRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__intelligenceFabricHealth',
      'installIntelligenceFabricGlobal',
      'intelligenceFabricHealth',
      'IntelligenceFabricEnvelope',
      // 12 spec output fields.
      'crop:', 'stage:', 'health:', 'risk:',
      'todayAction:', 'nextAction:', 'daysToHarvest:',
      'soilStatus:', 'marketStatus:', 'regionalStatus:',
      'confidence:', 'limitations:',
      // Source attribution.
      'composedFrom',
      'sourceCount',
      'totalSources: 6 as const',
      // Literal-true safety.
      'noFakeFabric: true as const',
      'noFabricatedRecommendations: true as const',
      'noStandalonePages: true as const',
      // Composes the spec source probes.
      '__commandCenterHealth',
      '__intelligenceIntegrationHealth',
      '__weatherRiskHealth',
      '__scanPilotFreezeHealth',
      '__scanOutcomeLoopHealth',
      '__regionalIntelligenceFieldHealth',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    if (src.indexOf('Decision support, not a guarantee') < 0)
      fails.push(`${f}: missing limitations tail`);
    // Honesty rule: market readiness must not be hardcoded — it must
    // be derived from demand band via _readinessFromDemand.
    if (src.indexOf('_readinessFromDemand') < 0)
      fails.push(`${f}: must derive marketReadiness from demand (no hardcoded reads)`);
  }
}

// 2. App.jsx wires the install.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src && src.indexOf('installIntelligenceFabricGlobal') < 0)
    fails.push(`${f}: missing installIntelligenceFabricGlobal() install`);
}

// 3. NO standalone intelligence pages — spec rule restated for this gate.
{
  const forbiddenPages = [
    'src/pages/IntelligenceFabricPage.jsx',
    'src/pages/SoilIntelligencePage.jsx',
    'src/pages/MarketIntelligencePage.jsx',
    'src/pages/RegionalIntelligencePage.jsx',
    'src/pages/IntelligencePage.jsx',
  ];
  for (const f of forbiddenPages) {
    if (fs.existsSync(path.join(ROOT, f)))
      fails.push(`forbidden: ${f} — spec says no standalone intelligence pages`);
  }
}

if (fails.length) {
  console.error('[check:intelligence-fabric] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:intelligence-fabric] OK');
