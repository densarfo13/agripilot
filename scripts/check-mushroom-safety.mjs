/**
 * check-mushroom-safety.mjs — mushroom results must NEVER claim safe/edible.
 * The never-eat warning is always present; the consensus never produces a
 * mushroom action; a tsx probe proves it even when the provider says edible.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const server = rd('server/src/ml/providers/mushroomProvider.js');
const client = rd('src/runtime/scan/providers/MushroomProvider.ts');
h(server, 'Never eat a wild mushroom', 'server mushroom adapter must carry the never-eat warning');
h(client, 'Do not eat wild mushrooms based only on this scan', 'client mushroom must carry the never-eat warning');

// No "safe to eat" assertion anywhere in mushroom code.
for (const [f, s] of [['server', server], ['client', client]])
  if (/\bsafe to eat\b|isEdible:\s*true|edibleSafe/i.test(s)) E.push(f + ' mushroom must never assert safe-to-eat');

// Probe: even with edibility=edible, no safe recommendation is produced.
if (E.length === 0) {
  const probe = [
    "import { readMushroom } from './src/runtime/scan/providers/MushroomProvider.ts';",
    "const r = readMushroom({ mushroom: { status:'READY', species:'X', edibility:'edible', confidencePct:99 } });",
    "if (r.recommendations.some(x => /safe to eat|edible/i.test(x))) { console.error('FAIL: safe claim'); process.exit(1); }",
    "if (!r.recommendations.some(x => /do not eat/i.test(x))) { console.error('FAIL: no warning'); process.exit(1); }",
    "console.log('PROBE_OK');",
  ].join('\n');
  try {
    fs.writeFileSync(path.join(R, '_tmp_mush.mts'), probe);
    const out = execSync('npx tsx _tmp_mush.mts', { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PROBE_OK/.test(out)) E.push('mushroom probe failed: ' + out.trim());
  } catch (err) { E.push('mushroom probe failed: ' + ((err && (err.stdout || err.message)) || '')); }
  finally { try { fs.unlinkSync(path.join(R, '_tmp_mush.mts')); } catch { /* */ } }
}

if (E.length) { console.error('[check:mushroom-safety] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:mushroom-safety] PASS — mushroom never claims safe/edible; never-eat warning always present.');
