#!/usr/bin/env node
/**
 * scripts/check-evidence-chain.mjs — Verify evidence-chain
 * runtime exposes the canonical hash + chain + verification API.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const FAILED = [], PASSED = [];
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

const src = read(path.join(ROOT, 'src/runtime/artifacts/EvidenceChain.ts'));
if (!src) {
  FAILED.push('evidence: src/runtime/artifacts/EvidenceChain.ts missing');
} else {
  for (const sym of ['EVIDENCE_CHAIN_VERSION', 'evidence-chain-v1',
                      'createEvidenceHash', 'linkEvidence',
                      'verifyEvidenceChain', 'evidenceHealth',
                      'installEvidenceChainGlobal',
                      'VERIFICATION_STATUS']) {
    if (!src.includes(sym)) FAILED.push(`evidence: missing "${sym}"`);
  }
  // 4 spec verification statuses.
  for (const status of ['PENDING','VERIFIED','REJECTED','NEEDS_REVIEW']) {
    if (!new RegExp("\\b" + status + "\\s*:").test(src)) {
      FAILED.push(`evidence: VERIFICATION_STATUS missing "${status}"`);
    }
  }
  PASSED.push(`evidence: 4-state verification + hash + chain + verify wired`);
}

if (FAILED.length > 0) {
  console.error('[check:evidence-chain] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:evidence-chain] PASS — evidence chain runtime complete.');
