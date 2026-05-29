#!/usr/bin/env node
/**
 * scripts/check-godmode-internal-only.mjs — Lock /internal/
 * godmode (and the related internal pages) behind the internal
 * flag.
 *
 * Hard blockers:
 *   A. /internal/godmode route exists in App.jsx.
 *   B. src/pages/internal/Godmode.jsx exists and checks
 *      INTERNAL_FLAG_KEY.
 *   C. No grower-facing nav file references /internal/godmode.
 *   D. No grower-facing UI surfaces __godmodeHealth() result
 *      (search src/components + src/pages excluding internal/).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function readOrEmpty(f) {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

// ─── A. Route exists ───────────────────────────────────────────
const app = readOrEmpty(path.join(ROOT, 'src/App.jsx'));
if (!/path\s*=\s*['"]\/internal\/godmode['"][\s\S]{0,200}?<GodmodePage/.test(app)) {
  fail(`route: /internal/godmode missing in App.jsx`);
} else {
  pass(`route: /internal/godmode registered`);
}

// ─── B. Page exists + internal-gated ───────────────────────────
const pagePath = path.join(ROOT, 'src/pages/internal/Godmode.jsx');
const page = readOrEmpty(pagePath);
if (!page) {
  fail(`page: src/pages/internal/Godmode.jsx missing`);
} else {
  if (!page.includes('INTERNAL_FLAG_KEY')) {
    fail(`page: Godmode.jsx must check INTERNAL_FLAG_KEY`);
  }
  if (!page.includes('godmode-internal-only')) {
    fail(`page: Godmode.jsx must render "internal only" empty state`);
  }
  pass(`page: Godmode.jsx gated by INTERNAL_FLAG_KEY`);
}

// ─── C. No grower nav reference ────────────────────────────────
const NAV_DIR = path.join(ROOT, 'src/navigation');
let navLeak = false;
for (const f of walk(NAV_DIR)) {
  const src = readOrEmpty(f);
  if (/['"]\/internal\/godmode['"]/.test(src)
      || /\bgodmode\b/i.test(src)) {
    fail(`nav-leak: ${path.relative(ROOT, f)} references godmode`);
    navLeak = true;
  }
}
if (!navLeak) pass(`nav-leak: no grower nav references /internal/godmode`);

// ─── D. No grower UI surfaces __godmodeHealth() ────────────────
const COMPONENTS_DIR = path.join(ROOT, 'src/components');
const PAGES_DIR      = path.join(ROOT, 'src/pages');
const INTERNAL_DIR   = path.join(ROOT, 'src/pages/internal');
let surfaceLeak = false;
for (const f of walk(COMPONENTS_DIR).concat(walk(PAGES_DIR))) {
  if (f.startsWith(INTERNAL_DIR)) continue;
  const src = readOrEmpty(f);
  if (/__godmodeHealth\b/.test(src)
      || /__launchReadiness\b/.test(src)) {
    fail(`surface-leak: ${path.relative(ROOT, f)} surfaces godmode/launch-readiness probe to growers`);
    surfaceLeak = true;
  }
}
if (!surfaceLeak) pass(`surface-leak: no grower UI surfaces __godmodeHealth or __launchReadiness`);

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:godmode-internal-only] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:godmode-internal-only] PASS — /internal/godmode locked behind internal flag, no grower surface leak.');
