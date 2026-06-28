/**
 * check-scan-no-healthy-claim.mjs — Trust layer: a scan can confirm the ABSENCE of
 * visible disease, not "health". Bans the overstating English claim ("Looks healthy",
 * "appears healthy", a bare 'Healthy' status label) from scan-result UI, and requires
 * the honest phrasing to be present. (The farmer's OWN "Looks healthy" feedback button
 * lives in the i18n column, not a scan component, so it is untouched.)
 */
import fs from 'node:fs';
import path from 'node:path';

const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const OVERSTATE = /Looks healthy|Looks Healthy|appears healthy|\blabel:\s*'Healthy'\b/;

// 1. No scan-result component may make the overstating health claim.
function scanDir(rel) {
  let files = [];
  try { files = fs.readdirSync(path.join(R, rel)).filter((f) => /\.(jsx?|tsx?)$/.test(f) && !/\.test\./.test(f)); } catch { return; }
  for (const f of files) {
    const full = rel + '/' + f;
    if (OVERSTATE.test(stripComments(rd(full)))) {
      E.push(`scan UI claims "healthy" in ${full} — say "No obvious disease detected" / "No disease seen" instead (a scan can't confirm health)`);
    }
  }
}
scanDir('src/components/scan');

// 2. The garden-mode scan chip's ENGLISH label must not claim health.
const gmt = rd('src/i18n/gardenModeTranslations.js');
const chipLine = (gmt.split(/\r?\n/).find((l) => l.includes('gardenMode.scanChip.healthy')) || '');
if (/en:\s*'[^']*(?:Looks healthy|healthy)[^']*'/i.test(chipLine))
  E.push('gardenMode.scanChip.healthy English label must not claim "healthy" — use "No disease seen"');

// 3. The honest phrasing must actually be present (so the fix is real, not just deletion).
const honestPresent =
     /No obvious disease/.test(rd('src/components/scan/UsefulResultCard.jsx'))
  || /No disease seen/.test(rd('src/components/scan/ScanComparison.jsx'));
if (!honestPresent) E.push('honest phrasing ("No obvious disease detected" / "No disease seen") must be present');

if (E.length) {
  console.error('[check:scan-no-healthy-claim] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-no-healthy-claim] PASS — scan UI never claims "healthy"; it states "No obvious disease detected" / '
  + '"No disease seen" (honest absence-of-visible-disease wording).');
