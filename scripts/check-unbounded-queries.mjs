#!/usr/bin/env node
/**
 * scripts/check-unbounded-queries.mjs — scalability ratchet gate.
 *
 * Unbounded Prisma `findMany()` calls (no `take:`/`limit`) are the
 * classic "works in the pilot, melts at a million rows" trap. There
 * are many pre-existing FK-scoped findMany() calls that return few
 * rows and are safe to leave; rewriting them blind would risk
 * truncating lists the UI needs. So instead of capping all of them,
 * this gate RATCHETS: it counts unbounded findMany() across server/src
 * and FAILS if the count rises above the recorded baseline — i.e. no
 * NEW unbounded list query may be introduced. New list endpoints must
 * ship with a `take:`/`limit` (pagination/cap) from day one.
 *
 * Lower the baseline whenever a query is bounded. Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRV = path.join(ROOT, 'server/src');

// Baseline = the count measured at introduction. The gate fails if the
// live count EXCEEDS this. Ratchet it DOWN as queries get bounded.
const BASELINE = 137;

const files = [];
(function walk(d) {
  let entries;
  try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__' || e.name === 'tests') continue;
      walk(f);
    } else if (e.isFile() && f.endsWith('.js')) {
      files.push(f);
    }
  }
})(SRV);

let unbounded = 0, total = 0;
const offenders = [];
for (const f of files) {
  let s; try { s = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const lines = s.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/\.findMany\s*\(/.test(lines[i])) {
      total++;
      const win = lines.slice(i, i + 8).join('\n');
      // Bounded if a take:/limit appears within the call window.
      if (!/\btake\s*:/.test(win) && !/\blimit\b/.test(win)) {
        unbounded++;
        offenders.push(path.relative(ROOT, f).replace(/\\/g, '/') + ':' + (i + 1));
      }
    }
  }
}

if (unbounded > BASELINE) {
  console.error('[check:unbounded-queries] FAIL');
  console.error(`  ✗ unbounded findMany() rose to ${unbounded} (baseline ${BASELINE}).`);
  console.error('    A new list query was added without take:/limit. Add a cap or pagination.');
  console.error('    Newest offenders (sample):');
  for (const o of offenders.slice(-8)) console.error('      • ' + o);
  process.exit(1);
}
console.log(`[check:unbounded-queries] PASS — unbounded findMany() = ${unbounded} ≤ baseline ${BASELINE} (of ${total} total). No new unbounded list query.`);
