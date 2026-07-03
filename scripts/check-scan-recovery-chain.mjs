/**
 * check-scan-recovery-chain.mjs — locks the self-healing scan chain: automatic
 * validate→repair→primary→retry→secondary→queue→review transitions, farmer-safe
 * progress copy, never dead-ends. Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const SRC = 'src/runtime/scan/ScanRecoveryChain.ts';
const src = (() => { try { return fs.readFileSync(path.join(R, SRC), 'utf8'); } catch { return ''; } })();
if (!src) E.push('missing: ' + SRC);
for (const s of ['runScanRecoveryChain', 'secondary', 'queue', 'resolveScanTerminalState', 'isRetriableScanFailure'])
  if (!src.includes(s)) E.push('chain missing: ' + s);
if (/provider name|Plant\.id|plantnet/i.test(src)) E.push('chain must not expose provider names in farmer copy');
if (E.length === 0) {
  try {
    const out = execSync('npx tsx src/runtime/scan/__tests__/ScanRecoveryChain.test.ts', { cwd: R, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
    if (!/PASS/.test(out)) E.push('test did not PASS');
  } catch (err) { E.push('test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}
if (E.length) { console.error('[check:scan-recovery-chain] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-recovery-chain] PASS — automatic recovery chain (retry/secondary/queue/review), farmer-safe copy, never dead-ends; test green.');
