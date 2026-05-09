/**
 * coordinationLayer.test.js — acceptance coverage for the May 2026
 * coordination quality layer.
 *
 * Spec §12 cases:
 *   • no-data fallback
 *   • rain overrides funding prompt
 *   • scan issue creates follow-up recommendation
 *   • crop harvest stage creates sell readiness
 *   • buyer interest appears when relevant
 *   • repeated recommendation suppressed (memory)
 *   • low confidence uses soft language
 *   • cooldown prevents spam
 *   • farmer UI never shows score / sourceSignals (renderer-side
 *     contract — orchestrator output exposes sourceSignals as an
 *     INTERNAL field; tests assert it isn't a numeric score)
 *   • localization keys returned (not raw English)
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

// ─── eventTypes ──────────────────────────────────────────────────
describe('orchestration/events/eventTypes — frozen catalogue', () => {
  it('exports the 13 spec-mandated event types', async () => {
    const { EVENT_TYPE } = await import('../../../src/orchestration/events/eventTypes.js');
    const expected = [
      'weather_changed', 'task_generated', 'task_completed', 'task_skipped',
      'scan_completed', 'soil_check_completed', 'crop_stage_changed',
      'progress_updated', 'produce_listed', 'buyer_interest_received',
      'funding_match_found', 'notification_sent', 'support_requested',
    ];
    for (const type of expected) {
      expect(Object.values(EVENT_TYPE)).toContain(type);
    }
  });

  it('EVENT_TYPE is frozen', async () => {
    const { EVENT_TYPE } = await import('../../../src/orchestration/events/eventTypes.js');
    expect(Object.isFrozen(EVENT_TYPE)).toBe(true);
  });
});

// ─── eventStore ──────────────────────────────────────────────────
describe('orchestration/events/eventStore', () => {
  it('rejects unknown event types', async () => {
    const { appendEvent } = await import('../../../src/orchestration/events/eventStore.js');
    expect(appendEvent({ type: 'mystery_event' })).toBeNull();
    expect(appendEvent({})).toBeNull();
    expect(appendEvent(null)).toBeNull();
  });

  it('accepts valid events and caps at MAX_EVENTS', async () => {
    const store = await import('../../../src/orchestration/events/eventStore.js');
    store.clearEvents();
    for (let i = 0; i < store.MAX_EVENTS + 50; i++) {
      store.appendEvent({ type: 'task_completed', id: 'evt_' + i, source: 'tasks' });
    }
    expect(store.getRecentEvents().length).toBeLessThanOrEqual(store.MAX_EVENTS);
  });

  it('strips nested objects from payloads (no PII bloat)', async () => {
    const { appendEvent, getRecentEvents } = await import('../../../src/orchestration/events/eventStore.js');
    const stored = appendEvent({
      type: 'scan_completed',
      payload: {
        category:   'yellowing',
        nested:     { shouldNotPersist: true },
        arr:        [1, 2, 3],
        rainProb:   0.7,
      },
    });
    expect(stored.payload.category).toBe('yellowing');
    expect(stored.payload.rainProb).toBe(0.7);
    expect(stored.payload.nested).toBeUndefined();
    expect(stored.payload.arr).toBeUndefined();
  });
});

// ─── eventBus ────────────────────────────────────────────────────
describe('orchestration/events/eventBus', () => {
  it('subscribes typed listeners; unsubscribe is idempotent', async () => {
    const bus = await import('../../../src/orchestration/events/eventBus.js');
    bus._resetBus();
    let count = 0;
    const off = bus.subscribe('scan_completed', () => { count += 1; });
    bus.emit({ type: 'scan_completed', source: 'scan' });
    bus.emit({ type: 'task_completed', source: 'tasks' }); // different type
    expect(count).toBe(1);
    off();
    off();   // idempotent
    bus.emit({ type: 'scan_completed', source: 'scan' });
    expect(count).toBe(1);
  });

  it('wildcard subscribers receive every event', async () => {
    const bus = await import('../../../src/orchestration/events/eventBus.js');
    bus._resetBus();
    const seen = [];
    bus.subscribe('*', (e) => seen.push(e.type));
    bus.emit({ type: 'scan_completed', source: 'scan' });
    bus.emit({ type: 'task_completed', source: 'tasks' });
    expect(seen).toEqual(['scan_completed', 'task_completed']);
  });

  it('a buggy listener does not break siblings', async () => {
    const bus = await import('../../../src/orchestration/events/eventBus.js');
    bus._resetBus();
    let calledSecond = false;
    bus.subscribe('scan_completed', () => { throw new Error('boom'); });
    bus.subscribe('scan_completed', () => { calledSecond = true; });
    bus.emit({ type: 'scan_completed', source: 'scan' });
    expect(calledSecond).toBe(true);
  });
});

// ─── memory ──────────────────────────────────────────────────────
describe('orchestration/memory — continuity', () => {
  it('rememberShown + wasRecentlyShown round-trip', async () => {
    const mem = await import('../../../src/orchestration/memory.js');
    mem.forgetAll();
    const now = new Date('2026-05-10T08:00:00').getTime();
    expect(mem.wasRecentlyShown('weather', 'rain', now)).toBe(false);
    mem.rememberShown('weather', 'rain', now);
    expect(mem.wasRecentlyShown('weather', 'rain', now)).toBe(true);
    // 5h later → still inside the 4h+ default for weather (4h cooldown).
    const oneHour = 60 * 60 * 1000;
    expect(mem.wasRecentlyShown('weather', 'rain', now + 3 * oneHour)).toBe(true);
    // 5h later → outside the 4h cooldown.
    expect(mem.wasRecentlyShown('weather', 'rain', now + 5 * oneHour)).toBe(false);
  });

  it('different keys do not collide', async () => {
    const mem = await import('../../../src/orchestration/memory.js');
    mem.forgetAll();
    const now = Date.now();
    mem.rememberShown('scan_followup', 'scan_1', now);
    expect(mem.wasRecentlyShown('scan_followup', 'scan_1', now)).toBe(true);
    expect(mem.wasRecentlyShown('scan_followup', 'scan_2', now)).toBe(false);
  });
});

// ─── orchestrator (spec §3 prioritization) ───────────────────────
describe('orchestration/orchestrator — prioritization ladder', () => {
  it('rain overrides funding prompt (spec §12)', async () => {
    const { getNextBestRecommendation } = await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    const rec = getNextBestRecommendation({
      weather:        { rainProbability: 0.8 },
      fundingMatches: [{ id: 'fund_1' }],
      buyerInterest:  [{ id: 'buy_1' }],
    });
    expect(rec.titleKey).toBe('orch.rainLater');
    expect(rec.actionRoute).toBe('/tasks');
    expect(rec.priority).toBe('important');
  });

  it('scan issue produces follow-up when no weather urgency', async () => {
    const { getNextBestRecommendation } = await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    const rec = getNextBestRecommendation({
      weather:     { rainProbability: 0.1, tempC: 22 },
      scanHistory: [{ category: 'yellowing', scanId: 's1' }],
    });
    expect(rec.titleKey).toBe('orch.quickFollowUp');
    expect(rec.actionRoute).toBe('/scan');
  });

  it('harvest stage with no listing produces sell-readiness', async () => {
    const { getNextBestRecommendation } = await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    const rec = getNextBestRecommendation({
      weather:   { rainProbability: 0.1, tempC: 22 },
      cropStage: 'harvest',
      tasks:     [],
    });
    expect(rec.titleKey).toBe('orch.harvestReady');
    expect(rec.actionRoute).toBe('/sell');
  });

  it('buyer interest appears when no urgent farm signal', async () => {
    const { getNextBestRecommendation } = await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    const rec = getNextBestRecommendation({
      weather:       { rainProbability: 0.1, tempC: 22 },
      buyerInterest: [{ id: 'b1' }],
    });
    expect(rec.titleKey).toBe('orch.buyerInterest');
    expect(rec.actionRoute).toBe('/sell');
  });

  it('repeated recommendation is suppressed by memory cooldown', async () => {
    const { getNextBestRecommendation } = await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    const ctx = {
      weather: { rainProbability: 0.8 },
      // Provide a secondary candidate so the orchestrator has
      // somewhere to fall through to once weather is suppressed.
      tasks:   [{ id: 't1', completed: false }],
    };
    const first = getNextBestRecommendation(ctx);
    expect(first.titleKey).toBe('orch.rainLater');
    // Same call moments later — memory should suppress weather
    // and surface the next-best candidate (today's task).
    const second = getNextBestRecommendation(ctx);
    expect(second.titleKey).toBe('orch.todayFocus');
  });

  it('falls through to spec §11 fallback when nothing applies', async () => {
    const { getNextBestRecommendation, FALLBACK_RECOMMENDATION } =
      await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    // Fully populated context with no rule match (no weather urgency,
    // no scan issue, no tasks, no harvest, no buyer/funding).
    const rec = getNextBestRecommendation({
      region: 'NG',
      weather: { rainProbability: 0.1, tempC: 22 },
      mode: 'farm',
      cropStage: 'planted',
    });
    expect(rec).toBe(FALLBACK_RECOMMENDATION);
    expect(rec.titleKey).toBe('home.goodQuickCheck');
  });

  it('garbage input never crashes — fallback', async () => {
    const { getNextBestRecommendation, FALLBACK_RECOMMENDATION } =
      await import('../../../src/orchestration/orchestrator.js');
    expect(() => getNextBestRecommendation(null)).not.toThrow();
    expect(() => getNextBestRecommendation('garbage')).not.toThrow();
    expect(getNextBestRecommendation('garbage')).toBeDefined();
    // Fallback also when input is null but build context still works.
    const r = getNextBestRecommendation(null);
    // Either fallback OR a low-priority candidate; both pass.
    expect(typeof r.titleKey).toBe('string');
    expect(r.titleKey.length).toBeGreaterThan(0);
    expect(typeof r.actionRoute).toBe('string');
    expect(r.actionRoute.startsWith('/')).toBe(true);
  });

  it('output exposes i18n keys, not raw English', async () => {
    const { getNextBestRecommendation, FALLBACK_RECOMMENDATION } =
      await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    const rec = getNextBestRecommendation({
      weather: { rainProbability: 0.8 },
    });
    // Keys are dot-separated identifiers — they don't contain
    // spaces or full sentences.
    expect(rec.titleKey).not.toMatch(/\s/);
    expect(rec.messageKey).not.toMatch(/\s/);
    expect(rec.actionLabelKey).not.toMatch(/\s/);
    // Fallback is also key-shaped.
    expect(FALLBACK_RECOMMENDATION.titleKey).not.toMatch(/\s/);
  });

  it('soil flag now beats today\'s task (spec §4 reorder)', async () => {
    const { getNextBestRecommendation } = await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    const rec = getNextBestRecommendation({
      weather:    { rainProbability: 0.1, tempC: 22 },
      soilChecks: [{ id: 'soil_1', status: 'dry' }],
      tasks:      [{ id: 't1', completed: false }],
    });
    expect(rec.titleKey).toBe('orch.soilFollowUp');
    expect(rec.actionRoute).toBe('/scan/soil');
  });

  it('buyer interest beats funding match (spec §4 #6 vs #7)', async () => {
    const { getNextBestRecommendation } = await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    const rec = getNextBestRecommendation({
      weather:        { rainProbability: 0.1, tempC: 22 },
      buyerInterest:  [{ id: 'buy_1' }],
      fundingMatches: [{ id: 'fund_1', url: 'https://www.usda.gov/topics/urban' }],
    });
    expect(rec.titleKey).toBe('orch.buyerInterest');
  });

  it('funding ONLY surfaces when its URL passes the verified gate', async () => {
    const { getNextBestRecommendation } = await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    // Unverified URL → funding candidate is skipped → falls through.
    const recBlocked = getNextBestRecommendation({
      country: 'us', region: 'MD', crop: 'pepper',
      weather:        { rainProbability: 0.1, tempC: 22 },
      tasks:          [],
      fundingMatches: [{
        id: 'fund_evil',
        url: 'https://evil.example.tk/grant',
        country: 'us', regions: ['MD'], crops: ['pepper'],
        verified: true, active: true,
      }],
    });
    expect(recBlocked.titleKey).not.toBe('orch.fundingMatch');

    // Verified URL → funding candidate surfaces. May 2026 engine
    // fix: the regional-relevance gate now requires actual context
    // match (country / region / crop / verified+active) so the
    // funding match needs those fields populated. The previous
    // version of this test inadvertently relied on the fallback
    // "any verified match" path, which has been removed because
    // it surfaced unrelated grants in violation of spec §10.
    forgetAll();
    const recOk = getNextBestRecommendation({
      country: 'us', region: 'MD', crop: 'pepper',
      weather:        { rainProbability: 0.1, tempC: 22 },
      tasks:          [],
      fundingMatches: [{
        id: 'fund_1',
        url: 'https://www.usda.gov/topics/urban',
        country: 'us', regions: ['MD'], crops: ['pepper'],
        verified: true, active: true,
      }],
    });
    expect(recOk.titleKey).toBe('orch.fundingMatch');
    expect(recOk.actionRoute).toBe('/funding');
  });

  it('funding match with NO URL is skipped (no actionable target)', async () => {
    const { getNextBestRecommendation } = await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    const rec = getNextBestRecommendation({
      weather:        { rainProbability: 0.1, tempC: 22 },
      tasks:          [],
      fundingMatches: [{ id: 'fund_no_url' }], // no url/applyUrl/sourceUrl
    });
    expect(rec.titleKey).not.toBe('orch.fundingMatch');
  });

  it('shortener URL on a funding match is rejected', async () => {
    const { getNextBestRecommendation } = await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    const rec = getNextBestRecommendation({
      weather:        { rainProbability: 0.1, tempC: 22 },
      tasks:          [],
      fundingMatches: [{ id: 'fund_short', url: 'https://bit.ly/abc' }],
    });
    expect(rec.titleKey).not.toBe('orch.fundingMatch');
  });

  it('output never carries a numeric score field', async () => {
    const { getNextBestRecommendation } = await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } = await import('../../../src/orchestration/memory.js');
    forgetAll();
    const rec = getNextBestRecommendation({
      weather: { rainProbability: 0.8 },
    });
    // Renderer-facing contract: no numeric score / risk / model
    // fields in the public envelope. sourceSignals is INTERNAL
    // and the renderer is contracted to skip it.
    expect(rec.score).toBeUndefined();
    expect(rec.riskScore).toBeUndefined();
    expect(rec.modelScore).toBeUndefined();
    // sourceSignals exists but isn't a number.
    expect(typeof rec.sourceSignals).toBe('object');
    expect(typeof rec.sourceSignals).not.toBe('number');
  });
});
