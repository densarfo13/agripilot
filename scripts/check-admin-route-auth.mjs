/**
 * check-admin-route-auth.mjs — admin-route authorization gate.
 *
 * Every `/api/admin/*` route in server/src/app.js must enforce a ROLE check, not
 * just `authenticate`. `authenticate` only proves "a valid logged-in user" — a
 * farmer token passes it. Admin surfaces (certify, reliability, credits,
 * observability, CSV export, trace) must additionally require an admin/staff role.
 *
 * Accepts EITHER pattern within the handler's first lines:
 *   • `_requireAdmin(req, res)`            — the admin-only helper, or
 *   • an inline `req.user.role` allow-list — e.g. the trace route, which
 *     deliberately permits a wider staff set (ngo/field_officer).
 *
 * A new admin route with neither → build fails. Static, read-only, no false
 * positives on module routes (those use the `authorize()` middleware elsewhere).
 */
import fs from 'node:fs';
import path from 'node:path';

const APP = path.join(process.cwd(), 'server/src/app.js');
const src = fs.readFileSync(APP, 'utf8');
const lines = src.split(/\r?\n/);
const ROUTE = /app\.(get|post|put|patch|delete)\(\s*['"`](\/api\/admin\/[^'"`]*)['"`]/;
const WINDOW = 10;   // lines after the route line to look for the role gate

const unprotected = [];
let total = 0;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(ROUTE);
  if (!m) continue;
  total++;
  const block = lines.slice(i, Math.min(i + WINDOW, lines.length)).join('\n');
  const hasRoleGate = /_requireAdmin\s*\(\s*req\s*,\s*res\s*\)/.test(block) || /req\.user\.role/.test(block);
  if (!hasRoleGate) unprotected.push((i + 1) + '  ' + m[2]);
}

if (total === 0) {
  console.error('[check:admin-route-auth] FAIL — found no /api/admin routes in app.js (pattern drift?)');
  process.exit(1);
}
if (unprotected.length) {
  console.error('[check:admin-route-auth] FAIL — ' + unprotected.length + ' /api/admin route(s) have authenticate but NO role check:');
  for (const u of unprotected) console.error('  - ' + u);
  console.error('  Fix: add `if (!_requireAdmin(req, res)) return;` (or an inline req.user.role allow-list) to each handler.');
  process.exit(1);
}
console.log('[check:admin-route-auth] PASS — all ' + total + ' /api/admin routes enforce a role check (admin helper or inline allow-list), not just authenticate.');
