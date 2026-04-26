#!/usr/bin/env node
/**
 * swap-tsafe-fallbacks.mjs — one-shot transform for the strict
 * no-English-leak migration.
 *
 * Replaces two leak-prone fallback patterns with tSafe(key, ''):
 *
 *   t('foo')         || 'English'  →  tSafe('foo', '')
 *   t('foo')  !== 'foo' ? t('foo') : 'English'  →  tSafe('foo', '')
 *
 * Adds `import { tSafe } from '<rel>/i18n/tSafe.js';` when missing.
 *
 * Scope: farmer / buyer / onboarding / auth-flow files only. Admin
 * and staff English-only surfaces are left lenient.
 *
 * Usage:
 *   node scripts/swap-tsafe-fallbacks.mjs --dry        (preview)
 *   node scripts/swap-tsafe-fallbacks.mjs              (apply)
 *
 * The transform is intentionally conservative:
 *   • only matches `t('literal-string')` (single-arg t() calls)
 *   • drops the trailing English literal (strict no-leak rule —
 *     non-English UIs no longer see English fallbacks)
 *   • leaves `t('key', { vars })` calls untouched (rare; manual)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const TARGETS = [
  'src/components/CropPhotoCapture.jsx',
  'src/components/CropTimelineCard.jsx',
  'src/components/DailyProgressCard.jsx',
  'src/components/farmer/DoneStateCard.jsx',
  'src/components/farmer/FeedbackModal.jsx',
  'src/components/farmer/HarvestSummaryCard.jsx',
  'src/components/farmer/NextCycleOptions.jsx',
  'src/components/farmer/NextHint.jsx',
  'src/components/farmer/OptionalChecksSection.jsx',
  'src/components/farmer/PrimaryTaskCard.jsx',
  'src/components/FarmForm.jsx',
  'src/components/FarmInsightCard.jsx',
  'src/components/JourneySummaryCard.jsx',
  'src/components/market/BuyerFiltersBar.jsx',
  'src/components/market/BuyerInterestForm.jsx',
  'src/components/market/LocationSelector.jsx',
  'src/components/NotificationBadge.jsx',
  'src/components/NotificationCenter.jsx',
  'src/components/NotificationPreferencesCard.jsx',
  'src/components/NotificationSettingsPanel.jsx',
  'src/components/TodaysTasksCard.jsx',
  'src/pages/AcceptInvitePage.jsx',
  'src/pages/buyer/BrowseListingsPage.jsx',
  'src/pages/buyer/BuyerNotificationsPage.jsx',
  'src/pages/buyer/ListingDetailPage.jsx',
  'src/pages/buyer/MyInterestsPage.jsx',
  'src/pages/CropRecommendations.jsx',
  'src/pages/EditFarmScreen.jsx',
  'src/pages/farmer/CreateListingPage.jsx',
  'src/pages/farmer/FarmerTodayPage.jsx',
  'src/pages/farmer/MyListingsPage.jsx',
  'src/pages/farmer/NotificationsPage.jsx',
  'src/pages/farmer/PostHarvestSummaryPage.jsx',
  'src/pages/FarmerDashboardPage.jsx',
  'src/pages/FarmerProgressPage.jsx',
  'src/pages/FieldHotspotAlert.jsx',
  'src/pages/Login.jsx',
  'src/pages/NewApplicationPage.jsx',
  'src/pages/onboarding/FarmerOnboardingPage.jsx',
  'src/pages/RegionalWatch.jsx',
];

// `t('key') || 'literal'`  (both single-quote and double-quote literals)
const RE_OR = /\bt\((['"])([a-zA-Z0-9_.]+)\1\)\s*\|\|\s*(['"])([^'"\n]+?)\3/g;

// `t('key') !== 'key' ? t('key') : 'literal'`
const RE_TERNARY = /\bt\((['"])([a-zA-Z0-9_.]+)\1\)\s*!==\s*(['"])\2\3\s*\?\s*t\((['"])\2\4\)\s*:\s*(['"])([^'"\n]+?)\5/g;

const dry = process.argv.includes('--dry');

function relImportPath(fromFile) {
  const from = path.dirname(path.join(ROOT, fromFile));
  const to   = path.join(ROOT, 'src/i18n/tSafe.js');
  let rel = path.relative(from, to).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function ensureImport(text, fromFile) {
  if (/from\s+['"][^'"]+\/i18n\/tSafe\.js['"]/.test(text)) return text;
  if (/import\s*\{[^}]*\btSafe\b/.test(text)) return text;
  const importLine = `import { tSafe } from '${relImportPath(fromFile)}';`;
  // Insert AFTER the last *complete* import statement so we never
  // split a multi-line import { ... } from '...'; block. Match
  // single-line and `import { ... } from '...'`-spanning forms.
  const re = /^[ \t]*import\b[\s\S]*?from\s+['"][^'"]+['"]\s*;?[ \t]*$/gm;
  let lastEnd = -1;
  let m;
  while ((m = re.exec(text)) !== null) {
    // Only consider imports in the first ~4 KB; the script's job is
    // to land alongside other imports at the top of the file.
    if (m.index > 4096) break;
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd === -1) return importLine + '\n' + text;
  return text.slice(0, lastEnd) + '\n' + importLine + text.slice(lastEnd);
}

let totalFiles = 0;
let totalSites = 0;
const summary = [];

for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    summary.push({ file: rel, sites: 0, note: '(not found)' });
    continue;
  }
  let text = fs.readFileSync(abs, 'utf8');
  let sites = 0;
  text = text.replace(RE_TERNARY, (_m, _q1, k) => { sites += 1; return `tSafe('${k}', '')`; });
  text = text.replace(RE_OR,      (_m, _q1, k) => { sites += 1; return `tSafe('${k}', '')`; });
  if (sites > 0) {
    text = ensureImport(text, rel);
    if (!dry) fs.writeFileSync(abs, text, 'utf8');
    totalFiles += 1;
    totalSites += sites;
    summary.push({ file: rel, sites, note: dry ? '(dry-run)' : 'patched' });
  } else {
    summary.push({ file: rel, sites: 0, note: 'no matches' });
  }
}

console.log(`\nswap-tsafe-fallbacks: ${dry ? 'DRY-RUN' : 'APPLIED'}`);
console.log(`  ${totalFiles} file(s) changed, ${totalSites} site(s) replaced.\n`);
for (const row of summary) {
  if (row.sites > 0) {
    console.log(`  ${String(row.sites).padStart(3)}  ${row.file}  ${row.note}`);
  }
}
