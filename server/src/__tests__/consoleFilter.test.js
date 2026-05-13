/**
 * consoleFilter.test.js — verifies the production-safe console
 * filter's _shouldSuppress logic directly.
 *
 * The wrapper itself (installConsoleFilter) short-circuits in
 * dev mode (vitest reports DEV=true), so we test the matcher
 * function in isolation. This is the correct unit of behaviour
 * under test — the spec is about which patterns are suppressed
 * vs allowed, not about the React/HMR install lifecycle.
 *
 *   • DENY list  → _shouldSuppress returns true (suppress).
 *   • ALLOW list → _shouldSuppress returns false (force-show).
 *   • Neither   → _shouldSuppress returns false (default pass).
 */

import { describe, it, expect } from 'vitest';
import { _shouldSuppress_test as shouldSuppress } from '../../../src/lib/consoleFilter.js';

describe('consoleFilter — DENY list', () => {
  it('suppresses chrome-extension:// noise', () => {
    expect(shouldSuppress(['chrome-extension://abc/content-script.js error'])).toBe(true);
  });

  it('suppresses tabs:outgoing.message.ready noise', () => {
    expect(shouldSuppress(['No Listener: tabs:outgoing.message.ready'])).toBe(true);
  });

  it('suppresses cornhusk SDK noise', () => {
    expect(shouldSuppress(['cornhusk: tab message handler'])).toBe(true);
  });

  it('suppresses shared-service noise', () => {
    expect(shouldSuppress(['shared-service init failed'])).toBe(true);
  });

  it('suppresses chrome.runtime.lastError leak', () => {
    expect(shouldSuppress(['Unchecked runtime.lastError: The message port closed.'])).toBe(true);
  });

  it('suppresses moz-extension:// (Firefox)', () => {
    expect(shouldSuppress(['moz-extension://addon/inject.js error'])).toBe(true);
  });

  it('suppresses the wrapped cornhusk pattern that appears in arg[1]', () => {
    // The filter scans ALL args (up to 6) — cornhusk SDK has been
    // observed putting its tag in the second arg.
    expect(shouldSuppress(['TypeError', 'shared-service module not loaded'])).toBe(true);
  });
});

describe('consoleFilter — ALLOW list (force-show)', () => {
  it('force-allows [FARROWAY_AUTH]', () => {
    expect(shouldSuppress(['[FARROWAY_AUTH] session expired'])).toBe(false);
  });

  it('force-allows [REFRESH_FAILED]', () => {
    expect(shouldSuppress(['[REFRESH_FAILED]', { status: 401 }])).toBe(false);
  });

  it('force-allows [INVALID_URL]', () => {
    expect(shouldSuppress(['[INVALID_URL]', undefined])).toBe(false);
  });

  it('force-allows [CORS_BLOCKED]', () => {
    expect(shouldSuppress(['[CORS_BLOCKED] origin=https://x.test'])).toBe(false);
  });

  it('force-allows [CANONICAL_HOME]', () => {
    expect(shouldSuppress(['[CANONICAL_HOME]', '/home'])).toBe(false);
  });

  it('force-allows [FARROWAY_CAMERA] (scan subsystem)', () => {
    expect(shouldSuppress(['[FARROWAY_CAMERA] stream_created'])).toBe(false);
  });

  it('force-allows [AUTH_STATE]', () => {
    expect(shouldSuppress(['[AUTH_STATE]', 'expired'])).toBe(false);
  });

  it('allow-list takes PRECEDENCE over deny — [FARROWAY_CAMERA] wins even with chrome-extension URL', () => {
    expect(shouldSuppress([
      '[FARROWAY_CAMERA] stream_created',
      { sourceUrl: 'chrome-extension://xyz' },
    ])).toBe(false);
  });

  it('force-allows generic [auth tag', () => {
    expect(shouldSuppress(['[auth.bootstrap] phase=resolved'])).toBe(false);
  });

  it('force-allows generic [api tag', () => {
    expect(shouldSuppress(['[api.client] request 200 ok'])).toBe(false);
  });

  it('force-allows generic [task tag', () => {
    expect(shouldSuppress(['[task.engine] computed 3 tasks'])).toBe(false);
  });

  it('force-allows generic [weather tag', () => {
    expect(shouldSuppress(['[weather.forecast] 7-day fetched'])).toBe(false);
  });

  it('force-allows generic [routing tag', () => {
    expect(shouldSuppress(['[routing.navigate] /home'])).toBe(false);
  });
});

describe('consoleFilter — default pass-through (defensive)', () => {
  it('passes unrelated messages (not deny, not allow)', () => {
    expect(shouldSuppress(['user clicked button', { id: 42 }])).toBe(false);
  });

  it('passes React framework warnings (not in deny list)', () => {
    expect(shouldSuppress(['Warning: Each child in a list should have a unique "key" prop.'])).toBe(false);
  });

  it('handles empty args without crashing', () => {
    expect(shouldSuppress([])).toBe(false);
  });

  it('handles undefined / null args without crashing', () => {
    expect(shouldSuppress([undefined])).toBe(false);
    expect(shouldSuppress([null])).toBe(false);
  });
});
