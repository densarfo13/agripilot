/**
 * buyerProfile.test.js — covers the preference store + sanitizers
 * + per-locale i18n for the buyer location UI.
 *
 *   1. sanitizeCountries  normalizes to uppercase + dedupe + cap
 *   2. sanitizeRegions    shape + dedupe + cap; drops rows without
 *                         a country
 *   3. getBuyerProfile    lazy-creates a row; returns empty arrays
 *                         on first read
 *   4. updateBuyerProfile upserts with sanitized input; preserves
 *                         untouched fields
 *   5. resilience         falls back to a transient empty profile
 *                         when the table isn't migrated
 *   6. i18n wire-up for every new location UI key
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBuyerProfile, updateBuyerProfile, _internal,
} from '../services/market/buyerProfileService.js';
import { t } from '../../../src/i18n/index.js';

// ─── sanitizers ──────────────────────────────────────────
describe('sanitizeCountries', () => {
  it('uppercases + dedupes + caps', () => {
    const out = _internal.sanitizeCountries(['us', 'US', 'gh', 'gh', 'NG']);
    expect(out).toEqual(['US', 'GH', 'NG']);
  });

  it('drops empty / junk entries', () => {
    const out = _internal.sanitizeCountries(['us', '', null, undefined, '  ']);
    expect(out).toEqual(['US']);
  });

  it('caps at 10', () => {
    const many = Array.from({ length: 20 }, (_, i) => `X${i}`);
    const out = _internal.sanitizeCountries(many);
    expect(out.length).toBe(10);
  });
});

describe('sanitizeRegions', () => {
  it('requires country; drops rows without one', () => {
    const out = _internal.sanitizeRegions([
      { stateCode: 'MD' },               // no country → dropped
      { country: 'us', stateCode: 'md' },
      { country: '', stateCode: '' },    // blank country → dropped
    ]);
    expect(out).toEqual([{ country: 'US', stateCode: 'MD', label: null }]);
  });

  it('dedupes by (country, stateCode)', () => {
    const out = _internal.sanitizeRegions([
      { country: 'US', stateCode: 'MD' },
      { country: 'us', stateCode: 'md' }, // duplicate
      { country: 'US', stateCode: 'VA' },
    ]);
    expect(out).toHaveLength(2);
  });

  it('truncates overly long labels', () => {
    const out = _internal.sanitizeRegions([
      { country: 'US', stateCode: 'MD', label: 'x'.repeat(200) },
    ]);
    expect(out[0].label.length).toBeLessThanOrEqual(80);
  });

  it('caps at 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ country: 'US', stateCode: `S${i}` }));
    const out = _internal.sanitizeRegions(many);
    expect(out.length).toBe(20);
  });
});

// ─── Stub prisma ─────────────────────────────────────────
function makeStub() {
  const rows = new Map();
  let seq = 0;
  return {
    _state: { rows },
    buyerProfile: {
      findUnique: async ({ where }) => rows.get(where.userId) || null,
      create: async ({ data }) => {
        const row = {
          id: 'BP' + (++seq),
          preferredCountries: [], preferredRegions: [], expandSearch: false,
          createdAt: new Date(), updatedAt: new Date(),
          ...data,
        };
        rows.set(data.userId, row);
        return row;
      },
      upsert: async ({ where, create, update }) => {
        const existing = rows.get(where.userId);
        if (!existing) {
          const row = {
            id: 'BP' + (++seq),
            preferredCountries: [], preferredRegions: [], expandSearch: false,
            createdAt: new Date(), updatedAt: new Date(),
            ...create,
          };
          rows.set(where.userId, row);
          return row;
        }
        const next = { ...existing, ...update, updatedAt: new Date() };
        rows.set(where.userId, next);
        return next;
      },
    },
  };
}

describe('getBuyerProfile', () => {
  let prisma;
  beforeEach(() => { prisma = makeStub(); });

  it('lazy-creates a row on first access', async () => {
    expect(prisma._state.rows.size).toBe(0);
    const out = await getBuyerProfile(prisma, { user: { id: 'u1' } });
    expect(prisma._state.rows.size).toBe(1);
    expect(out.profile.preferredCountries).toEqual([]);
    expect(out.profile.preferredRegions).toEqual([]);
    expect(out.profile.expandSearch).toBe(false);
  });

  it('falls back to transient empty profile when table is missing', async () => {
    const broken = {
      buyerProfile: {
        findUnique: async () => { throw new Error('no table'); },
      },
    };
    const out = await getBuyerProfile(broken, { user: { id: 'u1' } });
    expect(out.profile.userId).toBe('u1');
    expect(out.profile.preferredRegions).toEqual([]);
  });

  it('rejects unauthenticated callers', async () => {
    await expect(getBuyerProfile(prisma, {})).rejects.toThrow('unauthenticated');
  });
});

describe('updateBuyerProfile', () => {
  let prisma;
  beforeEach(() => { prisma = makeStub(); });

  it('upserts sanitized countries + regions', async () => {
    const out = await updateBuyerProfile(prisma, {
      user: { id: 'u1' },
      patch: {
        preferredCountries: ['us', 'US', 'gh'],
        preferredRegions: [
          { country: 'us', stateCode: 'md' },
          { country: 'US', stateCode: 'VA', label: 'Virginia, United States' },
        ],
      },
    });
    expect(out.profile.preferredCountries).toEqual(['US', 'GH']);
    expect(out.profile.preferredRegions).toEqual([
      { country: 'US', stateCode: 'MD', label: null },
      { country: 'US', stateCode: 'VA', label: 'Virginia, United States' },
    ]);
  });

  it('partial patch preserves untouched fields', async () => {
    await updateBuyerProfile(prisma, {
      user: { id: 'u1' },
      patch: {
        preferredCountries: ['US'],
        preferredRegions: [{ country: 'US', stateCode: 'MD' }],
      },
    });
    const out = await updateBuyerProfile(prisma, {
      user: { id: 'u1' },
      patch: { expandSearch: true },
    });
    expect(out.profile.preferredCountries).toEqual(['US']);
    expect(out.profile.preferredRegions).toHaveLength(1);
    expect(out.profile.expandSearch).toBe(true);
  });

  it('expandSearch: true flips the flag', async () => {
    const before = await getBuyerProfile(prisma, { user: { id: 'u1' } });
    expect(before.profile.expandSearch).toBe(false);
    const after = await updateBuyerProfile(prisma, {
      user: { id: 'u1' }, patch: { expandSearch: true },
    });
    expect(after.profile.expandSearch).toBe(true);
  });
});

// ─── i18n: every new buyer location key resolves ─────────
const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const KEYS = [
  'market.field.location', 'market.field.cropPlaceholder',
  'market.location.any', 'market.location.none', 'market.location.searchPlaceholder',
  'market.location.preferred', 'market.location.preferredPill', 'market.location.other',
  'market.location.reset', 'market.location.expand', 'market.location.noResults',
];

// Words that legitimately match English across languages don't count
// as a leak.
const SHARED_EN = new Set([]);

describe('buyer location i18n', () => {
  it.each(KEYS)('%s has a non-empty English string', (k) => {
    expect(t(k, 'en')).toBeTruthy();
  });
  it.each(
    NON_EN_LOCALES.flatMap((lang) => KEYS.map((k) => [lang, k])),
  )('[%s] %s is localized', (lang, key) => {
    const en = t(key, 'en');
    const localized = t(key, lang);
    expect(localized).toBeTruthy();
    if (SHARED_EN.has(`${lang}:${key}`)) return;
    expect(localized).not.toBe(en);
  });
});
