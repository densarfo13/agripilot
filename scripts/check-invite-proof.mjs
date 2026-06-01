#!/usr/bin/env node
/**
 * scripts/check-invite-proof.mjs — invite flow proof.
 *
 * Fails if the invite proof can PASS from provider configuration alone (no
 * recorded test / acceptance), can PASS while fakeDelivery is true, or does
 * not read __inviteHealth.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/proof/InviteProofRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/__inviteHealth/.test(raw)) F.push('must read __inviteHealth');
  else P.push('reads __inviteHealth');
  // PASS must require a real recorded test / acceptance, not provider config.
  if (!/_proofRun\(/.test(src) || !/(emailInviteTested|smsInviteTested|activationTested)/.test(src))
    F.push('PASS must require a recorded test / acceptance (_proofRun) — not provider config alone');
  else P.push('PASS requires a recorded test / acceptance');
  // fakeDelivery must block a pass.
  if (!/fakeDelivery/.test(raw)) F.push('must surface fakeDelivery and block PASS when true');
  else if (!/fakeDelivery\s*===\s*true|!fakeDelivery|fakeDelivery\s*\?/.test(src))
    F.push('fakeDelivery must gate the verdict (FAIL / not-PASS when true)');
  else P.push('fakeDelivery blocks a pass');
  // Guard: providerConfigured alone must not yield PASS — PASS branch must
  // reference a *Tested flag.
  const passIdx = src.search(/proofStatus\s*=\s*'PASS'/);
  if (passIdx >= 0) {
    const before = src.slice(Math.max(0, passIdx - 320), passIdx + 20);
    if (!/Tested/.test(before)) F.push('the PASS branch must reference a *Tested flag, never provider config alone');
    else P.push('PASS branch references a tested flag');
  }
}

if (F.length) {
  console.error('[check:invite-proof] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:invite-proof] PASS — needs a real recorded test/acceptance, fakeDelivery blocks pass, config-only never passes.');
for (const m of P) console.log('  ✓ ' + m);
