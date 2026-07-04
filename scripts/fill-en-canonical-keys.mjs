// fill-en-canonical-keys.mjs — every key added to a locale column must exist in the
// canonical T-en.js (check:translations rule). Harvest English values for the fr
// repair-set keys directly from the components' tSafe fallbacks. Idempotent.
import fs from 'node:fs';
import path from 'node:path';
const fr = fs.readFileSync('src/i18n/columns/T-fr.js', 'utf8');
const block = fr.split('Visible-leak fix (2026-07-01)')[1] || '';
const keys = [...block.matchAll(/"([a-zA-Z0-9_.]+)":/g)].map((m) => m[1]);
let en = fs.readFileSync('src/i18n/columns/T-en.js', 'utf8');

const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const s = fs.statSync(p); if (s.isDirectory()) walk(p); else if (/\.(jsx|js)$/.test(f)) files.push(p); } };
['src/components/home', 'src/components/farmBrain', 'src/components/daily', 'src/pages'].forEach((d) => { try { walk(d); } catch { /* skip */ } });
const map = {};
const re = /t(?:Safe|Strict)\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'/g;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) if (map[m[1]] == null) map[m[1]] = m[2].replace(/\\'/g, "'");
}
const lines = [];
for (const k of keys) {
  if (en.includes('"' + k + '"')) continue;
  const v = map[k];
  if (v == null) { console.log('NO EN VALUE for', k); continue; }
  lines.push('  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',');
}
if (lines.length) {
  const idx = en.lastIndexOf('};');
  en = en.slice(0, idx) + '  // Visible-leak fix (2026-07-01): canonical English for the fr repair set\n' + lines.join('\n') + '\n' + en.slice(idx);
  fs.writeFileSync('src/i18n/columns/T-en.js', en);
}
console.log('[fill-en-canonical-keys] added ' + lines.length + ' of ' + keys.length + ' keys to T-en.js');
