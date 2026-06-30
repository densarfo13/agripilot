/**
 * check-screen-contract.mjs — the Screen Governor. Every core farmer screen must declare a
 * contract in src/design/screenContracts.js: purpose · question · primaryCTA · success.
 * Missing or empty → fail the build (Design Bible §SCREEN GOVERNOR).
 */
import fs from 'node:fs';
import path from 'node:path';
const R = process.cwd();
const E = [];
const src = (() => { try { return fs.readFileSync(path.join(R, 'src/design/screenContracts.js'), 'utf8'); } catch { return ''; } })();

if (!src) { console.error('[check:screen-contract] FAIL: src/design/screenContracts.js missing'); process.exit(1); }

const REQUIRED_SCREENS = ['home', 'myFarm', 'tasks', 'activity', 'scan', 'sell', 'funding'];
const REQUIRED_KEYS = ['purpose', 'question', 'primaryCTA', 'success'];

for (const s of REQUIRED_SCREENS) {
  // Find the screen block: `s: { ... }`
  const re = new RegExp(s + '\\s*:\\s*\\{([\\s\\S]*?)\\}', 'm');
  const m = src.match(re);
  if (!m) { E.push('screen "' + s + '" has no contract'); continue; }
  const block = m[1];
  for (const k of REQUIRED_KEYS) {
    const kv = block.match(new RegExp(k + "\\s*:\\s*'((?:\\\\.|[^'\\\\])*)'"));
    if (!kv || !kv[1] || kv[1].trim().length < 4) E.push(`screen "${s}" missing/empty contract key: ${k}`);
  }
}

if (E.length) { console.error('[check:screen-contract] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:screen-contract] PASS — all ' + REQUIRED_SCREENS.length
  + ' core screens declare purpose + question + primaryCTA + success (one-purpose/one-question/one-CTA governed).');
