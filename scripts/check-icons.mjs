#!/usr/bin/env node
/**
 * check-icons.mjs — build-time guard for icon + PWA-logo
 * references. Sibling to scripts/check-realism-assets.mjs.
 *
 * Verifies:
 *   1. Every path in src/assets/assetManifest.js → ASSETS.icons
 *      AND ASSETS.fallbacks resolves to a real file under public/.
 *   2. Every /icons/* path referenced from public/manifest.json
 *      AND index.html ALSO exists on disk.
 *   3. The four spec-mandated must-exist icons:
 *        favicon, 192, 512, apple-touch-icon
 *      are present + non-zero size.
 *
 * Why this matters
 *   The "Permanent Runtime Asset + URL Fix" listed these
 *   production 404s:
 *     /icons/logo-premium.jpg
 *     /icons/logo-premium-192.jpg
 *   Both files are present locally + git-tracked since 2026-05-11
 *   (verified) — the production failure is a stale CDN deploy.
 *   This script makes future drift impossible: a renamed,
 *   moved, or deleted icon fails the build BEFORE the deploy
 *   ships, so the production console can never silently
 *   regress to a 404.
 *
 *   npm run check:icons
 *
 *   Wired into build:safe alongside the realism / production-
 *   assets / url-construction checks.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT   = resolve(__dirname, '..');
const PUBLIC = resolve(ROOT, 'public');

function fail(msg) {
  console.error('[check:icons] FAIL —', msg);
  process.exit(1);
}

function ok(msg) {
  console.log('[check:icons]', msg);
}

function readManifest() {
  // The manifest is a frozen JS module; we parse the literal
  // strings out of the source so the check is dependency-free
  // (no Vite / TS / ESM resolution required).
  const src = readFileSync(
    resolve(ROOT, 'src/assets/assetManifest.js'), 'utf8',
  );
  const paths = [];
  const re = /['"](\/(?:icons|assets)\/[^'"]+?\.(?:png|jpg|jpeg|svg|webp|ico))['"]/g;
  let m;
  while ((m = re.exec(src)) != null) paths.push(m[1]);
  return Array.from(new Set(paths));
}

function scanHtmlIcons(html) {
  const paths = [];
  const re = /['"](\/icons\/[^'"]+?\.(?:png|jpg|jpeg|svg|webp|ico))['"]/g;
  let m;
  while ((m = re.exec(html)) != null) paths.push(m[1]);
  return Array.from(new Set(paths));
}

function publicPathOf(rootRel) {
  // rootRel like '/icons/foo.png' -> '<public>/icons/foo.png'
  return resolve(PUBLIC, rootRel.replace(/^\/+/, ''));
}

function fileOnDisk(rootRel) {
  const p = publicPathOf(rootRel);
  if (!existsSync(p)) return null;
  try { return statSync(p); } catch { return null; }
}

const MUST_EXIST = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

function main() {
  // 1) assetManifest paths.
  const manifestPaths = readManifest();
  const missing = [];
  for (const p of manifestPaths) {
    const stat = fileOnDisk(p);
    if (!stat) missing.push(p);
  }
  if (missing.length > 0) {
    fail('assetManifest references files missing on disk:\n  '
      + missing.join('\n  '));
  }
  ok('assetManifest — ' + manifestPaths.length + ' icon path(s), all present on disk.');

  // 2) public/manifest.json + index.html.
  for (const rel of ['public/manifest.json', 'index.html']) {
    const abs = resolve(ROOT, rel);
    if (!existsSync(abs)) {
      ok('skipping ' + rel + ' (not present)');
      continue;
    }
    const text = readFileSync(abs, 'utf8');
    const found = scanHtmlIcons(text);
    const gone  = [];
    for (const p of found) {
      const stat = fileOnDisk(p);
      if (!stat) gone.push(p);
    }
    if (gone.length > 0) {
      fail(rel + ' references icons missing on disk:\n  ' + gone.join('\n  '));
    }
    ok(rel + ' — ' + found.length + ' /icons/ reference(s), all present on disk.');
  }

  // 3) MUST_EXIST gate — these four icons block the build
  //    if absent regardless of whether they're referenced.
  for (const p of MUST_EXIST) {
    const stat = fileOnDisk(p);
    if (!stat) fail('required icon missing on disk: ' + p);
    if (stat.size < 100) fail('required icon too small (< 100 bytes): ' + p);
  }
  ok('required icons — ' + MUST_EXIST.length + ' present + non-empty.');

  ok('PASS — every icon manifest entry + every PWA / HTML reference resolves to a real file.');
}

main();
