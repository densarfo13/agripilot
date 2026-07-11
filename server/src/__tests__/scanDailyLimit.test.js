import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkDailyScanLimit, resolveScanPlan, _internal } from '../ml/scanLimitGuard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => fs.readFileSync(path.resolve(ROOT, rel), 'utf-8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const mockPrisma = (used) => ({ scanTrainingEvent: { count: async () => used } });
const ENV_KEYS = [
  'SCAN_GUEST_DAILY_LIMIT', 'SCAN_FREE_DAILY_LIMIT', 'SCAN_PILOT_DAILY_LIMIT',
  'SCAN_PREMIUM_DAILY_LIMIT', 'SCAN_ADMIN_DAILY_LIMIT',
  'SCAN_PILOT_USER_IDS', 'SCAN_PREMIUM_USER_IDS',
];

// Plan is resolved from the EXISTING user model (role + premium/pilot signal)
// + operator allowlists — no new entitlement system, no hardcoded ids.
describe('resolveScanPlan — from the existing user model', () => {
  afterEach(() => ENV_KEYS.forEach((k) => delete process.env[k]));

  it('no user → guest', () => expect(resolveScanPlan(null)).toBe('guest'));
  it('super_admin / admin role → admin', () => {
    expect(resolveScanPlan({ id: 'a', role: 'super_admin' })).toBe('admin');
    expect(resolveScanPlan({ id: 'a', role: 'admin' })).toBe('admin');
  });
  it('premium signal → premium', () => {
    expect(resolveScanPlan({ id: 'a', role: 'farmer', isPremium: true })).toBe('premium');
    expect(resolveScanPlan({ id: 'a', role: 'farmer', plan: 'premium' })).toBe('premium');
  });
  it('pilot signal → pilot', () => {
    expect(resolveScanPlan({ id: 'a', role: 'farmer', plan: 'pilot' })).toBe('pilot');
    expect(resolveScanPlan({ id: 'a', role: 'farmer', isPilot: true })).toBe('pilot');
  });
  it('plain farmer → free (conservative default)', () =>
    expect(resolveScanPlan({ id: 'a', role: 'farmer' })).toBe('free'));
  it('operator allowlist opts a tester into pilot via config, not code', () => {
    process.env.SCAN_PILOT_USER_IDS = 'x, testUser ,y';
    expect(resolveScanPlan({ id: 'testUser', role: 'farmer' })).toBe('pilot');
  });
});

describe('checkDailyScanLimit — plan-aware quota + accurate metadata', () => {
  afterEach(() => ENV_KEYS.forEach((k) => delete process.env[k]));
  const call = (user, used) => checkDailyScanLimit({ prisma: mockPrisma(used), user });

  it('free farmer → 3/day', async () => {
    const q = await call({ id: 'u', role: 'farmer' }, 0);
    expect(q.plan).toBe('free'); expect(q.limit).toBe(3); expect(q.ok).toBe(true);
  });
  it('pilot farmer → 50/day', async () => {
    const q = await call({ id: 'u', role: 'farmer', plan: 'pilot' }, 10);
    expect(q.plan).toBe('pilot'); expect(q.limit).toBe(50); expect(q.remaining).toBe(40);
  });
  it('premium farmer → 100/day', async () => {
    const q = await call({ id: 'u', role: 'farmer', isPremium: true }, 0);
    expect(q.plan).toBe('premium'); expect(q.limit).toBe(100);
  });
  it('admin / test account → 200/day', async () => {
    const q = await call({ id: 'u', role: 'super_admin' }, 0);
    expect(q.plan).toBe('admin'); expect(q.limit).toBe(200);
  });
  it('guest → 1/day metadata (anon gated by the IP limiter, not blocked here)', async () => {
    const q = await checkDailyScanLimit({ prisma: mockPrisma(5), user: null });
    expect(q.plan).toBe('guest'); expect(q.limit).toBe(1); expect(q.ok).toBe(true);
  });
  it('blocks with full metadata { limit, used, remaining, resetsAt, plan } at quota', async () => {
    const q = await call({ id: 'u', role: 'farmer' }, 3);
    expect(q.ok).toBe(false);
    expect(q).toMatchObject({ limit: 3, used: 3, remaining: 0, plan: 'free' });
    expect(typeof q.resetsAt).toBe('string');
  });
  it('resetsAt is end-of-UTC-day', async () => {
    const now = new Date('2026-07-10T14:30:00Z');
    const q = await checkDailyScanLimit({ prisma: mockPrisma(0), user: { id: 'u', role: 'farmer' }, now });
    expect(q.resetsAt).toBe('2026-07-10T23:59:59.999Z');
  });
  it('env overrides a plan limit', async () => {
    process.env.SCAN_PILOT_DAILY_LIMIT = '80';
    const q = await call({ id: 'u', role: 'farmer', plan: 'pilot' }, 0);
    expect(q.limit).toBe(80);
  });
  it('_internal keeps the spec defaults', () => {
    expect(_internal.PLAN_DEFAULTS.free.dflt).toBe(3);
    expect(_internal.PLAN_DEFAULTS.pilot.dflt).toBe(50);
    expect(_internal.PLAN_DEFAULTS.premium.dflt).toBe(100);
    expect(_internal.PLAN_DEFAULTS.admin.dflt).toBe(200);
    expect(_internal.PLAN_DEFAULTS.guest.dflt).toBe(1);
  });
});

// A quota block must not reach a provider, and must never render as a scan
// result (P5/P6, spec §6/§7).
describe('quota-block wiring — no provider call, no result loss, no low-conf UI', () => {
  it('server 429s BEFORE preprocess/provider and no longer embeds a fallback verdict', () => {
    const app = read('server/src/app.js');
    const gi = app.indexOf("error:     'scan_limit_reached'");
    expect(gi).toBeGreaterThan(-1);
    const block = app.slice(gi, gi + 400);
    expect(block).not.toContain('SPEC_FALLBACK_VERDICT');
    expect(block).not.toContain('verdictV2');
    // guard call precedes the preprocess call
    const guardIdx = app.indexOf('checkDailyScanLimit({ prisma, user: req.user })');
    const preIdx = app.indexOf('await preprocessImage(');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(preIdx).toBeGreaterThan(guardIdx);
  });
  it('client preserves the 429 reason (no null → rule fallback)', () => {
    const code = read('src/services/scanApiService.js');
    expect(code).toContain('scanLimitReached');
    expect(code).toMatch(/status === 429/);
  });
  it('ScanPage renders a distinct card and guards BOTH result branches', () => {
    const code = read('src/pages/ScanPage.jsx');
    expect(code).toContain('ScanLimitReachedCard');
    expect(code).toMatch(/!result\.scanLimitReached && shouldRenderIntelligentResult/);
    expect(code).toMatch(/!result\.scanLimitReached && !shouldRenderIntelligentResult/);
  });
  it('the limit card renders only limit copy — no diagnosis/health/confidence fields', () => {
    const code = stripComments(read('src/components/scan/ScanLimitReachedCard.jsx'));
    expect(code).toContain('Daily scan limit reached');
    expect(code).toContain('You have used all scans available today.');
    expect(code).not.toMatch(/plantName|confidencePct|healthAssessment|cropHealth|diagnos/i);
  });
});
