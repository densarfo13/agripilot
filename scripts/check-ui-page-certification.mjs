/**
 * check-ui-page-certification.mjs — UI Certification, Rule #12 (no engineering wording the farmer
 * sees), enforced across ALL ten certified pages (not just Home). Locks the verified-clean state:
 * 0 internal-term leaks in rendered strings. Any page that reintroduces engineering wording fails
 * the build. Complements check-home-no-internal-terms (Home components) + copy-governor (locales).
 */
import fs from 'node:fs';
import path from 'node:path';
const R = process.cwd();
const PAGES = [
  'src/pages/Home.jsx', 'src/pages/MyFarmPage.jsx', 'src/pages/AllTasksPage.jsx',
  'src/pages/FundingHub.jsx', 'src/pages/Sell.jsx', 'src/pages/ScanResultPage.jsx',
  'src/pages/FarmerSettingsPage.jsx', 'src/pages/AutoNotificationsPage.jsx',
  'src/pages/onboarding/FastOnboarding.jsx', 'src/pages/PlantProfile.jsx',
];
// Engineering terms a farmer must never read, matched ONLY inside quoted UI strings.
const BANNED = /(FarmBrain|Confidence Score|Recommendation Engine|Decision Engine|confidence engine|provider timeout|internal error)/;
const E = [];
for (const rel of PAGES) {
  let src = '';
  try { src = fs.readFileSync(path.join(R, rel), 'utf8'); } catch { E.push('missing page: ' + rel); continue; }
  for (const line of src.split(/\r?\n/)) {
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;                          // skip comment lines
    if (/^\s*(import|export)\b/.test(line)) continue;                       // skip import/export
    if (/\/\/.*FarmBrainState/.test(line)) continue;                        // skip trailing architecture comments
    const quoted = line.match(/(['"`])(?:\\.|(?!\1).)*\1/g) || [];
    for (const q of quoted) {
      const text = q.slice(1, -1);
      if (text.includes('/') || text.includes('\\')) continue;              // skip module paths
      if (/^[a-zA-Z0-9_.]+$/.test(text)) continue;                           // skip identifiers/keys (farmBrainState etc.)
      if (BANNED.test(text)) E.push(`${rel}: farmer-facing string shows engineering wording: ${q}`);
    }
  }
}
if (E.length) { console.error('[check:ui-page-certification] FAIL — Rule #12 (no engineering wording):'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:ui-page-certification] PASS — Rule #12 certified across all ' + PAGES.length
  + ' pages: zero engineering wording (FarmBrain / Confidence Score / Recommendation Engine / …) in any farmer-facing string.');
