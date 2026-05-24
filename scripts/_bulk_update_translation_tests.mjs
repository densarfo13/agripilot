#!/usr/bin/env node
/**
 * One-shot bulk-updater for the server test files that grep
 * src/i18n/translations.js source text. After the column-split
 * cutover, the runtime translations.js is a thin shim with no
 * inline keys — so each test file needs to swap the source.
 *
 * For every test file in server/src/__tests__ that contains
 * `readFile('src/i18n/translations.js')` or
 * `read('src/i18n/translations.js')`:
 *   1. Insert `import { TRANSLATIONS_SOURCE_TEXT } from './_helpers/legacyTranslationsText.js';`
 *      after the last existing `import` line near the top.
 *   2. Replace the call with `TRANSLATIONS_SOURCE_TEXT`.
 *
 * Idempotent — re-running skips files that already import the helper
 * (still performs any leftover call replacements).
 *
 * This script is committed alongside the bulk edit so the migration
 * is reviewable and reproducible.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TEST_DIR = resolve(ROOT, 'server', 'src', '__tests__');

const HELPER_IMPORT =
  "import { TRANSLATIONS_SOURCE_TEXT } from './_helpers/legacyTranslationsText.js';";
const OLD_CALL_RE = /\b(?:read|readFile)\(\s*['"]src\/i18n\/translations\.js['"]\s*\)/g;
const NEW_CALL = 'TRANSLATIONS_SOURCE_TEXT';

const entries = readdirSync(TEST_DIR);
const results = [];

for (const name of entries) {
  if (!name.endsWith('.test.js')) continue;
  const path = resolve(TEST_DIR, name);
  let text = readFileSync(path, 'utf8');
  if (!OLD_CALL_RE.test(text)) continue;
  OLD_CALL_RE.lastIndex = 0;
  if (text.includes(HELPER_IMPORT)) {
    const updated = text.replace(OLD_CALL_RE, NEW_CALL);
    if (updated !== text) {
      writeFileSync(path, updated, 'utf8');
      results.push(`call-swap-only: ${name}`);
    }
    continue;
  }
  const importRe = /^import [^\n]+;$/gm;
  let lastImportEnd = -1;
  let m;
  while ((m = importRe.exec(text))) {
    lastImportEnd = m.index + m[0].length;
  }
  if (lastImportEnd < 0) {
    results.push(`SKIP (no import block found): ${name}`);
    continue;
  }
  const insertion = '\n' + HELPER_IMPORT;
  text = text.slice(0, lastImportEnd) + insertion + text.slice(lastImportEnd);
  text = text.replace(OLD_CALL_RE, NEW_CALL);
  writeFileSync(path, text, 'utf8');
  results.push(`updated: ${name}`);
}

console.log(`[bulk-update] processed ${results.length} test file(s):`);
for (const r of results) console.log('  ' + r);
