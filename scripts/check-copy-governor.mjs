/**
 * check-copy-governor.mjs — the Copy Governor. Farmer-facing text must never expose internal /
 * engineering wording. This is the consolidated enforcement of the Design Bible's COPY GOVERNOR:
 * it scans the i18n locale VALUES (what farmers actually read, in every language) for banned
 * internal terms.
 *
 * Ratchet (non-breaking, like check-design-lint): a committed baseline records the current count
 * of banned terms per locale; the gate FAILS if any locale's count RISES. Existing legitimate
 * usages are absorbed by the baseline; NEW internal wording is rejected. `--update` re-snapshots
 * after copy is cleaned, locking the reduction in.
 *
 * Complements (does not duplicate) the structural gates: check-home-no-internal-terms (Home
 * components), check-decision-no-jargon, check-farmer-facing-ai-language.
 */
import fs from 'node:fs';
import path from 'node:path';
const R = process.cwd();
const DIR = path.join(R, 'src', 'i18n', 'columns');
const BASELINE = path.join(R, 'scripts', 'copy-governor-baseline.json');

// Clearly-internal terms a farmer must never read. Multi-word / brand terms only — generic words
// (service, job, queue) are excluded to avoid false hits on legitimate farmer copy.
const BANNED = [
  /FarmBrain/i, /confidence engine/i, /data quality engine/i, /provider timeout/i,
  /internal error/i, /stack trace/i, /\bbackend\b/i, /\bpipeline\b/i, /\bnull\b/i,
  // NaN must be CASE-SENSITIVE: the JS artifact only ever appears exactly as "NaN",
  // while /\bNaN\b/i falsely bans the common Hausa word "nan" ("here/this") — it was
  // inflating the T-ha baseline with correct farmer copy (found 2026-07-05 when three
  // legitimate Hausa strings tripped the ratchet).
  /undefined/i, /\bNaN\b/,
];

function bannedCount(src) {
  const re = /"[^"]+"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let m, n = 0;
  while ((m = re.exec(src)) !== null) {
    const v = m[1];
    for (const b of BANNED) if (b.test(v)) { n++; break; }
  }
  return n;
}

let cols = [];
try { cols = fs.readdirSync(DIR).filter((f) => /^T-[a-z]{2}\.js$/.test(f)); } catch { /* none */ }
const current = {};
for (const c of cols) {
  try { current[c] = bannedCount(fs.readFileSync(path.join(DIR, c), 'utf8')); } catch { current[c] = 0; }
}

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  const total = Object.values(current).reduce((a, b) => a + b, 0);
  console.log('[check:copy-governor] baseline updated — ' + total + ' banned-term values across ' + cols.length + ' locales.');
  process.exit(0);
}

let baseline = {};
try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
catch { console.error('[check:copy-governor] FAIL: baseline missing — run `node scripts/check-copy-governor.mjs --update`'); process.exit(1); }

const regressions = [];
for (const c of cols) {
  const base = (c in baseline) ? baseline[c] : 0;
  if (current[c] > base) regressions.push(`${c}: internal-wording in farmer copy rose ${base} → ${current[c]}`);
}
if (regressions.length) {
  console.error('[check:copy-governor] FAIL — internal/engineering wording added to farmer-facing copy (ratchet allows only decrease):');
  for (const r of regressions) console.error('  - ' + r);
  process.exit(1);
}
const totalNow = Object.values(current).reduce((a, b) => a + b, 0);
console.log('[check:copy-governor] PASS — no new internal wording in farmer-facing copy across '
  + cols.length + ' locales (banned-term debt ' + totalNow + ', ratchet: can only fall).');
