/**
 * recomputeFarmContext.test.js — contract for the centralized
 * post-farm-action refresh coordinator.
 *
 * Covers:
 *   • every provided dep runs in order
 *   • missing deps are skipped silently
 *   • a failing step does not block the next
 *   • result is frozen + carries ok / ran / errors / intent
 *   • summarizeIntent maps flags to stable strings
 */

import { describe, it, expect, vi } from 'vitest';

import {
  recomputeFarmContext, summarizeIntent, STEPS as RECOMPUTE_STEPS,
} from '../../../src/core/multiFarm/recomputeFarmContext.js';

describe('recomputeFarmContext', () => {
  it('runs refreshProfile + refreshFarms + invalidate in order', async () => {
    const calls = [];
    const deps = {
      refreshProfile:             vi.fn(async () => calls.push('p')),
      refreshFarms:               vi.fn(async () => calls.push('f')),
      invalidateLocalizedCaches:  vi.fn(() => calls.push('i')),
      locale: 'hi',
    };
    const out = await recomputeFarmContext({
      currentFarmId: 'farm_1', intent: { farmSwitched: true }, deps,
    });
    expect(out.ok).toBe(true);
    expect(calls).toEqual(['p', 'f', 'i']);
    expect(out.ran).toEqual([
      RECOMPUTE_STEPS.REFRESH_PROFILE,
      RECOMPUTE_STEPS.REFRESH_FARMS,
      RECOMPUTE_STEPS.INVALIDATE_LOCALIZED_CACHES,
    ]);
    expect(deps.invalidateLocalizedCaches).toHaveBeenCalledWith('hi');
  });

  it('skips missing deps without throwing', async () => {
    const out = await recomputeFarmContext({
      currentFarmId: 'farm_1', deps: {},
    });
    expect(out.ok).toBe(true);
    expect(out.ran).toEqual([]);
  });

  it('continues after a failing step and records the error', async () => {
    const deps = {
      refreshProfile: async () => { throw new Error('network'); },
      refreshFarms:   async () => 'ok',
    };
    const out = await recomputeFarmContext({ currentFarmId: 'f', deps });
    expect(out.ok).toBe(false);
    expect(out.errors[RECOMPUTE_STEPS.REFRESH_PROFILE]).toMatch(/network/);
    expect(out.ran).toContain(RECOMPUTE_STEPS.REFRESH_FARMS);
  });

  it('a throw in invalidateLocalizedCaches is captured, not thrown', async () => {
    const deps = {
      invalidateLocalizedCaches: () => { throw new Error('cache busted'); },
    };
    const out = await recomputeFarmContext({ currentFarmId: 'f', deps });
    expect(out.ok).toBe(false);
    expect(out.errors[RECOMPUTE_STEPS.INVALIDATE_LOCALIZED_CACHES])
      .toMatch(/cache busted/);
  });

  it('returns a frozen result', async () => {
    const out = await recomputeFarmContext({ currentFarmId: 'f' });
    expect(Object.isFrozen(out)).toBe(true);
    expect(Object.isFrozen(out.intent)).toBe(true);
  });

  it('passes intent through unchanged', async () => {
    const out = await recomputeFarmContext({
      currentFarmId: 'f',
      intent: { farmEdited: true, cropSwitched: true },
    });
    expect(out.intent.farmEdited).toBe(true);
    expect(out.intent.cropSwitched).toBe(true);
  });

  it('currentFarmId null-safe', async () => {
    const out = await recomputeFarmContext({});
    expect(out.currentFarmId).toBeNull();
  });
});

describe('summarizeIntent', () => {
  it('priority: cropSwitched > farmCreated > farmSwitched > farmEdited', () => {
    expect(summarizeIntent({ cropSwitched: true, farmEdited: true })).toBe('crop_switched');
    expect(summarizeIntent({ farmCreated: true, farmEdited: true })).toBe('farm_created');
    expect(summarizeIntent({ farmSwitched: true })).toBe('farm_switched');
    expect(summarizeIntent({ farmEdited: true })).toBe('farm_edited');
  });
  it('unknown when nothing set', () => {
    expect(summarizeIntent({})).toBe('unknown');
    expect(summarizeIntent()).toBe('unknown');
    expect(summarizeIntent(null)).toBe('unknown');
  });
});
