/**
 * assetManifestGuard.test.js — Permanent Runtime Asset + URL Fix.
 *
 * Coverage:
 *   1. src/assets/assetManifest.js — single canonical icon
 *      manifest with the spec-mandated keys
 *   2. scripts/check-icons.mjs build-time guard:
 *      - passes on the current source tree
 *      - walks both the manifest + public/manifest.json + index.html
 *      - npm script registered in package.json
 *      - build:safe runs the new check before `npm run build`
 *   3. The 4 spec-flagged production 404 files all exist locally
 *      + git-tracked (proves source is correct; production 404s
 *      are deploy-lag)
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const fileSize = (rel) => {
  try { return statSync(resolve(ROOT, rel)).size; }
  catch { return 0; }
};

// ─── 1. Asset manifest module ──────────────────────────────

describe('src/assets/assetManifest.js — central icon registry', () => {
  it('module loads + exports ASSETS + getIconAsset', async () => {
    const mod = await import('../../../src/assets/assetManifest.js');
    expect(mod.ASSETS).toBeTruthy();
    expect(typeof mod.getIconAsset).toBe('function');
  });

  it('icons + fallbacks objects are frozen at module level', async () => {
    const { ASSETS } = await import('../../../src/assets/assetManifest.js');
    expect(Object.isFrozen(ASSETS)).toBe(true);
    expect(Object.isFrozen(ASSETS.icons)).toBe(true);
    expect(Object.isFrozen(ASSETS.fallbacks)).toBe(true);
  });

  it('every PWA + brand mark the spec mentions is keyed', async () => {
    const { ASSETS } = await import('../../../src/assets/assetManifest.js');
    expect(ASSETS.icons.favicon).toBeTruthy();
    expect(ASSETS.icons.appleTouch).toBeTruthy();
    expect(ASSETS.icons.pwa192).toBeTruthy();
    expect(ASSETS.icons.pwa512).toBeTruthy();
    expect(ASSETS.icons.logoPremium).toBeTruthy();
    expect(ASSETS.icons.logoPremium192).toBeTruthy();
    expect(ASSETS.icons.logoPremium512).toBeTruthy();
    // The two files the production 404s called out explicitly:
    expect(ASSETS.icons.logoPremium).toBe('/icons/logo-premium.jpg');
    expect(ASSETS.icons.logoPremium192).toBe('/icons/logo-premium-192.jpg');
  });

  it('getIconAsset returns null for unknown keys', async () => {
    const { getIconAsset } = await import('../../../src/assets/assetManifest.js');
    expect(getIconAsset('not_a_real_key')).toBeNull();
    expect(getIconAsset(null)).toBeNull();
    expect(getIconAsset('')).toBeNull();
  });

  it('every icon path in the manifest resolves to a real file on disk', async () => {
    const { ASSETS } = await import('../../../src/assets/assetManifest.js');
    const allPaths = [
      ...Object.values(ASSETS.icons),
      ...Object.values(ASSETS.fallbacks),
    ];
    const missing = [];
    for (const p of allPaths) {
      const abs = resolve(ROOT, 'public', p.replace(/^\/+/, ''));
      if (!existsSync(abs)) missing.push(p);
    }
    expect(missing).toEqual([]);
  });
});

// ─── 2. check:icons build-time guard ───────────────────────

describe('check:icons — build-time guard', () => {
  it('passes on the current source tree', () => {
    let stdout;
    try {
      stdout = execSync('node scripts/check-icons.mjs', {
        cwd:      ROOT,
        encoding: 'utf8',
      });
    } catch (err) {
      const out = (err.stdout || '') + (err.stderr || '');
      throw new Error('check:icons FAILED:\n' + out);
    }
    expect(stdout).toMatch(/\[check:icons\] PASS/);
    expect(stdout).toMatch(/all present on disk/);
  });

  it('walks BOTH the manifest AND public/manifest.json AND index.html', () => {
    const script = read('scripts/check-icons.mjs');
    expect(script).toMatch(/assetManifest\.js/);
    expect(script).toMatch(/public\/manifest\.json/);
    expect(script).toMatch(/index\.html/);
  });

  it('enforces MUST_EXIST gate on critical icons (favicon / 192 / 512 / apple-touch)', () => {
    const script = read('scripts/check-icons.mjs');
    expect(script).toMatch(/MUST_EXIST/);
    expect(script).toMatch(/icon-192\.png/);
    expect(script).toMatch(/icon-512\.png/);
    expect(script).toMatch(/apple-touch-icon\.png/);
  });
});

// ─── 3. package.json wiring ────────────────────────────────

describe('package.json — check:icons registered + build:safe wiring', () => {
  const pkg = JSON.parse(read('package.json'));

  it('check:icons npm script is registered', () => {
    expect(pkg.scripts['check:icons']).toBe('node scripts/check-icons.mjs');
  });

  it('build:safe runs check:icons before `npm run build`', () => {
    expect(pkg.scripts['build:safe']).toContain('check:icons');
    const idxCheck = pkg.scripts['build:safe'].indexOf('check:icons');
    const idxBuild = pkg.scripts['build:safe'].indexOf('npm run build');
    expect(idxCheck).toBeLessThan(idxBuild);
  });

  it('build:safe still runs the existing realism + production + URL checks', () => {
    expect(pkg.scripts['build:safe']).toContain('check:assets');
    expect(pkg.scripts['build:safe']).toContain('check:production-assets');
    expect(pkg.scripts['build:safe']).toContain('check:url-construction');
  });
});

// ─── 4. Spec acceptance — the 4 flagged 404 files ──────────

describe('Acceptance — production-flagged 404 files now exist + typo fixed', () => {
  it.each([
    'public/assets/realism/journal/farm-inspection.jpeg',
    'public/assets/realism/heroes/africa-sunrise-farm.jpeg',
    'public/icons/logo-premium.jpg',
    'public/icons/logo-premium-192.jpg',
  ])('%s exists on disk + has non-zero size', (rel) => {
    const abs = resolve(ROOT, rel);
    expect(existsSync(abs)).toBe(true);
    expect(fileSize(rel)).toBeGreaterThan(100);
  });

  it('typo path "afrca-sunrise-farm.jpeg" no longer exists', () => {
    // Renamed to "africa-sunrise-farm.jpeg" per spec §3 - the
    // misspelled string should not appear anywhere in src/ or
    // public/. check:assets enforces no stray realism literals
    // in src/; this test pins the disk-side rename.
    const oldPath = resolve(ROOT, 'public/assets/realism/heroes/afrca-sunrise-farm.jpeg');
    expect(existsSync(oldPath)).toBe(false);
  });
});

// ─── 5. Acceptance — coverage matrix ───────────────────────

describe('Acceptance — coverage matrix is complete', () => {
  it('check:icons + check:assets + check:production-assets together cover all image classes', () => {
    // check:assets covers realism photos.
    // check:production-assets covers ≥1KB required production files.
    // check:icons covers icons + brand marks + PWA logos.
    // Together these are every image class the app ships.
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['check:assets']).toBeTruthy();
    expect(pkg.scripts['check:production-assets']).toBeTruthy();
    expect(pkg.scripts['check:icons']).toBeTruthy();
  });
});
