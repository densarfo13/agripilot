/**
 * run-provider-scan-test.mjs — 20 live scans across all providers.
 *
 * POSTs N images to the deployed /api/scan/analyze and logs each scan's
 * per-provider status (plantId / cropHealth / insectId / mushroom). HONEST: it
 * never fabricates results — with no base URL / token / images it prints the
 * per-provider runtime status from /api/scan/diagnostics and exits with a clear
 * "live run pending" message.
 *
 *   SCAN_API_BASE=https://app SCAN_API_TOKEN=… SCAN_IMAGE_DIR=./imgs \
 *   node scripts/run-provider-scan-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SCAN_API_BASE || '';
const TOKEN = process.env.SCAN_API_TOKEN || '';
const IMG_DIR = process.env.SCAN_IMAGE_DIR || '';
const N = Number(process.env.SCAN_N || 20);

async function diagnostics() {
  if (!BASE) return null;
  try {
    const res = await fetch(BASE.replace(/\/$/, '') + '/api/scan/diagnostics', {
      headers: TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {},
    });
    return res.ok ? await res.json() : { httpError: res.status };
  } catch (e) { return { error: String(e && e.message || e) }; }
}

async function main() {
  console.log('=== PROVIDER SCAN TEST (' + N + ' scans) ===');
  const diag = await diagnostics();
  console.log('\n[runtime provider status] (from /api/scan/diagnostics)');
  if (diag && Array.isArray(diag.providers)) {
    for (const p of diag.providers) {
      console.log('  ' + p.providerName + ': envPresent=' + p.envPresent
        + ' wired=' + p.providerWired + ' reason=' + p.failureReason
        + ' fp=' + (p.keyFingerprint || '∅'));
    }
  } else {
    console.log('  unavailable (no SCAN_API_BASE or endpoint not reachable).');
  }

  const imgs = IMG_DIR && fs.existsSync(IMG_DIR)
    ? fs.readdirSync(IMG_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).slice(0, N) : [];
  const canRun = !!(BASE && TOKEN && imgs.length);

  if (!canRun) {
    console.log('\nRESULT: LIVE RUN PENDING — set SCAN_API_BASE + SCAN_API_TOKEN + SCAN_IMAGE_DIR');
    console.log('(20 images) to run the real provider test. No results are fabricated.');
    process.exit(0);
  }

  console.log('\n[scans] scanId | plantId | cropHealth | insectId | mushroom');
  const tally = { plantId: {}, cropHealth: {}, insectId: {}, mushroom: {} };
  for (let i = 0; i < imgs.length; i++) {
    try {
      const buf = fs.readFileSync(path.join(IMG_DIR, imgs[i]));
      const res = await fetch(BASE.replace(/\/$/, '') + '/api/scan/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
        body: JSON.stringify({ image: buf.toString('base64'), mime: 'image/jpeg' }),
      });
      const j = res.ok ? await res.json() : { providerStatuses: {} };
      const st = j.providerStatuses || {};
      console.log('  scan-' + (i + 1) + ' | ' + (st.plantId || '?') + ' | ' + (st.cropHealth || '?')
        + ' | ' + (st.insectId || '?') + ' | ' + (st.mushroom || '?'));
      for (const k of Object.keys(tally)) { const v = st[k] || '?'; tally[k][v] = (tally[k][v] || 0) + 1; }
    } catch (e) {
      console.log('  scan-' + (i + 1) + ' | ERROR ' + (e && e.message));
    }
  }
  console.log('\n[summary] per-provider status counts:');
  for (const k of Object.keys(tally)) console.log('  ' + k + ': ' + JSON.stringify(tally[k]));
  process.exit(0);
}
main().catch((e) => { console.error('harness error: ' + (e && e.message)); process.exit(0); });
