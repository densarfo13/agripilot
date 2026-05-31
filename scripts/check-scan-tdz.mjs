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

// ─── Circular-import detection across the ScanPage import tree ──
// A barrel cycle (e.g. index.ts ⇄ briefingComposer.ts) perturbs
// Rollup's module-init order and can surface as
// "Cannot access 'o' before initialization" in the scan chunk. We
// trace static imports from ScanPage and fail on any MULTI-NODE
// cycle (single-node self-edges from type re-exports are ignored).
(function detectCycles() {
  const ENTRY = path.join(ROOT, 'src/pages/ScanPage.jsx');
  if (!fs.existsSync(ENTRY)) return;
  const EXTS = ['.js', '.jsx', '.ts', '.tsx'];
  const resolveSpec = (fromFile, spec) => {
    if (!spec.startsWith('.')) return null;
    const base = path.resolve(path.dirname(fromFile), spec);
    if (path.extname(base) && fs.existsSync(base)) return base;
    for (const e of EXTS) { if (fs.existsSync(base + e)) return base + e; }
    for (const e of EXTS) {
      const idx = path.join(base, 'index' + e);
      if (fs.existsSync(idx)) return idx;
    }
    return null;
  };
  const IMP = /(?:import|export)\s[^;'"]*?\sfrom\s*['"]([^'"]+)['"]/g;
  const BARE = /import\s*['"]([^'"]+)['"]/g;
  const deps = new Map();
  const parse = (file) => {
    if (deps.has(file)) return;
    let src; try { src = fs.readFileSync(file, 'utf8'); } catch { deps.set(file, new Set()); return; }
    const set = new Set();
    for (const re of [IMP, BARE]) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(src))) {
        const r = resolveSpec(file, m[1]);
        if (r && r !== file) set.add(r);   // ignore self-edges (type re-exports)
      }
    }
    deps.set(file, set);
    for (const d of set) parse(d);
  };
  parse(ENTRY);
  const color = new Map(), stack = [];
  const cyc = [];
  const dfs = (u) => {
    color.set(u, 1); stack.push(u);
    for (const v of (deps.get(u) || [])) {
      if (color.get(v) === 1) {
        const idx = stack.indexOf(v);
        if (idx >= 0 && stack.length - idx >= 2) cyc.push(stack.slice(idx).concat(v));
      } else if (!color.get(v)) dfs(v);
    }
    stack.pop(); color.set(u, 2);
  };
  dfs(ENTRY);
  const relp = (f) => path.relative(ROOT, f).replace(/\\/g, '/');
  const seen = new Set();
  for (const c of cyc) {
    const key = c.map(relp).sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    fail('circular import in ScanPage tree: ' + c.map(relp).join(' → '));
  }
  if (cyc.length === 0) {
    pass('no multi-node circular imports reachable from ScanPage (' + deps.size + ' modules)');
  }
})();

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:scan-tdz] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:scan-tdz] PASS — no later-declared hook deps + no circular imports in the scan tree.');
for (const p of PASSED) console.log('  ✓ ' + p);
