#!/usr/bin/env node
/**
 * check-intelligence-integration.mjs — Intelligence Integration gate.
 *
 *   • IntelligenceIntegrationHealth pins __intelligenceIntegrationHealth
 *     with per-system summaries + integration attestation flags.
 *   • MarketIntelligenceRuntime pins __marketIntelligenceHealth alias
 *     alongside __marketIntelligenceCompositeHealth.
 *   • IntelligenceStatusStrip renders compact 3-tile Home strip.
 *   • Home mounts the strip.
 *   • App.jsx wires the integration install.
 *   • No standalone intelligence pages created.
 *   • Soil values not fabricated. Market demand not fabricated.
 *     Regional advice carries limitations.
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

// 1. Integration composite.
{
  const f = 'src/runtime/intelligence/IntelligenceIntegrationHealth.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__intelligenceIntegrationHealth',
      'installIntelligenceIntegrationHealthGlobal',
      'intelligenceIntegrationHealth',
      'IntelligenceIntegrationHealthEnvelope',
      'SoilStatusSummary', 'MarketStatusSummary', 'RegionalStatusSummary',
      'soilStatus', 'marketStatus', 'regionalStatus',
      'soilReady', 'marketReady', 'regionalReady',
      'commandCenterIntegrated', 'dailyAssistantIntegrated',
      'sellPageReady', 'fundingPageReady',
      'weeklyReviewIntegrated', 'notificationsIntegrated',
      'noFakeSoilValues: true as const',
      'noFakeMarketDemand: true as const',
      'noFabricatedRegionalAdvice: true as const',
      'noStandalonePages: true as const',
      // Composes the 3 source probes.
      '__soilIntelligenceHealth',
      '__marketIntelligenceHealth',
      '__regionalIntelligenceFieldHealth',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    if (src.indexOf('Decision support, not a guarantee') < 0)
      fails.push(`${f}: missing limitations tail`);
  }
}

// 2. Market alias pin.
{
  const f = 'src/runtime/intelligence/MarketIntelligenceRuntime.ts';
  const src = read(f);
  if (src) {
    if (src.indexOf('__marketIntelligenceHealth') < 0)
      fails.push(`${f}: must pin __marketIntelligenceHealth alias`);
    if (src.indexOf('__marketIntelligenceCompositeHealth') < 0)
      fails.push(`${f}: must keep __marketIntelligenceCompositeHealth global`);
  }
}

// 3. Home strip.
{
  const f = 'src/components/commandCenter/IntelligenceStatusStrip.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('intelligence-status-strip') < 0)
      fails.push(`${f}: missing data-testid="intelligence-status-strip"`);
    if (src.indexOf('__intelligenceIntegrationHealth') < 0)
      fails.push(`${f}: must read __intelligenceIntegrationHealth`);
    // Spec rule: must not dominate. Look for marker + self-collapse.
    if (src.indexOf('data-no-dominate="true"') < 0)
      fails.push(`${f}: must carry data-no-dominate="true"`);
    if (src.indexOf('anyAvailable') < 0)
      fails.push(`${f}: must self-collapse when no system is available`);
    // i18n labels.
    for (const k of ['intelligence.soil.label', 'intelligence.market.label',
                     'intelligence.regional.label']) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing i18n label "${k}"`);
    }
  }
}

// 4. Home mounts the strip.
{
  const f = 'src/components/simpleMode/SimpleModeHomeSection.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf('IntelligenceStatusStrip') < 0)
      fails.push(`${f}: Home must mount <IntelligenceStatusStrip />`);
  }
}

// 5. App.jsx wires the install.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src && src.indexOf('installIntelligenceIntegrationHealthGlobal') < 0)
    fails.push(`${f}: missing installIntelligenceIntegrationHealthGlobal() install`);
}

// 6. NO new standalone intelligence pages — spec rule.
{
  const forbiddenPages = [
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
  console.error('[check:intelligence-integration] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:intelligence-integration] OK');
