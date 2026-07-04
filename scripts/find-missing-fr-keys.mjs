// find-missing-fr-keys.mjs — list tSafe/tStrict keys used in farmer-facing surfaces
// that are MISSING from the French column (the language-mismatch bug class).
import fs from 'node:fs';
import path from 'node:path';
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const s = fs.statSync(p); if (s.isDirectory()) walk(p); else if (/\.(jsx|js)$/.test(f)) files.push(p); } };
['src/components/home', 'src/components/farmBrain', 'src/components/daily', 'src/pages'].forEach((d) => { try { walk(d); } catch { /* skip */ } });
const fr = fs.readFileSync('src/i18n/columns/T-fr.js', 'utf8');
const pairs = {};
const re = /t(?:Safe|Strict)\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'/g;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) {
    if (!fr.includes("'" + m[1] + "'") && !fr.includes('"' + m[1] + '"')) pairs[m[1]] = m[2];
  }
}
const keys = Object.keys(pairs);
console.log('MISSING FROM fr: ' + keys.length);
keys.forEach((k) => console.log(k + ' ||| ' + pairs[k]));
