/**
 * confidenceLoopEngine.test.js — Farmer Confidence Loop Engine v1.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  recordLoopEvent, getLoopEvents, getLoopFor, clearLoopEvents,
  buildLoopRecord, summariseLoopHealth, deriveLoopAdaptation,
  LOOP_EVENT, LOOP_STAGE, _internal,
} from '../../../src/core/trust/confidenceLoopEngine.js';
import {
  getTrustMemory, clearTrustMemory,
} from '../../../src/core/trust/trustExplanationEngine.js';

function _stubLocalStorage() {
  if (typeof globalThis.localStorage === 'undefined') {
    const _store = new Map();
    globalThis.localStorage = {
      getItem:    (k) => _store.has(k) ? _store.get(k) : null,
      setItem:    (k, v) => _store.set(k, String(v)),
      removeItem: (k) => _store.delete(k),
      clear:      () => _store.clear(),
      get length() { return _store.size; },
      key: (i) => Array.from(_store.keys())[i] || null,
    };
  } else {
    try { globalThis.localStorage.clear(); } catch { /* swallow */ }
  }
}

beforeEach(() => {
  _stubLocalStorage();
  clearLoopEvents();
  clearTrustMemory();
});

// ─── Event recording ──────────────────────────────────────

describe('recordLoopEvent', () => {
  it('persists a valid event', () => {
    const row = recordLoopEvent('rec_1', LOOP_EVENT.SHOWN, { crop: 'tomato' });
    expect(row).toBeTruthy();
    expect(row.recommendationId).toBe('rec_1');
    expect(row.event).toBe(LOOP_EVENT.SHOWN);
    expect(getLoopEvents().length).toBe(1);
  });

  it('rejects invalid events + ids', () => {
    expect(recordLoopEvent('rec', 'made_up')).toBeNull();
    expect(recordLoopEvent('', LOOP_EVENT.SHOWN)).toBeNull();
    expect(recordLoopEvent(null, LOOP_EVENT.SHOWN)).toBeNull();
  });

  it('never throws on garbage input', () => {
    expect(() => recordLoopEvent(123, LOOP_EVENT.SHOWN)).not.toThrow();
    expect(() => recordLoopEvent('x', null)).not.toThrow();
  });

  it('caps the buffer at 500', () => {
    for (let i = 0; i < 600; i++) {
      recordLoopEvent('rec_' + i, LOOP_EVENT.SHOWN);
    }
    expect(getLoopEvents().length).toBeLessThanOrEqual(500);
  });

  it('dedupes the same (id,event) within 30s', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.SHOWN);
    recordLoopEvent('rec_1', LOOP_EVENT.SHOWN);
    expect(getLoopEvents().length).toBe(1);
  });
});

// ─── Forwarding to trust memory ───────────────────────────

describe('forwarding into trust memory', () => {
  it('IMPROVED → trust action SUCCESSFUL', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.IMPROVED, { crop: 'tomato' });
    const mem = getTrustMemory();
    expect(mem.some((r) => r.action === 'successful' && r.recommendationId === 'rec_1')).toBe(true);
  });

  it('WORSENED → trust action DISPUTED', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.WORSENED);
    expect(getTrustMemory().some((r) => r.action === 'disputed')).toBe(true);
  });

  it('IGNORED → trust action IGNORED', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.IGNORED);
    expect(getTrustMemory().some((r) => r.action === 'ignored')).toBe(true);
  });

  it('ACTION_TAKEN → trust action ACCEPTED', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.ACTION_TAKEN);
    expect(getTrustMemory().some((r) => r.action === 'accepted')).toBe(true);
  });
});

// ─── Lifecycle records ────────────────────────────────────

