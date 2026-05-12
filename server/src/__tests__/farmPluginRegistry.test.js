/**
 * farmPluginRegistry.test.js — pins the §10 plugin contract:
 *   1. registerPlugin validates manifest shape.
 *   2. Duplicate names rejected.
 *   3. getProvider returns first-registered plugin for capability.
 *   4. initializePlugins runs init() under isolation; failures mark
 *      INIT_FAILED but never throw.
 *   5. Auto-wired event subscriptions: handler fires on bus publish.
 *   6. Throwing plugin handlers don't crash the bus.
 *   7. teardownPlugins unsubscribes + calls teardown().
 *   8. pluginDiagnostics surfaces per-plugin state + error counts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as registry from '../../../src/lib/farmPluginRegistry.js';
import * as bus      from '../../../src/lib/farmEventBus.js';
import * as tel      from '../../../src/lib/farmTelemetry.js';

beforeEach(() => {
  registry._resetRegistry();
  bus._resetBus();
  tel._resetTelemetry();
});

describe('registerPlugin — validation', () => {
  it('rejects missing manifest', () => {
    expect(registry.registerPlugin(null).ok).toBe(false);
    expect(registry.registerPlugin({}).ok).toBe(false);
  });

  it('rejects missing name or version', () => {
    expect(registry.registerPlugin({ name: 'x' }).reason).toBe('version_required');
    expect(registry.registerPlugin({ version: '1.0' }).reason).toBe('name_required');
  });

  it('rejects bad init / teardown / subscribes / provides shape', () => {
    expect(registry.registerPlugin({ name: 'x', version: '1', init: 'not a fn' }).reason).toBe('init_not_function');
    expect(registry.registerPlugin({ name: 'x', version: '1', teardown: 42 }).reason).toBe('teardown_not_function');
    expect(registry.registerPlugin({ name: 'x', version: '1', subscribes: 'no' }).reason).toBe('subscribes_not_object');
    expect(registry.registerPlugin({ name: 'x', version: '1', provides: 'no' }).reason).toBe('provides_not_array');
  });

  it('rejects duplicate name', () => {
    registry.registerPlugin({ name: 'x', version: '1' });
    expect(registry.registerPlugin({ name: 'x', version: '2' }).reason).toBe('duplicate_name');
  });

  it('accepts a minimal valid manifest', () => {
    expect(registry.registerPlugin({ name: 'x', version: '1' }).ok).toBe(true);
    expect(registry.getPlugin('x').state).toBe(registry.PLUGIN_STATE.REGISTERED);
  });
});

describe('getProvider — capability lookup', () => {
  it('returns null when no plugin claims the capability', () => {
    expect(registry.getProvider('satellite_snapshot')).toBeNull();
  });

  it('returns the first plugin that claimed the capability', () => {
    registry.registerPlugin({ name: 'sat_a', version: '1', provides: ['satellite_snapshot'] });
    registry.registerPlugin({ name: 'sat_b', version: '1', provides: ['satellite_snapshot'] });
    expect(registry.getProvider('satellite_snapshot').name).toBe('sat_a');
  });
});

describe('initializePlugins — init lifecycle', () => {
  it('runs init() and marks plugin ACTIVE on success', async () => {
    const initFn = vi.fn(async () => undefined);
    registry.registerPlugin({ name: 'x', version: '1', init: initFn });
    const result = await registry.initializePlugins();
    expect(initFn).toHaveBeenCalledTimes(1);
    expect(result.ok).toContain('x');
    expect(registry.getPlugin('x').state).toBe(registry.PLUGIN_STATE.ACTIVE);
  });

  it('marks plugin INIT_FAILED on throw without crashing', async () => {
    registry.registerPlugin({
      name: 'flaky',
      version: '1',
      init: async () => { throw new Error('init_boom'); },
    });
    const result = await registry.initializePlugins();
    expect(result.failed.find((f) => f.name === 'flaky')).toBeDefined();
    expect(registry.getPlugin('flaky').state).toBe(registry.PLUGIN_STATE.INIT_FAILED);
  });

  it('is safe to call twice (already-active plugins are skipped)', async () => {
    const initFn = vi.fn(async () => undefined);
    registry.registerPlugin({ name: 'x', version: '1', init: initFn });
    await registry.initializePlugins();
    await registry.initializePlugins();
    expect(initFn).toHaveBeenCalledTimes(1);
  });
});

describe('initializePlugins — auto-wired event subscriptions', () => {
  it('subscribes declared handlers when init succeeds', async () => {
    const handler = vi.fn();
    registry.registerPlugin({
      name: 'observer',
      version: '1',
      subscribes: { [bus.FarmEvents.SCAN_COMPLETED]: handler },
    });
    await registry.initializePlugins();
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, { scanId: 's1' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('isolates a throwing handler so the bus stays healthy', async () => {
    const okHandler = vi.fn();
    registry.registerPlugin({
      name: 'flaky_listener',
      version: '1',
      subscribes: { [bus.FarmEvents.SCAN_COMPLETED]: () => { throw new Error('handler_boom'); } },
    });
    await registry.initializePlugins();
    // A second NORMAL subscriber should still get the event.
    bus.subscribe(bus.FarmEvents.SCAN_COMPLETED, okHandler);
    expect(() => bus.publish(bus.FarmEvents.SCAN_COMPLETED, {})).not.toThrow();
    expect(okHandler).toHaveBeenCalledTimes(1);
    // Plugin records the error.
    const status = registry.getPlugin('flaky_listener');
    expect(status.errors.length).toBeGreaterThan(0);
  });

  it('records an unknown event name as an error rather than crashing', async () => {
    registry.registerPlugin({
      name: 'misnamed',
      version: '1',
      subscribes: { 'totally.fake': () => {} },
    });
    await registry.initializePlugins();
    const p = registry.getPlugin('misnamed');
    expect(p.errors.some((e) => e.message.includes('unknown_event'))).toBe(true);
  });
});

describe('teardownPlugins', () => {
  it('runs teardown() and unsubscribes handlers', async () => {
    const teardownFn = vi.fn(async () => undefined);
    const handler = vi.fn();
    registry.registerPlugin({
      name: 'x',
      version: '1',
      subscribes: { [bus.FarmEvents.SCAN_COMPLETED]: handler },
      teardown: teardownFn,
    });
    await registry.initializePlugins();
    await registry.teardownPlugins();
    expect(teardownFn).toHaveBeenCalledTimes(1);
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, {});
    expect(handler).not.toHaveBeenCalled();
    expect(registry.getPlugin('x').state).toBe(registry.PLUGIN_STATE.TORN_DOWN);
  });
});

describe('pluginDiagnostics', () => {
  it('reports state + provides + error counts per plugin', async () => {
    registry.registerPlugin({ name: 'a', version: '1', provides: ['cap_a'] });
    registry.registerPlugin({ name: 'b', version: '1', provides: ['cap_b'] });
    const d = registry.pluginDiagnostics();
    expect(d.count).toBe(2);
    expect(d.providers).toEqual({ cap_a: 'a', cap_b: 'b' });
    expect(d.plugins.find((p) => p.name === 'a').state).toBe(registry.PLUGIN_STATE.REGISTERED);
  });
});

describe('demonstration: a real-shape plugin', () => {
  it('a "telemetry observer" plugin counts all events it subscribes to', async () => {
    let scanCount = 0;
    registry.registerPlugin({
      name:    'demo_telemetry_observer',
      version: '0.1.0',
      provides: ['event_count'],
      subscribes: {
        [bus.FarmEvents.SCAN_COMPLETED]: () => { scanCount += 1; },
      },
      init: async () => undefined,
    });
    await registry.initializePlugins();
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, { scanId: '1' });
    bus.publish(bus.FarmEvents.SCAN_COMPLETED, { scanId: '2' });
    expect(scanCount).toBe(2);
    expect(registry.getProvider('event_count').name).toBe('demo_telemetry_observer');
  });
});
