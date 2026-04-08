/**
 * Phase 11 Integration Test — Admin Control Center backend endpoints
 * Validates region config, localization, demand intelligence, application stats
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:4000/api';
let token;

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

describe('Phase 11 — Admin Control Center endpoints', () => {
  before(async () => {
    const r = await api('POST', '/auth/login', { email: 'admin@farroway.com', password: 'password123' });
    assert.equal(r.status, 200);
    token = r.data.accessToken || r.data.token;
  });

  // ── Application stats ──
  it('GET /applications/stats — returns status counts and aggregates', async () => {
    const r = await api('GET', '/applications/stats');
    assert.equal(r.status, 200);
    assert.ok(r.data.statusCounts, 'Should have statusCounts');
    assert.ok(r.data.aggregates, 'Should have aggregates');
    assert.ok(Array.isArray(r.data.statusCounts));
  });

  // ── Region config ──
  it('GET /region-config/ — list all region configs', async () => {
    const r = await api('GET', '/region-config/');
    assert.equal(r.status, 200);
    assert.ok(r.data.KE || Array.isArray(r.data));
  });

  it('GET /region-config/KE — Kenya config', async () => {
    const r = await api('GET', '/region-config/KE');
    assert.equal(r.status, 200);
    assert.equal(r.data.currencyCode, 'KES');
    assert.ok(r.data.languages);
    assert.ok(r.data.seasons);
  });

  it('GET /region-config/TZ — Tanzania config', async () => {
    const r = await api('GET', '/region-config/TZ');
    assert.equal(r.status, 200);
    assert.equal(r.data.currencyCode, 'TZS');
  });

  it('GET /region-config/KE/season — current season', async () => {
    const r = await api('GET', '/region-config/KE/season');
    assert.equal(r.status, 200);
    assert.ok(r.data.season || r.data.name, 'Should have season info');
  });

  it('GET /region-config/KE/crops — Kenya crops', async () => {
    const r = await api('GET', '/region-config/KE/crops');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
    assert.ok(r.data.length > 0);
  });

  it('GET /region-config/KE/regions — Kenya regions', async () => {
    const r = await api('GET', '/region-config/KE/regions');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
    assert.ok(r.data.length > 0);
  });

  it('GET /region-config/KE/crop/maize — crop calendar', async () => {
    const r = await api('GET', '/region-config/KE/crop/maize');
    assert.equal(r.status, 200);
    assert.ok(r.data.plantingMonths || r.data.growingDays || r.data.plant);
  });

  it('GET /region-config/KE/storage/maize — storage defaults', async () => {
    const r = await api('GET', '/region-config/KE/storage/maize');
    assert.equal(r.status, 200);
    assert.ok(r.data.maxDays);
    assert.ok(r.data.method);
  });

  // ── Localization ──
  it('GET /localization/languages — supported languages', async () => {
    const r = await fetch(`${BASE}/localization/languages`).then(res => ({ status: res.status, data: res.json() }));
    const data = await r.data;
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 2, 'Should have at least en + sw');
    assert.ok(data.find(l => l.code === 'en'));
    assert.ok(data.find(l => l.code === 'sw'));
  });

  it('GET /localization/translations/en — English translations', async () => {
    const r = await fetch(`${BASE}/localization/translations/en`).then(async res => ({ status: res.status, data: await res.json() }));
    assert.equal(r.status, 200);
    assert.ok(Object.keys(r.data).length >= 50, `Should have 50+ keys, got ${Object.keys(r.data).length}`);
    assert.ok(r.data['app.name'], 'Should have app.name');
  });

  it('GET /localization/translations/sw — Swahili translations', async () => {
    const r = await fetch(`${BASE}/localization/translations/sw`).then(async res => ({ status: res.status, data: await res.json() }));
    assert.equal(r.status, 200);
    assert.ok(Object.keys(r.data).length >= 50);
  });

  // ── Demand intelligence ──
  it('GET /buyer-interest/demand/summary — overall demand', async () => {
    const r = await api('GET', '/buyer-interest/demand/summary');
    assert.equal(r.status, 200);
    assert.ok(typeof r.data.totalInterests === 'number');
    assert.ok(typeof r.data.totalQuantityKg === 'number');
  });

  it('GET /buyer-interest/demand/summary?country=KE — Kenya demand', async () => {
    const r = await api('GET', '/buyer-interest/demand/summary?country=KE');
    assert.equal(r.status, 200);
    assert.ok(r.data.byRegion !== undefined);
  });

  // ── Portfolio ──
  it('GET /portfolio/summary — portfolio data', async () => {
    const r = await api('GET', '/portfolio/summary');
    assert.equal(r.status, 200);
    assert.ok(typeof r.data.totalApplications === 'number');
    assert.ok(r.data.statusBreakdown);
    assert.ok(r.data.cropBreakdown);
  });
});
