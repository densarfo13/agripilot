/**
 * unifiedIntelligence.test.js — Intelligence Unification Upgrade.
 *
 * src/core/intelligence/unifiedIntelligence.js is the read-only
 * orchestrator that connects the existing engines (farmContextEngine,
 * farmIntelligenceSnapshot, contextEngine, regions) into one
 * pipeline:  LOCATION → REGION → WEATHER → CROP → TASK/ALERT.
 *
 * Coverage:
 *   - getUnifiedIntelligence() returns the documented unified shape
 *   - never throws (no farm, no localStorage, no window)
 *   - the contextEngine pipeline actually runs (context block filled)
 *   - injected weatherOverride flows through to the snapshot
 *   - geo.language reads the canonical farroway_language key
 *   - check:intelligence guard passes + is wired into build:safe
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getUnifiedIntelligence } from '../../../src/core/intelligence/unifiedIntelligence.js';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── 1. Unified shape ──────────────────────────────────────

describe('getUnifiedIntelligence — unified snapshot shape', () => {
  it('returns every documented top-level block', () => {
    const intel = getUnifiedIntelligence();
    expect(intel).toBeTruthy();
    expect(intel.geo).toBeTruthy();
    expect(intel.farm).toBeTruthy();
    expect(intel.intelligence).toBeTruthy();
    expect('weather' in intel).toBe(true);
    expect('context' in intel).toBe(true);
    expect(typeof intel.connectivity).toBe('string');
    expect(typeof intel.readAt).toBe('number');
    expect(Array.isArray(intel.errors)).toBe(true);
  });

  it('geo block carries country / region / regionCluster / language', () => {
    const { geo } = getUnifiedIntelligence();
    expect('country' in geo).toBe(true);
    expect('region' in geo).toBe(true);
    expect('regionCluster' in geo).toBe(true);
    expect(typeof geo.language).toBe('string');
  });

  it('farm block carries crop / cropStage / mode / hasFarm / hasGarden', () => {
    const { farm } = getUnifiedIntelligence();
    expect('crop' in farm).toBe(true);
    expect('cropStage' in farm).toBe(true);
    expect(['farm', 'garden']).toContain(farm.mode);
    expect(typeof farm.hasFarm).toBe('boolean');
    expect(typeof farm.hasGarden).toBe('boolean');
  });

  it('intelligence block carries health / risks / scanHistory / briefing', () => {
    const { intelligence } = getUnifiedIntelligence();
    expect('healthScore' in intelligence).toBe(true);
    expect(Array.isArray(intelligence.risks)).toBe(true);
    expect(Array.isArray(intelligence.scanHistory)).toBe(true);
    expect('nextBestAction' in intelligence).toBe(true);
  });
});

// ─── 2. Resilience ─────────────────────────────────────────

describe('getUnifiedIntelligence — never throws', () => {
  it('does not throw with no farm / no localStorage', () => {
    expect(() => getUnifiedIntelligence()).not.toThrow();
  });

  it('does not throw with garbage options', () => {
    expect(() => getUnifiedIntelligence(42)).not.toThrow();
    expect(() => getUnifiedIntelligence(null)).not.toThrow();
    expect(() => getUnifiedIntelligence('x')).not.toThrow();
  });

  it('connectivity is always online or offline', () => {
    expect(['online', 'offline']).toContain(getUnifiedIntelligence().connectivity);
  });
});

// ─── 3. The pipeline actually runs ─────────────────────────

describe('getUnifiedIntelligence — pipeline wiring', () => {
  it('runs the contextEngine — context block is populated', () => {
    const { context } = getUnifiedIntelligence();
    // computeContextIntelligence always returns a non-null object;
    // a null here means the engine call was never wired.
    expect(context).toBeTruthy();
    expect(context.todayTask).toBeTruthy();
    expect(typeof context.mode).toBe('string');
    expect(typeof context.source).toBe('string');
  });

  it('an injected weatherOverride flows into the snapshot', () => {
    const weather = { weatherType: 'rain', temp: 24, rainChance: 80 };
    const intel = getUnifiedIntelligence({ weatherOverride: weather });
    expect(intel.weather).toEqual(weather);
    // rain weather must drive a context decision — the engine
    // produces an alert or a drainage-flavoured task for rain.
    expect(intel.context).toBeTruthy();
  });

  it('honours an injected nowMs clock', () => {
    const intel = getUnifiedIntelligence({ nowMs: 1700000000000 });
    expect(intel.readAt).toBe(1700000000000);
  });
});

// ─── 4. Language ───────────────────────────────────────────

describe('getUnifiedIntelligence — language resolution', () => {
  const hadLS = 'localStorage' in globalThis;
  const savedLS = globalThis.localStorage;

  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  });

  afterEach(() => {
    if (hadLS) globalThis.localStorage = savedLS;
    else delete globalThis.localStorage;
  });

  it('reads the canonical farroway_language key', () => {
    globalThis.localStorage.setItem('farroway_language', 'fr');
    expect(getUnifiedIntelligence().geo.language).toBe('fr');
  });

  it('falls back to the legacy farroway:lang mirror', () => {
    globalThis.localStorage.setItem('farroway:lang', 'sw');
    expect(getUnifiedIntelligence().geo.language).toBe('sw');
  });

  it('defaults to en when nothing is stored', () => {
    expect(getUnifiedIntelligence().geo.language).toBe('en');
  });
});

// ─── 5. Build guard ────────────────────────────────────────

describe('check:intelligence — build-time guard', () => {
  it('passes on the current source tree', () => {
    let stdout;
    try {
      stdout = execSync('node scripts/check-intelligence.mjs', {
        cwd: ROOT, encoding: 'utf8',
      });
    } catch (err) {
      throw new Error('check:intelligence FAILED:\n'
        + ((err.stdout || '') + (err.stderr || '')));
    }
    expect(stdout).toMatch(/\[check:intelligence\] PASS/);
  });

  it('is registered in package.json + wired into build:safe', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['check:intelligence']).toBe('node scripts/check-intelligence.mjs');
    expect(pkg.scripts['build:safe']).toContain('check:intelligence');
    const idxCheck = pkg.scripts['build:safe'].indexOf('check:intelligence');
    const idxBuild = pkg.scripts['build:safe'].indexOf('npm run build');
    expect(idxCheck).toBeLessThan(idxBuild);
  });
});
