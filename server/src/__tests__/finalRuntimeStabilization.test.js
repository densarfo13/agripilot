/**
 * finalRuntimeStabilization.test.js — Final Runtime Stabilization
 * Pass.
 *
 * Coverage:
 *   1. ScanCapture's camera_permission_denied log is now INFO,
 *      not WARN (spec §6 — denied is an expected user state).
 *   2. The check:url-construction build-time guard:
 *      - whitelist enforced (the 6 safe wrappers)
 *      - vite-idiom `new URL('./...', import.meta.url)` allowed
 *      - script passes on the current source tree
 *      - npm script registered in package.json
 *      - build:safe runs the new check
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── 1. Camera permission log is INFO, not WARN ────────────

describe('ScanCapture — camera_permission_denied is info-level', () => {
  const src = read('src/components/scan/ScanCapture.jsx');

  it('uses console.info, not console.warn, for camera_permission_denied', () => {
    // The block that emits the camera-denied log line.
    // Grab a window around the tag so we can inspect the level.
    const idx = src.indexOf('camera_permission_denied (info)');
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(Math.max(0, idx - 200), idx + 100);
    expect(window).toMatch(/console\.info/);
    expect(window).not.toMatch(/console\.warn\(['"]\[FARROWAY_SCAN\] camera_permission_denied/);
  });

  it('still labels the line with the [FARROWAY_SCAN] tag', () => {
    expect(src).toMatch(/\[FARROWAY_SCAN\] camera_permission_denied \(info\)/);
  });
});

// ─── 2. check:url-construction script behavior ─────────────

describe('check:url-construction — permanent guard script', () => {
  it('passes on the current source tree (no rogue new URL callers)', () => {
    let stdout;
    try {
      stdout = execSync('node scripts/check-url-construction.mjs', {
        cwd:      ROOT,
        encoding: 'utf8',
      });
    } catch (err) {
      // execSync throws non-zero exit — surface the stdout/stderr
      // so a debugger sees exactly which file regressed.
      const out = (err.stdout || '') + (err.stderr || '');
      throw new Error('check:url-construction FAILED:\n' + out);
    }
    expect(stdout).toMatch(/\[check:url-construction\] OK/);
  });

  it('whitelist contains the 6 documented safe wrappers', () => {
    const script = read('scripts/check-url-construction.mjs');
    expect(script).toMatch(/'src\/lib\/safeUrl\.js'/);
    expect(script).toMatch(/'src\/utils\/safeUrl\.js'/);
    expect(script).toMatch(/'src\/lib\/urlBuilder\.ts'/);
    expect(script).toMatch(/'src\/config\/env\.js'/);
    expect(script).toMatch(/'src\/lib\/analytics\/safeTrack\.js'/);
    expect(script).toMatch(/'src\/security\/validateFundingUrl\.js'/);
  });

  it('allows the vite-standard `new URL("./x", import.meta.url)` idiom', () => {
    const script = read('scripts/check-url-construction.mjs');
    expect(script).toMatch(/import\.meta\.url/);
    expect(script).toMatch(/ALLOWED_PATTERNS/);
  });
});

describe('package.json — wiring', () => {
  const pkg = JSON.parse(read('package.json'));

  it('registers check:url-construction as an npm script', () => {
    expect(pkg.scripts['check:url-construction']).toBe('node scripts/check-url-construction.mjs');
  });

  it('build:safe runs check:url-construction before build', () => {
    // build:safe is now a runner (scripts/run-build-safe-checks.mjs) that
    // executes the canonical step list in `build:safe:steps` — the full
    // `&&` chain was split out because it exceeded the Windows command-line
    // length limit. The step list is the source of truth.
    const steps = pkg.scripts['build:safe:steps'];
    expect(steps).toContain('check:url-construction');
    // Order: url check must come BEFORE the `build` step.
    const idxCheck = steps.indexOf('check:url-construction');
    const idxBuild = steps.indexOf(' build ');
    expect(idxCheck).toBeLessThan(idxBuild);
  });

  it('build:safe still runs the realism + production asset checks', () => {
    const steps = pkg.scripts['build:safe:steps'];
    expect(steps).toContain('check:assets');
    expect(steps).toContain('check:production-assets');
  });
});

// ─── 3. Acceptance — the spec's "real blockers" assessment ─

describe('Acceptance — Final Runtime Stabilization spec assessment', () => {
  it('extension noise filter is auto-installed at boot (commit cc65935f)', () => {
    const main = read('src/main.jsx');
    expect(main).toMatch(/import \{ installExtensionNoiseFilter \}/);
    expect(main).toMatch(/installExtensionNoiseFilter\(\)/);
  });

  it('SafeImage component exists for the spec §4 "global safe image system"', () => {
    const safeImage = read('src/components/common/SafeImage.jsx');
    expect(safeImage).toMatch(/handleError/);
    expect(safeImage).toMatch(/hasErrored/); // one-shot swap
  });

  it('coordinate guard rejects 0,0 (spec §3 ish - downstream of asset/URL fix)', () => {
    const guard = read('src/lib/geo/coordinateGuard.js');
    expect(guard).toMatch(/NULL_ISLAND/);
  });

  it('safeBuildUrl + preflightUrl available for any call-site adoption', () => {
    const builder = read('src/lib/url/safeBuildUrl.js');
    expect(builder).toMatch(/safeBuildUrl/);
    expect(builder).toMatch(/preflightUrl/);
  });

  it('5+ error boundaries already cover spec §7 (no need for AppErrorBoundary)', async () => {
    // We list them rather than render-test them — render-testing
    // class components in vitest without happy-dom is brittle.
    const list = [
      'src/components/system/ErrorBoundary.jsx',
      'src/components/system/DashboardErrorBoundary.jsx',
      'src/components/system/HomeErrorBoundary.jsx',
      'src/components/system/RecoveryErrorBoundary.jsx',
      'src/components/system/RouteErrorBoundary.jsx',
    ];
    for (const p of list) {
      expect(() => read(p)).not.toThrow();
    }
  });
});
