#!/usr/bin/env node
/**
 * check-raw-crop-render.mjs
 *
 * CI guard — fails when raw crop values are rendered to user-facing
 * JSX without going through `getCropLabel(value, lang)`.
 *
 *   node scripts/ci/check-raw-crop-render.mjs
 *     → 0 when every render is wrapped (or contextually exempt)
 *     → 1 when a raw crop render is found
 *
 * What's flagged
 *   1. `{X.cropType}` directly inside a JSX text position
 *      e.g. <span>{app.cropType}</span>
 *   2. `{X.crop}` same shape
 *      e.g. <td>{c.crop}</td>
 *   3. JSX text that is an UPPERCASE canonical crop code
 *      e.g. <td>MAIZE</td>  →  use getCropLabel('maize', lang)
 *   4. A template literal that interpolates `.cropType` / `.crop`
 *      directly into a user-facing string (not analytics tags).
 *
 * What's exempt (intentional)
 *   • React `key={...}` props                — needs the canonical id
 *   • Form `value={...}` / `defaultValue=`  — bindings, not display
 *   • `data-testid` / `aria-*` / `htmlFor`  — DOM hooks, not display
 *   • Style refs (`S.crop`, `styles.crop`)  — CSS class names
 *   • Validation error renders               — e.g. {errors.crop} is
 *     a validation message string, not the crop code itself
 *   • Files matching the BACKEND or TEST glob — guard is frontend-only
 *   • Files in BASELINE_OK — see bottom of this file. Treat the
 *     allowlist as a code smell, not a feature: every entry should
 *     have a comment justifying why the render can't go through
 *     getCropLabel (typically: rendering a server-supplied label
 *     that's already been localised on the server).
 *
 * Why a custom script and not eslint
 *   The existing CI guards in scripts/ci/*.mjs all follow this
 *   pattern. Adding an eslint plugin requires shipping a new
 *   package + plugin loader configuration. This script integrates
 *   with the existing `npm run guards` aggregate in one line.
 *
 * How to run
 *   • Locally:           `npm run guard:crop-render`
 *   • Pre-deploy:        `npm run guards`     (now includes this guard)
 *   • CI:                same — wired into the launch-gate via guards.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

// ─── Scan scope ──────────────────────────────────────────────────
//
// Frontend JSX only. Backend / tests / scripts / build outputs are
// out of scope — they don't render to farmers.
const INCLUDE_DIRS = ['src'];
const FILE_EXT = /\.jsx$/;
const EXCLUDE_RE = /(^|[\\/])(node_modules|__tests__|\.test\.jsx?|dist|build)([\\/]|$)/;

// ─── Canonical UPPERCASE crop codes ──────────────────────────────
//
// Mirrors the canonical list in src/config/crops/cropAliases.js.
// Kept inline (not imported) so the guard works as a standalone
// script with no node module resolution surprises in CI.
const UPPER_CROPS = new Set([
  'MAIZE', 'RICE', 'WHEAT', 'SORGHUM', 'MILLET', 'CASSAVA',
  'YAM', 'POTATO', 'SWEET_POTATO', 'BEANS', 'SOYBEAN',
  'GROUNDNUT', 'COWPEA', 'CHICKPEA', 'LENTIL',
  'TOMATO', 'ONION', 'PEPPER', 'CABBAGE', 'CARROT', 'OKRA',
  'SPINACH', 'CUCUMBER', 'WATERMELON', 'PLANTAIN',
  'BANANA', 'MANGO', 'ORANGE', 'AVOCADO',
  'COFFEE', 'TEA', 'COCOA', 'COTTON', 'SUGARCANE',
  'SUNFLOWER', 'SESAME', 'TOBACCO',
  'EGGPLANT', 'GINGER', 'GARLIC', 'LETTUCE', 'OIL_PALM',
]);

// Files where one or more violations are knowingly accepted because
// the source is already localised by the server (e.g. status
// strings, error messages). Add file paths only after auditing the
// flagged line and confirming it can't go through getCropLabel.
const BASELINE_OK = Object.freeze(new Set([
  // (currently empty — every farmer-facing crop render goes through
  // getCropLabel as of commit f623cb1)
]));

// ─── Walk + collect candidate files ──────────────────────────────

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (EXCLUDE_RE.test(full)) continue;
    if (e.isDirectory()) walk(full, out);
    else if (FILE_EXT.test(e.name)) out.push(full);
  }
}

// ─── Per-line scanners ───────────────────────────────────────────
//
// Each scanner returns `null` when the line is fine, or a string
// describing the violation. They're intentionally separate so the
// failure message tells you which rule fired.

// Patterns A & B — `{X.cropType}` / `{X.crop}` outside attribute
// contexts. The regex captures the line up to the offending token
// so we can check whether the immediately-preceding context is an
// allowed attribute prop.
const RE_DOT_CROPTYPE = /\{([a-zA-Z_][a-zA-Z0-9_.]*)\.cropType\}/g;
const RE_DOT_CROP     = /\{([a-zA-Z_][a-zA-Z0-9_.]*)\.crop\}/g;

// Allowed attribute contexts where the canonical code is REQUIRED
// or pass-through (forms, React reconciliation, accessibility, test
// markers, child-component prop pass-through).
//
// `crop=`, `cropType=`, `cropId=` are JSX prop pass-through to a
// child component — the receiver is itself covered by this guard,
// so the canonical code travelling through a prop chain is fine.
const ATTR_BEFORE = /\b(?:key|value|defaultValue|name|id|htmlFor|placeholder|data-testid|data-[a-z-]+|aria-[a-z-]+|onChange|onSelect|onBlur|onFocus|onKeyDown|onKeyUp|crop|cropType|cropId|cropCode)\s*=\s*\{?$/;

// Style ref / member access where `.crop` is a CSS class name on
// the styles object (S.crop, styles.crop, S.cropLine, etc.).
const STYLE_CONTEXT = /\b(?:S|styles)\.(?:crop[A-Z]?|cropType[A-Z]?)/;

// Constant-lookup contexts: `SECTION_ICONS.crop`, `ICONS.cropType`,
// `LABELS.crop`. The LHS is an UPPER_SNAKE_CASE module-level
// constant — `.crop` here is a literal property key in a static
// icon / label map, not a runtime crop value.
const CONSTANT_LOOKUP_CONTEXT = /\b[A-Z][A-Z0-9_]{2,}\.(?:crop|cropType)\b/;

// Validation-error contexts: {errors.crop}, {errors.cropType},
// {fieldErrors.crop}. These render error MESSAGES, not crop codes.
const VALIDATION_ERROR_CONTEXT = /\b(?:errors|fieldErrors|formErrors|validationErrors)\.(?:crop|cropType)/;

// Lines that are entirely attribute setup — we exempt template
// literal violations on these because the literal is a DOM hook
// (test id, aria id) not user-visible text.
const ATTR_LINE_HINT = /\b(?:data-testid|data-[a-z-]+|aria-[a-z-]+|key|className|htmlFor|id)\s*=\s*[\{`"']/;

// Pattern C — JSX text node that IS an uppercase canonical crop
// code. Matches `>MAIZE<` or `>{`MAIZE`}<` style renders.
const RE_JSX_TEXT_CROP = />\s*([A-Z_]+)\s*</g;

// Pattern D — template literal that interpolates `.cropType` /
// `.crop` directly into a backtick string. Skip cases where the
// literal is fed to a known non-display function (track, console,
// log, fetch, etc.).
const RE_TEMPLATE_CROPTYPE = /`[^`]*\$\{[^}]*\.cropType[^}]*\}[^`]*`/g;
const RE_TEMPLATE_CROP     = /`[^`]*\$\{[^}]*\.crop\b[^}]*\}[^`]*`/g;

// Calls where a template literal is fine (not a render):
const NON_DISPLAY_CALL_BEFORE = /\b(?:safeTrackEvent|trackEvent|track|console\.(?:log|warn|error|info|debug)|logger\.\w+|fetch|api\.(?:get|post|put|patch|delete)|sendSms|sendWhatsApp|sendEmail)\s*\(/;

function scanLine(file, lineIdx, line) {
  const violations = [];

  // Skip pure-comment lines.
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) return violations;

  // Tokenise line up to each match so we can look at preceding
  // context. Cheaper than a real lexer for our needs.
  const checkContextMatch = (re, kind) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line))) {
      const before = line.slice(0, m.index);
      const aroundStart = Math.max(0, m.index - 24);
      const around = line.slice(aroundStart, m.index + m[0].length);
      // Allowed: attribute prop, style ref, constant lookup,
      // validation error, non-display call (analytics/log/api).
      if (ATTR_BEFORE.test(before)) continue;
      if (STYLE_CONTEXT.test(around)) continue;
      if (CONSTANT_LOOKUP_CONTEXT.test(around)) continue;
      if (VALIDATION_ERROR_CONTEXT.test(m[0])) continue;
      if (NON_DISPLAY_CALL_BEFORE.test(before)) continue;
      // Allowed: the offending token itself sits inside a DOM-hook
      // attribute on the same line (data-testid={`X-${row.crop}`}).
      if (ATTR_LINE_HINT.test(line)) continue;
      // Allowed: already wrapped in getCropLabel( … the offending token … ).
      const lastOpenParen = before.lastIndexOf('(');
      if (lastOpenParen >= 0) {
        const callBefore = before.slice(0, lastOpenParen).match(/getCropLabel\s*$/);
        if (callBefore) continue;
      }
      violations.push({
        file,
        line: lineIdx + 1,
        rule: kind,
        snippet: line.trim().slice(0, 200),
      });
    }
  };

  checkContextMatch(RE_DOT_CROPTYPE, 'raw-cropType');
  checkContextMatch(RE_DOT_CROP,     'raw-crop');

  // Pattern C — uppercase crop in JSX text node.
  RE_JSX_TEXT_CROP.lastIndex = 0;
  let mC;
  while ((mC = RE_JSX_TEXT_CROP.exec(line))) {
    const word = mC[1];
    if (UPPER_CROPS.has(word)) {
      violations.push({
        file, line: lineIdx + 1, rule: 'uppercase-crop-text',
        snippet: line.trim().slice(0, 200),
      });
    }
  }

  // Pattern D — template literal interpolation. Skip when the
  // literal is fed to analytics / logging / network / a DOM-hook
  // attribute (test id, aria id), already wrapped in getCropLabel,
  // or when the field is `.cropName` (already a localised label).
  const templHit =
    RE_TEMPLATE_CROPTYPE.test(line) || RE_TEMPLATE_CROP.test(line);
  RE_TEMPLATE_CROPTYPE.lastIndex = 0;
  RE_TEMPLATE_CROP.lastIndex = 0;
  if (templHit
      && !NON_DISPLAY_CALL_BEFORE.test(line)
      && !ATTR_LINE_HINT.test(line)
      && !/getCropLabel\s*\(/.test(line)
      && !/\.cropName\b/.test(line)) {
    violations.push({
      file, line: lineIdx + 1, rule: 'template-literal-crop',
      snippet: line.trim().slice(0, 200),
    });
  }

  return violations;
}

// ─── Driver ──────────────────────────────────────────────────────

function main() {
  const files = [];
  for (const dir of INCLUDE_DIRS) walk(path.join(ROOT, dir), files);

  const violations = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (BASELINE_OK.has(rel)) continue;
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      for (const v of scanLine(rel, i, lines[i])) violations.push(v);
    }
  }

  if (violations.length === 0) {
    console.log(`\u2713 raw-crop-render: ${files.length} JSX file(s) scanned, no raw renders found`);
    return;
  }

  console.error(`\u2717 raw-crop-render: ${violations.length} violation(s) in ${new Set(violations.map((v) => v.file)).size} file(s)\n`);
  // Group by rule for readability.
  const byRule = new Map();
  for (const v of violations) {
    if (!byRule.has(v.rule)) byRule.set(v.rule, []);
    byRule.get(v.rule).push(v);
  }
  for (const [rule, items] of byRule) {
    console.error(`  [${rule}]  ${items.length} site(s):`);
    for (const v of items) {
      console.error(`    ${v.file}:${v.line}    ${v.snippet}`);
    }
    console.error('');
  }
  console.error('Fix: replace each raw render with `getCropLabel(value, lang)`.');
  console.error('     • import { getCropLabel } from \'../utils/crops.js\'');
  console.error('     • const { lang } = useTranslation()');
  console.error('     • <td>{getCropLabel(row.cropType, lang) || row.cropType}</td>');
  console.error('');
  console.error('If a render legitimately cannot use getCropLabel (e.g. server');
  console.error('already returns a localised label), add the file to BASELINE_OK');
  console.error('in scripts/ci/check-raw-crop-render.mjs with a comment.');
  process.exit(1);
}

main();
