#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);

function readOrEmpty(f) {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}

function stripComments(src) {
  src = src.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  src = src.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return src;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const orgDir = path.join(ROOT, 'src/runtime/organization');

if (!fs.existsSync(orgDir)) {
  console.error('[check:ngo-organization-scope] FAIL');
  console.error('  ✗ src/runtime/organization/ directory missing');
  process.exit(1);
}

const FORBIDDEN_EXPORTS = ['allOrganizations', 'crossOrg', 'aggregateAcrossOrgs'];
const EXPORT_RE = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;

let scanned = 0;
for (const abs of walk(orgDir)) {
  scanned++;
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const raw = readOrEmpty(abs);
  const code = stripComments(raw);

  let m;
  EXPORT_RE.lastIndex = 0;
  while ((m = EXPORT_RE.exec(code)) !== null) {
    const name = m[1];

    if (FORBIDDEN_EXPORTS.includes(name)) {
      fail(`${rel}: forbidden cross-org helper export "${name}" — organization scope must be enforced`);
      continue;
    }

    if (/list|snapshot|aggregate/i.test(name)) {
      const after = code.slice(m.index, m.index + 400 + (m[0].length));
      if (!/organizationId/.test(after)) {
        fail(`${rel}: helper "${name}" must accept/reference organizationId within 400 chars of its declaration`);
      }
    }
  }
}

if (FAILED.length === 0) {
  pass(`${scanned} organization runtime files scoped by organizationId; no cross-org helpers`);
}

if (FAILED.length > 0) {
  console.error('[check:ngo-organization-scope] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`[check:ngo-organization-scope] PASS — organization runtime helpers scope all reads to organizationId`);
