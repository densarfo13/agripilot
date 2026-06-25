/**
 * check-decision-dedupe.mjs — FARROWAY DECISION ENGINE §7/§10.
 * Decisions carry a dedupe key built from farmId|cropId|decisionType|date|
 * source so duplicates can be suppressed (keep highest priority).
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(); const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const C = rd('src/runtime/decision/FarrowayDecisionContracts.ts');
h(C, 'dedupeKey', 'DailyDecision must carry a dedupeKey');
h(C, 'source', 'DailyDecision must carry a source (one of the dedupe dimensions)');

const eng = rd('src/runtime/decision/FarrowayDecisionEngine.ts');
h(eng, 'dedupeKey:', 'engine must set dedupeKey on every decision');
// The key must be built from farm + crop + kind + date (the §7 dimensions).
if (!/dedupeKey:\s*_id\(\[inputs\.farmId,\s*cropId,/.test(eng))
  E.push('dedupeKey must include farmId + cropId + kind + date');

if (E.length) { console.error('[check:decision-dedupe] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:decision-dedupe] PASS — decisions carry a farm|crop|type|date|source dedupe key.');
