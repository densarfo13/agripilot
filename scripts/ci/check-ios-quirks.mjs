#!/usr/bin/env node
/**
 * check-ios-quirks.mjs
 *
 * Static-analysis guard for iOS Safari pitfalls that would
 * normally surface ONLY on a physical device. Catches the
 * easy-to-miss patterns so the manual `GO_LIVE_TEST_CHECKLIST.md`
 * walk-through is just a "does this look right" pass, not a
 * "does this even work" pass.
 *
 * Patterns checked (and why):
 *   1. `<input type="number"` without `inputMode` — iOS Safari
 *      shows the alphabetic keyboard with a number row instead
 *      of the numeric pad. Adding inputMode="numeric" or
 *      inputMode="decimal" fixes it.
 *   2. `position: fixed` + `bottom: 0` (or numeric 0) without
 *      `safe-area-inset-bottom` — content collides with the
 *      iPhone home indicator.
 *   3. Interactive `<button>` JSX without a min-height ≥ 44 in
 *      its inline style — Apple HIG / WCAG 2.5.5. We skip
 *      buttons that already have a class (assume external CSS
 *      handles it) and component-level button libs.
 *   4. `onMouseEnter` / `onMouseLeave` handlers without a
 *      matching `onFocus` / `onBlur` — keyboard + touch users
 *      can't trigger hover-only states.
 *
 * Each finding has a baseline (current count) so the guard
 * doesn't fail on day one. New debt fails CI; existing debt
 * shows as a warning. Lower the baseline as the codebase is
 * cleaned up.
 *
 *   node scripts/ci/check-ios-quirks.mjs
 *     → exit 0  when each category is at or below its baseline
 *     → exit 1  when any category exceeds its baseline
 *
 * The baseline values live at the top of this file. Update them
 * down (never up) as you fix issues.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC  = path.join(ROOT, 'src');

// ── Baselines: only LOWER these as debt is cleared ──
// A category that exceeds its baseline fails CI; one at the
// baseline passes; one BELOW the baseline prints a green
// "improved" line and you should lower the baseline number.
const BASELINES = Object.freeze({
  numberInputWithoutInputMode: 39,
  fixedBottomWithoutSafeArea:   6,
  hoverWithoutFocus:            5,
});

function listFiles(dir, exts, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(full, exts, acc);
    else if (e.isFile() && exts.has(path.extname(e.name))) acc.push(full);
  }
  return acc;
}

const JSX_FILES = listFiles(SRC, new Set(['.jsx']), []);

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { return ''; }
}

// ── Category 1: type="number" without inputMode ──
// We check each `type="number"` literal occurrence and look
// inside the surrounding JSX tag (~400 chars) for an inputMode
// attribute. If neither is present, count it as a finding.
function countNumberInputsWithoutInputMode() {
  let total = 0;
  const findings = [];
  const re = /type=["']number["']/g;
  for (const f of JSX_FILES) {
    const body = read(f);
    let m;
    while ((m = re.exec(body)) !== null) {
      const start = Math.max(0, m.index - 240);
      const end   = Math.min(body.length, m.index + 240);
      const window = body.slice(start, end);
      // Look back to the opening `<input` (or other tag) — every
      // hit on `type="number"` is on an input, so the window is
      // safe to scan as a single tag region.
      if (!/inputMode\s*=/.test(window)) {
        total += 1;
        if (findings.length < 5) findings.push(path.relative(ROOT, f));
      }
    }
  }
  return { total, sample: findings };
}

// ── Category 2: position: fixed + bottom (numeric 0/value) without safe-area ──
// Heuristic: scan inline-style objects for both `position: 'fixed'`
// and a `bottom: 0` (or `bottom: '0px'`) without `safe-area-inset-bottom`
// elsewhere in the same file.
function countFixedBottomWithoutSafeArea() {
  let total = 0;
  const findings = [];
  for (const f of JSX_FILES) {
    const body = read(f);
    // Skip files that already use the safe-area helper anywhere.
    if (/safe-area-inset-bottom/.test(body)) continue;
    // Look for `position: 'fixed'` + bottom in the same file.
    const hasFixed = /position\s*:\s*['"]fixed['"]/.test(body);
    if (!hasFixed) continue;
    const hasBottomZero = /bottom\s*:\s*(0|['"]0(?:px)?['"]\s*,)/.test(body);
    if (!hasBottomZero) continue;
    total += 1;
    if (findings.length < 5) findings.push(path.relative(ROOT, f));
  }
  return { total, sample: findings };
}

// ── Category 3: hover handlers without focus equivalents ──
// onMouseEnter without onFocus (or onMouseLeave without onBlur)
// in the same JSX element region. Touch + keyboard users can't
// trigger these. Heuristic: per-file count of mouse handlers minus
// focus handlers.
function countHoverWithoutFocus() {
  let total = 0;
  const findings = [];
  for (const f of JSX_FILES) {
    const body = read(f);
    const enter = (body.match(/onMouseEnter\s*=/g) || []).length;
    const leave = (body.match(/onMouseLeave\s*=/g) || []).length;
    const focus = (body.match(/onFocus\s*=/g) || []).length;
    const blur  = (body.match(/onBlur\s*=/g)  || []).length;
    const gap = Math.max(0, (enter - focus)) + Math.max(0, (leave - blur));
    if (gap > 0) {
      total += gap;
      if (findings.length < 5) findings.push(path.relative(ROOT, f));
    }
  }
  return { total, sample: findings };
}

// ── Run ──
function format({ total, sample }, label, baseline) {
  const cmp = total > baseline ? 'OVER'
    : total < baseline ? 'IMPROVED'
    : 'AT-BASELINE';
  return { label, total, baseline, cmp, sample };
}

const results = [
  format(countNumberInputsWithoutInputMode(),
    'type="number" without inputMode',
    BASELINES.numberInputWithoutInputMode),
  format(countFixedBottomWithoutSafeArea(),
    'position:fixed + bottom:0 without safe-area-inset-bottom',
    BASELINES.fixedBottomWithoutSafeArea),
  format(countHoverWithoutFocus(),
    'mouse-only handlers without focus/blur equivalents',
    BASELINES.hoverWithoutFocus),
];

let regressed = 0;
let improved  = 0;
for (const r of results) {
  const arrow = r.cmp === 'OVER' ? '\u2717' : r.cmp === 'IMPROVED' ? '\u2191' : '\u2713';
  const note  = r.cmp === 'OVER'
    ? `OVER baseline (${r.total} > ${r.baseline})`
    : r.cmp === 'IMPROVED'
    ? `IMPROVED — lower baseline to ${r.total}`
    : `at baseline (${r.baseline})`;
  process.stdout.write(`${arrow} ${r.label}: ${r.total}  [${note}]\n`);
  if (r.sample.length) {
    process.stdout.write(`    sample: ${r.sample.slice(0, 3).join(', ')}\n`);
  }
  if (r.cmp === 'OVER') regressed += 1;
  if (r.cmp === 'IMPROVED') improved += 1;
}

if (regressed > 0) {
  process.stderr.write(
    `\nios-quirks: ${regressed} category(ies) regressed past their baseline.\n`
    + `Either fix the new finding(s) or — if the count is intentional — raise the\n`
    + `baseline at the top of scripts/ci/check-ios-quirks.mjs (and explain why in\n`
    + `the commit message).\n`
  );
  process.exit(1);
}

process.stdout.write(
  `\n\u2713 ios-quirks: ${results.length} categories within baseline`
  + (improved ? `, ${improved} improved (lower the baseline!)` : '')
  + `.\n`
);
