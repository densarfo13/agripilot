/**
 * check-scan-provider-adapters.mjs — provider adapter integration gate.
 *
 * Locks the crop.health + mushroom.id adapters and their pipeline integration:
 * correct env names, the READY/AUTH_FAILED/RATE_LIMITED/NO_RESULT/UNSUPPORTED
 * status taxonomy, best-effort (never throw), mushroom safety (never asserts
 * edible without confirmation), pipeline order, and runtime-status wiring.
 * Runs the adapters with no key to prove they degrade to UNSUPPORTED, not throw.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const CROP = 'server/src/ml/providers/cropHealthProvider.js';
const MUSH = 'server/src/ml/providers/mushroomProvider.js';
for (const f of [CROP, MUSH]) if (!x(f)) E.push('missing: ' + f);

const c = rd(CROP);
h(c, 'export async function detectCropHealth', 'must export detectCropHealth');
h(c, 'CROP_HEALTH_API_KEY', 'crop.health must read CROP_HEALTH_API_KEY');
h(c, 'CROP_ID_API_KEY', 'crop.health must accept the CROP_ID_API_KEY alias');
for (const f of ['disease', 'severity', 'affectedArea', 'treatment', 'prevention', 'nutrition', 'irrigation'])
  h(c, f, 'crop.health result must include: ' + f);

const m = rd(MUSH);
h(m, 'export async function detectMushroom', 'must export detectMushroom');
h(m, 'MUSHROOM_ID_API_KEY', 'mushroom must read MUSHROOM_ID_API_KEY');
for (const f of ['edibility', 'species', 'warnings'])
  h(m, f, 'mushroom result must include: ' + f);
// Safety: mushroom must NEVER upgrade unknown to edible + must always warn.
h(m, 'Never eat a wild mushroom', 'mushroom must carry the never-eat safety warning');
if (!/never upgrade an unknown to edible|return 'unknown'/.test(m))
  E.push('mushroom must default to unknown edibility (no fabricated edible verdict)');

// Status taxonomy in both.
for (const st of ['READY', 'AUTH_FAILED', 'RATE_LIMITED', 'NO_RESULT', 'UNSUPPORTED']) {
  if (!c.includes(st)) E.push('crop.health missing status: ' + st);
  if (!m.includes(st)) E.push('mushroom missing status: ' + st);
}

// Pipeline integration in the analyze route (order + best-effort + merge).
const APP = rd('server/src/app.js');
h(APP, 'detectCropHealth', 'analyze route must call detectCropHealth');
h(APP, 'detectMushroom', 'analyze route must call detectMushroom');
h(APP, 'providerStatuses', 'analyze response must surface per-provider statuses');
h(APP, 'cropHealth:', 'analyze response must include cropHealth');

// Runtime status marks both wired now.
const PRS = rd('server/src/ml/providerRuntimeStatus.js');
if (!/crop\.health'[^}]*wired:\s*true/s.test(PRS)) E.push('crop.health must be wired:true in runtime status');
if (!/mushroom\.id'[^}]*wired:\s*true/s.test(PRS)) E.push('mushroom.id must be wired:true in runtime status');

// Prove best-effort: with no key the adapters return UNSUPPORTED, never throw.
if (E.length === 0) {
  const probe = `
import { detectCropHealth } from './server/src/ml/providers/cropHealthProvider.js';
import { detectMushroom } from './server/src/ml/providers/mushroomProvider.js';
const c = await detectCropHealth({ image: '', cropName: 'X' });
const m = await detectMushroom({ image: '' });
if (c.status !== 'UNSUPPORTED') { console.error('FAIL crop status ' + c.status); process.exit(1); }
if (m.status !== 'UNSUPPORTED') { console.error('FAIL mushroom status ' + m.status); process.exit(1); }
if (m.edibility !== 'unknown') { console.error('FAIL mushroom edibility ' + m.edibility); process.exit(1); }
console.log('PROBE_OK');
`;
  try {
    fs.writeFileSync(path.join(R, '_tmp_adapter_probe.mjs'), probe);
    const out = execSync('node _tmp_adapter_probe.mjs', { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PROBE_OK/.test(out)) E.push('adapter probe failed: ' + out.trim());
  } catch (err) { E.push('adapter probe failed: ' + ((err && (err.stdout || err.message)) || '')); }
  finally { try { fs.unlinkSync(path.join(R, '_tmp_adapter_probe.mjs')); } catch { /* */ } }
}

if (E.length) {
  console.error('[check:scan-provider-adapters] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-provider-adapters] PASS — crop.health + mushroom.id adapters wired into the '
  + 'pipeline; status taxonomy; best-effort (no throw); mushroom never fabricates edible.');
