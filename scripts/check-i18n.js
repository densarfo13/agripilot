#!/usr/bin/env node
/**
 * scripts/check-i18n.js — broader-than-CI i18n usage coverage.
 *
 * The existing CI guard at `scripts/ci/check-i18n-coverage.mjs`
 * enforces a hard 95% threshold on a curated list of high-risk
 * domains (insight.*, econ.*, rainfall.*, seasonal.*, topCrops.*).
 * That guard fails the build when those specific domains regress.
 *
 * THIS script answers a different question: "of every translation
 * key referenced via `t('...')` in the source tree, what % are
 * defined for each launch language?" Plus: "which keys are defined
 * but never used?"
 *
 * Why a separate file (not extend the CI guard)
 *   • The CI guard is wired to `npm run guards`, runs on every push,
 *     and fails the build at 95%. It must stay narrow + fast.
 *   • This script is a developer / launch-gate tool that reports
 *     coverage and orphans across the WHOLE call-site graph; it
 *     warns at <95% but does not fail the build (per spec #7) —
 *     it's a status snapshot, not a gate.
 *
 * Active launch languages (mirrors check-i18n-coverage.mjs):
 *   en, tw, hi
 *
 *   node scripts/check-i18n.js
 *     → exit 0 always (warning-only). Prints:
 *         • coverage % per language
 *         • missing keys per language (top 20)
 *         • unused keys (top 20) — defined but never referenced
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const SRC_DIRS  = ['src'];
const TRANSLATIONS_FILE = path.join(ROOT, 'src/i18n/translations.js');
const HI_FILE  = path.join(ROOT, 'src/i18n/hi.js');

// Active launch languages
const LAUNCH_LANGUAGES = ['en', 'tw', 'hi'];

// Soft warning threshold (per spec #7).
const WARN_BELOW = 0.95;

// Skip patterns when scanning source.
const SKIP_DIRS = new Set(['node_modules', '__tests__', 'dist', 'build', '.git']);
const SKIP_FILE_RE = /\.test\.[jt]sx?$|\.spec\.[jt]sx?$|\.d\.ts$/;

// ─── Step 1: walk source for `t('key')` calls ───────────────

function walkSrc(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkSrc(full, out);
    else if (/\.(js|jsx|ts|tsx|mjs)$/.test(e.name) && !SKIP_FILE_RE.test(e.name)) {
      out.push(full);
    }
  }
}

// `t('foo.bar')` / `t("foo.bar")` / `tShort('sms.x')` / `useTranslation()...t('k')` / `useCropLabel()` is ignored.
// We accept the function names that bind to the central `t()` helper.
const T_CALL_RE = /\b(?:t|tShort|tPlural)\s*\(\s*['"]([a-zA-Z_][\w.]+)['"]/g;

function collectUsedKeys(files) {
  const used = new Map(); // key → first file:line
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      let m;
      T_CALL_RE.lastIndex = 0;
      while ((m = T_CALL_RE.exec(line))) {
        if (!used.has(m[1])) {
          used.set(m[1], `${path.relative(ROOT, f).replace(/\\/g, '/')}:${i + 1}`);
        }
      }
    }
  }
  return used;
}

// ─── Step 2: extract DEFINED keys per language ──────────────

function extractKeys(text) {
  const set = new Set();
  const re = /^\s*'([a-zA-Z][\w.]+)'\s*:/gm;
  let m;
  while ((m = re.exec(text))) set.add(m[1]);
  return set;
}

function extractKeysWithLangSlot(text, lang) {
  const set = new Set();
  const keyRe = /^\s*'([a-zA-Z][\w.]+)'\s*:\s*\{/gm;
  const slotRe = new RegExp(`\\b${lang}\\s*:\\s*['\`"]([^'\`"]+)['\`"]`);
  let m;
  while ((m = keyRe.exec(text))) {
    const startIdx = m.index + m[0].length;
    let depth = 1;
    let i = startIdx;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    const block = text.slice(startIdx, i - 1);
    if (slotRe.test(block)) set.add(m[1]);
  }
  return set;
}

// ─── Step 3: report ─────────────────────────────────────────

function pctStr(n, d) {
  if (d === 0) return '100%';
  return ((n / d) * 100).toFixed(1) + '%';
}

function main() {
  const files = [];
  for (const d of SRC_DIRS) walkSrc(path.join(ROOT, d), files);

  const used = collectUsedKeys(files);
  const usedKeys = [...used.keys()];

  if (!fs.existsSync(TRANSLATIONS_FILE) || !fs.existsSync(HI_FILE)) {
    console.error('check-i18n: missing translation file(s)');
    process.exit(0); // soft script
  }
  const enText = fs.readFileSync(TRANSLATIONS_FILE, 'utf8');
  const hiText = fs.readFileSync(HI_FILE, 'utf8');

  // English keys = every key declared in translations.js (the
  // source language always has an `en:` slot in each entry).
  const enDefined = extractKeys(enText);
  const hiDefined = extractKeys(hiText);
  const twDefined = extractKeysWithLangSlot(enText, 'tw');

  const definedByLang = { en: enDefined, tw: twDefined, hi: hiDefined };

  console.log(`Scanned ${files.length} source file(s).`);
  console.log(`Used translation keys: ${usedKeys.length} unique`);
  console.log(`Active launch languages: ${LAUNCH_LANGUAGES.join(', ')}`);
  console.log('');

  let anyWarn = false;
  for (const lang of LAUNCH_LANGUAGES) {
    const defined = definedByLang[lang];
    const present = usedKeys.filter((k) => defined.has(k)).length;
    const total   = usedKeys.length;
    const ratio   = total === 0 ? 1 : present / total;
    const tag     = ratio >= WARN_BELOW ? '\u2713' : '\u26A0';
    console.log(`${tag} ${lang}: ${present}/${total} used keys defined (${pctStr(present, total)})`);
    if (ratio < WARN_BELOW) anyWarn = true;
    // Top 20 missing.
    const missing = usedKeys.filter((k) => !defined.has(k));
    if (missing.length > 0) {
      console.log(`    missing (${missing.length}, showing first 20):`);
      for (const k of missing.slice(0, 20)) {
        console.log(`      - ${k}    (used at ${used.get(k)})`);
      }
    }
  }

  // Unused — defined keys never referenced in source. This is a
  // signal not a gate: stale keys accumulate as features are
  // refactored, and pruning them is a periodic cleanup task.
  console.log('');
  const allDefined = new Set([...enDefined, ...hiDefined, ...twDefined]);
  const unused = [...allDefined].filter((k) => !used.has(k));
  console.log(`Unused defined keys: ${unused.length} (showing first 20)`);
  for (const k of unused.slice(0, 20)) {
    console.log(`  - ${k}`);
  }

  console.log('');
  if (anyWarn) {
    console.warn('check-i18n: at least one launch language is below 95% coverage of used keys.');
    console.warn('             Per spec, this is a warning, not a build failure. Run');
    console.warn('             `npm run guard:i18n` for the strict CI gate on high-risk domains.');
  } else {
    console.log('check-i18n: all launch languages \u2265 95% coverage on used keys.');
  }
}
main();
