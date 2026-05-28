#!/usr/bin/env node
/**
 * check-dead-clicks.mjs — RC1 dead-button / dead-link detector.
 *
 *   node scripts/check-dead-clicks.mjs
 *
 * What this is
 * ────────────
 *   AST-free heuristic scan over every JSX file under src/pages and
 *   src/components. Flags interactive elements that are likely to
 *   "click and do nothing":
 *
 *     1. <button …> without `onClick`, `type="submit"`, `disabled`,
 *        `aria-disabled`, or a click handler prop like `onPress`
 *     2. <a …> without `href`
 *     3. <Link …> without `to`
 *     4. <NavLink …> without `to`
 *
 *   Multi-line tags are joined before inspection so attributes
 *   spread across lines are evaluated as one.
 *
 *   Ratcheted — first run records the baseline at
 *   `scripts/.dead-clicks-baseline.json`. Re-running with `--tighten`
 *   re-baselines after a cleanup. CI fails only on NEW dead clicks.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const SRC       = resolve(ROOT, 'src');
const BASELINE  = resolve(__dirname, '.dead-clicks-baseline.json');
const HEADER    = '[check:dead-clicks]';

const TARGET_DIRS = ['src/pages', 'src/components'];
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git',
  '__tests__', '__fixtures__',
]);
const EXTS = new Set(['.jsx', '.tsx']);

function _walk(dir, out) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) _walk(full, out);
    else if (EXTS.has(e.slice(e.lastIndexOf('.')))) out.push(full);
  }
  return out;
}

// Match <Tag …> with attrs across lines, stopping at the first
// `>` not inside a brace. Captures the attribute soup.
const TAG_RE = /<(button|a|Link|NavLink)\b([\s\S]*?)>/g;

function _flattenAttrs(raw) {
  return (raw || '').replace(/\s+/g, ' ').trim();
}

function _hasAttr(attrs, name) {
  // Word-boundary so `onclick` doesn't match `onClickStub`. The
  // attribute may be on its own (`disabled`), JSX-bound (`onClick=`),
  // or used with a spread (`{...props}`).
  if (new RegExp(`\\b${name}\\b\\s*=`).test(attrs)) return true;
  // Boolean shorthand (just the attribute name).
  if (new RegExp(`(^|\\s)${name}(\\s|/?>|$)`).test(attrs)) return true;
  // JSX spread escape — assume the spread contains the handler.
  if (/\{\.\.\.[a-zA-Z_$][\w$]*\}/.test(attrs)) return true;
  return false;
}

function _scanFile(abs) {
  const rel = relative(ROOT, abs).replace(/\\/g, '/');
  const src = readFileSync(abs, 'utf8');
  const findings = [];
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(src)) !== null) {
    const tag = m[1];
    const attrs = _flattenAttrs(m[2]);
    if (tag === 'button') {
      const hasHandler =
        _hasAttr(attrs, 'onClick')
        || _hasAttr(attrs, 'onPress')
        || _hasAttr(attrs, 'onMouseDown')
        || _hasAttr(attrs, 'onTouchEnd')
        || _hasAttr(attrs, 'disabled')
        || _hasAttr(attrs, 'aria-disabled')
        || /\btype\s*=\s*["'](submit|reset)["']/.test(attrs);
      if (!hasHandler) {
        findings.push({ tag, attrs: attrs.slice(0, 80), at: m.index });
      }
    } else if (tag === 'a') {
      if (!_hasAttr(attrs, 'href') && !_hasAttr(attrs, 'onClick')) {
        findings.push({ tag, attrs: attrs.slice(0, 80), at: m.index });
      }
    } else if (tag === 'Link' || tag === 'NavLink') {
      if (!_hasAttr(attrs, 'to')) {
        findings.push({ tag, attrs: attrs.slice(0, 80), at: m.index });
      }
    }
  }
  return { rel, findings };
}

function _readBaseline() {
  if (!existsSync(BASELINE)) return {};
  try { return JSON.parse(readFileSync(BASELINE, 'utf8')); }
  catch { return {}; }
}

function _writeBaseline(b) {
  writeFileSync(BASELINE, JSON.stringify(b, null, 2) + '\n', 'utf8');
}

function _toBaselineShape(byFile) {
  const out = {};
  for (const [file, rec] of Object.entries(byFile)) {
    out[file] = rec.findings.length;
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const tighten = args.includes('--tighten') || args.includes('--write');

  const files = [];
  for (const d of TARGET_DIRS) {
    const full = resolve(ROOT, d);
    if (existsSync(full)) _walk(full, files);
  }

  const byFile = {};
  for (const f of files) {
    const r = _scanFile(f);
    if (r.findings.length > 0) byFile[r.rel] = r;
  }

  if (tighten) {
    _writeBaseline(_toBaselineShape(byFile));
    const total = Object.values(byFile).reduce((a, r) => a + r.findings.length, 0);
    console.log(HEADER, 'baseline tightened —',
      Object.keys(byFile).length, 'file(s) with', total, 'grandfathered finding(s).');
    process.exit(0);
  }

  const baseline = _readBaseline();
  let newCount = 0;
  const offenders = [];
  for (const [file, rec] of Object.entries(byFile)) {
    const baseN = baseline[file] || 0;
    if (rec.findings.length > baseN) {
      newCount += rec.findings.length - baseN;
      offenders.push({
        file,
        baseline: baseN,
        current: rec.findings.length,
        sample: rec.findings.slice(0, 3),
      });
    }
  }

  if (newCount > 0) {
    console.error(HEADER, 'FAIL —', newCount, 'new dead-click candidate(s):');
    for (const o of offenders.slice(0, 20)) {
      console.error('  ✗ ' + o.file + ' (' + o.current + ' / baseline ' + o.baseline + ')');
      for (const s of o.sample) {
        console.error('      <' + s.tag + ' ' + s.attrs + ' …>');
      }
    }
    console.error('');
    console.error('Each interactive element needs at least one of:');
    console.error('  <button>  : onClick / onPress / type="submit" / disabled');
    console.error('  <a>       : href / onClick');
    console.error('  <Link>    : to');
    console.error('Run `node scripts/check-dead-clicks.mjs --tighten` after');
    console.error('an intentional change to record the new baseline.');
    process.exit(1);
  }

  const totalFiles = Object.keys(byFile).length;
  const totalFindings = Object.values(byFile)
    .reduce((a, r) => a + r.findings.length, 0);
  console.log(HEADER, 'PASS — no new dead clicks.');
  console.log('  ' + totalFiles + ' file(s) with '
    + totalFindings + ' grandfathered finding(s).');
  process.exit(0);
}

main();
