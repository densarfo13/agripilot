#!/usr/bin/env node
/**
 * diagnose-imports.mjs — one-shot scanner for build-blocking
 * import problems that show up on a Linux deploy but pass on
 * Windows local builds.
 *
 * Detects:
 *   1. CASE MISMATCH — `import X from './Foo.jsx'` when the
 *      actual file on disk is `foo.jsx`. Windows is lax,
 *      Linux is strict.
 *   2. MISSING TARGET — relative import that resolves to no
 *      file at all (with any of the standard JS/TS extensions
 *      or /index.* suffixes).
 *
 * Run: node scripts/diagnose-imports.mjs
 *
 * Strict-rule: read-only, no side effects. Returns exit 0
 * even when issues are found (this is a diagnostic, not a
 * lint gate).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist'
        || entry.name === '.git'      || entry.name === 'build') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.(jsx?|tsx?|mjs)$/.test(entry.name)) yield p;
  }
}

function norm(p) { return p.replace(/\\/g, '/'); }

// All file paths under src/ keyed by lowercase for case-folded lookup.
const fileMap = new Map();
for (const f of walk('src')) {
  fileMap.set(norm(f).toLowerCase(), norm(f));
}

const importRe = /(?:from|import)\s+['"]([^'"]+)['"]/g;
const sideEffectRe = /^\s*import\s+['"]([^'"]+)['"]/gm;

const caseIssues  = [];
const missingIssues = [];

for (const f of walk('src')) {
  const src = fs.readFileSync(f, 'utf8');
  const dir = path.dirname(f);
  const seen = new Set();

  function check(importPath) {
    if (!importPath.startsWith('.')) return;       // bare import — skip
    if (seen.has(importPath)) return;
    seen.add(importPath);
    const base = path.resolve(dir, importPath);
    const candidates = [
      base,
      base + '.js', base + '.jsx', base + '.ts', base + '.tsx', base + '.mjs',
      path.join(base, 'index.js'),  path.join(base, 'index.jsx'),
      path.join(base, 'index.ts'),  path.join(base, 'index.tsx'),
    ];
    let actualOk = false;
    let lcMatch  = null;
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) { actualOk = true; break; }
      const lc = norm(c).toLowerCase();
      if (fileMap.has(lc)) lcMatch = fileMap.get(lc);
    }
    if (!actualOk && lcMatch) {
      caseIssues.push({ file: norm(f), import: importPath, actual: lcMatch });
    } else if (!actualOk
        && /\.(json|svg|png|jpg|jpeg|gif|webp|css|scss|sass)$/i.test(importPath) === false) {
      missingIssues.push({ file: norm(f), import: importPath });
    }
  }

  let m;
  while ((m = importRe.exec(src)))     check(m[1]);
  while ((m = sideEffectRe.exec(src))) check(m[1]);
}

console.log('=== diagnose-imports ===');
console.log('Case mismatches:', caseIssues.length);
for (const i of caseIssues.slice(0, 50)) {
  console.log(`  ${i.file}\n    imports: ${i.import}\n    actual:  ${i.actual}`);
}
console.log('\nMissing/unresolvable:', missingIssues.length);
for (const i of missingIssues.slice(0, 50)) {
  console.log(`  ${i.file}\n    imports: ${i.import}`);
}
process.exit(0);
