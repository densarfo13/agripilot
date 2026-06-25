/**
 * check-crop-health-wired.mjs — fail if CROP_HEALTH_API_KEY is read but no
 * adapter calls crop.health. The server adapter must read the key AND the
 * analyze route must call it AND runtime status must mark it wired.
 */
import fs from 'node:fs';
import path from 'node:path';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const adapter = rd('server/src/ml/providers/cropHealthProvider.js');
h(adapter, 'CROP_HEALTH_API_KEY', 'crop.health adapter must read CROP_HEALTH_API_KEY');
h(adapter, 'fetch(', 'crop.health adapter must actually call the provider API');
h(adapter, 'export async function detectCropHealth', 'must export detectCropHealth');

const app = rd('server/src/app.js');
h(app, 'detectCropHealth', 'analyze route must call detectCropHealth (key read but unused = fail)');

if (!/crop\.health'[^}]*wired:\s*true/s.test(rd('server/src/ml/providerRuntimeStatus.js')))
  E.push('crop.health must be wired:true now that an adapter exists');

if (E.length) { console.error('[check:crop-health-wired] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:crop-health-wired] PASS — CROP_HEALTH_API_KEY is read by an adapter that calls crop.health + is wired.');
