#!/usr/bin/env node
/**
 * strict-i18n-opt-in.mjs — bulk swap the lenient `useTranslation`
 * import for the strict alias on farmer-facing components.
 *
 * The transform is one-line per file:
 *
 *   - import { useTranslation } from '<rel>/i18n/index.js';
 *   + import { useStrictTranslation as useTranslation }
 *       from '<rel>/i18n/useStrictTranslation.js';
 *
 * Effect: every t('key') call inside the patched component now
 * returns '' instead of falling back to entry.en when the active
 * language lacks a translation. Empty cell > English bleed.
 *
 * SKIP_LIST below: admin / staff / English-only surfaces. Per
 * consistent prior decision, those stay lenient.
 *
 * Usage:
 *   node scripts/strict-i18n-opt-in.mjs --dry
 *   node scripts/strict-i18n-opt-in.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// Admin / staff / system surfaces that intentionally remain English-
// fallback friendly (English-only by prior decision).
const SKIP_LIST = new Set([
  'src/components/FarmEconomicsCard.jsx',
  'src/components/FarmEconomicsForecast.jsx',
  'src/components/BuyerRequestsList.jsx',
  'src/components/IncomingRequestsList.jsx',
  'src/components/BulkLotsCard.jsx',
  'src/components/admin/PitchMode.jsx',
  'src/components/admin/InsightCards.jsx',
  'src/components/admin/SummaryCards.jsx',
  'src/components/admin/InvestorMetricsCard.jsx',
  'src/components/admin/NeedsAttentionPanel.jsx',
  'src/components/admin/SystemDesignAdvantages.jsx',
  'src/components/admin/AdminPolish.jsx',
  'src/components/admin/RiskBadge.jsx',
  'src/components/admin/KeyInsightsSection.jsx',
  'src/components/admin/FarmerIntelligenceSummary.jsx',
  'src/components/admin/InterventionList.jsx',
  'src/components/admin/PrioritySupplyList.jsx',
  // System / chrome surfaces that already use tSafe-only paths.
  'src/components/LanguageSelector.jsx',
  'src/components/LanguageSelectorI18n.jsx',
  'src/components/LanguageRegionGate.jsx',
  'src/components/StepUpModal.jsx',
  'src/components/SyncStatus.jsx',
  'src/components/OfflineBanner.jsx',
  'src/components/ErrorBoundary.jsx',
  'src/components/Layout.jsx',
  // Buyer-management admin views
  'src/components/MarketplaceCard.jsx',
]);

function gather() {
  const dirs = [
    'src/components',
    'src/components/farmer',
    'src/components/admin',
    'src/components/farmer',
    'src/components/home',
    'src/components/market',
    'src/components/confidence',
    'src/components/dev',
    'src/components/location',
    'src/components/buyer',
    'src/components/onboarding',
  ];
  const out = new Set();
  for (const d of dirs) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.jsx')) continue;
      const rel = path.posix.join(d, entry.name);
      out.add(rel);
    }
  }
  return Array.from(out);
}

const dry = process.argv.includes('--dry');
const files = gather();

const RE = /import\s*\{\s*useTranslation\s*\}\s*from\s*(['"])((?:\.\.\/)+)i18n\/index\.js\1\s*;?/g;
const REPLACE_TEMPLATE = (q, prefix) =>
  `import { useStrictTranslation as useTranslation } from ${q}${prefix}i18n/useStrictTranslation.js${q};`;

let totalFiles = 0;
const summary = [];

for (const rel of files) {
  if (SKIP_LIST.has(rel)) continue;
  const abs = path.join(ROOT, rel);
  let text;
  try { text = fs.readFileSync(abs, 'utf8'); }
  catch { continue; }
  if (!RE.test(text)) continue;
  RE.lastIndex = 0;
  const next = text.replace(RE, (_m, q, prefix) => REPLACE_TEMPLATE(q, prefix));
  if (next === text) continue;
  if (!dry) fs.writeFileSync(abs, next, 'utf8');
  totalFiles += 1;
  summary.push(rel);
}

console.log(`\nstrict-i18n-opt-in: ${dry ? 'DRY-RUN' : 'APPLIED'}`);
console.log(`  ${totalFiles} component(s) opted into strict translation.\n`);
for (const s of summary) console.log(`  ${s}`);
