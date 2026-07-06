/**
 * check-prisma-fields.mjs — build-time guard against Prisma schema-drift crashes.
 * (Jarvis Compiler Layer v2 — 2026-07-05)
 *
 * Root cause it prevents: analytics-summary filtered `prisma.officerValidation.count({ where:
 * { status: 'approved' } })`, but OfficerValidation has no `status` field →
 * PrismaClientValidationError → 500 → admin dashboard crash.
 *
 * It parses the REAL field/relation/compound-key names from schema.prisma (the source of truth —
 * never a hand-maintained list) and fails the build if a STATICALLY-VISIBLE query object
 * (where/select/orderBy/data) uses a top-level key the model does not have.
 *
 * Conservative by design — favours zero false positives over completeness:
 *   • only calls whose argument is an inline `{ … }` object literal are inspected
 *     (a `prisma.x.count()` with no object, or `op(buildArgs())`, is skipped);
 *   • a clause containing a spread (`...x`) is skipped (its keys aren't statically known);
 *   • computed keys (`{ [k]: v }`) are skipped;
 *   • only explicit `key: value` filters are checked — bare shorthand (`where: { farmerId }`)
 *     is out of scope, since a value identifier after `:` is statically indistinguishable
 *     from a shorthand key, and drift there is rare (the shorthand name IS the field name).
 *     The production crash class this gate targets is the `key: value` form (`status: 'x'`);
 *   • only TOP-LEVEL keys are checked (nested relation filters are the relation's concern).
 *
 * Modes:
 *   node scripts/check-prisma-fields.mjs           → validate code + verify generated map in sync
 *   node scripts/check-prisma-fields.mjs --write   → (re)generate src/generated/prismaModelFields.json
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SCHEMA = 'server/prisma/schema.prisma';
const MAP_FILE = 'src/generated/prismaModelFields.json';
const SCAN_DIRS = ['server/routes', 'server/src', 'src'];
const OPS = ['findMany', 'findFirst', 'findUnique', 'findUniqueOrThrow', 'findFirstOrThrow',
  'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'create', 'createMany',
  'upsert', 'delete', 'deleteMany'];
// Scoped to `where` deliberately. The production crash class is where-filter field drift, and
// where keys are strictly fields/relations/AND/OR/NOT — statically checkable with ~zero false
// positives. select/data/orderBy have relation-selects, _count, nested creates and aggregate
// helpers whose key-space makes static validation noisy; those are a type-level (Prisma-generated
// types) concern, documented as a remaining risk, not guessed at here.
const CLAUSES = ['where'];
// Prisma structural keys that are valid alongside real fields in these clauses.
const STRUCTURAL = new Set(['AND', 'OR', 'NOT', '_count', '_sum', '_avg', '_min', '_max', '_relevance']);

// ── Parse schema.prisma (line-based → robust) ───────────────────────────────
export function parseSchema(schemaPath = SCHEMA) {
  const lines = readFileSync(schemaPath, 'utf8').split('\n');
  const models = {};
  let cur = null, members = null;
  for (let raw of lines) {
    const line = raw.trim();
    const open = line.match(/^model\s+(\w+)\s*\{/);
    if (open) { cur = open[1]; members = new Set(); continue; }
    if (cur && line === '}') { models[cur] = members; cur = null; members = null; continue; }
    if (!cur) continue;
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('@@')) {
      // compound unique / id accessors: @@unique([a, b], name: "x") → "x" else "a_b"
      const comp = line.match(/^@@(unique|id)\(\s*\[([^\]]+)\]([^)]*)\)/);
      if (comp) {
        const fields = comp[2].split(',').map((s) => s.trim());
        const nameM = comp[3].match(/name:\s*"([^"]+)"/);
        members.add(nameM ? nameM[1] : fields.join('_'));
      }
      continue;
    }
    // a field/relation line: `<name> <Type> ...`
    const f = line.match(/^(\w+)\s+\S/);
    if (f) members.add(f[1]);
  }
  return models;
}

export function buildMap(models) {
  const out = {};
  for (const m of Object.keys(models).sort()) out[m] = [...models[m]].sort();
  return out;
}

// ── Brace/bracket matcher ───────────────────────────────────────────────────
function matchDelim(s, open) {
  const close = s[open] === '{' ? '}' : ']';
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === s[open]) depth++;
    else if (s[i] === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// Top-level keys of an object-literal body; flags spread presence.
// String/template-literal *contents* are skipped so a value like
// `title: `Storage alert: ${x}`` never leaks the word `alert` as a phantom key
// (the ':' inside a value string would otherwise look like a key delimiter).
export function topKeys(body) {
  const keys = [];
  let hasSpread = false, depth = 0, str = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    // ── inside a string/template: consume until the matching quote ──
    if (str) {
      if (c === '\\') { i++; continue; }         // skip escaped char
      if (c === str) str = null;                 // close the string
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { str = c; continue; }
    if (c === '{' || c === '[' || c === '(') { depth++; continue; }
    if (c === '}' || c === ']' || c === ')') { depth--; continue; }
    if (depth !== 0) continue;
    if (c === '.' && body.slice(i, i + 3) === '...') { hasSpread = true; continue; }
    if (/[A-Za-z_$'"]/.test(c) && (i === 0 || /[\s,{]/.test(body[i - 1]))) {
      const mk = body.slice(i).match(/^(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:/);
      if (mk) { keys.push(mk[1] || mk[2] || mk[3]); }
    }
  }
  return { keys, hasSpread };
}

// ── Scan source files ───────────────────────────────────────────────────────
function jsFiles(dir) {
  const out = [];
  let entries; try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (['node_modules', '__tests__', 'dist', 'generated'].includes(e)) continue;
      out.push(...jsFiles(p));
    } else if ((e.endsWith('.js') || e.endsWith('.mjs') || e.endsWith('.jsx') || e.endsWith('.ts')) && !/\.test\.[jt]sx?$/.test(e)) {
      out.push(p);
    }
  }
  return out;
}

function accessorOf(model) { return model.charAt(0).toLowerCase() + model.slice(1); }

function suggest(members, bad) {
  const b = bad.toLowerCase();
  const hints = [...members].filter((m) => {
    const l = m.toLowerCase();
    return l.includes(b) || b.includes(l) || (b === 'status' && (l.endsWith('status') || l.endsWith('at')));
  });
  return hints.length ? ' — did you mean: ' + hints.slice(0, 4).join(', ') + '?' : '';
}

export function validate() {
  const models = parseSchema();
  const byAccessor = {};
  for (const m of Object.keys(models)) byAccessor[accessorOf(m)] = { model: m, members: models[m] };
  const callRe = new RegExp('prisma\\.(\\w+)\\.(' + OPS.join('|') + ')\\s*\\(', 'g');
  const violations = [];

  for (const file of SCAN_DIRS.flatMap(jsFiles)) {
    const src = readFileSync(file, 'utf8');
    let m; callRe.lastIndex = 0;
    while ((m = callRe.exec(src)) !== null) {
      const known = byAccessor[m[1]];
      if (!known) continue;
      // Argument must be an inline object literal: first non-space after '(' is '{'.
      let j = m.index + m[0].length;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] !== '{') continue; // dynamic / no static args → skip
      const argClose = matchDelim(src, j);
      if (argClose === -1) continue;
      const args = src.slice(j, argClose + 1);
      for (const clause of CLAUSES) {
        const cm = args.match(new RegExp('\\b' + clause + '\\s*:\\s*[\\{\\[]'));
        if (!cm) continue;
        let oi = j + args.indexOf(cm[0]) + cm[0].length - 1; // index of the '{' or '['
        if (src[oi] === '[') { const nb = src.indexOf('{', oi); if (nb === -1 || nb > matchDelim(src, oi)) continue; oi = nb; }
        const oc = matchDelim(src, oi);
        if (oc === -1) continue;
        const { keys, hasSpread } = topKeys(src.slice(oi + 1, oc));
        if (hasSpread) continue;
        for (const k of keys) {
          if (STRUCTURAL.has(k) || known.members.has(k)) continue;
          const line = src.slice(0, oi).split('\n').length;
          violations.push({ file, line, model: known.model, clause, key: k,
            hint: suggest(known.members, k) });
        }
      }
    }
  }
  return { models, violations };
}

// ── Main (only when run as a CLI — importing this module is side-effect-free) ─
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const write = process.argv.includes('--write');
  const { models, violations } = validate();
  const freshMap = buildMap(models);

  if (write) {
    writeFileSync(MAP_FILE, JSON.stringify(freshMap, null, 2) + '\n');
    console.log('[check:prisma-fields] wrote ' + MAP_FILE + ' (' + Object.keys(freshMap).length + ' models).');
    process.exit(0);
  }

  // Verify the committed generated map is in sync with the schema.
  let mapOk = true;
  if (!existsSync(MAP_FILE)) { mapOk = false; console.error('[check:prisma-fields] FAIL — missing ' + MAP_FILE + ' (run --write)'); }
  else if (readFileSync(MAP_FILE, 'utf8').trim() !== (JSON.stringify(freshMap, null, 2)).trim()) {
    mapOk = false;
    console.error('[check:prisma-fields] FAIL — ' + MAP_FILE + ' is out of sync with schema.prisma (run: node scripts/check-prisma-fields.mjs --write)');
  }

  if (violations.length) {
    console.error('[check:prisma-fields] FAIL — ' + violations.length + ' query key(s) reference a field the model does not have (schema drift → PrismaClientValidationError at runtime):');
    for (const v of violations.slice(0, 50)) {
      console.error('  ✗ ' + v.file + ':' + v.line + '  ' + v.model + '.' + v.clause + '.' + v.key + v.hint);
    }
  }

  if (violations.length || !mapOk) process.exit(1);
  console.log('[check:prisma-fields] PASS — ' + Object.keys(models).length + ' models; every static top-level `where` key resolves to a real field/relation/compound-unique accessor (spreads + dynamic args skipped).');
}
