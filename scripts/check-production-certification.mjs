#!/usr/bin/env node
/**
 * scripts/check-production-certification.mjs — Farroway Production
 * Certification v1 CI gate.
 *
 * Hard blockers (exit 1):
 *   A. src/runtime/certification/ exists with 4 files and each
 *      carries a VERSION constant.
 *   B. src/pages/internal/ProductionCertificationPage.jsx exists,
 *      checks INTERNAL_FLAG_KEY, and renders the canonical
 *      data-testid="production-certification-page".
 *   C. src/App.jsx mounts /internal/production-certification with
 *      the canonical page component.
 *   D. src/App.jsx wires installProductionCertificationGlobal() in
 *      the boot install chain.
 *   E. CERTIFICATION_TARGETS constants present and match the spec
 *      (plants: 200, diseases: 15, pests: 15, scanSuccessRate: 0.9,
 *      brokenImages: 0).
 *   F. ProductionCertificationRuntime returns the spec envelope
 *      shape — must contain "qa", "content", "privacy",
 *      "operations" keys.
 *   G. Verdict cannot be hard-coded GREEN. Any literal
 *      `verdict: "GREEN"` / `verdict = "GREEN"` outside of a
 *      comparator or fallback path is a blocker — the runtime
 *      MUST surface an honest computed verdict.
 *
 * Soft warnings (do NOT exit 1):
 *   • Knowledge content below target (plants < 200, diseases < 15,
 *     pests < 15).
 *   • Media targets not met.
 *   • Manual QA pending.
 *
 * Strict-rule audit
 *   • Read-only against src tree.
 *   • Returns exit 1 ONLY on hard blockers above.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const WARNINGS = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);
const warn = (m) => WARNINGS.push(m);

const read = (f) => {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
};

// Standard helper — strip JS / JSX / line comments before doing
// any pattern match so a "// no GREEN verdict here" doc comment
// can never trigger a false positive on hard blocker G.
const stripComments = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')   // /* … */ block comments
    .replace(/\/\/[^\n]*/g, '')          // // line comments
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ''); // {/* … */} JSX comments

// ─── A. Runtime files present + VERSION constants ──────────────
const CERT_DIR = 'src/runtime/certification';
const REQUIRED_RUNTIME_FILES = [
  'productionCertificationContracts.ts',
  'MediaURLValidator.ts',
  'ProductionCertificationRuntime.ts',
  'index.ts',
];

for (const filename of REQUIRED_RUNTIME_FILES) {
  const full = path.join(ROOT, CERT_DIR, filename);
  const src  = read(full);
  if (!src) {
    fail(`runtime-files: missing ${CERT_DIR}/${filename}`);
    continue;
  }
  // Each spec file must export some VERSION constant. We accept
  // any export of the form `export const <SOMETHING>_VERSION = …`.
  const stripped = stripComments(src);
  if (!/export\s+const\s+[A-Z][A-Z0-9_]*VERSION\s*=/.test(stripped)) {
    fail(`runtime-files: ${CERT_DIR}/${filename} missing VERSION constant`);
  } else {
    pass(`runtime-files: ${CERT_DIR}/${filename} present with VERSION`);
  }
}

