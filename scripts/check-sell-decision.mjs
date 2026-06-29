/**
 * check-sell-decision.mjs — Market Intelligence MVP: the honest sell-decision verdict +
 * runs its test. Locks: four verdicts exist, the engine never emits a price number/currency
 * (no fabricated prices), and the Sell card renders it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const ENG  = 'src/runtime/market/sellDecisionEngine.ts';
const TEST = 'src/runtime/market/__tests__/SellDecisionEngine.test.ts';
const CARD = 'src/components/sell/MarketInsightCard.jsx';
for (const f of [ENG, TEST, CARD]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);

const eng = rd(ENG);
if (!eng.includes('export function decideSell')) E.push('must export decideSell');
for (const code of ['SELL_NOW', 'WAIT', 'NEED_MORE_PRICE_DATA', 'NO_BUYERS_FOUND'])
  if (!eng.includes(code)) E.push('engine must handle ' + code);
// Honesty: the engine must NOT contain a hardcoded price number or currency in its copy.
// A price would look like $5 / ₵5 / GHS 5 — flag those, but NOT the `${k}` template token.
if (/[₵€£₦]\s*\d|\$\s*\d|\b(GHS|KES|USD)\b\s*\d/.test(eng)) E.push('engine must not contain a price/currency value — never fabricate a price');

const card = rd(CARD);
if (!card.includes('decideSell')) E.push('MarketInsightCard must render the sell decision (decideSell)');

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('sell-decision test did not PASS: ' + out.trim());
  } catch (err) { E.push('sell-decision test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}

if (E.length) { console.error('[check:sell-decision] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:sell-decision] PASS — four honest sell verdicts (SELL_NOW/WAIT/NEED_MORE_PRICE_DATA/'
  + 'NO_BUYERS_FOUND); WAIT only on a real rising-price signal; never fabricates a price; Sell card renders it; test green.');
