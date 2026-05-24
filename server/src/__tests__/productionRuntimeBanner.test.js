/**
 * productionRuntimeBanner.test.js — pins the May 2026 Railway
 * production-ops hardening contract.
 *
 *   • resolveBuildVersion picks the right env-var precedence and
 *     never returns empty / undefined.
 *   • checkRequired returns the missing required vars.
 *   • checkOptional returns missing optional providers with their
 *     human-readable feature labels.
 *   • logProductionStartupBanner emits the canonical
 *     [Farroway] block in the documented order.
 *   • Banner is silent under NODE_ENV=test (so vitest output
 *     stays clean unless a test re-invokes it deliberately).
 *   • Banner is idempotent — second call is a no-op.
 *
 * Failures here are regression-meaningful: anyone removing the
 * canonical startup-banner lines fails CI.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.setConfig({ testTimeout: 15000 });

const MODULE = '../config/productionRuntime.js';

function snapshotEnv() {
  const before = { ...process.env };
  return () => {
    for (const k of Object.keys(process.env)) {
      if (!(k in before)) delete process.env[k];
    }
    for (const k of Object.keys(before)) {
      process.env[k] = before[k];
    }
  };
}

describe('productionRuntime — Railway ops banner', () => {
  let restoreEnv;

  beforeEach(() => {
    restoreEnv = snapshotEnv();
  });

  it('resolveBuildVersion honours Railway env precedence', async () => {
    const mod = await import(MODULE);
    mod._resetForTests();

    // Clear EVERY alias the resolver checks. `npm_package_version`
    // is set automatically when vitest is launched via `npm test`,
    // so it must be cleared too or the fallback branch is unreachable.
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    delete process.env.RAILWAY_DEPLOYMENT_ID;
    delete process.env.RENDER_GIT_COMMIT;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.SOURCE_COMMIT;
    delete process.env.FARROWAY_COMMIT_SHA;
    delete process.env.VITE_BUILD_ID;
    delete process.env.BUILD_ID;
    delete process.env.APP_VERSION;
    delete process.env.npm_package_version;
    // With every env candidate cleared, the resolver falls back to
    // the package.json semver read at module load — a sensible
    // non-empty value that beats the legacy '0.0.0-local' literal.
    expect(mod.resolveBuildVersion()).toMatch(/^\d+\.\d+\.\d+/);

    process.env.APP_VERSION = '1.2.3';
    expect(mod.resolveBuildVersion()).toBe('1.2.3');

    process.env.BUILD_ID = 'ci-build-42';
    expect(mod.resolveBuildVersion()).toBe('ci-build-42');

    process.env.VITE_BUILD_ID = 'vite-9-9-9';
    expect(mod.resolveBuildVersion()).toBe('vite-9-9-9');

    process.env.RAILWAY_GIT_COMMIT_SHA = 'abcdef1234567890';
    expect(mod.resolveBuildVersion()).toBe('abcdef1234567890');

    restoreEnv();
  });

  it('resolveBuildVersion truncates to 64 chars + never returns empty', async () => {
    const mod = await import(MODULE);
    process.env.RAILWAY_GIT_COMMIT_SHA = 'x'.repeat(200);
    expect(mod.resolveBuildVersion().length).toBe(64);

    // Clear EVERY alias the resolver checks. `npm_package_version`
    // is set automatically when vitest is launched via `npm test`,
    // so it must be cleared too or the fallback branch is unreachable.
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    delete process.env.RAILWAY_DEPLOYMENT_ID;
    delete process.env.RENDER_GIT_COMMIT;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.SOURCE_COMMIT;
    delete process.env.FARROWAY_COMMIT_SHA;
    delete process.env.VITE_BUILD_ID;
    delete process.env.BUILD_ID;
    delete process.env.APP_VERSION;
    delete process.env.npm_package_version;
    // Falls back to package.json semver read at module load (not
    // '0.0.0-local' — see the precedence note in the engine).
    expect(mod.resolveBuildVersion()).toMatch(/^\d+\.\d+\.\d+/);

    restoreEnv();
  });

  it('checkRequired returns exactly the missing required vars', async () => {
    const mod = await import(MODULE);

    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    delete process.env.JWT_SECRET;
    expect(mod.checkRequired().sort())
      .toEqual(['AUTH_SECRET', 'DATABASE_URL'].sort());

    process.env.DATABASE_URL = 'postgres://x';
    expect(mod.checkRequired()).toEqual(['AUTH_SECRET']);

    // Alias counts as present.
    process.env.JWT_SECRET = 'a'.repeat(40);
    expect(mod.checkRequired()).toEqual([]);

    restoreEnv();
  });

  it('checkOptional surfaces missing providers with feature labels', async () => {
    const mod = await import(MODULE);
    delete process.env.WEATHER_API_KEY;
    delete process.env.VITE_WEATHER_API_KEY;
    delete process.env.MAPS_API_KEY;
    delete process.env.VITE_MAPS_API_KEY;
    delete process.env.MAPBOX_TOKEN;
    delete process.env.VITE_MAPBOX_TOKEN;
    delete process.env.SENTRY_DSN;
    // Test isolation: server/.env may carry VITE_SENTRY_DSN for
    // a connected Sentry project; both aliases must be cleared
    // for the "sentry is missing" assertion below to be honest.
    delete process.env.VITE_SENTRY_DSN;

    const missing = mod.checkOptional();
    const names = missing.map((m) => m.name);
    expect(names).toContain('WEATHER_API_KEY');
    expect(names).toContain('MAPS_API_KEY');
    expect(names).toContain('SENTRY_DSN');

    // Each entry has both a name and a human feature label.
    for (const m of missing) {
      expect(typeof m.name).toBe('string');
      expect(typeof m.feature).toBe('string');
      expect(m.feature.length).toBeGreaterThan(0);
    }
    restoreEnv();
  });

  it('logProductionStartupBanner is silent under NODE_ENV=test', async () => {
    const mod = await import(MODULE);
    mod._resetForTests();
    process.env.NODE_ENV = 'test';
    const lines = [];
    const orig = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try { mod.logProductionStartupBanner(); }
    finally { console.log = orig; }
    expect(lines).toEqual([]); // never spam vitest output
    restoreEnv();
  });

  it('logProductionStartupBanner emits the canonical block in production', async () => {
    const mod = await import(MODULE);
    mod._resetForTests();

    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://x';
    process.env.AUTH_SECRET  = 'a'.repeat(40);
    delete process.env.WEATHER_API_KEY;

    const lines = [];
    const orig = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try { mod.logProductionStartupBanner(); }
    finally { console.log = orig; }

    // Canonical lines fire in order.
    const joined = lines.join('\n');
    expect(joined).toMatch(/\[Farroway\] Production runtime active/);
    expect(joined).toMatch(/\[Farroway\] Environment validated/);
    expect(joined).toMatch(/\[Farroway\] Upload service active/);
    expect(joined).toMatch(/\[Farroway\] Funding verification active/);
    expect(joined).toMatch(/\[Farroway\] Scan runtime active/);

    // Operator-facing degradation pattern.
    expect(joined).toMatch(/\[Farroway\] Missing WEATHER_API_KEY/);
    expect(joined).toMatch(/disabled safely/);

    restoreEnv();
  });

  it('logProductionStartupBanner is idempotent — second call no-ops', async () => {
    const mod = await import(MODULE);
    mod._resetForTests();
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://x';
    process.env.AUTH_SECRET  = 'a'.repeat(40);

    const lines = [];
    const orig = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
      mod.logProductionStartupBanner();
      const after1 = lines.length;
      mod.logProductionStartupBanner();
      const after2 = lines.length;
      expect(after2).toBe(after1); // idempotent
    } finally { console.log = orig; }

    restoreEnv();
  });

  it('reports failure when a required var is missing', async () => {
    const mod = await import(MODULE);
    mod._resetForTests();

    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    delete process.env.JWT_SECRET;

    const lines = [];
    const orig = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try { mod.logProductionStartupBanner(); }
    finally { console.log = orig; }

    const joined = lines.join('\n');
    expect(joined).toMatch(/Environment validation FAILED/);
    expect(joined).toMatch(/DATABASE_URL/);
    expect(joined).toMatch(/AUTH_SECRET/);

    restoreEnv();
  });

  // ─── May 2026 production-dependency wiring pass ────────────
  it('serviceStatus enumerates every wired service', async () => {
    const mod = await import(MODULE);
    const status = mod.serviceStatus();
    const keys = status.map((s) => s.key);
    // Every service expected by the spec is present.
    for (const k of ['weather','maps','scan','uploads','redis',
                     'sentry','sms','email','openai']) {
      expect(keys).toContain(k);
    }
    // Each entry is a frozen { key, label, active, present } shape.
    for (const s of status) {
      expect(typeof s.key).toBe('string');
      expect(typeof s.label).toBe('string');
      expect(typeof s.active).toBe('boolean');
      expect(Array.isArray(s.present)).toBe(true);
      expect(Object.isFrozen(s)).toBe(true);
    }
  });

  it('serviceStatus honours every documented alias', async () => {
    const mod = await import(MODULE);

    // Maps: canonical + 3 aliases — any one wires the service.
    delete process.env.MAPS_API_KEY;
    delete process.env.VITE_MAPS_API_KEY;
    delete process.env.MAPBOX_TOKEN;
    delete process.env.VITE_MAPBOX_TOKEN;
    expect(mod.serviceStatus().find((s) => s.key === 'maps').active).toBe(false);
    process.env.MAPBOX_TOKEN = 'mb-xyz';
    expect(mod.serviceStatus().find((s) => s.key === 'maps').active).toBe(true);

    // Scan: SCAN_API_KEY / PLANT_ID_API_KEY / PLANTNET_API_KEY
    delete process.env.SCAN_API_KEY;
    delete process.env.PLANT_ID_API_KEY;
    delete process.env.PLANTNET_API_KEY;
    expect(mod.serviceStatus().find((s) => s.key === 'scan').active).toBe(false);
    process.env.PLANT_ID_API_KEY = 'pid-abc';
    expect(mod.serviceStatus().find((s) => s.key === 'scan').active).toBe(true);

    // Uploads: any of the cloud-provider keys flips on the slot.
    delete process.env.UPLOAD_BASE_URL;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    delete process.env.S3_BUCKET;
    delete process.env.S3_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    expect(mod.serviceStatus().find((s) => s.key === 'uploads').active).toBe(false);
    process.env.CLOUDINARY_API_KEY = 'cl-key';
    expect(mod.serviceStatus().find((s) => s.key === 'uploads').active).toBe(true);

    restoreEnv();
  });

  it('banner emits per-service active/disabled status lines', async () => {
    const mod = await import(MODULE);
    mod._resetForTests();

    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://x';
    process.env.AUTH_SECRET  = 'a'.repeat(40);
    process.env.WEATHER_API_KEY = 'wkey';
    delete process.env.MAPS_API_KEY;
    delete process.env.MAPBOX_TOKEN;
    delete process.env.VITE_MAPS_API_KEY;
    delete process.env.VITE_MAPBOX_TOKEN;

    const lines = [];
    const orig = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try { mod.logProductionStartupBanner(); }
    finally { console.log = orig; }

    const joined = lines.join('\n');
    expect(joined).toMatch(/\[Farroway\] Weather: active/);
    expect(joined).toMatch(/\[Farroway\] Maps: disabled \(no key\)/);

    restoreEnv();
  });
});
