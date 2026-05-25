#!/usr/bin/env node
/**
 * check-hardcoded-strings.mjs
 *
 * CI guard — counts hardcoded English literals in JSX components
 * that look user-visible AND are NOT wrapped in a translation
 * helper (t / tSafe / tStrict / tPlural / UI / getCropLabel).
 *
 * Methodology (heuristic, regex-based; no AST):
 *
 *   Scan src/components/ and src/pages/ for .jsx/.tsx/.js files.
 *   For each file:
 *     1. Strip line + block comments (avoids false matches on
 *        JSDoc-cited example strings).
 *     2. Find "candidate spots":
 *          a) JSX text children   — `>Some Text<`
 *          b) JSX string attrs    — `placeholder="..."`,
 *                                    `label="..."`, `title="..."`,
 *                                    `aria-label="..."`, `alt="..."`
 *     3. For each candidate, apply user-visibility filters:
 *          - skip strings shorter than 3 chars or purely whitespace
 *          - skip pure URLs / hex colours / class names / paths
 *          - skip strings already wrapped by a known t-helper
 *          - skip single-word ALL-CAPS tokens (likely enum codes)
 *          - skip strings inside known technical attrs (className,
 *            type, data-*, role, key, id, name, src, href, to, role,
 *            tag, kind, variant, size, style, color, fill, stroke)
 *
 *   Each surviving candidate counts as one leak.
 *
 * Ratchet semantics (mirrors check-crop-type-drift.mjs):
 *
 *   BASELINE is the captured count at the time of landing. Every
 *   PR must keep the count AT OR BELOW baseline. When you fix a
 *   batch, ratchet DOWN by editing the BASELINE constant — the
 *   guard prints the migration hint so the new low watermark is
 *   obvious.
 *
 * Flags:
 *   --update           run, print the new count, suggest BASELINE update
 *   --by-file          print per-file counts (sorted desc)
 *   --list             print the actual literals (warning: noisy)
 *   --top N            limit per-file or --list output to N rows
 *
 * Exit codes: 0 PASS | 1 baseline exceeded | 2 fatal scan error.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

const SCAN_ROOTS = ['src/components', 'src/pages'];
const FILE_RE = /\.(jsx|tsx|js)$/;
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', '__tests__', '__mocks__',
  '.storybook',
]);
const SKIP_FILE_RE = /\.(test|spec|stories)\.(js|jsx|ts|tsx)$/;

// ─── Ratchet baseline ───────────────────────────────────────
// Set after the FIRST clean run on a captured tree. Lower it
// monotonically as components migrate to translated strings.
// Raising it requires a code-review comment on the PR
// explaining why a new leak was acceptable.
//
// Initial baseline captured 2026-05-25 against origin/master tip
// = 76ea512a (post deployment-hardening merge).
//
// Leak distribution at baseline (after the tightened-heuristic pass
// that eliminated 372 false positives from JSX boolean-guard fragments
// like `0 && step` that leaked between `>` and `<`):
//   177 files have leaks, 2125 leaks total
//   Top offenders:
//     150 src/pages/FarmerDetailPage.jsx       (admin / NGO ops)
//     137 src/pages/ApplicationDetailPage.jsx  (admin)
//     111 src/pages/FarmersPage.jsx            (admin / NGO ops)
//      75 src/pages/AdminControlPage.jsx       (admin)
//      67 src/pages/AdminIssuesPage.jsx        (admin)
//      61 src/pages/AdminUsersPage.jsx         (admin)
//      60 src/pages/Landing.jsx                (public marketing)
//      52 src/pages/LandingPage.jsx            (public marketing)
//      51 src/pages/AdminOpsPage.jsx           (admin)
//      49 src/pages/DashboardPage.jsx          (admin)
//      41 src/components/OnboardingWizard.jsx  ← FARMER FACING
//      38 src/pages/FarmerMarketTab.jsx        ← FARMER FACING
//      31 src/pages/FarmerStorageTab.jsx       ← FARMER FACING
//
// Priority queue for ratchet-down work, in order:
//   1. Farmer-facing surfaces (Onboarding, Market, Storage, Today,
//      Scan, Progress, Tasks) — these are what end users see in
//      their non-English locale.
//   2. Admin / NGO pages — these have English-fluent operators,
//      lower urgency.
//   3. Public landing pages — marketing copy is rarely localized.
//
// Re-measure after a migration batch:
//   node scripts/ci/check-hardcoded-strings.mjs --update
// 2026-05-25 — ratcheted DOWN 2125 → 2087 (-38). FarmerMarketTab.jsx
// (Sell page) fully migrated under the 'market.*' namespace.
//
// 2026-05-25 — ratcheted DOWN 2087 → 2056 (-31). FarmerStorageTab.jsx
// fully migrated under the 'storage.*' namespace + reused common.save.
const BASELINE = Number(process.env.HARDCODED_STRINGS_BASELINE)
  || 2056;

const GROWTH_TOLERANCE = 0;

// ─── String classifiers ─────────────────────────────────────

/**
 * Looks user-visible? Heuristic: contains a letter, has length
 * >= 3, is not purely numeric/technical, contains at least one
 * vowel (filters out random tokens like "btn", "asc"), and is
 * not entirely an enum code (UPPER_SNAKE_CASE / kebab-case).
 */
