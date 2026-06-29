/**
 * SellDecisionEngine.test.ts — locks the honest sell-decision verdict. Self-running:
 * `tsx SellDecisionEngine.test.ts`. Prints PASS or exits 1.
 */
import { decideSell } from '../sellDecisionEngine';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// ── The four verdicts ────────────────────────────────────────────────
ok(decideSell({ buyerInterestCount: 0, priceAvailable: true }).code === 'NO_BUYERS_FOUND', 'no buyers → NO_BUYERS_FOUND');
ok(decideSell({ buyerInterestCount: 3, priceAvailable: false }).code === 'NEED_MORE_PRICE_DATA', 'buyers + no price → NEED_MORE_PRICE_DATA');
ok(decideSell({ buyerInterestCount: 3, priceAvailable: true }).code === 'SELL_NOW', 'buyers + price → SELL_NOW');
ok(decideSell({ buyerInterestCount: 3, priceAvailable: true, priceTrend: 'up' }).code === 'WAIT', 'rising price → WAIT');

// ── WAIT only on a REAL rising signal — never a guess ────────────────
ok(decideSell({ buyerInterestCount: 5, priceAvailable: true, priceTrend: 'down' }).code === 'SELL_NOW', 'falling price ≠ WAIT (SELL_NOW)');
ok(decideSell({ buyerInterestCount: 5, priceAvailable: true, priceTrend: 'flat' }).code === 'SELL_NOW', 'flat price ≠ WAIT');
ok(decideSell({ buyerInterestCount: 5, priceAvailable: false, priceTrend: 'up' }).code === 'NEED_MORE_PRICE_DATA', 'no price ref → cannot claim WAIT');

// ── priceBacked flag is honest ───────────────────────────────────────
ok(decideSell({ buyerInterestCount: 0, priceAvailable: false }).priceBacked === false, 'no-buyers is not price-backed');
ok(decideSell({ buyerInterestCount: 3, priceAvailable: false }).priceBacked === false, 'need-more-data is not price-backed');
ok(decideSell({ buyerInterestCount: 3, priceAvailable: true }).priceBacked === true, 'sell-now is price-backed');

// ── Robustness ───────────────────────────────────────────────────────
ok(decideSell({ buyerInterestCount: -2, priceAvailable: true } as any).code === 'NO_BUYERS_FOUND', 'negative buyers → NO_BUYERS_FOUND');
ok(decideSell({} as any).code === 'NO_BUYERS_FOUND', 'empty input → NO_BUYERS_FOUND, no throw');

// ── NEVER fabricates a price: no verdict string contains a price number/currency ──
const codes = ['SELL_NOW', 'WAIT', 'NEED_MORE_PRICE_DATA', 'NO_BUYERS_FOUND'] as const;
for (const c of codes) {
  const v = decideSell(
    c === 'NO_BUYERS_FOUND' ? { buyerInterestCount: 0, priceAvailable: false }
    : c === 'NEED_MORE_PRICE_DATA' ? { buyerInterestCount: 2, priceAvailable: false }
    : c === 'WAIT' ? { buyerInterestCount: 2, priceAvailable: true, priceTrend: 'up' }
    : { buyerInterestCount: 2, priceAvailable: true });
  const text = [v.titleFallback, v.reasonFallback, v.nextStepFallback].join(' ');
  ok(!/[0-9]/.test(text), `${c}: copy contains no fabricated number`);
  ok(!/[$₵€£₦]|GHS|KES|USD/.test(text), `${c}: copy contains no fabricated currency`);
}

console.log('[SellDecisionEngine] PASS — ' + passed + ' assertions. Four honest verdicts; WAIT only on a real '
  + 'rising-price signal; never invents a price or currency.');
