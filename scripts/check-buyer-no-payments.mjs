#!/usr/bin/env node
/**
 * scripts/check-buyer-no-payments.mjs — Lock the buyer MVP
 * scope. NO payments, escrow, bidding, or settlement code may
 * land in the buyer-facing surfaces.
 *
 * Hard blockers (when matched outside an allow-listed admin
 * surface):
 *   A. payments / pay-now / checkout / cart literals
 *   B. escrow / settlement / wire-transfer
 *   C. bidding / auction
 *   D. Stripe / PayPal / Plaid SDK imports
 *
 * Strict-rule audit
 *   • Read-only. Never mutates source.
 *   • Strips JS/JSX comments before pattern-matching so safety
 *     assertions ("// No payments / escrow") never false-positive.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function readOrEmpty(f) {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}

function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist'
          || e.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

// Buyer-facing files = files that name buyer/sell concepts but
// aren't admin/staff-internal. We grep the src tree.
const SRC_DIR = path.join(ROOT, 'src');

// Admin / internal surfaces — these CAN reference payments to
// support read-only buyer-management ops, not to charge.
const ALLOWLISTED = new Set([
  // flowerMarketplaceGate.js IS the safety gate — it lists
  // banned concepts in plain language so the OFF state is
  // explicit and auditable. Allow-listing the gate itself
  // does not weaken enforcement; the gate keeps the feature
  // OFF, and the rest of the codebase must still avoid the
  // banned patterns.
  'src/runtime/grow/flowermarketplacegate.js',
]);

const FORBIDDEN = [
  { name: 'stripe-sdk',     re: /from\s+['"](@stripe\/[^'"]*|stripe)['"]/ },
  { name: 'paypal-sdk',     re: /from\s+['"](@paypal\/[^'"]*|paypal-rest-sdk)['"]/ },
  { name: 'plaid-sdk',      re: /from\s+['"](plaid|@plaid\/[^'"]*)['"]/ },
  { name: 'payments-route', re: /path\s*=\s*['"]\/(pay|checkout|cart|payments?)['"]/ },
  { name: 'pay-now-button', re: /["']Pay\s+Now["']/i },
  { name: 'escrow',         re: /\bescrow\b/i },
  { name: 'settlement',     re: /\bsettlement\b/i },
  { name: 'wire-transfer',  re: /\bwire[\s_-]?transfer\b/i },
  { name: 'bidding',        re: /\bbidding\b/i },
  { name: 'auction',        re: /\bauction\b/i },
];

// Restrict the scan to files that are involved in the buyer or
// sell surface so we don't false-positive on admin tooling that
// merely mentions concepts.
const BUYER_KEYWORD = /(buyer|sell|ready[-_]to[-_]sell|marketplace)/i;

const violators = [];
for (const f of walk(SRC_DIR)) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  if (ALLOWLISTED.has(rel.toLowerCase())) continue;
  const rawSrc = readOrEmpty(f);
  const src = stripComments(rawSrc);
  if (!BUYER_KEYWORD.test(rel) && !BUYER_KEYWORD.test(src)) continue;
  for (const { name, re } of FORBIDDEN) {
    if (re.test(src)) {
      violators.push({ rel, name, re: re.toString() });
    }
  }
}

if (violators.length > 0) {
  for (const v of violators) {
    fail(`buyer-no-payments: ${v.rel} contains forbidden ${v.name} pattern ${v.re}`);
  }
} else {
  pass(`buyer-no-payments: no payments / escrow / bidding / auction code in buyer surfaces`);
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:buyer-no-payments] FAIL — buyer scope leaked.');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:buyer-no-payments] PASS — buyer surfaces stay scope-clean.');
