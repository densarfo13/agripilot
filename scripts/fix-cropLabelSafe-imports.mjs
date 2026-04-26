#!/usr/bin/env node
/**
 * fix-cropLabelSafe-imports.mjs — emergency hotfix for the
 * ReferenceError: getCropLabelSafe is not defined crash.
 *
 * 16 files (per pilot DevTools survey) reference `getCropLabelSafe`
 * without importing it — each one would crash with a ReferenceError
 * the moment its render path executes. The user hit it via
 * EditFarmScreen → ErrorBoundary → "Something went wrong".
 *
 * The transform:
 *   1. Find every .jsx file that calls getCropLabelSafe(...)
 *   2. If the file does NOT import it, add:
 *        import { getCropLabelSafe } from '<rel>/utils/crops.js';
 *   3. Insertion point: after the last import statement in the
 *      file, on its own line.
 *
 * Skips files that already have the import (idempotent).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function gatherJsxFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      const next = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '__tests__') continue;
        stack.push(next);
      } else if (e.name.endsWith('.jsx') || e.name.endsWith('.js')) {
        out.push(next);
      }
    }
  }
  return out;
}

function relImportPath(fromFile) {
  const from = path.dirname(fromFile);
  const to   = path.join(ROOT, 'src/utils/crops.js');
  let rel = path.relative(from, to).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

const dry = process.argv.includes('--dry');
const files = gatherJsxFiles(path.join(ROOT, 'src'));

let totalFixed = 0;
const summary = [];

// Files that mention getCropLabelSafe() but should NOT import it:
//   • utils/crops.js — defines the function itself
//   • i18n/devTextAudit.js — only mentions it inside a console.log
//     help string for QA, never calls it
const SELF_DEFINING = new Set([
  path.join(ROOT, 'src/utils/crops.js'),
  path.join(ROOT, 'src/i18n/devTextAudit.js'),
]);

for (const abs of files) {
  if (SELF_DEFINING.has(abs)) continue;

  let text;
  try { text = fs.readFileSync(abs, 'utf8'); }
  catch { continue; }

  if (/import\b[^;]*\bgetCropLabelSafe\b/.test(text)) continue;
  // Strip /* ... */ block comments and // line comments so a JSDoc
  // example like `* getCropLabelSafe(value, lang)` doesn't trip
  // the "this file uses the function" detector.
  const codeOnly = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\*[^\n]*$/gm, '')
    .replace(/\/\/[^\n]*$/gm, '');
  if (!/\bgetCropLabelSafe\s*\(/.test(codeOnly)) continue;

  const importLine = `import { getCropLabelSafe } from '${relImportPath(abs)}';`;
  // Insert after the last complete import statement.
  const re = /^[ \t]*import\b[\s\S]*?from\s+['"][^'"]+['"]\s*;?[ \t]*$/gm;
  let lastEnd = -1;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > 8192) break;
    lastEnd = m.index + m[0].length;
  }
  let next;
  if (lastEnd === -1) {
    next = importLine + '\n' + text;
  } else {
    next = text.slice(0, lastEnd) + '\n' + importLine + text.slice(lastEnd);
  }

  if (!dry) fs.writeFileSync(abs, next, 'utf8');
  totalFixed += 1;
  summary.push(path.relative(ROOT, abs).replace(/\\/g, '/'));
}

console.log(`fix-cropLabelSafe-imports: ${dry ? 'DRY-RUN' : 'APPLIED'}`);
console.log(`  ${totalFixed} file(s) patched.\n`);
for (const f of summary) console.log(`  ${f}`);
