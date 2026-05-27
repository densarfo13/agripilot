/**
 * trustExplanationEngine.test.js — Farmer Trust Engine v1.
 *
 * Contract:
 *   • Every recommendation gets a calm, plain-language explanation.
 *   • Confidence is a tone (HIGH / MEDIUM / NEEDS_REVIEW), never a %.
 *   • Trust memory adapts the tone over time.
 *   • Noise suppression hides acknowledged + repeatedly-ignored items.
 *   • Every visible string is a tSafe envelope.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  buildTrustExplanation, CONFIDENCE, TRUST_ACTION, TONE,
  recordTrustAction, getTrustMemory, getTrustHistoryFor,
  clearTrustMemory, deriveTrustTone,
  applyTrustNoiseSuppression, _internal,
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

// ─── Envelope shape ─────────────────────────────────────────

describe('buildTrustExplanation — envelope shape', () => {
  it('returns a calm fallback envelope for empty input', () => {
    const v = buildTrustExplanation({});
    expect(v.engineVersion).toBe('trust-explanation-v1');
    expect(['high_confidence', 'medium_confidence', 'needs_review'])
      .toContain(v.confidenceTone);
    expect(typeof v.confidenceLabel.key).toBe('string');
    expect(typeof v.whyAppeared.key).toBe('string');
    expect(Array.isArray(v.signals)).toBe(true);
    expect(typeof v.urgencyLabel.key).toBe('string');
  });

  it('garbage / null / undefined never throws', () => {
    expect(() => buildTrustExplanation(null)).not.toThrow();
    expect(() => buildTrustExplanation(undefined)).not.toThrow();
    expect(() => buildTrustExplanation('string')).not.toThrow();
    expect(() => buildTrustExplanation(42)).not.toThrow();
  });

  it('every visible string is a tSafe envelope (key + fallback)', () => {
    const v = buildTrustExplanation({
      recommendation: {
        id: 'r1', urgency: 'medium',
        reason: { key: 'rec.r', fallback: 'because reasons' },
      },
      signals: { weather: { temp: 35 } },
    });
    expect(typeof v.confidenceLabel.fallback).toBe('string');
    expect(typeof v.whyAppeared.fallback).toBe('string');
    expect(typeof v.urgencyLabel.fallback).toBe('string');
    for (const s of v.signals) {
      expect(typeof s.key).toBe('string');
      expect(typeof s.fallback).toBe('string');
    }
  });
});

// ─── Signal aggregator ──────────────────────────────────────

describe('_aggregateSignals', () => {
  it('produces a weather frost signal at temp ≤ 4', () => {
    const sigs = _internal._aggregateSignals({ weather: { temp: 2 } });
    expect(sigs.some((s) => s.key === 'trust.signal.weather.frost')).toBe(true);
  });

  it('produces a weather heat signal at temp ≥ 34', () => {
    const sigs = _internal._aggregateSignals({ weather: { temp: 36 } });
    expect(sigs.some((s) => s.key === 'trust.signal.weather.heat')).toBe(true);
  });

  it('produces a scan severity signal for serious scans', () => {
    const sigs = _internal._aggregateSignals({ scan: { severity: 'serious' } });
    expect(sigs.some((s) => s.key === 'trust.signal.scan.severity.serious')).toBe(true);
  });

  it('produces a lifecycle signal for flowering crop', () => {
    const sigs = _internal._aggregateSignals({
      cropLifecycle: { currentStage: 'flowering' },
    });
    expect(sigs.some((s) => s.key === 'trust.signal.lifecycle.flowering')).toBe(true);
  });

  it('produces a region outbreak signal when neighbors have outbreaks', () => {
    const sigs = _internal._aggregateSignals({
      region: { activeOutbreaks: ['x', 'y'] },
    });
    expect(sigs.some((s) => s.key === 'trust.signal.region.outbreak')).toBe(true);
  });

  it('produces a recurring memory signal when farmMemory has hasRecurringIssue', () => {
    const sigs = _internal._aggregateSignals({
      farmMemory: { activeFlags: { hasRecurringIssue: true } },
    });
    expect(sigs.some((s) => s.key === 'trust.signal.memory.recurring')).toBe(true);
  });

  it('caps at 4 signals', () => {
    const sigs = _internal._aggregateSignals({
      weather: { temp: 36 },
      scan: { severity: 'serious' },
      cropLifecycle: { currentStage: 'flowering' },
      region: { activeOutbreaks: ['a'] },
      farmMemory: { activeFlags: { hasRecurringIssue: true } },
      taskHistory: { daysSinceLastWatering: 5 },
    });
    expect(sigs.length).toBeLessThanOrEqual(4);
  });
});

// ─── Confidence assessment ──────────────────────────────────

describe('confidence derivation', () => {
  it('many independent sources → HIGH confidence', () => {
    const v = buildTrustExplanation({
      recommendation: { id: 'r1', urgency: 'medium' },
      signals: {
        weather: { temp: 35 },
        scan:    { severity: 'moderate' },
        cropLifecycle: { currentStage: 'flowering' },
      },
    });
    expect(v.confidenceTone).toBe(CONFIDENCE.HIGH);
  });

  it('two sources → MEDIUM', () => {
    const v = buildTrustExplanation({
      recommendation: { id: 'r1', urgency: 'low' },
      signals: {
        weather: { temp: 35 },
        scan:    { severity: 'moderate' },
      },
    });
    expect(v.confidenceTone).toBe(CONFIDENCE.MEDIUM);
  });

  it('disputed past flips confidence to NEEDS_REVIEW', () => {
    const v = buildTrustExplanation({
      recommendation: { id: 'r1', urgency: 'high' },
      signals: {
        weather: { temp: 35 },
        scan:    { severity: 'moderate' },
        cropLifecycle: { currentStage: 'flowering' },
      },
      memory: [
        { recommendationId: 'r1', action: TRUST_ACTION.DISPUTED, recordedAt: Date.now() },
      ],
    });
    expect(v.confidenceTone).toBe(CONFIDENCE.NEEDS_REVIEW);
  });

  it('repeatedly ignored → NEEDS_REVIEW', () => {
    const memory = [];
    for (let i = 0; i < 4; i++) {
      memory.push({ recommendationId: 'r1', action: TRUST_ACTION.IGNORED, recordedAt: Date.now() });
    }
    const v = buildTrustExplanation({
      recommendation: { id: 'r1', urgency: 'medium' },
      signals: { weather: { temp: 35 }, scan: { severity: 'moderate' } },
      memory,
    });
    expect(v.confidenceTone).toBe(CONFIDENCE.NEEDS_REVIEW);
  });
});

// ─── Tone adaptation ────────────────────────────────────────

describe('toneStyle adapts to trust memory', () => {
  it('successful past → SUPPORTIVE tone', () => {
    const v = buildTrustExplanation({
      recommendation: { id: 'rec', urgency: 'low' },
      memory: [
        { recommendationId: 'rec', action: TRUST_ACTION.SUCCESSFUL, recordedAt: Date.now() },
      ],
    });
    expect(v.toneStyle).toBe(TONE.SUPPORTIVE);
  });

  it('multiple ignored → GENTLE_FOLLOWUP', () => {
    const v = buildTrustExplanation({
      recommendation: { id: 'rec', urgency: 'low' },
      memory: [
        { recommendationId: 'rec', action: TRUST_ACTION.IGNORED, recordedAt: Date.now() },
        { recommendationId: 'rec', action: TRUST_ACTION.IGNORED, recordedAt: Date.now() },
      ],
    });
    expect(v.toneStyle).toBe(TONE.GENTLE_FOLLOWUP);
  });

  it('disputed → OPERATIONAL', () => {
    const v = buildTrustExplanation({
      recommendation: { id: 'rec', urgency: 'low' },
      memory: [
        { recommendationId: 'rec', action: TRUST_ACTION.DISPUTED, recordedAt: Date.now() },
      ],
    });
    expect(v.toneStyle).toBe(TONE.OPERATIONAL);
  });

  it('default → CALM', () => {
    const v = buildTrustExplanation({
      recommendation: { id: 'rec', urgency: 'low' },
    });
    expect(v.toneStyle).toBe(TONE.CALM);
  });
});

// ─── whyAppeared / whatToMonitor ────────────────────────────

describe('whyAppeared composition', () => {
  it('uses the recommendation\'s own reason when provided', () => {
    const v = buildTrustExplanation({
      recommendation: {
        id: 'r',
        urgency: 'medium',
        reason: { key: 'r.k', fallback: 'because of the scan' },
      },
    });
    expect(v.whyAppeared.key).toBe('r.k');
    expect(v.whyAppeared.fallback).toBe('because of the scan');
  });

  it('falls back to "signals combined" when there\'s no reason but signals fired', () => {
    const v = buildTrustExplanation({
      recommendation: { id: 'r', urgency: 'low' },
      signals: { weather: { temp: 35 } },
    });
    expect(['trust.why.signalsCombined', 'trust.why.fallback']).toContain(v.whyAppeared.key);
  });

  it('falls back to "successful" copy when past memory says so', () => {
    const v = buildTrustExplanation({
      recommendation: { id: 'rec', urgency: 'low' },
      memory: [{ recommendationId: 'rec', action: TRUST_ACTION.SUCCESSFUL, recordedAt: Date.now() }],
      signals: { weather: { temp: 35 } },
    });
    expect(v.whyAppeared.key).toBe('trust.why.successful');
  });
});

describe('whatToMonitor composition', () => {
  it('emits a re-scan hint when a scan signal fires', () => {
    const v = buildTrustExplanation({
      recommendation: { id: 'r' },
      signals: { scan: { severity: 'moderate' } },
    });
    expect(v.whatToMonitor).toBeTruthy();
    expect(v.whatToMonitor.key).toBe('trust.monitor.scan');
  });

  it('passes through the recommendation\'s followUp when no scan signal', () => {
    const v = buildTrustExplanation({
      recommendation: {
        id: 'r',
        followUp: { key: 'custom.followup', fallback: 'Do X tomorrow.' },
      },
    });
    expect(v.whatToMonitor).toBeTruthy();
    expect(v.whatToMonitor.key).toBe('custom.followup');
  });

  it('emits null when nothing meaningful to monitor', () => {
    const v = buildTrustExplanation({
      recommendation: { id: 'r' },
    });
    expect(v.whatToMonitor).toBeNull();
  });
});

// ─── Trust memory persistence ───────────────────────────────

describe('trust memory persistence', () => {
  beforeEach(() => { _stubLocalStorage(); clearTrustMemory(); });

  it('recordTrustAction → getTrustHistoryFor roundtrip', () => {
    const row = recordTrustAction('rec-1', TRUST_ACTION.ACCEPTED, { crop: 'tomato' });
    expect(row).toBeTruthy();
    expect(row.recommendationId).toBe('rec-1');
    expect(row.action).toBe(TRUST_ACTION.ACCEPTED);
    const hist = getTrustHistoryFor('rec-1');
    expect(hist.length).toBe(1);
  });

  it('rejects invalid actions', () => {
    expect(recordTrustAction('rec-1', 'made_up')).toBeNull();
    expect(recordTrustAction('', TRUST_ACTION.ACCEPTED)).toBeNull();
    expect(recordTrustAction(null, TRUST_ACTION.ACCEPTED)).toBeNull();
  });

  it('clearTrustMemory wipes the log', () => {
    recordTrustAction('rec-1', TRUST_ACTION.ACCEPTED);
    clearTrustMemory();
    expect(getTrustMemory().length).toBe(0);
  });

  it('caps the buffer (MAX_ACTIONS = 200)', () => {
    for (let i = 0; i < 250; i++) {
      recordTrustAction('rec-' + i, TRUST_ACTION.IGNORED);
    }
    expect(getTrustMemory().length).toBeLessThanOrEqual(200);
  });
});

// ─── Noise suppression ──────────────────────────────────────

describe('applyTrustNoiseSuppression', () => {
  it('drops candidates acknowledged in the last 24h', () => {
    const memory = [{
      recommendationId: 'r1',
      action: TRUST_ACTION.ACKNOWLEDGED,
      recordedAt: Date.now() - (1000 * 60 * 60), // 1 hour ago
    }];
    const out = applyTrustNoiseSuppression([
      { id: 'r1', type: 'x' },
      { id: 'r2', type: 'y' },
    ], { memory });
    expect(out.kept.length).toBe(1);
    expect(out.kept[0].id).toBe('r2');
    expect(out.suppressed[0].reason).toBe('acknowledged');
  });

  it('drops candidates ignored ≥ maxIgnores', () => {
    const memory = [];
    for (let i = 0; i < 4; i++) {
      memory.push({
        recommendationId: 'r1',
        action: TRUST_ACTION.IGNORED,
        recordedAt: Date.now() - (i * 1000),
      });
    }
    const out = applyTrustNoiseSuppression([
      { id: 'r1', type: 'x' },
    ], { memory });
    expect(out.kept.length).toBe(0);
    expect(out.suppressed[0].reason).toBe('repeatedly_ignored');
  });

  it('keeps fresh candidates that have no memory at all', () => {
    const out = applyTrustNoiseSuppression([
      { id: 'fresh', type: 'x' },
    ], { memory: [] });
    expect(out.kept.length).toBe(1);
  });

  it('never throws on garbage', () => {
    expect(() => applyTrustNoiseSuppression(null)).not.toThrow();
    expect(() => applyTrustNoiseSuppression(undefined, {})).not.toThrow();
    expect(() => applyTrustNoiseSuppression('string', null)).not.toThrow();
  });
});

// ─── deriveTrustTone ────────────────────────────────────────

describe('deriveTrustTone', () => {
  it('counts each action class accurately', () => {
    const memory = [
      { recommendationId: 'r1', action: TRUST_ACTION.IGNORED,    recordedAt: 1 },
      { recommendationId: 'r1', action: TRUST_ACTION.IGNORED,    recordedAt: 2 },
      { recommendationId: 'r1', action: TRUST_ACTION.SUCCESSFUL, recordedAt: 3 },
    ];
    const tone = deriveTrustTone(memory, 'r1');
    expect(tone.ignoredCount).toBe(2);
    expect(tone.successfulCount).toBe(1);
    expect(tone.lastActionMs).toBe(3);
  });

  it('filters by recommendationId when provided', () => {
    const memory = [
      { recommendationId: 'a', action: TRUST_ACTION.IGNORED, recordedAt: 1 },
      { recommendationId: 'b', action: TRUST_ACTION.IGNORED, recordedAt: 2 },
    ];
    const tone = deriveTrustTone(memory, 'a');
    expect(tone.ignoredCount).toBe(1);
  });
});

// ─── Calm UX contract ───────────────────────────────────────

describe('calm UX contract', () => {
  it('never emits raw percentages in any fallback', () => {
    const v = buildTrustExplanation({
      recommendation: { id: 'r', urgency: 'medium' },
      signals: { weather: { temp: 35, rainProbability24hPct: 70 } },
    });
    const allText = [
      v.confidenceLabel.fallback,
      v.whyAppeared.fallback,
      v.urgencyLabel.fallback,
      ...(v.signals.map((s) => s.fallback)),
    ].join(' ');
    // No "%" in any rendered fallback.
    expect(allText).not.toMatch(/%/);
    // No "AI" / "model" / "neural" leaks.
    expect(allText.toLowerCase()).not.toMatch(/\b(ai|model|neural|probability)\b/);
  });
});
