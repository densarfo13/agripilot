#!/usr/bin/env node
/**
 * scripts/check-scan-tdz.mjs — Temporal Dead Zone gate for the scan tree.
 *
 * Production crash this guards against:
 *   ReferenceError: Cannot access 'o' before initialization  (ScanPage-*.js)
 *
 * Cause: a hook dependency array — useEffect / useMemo / useCallback
 * `}, [a, b])` — is evaluated EAGERLY during render. If it names a
 * component-scope `const`/`let` that is declared LATER in the same
 * function, that binding is in its Temporal Dead Zone when the deps
 * array is constructed → ReferenceError (minified to a 1-letter name).
 * The dev server sometimes masks it (unminified, different eval order),
 * but the minified production bundle throws on every render.
 *
 * This gate scans the scan render tree, builds a map of
 * const/let declarations → first declaration line, then checks every
 * single-line hook dependency array: if a dep identifier is declared
 * on a LATER line than the deps array, the build fails.
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);

// Files in the scan render tree (the crash surface + its children).
const TARGETS = ['src/pages/ScanPage.jsx'];
try {
  const scanDir = path.join(ROOT, 'src/components/scan');
  for (const f of fs.readdirSync(scanDir)) {
    if (f.endsWith('.jsx') || f.endsWith('.tsx')) {
      TARGETS.push('src/components/scan/' + f);
    }
  }
} catch { /* dir optional */ }

const DECL_RE   = /^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/;
// const [a, setA] = useState(...) → capture `a` (and the setter too).
const DESTR_ARR = /^\s*const\s+\[\s*([A-Za-z_$][\w$]*)\s*(?:,\s*([A-Za-z_$][\w$]*)\s*)?\]/;
// Single-line hook deps-array close: `}, [a, b, c]);`
const DEPS_RE   = /\}\s*,\s*\[([^\]]*)\]\s*\)\s*;?/;
const IDENT_RE  = /^[A-Za-z_$][\w$]*$/;

for (const rel of TARGETS) {
  let src;
  try { src = fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch { continue; }
  const lines = src.split(/\r?\n/);

  // 1. Earliest-binding line for every name. We record const/let
  // declarations AND function parameters, keeping the SMALLEST line
  // per name (a name is "available" from its earliest binding). This
  // is what makes the check scope-tolerant enough to avoid false
  // positives: e.g. ScanHub's `_useDevDiagnostics(devMode)` takes
  // `devMode` as a PARAMETER, so its `}, [devMode])` is NOT a TDZ
  // even though the ScanHub component also declares a later
  // `const devMode`. A real component-scope forward reference (the
  // ScanPage `profile`/`activeFarmId` bug) has NO earlier binding,
  // so it is still caught.
  const declLine = Object.create(null);
  const _record = (name, ln) => {
    if (!name) return;
    if (!(name in declLine) || ln < declLine[name]) declLine[name] = ln;
  };
  // Function/arrow parameter headers — capture identifiers in the
  // parameter list and bind them at the header line.
  const FN_HDR = /(?:function\s+[A-Za-z_$][\w$]*\s*\(([^)]*)\))|(?:=\s*(?:async\s*)?\(([^)]*)\)\s*=>)/;
  lines.forEach((line, i) => {
    const ln = i + 1;
    const d = DECL_RE.exec(line);
    if (d) _record(d[1], ln);
    const da = DESTR_ARR.exec(line);
    if (da) { _record(da[1], ln); _record(da[2], ln); }
    const fh = FN_HDR.exec(line);
    if (fh) {
      const params = (fh[1] || fh[2] || '');
      const ids = params.match(/[A-Za-z_$][\w$]*/g) || [];
      for (const id of ids) _record(id, ln);
    }
  });

  // 2. Every single-line deps array → check each identifier.
  let fileViolations = 0;
  lines.forEach((line, i) => {
    const depsLn = i + 1;
    const m = DEPS_RE.exec(line);
    if (!m) return;
    const ids = m[1].split(',').map((s) => s.trim()).filter((s) => IDENT_RE.test(s));
    for (const id of ids) {
      const dl = declLine[id];
      if (dl && dl > depsLn) {
        fileViolations += 1;
        fail(`${rel}:${depsLn} — dependency "${id}" is referenced before its `
          + `declaration (declared at line ${dl}) → Temporal Dead Zone crash `
          + `("Cannot access '${id}' before initialization" in the minified bundle). `
          + `Move the declaration ABOVE this hook.`);
      }
    }
  });
  if (fileViolations === 0) pass(`${rel}: no TDZ violations in hook dependency arrays`);
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:scan-tdz] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:scan-tdz] PASS — no hook deps array references a later-declared binding.');
for (const p of PASSED) console.log('  ✓ ' + p);
