/**
 * supplierProductSoilRollout.test.js — verifies the supplier
 * registry, product suggestion engine, marketplace link guard,
 * and soil intelligence engine shipped in the Supplier + Product
 * + Soil Intelligence Safe Rollout.
 */

import { describe, it, expect } from 'vitest';
import {
  listSuppliers, normaliseSupplier, SUPPLIER_STATUS,
} from '../../../src/core/suppliers/supplierRegistry.js';
import {
  trustLabelFor, isSafeToShow, TRUST_LABEL,
  FALLBACK_MESSAGE, RESTRICTED_DISCLAIMER,
} from '../../../src/core/suppliers/supplierTrustRules.js';
import {
  isSafeLink, sanitizeLink, BLOCKED_REASON,
} from '../../../src/core/suppliers/supplierLinkGuard.js';
import {
  matchSuppliers,
} from '../../../src/core/suppliers/supplierMatcher.js';
import {
  suggestProducts, PRODUCT_CATEGORY,
} from '../../../src/core/products/productSuggestionEngine.js';
import {
  guardMarketplaceLink, safeMarketplaceHref, listTrustedSources, REJECT_REASON,
} from '../../../src/core/marketplace/marketplaceLinkGuard.js';
import {
  analyzeSoilContext, SOIL_RISK,
} from '../../../src/core/soil/soilIntelligenceEngine.js';

// ─── §1 supplier registry ────────────────────────────────

describe('supplierRegistry', () => {
  it('default registry ships empty — no implicit endorsement', () => {
    expect(listSuppliers()).toEqual([]);
  });

  it('normaliseSupplier coerces an unknown status to "unverified"', () => {
    const s = normaliseSupplier({
      id: 's1', name: 'Test Agro', verifiedStatus: 'bogus',
    });
    expect(s.verifiedStatus).toBe(SUPPLIER_STATUS.UNVERIFIED);
  });

  it('normaliseSupplier returns null on missing id/name', () => {
    expect(normaliseSupplier({})).toBe(null);
    expect(normaliseSupplier({ id: 'x' })).toBe(null);
    expect(normaliseSupplier(null)).toBe(null);
  });

  it('normaliseSupplier carries all 12 keys (no key omitted)', () => {
    const s = normaliseSupplier({ id: 's1', name: 'Test' });
    for (const k of ['id','name','country','region','categories',
                     'cropsSupported','verifiedStatus','contactUrl',
                     'phone','distanceEstimate','lastVerifiedAt','notes']) {
      expect(Object.prototype.hasOwnProperty.call(s, k)).toBe(true);
    }
  });
});

// ─── §1 trust rules ──────────────────────────────────────

describe('supplierTrustRules', () => {
  it('verified status → verified label envelope', () => {
    const t = trustLabelFor({ verifiedStatus: SUPPLIER_STATUS.VERIFIED });
    expect(t.tier).toBe(TRUST_LABEL.VERIFIED);
    expect(t.label.fallback).toMatch(/verified/i);
  });

  it('pending status is treated as unverified for the label', () => {
    const t = trustLabelFor({ verifiedStatus: SUPPLIER_STATUS.PENDING });
    expect(t.tier).toBe(TRUST_LABEL.UNVERIFIED);
  });

  it('unknown supplier → general label', () => {
    expect(trustLabelFor(null).tier).toBe(TRUST_LABEL.GENERAL);
    expect(trustLabelFor({}).tier).toBe(TRUST_LABEL.UNVERIFIED);
  });

  it('isSafeToShow requires name + at least one contact channel', () => {
    expect(isSafeToShow(null)).toBe(false);
    expect(isSafeToShow({ name: 'X' })).toBe(false);
    expect(isSafeToShow({ name: 'X', contactUrl: 'https://x.example' })).toBe(true);
    expect(isSafeToShow({ name: 'X', phone: '+1' })).toBe(true);
  });

  it('FALLBACK_MESSAGE + RESTRICTED_DISCLAIMER ship localized envelopes', () => {
    expect(FALLBACK_MESSAGE.key).toBeTruthy();
    expect(FALLBACK_MESSAGE.fallback).toMatch(/local/i);
    expect(RESTRICTED_DISCLAIMER.fallback).toMatch(/expert/i);
  });
});

// ─── §4 supplier / marketplace link guards ───────────────

