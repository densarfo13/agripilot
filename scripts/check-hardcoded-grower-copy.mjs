#!/usr/bin/env node
/**
 * scripts/check-hardcoded-grower-copy.mjs — §5 grower-copy externalization.
 *
 * The grower-facing shells (Scan / onboarding) must route user copy
 * through tSafe/tStrict (so missing keys fall back honestly, not via
 * raw hardcoded component text). Ratchet over the key surfaces — does
 * NOT demand a full codebase sweep (that's the broader i18n backlog).
 *
 * Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|\s)\/\/.*$/gm, '');

const TARGETS = [
  ['src/components/scan/ScanCameraLikeShell.jsx', 3],
  ['src/components/scan/ScanHub.jsx', 5],
  ['src/components/scan/ScanFallback.jsx', 4],
  ['src/components/scan/PlainUploadFallback.jsx', 3],
  ['src/components/common/SafeLoader.jsx', 3],
  ['src/pages/onboarding/FastOnboarding.jsx', 5],
];
for (const [rel, min] of TARGETS) {
  const src = read(rel);
  if (!src) { F.push(`${rel}: missing`); continue; }
  const n = (strip(src).match(/\b(tSafe|tStrict)\s*\(/g) || []).length;
  if (n < min) F.push(`${rel}: only ${n} tSafe/tStrict call(s) — expected ≥ ${min} (grower copy not externalized)`);
  else P.push(`${rel}: copy externalized (${n} t-calls)`);
}

// Dynamic provider labels must pass through the entity layer somewhere
// in the scan render tree (translateEntityLabel available + result card
// has a path to it). We assert the layer exists + is importable.
if (!/export function translateEntityLabel\b/.test(read('src/i18n/translateEntityLabel.js')))
  F.push('translateEntityLabel must exist for dynamic provider-label localization');
else P.push('entity localization layer available for dynamic scan labels');

if (F.length) {
  console.error('[check:hardcoded-grower-copy] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:hardcoded-grower-copy] PASS — scan + onboarding shells externalize grower copy; entity layer available.');
for (const m of P) console.log('  ✓ ' + m);
