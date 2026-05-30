#!/usr/bin/env node
// CI gate: NGO onboarding import must not silently fake success.
// Blocks reintroduction of synthetic batchId + zero-success metrics.
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

// 1. OnboardingImport.jsx hard blockers
const importRel = "src/pages/organization/OnboardingImport.jsx";
const importSrc = readOrFail(importRel);
if (importSrc) {
  const stripped = stripComments(importSrc);

  // Must NOT contain `"draft-" + ` (silent fake batchId synthesis)
  if (stripped.includes('"draft-" + ')) {
    FAILED.push(
      `${importRel}: contains forbidden fake batchId pattern \`"draft-" + \` — silent synthesis not allowed`
    );
  } else {
    PASSED.push(`${importRel}: no fake batchId synthesis`);
  }

  // Must NOT contain `imported: 0, failed: 0, skipped: 0`
  if (stripped.includes("imported: 0, failed: 0, skipped: 0")) {
    FAILED.push(
      `${importRel}: contains forbidden silent-zero-success metrics \`imported: 0, failed: 0, skipped: 0\``
    );
  } else {
    PASSED.push(`${importRel}: no silent zero-success metrics`);
  }

  // MUST contain honest error copy
  if (!importSrc.includes("Import could not be completed")) {
    FAILED.push(
      `${importRel}: missing required honest-error copy "Import could not be completed"`
    );
  } else {
    PASSED.push(`${importRel}: honest error copy present`);
  }

  // MUST contain Retry Import + Back to Batches labels
  if (!importSrc.includes("Retry Import")) {
    FAILED.push(`${importRel}: missing "Retry Import" button label`);
  } else {
    PASSED.push(`${importRel}: Retry Import label present`);
  }
  if (!importSrc.includes("Back to Batches")) {
    FAILED.push(`${importRel}: missing "Back to Batches" button label`);
  } else {
    PASSED.push(`${importRel}: Back to Batches label present`);
  }
}

// 2. NgoImportTruthHealth.ts must exist with version constant
const healthRel = "src/runtime/launch/NgoImportTruthHealth.ts";
const healthSrc = readOrFail(healthRel);
if (healthSrc) {
  if (!/version/i.test(healthSrc)) {
    FAILED.push(`${healthRel}: missing version constant`);
  } else {
    PASSED.push(`${healthRel}: present with version constant`);
  }
}

if (FAILED.length > 0) {
  console.error("[check:no-fake-import-success] FAIL");
  for (const f of FAILED) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log(
  `[check:no-fake-import-success] PASS — ${PASSED.length} invariants verified (no fake batchId, no silent zero-success, honest error UI, health module present)`
);
