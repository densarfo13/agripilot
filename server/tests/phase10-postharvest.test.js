/**
 * Phase 10 Integration Test — Post-harvest UI backend endpoints
 * Validates storage status, storage guidance, market guidance, buyer interest APIs
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:4000/api';
let token, farmerId;

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

describe('Phase 10 — Post-harvest endpoints', () => {
  before(async () => {
    const r = await api('POST', '/auth/login', { email: 'admin@agripilot.com', password: 'password123' });
    assert.equal(r.status, 200);
    token = r.data.accessToken || r.data.token;
    const farmers = await api('GET', '/farmers?limit=1');
    farmerId = farmers.data?.farmers?.[0]?.id;
    assert.ok(farmerId);
  });

  // ── Storage Status ──
  it('POST /post-harvest/storage/farmer/:id — upsert storage status', async () => {
    const r = await api('POST', `/post-harvest/storage/farmer/${farmerId}`, {
      cropType: 'maize',
      quantityKg: 1200,
      harvestDate: '2026-03-10',
      storageMethod: 'hermetic_bag',
      storageCondition: 'good',
      readyToSell: false,
      notes: 'Stored in PICS bags',
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.cropType, 'maize');
    assert.equal(r.data.quantityKg, 1200);
    assert.equal(r.data.storageMethod, 'hermetic_bag');
  });

  it('POST /post-harvest/storage/farmer/:id — update same crop (upsert)', async () => {
    const r = await api('POST', `/post-harvest/storage/farmer/${farmerId}`, {
      cropType: 'maize',
      quantityKg: 1000,
      storageCondition: 'fair',
      readyToSell: true,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.quantityKg, 1000);
    assert.equal(r.data.storageCondition, 'fair');
    assert.equal(r.data.readyToSell, true);
  });

  it('POST /post-harvest/storage/farmer/:id — add second crop', async () => {
    const r = await api('POST', `/post-harvest/storage/farmer/${farmerId}`, {
      cropType: 'coffee',
      quantityKg: 300,
      harvestDate: '2026-02-20',
      storageMethod: 'warehouse',
      storageCondition: 'good',
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.cropType, 'coffee');
  });

  it('GET /post-harvest/storage/farmer/:id — list storage items', async () => {
    const r = await api('GET', `/post-harvest/storage/farmer/${farmerId}`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
    assert.ok(r.data.length >= 2, 'Should have at least 2 items');
  });

  it('GET /post-harvest/storage/farmer/:id/dashboard — storage dashboard', async () => {
    const r = await api('GET', `/post-harvest/storage/farmer/${farmerId}/dashboard`);
    assert.equal(r.status, 200);
    assert.ok(r.data.totalItems >= 2);
    assert.ok(r.data.totalQuantityKg >= 1000);
    assert.ok(r.data.readyToSell >= 1);
    assert.ok(r.data.items);
    assert.ok(r.data.conditionBreakdown);
    // Check enriched fields
    const maize = r.data.items.find(i => i.cropType === 'maize');
    assert.ok(maize, 'Should have maize');
    assert.ok(typeof maize.daysSinceHarvest === 'number' || maize.daysSinceHarvest === null);
    assert.ok(typeof maize.maxRecommendedDays === 'number');
  });

  // ── Storage Guidance ──
  it('GET /post-harvest/guidance/maize — storage guidance', async () => {
    const r = await api('GET', '/post-harvest/guidance/maize');
    assert.equal(r.status, 200);
    assert.ok(r.data.tips?.length > 0);
    assert.ok(r.data.risks?.length > 0);
    assert.ok(r.data.maxDays);
    assert.ok(r.data.optimalMoisture);
  });

  it('GET /post-harvest/guidance/coffee?country=TZ — TZ guidance', async () => {
    const r = await api('GET', '/post-harvest/guidance/coffee?country=TZ');
    assert.equal(r.status, 200);
    assert.equal(r.data.country, 'Tanzania');
  });

  // ── Market Guidance ──
  it('GET /market-guidance/prices — all crop prices', async () => {
    const r = await api('GET', '/market-guidance/prices?country=KE');
    assert.equal(r.status, 200);
    assert.ok(r.data.crops || Array.isArray(r.data));
  });

  it('GET /market-guidance/prices/maize — specific crop price', async () => {
    const r = await api('GET', '/market-guidance/prices/maize?country=KE');
    assert.equal(r.status, 200);
    assert.ok(r.data.crop || r.data.minPrice !== undefined);
  });

  it('GET /market-guidance/buyer-types — buyer types', async () => {
    const r = await api('GET', '/market-guidance/buyer-types?country=KE');
    assert.equal(r.status, 200);
    assert.ok(r.data.buyerTypes || Array.isArray(r.data));
  });

  it('GET /market-guidance/selling-tips/maize — selling tips', async () => {
    const r = await api('GET', '/market-guidance/selling-tips/maize?country=KE');
    assert.equal(r.status, 200);
    // Response may be { tips: [...] } or a plain array
    const tips = r.data.tips || r.data;
    assert.ok(Array.isArray(tips) && tips.length > 0, 'Should have selling tips');
  });

  // ── Buyer Interest ──
  it('POST /buyer-interest/farmer/:id — express interest', async () => {
    const r = await api('POST', `/buyer-interest/farmer/${farmerId}`, {
      cropType: 'maize',
      quantityKg: 800,
      preferredBuyerType: 'cooperative',
      priceExpectation: 35,
      notes: 'Bulk sale preferred',
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.cropType, 'maize');
    assert.equal(r.data.status, 'expressed');
  });

  it('GET /buyer-interest/farmer/:id — list interests', async () => {
    const r = await api('GET', `/buyer-interest/farmer/${farmerId}`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
    const active = r.data.find(i => i.cropType === 'maize' && i.status === 'expressed');
    assert.ok(active, 'Should have active maize interest');
  });

  let interestId;
  it('PATCH /buyer-interest/:id/withdraw — withdraw interest', async () => {
    const list = await api('GET', `/buyer-interest/farmer/${farmerId}`);
    interestId = list.data.find(i => i.status === 'expressed')?.id;
    assert.ok(interestId);
    const r = await api('PATCH', `/buyer-interest/${interestId}/withdraw`);
    assert.equal(r.status, 200);
    assert.equal(r.data.status, 'withdrawn');
  });

  it('GET /buyer-interest/demand/summary — demand summary', async () => {
    const r = await api('GET', '/buyer-interest/demand/summary?cropType=maize');
    assert.equal(r.status, 200);
    assert.ok(typeof r.data.totalInterests === 'number');
    assert.ok(typeof r.data.totalQuantityKg === 'number');
  });
});
