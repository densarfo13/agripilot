#!/usr/bin/env node
/**
 * scripts/check-outcome-proof.mjs — outcome capture proof.
 *
 * Fails if the outcome proof can PASS without a completed follow-up scan,
 * does not model the four outcome statuses, or does not read the outcome
 * learning loop.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/proof/OutcomeProofRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/__outcomeLearningLoopHealth/.test(raw)) F.push('must read __outcomeLearningLoopHealth');
  else P.push('reads __outcomeLearningLoopHealth');
  for (const f of ['followUpRequested', 'followUpCompleted', 'outcomeRecorded', 'outcomeStatusSelected']) {
    if (!raw.includes(f)) F.push(`must surface ${f}`);
  }
  if (!F.some((m) => m.includes('must surface'))) P.push('follow-up + outcome fields present');
  // PASS must require followUpCompleted.
  const passWindow = (() => {
    const i = src.search(/(proofStatus\s*=\s*'PASS'|passable\s*=)/);
    return i >= 0 ? src.slice(Math.max(0, i - 40), i + 240) : '';
  })();
  if (!/followUpCompleted/.test(passWindow) && !/passable[\s\S]{0,160}followUpCompleted/.test(src))
    F.push('PASS must require followUpCompleted (a real follow-up scan)');
  else P.push('PASS requires a completed follow-up scan');
  // The four outcome statuses must be documented/modeled.
  const statuses = ['improved', 'unchanged', 'worsened', 'unknown'];
  const miss = statuses.filter((s) => !new RegExp(s, 'i').test(raw));
  if (miss.length) F.push(`must model outcome statuses: ${miss.join(', ')}`);
  else P.push('improved / unchanged / worsened / unknown modeled');
}

if (F.length) {
  console.error('[check:outcome-proof] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:outcome-proof] PASS — needs a real follow-up scan, models the four statuses.');
for (const m of P) console.log('  ✓ ' + m);
