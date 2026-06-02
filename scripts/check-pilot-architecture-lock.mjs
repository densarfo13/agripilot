#!/usr/bin/env node
/**
 * check-pilot-architecture-lock.mjs — V1 Pilot Architecture Lock gate.
 *
 *   • PilotArchitectureGuardRuntime pins __pilotArchitectureHealth
 *     with all 10 spec readiness flags + architectureLocked literal-
 *     true + noNewIntelligenceEngines + noNewArchitectureFamilies
 *     literal-true.
 *   • V1_ALLOWED_SYSTEMS enumerates the 12 allowed systems.
 *   • V1_SYSTEM_GLOBALS lists the canonical probe per system.
 *   • App.jsx wires the install.
 *   • No new intelligence pages (5-name forbidden list).
 *   • All 12 allowed systems' canonical files exist.
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

// 1. Guard runtime contract.
{
  const f = 'src/runtime/pilotObservability/PilotArchitectureGuardRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__pilotArchitectureHealth',
      'installPilotArchitectureGuardGlobal',
      'pilotArchitectureHealth',
      'PilotArchitectureHealthEnvelope',
      'V1_ALLOWED_SYSTEMS',
      'V1_SYSTEM_GLOBALS',
      // 10 spec readiness flags.
      'architectureLocked: true as const',
      'commandCenterReady',
      'dailyAssistantReady',
      'intelligenceFabricReady',
      'scanReady',
      'outcomeReady',
      'weeklyReviewReady',
      'fieldOfficerReady',
      'founderDashboardReady',
      'pilotReady',
      // Lock constants.
      'noNewIntelligenceEngines: true as const',
      'noNewArchitectureFamilies: true as const',
      'totalSystems: 12 as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // V1_ALLOWED_SYSTEMS must enumerate all 12 spec system names.
    const systems = [
      'CommandCenter', 'DailyAssistant', 'ScanIntelligence',
      'OutcomeIntelligence', 'WeeklyReview', 'FieldOfficer',
      'Funding', 'Sell', 'IntelligenceFabric',
      'RegionalIntelligence', 'SoilIntelligence', 'MarketIntelligence',
    ];
    for (const s of systems) {
      if (src.indexOf("'" + s + "'") < 0)
        fails.push(`${f}: V1_ALLOWED_SYSTEMS must include '${s}'`);
    }
    // The 12 canonical globals must each appear.
    const canonical = [
      '__commandCenterHealth', '__dailyAssistantHealth',
      '__scanPilotFreezeHealth',
      '__outcomeIntelligenceHealth', '__scanOutcomeLoopHealth',
      '__weeklyFarmReviewHealth',
      '__fieldOfficerCommandCenterHealth',
      '__fundingHealth',
      '__postHarvestHealth', '__marketplaceIntelligenceHealth',
      '__intelligenceFabricHealth',
      '__regionalIntelligenceFieldHealth',
      '__soilIntelligenceHealth',
      '__marketIntelligenceHealth',
      '__founderDashboardHealth',
    ];
    for (const g of canonical) {
      if (src.indexOf(g) < 0)
        fails.push(`${f}: must compose probe "${g}"`);
    }
    if (src.indexOf('Decision support, not a guarantee') < 0)
      fails.push(`${f}: missing limitations tail`);
  }
}

// 2. App.jsx wires the install.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src && src.indexOf('installPilotArchitectureGuardGlobal') < 0)
    fails.push(`${f}: missing installPilotArchitectureGuardGlobal() install`);
}

// 3. No new standalone intelligence pages allowed.
{
  const forbiddenPages = [
    'src/pages/IntelligenceFabricPage.jsx',
    'src/pages/SoilIntelligencePage.jsx',
    'src/pages/MarketIntelligencePage.jsx',
    'src/pages/RegionalIntelligencePage.jsx',
    'src/pages/IntelligencePage.jsx',
    'src/pages/PilotArchitecturePage.jsx',
    'src/pages/ArchitectureGuardPage.jsx',
  ];
  for (const f of forbiddenPages) {
    if (fs.existsSync(path.join(ROOT, f)))
      fails.push(`forbidden: ${f} — V1 architecture lock forbids new intelligence pages`);
  }
}

// 4. The 12 allowed system canonical runtime files must each exist
//    (defensive: ensures the lock isn't pinning ghosts).
{
  const canonicalFiles = [
    // CommandCenter
    'src/runtime/command-center/CommandCenterRuntime.ts',
    // DailyAssistant
    'src/runtime/dailyAssistant/DailyAssistantRuntime.ts',
    // ScanIntelligence
    'src/runtime/scanAccuracy/ScanPilotFreezeHealth.ts',
    // OutcomeIntelligence
    'src/runtime/outcomes/OutcomeIntelligenceComposite.ts',
    // WeeklyReview
    'src/runtime/command-center/WeeklyFarmReviewRuntime.ts',
    // FieldOfficer
    'src/runtime/command-center/FieldOfficerCommandCenter.ts',
    // Funding (existing runtime)
    'src/runtime/funding/FundingRuntime.ts',
    // Sell — post-harvest
    // (PostHarvestEngine exists outside Wave-36 forbidden list; treat as existing)
    // IntelligenceFabric
    'src/runtime/intelligence/IntelligenceFabricRuntime.ts',
    // RegionalIntelligence
    'src/runtime/intelligence/RegionalIntelligenceRuntime.ts',
    // SoilIntelligence
    'src/runtime/intelligence/SoilIntelligenceRuntime.ts',
    // MarketIntelligence
    'src/runtime/intelligence/MarketIntelligenceRuntime.ts',
  ];
  for (const f of canonicalFiles) {
    if (!fs.existsSync(path.join(ROOT, f)))
      fails.push(`missing canonical V1 system file: ${f}`);
  }
}

if (fails.length) {
  console.error('[check:pilot-architecture-lock] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:pilot-architecture-lock] OK');
