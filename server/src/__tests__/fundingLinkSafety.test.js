/**
 * fundingLinkSafety.test.js — acceptance coverage for the
 * May 2026 funding-link safety lockdown.
 *
 * Spec §15 cases:
 *   • porn URL blocked
 *   • http URL blocked
 *   • shortened URL blocked
 *   • javascript URL blocked
 *   • verified gov link allowed
 *   • malformed URL blocked
 *   • redirect chain (ip-literal / userinfo / non-standard port) blocked
 *
 * Plus structural assertions:
 *   • whitelist contains the spec-mandated organisations
 *   • subdomain matching works (nifa.usda.gov passes via usda.gov)
 *   • mailto:partnerships@farroway.app passes; unknown mailto fails
 *   • sanitiser strips utm_* + click ids from verified URLs
 *   • sanitiser returns '' for unsafe URLs (defence-in-depth)
 *
 * Plus lockdown assertions on the existing data sources:
 *   • every URL in src/config/fundingConfig.js passes the gate
 *   • every URL in src/funding/sampleOpportunities.js passes the gate
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.setConfig({ testTimeout: 15000 });

const ROOT = resolve(__dirname, '../../../');
function read(rel) { return readFileSync(resolve(ROOT, rel), 'utf8'); }

// ─── Whitelist ───────────────────────────────────────────────────
describe('fundingWhitelist — verified host allow-list', () => {
  it('contains the spec-mandated multilateral / foundation hosts', async () => {
    const { VERIFIED_FUNDING_HOSTS, isWhitelistedFundingHost } =
      await import('../../../src/security/fundingWhitelist.js');
    const required = [
      'grants.gov', 'usaid.gov', 'worldbank.org', 'ifad.org',
      'fao.org', 'usda.gov', 'gsma.com', 'cgiar.org',
      'mastercardfdn.org', 'gatesfoundation.org',
      'afdb.org', 'undp.org', 'unicef.org', 'europa.eu',
    ];
    for (const host of required) {
      expect(VERIFIED_FUNDING_HOSTS).toContain(host);
      expect(isWhitelistedFundingHost(host)).toBe(true);
    }
  });

  it('matches subdomains via parent host', async () => {
    const { isWhitelistedFundingHost } =
      await import('../../../src/security/fundingWhitelist.js');
    expect(isWhitelistedFundingHost('nifa.usda.gov')).toBe(true);
    expect(isWhitelistedFundingHost('www.usda.gov')).toBe(true);
    expect(isWhitelistedFundingHost('rd.usda.gov')).toBe(true);
    expect(isWhitelistedFundingHost('ec.europa.eu')).toBe(true);
  });

  it('rejects look-alike + parking-attack hosts', async () => {
    const { isWhitelistedFundingHost } =
      await import('../../../src/security/fundingWhitelist.js');
    // Classic phishing trick — `usda.gov.evil.example` has a
    // suffix containing the verified host but is NOT under it.
    expect(isWhitelistedFundingHost('usda.gov.evil.example')).toBe(false);
    expect(isWhitelistedFundingHost('grants.gov.com')).toBe(false);
    expect(isWhitelistedFundingHost('porn-usda.gov')).toBe(false);
    expect(isWhitelistedFundingHost('')).toBe(false);
    expect(isWhitelistedFundingHost(null)).toBe(false);
  });
});

// ─── URL classifier — spec §15 ladder ────────────────────────────
describe('classifyFundingUrl — defence-in-depth ladder', () => {
  it('blocks adult-content URLs', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    const r = classifyFundingUrl('https://pornhub.com/grant');
    expect(r.ok).toBe(false);
    // Either adult_content_keyword or host_not_whitelisted
    // satisfies — both are correct rejections.
    expect(['adult_content_keyword', 'host_not_whitelisted']).toContain(r.reason);
  });

  it('blocks gambling URLs', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    const r = classifyFundingUrl('https://bet365.com/sportsbook');
    expect(r.ok).toBe(false);
  });

  it('blocks http:// (non-HTTPS)', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    expect(classifyFundingUrl('http://usda.gov').reason).toBe('not_https');
  });

  it('blocks javascript: data: vbscript: file:', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    for (const scheme of ['javascript', 'data', 'vbscript', 'file', 'blob', 'about']) {
      const r = classifyFundingUrl(`${scheme}:alert(1)`);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('forbidden_scheme');
    }
  });

  it('blocks link shorteners', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    for (const host of ['bit.ly', 't.co', 'tinyurl.com', 'lnkd.in', 'goo.gl']) {
      const r = classifyFundingUrl(`https://${host}/abc`);
      expect(r.ok).toBe(false);
    }
  });

  it('blocks IP-literal hosts', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    expect(classifyFundingUrl('https://192.168.1.1/grant').ok).toBe(false);
    expect(classifyFundingUrl('https://10.0.0.1/grant').ok).toBe(false);
    expect(classifyFundingUrl('https://127.0.0.1/grant').ok).toBe(false);
    expect(classifyFundingUrl('https://[::1]/grant').ok).toBe(false);
  });

  it('blocks userinfo phishing pattern', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    const r = classifyFundingUrl('https://usda.gov@evil.example/grant');
    expect(r.ok).toBe(false);
    // The URL parser strips userinfo; this resolves to host=evil.example
    // → host_not_whitelisted. Either reason proves the attack is blocked.
    expect(['userinfo_in_url', 'host_not_whitelisted']).toContain(r.reason);
  });

  it('blocks suspicious TLDs', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    expect(classifyFundingUrl('https://example.tk/grant').ok).toBe(false);
    expect(classifyFundingUrl('https://example.zip/grant').ok).toBe(false);
    expect(classifyFundingUrl('https://example.xyz/grant').ok).toBe(false);
  });

  it('blocks malformed URLs', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    expect(classifyFundingUrl('not a url').ok).toBe(false);
    expect(classifyFundingUrl('').ok).toBe(false);
    expect(classifyFundingUrl(null).ok).toBe(false);
    expect(classifyFundingUrl(undefined).ok).toBe(false);
    expect(classifyFundingUrl(123).ok).toBe(false);
  });

  it('blocks non-standard ports', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    expect(classifyFundingUrl('https://usda.gov:8080/grant').ok).toBe(false);
  });

  it('allows verified gov / NGO links', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    const samples = [
      'https://www.nifa.usda.gov/grants/programs/beginning-farmer-rancher-development-program',
      'https://mastercardfdn.org/young-africa-works/',
      'https://www.fao.org/climate-smart-agriculture/en/',
      'https://mofa.gov.gh/site/programmes/planting-for-food-jobs',
      'https://www.kilimo.go.ke/',
      'https://www.cbn.gov.ng/devfin/abp.asp',
      'https://www.ifad.org/en/web/operations/w/country/nigeria',
    ];
    for (const url of samples) {
      const r = classifyFundingUrl(url);
      expect(r.ok).toBe(true);
      expect(r.reason).toBe('verified');
    }
  });

  it('allows mailto: only when host is whitelisted', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    expect(classifyFundingUrl('mailto:partnerships@farroway.app').ok).toBe(true);
    expect(classifyFundingUrl('mailto:bad@evil.example').ok).toBe(false);
    expect(classifyFundingUrl('mailto:malformed-no-at').ok).toBe(false);
  });
});

// ─── Sanitiser ───────────────────────────────────────────────────
describe('sanitizeFundingUrl', () => {
  it('strips utm + click-id tracking params from verified URLs', async () => {
    const { sanitizeFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    const before = 'https://www.usda.gov/topics/urban?utm_source=evil&utm_medium=cpc&fbclid=xxx&ref=spam';
    const after  = sanitizeFundingUrl(before);
    expect(after).not.toMatch(/utm_/);
    expect(after).not.toMatch(/fbclid/);
    expect(after).toMatch(/^https:\/\/www\.usda\.gov\/topics\/urban/);
  });

  it('returns empty string for unsafe URLs (defence-in-depth)', async () => {
    const { sanitizeFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    expect(sanitizeFundingUrl('http://example.com')).toBe('');
    expect(sanitizeFundingUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeFundingUrl('https://pornhub.com/abc')).toBe('');
  });
});

// ─── Lockdown — every shipped source must pass ───────────────────
describe('fundingLinkSafety — every shipped funding URL is verified', () => {
  it('every URL in src/config/fundingConfig.js passes classifyFundingUrl', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    const src = read('src/config/fundingConfig.js');
    const urls = src.match(/'(https?:\/\/[^']+|mailto:[^']+)'/g) || [];
    expect(urls.length).toBeGreaterThan(10); // 18 today; sanity
    const blocked = [];
    for (const m of urls) {
      const url = m.slice(1, -1);
      const r = classifyFundingUrl(url);
      if (!r.ok) blocked.push({ url, reason: r.reason });
    }
    expect(blocked).toEqual([]);   // ZERO unsafe URLs in shipped data.
  });

  it('every URL in src/funding/sampleOpportunities.js passes', async () => {
    const { classifyFundingUrl } =
      await import('../../../src/security/validateFundingUrl.js');
    const src = read('src/funding/sampleOpportunities.js');
    const urls = src.match(/'(https?:\/\/[^']+|mailto:[^']+)'/g) || [];
    const blocked = [];
    for (const m of urls) {
      const url = m.slice(1, -1);
      const r = classifyFundingUrl(url);
      if (!r.ok) blocked.push({ url, reason: r.reason });
    }
    expect(blocked).toEqual([]);
  });
});

// ─── Render-time guard — FundingCard wires the classifier ────────
describe('FundingCard — wires the runtime guard', () => {
  it('imports classifyFundingUrl and gates externalUrl render', () => {
    const src = read('src/components/funding/FundingCard.jsx');
    expect(src.includes("from '../../security/validateFundingUrl.js'")).toBe(true);
    expect(src.includes('classifyFundingUrl(card.externalUrl)')).toBe(true);
    expect(src.includes('unsafe_funding_link_blocked')).toBe(true);
    expect(src.includes('verificationPending')).toBe(true);
  });

  it('FundingOpportunityDetail.handleApplyNow calls the classifier before window.open', () => {
    const src = read('src/pages/FundingOpportunityDetail.jsx');
    expect(src.includes("from '../security/validateFundingUrl.js'")).toBe(true);
    expect(src.includes('classifyFundingUrl(o.sourceUrl)')).toBe(true);
    expect(src.includes('unsafe_funding_link_blocked')).toBe(true);
  });
});
