#!/usr/bin/env node
/**
 * check-url-construction.mjs — permanent guard against unwrapped
 * `new URL(...)` calls outside the documented safe-wrappers.
 *
 * Why this exists
 *   The Final Runtime Stabilization Pass spec §1 requires every
 *   URL construction in the codebase to flow through safeUrl /
 *   urlBuilder / safeBuildUrl so a missing env var or stale
 *   string can NEVER produce the runtime
 *   "TypeError: Failed to construct 'URL': Invalid URL".
 *
 *   This script scans src/ for `new URL(` occurrences and fails
 *   the build (exit code 1) if any new caller appears outside
 *   the documented whitelist. The whitelist contains the FIVE
 *   modules that legitimately wrap raw URL construction:
 *
 *     src/lib/safeUrl.js                  (exception-free wrapper)
 *     src/lib/urlBuilder.ts               (buildUrl / buildApiUrl /
 *                                          buildFetchUrl)
 *     src/config/env.js                   (env-validated base URLs)
 *     src/lib/analytics/safeTrack.js      (analytics endpoint resolve)
 *     src/security/validateFundingUrl.js  (funding URL safety check)
 *
 *   ANY other caller MUST go through one of those wrappers.
 *
 *   npm run check:url-construction
 *
 *   Wired into build:safe so production deploys cannot regress.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC  = resolve(ROOT, 'src');

const WHITELIST = new Set([
  'src/lib/safeUrl.js',
  'src/utils/safeUrl.js',                // sibling wrapper used by config/env.js
  'src/lib/urlBuilder.ts',
  'src/config/env.js',
  'src/lib/analytics/safeTrack.js',
  'src/security/validateFundingUrl.js',
]);

// Skip directories that contain build output, test fixtures, or
// vendored content we don't author.
const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '__tests__', '__mocks__',
]);

// Skip filenames that LEGITIMATELY use new URL (build tooling).
const SKIP_FILES = new Set([
  // Vite-style import.meta.url -> __dirname patterns; allow
  // the explicit pattern below catches those.
]);

const ALLOWED_PATTERNS = [
  // `new URL('.', import.meta.url)` is a Vite-standard idiom
  // for resolving sibling files — completely safe, no string
  // input from the user.
  /new URL\(['"]\.['"]\s*,\s*import\.meta\.url\)/,
  // `new URL('./some/path', import.meta.url)` — same idiom.
  /new URL\(['"][^'"]+['"]\s*,\s*import\.meta\.url\)/,
];

function fail(violations) {
  console.error('[check:url-construction] FAIL — '
    + violations.length + ' unwrapped new URL() call(s) outside the safe-wrapper whitelist:');
  for (const v of violations) {
    console.error('  • ' + v.path + ':' + v.line + '\n      ' + v.snippet);
  }
  console.error('\nWrap with safeUrl / buildUrl / safeBuildUrl from the documented wrappers,');
  console.error('or - if this is genuinely a new wrapper - add the file to the WHITELIST');
  console.error('in scripts/check-url-construction.mjs.');
  process.exit(1);
}

function ok(count, skippedAllowed) {
  console.log(
    '[check:url-construction] OK — '
    + count + ' wrapped caller(s) across the whitelist; '
    + skippedAllowed + ' Vite-idiom new URL() call(s) accepted; no rogue construction.',
  );
}

function isSourceFile(name) {
  return /\.(js|jsx|ts|tsx|mjs)$/.test(name);
}

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && isSourceFile(entry) && !SKIP_FILES.has(entry)) {
      out.push(full);
    }
  }
}

function scanFile(absPath) {
  const rel = relative(ROOT, absPath).replace(/\\/g, '/');
  const text = readFileSync(absPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits = [];
  let allowedHits = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.includes('new URL(')) continue;
    // Skip lines that are inside a single-line comment or
    // contain only whitespace before //.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*'))  continue;
    if (trimmed.startsWith('/**') || trimmed.startsWith('*/')) continue;
    // Allow the Vite-standard idioms.
    if (ALLOWED_PATTERNS.some((re) => re.test(line))) {
      allowedHits += 1;
      continue;
    }
    hits.push({
      path:    rel,
      line:    i + 1,
      snippet: trimmed.length > 140 ? trimmed.slice(0, 140) + '…' : trimmed,
    });
  }
  return { rel, hits, allowedHits };
}

function main() {
  const files = [];
  walk(SRC, files);

  let totalWhitelistedHits = 0;
  let totalAllowedIdioms   = 0;
  const violations = [];

  for (const f of files) {
    const { rel, hits, allowedHits } = scanFile(f);
    totalAllowedIdioms += allowedHits;
    if (hits.length === 0) continue;
    if (WHITELIST.has(rel)) {
      totalWhitelistedHits += hits.length;
      continue;
    }
    for (const h of hits) violations.push(h);
  }

  if (violations.length > 0) fail(violations);
  ok(totalWhitelistedHits, totalAllowedIdioms);
}

main();
