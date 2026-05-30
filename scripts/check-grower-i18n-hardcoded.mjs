#!/usr/bin/env node
// CI gate: Grower-facing pages must be externalized through tSafe/tStrict.
// Counts tSafe(...) / tStrict(...) call sites as proxy for externalization.
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

const TARGETS = [
  "src/pages/FarmerActivitiesTab.jsx",
  "src/pages/FarmerRegisterPage.jsx",
  "src/pages/Today.jsx",
];

const MIN_CALLS = 5;
const callRegex = /\b(?:tSafe|tStrict)\s*\(/g;

for (const rel of TARGETS) {
  const src = readOrFail(rel);
  if (!src) continue;
  const stripped = stripComments(src);
  const matches = stripped.match(callRegex) || [];
  const n = matches.length;
  if (n < MIN_CALLS) {
    FAILED.push(
      `${rel}: only ${n} tSafe/tStrict call(s) — expected at least ${MIN_CALLS} (externalization incomplete)`
    );
  } else {
    PASSED.push(`${rel}: ${n} tSafe/tStrict calls (>= ${MIN_CALLS})`);
  }
}

// I18nGrowerHealth.ts must exist with version constant + SUPPORTED_LANGUAGES of 6 locales
const healthRel = "src/runtime/launch/I18nGrowerHealth.ts";
const healthSrc = readOrFail(healthRel);
if (healthSrc) {
  if (!/version/i.test(healthSrc)) {
    FAILED.push(`${healthRel}: missing version constant`);
  } else {
    PASSED.push(`${healthRel}: version constant present`);
  }

  // Find SUPPORTED_LANGUAGES = [ ... ] and count quoted entries
  const m = healthSrc.match(/SUPPORTED_LANGUAGES\s*[:=][^[]*\[([\s\S]*?)\]/);
  if (!m) {
    FAILED.push(
      `${healthRel}: SUPPORTED_LANGUAGES array not found`
    );
  } else {
    const body = m[1];
    const entries = body.match(/["'`][^"'`]+["'`]/g) || [];
    if (entries.length !== 6) {
      FAILED.push(
        `${healthRel}: SUPPORTED_LANGUAGES has ${entries.length} entries — expected exactly 6 locales`
      );
    } else {
      PASSED.push(`${healthRel}: SUPPORTED_LANGUAGES has 6 locales`);
    }
  }
}

if (FAILED.length > 0) {
  console.error("[check:grower-i18n-hardcoded] FAIL");
  for (const f of FAILED) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log(
  `[check:grower-i18n-hardcoded] PASS — ${PASSED.length} invariants verified (tSafe/tStrict thresholds met, 6 locales registered)`
);
