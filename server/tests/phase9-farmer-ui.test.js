/**
 * Phase 9 Integration Test — Farmer-facing UI backend endpoints
 * Validates activities, reminders, notifications APIs work end-to-end
 */
import { describe, it, before, after } from 'node:test';
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

describe('Phase 9 — Farmer-facing UI endpoints', () => {
  before(async () => {
    // Login
    const r = await api('POST', '/auth/login', { email: 'admin@farroway.com', password: 'password123' });
    assert.equal(r.status, 200, `Login failed: ${JSON.stringify(r.data)}`);
    token = r.data.accessToken || r.data.token;

    // Get or create a farmer
    const farmers = await api('GET', '/farmers?limit=1');
    if (farmers.data?.farmers?.length > 0) {
      farmerId = farmers.data.farmers[0].id;
    } else {
      const f = await api('POST', '/farmers', { fullName: 'Phase9 Test Farmer', phone: '+254700900900', region: 'Nakuru', countryCode: 'KE' });
      assert.equal(f.status, 201);
      farmerId = f.data.id;
    }
    assert.ok(farmerId, 'farmerId must exist');
  });

  // ── Activities ──
  it('POST /activities/farmer/:id — log planting activity', async () => {
    const r = await api('POST', `/activities/farmer/${farmerId}`, {
      activityType: 'planting',
      cropType: 'maize',
      description: 'Planted 2 acres of maize',
      activityDate: '2026-03-20',
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.activityType, 'planting');
    assert.equal(r.data.cropType, 'maize');
  });

  it('POST /activities/farmer/:id — log harvesting activity', async () => {
    const r = await api('POST', `/activities/farmer/${farmerId}`, {
      activityType: 'harvesting',
      cropType: 'maize',
      quantity: 500,
      activityDate: '2026-04-01',
    });
    assert.equal(r.status, 201, `Harvesting failed: ${JSON.stringify(r.data)}`);
    assert.ok(r.data.id, 'Activity should be created');
  });

  it('GET /activities/farmer/:id — list activities', async () => {
    const r = await api('GET', `/activities/farmer/${farmerId}`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
    assert.ok(r.data.length >= 2);
  });

  it('GET /activities/farmer/:id?type=planting — filter by type', async () => {
    const r = await api('GET', `/activities/farmer/${farmerId}?type=planting`);
    assert.equal(r.status, 200);
    assert.ok(r.data.every(a => a.activityType === 'planting'));
  });

  it('GET /activities/farmer/:id/summary — activity summary', async () => {
    const r = await api('GET', `/activities/farmer/${farmerId}/summary`);
    assert.equal(r.status, 200);
    assert.ok(r.data.byType !== undefined);
    assert.ok(typeof r.data.thisMonthCount === 'number');
  });

  // ── Reminders ──
  it('POST /reminders/farmer/:id — create custom reminder', async () => {
    const r = await api('POST', `/reminders/farmer/${farmerId}`, {
      title: 'Test reminder',
      message: 'Check soil moisture levels',
      dueDate: '2026-04-10',
      reminderType: 'custom',
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.title, 'Test reminder');
    assert.equal(r.data.completed, false);
  });

  it('POST /reminders/farmer/:id/generate — generate crop lifecycle reminders', async () => {
    const r = await api('POST', `/reminders/farmer/${farmerId}/generate`, {
      cropType: 'maize',
      plantingDate: '2026-03-15',
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.ok(r.data.generated > 0, 'Should generate at least 1 reminder');
  });

  it('GET /reminders/farmer/:id — list reminders', async () => {
    const r = await api('GET', `/reminders/farmer/${farmerId}`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
    assert.ok(r.data.length >= 2);
  });

  it('GET /reminders/farmer/:id?status=pending — filter pending', async () => {
    const r = await api('GET', `/reminders/farmer/${farmerId}?status=pending`);
    assert.equal(r.status, 200);
    assert.ok(r.data.every(rem => !rem.completed));
  });

  let reminderId;
  it('PATCH /reminders/:id/done — mark reminder done', async () => {
    const list = await api('GET', `/reminders/farmer/${farmerId}?status=pending`);
    reminderId = list.data[0]?.id;
    assert.ok(reminderId, 'Need a pending reminder');
    const r = await api('PATCH', `/reminders/${reminderId}/done`);
    assert.equal(r.status, 200);
    assert.equal(r.data.completed, true);
  });

  it('GET /reminders/farmer/:id/summary — reminder summary', async () => {
    const r = await api('GET', `/reminders/farmer/${farmerId}/summary`);
    assert.equal(r.status, 200);
    assert.ok(typeof r.data.pending === 'number');
    assert.ok(typeof r.data.overdue === 'number');
    assert.ok(typeof r.data.completedThisMonth === 'number');
  });

  // ── Notifications ──
  it('GET /notifications/farmer/:id — list notifications', async () => {
    const r = await api('GET', `/notifications/farmer/${farmerId}`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
  });

  it('GET /notifications/farmer/:id/unread-count — unread count', async () => {
    const r = await api('GET', `/notifications/farmer/${farmerId}/unread-count`);
    assert.equal(r.status, 200);
    assert.ok(typeof r.data.unread === 'number');
  });

  it('POST /notifications/farmer/:id/mark-all-read — mark all read', async () => {
    const r = await api('POST', `/notifications/farmer/${farmerId}/mark-all-read`);
    assert.equal(r.status, 200);
    assert.ok(typeof r.data.updated === 'number');
    // Verify all marked read
    const count = await api('GET', `/notifications/farmer/${farmerId}/unread-count`);
    assert.equal(count.data.unread, 0);
  });
});