describe('buildLoopRecord — stage derivation', () => {
  it('AWAITING_ACK after SHOWN', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.SHOWN);
    const r = buildLoopRecord('rec_1');
    expect(r.stage).toBe(LOOP_STAGE.AWAITING_ACK);
  });

  it('AWAITING_ACTION after ACKNOWLEDGED', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.SHOWN);
    recordLoopEvent('rec_1', LOOP_EVENT.ACKNOWLEDGED);
    expect(buildLoopRecord('rec_1').stage).toBe(LOOP_STAGE.AWAITING_ACTION);
  });

  it('AWAITING_FOLLOWUP after ACTION_TAKEN', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.SHOWN);
    recordLoopEvent('rec_1', LOOP_EVENT.ACTION_TAKEN);
    expect(buildLoopRecord('rec_1').stage).toBe(LOOP_STAGE.AWAITING_FOLLOWUP);
  });

  it('AWAITING_OUTCOME after FOLLOWUP_SCAN', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.SHOWN);
    recordLoopEvent('rec_1', LOOP_EVENT.FOLLOWUP_SCAN);
    expect(buildLoopRecord('rec_1').stage).toBe(LOOP_STAGE.AWAITING_OUTCOME);
  });

  it('COMPLETED after IMPROVED', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.SHOWN);
    recordLoopEvent('rec_1', LOOP_EVENT.IMPROVED);
    expect(buildLoopRecord('rec_1').stage).toBe(LOOP_STAGE.COMPLETED);
  });

  it('IGNORED stage after IGNORED event', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.SHOWN);
    recordLoopEvent('rec_1', LOOP_EVENT.IGNORED);
    expect(buildLoopRecord('rec_1').stage).toBe(LOOP_STAGE.IGNORED);
  });

  it('empty record for unknown id', () => {
    const r = buildLoopRecord('does-not-exist');
    expect(r.stage).toBeNull();
    expect(r.events.length).toBe(0);
  });
});

describe('buildLoopRecord — outcome prompt timing', () => {
  it('does NOT prompt immediately after follow-up scan', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.FOLLOWUP_SCAN);
    const r = buildLoopRecord('rec_1');
    expect(r.outcomePromptNeeded).toBe(false);
  });

  it('does NOT prompt when an outcome has been recorded', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.FOLLOWUP_SCAN);
    recordLoopEvent('rec_1', LOOP_EVENT.IMPROVED);
    expect(buildLoopRecord('rec_1').outcomePromptNeeded).toBe(false);
  });

  it('prompts when follow-up was > 6 hours ago and no outcome yet', () => {
    // Inject a record by hand using the existing event log via storage.
    const sevenHrsAgo = Date.now() - (7 * 60 * 60 * 1000);
    globalThis.localStorage.setItem(
      'farroway:confidenceLoop:v1',
      JSON.stringify([{
        recommendationId: 'rec_1',
        event: LOOP_EVENT.FOLLOWUP_SCAN,
        recordedAt: sevenHrsAgo,
      }]),
    );
    const r = buildLoopRecord('rec_1');
    expect(r.outcomePromptNeeded).toBe(true);
    expect(r.outcomePrompt).toBeTruthy();
    expect(r.outcomePrompt.options.length).toBe(3);
  });
});

// ─── Global rollup ────────────────────────────────────────

