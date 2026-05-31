#!/usr/bin/env node
/**
 * scripts/check-dead-ctas.mjs — broken-link audit gate.
 *
 * Scans JSX for `<button …>` that have a label matching the
 * canonical CTA list but no `onClick` / `onSubmit` handler. A
 * button with neither is a silent no-op — wave-audit forbids it.
 *
 * Scope: src/components and src/pages — all jsx and tsx files.
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

const CANONICAL_CTAS = [
  // Per wave spec — every one of these must have a handler when
  // rendered as a literal button label.
  'Take photo', 'Upload photo', 'Save to My Plants',
  'Scan Again', 'Add Plant', 'Complete Task',
  'View Activity', 'Add Farm', 'Add Garden',
  'Ready to Sell', 'Send Buyer Interest',
  'NGO Upload CSV', 'Download CSV Template',
  'Invite Farmer', 'Activate Account',
  'Retry', 'Go Home',
];

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist'
          || e.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.(jsx|tsx)$/.test(e.name)) {
      out.push(full);
    }
  }
}

const candidates = [];
walk(path.join(ROOT, 'src/components'), candidates);
walk(path.join(ROOT, 'src/pages'), candidates);

let scanned = 0;
const ctaPattern = new RegExp(
  '<button\\b([^>]*?)>([\\s\\S]*?)</button>', 'g');

for (const file of candidates) {
  scanned++;
  let src = '';
  try { src = fs.readFileSync(file, 'utf8'); }
  catch { continue; }
  let m;
  ctaPattern.lastIndex = 0;
  while ((m = ctaPattern.exec(src)) != null) {
    const attrs = m[1];
    const body  = m[2];
    // Pull literal CTA text — only consider plain text bodies, not
    // ones containing curly braces (i.e. dynamic content).
    if (/[{}]/.test(body)) continue;
    const label = body.replace(/\s+/g, ' ').trim();
    if (!label) continue;
    if (!CANONICAL_CTAS.includes(label)) continue;
    // Must have onClick OR type="submit" OR be wrapped in a form
    // with onSubmit (we accept type="submit" as the proxy).
    const hasHandler = /\bonClick\s*=/.test(attrs)
                    || /\btype\s*=\s*["']submit["']/.test(attrs);
    if (!hasHandler) {
      fail(`${path.relative(ROOT, file)} — "${label}" button has no onClick/onSubmit (silent no-op)`);
    } else {
      pass(`${path.relative(ROOT, file)} — "${label}" handled`);
    }
  }
}

if (FAILED.length > 0) {
  console.error('[check:dead-ctas] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\nScanned ${scanned} files. ${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log(`[check:dead-ctas] PASS — scanned ${scanned} files, ${PASSED.length} canonical CTAs with handlers.`);