function looksVisible(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  if (t.length < 3) return false;
  if (!/[a-zA-Z]/.test(t)) return false;
  if (!/[aeiouAEIOU]/.test(t)) return false;     // filters btn, csv, hr, etc.
  // Filter JSX boolean-guard fragments. JSX expressions like
  // `{step >= 0 && step < n && <Foo>}` leak the text between `>` and
  // the embedded `<` to our scanner as e.g. `"= 0 && step"` or
  // `"0 && step"`. Reject anything starting with comparator/operator
  // residue or containing `&&` / `||` — those are never real UI
  // strings (no user-facing copy contains JS boolean operators in
  // plain text).
  if (/&&|\|\|/.test(t)) return false;
  if (/^[=!<>?:]\s/.test(t)) return false;
  if (/^[0-9]/.test(t) && !/\s/.test(t)) return false; // bare number tokens
  if (/^[A-Z][A-Z0-9_]+$/.test(t)) return false; // enum code
  if (/^[a-z][a-z0-9-]+$/.test(t) && !t.includes(' ')) return false; // single-word kebab id
  if (/^(https?|tel|mailto|data):/.test(t)) return false; // URLs
  if (/^[#][0-9A-Fa-f]{3,8}$/.test(t)) return false; // hex colour
  if (/^[\w./-]+\.(svg|png|jpe?g|webp|gif|ico|css|scss|js|jsx|ts|tsx)$/i.test(t))
    return false; // file paths / assets
  if (/^\/[\w./?=&-]+$/.test(t)) return false; // url paths
  if (/^[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*$/.test(t)) return false; // dotted ids
  // Require AT LEAST ONE letter sequence of 3+ chars surrounded by
  // word boundaries — a "real word". Filters miscellaneous JS
  // residue like "= 0 &" that survives the above.
  if (!/\b[A-Za-z]{3,}\b/.test(t)) return false;
  return true;
}

/**
 * Looks like already-translated context? Returns true when the
 * 30 chars immediately preceding the literal include a known
 * translation-helper call name.
 */
const HELPER_RE = /(?:^|[\s({,=:!?&|])(?:t|tSafe|tStrict|tPlural|tShort|UI|getCropLabel|getCropLabelSafe|getCropDisplayName|useTranslation|useCropLabel|useScreenTranslator|cropLabel|labelFor)\s*\(\s*$/;
function looksAlreadyHelped(prefix) {
  return HELPER_RE.test(prefix.slice(-60));
}

// Attributes whose value is ALWAYS technical (never user-visible).
// Anything not in this set is checked.
const TECHNICAL_ATTRS = new Set([
  'className', 'class', 'type', 'role', 'key', 'id', 'name',
  'src', 'href', 'to', 'tag', 'kind', 'variant', 'size',
  'style', 'color', 'fill', 'stroke', 'as', 'forwardedAs',
  'autoComplete', 'autoCorrect', 'autoCapitalize', 'spellCheck',
  'inputMode', 'enterKeyHint', 'pattern', 'accept', 'method',
  'encType', 'target', 'rel', 'lang', 'dir', 'crossOrigin',
  'referrerPolicy', 'loading', 'decoding', 'sandbox', 'allow',
  'sizes', 'srcSet', 'media', 'preload', 'mode', 'shape',
  'datatest', 'data-testid', 'data-test', 'data-track',
  'children', 'ref', 'i18nKey',
  // Style props (we already check className above, but inline
  // style/key tokens here are also technical)
  'transform', 'transformOrigin', 'viewBox', 'preserveAspectRatio',
]);

// Attributes whose value IS user-visible and SHOULD be translated.
const VISIBLE_ATTRS = new Set([
  'placeholder', 'label', 'title', 'aria-label', 'aria-description',
  'aria-roledescription', 'alt', 'caption', 'tooltip', 'description',
  'helperText', 'errorText', 'errorMessage', 'message', 'subtitle',
  'heading', 'subheading', 'cta', 'ctaLabel', 'buttonLabel',
  'submitLabel', 'cancelLabel', 'confirmLabel',
]);

// ─── Comment stripping ──────────────────────────────────────
function stripComments(src) {
  // Line comments: //... to end of line
  // Block comments: /* ... */ (incl. JSDoc)
  // Strings need to be preserved so attribute values still match.
  // We do a single-pass character scan tracking string + comment
  // state. Naive but correct enough for the heuristic.
  let out = '';
  let i = 0;
  const len = src.length;
  let inLine = false;
  let inBlock = false;
  let inStr = null; // " | ' | `
  let escape = false;

  while (i < len) {
    const ch = src[i];
    const next = src[i + 1];

    if (inLine) {
      if (ch === '\n') { inLine = false; out += ch; }
      i += 1;
      continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') { inBlock = false; i += 2; continue; }
      if (ch === '\n') out += '\n'; // preserve line numbers
      i += 1;
      continue;
    }
    if (inStr) {
      out += ch;
      if (escape) { escape = false; i += 1; continue; }
      if (ch === '\\') { escape = true; i += 1; continue; }
      if (ch === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') { inLine = true; i += 2; continue; }
    if (ch === '/' && next === '*') { inBlock = true; i += 2; continue; }
    if (ch === '"' || ch === '\'' || ch === '`') {
      inStr = ch;
      out += ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

// ─── Scanners ───────────────────────────────────────────────

/**
 * Find JSX text children — substrings between `>` and `<` that
 * contain plain text. Skips strings inside `{...}` expressions
 * (they need separate scanning via the string-literal route).
 *
 * Returns array of { lineNo, colNo, text }.
 */
function scanJsxText(src) {
  const out = [];
  // Match >Some Text<  but NOT  >{expr}<  or  >...<
  // The capture group must NOT contain `{`, `<`, or `>`.
  const re = />\s*([^<>{}\n][^<>{}\n]*?)\s*</g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const text = m[1].trim();
    if (!looksVisible(text)) continue;
    const prefix = src.slice(0, m.index);
    const lineNo = prefix.split('\n').length;
    const colNo  = m.index - prefix.lastIndexOf('\n');
    out.push({ lineNo, colNo, text, kind: 'jsx-text' });
  }
  return out;
}

/**
 * Find JSX attribute string values. Match `attr="..."` and
 * `attr={'...'}`. Filter by attr name + value heuristics.
 *
 * Returns array of { lineNo, colNo, text, attr }.
 */
function scanJsxAttr(src) {
  const out = [];
  // attr="string"  or  attr='string'  or  attr={"string"}  or  attr={'string'}
  const re = /\b([\w-]+)\s*=\s*(?:\{(?:\s*['"])([^'"]+)['"](?:\s*)\}|(['"])([^'"]+)\3)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const attr = m[1];
    const text = (m[2] || m[4] || '').trim();
    if (!text) continue;
    if (TECHNICAL_ATTRS.has(attr)) continue;
    // Only consider attrs we know are user-visible, OR any attr
    // whose name ends with -friendly suffixes.
    const isVisibleAttr =
         VISIBLE_ATTRS.has(attr)
      || /(Label|Text|Title|Message|Caption|Hint|Heading|Subtitle|Tooltip|Description|Placeholder)$/.test(attr);
    if (!isVisibleAttr) continue;
    if (!looksVisible(text)) continue;
    const prefix = src.slice(0, m.index);
    const lineNo = prefix.split('\n').length;
    const colNo  = m.index - prefix.lastIndexOf('\n');
    // Was this whole attribute value already wrapped by a helper?
    // E.g. `placeholder={t('search')}` — the regex won't match that
    // shape (it requires a literal string), so no further check is
    // needed. We pre-filter via the literal-only regex.
    out.push({ lineNo, colNo, text, kind: 'jsx-attr', attr });
  }
  return out;
}

/**
 * Find bare string literals passed as JSX children:
 *   {'Some text'}
 *   {"Some text"}
 * Already-helped calls (t('Some text')) don't match because we
 * look for the {'...'} shape specifically.
 */
function scanJsxStringExpr(src) {
  const out = [];
  // Match `{   'literal'   }` or `{"literal"}` directly as a JSX
  // child. The opening `{` must be preceded by `>` (start of JSX
  // expression) for accuracy.
  const re = />\s*\{\s*(['"])([^'"]+)\1\s*\}/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const text = m[2].trim();
    if (!looksVisible(text)) continue;
    const prefix = src.slice(0, m.index);
    const lineNo = prefix.split('\n').length;
    const colNo  = m.index - prefix.lastIndexOf('\n');
    out.push({ lineNo, colNo, text, kind: 'jsx-string-expr' });
  }
  return out;
}

// ─── Walk + tally ───────────────────────────────────────────

function walk(absDir, list) {
  let entries;
  try { entries = readdirSync(absDir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const next = join(absDir, e.name);
    if (e.isDirectory()) { walk(next, list); continue; }
    if (!FILE_RE.test(e.name)) continue;
    if (SKIP_FILE_RE.test(e.name)) continue;
    list.push(next);
  }
}

function scanFile(abs) {
  let src;
  try { src = readFileSync(abs, 'utf8'); }
  catch { return []; }
  const clean = stripComments(src);
  return [
    ...scanJsxText(clean),
    ...scanJsxAttr(clean),
    ...scanJsxStringExpr(clean),
  ];
}

// ─── Main ───────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const argVal = (flag) => {
  const i = process.argv.indexOf(flag);
  return i > 0 && i < process.argv.length - 1 ? process.argv[i + 1] : null;
};
const UPDATE  = args.has('--update');
const BY_FILE = args.has('--by-file');
const LIST    = args.has('--list');
const TOP     = Number(argVal('--top')) || 50;

const files = [];
for (const root of SCAN_ROOTS) walk(resolve(ROOT, root), files);

const byFile = new Map();
let total = 0;
for (const abs of files) {
  const hits = scanFile(abs);
  if (hits.length === 0) continue;
  const rel = relative(ROOT, abs).replace(/\\/g, '/');
  byFile.set(rel, hits);
  total += hits.length;
}

if (UPDATE) {
  console.log(`[check:hardcoded-strings] count = ${total}`);
  console.log('Update BASELINE in scripts/ci/check-hardcoded-strings.mjs to: ' + total);
  process.exit(0);
}

if (BY_FILE || LIST) {
  const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log(`[check:hardcoded-strings] ${files.length} files scanned, ${byFile.size} with leaks, ${total} leaks total`);
  console.log('');
  let printed = 0;
  for (const [rel, hits] of sorted) {
    if (printed >= TOP) break;
    console.log(`  ${hits.length.toString().padStart(4)}  ${rel}`);
    printed += 1;
    if (LIST) {
      for (const h of hits.slice(0, 5)) {
        const snippet = h.text.length > 60 ? h.text.slice(0, 60) + '…' : h.text;
        console.log(`         L${h.lineNo}:${h.colNo}  [${h.kind}${h.attr ? '/' + h.attr : ''}]  "${snippet}"`);
      }
      if (hits.length > 5) console.log(`         …and ${hits.length - 5} more in this file`);
    }
  }
  process.exit(0);
}

const limit = BASELINE + GROWTH_TOLERANCE;
const ok = total <= limit;

if (ok) {
  console.log(`✓ check:hardcoded-strings: ${total} leaks (baseline ${BASELINE}, tolerance ${GROWTH_TOLERANCE})`);
  if (total < BASELINE) {
    console.log(`   Migration progress: ${BASELINE - total} leak(s) removed. `
      + 'Ratchet BASELINE down to ' + total + ' to lock the progress.');
  }
  process.exit(0);
}

console.error(`✗ check:hardcoded-strings: ${total} leaks (baseline ${BASELINE}, limit ${limit})`);
console.error(`   PR raised the count by ${total - limit}.`);
console.error('   Migrate the new strings through tSafe() / the crop registry / task templates.');
console.error('   Inspect via:  node scripts/ci/check-hardcoded-strings.mjs --by-file --top 20');
console.error('   List literals:  node scripts/ci/check-hardcoded-strings.mjs --list --top 20');
process.exit(1);
