/**
 * farmEventBus.test.js — pins the §1 + §11 bus contract:
 *   1. subscribe/publish round-trip works.
 *   2. Wildcard subscribers receive every event.
 *   3. Handler exceptions don't crash the publisher.
 *   4. Handler exceptions publish HANDLER_FAILED.
 *   5. unsubscribe is idempotent.
 *   6. Event log is bounded + read-only.
 *   7. Re-entrancy cap stops infinite loops.
 *   8. hasSubscriber + busDiagnostics behave correctly.
 *   9. Typed event constants exposed via FarmEvents.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as bus from '../../../src/lib/farmEventBus.js';

beforeEach(() => {
  bus._resetBus();
});

describe('FarmEventBus — basic pub/sub', () => {
  it('delivers a published event to its subscriber', () => {
    const fn = vi.fn();
    bus.subscribe(bus.FarmEvents.SCAN_COMPLETED, fn);
    const n = bus.publish(bus.FarmEvents.SCAN_COMPLETED, { scanId: 's1' });
    expect(n).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toEqual({ scanId: 's1' });
  });

  it('wildcard subscribers receive every event', () => {
    const fn = vi.fn();
    bus.subscribe('*', fn);
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, { a: 1 });
    bus.publish(bus.FarmEvents.WEATHER_UPDATED, { b: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('unsubscribe stops further deliveries (and is idempotent)', () => {
    const fn = vi.fn();
    const unsub = bus.subscribe(bus.FarmEvents.SCAN_COMPLETED, fn);
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, {});
    unsub();
    unsub();   // idempotent
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, {});
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('publish on an unknown event returns 0 and does not throw', () => {
    expect(() => bus.publish('totally.fake', {})).not.toThrow();
    expect(bus.publish('totally.fake', {})).toBe(0);
  });

  it('publish with non-string event returns 0', () => {
    expect(bus.publish(null, {})).toBe(0);
    expect(bus.publish(42, {})).toBe(0);
  });

  it('subscribe with non-function handler returns a no-op unsubscribe', () => {
    const unsub = bus.subscribe(bus.FarmEvents.SCAN_COMPLETED, 'not a function');
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });
});

describe('FarmEventBus — error isolation', () => {
  it('a throwing handler does not crash the publisher', () => {
    bus.subscribe(bus.FarmEvents.SCAN_COMPLETED, () => { throw new Error('boom'); });
    expect(() => bus.publish(bus.FarmEvents.SCAN_COMPLETED, {})).not.toThrow();
  });

  it('a throwing handler still delivers to other handlers', () => {
    const ok = vi.fn();
    bus.subscribe(bus.FarmEvents.SCAN_COMPLETED, () => { throw new Error('boom'); });
    bus.subscribe(bus.FarmEvents.SCAN_COMPLETED, ok);
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, {});
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('a throwing handler publishes HANDLER_FAILED', () => {
    const failureSpy = vi.fn();
    bus.subscribe(bus.FarmEvents.HANDLER_FAILED, failureSpy);
    bus.subscribe(bus.FarmEvents.SCAN_COMPLETED, () => { throw new Error('boom'); });
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, {});
    expect(failureSpy).toHaveBeenCalledTimes(1);
    const payload = failureSpy.mock.calls[0][0];
    expect(payload.event).toBe(bus.FarmEvents.SCAN_COMPLETED);
    expect(payload.error).toBe('boom');
  });
});

describe('FarmEventBus — re-entrancy + event log', () => {
  it('handler that publishes another event runs cleanly', () => {
    const inner = vi.fn();
    bus.subscribe(bus.FarmEvents.WEATHER_UPDATED, inner);
    bus.subscribe(bus.FarmEvents.SCAN_COMPLETED, () => {
      bus.publish(bus.FarmEvents.WEATHER_UPDATED, {});
    });
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, {});
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('breaks infinite re-entrancy with a depth cap', () => {
    let calls = 0;
    bus.subscribe(bus.FarmEvents.SCAN_COMPLETED, () => {
      calls += 1;
      bus.publish(bus.FarmEvents.SCAN_COMPLETED, {});
    });
    expect(() => bus.publish(bus.FarmEvents.SCAN_COMPLETED, {})).not.toThrow();
    expect(calls).toBeLessThan(50);  // cap = 16, so well under 50
  });

  it('event log records publishes (newest last)', () => {
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, { id: 'a' });
    bus.publish(bus.FarmEvents.WEATHER_UPDATED, { id: 'b' });
    const log = bus.getRecentEvents();
    expect(log).toHaveLength(2);
    expect(log[1].event).toBe(bus.FarmEvents.WEATHER_UPDATED);
  });

  it('event log truncates large string payloads', () => {
    const huge = 'x'.repeat(500);
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, { big: huge });
    const log = bus.getRecentEvents();
    expect(log[0].payload.big.length).toBeLessThanOrEqual(81);
  });

  it('getRecentEvents returns a defensive copy', () => {
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, { id: 'a' });
    const log = bus.getRecentEvents();
    log[0].event = 'mutated';
    const log2 = bus.getRecentEvents();
    expect(log2[0].event).toBe(bus.FarmEvents.SCAN_COMPLETED);
  });
});

describe('FarmEventBus — diagnostics', () => {
  it('hasSubscriber returns true only when there is one', () => {
    expect(bus.hasSubscriber(bus.FarmEvents.SCAN_COMPLETED)).toBe(false);
    const unsub = bus.subscribe(bus.FarmEvents.SCAN_COMPLETED, () => {});
    expect(bus.hasSubscriber(bus.FarmEvents.SCAN_COMPLETED)).toBe(true);
    unsub();
    expect(bus.hasSubscriber(bus.FarmEvents.SCAN_COMPLETED)).toBe(false);
  });

  it('hasSubscriber considers wildcards', () => {
    bus.subscribe('*', () => {});
    expect(bus.hasSubscriber(bus.FarmEvents.SCAN_COMPLETED)).toBe(true);
  });

  it('isKnownEvent recognises typed names', () => {
    expect(bus.isKnownEvent(bus.FarmEvents.SCAN_COMPLETED)).toBe(true);
    expect(bus.isKnownEvent('totally.fake')).toBe(false);
  });

  it('FarmEvents is frozen', () => {
    expect(Object.isFrozen(bus.FarmEvents)).toBe(true);
  });

  it('busDiagnostics reports counts', () => {
    bus.subscribe(bus.FarmEvents.SCAN_COMPLETED, () => {});
    bus.subscribe('*', () => {});
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, {});
    const d = bus.busDiagnostics();
    expect(d.handlers).toBe(1);
    expect(d.wildcardHandlers).toBe(1);
    expect(d.events).toBe(1);
    expect(d.knownEvents.length).toBeGreaterThan(0);
  });
});
