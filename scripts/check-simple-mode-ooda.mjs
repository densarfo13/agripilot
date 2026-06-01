#!/usr/bin/env node
/**
 * scripts/check-simple-mode-ooda.mjs — §12 OODA INTEGRATION.
 *
 * Fails if:
 *   - The OODA composite does not declare the required simple-mode fields
 *     (simpleAction / simpleReason / simpleWhen / voicePrompt)
 *   - The composite is not non-blocking / failure-safe / grower-safe
 *   - Simple Mode UI reads the advanced JSON (must read only simple fields)
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const rel = 'src/runtime/simpleMode/SimpleModeOODARuntime.ts';
const raw = read(rel);
if (!raw) F.push(`${rel}: missing`);
else {
  if (!/__simpleModeOODAHealth/.test(raw))
    F.push('must install __simpleModeOODAHealth');
  else P.push('__simpleModeOODAHealth installed');
  for (const k of ['simpleAction', 'simpleReason', 'simpleWhen', 'voicePrompt']) {
    if (!raw.includes(k)) F.push(`OODA composite must declare required field ${k}`);
  }
  if (!F.some((m) => /required field/.test(m)))
    P.push('simpleAction / simpleReason / simpleWhen / voicePrompt required');
  for (const flag of ['nonBlocking: true', 'failureSafe: true', 'growerSafe: true']) {
    if (!raw.includes(flag)) F.push(`OODA composite must declare ${flag}`);
  }
  if (!F.some((m) => /OODA composite must declare/.test(m)))
    P.push('non-blocking / failure-safe / grower-safe declared');
  if (!/REQUIRED_SIMPLE_FIELDS/.test(raw))
    F.push('OODA composite must enumerate REQUIRED_SIMPLE_FIELDS');
  else P.push('REQUIRED_SIMPLE_FIELDS enumerated');
}

// Simple Mode UI must NOT read advanced JSON fields directly. Strip comments
// first — docblocks legitimately NAME these forbidden fields as a "Hide
// advanced" disclosure; only actual property access counts as a violation.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
// Match property access patterns: `.advancedMessage`, `['confidence']`,
// `?.provider`, `["rawTaxonomy"]`. Not standalone identifiers in prose.
const ACCESSES = /[.?](advancedMessage|confidence|provider|rawTaxonomy)\b|\[\s*['"](advancedMessage|confidence|provider|rawTaxonomy)['"]\s*\]/;
for (const c of [
  'src/components/simpleMode/SimpleActionCard.jsx',
  'src/components/simpleMode/SimpleModeHomeSection.jsx',
  'src/components/simpleMode/SimpleModeScanCard.jsx',
]) {
  const txt = read(c);
  if (!txt) continue;
  const src = strip(txt);
  if (ACCESSES.test(src))
    F.push(`${c.split('/').pop()}: must not read advancedMessage / confidence / provider / rawTaxonomy`);
}
if (!F.some((m) => /must not read advancedMessage/.test(m)))
  P.push('Simple Mode UI does not read advanced JSON fields');

if (F.length) {
  console.error('[check:simple-mode-ooda] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:simple-mode-ooda] PASS — OODA carries simple-shape fields, non-blocking, UI never reads advanced JSON.');
for (const m of P) console.log('  ✓ ' + m);
