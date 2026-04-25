#!/usr/bin/env node
/**
 * bake-sw-version.mjs
 *
 * Build-time step that replaces `__APP_VERSION__` in the bundled
 * service worker with `${package.json:version}-${shortBuildHash}`.
 * Runs as the `postbuild` npm script — no manual bumping required.
 *
 *   node scripts/bake-sw-version.mjs
 *     → 0 when sw.js is rewritten in dist/
 *     → 1 if dist/sw.js or package.json is missing.
 *
 * The hash component is derived from the SW source itself + the
 * current ISO timestamp truncated to the minute, so two builds of
 * the same source on the same minute produce identical cache names
 * (deterministic), but two builds on different minutes do not.
 * That guarantees a redeploy with no source change still evicts
 * stale clients within ~60s.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const PKG = path.join(ROOT, 'package.json');
const DIST_SW = path.join(ROOT, 'dist', 'sw.js');
const PUBLIC_SW = path.join(ROOT, 'public', 'sw.js');

function fail(msg) {
  console.error(`\u2717 bake-sw-version: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(PKG)) fail('package.json not found');
let pkg;
try { pkg = JSON.parse(fs.readFileSync(PKG, 'utf8')); }
catch (e) { fail(`package.json parse failed: ${e.message}`); }

const version = pkg.version || '0.0.0';

// Pick a target — prefer dist/ (post-build), fall back to public/
// (so dev runs of this script during testing also rewrite the file).
const target = fs.existsSync(DIST_SW) ? DIST_SW : PUBLIC_SW;

let src;
try { src = fs.readFileSync(target, 'utf8'); }
catch (e) { fail(`could not read ${target}: ${e.message}`); }

if (!src.includes('__APP_VERSION__')) {
  // Already baked — keep idempotent so the script can run twice
  // without breaking. Just log and exit cleanly.
  console.log(`\u2713 bake-sw-version: ${path.relative(ROOT, target)} already baked`);
  process.exit(0);
}

const isoMinute = new Date().toISOString().slice(0, 16); // 2026-04-23T13:30
const hash = crypto.createHash('sha256')
  .update(src)
  .update(isoMinute)
  .digest('hex')
  .slice(0, 8);
const baked = `${version}-${hash}`;

const out = src.replaceAll('__APP_VERSION__', baked);
fs.writeFileSync(target, out, 'utf8');

console.log(`\u2713 bake-sw-version: ${path.relative(ROOT, target)} → ${baked}`);
