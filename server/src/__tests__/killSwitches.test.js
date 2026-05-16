/**
 * killSwitches.test.js — Production Hardening + Pilot Operations §5.
 *
 * Verifies the emergency kill switches + granular scan flags and
 * the isKilled() helper — a pilot operator can disable a misbehaving
 * subsystem with no deploy.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isFeatureEnabled,
  isKilled,
  setFeatureFlagOverride,
  _internal,
} from '../../../src/utils/featureFlags.js';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── 1. Flags exist with the right defaults ────────────────

describe('featureFlags — pilot-ops flags', () => {
  it('declares the granular scan-channel flags (default on)', () => {
    expect(_internal.DEFAULTS.FEATURE_GALLERY_SCAN_ENABLED).toBe(true);
    expect(_internal.DEFAULTS.FEATURE_CAMERA_SCAN_ENABLED).toBe(true);
  });

  it('declares the four kill switches (default OFF = not killed)', () => {
    expect(_internal.DEFAULTS.KILL_SCAN).toBe(false);
    expect(_internal.DEFAULTS.KILL_NOTIFICATIONS).toBe(false);
    expect(_internal.DEFAULTS.KILL_MARKETPLACE).toBe(false);
    expect(_internal.DEFAULTS.KILL_COPILOT).toBe(false);
  });

  it('FEATURE_FARM_COPILOT_BETA stays false (Copilot not public)', () => {
    expect(_internal.DEFAULTS.FEATURE_FARM_COPILOT_BETA).toBe(false);
  });
});

// ─── 2. isKilled() ─────────────────────────────────────────

describe('isKilled — emergency kill-switch check', () => {
  const hadWin = 'window' in globalThis;
  const savedWin = globalThis.window;

  beforeEach(() => {
    const store = new Map();
    globalThis.window = {
      localStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      },
    };
  });
  afterEach(() => {
    if (hadWin) globalThis.window = savedWin;
    else delete globalThis.window;
  });

  it('every subsystem is NOT killed by default', () => {
    for (const s of ['scan', 'notifications', 'marketplace', 'copilot']) {
      expect(isKilled(s)).toBe(false);
    }
  });

  it('flipping a KILL_* flag kills exactly that subsystem', () => {
    setFeatureFlagOverride('KILL_NOTIFICATIONS', true);
    expect(isKilled('notifications')).toBe(true);
    // other subsystems unaffected
    expect(isKilled('scan')).toBe(false);
    expect(isKilled('copilot')).toBe(false);
    setFeatureFlagOverride('KILL_NOTIFICATIONS', null);
    expect(isKilled('notifications')).toBe(false);
  });

  it('unknown subsystem names are never killed; never throws', () => {
    expect(isKilled('not_a_subsystem')).toBe(false);
    expect(() => isKilled(null)).not.toThrow();
    expect(isKilled(null)).toBe(false);
  });
});

// ─── 3. Kill switches are wired into subsystems ────────────

describe('kill switches — wired at subsystem entry points', () => {
  it('returnLoopScheduler stands down when notifications are killed', () => {
    const src = read('src/core/notifications/returnLoopScheduler.js');
    expect(src).toMatch(/import \{ isFeatureEnabled, isKilled \}/);
    expect(src).toMatch(/isKilled\('notifications'\)/);
    expect(src).toMatch(/reason: 'killed'/);
  });

  it('FarmCopilotLauncher does not render when copilot is killed', () => {
    const src = read('src/components/copilot/FarmCopilotLauncher.jsx');
    expect(src).toMatch(/isKilled\('copilot'\)/);
  });
});

// ─── 4. The real-device QA checklist exists ────────────────

describe('docs — real-device QA checklist (§6)', () => {
  it('REAL_DEVICE_QA_CHECKLIST.md exists and covers the device matrix', () => {
    const md = read('docs/qa/REAL_DEVICE_QA_CHECKLIST.md');
    expect(md).toMatch(/iPhone Safari/);
    expect(md).toMatch(/Android Chrome/);
    expect(md).toMatch(/Desktop Chrome/);
    expect(md).toMatch(/offline/i);
    expect(md).toMatch(/kill-switch/i);
  });
});
