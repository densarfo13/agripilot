/**
 * check-design-primitives.mjs — the design system must obey its OWN rules.
 * For every shared primitive (src/design/components/*.jsx), assert:
 *   1. NO hardcoded hex colors (must reference tokens).
 *   2. Every COLORS.<key> referenced ACTUALLY EXISTS in tokens/colors.js
 *      (catches phantom tokens like the old `COLORS.danger` whose `|| '#hex'`
 *       fallback silently rendered an off-palette color).
 * This is the "reject hardcoded values / wrong colors" visual-consistency test.
 */
import fs from 'node:fs';
import path from 'node:path';
const R = process.cwd();
const E = [];
const colorsSrc = fs.readFileSync(path.join(R, 'src/design/tokens/colors.js'), 'utf8');
// Extract COLORS keys from the frozen object (lines like `  keyName: '...'`).
const KEYS = new Set();
for (const m of colorsSrc.matchAll(/^\s*([a-zA-Z][a-zA-Z0-9]*)\s*:/gm)) KEYS.add(m[1]);

const dir = path.join(R, 'src/design/components');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsx'));
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const line of src.split(/\r?\n/)) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;                 // skip comment lines (both checks)
    const code = line.replace(/\/\/.*$/, '');                       // strip trailing line comments
    const hex = code.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (hex) E.push(`${f}: hardcoded hex ${hex.join(', ')} — use src/design/tokens/colors.js`);
    for (const m of code.matchAll(/COLORS\.([a-zA-Z][a-zA-Z0-9]*)/g)) {
      if (!KEYS.has(m[1])) E.push(`${f}: references COLORS.${m[1]} which does NOT exist in colors.js (phantom token)`);
    }
  }
}
if (E.length) { console.error('[check:design-primitives] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:design-primitives] PASS — ' + files.length + ' primitives are fully token-driven: '
  + 'zero hardcoded hex, every COLORS.<key> resolves to a real token (' + KEYS.size + ' palette keys).');
