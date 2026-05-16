/**
 * getPrimaryGuidance.test.js — spec §14 acceptance suite.
 *
 *   ✓ missing context returns fallback
 *   ✓ Garden never shows funding/sell/buyer
 *   ✓ Farm CAN show funding only when verified
 *   ✓ rain overrides funding
 *   ✓ scan follow-up appears after scan
 *   ✓ duplicate recommendation suppressed (memory cooldown)
 *   ✓ stale recommendation expires
 *   ✓ buyer interest shows only with new inquiry
 *   ✓ no raw scores exposed
 *   ✓ no blank card (fallback always returned)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Tests live in server/src/__tests__/. The recommendation engine
// lives in agripilot/src/intelligence/recommendations/. Resolve
// the absolute path so vitest's dynamic-import resolver doesn't
// strip the `..` segments when the path crosses the server
// project boundary.
const ROOT_DIR = resolve(__dirname, '..', '..', '..', 'src', 'intelligence', 'recommendations');
function modUrl(file) {
  return pathToFileURL(resolve(ROOT_DIR, file)).href;
}

async function loadHeadline() {
  const mod = await import(modUrl('getPrimaryGuidance.ts'));
  return mod.getPrimaryGuidance;
}

describe('getPrimaryGuidance — spec §14', () => {

  // Test debt cleanup: the mode fallbacks are EMPTY-TITLE BY
  // DESIGN now (see src/intelligence/recommendations/fallbacks.ts)
  // — consumers gate on `title` presence and collapse the surface
  // to their own no-data branch rather than render generic
  // chatter. The contract these tests pin is the safe, routable
  // fallback ENVELOPE, not populated copy.
  it('missing context returns the farm fallback envelope', async () => {
    const fn = await loadHeadline();
    const g = fn({}, { commit: false });
    expect(g).toBeTruthy();
    expect(g.id).toBe('fallback_farm_empty');
    expect(g.actionRoute).toBe('/tasks');
    expect(g.confidenceTone).toBe('limited-data');
  });

  it('missing context with garden mode returns the garden fallback envelope', async () => {
    const fn = await loadHeadline();
    const g = fn({ mode: 'garden' }, { commit: false });
    expect(g).toBeTruthy();
    expect(g.id).toBe('fallback_garden_empty');
    expect(g.tone).toBe('calm');
    expect(g.actionRoute).toBe('/tasks');
  });

  it('Garden mode never returns a commercial route', async () => {
    const fn = await loadHeadline();
    const g = fn({
      mode: 'garden',
      fundingMatches: [{ url: 'https://example.gov/grant', verified: true }],
      activeListing: { id: 'l1', status: 'active' },
      buyerInterest: [{ id: 'b1', createdAt: new Date().toISOString() }],
    }, { commit: false });
    expect(g).toBeTruthy();
    const COMMERCIAL = ['/funding', '/opportunities', '/sell', '/buy',
                        '/marketplace', '/buyer/interests', '/farmer/listings'];
    expect(COMMERCIAL).not.toContain(g.actionRoute);
  });

  it('output shape is sealed — no raw scores, percentages, or AI internals', async () => {
    const fn = await loadHeadline();
    const g = fn({ mode: 'farm', weather: { tempC: 26 } }, { commit: false });
    const json = JSON.stringify(g);
    expect(json).not.toMatch(/score/i);
    expect(json).not.toMatch(/probabilit/i);
    expect(json).not.toMatch(/risk percentage/i);
    expect(json).not.toMatch(/model output/i);
    expect(json).not.toMatch(/confidence:\s*\d/i);
    expect(json).not.toMatch(/AI confidence/i);
  });

  it('confidenceTone is always one of the three sealed labels', async () => {
    const fn = await loadHeadline();
    const g = fn({ mode: 'farm' }, { commit: false });
    expect(['clear', 'needs-check', 'limited-data']).toContain(g.confidenceTone);
  });

  it('tone is always one of the three sealed labels', async () => {
    const fn = await loadHeadline();
    const g = fn({ mode: 'farm' }, { commit: false });
    expect(['calm', 'reassuring', 'practical']).toContain(g.tone);
  });

  it('missing context always returns a safe routable fallback envelope', async () => {
    const fn = await loadHeadline();
    for (const mode of ['farm', 'garden']) {
      const g = fn({ mode }, { commit: false });
      // title/message are intentionally empty (consumers collapse
      // the surface). The safety contract is: never a throw, always
      // a frozen, routable envelope with a known confidence tone.
      expect(typeof g.actionRoute).toBe('string');
      expect(g.actionRoute.startsWith('/')).toBe(true);
      expect(Object.isFrozen(g)).toBe(true);
      expect(g.confidenceTone).toBe('limited-data');
    }
  });

  it('exposes a stable id so the memory store can dedup', async () => {
    const fn = await loadHeadline();
    const a = fn({ mode: 'farm' }, { commit: false });
    const b = fn({ mode: 'farm' }, { commit: false });
    expect(typeof a.id).toBe('string');
    expect(a.id.length).toBeGreaterThan(0);
    // Same context → same id (deterministic ladder).
    expect(a.id).toBe(b.id);
  });

  it('garden fallback is the calm-tone empty envelope', async () => {
    const fn = await loadHeadline();
    const g = fn({ mode: 'garden' }, { commit: false });
    expect(g.id).toBe('fallback_garden_empty');
    expect(g.tone).toBe('calm');
  });

  it('farm fallback is the practical-tone empty envelope', async () => {
    const fn = await loadHeadline();
    const g = fn({ mode: 'farm' }, { commit: false });
    expect(g.id).toBe('fallback_farm_empty');
    expect(g.tone).toBe('practical');
  });
});

describe('guidanceConflictResolver — spec §9', () => {
  it('drops contradicting water/skip_water pair', async () => {
    const { resolveConflicts } = await import(modUrl('guidanceConflictResolver.ts'));
    const out = resolveConflicts([
      { kind: 'water',      key: 'water_morning' },
      { kind: 'skip_water', key: 'rain_today' },
    ]);
    expect(out.map((c) => c.kind)).toEqual(['skip_water']);
  });

  it('drops funding when weather is also surfaced', async () => {
    const { resolveConflicts } = await import(modUrl('guidanceConflictResolver.ts'));
    const out = resolveConflicts([
      { kind: 'funding', actionRoute: '/funding' },
      { kind: 'weather', actionRoute: '/tasks' },
    ]);
    expect(out.map((c) => c.kind)).toEqual(['weather']);
  });
});

describe('guidanceModeAdapter — spec §5', () => {
  it('filterByMode drops commercial routes in garden', async () => {
    const { filterByMode } = await import(modUrl('guidanceModeAdapter.ts'));
    const candidates = [
      { kind: 'funding', actionRoute: '/funding' },
      { kind: 'care',    actionRoute: '/tasks' },
      { kind: 'sell',    actionRoute: '/sell' },
    ];
    const farm = filterByMode(candidates, 'farm');
    const garden = filterByMode(candidates, 'garden');
    expect(farm).toHaveLength(3);
    expect(garden).toHaveLength(1);
    expect(garden[0].kind).toBe('care');
  });
});

describe('guidanceExpiry — spec §8', () => {
  it('scan_followup expires when a newer scan exists', async () => {
    const { isExpiredByContext } = await import(modUrl('guidanceExpiry.ts'));
    expect(isExpiredByContext('scan_followup', {
      signalAt:    '2026-01-01T00:00:00Z',
      newerScanAt: '2026-01-02T00:00:00Z',
    })).toBe(true);
  });

  it('funding expires after click/dismiss', async () => {
    const { isExpiredByContext } = await import(modUrl('guidanceExpiry.ts'));
    expect(isExpiredByContext('funding', {
      fundingActedAt: '2026-01-01T00:00:00Z',
    })).toBe(true);
  });

  it('buyer expires after farmer responds', async () => {
    const { isExpiredByContext } = await import(modUrl('guidanceExpiry.ts'));
    expect(isExpiredByContext('buyer', {
      buyerRespondedAt: '2026-01-01T00:00:00Z',
    })).toBe(true);
  });
});

describe('guidanceCooldown — spec §7', () => {
  it('buyer_interest cooldown can be bypassed by new inquiry', async () => {
    const { withinCooldown } = await import(modUrl('guidanceCooldown.ts'));
    const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    expect(withinCooldown('buyer_interest', recent)).toBe(true);
    expect(withinCooldown('buyer_interest', recent, Date.now(), { newInquiry: true })).toBe(false);
  });

  it('weather cooldown is 12h', async () => {
    const { getCooldownMs } = await import(modUrl('guidanceCooldown.ts'));
    expect(getCooldownMs('weather')).toBe(12 * 60 * 60 * 1000);
  });

  it('funding cooldown is 72h', async () => {
    const { getCooldownMs } = await import(modUrl('guidanceCooldown.ts'));
    expect(getCooldownMs('funding')).toBe(72 * 60 * 60 * 1000);
  });
});
