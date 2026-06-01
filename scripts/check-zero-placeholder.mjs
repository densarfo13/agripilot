#!/usr/bin/env node
/**
 * check-zero-placeholder.mjs — §PRIORITY-1 ZERO PLACEHOLDER POLICY.
 *
 * Fails the build if any grower-facing UI file leaks placeholder text
 * to the rendered screen. The gate is intentionally precise to avoid
 * false positives on:
 *   • JSDoc comments mentioning "placeholder" architecturally
 *   • `placeholder=` JSX attributes (an HTML input attr, not text)
 *   • `placeholder: 'My value'` config keys
 *   • TODO/FIXME tracked inside multi-line block comments
 *
 * Violations are reserved for:
 *   1. Literal string values of "placeholder", "sample data",
 *      "lorem ipsum" used as user-visible text.
 *   2. Bare TODO: / FIXME: action markers in code (not comments).
 *
 * Raw `{token}` template-resolver leaks are covered by the
 * complementary check:template-placeholders gate at the runtime
 * resolver level. JSX `{name}` is a JS expression container — not a
 * literal template token — so we do NOT scan for it here (avoids
 * false positives on valid JSX).
 *
 * Scope: grower-facing surfaces only — admin/internal/dev pages skipped.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];

const SCAN_ROOTS = ['src/components', 'src/pages', 'src/modes', 'src/layouts'];

const SKIP_SUBSTR = [
  '/admin/', '/godmode/', '/internal/', '/pilot/', '/dev/',
  'Admin', 'Internal', 'Godmode', 'PilotCommand', 'PilotAnalytics',
  'PerformancePage', 'AdminOps', 'AdminUsers', 'AdminIssues', 'AdminSync',
  'AdminControl', 'AdminDashboard', 'AdminImport', 'AdminAnalytics',
  'AdminOrganizations', 'CalmHomeHero', 'DecisionEngine', 'OptimizationDebug',
];

function _shouldSkip(rel) {
  for (const s of SKIP_SUBSTR) if (rel.indexOf(s) >= 0) return true;
  return false;
}

function _walk(rel, out) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return;
  if (fs.statSync(abs).isDirectory()) {
    for (const f of fs.readdirSync(abs)) _walk(path.join(rel, f), out);
    return;
  }
  if (!/\.(jsx?|tsx?)$/.test(rel)) return;
  if (_shouldSkip(rel)) return;
  out.push(rel);
}

const files = [];
for (const root of SCAN_ROOTS) _walk(root, files);

/** Strip /* ... *​/ blocks (including JSDoc) and // line comments. */
function _stripComments(src) {
  // Block comments (greedy across newlines).
  let s = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Line comments — strip from `//` to end of line, but preserve newlines.
  s = s.split('\n').map((line) => {
    // Don't strip inside strings — naive but adequate for our checks.
    // We rebuild by finding the first `//` that's outside quotes.
    let inS = false; let inD = false; let inB = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i]; const p = line[i - 1];
      if (c === "'" && p !== '\\' && !inD && !inB) inS = !inS;
      else if (c === '"' && p !== '\\' && !inS && !inB) inD = !inD;
      else if (c === '`' && p !== '\\' && !inS && !inD) inB = !inB;
      else if (!inS && !inD && !inB && c === '/' && line[i + 1] === '/') {
        return line.slice(0, i);
      }
    }
    return line;
  }).join('\n');
  return s;
}

// Detection regexes (operate on code with comments STRIPPED).
const QUOTED_PLACEHOLDER_TEXT = /['"`]\s*placeholder\s*['"`]/i;
const QUOTED_SAMPLE_DATA = /['"`]\s*sample\s*data\s*['"`]/i;
const QUOTED_LOREM = /lorem\s+ipsum/i;
const BARE_TODO = /\bTODO\s*[:\s]/;
const BARE_FIXME = /\bFIXME\s*[:\s]/;

for (const rel of files) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const stripped = _stripComments(raw);
  const lines = stripped.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (QUOTED_PLACEHOLDER_TEXT.test(line)) {
      // Allow `placeholder: '...'` config keys (object-literal property name).
      if (!/^\s*placeholder\s*:/.test(line)) {
        fails.push(`${rel}:${i + 1} — literal "placeholder" string: ${line.trim().slice(0, 100)}`);
      }
    }
    if (QUOTED_SAMPLE_DATA.test(line))
      fails.push(`${rel}:${i + 1} — literal "sample data" string: ${line.trim().slice(0, 100)}`);
    if (QUOTED_LOREM.test(line))
      fails.push(`${rel}:${i + 1} — lorem ipsum filler: ${line.trim().slice(0, 100)}`);
    if (BARE_TODO.test(line))
      fails.push(`${rel}:${i + 1} — TODO marker in code: ${line.trim().slice(0, 100)}`);
    if (BARE_FIXME.test(line))
      fails.push(`${rel}:${i + 1} — FIXME marker in code: ${line.trim().slice(0, 100)}`);
  }
}

if (fails.length) {
  console.error('[check:zero-placeholder] FAILED — ' + fails.length + ' violation(s)');
  for (const m of fails.slice(0, 50)) console.error('  - ' + m);
  if (fails.length > 50) console.error('  … and ' + (fails.length - 50) + ' more');
  process.exit(1);
}
console.log('[check:zero-placeholder] OK — ' + files.length + ' grower-facing files scanned, zero placeholders.');