// ─── B. Internal page exists + flag gate + testid ──────────────
const PAGE_PATH = 'src/pages/internal/ProductionCertificationPage.jsx';
const pageSrc = read(path.join(ROOT, PAGE_PATH));
if (!pageSrc) {
  fail(`page: ${PAGE_PATH} missing`);
} else {
  const strippedPage = stripComments(pageSrc);
  if (!/INTERNAL_FLAG_KEY/.test(strippedPage)) {
    fail(`page: ${PAGE_PATH} must import + check INTERNAL_FLAG_KEY`);
  }
  if (!/data-testid\s*=\s*["']production-certification-page["']/
        .test(strippedPage)) {
    fail(`page: ${PAGE_PATH} must render `
          + `data-testid="production-certification-page"`);
  }
  if (FAILED.every((m) => !m.startsWith('page:'))) {
    pass(`page: ${PAGE_PATH} gated by INTERNAL_FLAG_KEY + testid wired`);
  }
}

// ─── C + D. App.jsx route + boot install ───────────────────────
const appJsx = read(path.join(ROOT, 'src/App.jsx'));
const appStripped = stripComments(appJsx);

if (!appJsx) {
  fail(`route: src/App.jsx not readable`);
} else {
  // C — route mounted with the canonical component name. We
  // accept both <ProductionCertificationPage /> and equivalent
  // lazy/import-bound bindings, but the route path must be exact.
  const routePat =
    /['"]\/internal\/production-certification['"][\s\S]{0,300}?ProductionCertificationPage/;
  if (!routePat.test(appStripped)) {
    fail(`route: /internal/production-certification not mounted with `
          + `ProductionCertificationPage in App.jsx`);
  } else {
    pass(`route: /internal/production-certification mounted in App.jsx`);
  }

  // D — boot install hook wired.
  if (!/installProductionCertificationGlobal/.test(appStripped)) {
    fail(`boot: App.jsx must call installProductionCertificationGlobal()`);
  } else {
    pass(`boot: installProductionCertificationGlobal() wired in App.jsx`);
  }
}

// ─── E. CERTIFICATION_TARGETS values match the spec ────────────
const contractsSrc = read(path.join(ROOT, CERT_DIR,
  'productionCertificationContracts.ts'));
const contractsStripped = stripComments(contractsSrc);

const SPEC_TARGETS = [
  { key: 'plants',          value: '200'  },
  { key: 'diseases',        value: '15'   },
  { key: 'pests',           value: '15'   },
  { key: 'scanSuccessRate', value: '0.9'  },
  { key: 'brokenImages',    value: '0'    },
];

if (!/CERTIFICATION_TARGETS/.test(contractsStripped)) {
  fail(`targets: CERTIFICATION_TARGETS constant missing in contracts`);
} else {
  for (const { key, value } of SPEC_TARGETS) {
    // Match `key: <value>` inside the CERTIFICATION_TARGETS literal.
    const pat = new RegExp(
      `${key}\\s*:\\s*${value.replace('.', '\\.')}\\b`,
    );
    if (!pat.test(contractsStripped)) {
      fail(`targets: CERTIFICATION_TARGETS.${key} `
            + `must equal ${value} per spec`);
    }
  }
  if (FAILED.every((m) => !m.startsWith('targets:'))) {
    pass(`targets: CERTIFICATION_TARGETS values match spec `
          + `(plants 200 · diseases 15 · pests 15 · scan 0.9 · broken 0)`);
  }
}

// ─── F. Runtime envelope shape ─────────────────────────────────
const runtimeSrc = read(path.join(ROOT, CERT_DIR,
  'ProductionCertificationRuntime.ts'));
const runtimeStripped = stripComments(runtimeSrc);

if (!runtimeSrc) {
  // Already flagged in section A — skip envelope check to avoid
  // double-reporting.
} else {
  const REQUIRED_ENVELOPE_KEYS = ['qa', 'content', 'privacy', 'operations'];
  const missing = [];
  for (const key of REQUIRED_ENVELOPE_KEYS) {
    // Accept `qa:`, `"qa":`, or `'qa':` as a key in any returned
    // object literal within the runtime.
    const pat = new RegExp(`(^|[\\s{,])${key}\\s*:`, 'm');
    if (!pat.test(runtimeStripped)) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    fail(`envelope: ProductionCertificationRuntime missing keys: `
          + missing.join(', '));
  } else {
    pass(`envelope: runtime returns qa / content / privacy / operations`);
  }
}

// ─── G. Verdict must not be hard-coded GREEN ───────────────────
// Scan the runtime for any literal that hard-codes a GREEN
// verdict. Allow string occurrences inside comparators
// (verdict === "GREEN", verdict !== "GREEN") and inside fallback
// arrays / sets — those are valid honest computations.
//
// Disallowed shapes:
//   verdict: "GREEN"
//   verdict = "GREEN"
//   verdict :=  "GREEN"
// These are caught only when GREEN is the RHS literal of an
// assignment-like operator, NOT a comparator.
if (runtimeSrc) {
  // Match the literal `verdict <op> "GREEN"` where <op> is one of
  // `:` (object literal) or `=` (assignment) but NOT `==`, `===`,
  // `!=`, `!==`. Negative lookbehind keeps it honest.
  const offending = [];
  const RE = /verdict\s*([:=])\s*["']GREEN["']/g;
  let m;
  while ((m = RE.exec(runtimeStripped)) !== null) {
    const op = m[1];
    const idx = m.index;
    // Look back for `==`, `===`, `!=`, `!==` — those are
    // comparators, not assignments.
    const ctx = runtimeStripped.slice(Math.max(0, idx - 4),
                                       idx + m[0].length);
    if (op === '=' && /[=!]=/.test(ctx)) continue;
    offending.push(m[0]);
  }
  if (offending.length > 0) {
    fail(`honest-verdict: hard-coded GREEN verdict detected — `
          + offending.join(', '));
  } else {
    pass(`honest-verdict: no hard-coded GREEN verdict in runtime`);
  }
}

// ─── Soft warnings — knowledge content below target ────────────
let knowledgeReport = {};
try {
  const diseasesJson = read(path.join(ROOT,
    'src/data/diseases/diseases.json'));
  const pestsJson = read(path.join(ROOT,
    'src/data/pests/pests.json'));
  let diseases = [];
  let pests = [];
  try { diseases = JSON.parse(diseasesJson || '[]'); }
  catch { diseases = []; }
  try { pests = JSON.parse(pestsJson || '[]'); }
  catch { pests = []; }

  const plantKnowSrc = read(path.join(ROOT,
    'src/data/plants/knowledge.js'));
  const plantEntries = (plantKnowSrc.match(/careGuide\s*:\s*\{/g) || [])
                         .length;

  knowledgeReport = {
    plants:   plantEntries,
    diseases: Array.isArray(diseases) ? diseases.length : 0,
    pests:    Array.isArray(pests) ? pests.length : 0,
  };

  if (knowledgeReport.plants < 200) {
    warn(`knowledge: plants ${knowledgeReport.plants} / 200 `
          + `(warning, not blocker)`);
  }
  if (knowledgeReport.diseases < 15) {
    warn(`knowledge: diseases ${knowledgeReport.diseases} / 15 `
          + `(warning, not blocker)`);
  }
  if (knowledgeReport.pests < 15) {
    warn(`knowledge: pests ${knowledgeReport.pests} / 15 `
          + `(warning, not blocker)`);
  }
} catch (e) {
  warn(`knowledge: could not enumerate (${e.message})`);
}

// ─── Soft warning — media targets not met ──────────────────────
// We do not fail CI on this; the runtime probe surfaces it as a
// YELLOW. Here we only check that a media library exists so QA
// knows whether the target check is even possible.
const flowerLib = read(path.join(ROOT,
  'src/runtime/plants/media/libraries/flowerLibrary.ts'));
if (!flowerLib) {
  warn(`media: flowerLibrary missing — media targets cannot be probed`);
}

// ─── Soft warning — manual QA pending ──────────────────────────
// Static scan: if the manual QA storage key doesn't exist anywhere
// in the runtime, surface a warning (manual QA can't be marked).
const manualKeyPresent =
  /farroway_qa_manual_checks|farroway_release_lock_manual/
    .test(contractsStripped + runtimeStripped);
if (!manualKeyPresent) {
  warn(`manual-qa: no manual QA storage key referenced — `
        + `manual sweep may be pending`);
}

// ─── Final result ──────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:production-certification] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  if (WARNINGS.length > 0) {
    console.error('\nWarnings (non-blocking):');
    for (const w of WARNINGS) console.error('  ! ' + w);
  }
  console.error(
    `\n${PASSED.length} passed · ${FAILED.length} blockers · `
      + `${WARNINGS.length} warnings.`,
  );
  process.exit(1);
}

const summary = `${PASSED.length} checks passed · 0 blockers · `
                  + `${WARNINGS.length} warnings`
                  + (knowledgeReport.plants != null
                      ? ` · knowledge ${knowledgeReport.plants}p/`
                          + `${knowledgeReport.diseases}d/`
                          + `${knowledgeReport.pests}pe`
                      : '');
console.log('[check:production-certification] PASS — ' + summary);

if (WARNINGS.length > 0) {
  console.log('  Warnings (non-blocking):');
  for (const w of WARNINGS) console.log('    ! ' + w);
}
