/**
 * farmContextClient.test.js — contract for the pure client
 * + reducer that powers the useFarmContext hook.
 *
 * The React hook itself is a thin wrapper around the runner
 * and reducer tested here.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  fetchFarmContext,
  INITIAL_CONTEXT_STATE,
  contextStateReducer,
  runFarmContextFetch,
} from '../../../src/core/farm/farmContextClient.js';

// Minimal fake fetch helper. Returns objects shaped like Response.
function okResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function errResponse(body, status = 500) {
  return {
    ok: false,
    status,
    json: async () => body,
  };
}

// ─── fetchFarmContext ────────────────────────────────────────
describe('fetchFarmContext', () => {
  it('missing farmId → {ok:false, error:missing_farm_id}', async () => {
    const r = await fetchFarmContext(null, { fetch: () => okResponse({}) });
    expect(r).toEqual({ ok: false, error: 'missing_farm_id', status: 400 });
  });

  it('no fetch available → {ok:false, error:no_fetch}', async () => {
    const origFetch = globalThis.fetch;
    // eslint-disable-next-line no-undef
    delete globalThis.fetch;
    const r = await fetchFarmContext('F1');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('no_fetch');
    globalThis.fetch = origFetch;
  });

  it('unwraps { success:true, data } envelope', async () => {
    const r = await fetchFarmContext('F1', {
      fetch: async () => okResponse({ success: true, data: { farm: { id: 'F1' } } }),
    });
    expect(r).toEqual({ ok: true, data: { farm: { id: 'F1' } } });
  });

  it('surfaces { success:false, error } envelope', async () => {
    const r = await fetchFarmContext('F1', {
      fetch: async () => okResponse({ success: false, error: 'db_down' }),
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('db_down');
  });

  it('falls back to raw body when envelope missing', async () => {
    const r = await fetchFarmContext('F1', {
      fetch: async () => okResponse({ farm: { id: 'X' } }),
    });
    expect(r.ok).toBe(true);
    expect(r.data.farm.id).toBe('X');
  });

  it('4xx status with error body surfaces the message', async () => {
    const r = await fetchFarmContext('F1', {
      fetch: async () => errResponse({ error: 'forbidden' }, 403),
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('forbidden');
    expect(r.status).toBe(403);
  });

  it('5xx with no parseable body still returns error', async () => {
    const r = await fetchFarmContext('F1', {
      fetch: async () => ({ ok: false, status: 500, json: async () => { throw new Error('x'); } }),
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(500);
  });

  it('network throw returns {ok:false, error:"network"}', async () => {
    const r = await fetchFarmContext('F1', {
      fetch: async () => { throw new Error('econnrefused'); },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('network');
  });

  it('AbortError becomes {aborted:true}', async () => {
    const r = await fetchFarmContext('F1', {
      fetch: async () => {
        const e = new Error('abort');
        e.name = 'AbortError';
        throw e;
      },
    });
    expect(r.aborted).toBe(true);
  });

  it('encodes farmId in the URL', async () => {
    let seenUrl = '';
    await fetchFarmContext('with space/F', {
      fetch: async (url) => { seenUrl = url; return okResponse({ success: true, data: {} }); },
    });
    expect(seenUrl).toContain('with%20space%2FF');
  });

  it('respects custom base', async () => {
    let seenUrl = '';
    await fetchFarmContext('F1', {
      fetch: async (url) => { seenUrl = url; return okResponse({ success: true, data: {} }); },
      base: '/api/v2',
    });
    expect(seenUrl.startsWith('/api/v2/farm/F1/context')).toBe(true);
  });
});

// ─── contextStateReducer ─────────────────────────────────────
describe('contextStateReducer', () => {
  it('initial state is idle with nulls', () => {
    expect(INITIAL_CONTEXT_STATE.status).toBe('idle');
    expect(INITIAL_CONTEXT_STATE.data).toBeNull();
    expect(INITIAL_CONTEXT_STATE.error).toBeNull();
  });

  it('start transitions to loading, preserves previous data', () => {
    const prev = { status: 'ready', data: { x: 1 }, error: null, farmId: 'A' };
    const next = contextStateReducer(prev, { type: 'start', farmId: 'B' });
    expect(next.status).toBe('loading');
    expect(next.data).toEqual({ x: 1 });
    expect(next.farmId).toBe('B');
  });

  it('resolve transitions to ready', () => {
    const next = contextStateReducer(
      { status: 'loading', data: null, error: null, farmId: 'A' },
      { type: 'resolve', data: { y: 2 } },
    );
    expect(next.status).toBe('ready');
    expect(next.data).toEqual({ y: 2 });
    expect(next.error).toBeNull();
  });

  it('fail transitions to error with error id', () => {
    const next = contextStateReducer(
      { status: 'loading', data: null, error: null, farmId: 'A' },
      { type: 'fail', error: 'network' },
    );
    expect(next.status).toBe('error');
    expect(next.error).toBe('network');
  });

  it('reset returns to initial', () => {
    const next = contextStateReducer({ status: 'ready', data: {}, error: null }, { type: 'reset' });
    expect(next).toEqual(INITIAL_CONTEXT_STATE);
  });

  it('unknown action returns state unchanged', () => {
    const prev = { status: 'ready', data: {}, error: null, farmId: null };
    expect(contextStateReducer(prev, { type: 'bogus' })).toBe(prev);
  });

  it('null state falls back to initial on unknown action', () => {
    expect(contextStateReducer(null, { type: 'bogus' })).toEqual(INITIAL_CONTEXT_STATE);
  });
});

// ─── runFarmContextFetch ─────────────────────────────────────
describe('runFarmContextFetch', () => {
  it('dispatches start → resolve on success', async () => {
    const actions = [];
    const dispatch = (a) => actions.push(a);
    await runFarmContextFetch({
      farmId: 'F1',
      dispatch,
      fetcher: async () => ({ ok: true, data: { x: 1 } }),
    });
    expect(actions.map((a) => a.type)).toEqual(['start', 'resolve']);
    expect(actions[1].data).toEqual({ x: 1 });
  });

  it('dispatches start → fail on error', async () => {
    const actions = [];
    await runFarmContextFetch({
      farmId: 'F1',
      dispatch: (a) => actions.push(a),
      fetcher: async () => ({ ok: false, error: 'db_down' }),
    });
    expect(actions.map((a) => a.type)).toEqual(['start', 'fail']);
    expect(actions[1].error).toBe('db_down');
  });

  it('aborted response does NOT dispatch resolve/fail', async () => {
    const actions = [];
    await runFarmContextFetch({
      farmId: 'F1',
      dispatch: (a) => actions.push(a),
      fetcher: async () => ({ aborted: true }),
    });
    expect(actions.map((a) => a.type)).toEqual(['start']);
  });

  it('no-op when dispatch is missing', async () => {
    await expect(runFarmContextFetch({
      farmId: 'F1',
      fetcher: async () => ({ ok: true, data: {} }),
    })).resolves.toBeUndefined();
  });

  it('defaults to fetchFarmContext when no fetcher passed', async () => {
    // Uses real fetchFarmContext — no fetch available, it will
    // return {ok:false, error:'no_fetch'} and dispatch fail.
    const origFetch = globalThis.fetch;
    // eslint-disable-next-line no-undef
    delete globalThis.fetch;
    const actions = [];
    await runFarmContextFetch({
      farmId: 'F1',
      dispatch: (a) => actions.push(a),
    });
    expect(actions.map((a) => a.type)).toEqual(['start', 'fail']);
    globalThis.fetch = origFetch;
  });
});
