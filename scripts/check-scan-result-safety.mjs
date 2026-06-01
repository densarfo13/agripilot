#!/usr/bin/env node
/**
 * scripts/check-scan-result-safety.mjs — §5 grower-facing result safety.
 *
 * Fails if the scan result UI:
 *   • makes a positive certainty claim — "guaranteed" (not as "not
 *     guaranteed"), "confirmed <disease/diagnosis/pest>", or "100%"
 *   • dumps raw provider/detection JSON into the render (JSON.stringify)
 *   • lacks the safe wording vocabulary (Likely / Possible / Needs review /
 *     Not enough information)
 *
 * Comments are stripped first; the user-action "confirm" flow
 * ("Check to confirm", onConfirm) and the "not guaranteed" disclaimer are
 * explicitly allowed.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|\s)\/\/.*$/gm, '');

const TARGETS = [
  'src/components/scan/ScanResultCard.jsx',
  'src/components/scan/ScanIntelligenceSections.jsx',
];

let anySafeWords = false;
for (const rel of TARGETS) {
  const raw = read(rel);
  if (!raw) continue;
  const code = strip(raw);
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    // "100%" only counts as an overclaim in a CERTAINTY context — CSS
    // widths/heights (width: '100%') are not claims and are ignored.
    if (/\b100\s*%/.test(ln) && /(accura|certain|confiden|guarantee|\bsure\b|correct|\bmatch\b|positive|exact)/i.test(ln))
      F.push(`${rel}:${i + 1} — "100%" certainty claim`);
    if (/\bguaranteed\b/i.test(ln) && !/not\s+guaranteed/i.test(ln))
      F.push(`${rel}:${i + 1} — positive "guaranteed" claim`);
    if (/confirmed\s+(disease|diagnosis|pest|infection|infestation)/i.test(ln))
      F.push(`${rel}:${i + 1} — "confirmed <diagnosis>" overclaim`);
    // Raw provider/detection JSON dumped into the UI.
    if (/JSON\.stringify\s*\(\s*(detection|raw|provider|result|scan)/i.test(ln))
      F.push(`${rel}:${i + 1} — raw provider/detection JSON rendered`);
  }
  if (/Likely|Possible|Needs review|Not enough/i.test(raw)) anySafeWords = true;
}

if (!F.length) P.push('no positive certainty claims (guaranteed/confirmed-diagnosis/100%)');
if (!F.some((m) => m.includes('JSON'))) P.push('no raw provider/detection JSON in the result UI');
if (anySafeWords) P.push('safe wording present (Likely / Possible / Needs review / Not enough information)');
else F.push('scan result UI must use safe wording (Likely / Possible / Needs review)');

if (F.length) {
  console.error('[check:scan-result-safety] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:scan-result-safety] PASS — no overclaims, no raw JSON, safe wording present.');
for (const m of P) console.log('  ✓ ' + m);