describe('summariseLoopHealth', () => {
  it('empty log returns zero-state summary', () => {
    const s = summariseLoopHealth();
    expect(s.totalRecommendations).toBe(0);
    expect(s.engagementScore).toBe(0);
  });

  it('counts events correctly across multiple recommendations', () => {
    recordLoopEvent('a', LOOP_EVENT.SHOWN);
    recordLoopEvent('a', LOOP_EVENT.ACKNOWLEDGED);
    recordLoopEvent('a', LOOP_EVENT.ACTION_TAKEN);
    recordLoopEvent('a', LOOP_EVENT.IMPROVED);
    recordLoopEvent('b', LOOP_EVENT.SHOWN);
    recordLoopEvent('b', LOOP_EVENT.IGNORED);
    const s = summariseLoopHealth();
    expect(s.totalRecommendations).toBe(2);
    expect(s.improvedCount).toBe(1);
    expect(s.ignoredCount).toBe(1);
    expect(s.completedCount).toBe(1);
  });

  it('engagement score is 0..100 integer', () => {
    recordLoopEvent('a', LOOP_EVENT.SHOWN);
    recordLoopEvent('a', LOOP_EVENT.ACKNOWLEDGED);
    recordLoopEvent('a', LOOP_EVENT.ACTION_TAKEN);
    recordLoopEvent('a', LOOP_EVENT.FOLLOWUP_SCAN);
    recordLoopEvent('a', LOOP_EVENT.IMPROVED);
    const s = summariseLoopHealth();
    expect(Number.isInteger(s.engagementScore)).toBe(true);
    expect(s.engagementScore).toBeGreaterThan(0);
    expect(s.engagementScore).toBeLessThanOrEqual(100);
  });

  it('improvementRate reflects completed-only fraction', () => {
    recordLoopEvent('a', LOOP_EVENT.SHOWN);
    recordLoopEvent('a', LOOP_EVENT.IMPROVED);
    recordLoopEvent('b', LOOP_EVENT.SHOWN);
    recordLoopEvent('b', LOOP_EVENT.WORSENED);
    const s = summariseLoopHealth();
    expect(s.improvementRate).toBeCloseTo(0.5);
  });
});

// ─── Adaptation hints ─────────────────────────────────────

describe('deriveLoopAdaptation', () => {
  it('shouldReinforceWording true after IMPROVED', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.SHOWN);
    recordLoopEvent('rec_1', LOOP_EVENT.IMPROVED);
    const a = deriveLoopAdaptation('rec_1');
    expect(a.shouldReinforceWording).toBe(true);
    expect(a.toneHint).toBe('supportive');
    expect(a.copyBoost).toBe('reinforce');
  });

  it('shouldRewordSofter true after repeated IGNORED', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.SHOWN);
    recordLoopEvent('rec_1', LOOP_EVENT.IGNORED);
    // 30s dedupe — write directly via storage to simulate two distinct
    // ignores.
    const existing = JSON.parse(globalThis.localStorage.getItem('farroway:confidenceLoop:v1') || '[]');
    existing.push({ recommendationId: 'rec_1', event: LOOP_EVENT.IGNORED, recordedAt: Date.now() - 60000 });
    globalThis.localStorage.setItem('farroway:confidenceLoop:v1', JSON.stringify(existing));
    const a = deriveLoopAdaptation('rec_1');
    expect(a.shouldRewordSofter).toBe(true);
    expect(a.copyBoost).toBe('reword_softer');
  });

  it('shouldSuppressRepetition true after multiple SHOWN no ACK', () => {
    const log = [];
    for (let i = 0; i < 4; i++) {
      log.push({ recommendationId: 'rec_1', event: LOOP_EVENT.SHOWN, recordedAt: Date.now() - (i * 60000) });
    }
    globalThis.localStorage.setItem('farroway:confidenceLoop:v1', JSON.stringify(log));
    const a = deriveLoopAdaptation('rec_1');
    expect(a.shouldSuppressRepetition).toBe(true);
  });

  it('default adaptation for unknown id', () => {
    const a = deriveLoopAdaptation('nope');
    expect(a.shouldSuppressRepetition).toBe(false);
    expect(a.toneHint).toBe('calm');
    expect(a.copyBoost).toBe('normal');
  });

  it('WORSENED → operational tone', () => {
    recordLoopEvent('rec_1', LOOP_EVENT.SHOWN);
    recordLoopEvent('rec_1', LOOP_EVENT.WORSENED);
    expect(deriveLoopAdaptation('rec_1').toneHint).toBe('operational');
  });
});

// ─── _internal helpers ────────────────────────────────────

describe('_internal helpers', () => {
  it('_stageFor handles empty input', () => {
    expect(_internal._stageFor([])).toBeNull();
    expect(_internal._stageFor(null)).toBeNull();
  });
});
