#!/usr/bin/env node
/**
 * scripts/check-sell-duplicate-copy.mjs — §6 SELL PAGE DUPLICATE FIX.
 *
 * Fails when the main Sell.jsx render path contains two "Sell your
 * produce" titles at the same time (the PremiumPageHero title AND a
 * second <h1> inside the form card). Error/success state titles are
 * allowed — they render in separate branches and never appear together.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const sell = read('src/pages/Sell.jsx');
if (!sell) F.push('src/pages/Sell.jsx: missing');
else {
  // The pattern that caused the duplicate: a <h1>{tSafe('market.sellTitle',...)}</h1>
  // sitting AFTER the PremiumPageHero block. The hero already shows the title
  // via title= prop; the in-form <h1> was the second render of the same string.
  const formCardDuplicate = /ref=\{formRef\}[\s\S]{0,400}<h1[\s\S]{0,200}market\.sellTitle/;
  if (formCardDuplicate.test(sell))
    F.push('Sell.jsx form card must not re-render the page title (market.sellTitle) — would duplicate the PremiumPageHero title');
  else P.push('Sell.jsx form card no longer re-renders market.sellTitle');

  // The page should still have ONE hero title.
  if (!/title=\{tSafe\('sell\.title'/.test(sell))
    F.push('Sell.jsx must keep a single PremiumPageHero title (sell.title)');
  else P.push('single PremiumPageHero title kept');

  // The action-first prompt the spec asks for (named-crop variant).
  if (!/market\.listPrompt(WithCrop)?/.test(sell))
    F.push('Sell.jsx must show the action-first list prompt (market.listPrompt[WithCrop])');
  else P.push('action-first list prompt present');
}

if (F.length) {
  console.error('[check:sell-duplicate-copy] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:sell-duplicate-copy] PASS — single Sell hero title, no duplicate in form card, action prompt present.');
for (const m of P) console.log('  ✓ ' + m);
