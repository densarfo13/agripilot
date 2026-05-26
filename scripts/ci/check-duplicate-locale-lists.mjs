#!/usr/bin/env node
/**
 * check-duplicate-locale-lists.mjs
 *
 * CI guard — fails the build if any file outside the canonical
 * registry declares its own list of locale codes. The fix is to
 * import SUPPORTED_LOCALES (or LOCALE_CODES / LANGUAGES) from the
 * single source of truth.
 *
 *   Canonical source: src/i18n/supportedLocales.ts
 *   Allowlist:        anything that legitimately needs its own
 *                     list (the canonical file itself, the legacy
 *                     LANGUAGES re-export in src/i18n/index.js,
 *                     vitest setup files, test fixtures, the
 *                     en.json / hi.json / etc. locale data files,
 *                     and the column loader / language resolver
 *                     which need to enumerate the set).
 *
 * What it catches:
 *   A file declares an array of `{ code: 'en' ... }, { code: 'fr' ... }`
 *   entries (in any order) — the exact regression that produced the
 *   "only English in the picker" bug.
 *
 *   node scripts/ci/check-duplicate-locale-lists.mjs
 *     exit 0 — no duplicate lists outside the allowlist
 *     exit 1 — one or more violations
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SRC  = path.join(ROOT, 'src');

// Files that legitimately enumerate locale codes. Add to this list
// rather than to a fresh ad-hoc array elsewhere.
const ALLOWLIST = new Set([
  // The source of truth itself.
  'src/i18n/supportedLocales.ts',
  // Legacy compatibility — LANGUAGES is now projected from the
  // canonical source but the file still hosts the named export
  // for backward compat with the 100+ existing imports.
  'src/i18n/index.js',
  // Backend mirrors of the locale enum (server-side language
  // resolution, voice guide, language detection heuristics).
  'src/i18n/columnLoader.js',
  'src/i18n/languageConfig.js',
  'src/i18n/i18next.js',
  'src/i18n/languageResolver.js',
  'src/lib/languageResolver.js',
  'src/i18n/cropNames.js',
  // Audit + dev surfaces — by definition they enumerate locales.
  'src/i18n/devConsoleAudit.js',
  'src/i18n/devMismatchDetector.js',
  'src/i18n/devTextAudit.js',
  'src/i18n/audit.js',
  'src/i18n/i18nStateDevHook.js',
  'src/i18n/scanRenderedTextForEnglish.js',
  'src/dev/i18nLeakScanner.js',
  // Voice guide — shares the same 6-code set with VOICE_LANGUAGES.
  'src/utils/voiceGuide.js',
  'src/lib/voice/voiceGuide.js',
  // Voice preferences carries a different concept: TTS region tags
  // (en-GH, tw-GH, ha-NG, …) plus an 'auto' option that doesn't
  // exist in the UI locale set. Legitimately a parallel registry.
  'src/lib/voice/voicePreferences.js',
  // Quick-pick / long-tail language config used by the first-launch
  // chip row. Lists translation-less locales (es, pt, ar, am, yo,
  // ig, zu) that fall back to English via the resolver. Conceptually
  // different scope from SUPPORTED_LOCALES.
  'src/config/languages.js',
  // Legacy parallel translation system with its own embedded
  // messages table. The canonical translations.js has long since
  // superseded it; kept until the last consumer is migrated.
  'src/lib/i18n.js',
]);

// Regex matches `{ code: 'xx'` entries. We then count distinct codes;
// if a file has 3+ ≠ codes in close succession AND isn't in the
// allowlist, that's a duplicate locale list.
const ENTRY_RE = /\{\s*code\s*:\s*['"]([a-z]{2})['"]/g;

const SUPPORTED = new Set(['en', 'fr', 'sw', 'ha', 'tw', 'hi']);

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '__tests__'
          || ent.name === 'tests' || ent.name === 'dist') continue;
      walk(full, out);
      continue;
    }
    if (!/\.(js|jsx|ts|tsx)$/i.test(ent.name)) continue;
    out.push(full);
  }
  return out;
}

function relFromRoot(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

function scan() {
  const files = walk(SRC, []);
  const violations = [];
  for (const file of files) {
    const rel = relFromRoot(file);
    if (ALLOWLIST.has(rel)) continue;
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const codes = new Set();
    let m;
    ENTRY_RE.lastIndex = 0;
    while ((m = ENTRY_RE.exec(text)) !== null) {
      if (SUPPORTED.has(m[1])) codes.add(m[1]);
    }
    // 3+ supported codes in one file is the duplicate-list signature.
    // (Pickers / nav / settings each used 4–6 codes inline.)
    if (codes.size >= 3) {
      violations.push({ file: rel, codes: Array.from(codes).sort() });
    }
  }
  return violations;
}

function main() {
  const violations = scan();
  if (violations.length === 0) {
    console.log('[check:duplicate-locale-lists] OK — no inline locale lists outside the canonical registry.');
    process.exit(0);
  }
  console.error('[check:duplicate-locale-lists] FAIL — '
    + violations.length + ' file(s) declare an inline locale list:');
  for (const v of violations) {
    console.error('  • ' + v.file + '  (codes: ' + v.codes.join(', ') + ')');
  }
  console.error('');
  console.error('Fix: import SUPPORTED_LOCALES (or LOCALE_CODES / LANGUAGES) from');
  console.error('     src/i18n/supportedLocales.ts and project the shape you need.');
  console.error('     If this file legitimately needs its own list, add it to ALLOWLIST');
  console.error('     in scripts/ci/check-duplicate-locale-lists.mjs.');
  process.exit(1);
}

main();
