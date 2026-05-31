#!/usr/bin/env node
/**
 * scripts/check-no-runtime-queue-imports.mjs — Phase 1/5 gate.
 *
 * The queueRegistry 404 (GET /runtime/offline/queueRegistry.js 404)
 * was caused by runtime STRING imports that the bundler can't analyze:
 *   • new Function('s','return import(s)')(specifier)
 *   • eval('import(' + specifier + ')')
 *   • require('../runtime/offline/queueRegistry.js')  (CJS in ESM)
 * Each resolves the specifier at runtime against the page URL → 404
 * (or, for require, is simply undefined in the browser ESM bundle).
 *
 * This gate FAILS the build if any of those mechanisms reappear, and
 * requires queueRegistry to be loaded via a Vite-analyzable import so
 * the chunk is actually emitted.
 *
 * Read-only. Never mutates source. Scans src/ only (comment-stripped
 * so the doc-comments that NAME the banned patterns don't false-fail).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC  = path.join(ROOT, 'src');
const FAILED = [];
const PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);

const EXT = new Set(['.js', '.jsx', '.ts', '.tsx']);

function _walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue;
      _walk(full, out);
    } else if (e.isFile() && EXT.has(path.extname(e.name))) {
      out.push(full);
    }
  }
  return out;
}

function _stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (keep http://)
}

const files = _walk(SRC, []);
let queueRegistryStaticImportSeen = false;

// Patterns that indicate a NON-analyzable runtime import (banned).
const BANNED = [
  { re: /new\s+Function\s*\([^)]*\bimport\b/,        label: 'new Function(...import...)' },
  { re: /\beval\s*\([^)]*\bimport\b/,                label: 'eval(...import...)' },
  // CommonJS require of an app runtime module (undefined in browser ESM).
  { re: /\brequire\s*\(\s*['"][^'"]*runtime\/offline\/(queueRegistry|reconcileReconnect|deviceResilience)/,
    label: 'require(runtime/offline/*)' },
  // Any require of queueRegistry anywhere.
  { re: /\brequire\s*\(\s*['"][^'"]*queueRegistry/, label: 'require(queueRegistry)' },
];

for (const f of files) {
  let raw;
  try { raw = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const code = _stripComments(raw);
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  for (const { re, label } of BANNED) {
    if (re.test(code)) {
      fail(`${rel}: banned runtime import mechanism "${label}"`);
    }
  }
  // A Vite-analyzable dynamic import of queueRegistry (literal string).
  if (/\bimport\s*\(\s*['"][^'"]*queueRegistry\.js['"]\s*\)/.test(code)) {
    queueRegistryStaticImportSeen = true;
  }
  // A static import binding from queueRegistry also counts.
  if (/\bfrom\s+['"][^'"]*queueRegistry\.js['"]/.test(code)) {
    queueRegistryStaticImportSeen = true;
  }
}

if (!queueRegistryStaticImportSeen) {
  fail('queueRegistry must be loaded via a Vite-analyzable import() '
    + '(literal specifier) so the chunk is emitted — none found');
} else {
  pass('queueRegistry is loaded via Vite-analyzable import(s) (chunk emitted)');
}

if (FAILED.length === 0) {
  pass('no new Function(import) / eval(import) / require(runtime/offline) anywhere in src/');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:no-runtime-queue-imports] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:no-runtime-queue-imports] PASS — no runtime string imports; queueRegistry is bundler-analyzable.');
for (const p of PASSED) console.log('  ✓ ' + p);
