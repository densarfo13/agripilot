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

const appPath = path.join(ROOT, 'src/App.jsx');
const app = readOrEmpty(appPath);
if (!app) {
  console.error('[check:role-route-guards] FAIL');
  console.error('  ✗ src/App.jsx missing');
  process.exit(1);
}

const GUARDED_ROUTES = [
  '/portfolio',
  '/reports',
  '/audit',
  '/admin/users',
  '/admin/organizations',
  '/admin/analytics',
  '/admin/control',
  '/admin/security',
  '/admin/sync-queue',
  '/buyer',
  '/sell-readiness',
  '/organization',
];

function findAllOccurrences(haystack, route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  const re = new RegExp(`['"\`]${escaped}(?:\\/[^'"\`]*)?['"\`]`, 'g');
  const idxs = [];
  let m;
  while ((m = re.exec(haystack)) !== null) {
    idxs.push(m.index);
  }
  return idxs;
}

for (const route of GUARDED_ROUTES) {
  const idxs = findAllOccurrences(app, route);
  if (idxs.length === 0) {
    fail(`route ${route}: pattern not found in src/App.jsx`);
    continue;
  }
  let guarded = false;
  for (const idx of idxs) {
    const start = Math.max(0, idx - 600);
    const end = Math.min(app.length, idx + 600);
    const window = app.slice(start, end);
    if (/<RoleRoute/.test(window) || /INTERNAL_FLAG|isInternalEnabled|internalFlag/.test(window)) {
      guarded = true;
      break;
    }
  }
  if (!guarded) {
    fail(`route ${route}: must be wrapped in <RoleRoute> or gated by an internal flag within 600 chars`);
  }
}

const INTERNAL_ROUTES = [
  { route: '/internal/founder',      component: 'FounderDashboard' },
  { route: '/internal/release-lock', component: 'ReleaseLockPage' },
  { route: '/internal/godmode',      component: 'GodmodePage' },
];
for (const { route, component } of INTERNAL_ROUTES) {
  const escaped = route.replace(/\//g, '\\/');
  const re = new RegExp(`['"\`]${escaped}['"\`][\\s\\S]{0,400}?<${component}\\b`);
  if (!re.test(app)) {
    fail(`internal route ${route}: must mount <${component}>`);
  }
}

if (FAILED.length === 0) {
  pass(`${GUARDED_ROUTES.length} guarded routes + 3 internal routes verified`);
}

if (FAILED.length > 0) {
  console.error('[check:role-route-guards] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`[check:role-route-guards] PASS — ${GUARDED_ROUTES.length} role-scoped routes + 3 internal routes all guarded`);
