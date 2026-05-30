#!/usr/bin/env node
// CI gate: Activity nav consistency
// Ensures /progress route redirects to /activity and nav doesn't double-expose progress.
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];

function stripComments(src) {
  // Strip block comments
  let out = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // Strip line comments
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  return out;
}

function stripStrings(src) {
  // Strip double-quoted, single-quoted, and template literal contents (keep quotes for structure)
  let out = src.replace(/"(?:\\.|[^"\\])*"/g, '""');
  out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
  out = out.replace(/`(?:\\.|[^`\\])*`/g, "``");
  return out;
}

function readOrFail(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    FAILED.push(`Missing file: ${rel}`);
    return null;
  }
  return fs.readFileSync(p, "utf8");
}

// 1. BottomTabNav must NOT contain path:"/progress" inside _BACKYARD_ITEMS_BASE block
const navRel = "src/components/farmer/BottomTabNav.jsx";
const navSrc = readOrFail(navRel);
if (navSrc) {
  const stripped = stripComments(navSrc);
  const declIdx = stripped.indexOf("_BACKYARD_ITEMS_BASE");
  if (declIdx === -1) {
    FAILED.push(`${navRel}: _BACKYARD_ITEMS_BASE declaration not found`);
  } else {
    const start = Math.max(0, declIdx - 400);
    const end = Math.min(stripped.length, declIdx + 400);
    const window = stripped.slice(start, end);
    const badPattern = /path\s*:\s*["']\/progress["']/;
    if (badPattern.test(window)) {
      FAILED.push(
        `${navRel}: contains path:"/progress" within ±400 chars of _BACKYARD_ITEMS_BASE (must be removed)`
      );
    } else {
      PASSED.push(`${navRel}: no /progress in _BACKYARD_ITEMS_BASE window`);
    }
  }
}

// 2. App.jsx must contain route element with path="/progress" + <Navigate to="/activity" within 200 chars
const appRel = "src/App.jsx";
const appSrc = readOrFail(appRel);
if (appSrc) {
  const stripped = stripComments(appSrc);
  const pathRegex = /path\s*=\s*"\/progress"/g;
  let m;
  let found = false;
  while ((m = pathRegex.exec(stripped)) !== null) {
    const start = m.index;
    const end = Math.min(stripped.length, start + 200);
    const window = stripped.slice(start, end);
    if (/<Navigate\s+to\s*=\s*"\/activity/.test(window)) {
      found = true;
      break;
    }
  }
  if (!found) {
    FAILED.push(
      `${appRel}: missing redirect route — need path="/progress" with <Navigate to="/activity" within 200 chars`
    );
  } else {
    PASSED.push(`${appRel}: /progress → /activity redirect present`);
  }
}

// 3. FarmerProgressPage.jsx must NOT reference bare navigate( outside strings (only _navigate( allowed)
const progRel = "src/pages/FarmerProgressPage.jsx";
const progSrc = readOrFail(progRel);
if (progSrc) {
  const stripped = stripStrings(stripComments(progSrc));
  // Find any `navigate(` not preceded by an identifier char (so _navigate, myNavigate are OK)
  const bareRegex = /(^|[^A-Za-z0-9_$])navigate\s*\(/g;
  const matches = stripped.match(bareRegex);
  if (matches && matches.length > 0) {
    FAILED.push(
      `${progRel}: found ${matches.length} bare navigate( call(s) — only _navigate( is allowed`
    );
  } else {
    PASSED.push(`${progRel}: no bare navigate( calls`);
  }
}

// 4. ActivityNavHealth.ts must exist with version constant
const healthRel = "src/runtime/launch/ActivityNavHealth.ts";
const healthSrc = readOrFail(healthRel);
if (healthSrc) {
  if (!/version/i.test(healthSrc)) {
    FAILED.push(`${healthRel}: missing version constant`);
  } else {
    PASSED.push(`${healthRel}: present with version constant`);
  }
}

if (FAILED.length > 0) {
  console.error("[check:activity-nav-consistency] FAIL");
  for (const f of FAILED) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log(
  `[check:activity-nav-consistency] PASS — ${PASSED.length} invariants verified (no double-nav, /progress→/activity, no bare navigate, health module present)`
);
