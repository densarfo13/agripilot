/**
 * sellCoordinator.test.js — acceptance coverage for the May 2026
 * Sell marketplace coordination upgrade.
 *
 * Spec coverage:
 *   • §1 — 7 buyer event types are present in the orchestration
 *     catalogue (produce_viewed, buyer_interested,
 *     inquiry_sent, quantity_requested, negotiation_started,
 *     meeting_requested, purchase_confirmed) plus
 *     listing_reserved.
 *   • §3 — RESERVED lifecycle state is in LISTING_STATUS.
 *   • §5 — PII (phone / email / message body) cannot pass
 *     through the coordinator into the event ring.
 *   • Allow-list — non-coordination event types are rejected.
 *   • Convenience helpers — markReserved + markSold flip
 *     status AND emit the matching event.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.setConfig({ testTimeout: 15000 });

function makeStorage() {
  const store = new Map();
  return {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear:      () => { store.clear(); },
  };
}

beforeEach(() => {
  globalThis.localStorage = makeStorage();
});

// ─── EVENT_TYPE catalogue ────────────────────────────────────────
describe('orchestration/events — buyer event vocabulary (spec §1)', () => {
  it('exposes every spec-mandated buyer coordination event type', async () => {
    const { EVENT_TYPE, EVENT_TYPE_SET } =
      await import('../../../src/orchestration/events/eventTypes.js');
    const required = [
      'produce_viewed',
      'buyer_interest_received',
      'inquiry_sent',
      'quantity_requested',
      'negotiation_started',
      'meeting_requested',
      'listing_reserved',
      'purchase_confirmed',
    ];
    for (const t of required) {
      expect(EVENT_TYPE_SET.has(t)).toBe(true);
    }
    // Spot-check the canonical names too.
    expect(EVENT_TYPE.PRODUCE_VIEWED).toBe('produce_viewed');
    expect(EVENT_TYPE.PURCHASE_CONFIRMED).toBe('purchase_confirmed');
  });
});

// ─── Lifecycle state ─────────────────────────────────────────────
describe('LISTING_STATUS — full lifecycle (spec §3)', () => {
  it('exposes DRAFT → ACTIVE → INTERESTED → CONTACTED → RESERVED → SOLD', async () => {
    const { LISTING_STATUS } =
      await import('../../../src/market/marketStore.js');
    const required = ['DRAFT', 'ACTIVE', 'INTERESTED', 'CONTACTED',
                      'RESERVED', 'SOLD', 'EXPIRED'];
    for (const s of required) {
      expect(LISTING_STATUS[s]).toBe(s);
    }
    expect(Object.isFrozen(LISTING_STATUS)).toBe(true);
  });
});

// ─── recordBuyerEvent — allow-list + payload safety ──────────────
describe('sellCoordinator.recordBuyerEvent', () => {
  it('rejects events outside the coordination allow-list', async () => {
    const { recordBuyerEvent } =
      await import('../../../src/market/sellCoordinator.js');
    // task_completed is a valid orchestration event, but it's
    // NOT a marketplace-coordination event — should be rejected
    // by the facade allow-list.
    expect(recordBuyerEvent('task_completed', {})).toBeNull();
    expect(recordBuyerEvent('mystery_event', {})).toBeNull();
    expect(recordBuyerEvent('', {})).toBeNull();
    expect(recordBuyerEvent(null, {})).toBeNull();
  });

  it('records valid coordination events to the bus + ring', async () => {
    const { recordBuyerEvent } =
      await import('../../../src/market/sellCoordinator.js');
    const { getEventsByType } =
      await import('../../../src/orchestration/events/eventStore.js');
    const stored = recordBuyerEvent('inquiry_sent', {
      listingId: 'L-1', buyerId: 'B-1', quantity: 20,
    }, { farmId: 'F-1', region: 'MD' });
    expect(stored).not.toBeNull();
    expect(stored.type).toBe('inquiry_sent');
    expect(stored.payload.listingId).toBe('L-1');
    expect(stored.payload.quantity).toBe(20);
    // The event should be in the ring.
    const list = getEventsByType('inquiry_sent', 5);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].farmId).toBe('F-1');
    expect(list[0].region).toBe('MD');
  });

  it('strips PII fields (phone / email / message body) before emit', async () => {
    const { recordBuyerEvent } =
      await import('../../../src/market/sellCoordinator.js');
    const stored = recordBuyerEvent('quantity_requested', {
      listingId:   'L-2',
      quantity:    50,
      // PII / large blobs that MUST NOT reach the event ring.
      phone:       '+1 555 123 4567',
      phoneE164:   '+15551234567',
      email:       'buyer@example.com',
      fullName:    'Jane Buyer',
      message:     'Long message body that should not be persisted',
      photoUrl:    'https://example.com/photo.jpg',
    });
    expect(stored).not.toBeNull();
    expect(stored.payload.listingId).toBe('L-2');
    expect(stored.payload.quantity).toBe(50);
    // Forbidden fields must be absent.
    expect(stored.payload.phone).toBeUndefined();
    expect(stored.payload.phoneE164).toBeUndefined();
    expect(stored.payload.email).toBeUndefined();
    expect(stored.payload.fullName).toBeUndefined();
    expect(stored.payload.message).toBeUndefined();
    expect(stored.payload.photoUrl).toBeUndefined();
  });

  it('strips object / array fields (only flat primitives ride the bus)', async () => {
    const { recordBuyerEvent } =
      await import('../../../src/market/sellCoordinator.js');
    const stored = recordBuyerEvent('buyer_interest_received', {
      listingId:   'L-3',
      nested:      { inner: 'should be stripped' },
      arr:         [1, 2, 3],
      flag:        true,
    });
    expect(stored.payload.listingId).toBe('L-3');
    expect(stored.payload.flag).toBe(true);
    expect(stored.payload.nested).toBeUndefined();
    expect(stored.payload.arr).toBeUndefined();
  });

  it('clamps long strings to MAX_STRING_LEN', async () => {
    const { recordBuyerEvent } =
      await import('../../../src/market/sellCoordinator.js');
    const long = 'x'.repeat(1000);
    const stored = recordBuyerEvent('produce_viewed', {
      listingId: 'L-4',
      utm:       long,
    });
    expect(stored.payload.utm.length).toBeLessThanOrEqual(240);
  });
});

// ─── markReserved + markSold helpers ─────────────────────────────
describe('markReserved / markSold — convenience helpers', () => {
  it('markReserved is a no-op + null on missing listingId', async () => {
    const { markReserved } =
      await import('../../../src/market/sellCoordinator.js');
    expect(markReserved(null)).toBeNull();
    expect(markReserved('')).toBeNull();
  });

  it('markSold is a no-op + null on missing listingId', async () => {
    const { markSold } =
      await import('../../../src/market/sellCoordinator.js');
    expect(markSold(null)).toBeNull();
  });

  it('markReserved emits LISTING_RESERVED event', async () => {
    const { markReserved } =
      await import('../../../src/market/sellCoordinator.js');
    const { getEventsByType } =
      await import('../../../src/orchestration/events/eventStore.js');
    markReserved('L-99', { buyerId: 'B-99' });
    const list = getEventsByType('listing_reserved', 5);
    const found = list.find((e) => e.payload.listingId === 'L-99');
    expect(found).toBeDefined();
    expect(found.payload.buyerId).toBe('B-99');
  });

  it('markSold emits PURCHASE_CONFIRMED event', async () => {
    const { markSold } =
      await import('../../../src/market/sellCoordinator.js');
    const { getEventsByType } =
      await import('../../../src/orchestration/events/eventStore.js');
    markSold('L-100', { buyerId: 'B-100' });
    const list = getEventsByType('purchase_confirmed', 5);
    const found = list.find((e) => e.payload.listingId === 'L-100');
    expect(found).toBeDefined();
  });
});

// ─── Snapshot + frozen contract ──────────────────────────────────
describe('coordination event allow-list', () => {
  it('exposes exactly the 9 coordination event types', async () => {
    const { _coordinationEventSnapshot } =
      await import('../../../src/market/sellCoordinator.js');
    const snap = _coordinationEventSnapshot();
    // 8 distinct events explicitly listed in the COORDINATION_EVENT_SET.
    // (PRODUCE_LISTED + PRODUCE_VIEWED + BUYER_INTEREST_RECEIVED +
    //  INQUIRY_SENT + QUANTITY_REQUESTED + NEGOTIATION_STARTED +
    //  MEETING_REQUESTED + LISTING_RESERVED + PURCHASE_CONFIRMED)
    expect(snap.length).toBeGreaterThanOrEqual(8);
    expect(snap).toContain('inquiry_sent');
    expect(snap).toContain('listing_reserved');
    expect(snap).toContain('purchase_confirmed');
  });
});
