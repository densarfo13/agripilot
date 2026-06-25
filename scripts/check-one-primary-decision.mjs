/**
 * check-one-primary-decision.mjs — FARROWAY DECISION ENGINE §10.
 * Home shows exactly ONE primary daily decision; the engine returns one
 * dailyDecision with a priority and ≤3 supporting insights.
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(); const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const HOME = rd('src/pages/Home.jsx');
const mounts = (HOME.match(/<DecisionHero\b/g) || []).length;
if (mounts !== 1) E.push('Home must mount exactly ONE <DecisionHero> (found ' + mounts + ')');

const eng = rd('src/runtime/decision/FarrowayDecisionEngine.ts');
h(eng, 'priority: 1', 'primary decision must carry priority 1');
h(eng, 'supportingInsights', 'engine must return supporting insights (≤3)');
if (!/slice\(0,\s*3\)/.test(eng)) E.push('supporting insights must be capped at 3');
h(rd('src/components/home/DecisionHero.jsx'), 'data-testid="decision-hero"', 'DecisionHero must carry its testid');

if (E.length) { console.error('[check:one-primary-decision] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:one-primary-decision] PASS — exactly one primary decision on Home; ≤3 supporting insights.');
