/**
 * check-farmer-date-locale.mjs — farmer-facing dates must follow the APP language, not the
 * device OS locale (priority #4 UI consistency / localization).
 *
 * Bug: low-literacy farmer screens rendered dates with `new Date(x).toLocaleDateString()`,
 * which uses the browser/OS locale — so a farmer who picked Hausa/Swahili/Hindi in-app saw
 * dates formatted for whatever language their phone was set to. The fix routes every
 * farmer-facing date through formatDate(x, lang) (src/i18n/format.js), which honours the
 * in-app language (incl. Hindi native digits).
 *
 * Invariant: no farmer-facing page calls `.toLocaleDateString(`. Officer/NGO surfaces
 * (FarmerDetailPage, FarmersPage) are intentionally out of scope.
 */
import fs from 'node:fs';
import path from 'node:path';

const R = process.cwd();
const E = [];

// Farmer-owned screens: everything under pages/farmer/, plus the farmer dashboard + tabs.
const FILES = [
  'src/pages/FarmerActivitiesTab.jsx',
  'src/pages/FarmerNotificationsTab.jsx',
  'src/pages/FarmerOverviewTab.jsx',
  'src/pages/FarmerProgressTab.jsx',
  'src/pages/FarmerMarketTab.jsx',
  'src/pages/FarmerRemindersTab.jsx',
  'src/pages/FarmerDashboardPage.jsx',
];
const farmerDir = path.join(R, 'src/pages/farmer');
if (fs.existsSync(farmerDir)) {
  for (const f of fs.readdirSync(farmerDir)) {
    if (f.endsWith('.jsx') && !f.includes('.test.')) FILES.push('src/pages/farmer/' + f);
  }
}

for (const rel of FILES) {
  const p = path.join(R, rel);
  let s = '';
  try { s = fs.readFileSync(p, 'utf8'); } catch { continue; }
  const hits = (s.match(/\.toLocaleDateString\(/g) || []).length;
  if (hits > 0) {
    E.push(`${rel}: ${hits} raw .toLocaleDateString( — use formatDate(value, lang) so the date follows the app language`);
  }
}

if (E.length) {
  console.error('[check:farmer-date-locale] FAIL — ' + E.length + ' file(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:farmer-date-locale] PASS — ' + FILES.length + ' farmer-facing screens render dates via '
  + 'formatDate(value, lang) (app language), never the device OS locale.');
