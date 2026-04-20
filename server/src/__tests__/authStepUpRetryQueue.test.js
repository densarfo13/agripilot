/**
 * authStepUpRetryQueue.test.js — contract for the queue that
 * auto-replays API requests after the user completes a step-up
 * challenge.
 *
 * Covers:
 *   • enqueue returns a promise that is settled on flush/reject
 *   • flush replays every queued config through the injected retrier
 *   • each replay's result goes to the original caller
 *   • reject fails every pending caller with a consistent error
 *   • size() tracks the queue length
 *   • replayed configs are marked _stepUpRetried=true
 *     so the interceptor won't re-queue them
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  enqueueStepUpRetry,
  flushStepUpRetryQueue,
  rejectStepUpRetryQueue,
  stepUpRetryQueueSize,
  _resetStepUpRetryQueue,
} from '../../../src/core/auth/stepUpRetryQueue.js';

beforeEach(() => _resetStepUpRetryQueue());

describe('enqueue + size', () => {
  it('queue starts empty', () => {
    expect(stepUpRetryQueueSize()).toBe(0);
  });
  it('size grows for each enqueue', () => {
    const p1 = enqueueStepUpRetry({ url: '/admin/users' });
    const p2 = enqueueStepUpRetry({ url: '/admin/security' });
    expect(stepUpRetryQueueSize()).toBe(2);
    // unused promise handles — make the test runtime happy by attaching catch
    p1.catch(() => {}); p2.catch(() => {});
  });
});

describe('flushStepUpRetryQueue', () => {
  it('replays every queued config through the retrier', async () => {
    const seen = [];
    const retrier = async (cfg) => {
      seen.push(cfg.url);
      return { data: `ok ${cfg.url}` };
    };

    const p1 = enqueueStepUpRetry({ url: '/a' });
    const p2 = enqueueStepUpRetry({ url: '/b' });
    await flushStepUpRetryQueue(retrier);

    expect(seen).toEqual(['/a', '/b']);
    await expect(p1).resolves.toEqual({ data: 'ok /a' });
    await expect(p2).resolves.toEqual({ data: 'ok /b' });
  });

  it('each caller gets its own settlement — one failure does not block others', async () => {
    const retrier = async (cfg) => {
      if (cfg.url === '/bad') throw new Error('still_401');
      return { data: `ok ${cfg.url}` };
    };
    const p1 = enqueueStepUpRetry({ url: '/good' });
    const p2 = enqueueStepUpRetry({ url: '/bad' });
    await flushStepUpRetryQueue(retrier);

    await expect(p1).resolves.toEqual({ data: 'ok /good' });
    await expect(p2).rejects.toThrow('still_401');
  });

  it('clears the queue before replay — re-entrant enqueue lands in a fresh queue', async () => {
    let sizeDuringReplay = -1;
    const retrier = async (cfg) => {
      sizeDuringReplay = stepUpRetryQueueSize();
      return { ok: true };
    };
    const p = enqueueStepUpRetry({ url: '/x' });
    await flushStepUpRetryQueue(retrier);
    await p;
    expect(sizeDuringReplay).toBe(0);
    expect(stepUpRetryQueueSize()).toBe(0);
  });

  it('marks every replayed config with _stepUpRetried=true', async () => {
    const marks = [];
    const retrier = async (cfg) => {
      marks.push(cfg._stepUpRetried);
      return {};
    };
    const p = enqueueStepUpRetry({ url: '/y' });
    await flushStepUpRetryQueue(retrier);
    await p;
    expect(marks).toEqual([true]);
  });

  it('does not lose the original config fields on replay', async () => {
    const seen = [];
    const retrier = async (cfg) => { seen.push(cfg); return {}; };
    const p = enqueueStepUpRetry({ url: '/admin', method: 'get', headers: { X: '1' } });
    await flushStepUpRetryQueue(retrier);
    await p;
    expect(seen[0].url).toBe('/admin');
    expect(seen[0].method).toBe('get');
    expect(seen[0].headers).toEqual({ X: '1' });
  });

  it('with no retrier, every pending caller is rejected', async () => {
    const p = enqueueStepUpRetry({ url: '/z' });
    await flushStepUpRetryQueue(null);
    await expect(p).rejects.toThrow(/no_retrier/);
  });

  it('a flush on an empty queue is a no-op', async () => {
    const result = await flushStepUpRetryQueue(async () => ({}));
    expect(result).toEqual([]);
  });
});

describe('rejectStepUpRetryQueue', () => {
  it('rejects every queued caller with the provided reason', async () => {
    const p1 = enqueueStepUpRetry({ url: '/a' });
    const p2 = enqueueStepUpRetry({ url: '/b' });
    const err = new Error('step_up_cancelled');
    rejectStepUpRetryQueue(err);
    await expect(p1).rejects.toThrow('step_up_cancelled');
    await expect(p2).rejects.toThrow('step_up_cancelled');
    expect(stepUpRetryQueueSize()).toBe(0);
  });

  it('coerces non-Error reasons into an Error', async () => {
    const p = enqueueStepUpRetry({ url: '/a' });
    rejectStepUpRetryQueue('bad');
    await expect(p).rejects.toThrow(/bad/);
  });

  it('returns the count of rejected items', async () => {
    enqueueStepUpRetry({ url: '/a' }).catch(() => {});
    enqueueStepUpRetry({ url: '/b' }).catch(() => {});
    enqueueStepUpRetry({ url: '/c' }).catch(() => {});
    expect(rejectStepUpRetryQueue('cancel')).toBe(3);
    expect(stepUpRetryQueueSize()).toBe(0);
  });

  it('reject on empty queue returns 0', () => {
    expect(rejectStepUpRetryQueue('x')).toBe(0);
  });
});

describe('combined flush + enqueue ordering', () => {
  it('items enqueued after flush are not touched by the flush', async () => {
    const seen = [];
    const retrier = async (cfg) => { seen.push(cfg.url); return {}; };

    const p1 = enqueueStepUpRetry({ url: '/first' });
    const flushPromise = flushStepUpRetryQueue(retrier);
    // Enqueue DURING flush — should stay pending.
    const p2 = enqueueStepUpRetry({ url: '/second' });
    await flushPromise;
    await p1;

    expect(seen).toEqual(['/first']);
    expect(stepUpRetryQueueSize()).toBe(1);
    // Drain the late enqueue cleanly.
    rejectStepUpRetryQueue('test_cleanup');
    await expect(p2).rejects.toThrow();
  });
});