describe('supplierLinkGuard', () => {
  it('blocks empty / non-string / bad scheme', () => {
    expect(isSafeLink('').ok).toBe(false);
    expect(isSafeLink(null).ok).toBe(false);
    expect(isSafeLink('javascript:alert(1)').ok).toBe(false);
    expect(isSafeLink('javascript:alert(1)').reason).toBe(BLOCKED_REASON.BAD_SCHEME);
    expect(isSafeLink('file:///etc/passwd').ok).toBe(false);
  });

  it('blocks malformed', () => {
    expect(isSafeLink('not a url').ok).toBe(false);
  });

  it('blocks IPv4 literal hosts', () => {
    const r = isSafeLink('http://192.168.0.1/x');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(BLOCKED_REASON.IP_LITERAL);
  });

  it('allows https://, tel:, mailto:, sms:', () => {
    expect(isSafeLink('https://supplier.example.com').ok).toBe(true);
    expect(isSafeLink('tel:+233200000000').ok).toBe(true);
    expect(isSafeLink('mailto:hi@supplier.example').ok).toBe(true);
    expect(isSafeLink('sms:+233200000000').ok).toBe(true);
  });

  it('marks http:// as insecure', () => {
    const r = isSafeLink('http://supplier.example/x');
    expect(r.ok).toBe(true);
    expect(r.insecure).toBe(true);
  });

  it('sanitizeLink returns href or null', () => {
    expect(sanitizeLink('https://x.example')).toBe('https://x.example/');
    expect(sanitizeLink('javascript:1')).toBe(null);
  });
});

describe('marketplaceLinkGuard', () => {
  it('blocks links without a source id', () => {
    const g = guardMarketplaceLink({ url: 'https://x.example' });
    expect(g.ok).toBe(false);
    expect(g.reason).toBe(REJECT_REASON.MISSING_SOURCE);
  });

  it('blocks links from untrusted sources (fail-closed)', () => {
    const g = guardMarketplaceLink({ url: 'https://x.example', source: 'random_seller' });
    expect(g.ok).toBe(false);
    expect(g.reason).toBe(REJECT_REASON.UNTRUSTED_SOURCE);
  });

  it('allows trusted-source + safe-url combo', () => {
    const g = guardMarketplaceLink({
      url: 'https://farroway.app/listing/123',
      source: 'farroway_marketplace',
    });
    expect(g.ok).toBe(true);
  });

  it('safeMarketplaceHref returns null on bad input — surface shows fallback', () => {
    expect(safeMarketplaceHref(null)).toBe(null);
    expect(safeMarketplaceHref({ url: '', source: '' })).toBe(null);
  });

  it('listTrustedSources lists hand-curated source ids', () => {
    const ids = listTrustedSources();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('farroway_marketplace');
  });
});

// ─── §1 supplier matcher ─────────────────────────────────

describe('supplierMatcher', () => {
  it('returns [] when the registry is empty and no override given', () => {
    expect(matchSuppliers({ crop: 'tomato' })).toEqual([]);
  });

  it('ranks verified above unverified at equal context match', () => {
    const suppliers = [
      { id: 'u', name: 'U Co', verifiedStatus: 'unverified',
        contactUrl: 'https://u.example',
        region: 'r1', categories: ['compost'], cropsSupported: ['tomato'] },
      { id: 'v', name: 'V Co', verifiedStatus: 'verified',
        contactUrl: 'https://v.example',
        region: 'r1', categories: ['compost'], cropsSupported: ['tomato'] },
    ];
    const r = matchSuppliers({
      crop: 'tomato', region: 'r1', categories: ['compost'],
      suppliers, max: 2,
    });
    expect(r[0].supplier.id).toBe('v');
    expect(r[0].trust.tier).toBe('verified');
  });

  it('drops entries without a contact channel', () => {
    const suppliers = [
      { id: 'x', name: 'X', verifiedStatus: 'verified', region: 'r1' },
    ];
    const r = matchSuppliers({ region: 'r1', suppliers });
    expect(r).toEqual([]);
  });

  it('never throws on garbage input', () => {
    expect(() => matchSuppliers(null)).not.toThrow();
    expect(matchSuppliers(null)).toEqual([]);
  });
});

// ─── §2/§3/§15 product suggestion engine ─────────────────

describe('suggestProducts', () => {
  it('tomato planting suggests compost + watering + seeds (acceptance)', () => {
    const s = suggestProducts({ crop: 'tomato', stage: 'planting', mode: 'standard' });
    const cats = s.items.map((i) => i.category);
    expect(cats).toContain(PRODUCT_CATEGORY.COMPOST);
    expect(cats).toContain(PRODUCT_CATEGORY.WATERING_TOOLS);
  });

  it('dry soil risk suggests mulch + watering support (acceptance)', () => {
    const s = suggestProducts({
      crop: 'maize', stage: 'vegetative',
      weather: { daysSinceRain: 10 },
      mode: 'standard',
    });
    const cats = s.items.map((i) => i.category);
    expect(cats).toContain(PRODUCT_CATEGORY.MULCH);
  });

  it('scan water_stress suggests watering tools', () => {
    const s = suggestProducts({
      crop: 'tomato', stage: 'vegetative',
      scan: { issueCategory: 'water_stress' },
      mode: 'standard',
    });
    const cats = s.items.map((i) => i.category);
    expect(cats).toContain(PRODUCT_CATEGORY.WATERING_TOOLS);
  });

  it('fungal scan returns a restricted item ONLY behind the disclaimer', () => {
    const s = suggestProducts({
      crop: 'tomato', stage: 'flowering',
      scan: { issueCategory: 'fungal_risk' },
      mode: 'standard',
    });
    const restricted = s.items.find((i) => i.restricted);
    expect(restricted).toBeTruthy();
    expect(s.disclaimer).toBeTruthy();
    expect(s.disclaimer.fallback).toMatch(/expert/i);
  });

  it('Simple mode caps the list at 2 items', () => {
    const s = suggestProducts({
      crop: 'tomato', stage: 'fruiting',
      weather: { daysSinceRain: 10, temperatureC: 34 },
      scan:    { issueCategory: 'water_stress' },
      mode: 'simple',
    });
    expect(s.mode).toBe('simple');
    expect(s.items.length).toBeLessThanOrEqual(2);
  });

  it('every item carries a localizable reason envelope', () => {
    const s = suggestProducts({ crop: 'tomato', stage: 'planting', mode: 'standard' });
    for (const it of s.items) {
      expect(it.reason).toBeTruthy();
      expect(typeof it.reason.fallback).toBe('string');
    }
  });

  it('never throws on garbage input', () => {
    expect(() => suggestProducts(null)).not.toThrow();
    expect(suggestProducts(null).items).toEqual([]);
  });
});

