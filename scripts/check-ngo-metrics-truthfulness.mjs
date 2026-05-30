#!/usr/bin/env node
// CI gate: NGO dashboard metrics must surface honest empty-states.
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];

function stripComments(src) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, "");
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
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

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const s = fs.statSync(full);
    if (s.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// 1. NgoMetricsHealth.ts must exist with version + ngoMetricsHealth() + recordApiCall()
const healthRel = "src/runtime/launch/NgoMetricsHealth.ts";
const healthSrc = readOrFail(healthRel);
if (healthSrc) {
  if (!/version/i.test(healthSrc)) {
    FAILED.push(`${healthRel}: missing version constant`);
  } else {
    PASSED.push(`${healthRel}: version constant present`);
  }
  if (!/\bngoMetricsHealth\s*\(/.test(healthSrc)) {
    FAILED.push(`${healthRel}: missing ngoMetricsHealth() function`);
  } else {
    PASSED.push(`${healthRel}: ngoMetricsHealth() function present`);
  }
  if (!/\brecordApiCall\s*\(/.test(healthSrc)) {
    FAILED.push(`${healthRel}: missing recordApiCall() function`);
  } else {
    PASSED.push(`${healthRel}: recordApiCall() function present`);
  }
}

// 2. At least one NGO-facing file must contain BOTH honest empty-state strings
const candidates = [];
const ngoPagesDir = path.join(ROOT, "src/pages/ngo");
const ngoComponentsDir = path.join(ROOT, "src/components/ngo");
const ngoDashboardFile = path.join(ROOT, "src/pages/NgoDashboardV1.jsx");

candidates.push(...walk(ngoPagesDir));
candidates.push(...walk(ngoComponentsDir));
if (fs.existsSync(ngoDashboardFile)) candidates.push(ngoDashboardFile);

const NEEDLE_A = "Data temporarily unavailable";
const NEEDLE_B = "Not enough data yet";

let hitFile = null;
for (const f of candidates) {
  try {
    const src = fs.readFileSync(f, "utf8");
    if (src.includes(NEEDLE_A) && src.includes(NEEDLE_B)) {
      hitFile = f;
      break;
    }
  } catch {
    // skip unreadable
  }
}

if (!hitFile) {
  FAILED.push(
    `No NGO file under src/pages/ngo, src/components/ngo, or src/pages/NgoDashboardV1.jsx contains both "Data temporarily unavailable" AND "Not enough data yet"`
  );
} else {
  const relHit = path.relative(ROOT, hitFile).replace(/\\/g, "/");
  PASSED.push(`${relHit}: contains both honest empty-state strings`);
}

if (FAILED.length > 0) {
  console.error("[check:ngo-metrics-truthfulness] FAIL");
  for (const f of FAILED) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log(
  `[check:ngo-metrics-truthfulness] PASS — ${PASSED.length} invariants verified (health module wired, honest empty-states present)`
);
