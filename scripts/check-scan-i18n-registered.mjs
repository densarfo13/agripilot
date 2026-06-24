/**
 * check-scan-i18n-registered.mjs — sprint #222.
 *
 * Root cause of the Twi English-leak P0: the production scan cards call
 * tSafe('scan.intel.*' / 'scanCommand.*', 'English default'), but those
 * keys were never registered in T-en.js. tSafe silently returns the
 * English default for an UNregistered key, and check:translations only
 * validates keys that EXIST in T-en — so the leak was invisible to every
 * gate. This gate closes that blind spot: every tSafe key called in the
 * scan-result UI MUST be registered in the EN canonical column.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EN = path.join(ROOT, 'src/i18n/columns/T-en.js');
const COMPONENTS = [
  'src/components/scan/IntelligentScanResult.jsx',
  'src/components/scan/ScanCommandCard.jsx',
  'src/components/scan/UsefulResultCard.jsx',
  'src/components/scan/ScanResultCard.jsx',
];

const en = fs.readFileSync(EN, 'utf8');
const registered = new Set(
  (en.match(/"([a-zA-Z0-9_.]+)":/g) || []).map(s => s.slice(1, s.indexOf('":')))
);

const missing = [];
for (const rel of COMPONENTS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  // Match tSafe('some.key' — captures the key as the 1st argument.
  const calls = src.match(/tSafe\(\s*'([a-zA-Z0-9_.]+)'/g) || [];
  for (const c of calls) {
    const key = c.replace(/tSafe\(\s*'/, '').replace(/'$/, '');
    // Dynamic/templated keys (with ${}) can't be statically checked — skip.
    if (key.includes('${') || key.includes('+')) continue;
    if (!registered.has(key)) missing.push(`${rel}: tSafe('${key}') not registered in T-en.js`);
  }
}

if (missing.length) {
  console.error('[check:scan-i18n-registered] FAIL — ' + missing.length
    + ' scan UI key(s) call tSafe but are NOT registered in T-en.js (would render English in every locale):');
  for (const m of missing) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:scan-i18n-registered] PASS — every tSafe key in the scan-result cards is registered in T-en.js (no silent English fallback).');
