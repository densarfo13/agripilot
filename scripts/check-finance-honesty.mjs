/**
 * check-finance-honesty.mjs — locks the Phase-2 finance rules: consent gates sharing,
 * eligibility is a label (never approval wording), yield/revenue never fabricated,
 * partners never invented. Runs the engine test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const SRC = 'src/runtime/finance/FinanceEligibilityEngine.ts';
const src = (() => { try { return fs.readFileSync(path.join(R, SRC), 'utf8'); } catch { return ''; } })();
if (!src) E.push('missing: ' + SRC);
for (const t of ['BANNED_FINANCE_WORDING', 'no_live_feed', 'consentGranted', 'matchPartnerOffers', 'financeAuditEvent'])
  if (!src.includes(t)) E.push('engine missing: ' + t);
if (/estimatedYield:\s*[0-9]/.test(src) || /estimatedRevenue:\s*[0-9]/.test(src)) E.push('fabricated yield/revenue number');
if (E.length === 0) {
  try {
    const out = execSync('npx tsx src/runtime/finance/__tests__/FinanceEligibilityEngine.test.ts', { cwd: R, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
    if (!/PASS/.test(out)) E.push('test did not PASS');
  } catch (err) { E.push('test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}
if (E.length) { console.error('[check:finance-honesty] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:finance-honesty] PASS — consent-gated finance matching; label-only eligibility, no approvals, no fabricated numbers, no invented partners; test green.');
