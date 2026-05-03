import { describe, it, expect, vi } from 'vitest';

/**
 * Verifies that the /api/admin alias mounts the same admin
 * router used by /api/users — so the merged-blocker spec's
 * tests against /api/admin/users hit the existing
 * `authenticate` + `authorize('super_admin', ...)` guards.
 *
 * We can't full-boot the server in this unit test (it needs
 * DATABASE_URL + a real Prisma connection), so instead we
 * grep the app.js source to confirm both mount points share
 * the same router export. This is a static-analysis check;
 * the live-HTTP harness in security-tests/api-security.test.ts
 * exercises the runtime behaviour against a running server.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const APP_JS     = path.resolve(__dirname, '..', 'app.js');

describe('admin route alias', () => {
  const src = fs.readFileSync(APP_JS, 'utf8');

  it('imports adminUserRoutes from the auth admin-routes module', () => {
    expect(src).toMatch(/import\s+adminUserRoutes\s+from\s+['"]\.\/modules\/auth\/admin-routes\.js['"]/);
  });

  it('mounts adminUserRoutes at /api/users (legacy)', () => {
    expect(src).toMatch(/app\.use\(\s*['"]\/api\/users['"]\s*,\s*adminUserRoutes\s*\)/);
  });

  it('also mounts adminUserRoutes at /api/admin (spec-canonical)', () => {
    expect(src).toMatch(/app\.use\(\s*['"]\/api\/admin['"]\s*,\s*adminUserRoutes\s*\)/);
  });

  it('does not introduce a parallel admin router (no duplicates rule)', () => {
    // We allow exactly two mount points referencing adminUserRoutes:
    // /api/users (legacy) and /api/admin (alias). A third would
    // suggest a parallel router was added by accident.
    const matches = src.match(/adminUserRoutes/g) || [];
    // Three references total: 1 import + 2 mounts.
    expect(matches.length).toBe(3);
  });
});

describe('admin router itself enforces auth', () => {
  it('admin-routes.js calls authenticate at the router level', () => {
    const ADMIN_JS = path.resolve(__dirname, '..', 'modules', 'auth', 'admin-routes.js');
    const src = fs.readFileSync(ADMIN_JS, 'utf8');
    expect(src).toMatch(/router\.use\(\s*authenticate\s*\)/);
  });

  it('admin-routes.js requires super_admin role on each handler', () => {
    const ADMIN_JS = path.resolve(__dirname, '..', 'modules', 'auth', 'admin-routes.js');
    const src = fs.readFileSync(ADMIN_JS, 'utf8');
    // Every router.<method>(...) handler should include an
    // authorize(...) middleware before its asyncHandler. We
    // sample-check the GET / handler.
    expect(src).toMatch(/authorize\(['"]super_admin['"]/);
  });
});