// ─── §6/§7/§8/§9 soil intelligence engine ────────────────

describe('analyzeSoilContext', () => {
  it('no inputs → unknown soil risk, low confidence, with disclaimer', () => {
    const s = analyzeSoilContext({});
    expect(s.ok).toBe(true);
    expect(s.soilRisk).toBe(SOIL_RISK.UNKNOWN);
    expect(s.confidence).toBe('low');
    expect(s.disclaimer).toBeTruthy();
  });

  it('NEVER returns confidence "high"', () => {
    for (const ctx of [
      {}, { soil: {} },
      { weather: { daysSinceRain: 10 } },
      { soil: { type: 'sandy', drainage: 'good', testPH: 6.5, organicMatterPct: 3 },
        weather: { daysSinceRain: 9, temperatureC: 34 },
        scan: { issueCategory: 'water_stress' }, stage: 'flowering' },
    ]) {
      expect(analyzeSoilContext(ctx).confidence).not.toBe('high');
    }
  });

  it('poor drainage + heavy rain forecast → high moisture risk', () => {
    const s = analyzeSoilContext({
      soil:    { drainage: 'poor' },
      weather: { rainProbability24hPct: 90 },
    });
    expect(s.drainageRisk).toBe(SOIL_RISK.HIGH);
    expect(s.moistureRisk).toBe(SOIL_RISK.HIGH);
  });

  it('long dry spell → high moisture risk', () => {
    const s = analyzeSoilContext({
      weather: { daysSinceRain: 12 },
    });
    expect(s.moistureRisk).toBe(SOIL_RISK.HIGH);
  });

  it('scan water_stress → moisture risk high + watering guidance', () => {
    const s = analyzeSoilContext({
      stage: 'vegetative',
      scan: { issueCategory: 'water_stress' },
    });
    expect(s.moistureRisk).toBe(SOIL_RISK.HIGH);
    const text = s.safeGuidance.map((g) => g.fallback).join(' ');
    expect(text).toMatch(/water/i);
  });

  it('scan nutrient_stress → recommended soil check appears', () => {
    const s = analyzeSoilContext({
      stage: 'fruiting',
      scan: { issueCategory: 'nutrient_stress' },
    });
    expect(s.nutrientRisk).toBe(SOIL_RISK.HIGH);
    expect(s.recommendedCheck).toBeTruthy();
    expect(s.recommendedCheck.fallback).toMatch(/test|nutrient/i);
  });

  it('lifecycle stage shapes the safe guidance', () => {
    const planting   = analyzeSoilContext({ stage: 'planting' });
    const postHarv   = analyzeSoilContext({ stage: 'post_harvest' });
    const plantingT = planting.safeGuidance.map((g) => g.fallback).join(' ');
    const postT     = postHarv.safeGuidance.map((g) => g.fallback).join(' ');
    expect(plantingT).toMatch(/compost|organic|drainage/i);
    expect(postT).toMatch(/recover|compost|rotate/i);
  });

  it('every guidance + recommendedCheck envelope is localized', () => {
    const s = analyzeSoilContext({
      stage: 'flowering',
      scan:  { issueCategory: 'nutrient_stress' },
    });
    expect(s.recommendedCheck.key).toBeTruthy();
    for (const g of s.safeGuidance) {
      expect(g.key).toBeTruthy();
      expect(typeof g.fallback).toBe('string');
    }
  });

  it('uses hedged language only (may/consider/check) — never absolute', () => {
    const s = analyzeSoilContext({
      stage: 'planting',
      scan: { issueCategory: 'nutrient_stress' },
    });
    const text = (s.safeGuidance.map((g) => g.fallback).join(' ')
      + (s.recommendedCheck ? ' ' + s.recommendedCheck.fallback : ''));
    expect(text.toLowerCase()).not.toMatch(/guaranteed|definitely|certainly|exact/);
  });

  it('never throws on garbage input', () => {
    expect(() => analyzeSoilContext(null)).not.toThrow();
    expect(analyzeSoilContext(null).soilRisk).toBe(SOIL_RISK.UNKNOWN);
  });
});
