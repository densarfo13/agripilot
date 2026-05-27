/**
 * signalQualityTrust.test.js — Signal Quality + Trust Intelligence
 * Upgrade regression suite.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  scoreSignalQuality, SIGNAL_QUALITY,
} from '../../../src/core/intelligence/signalQualityEngine.js';
import {
  gateAlert, recordAlertShown, getCooldowns, clearAlertHistory,
  _internal as fatigueInternal,
} from '../../../src/core/intelligence/alertFatigueEngine.js';
import {
  recordSeasonEvent, getMultiSeasonSnapshot, getSeasonEvents,
  clearSeasonMemory, SEASON_EVENT,
} from '../../../src/core/intelligence/multiSeasonMemory.js';
import {
  probeCausalReadiness, registerCausalProvider, CAUSAL_QUESTION,
} from '../../../src/core/intelligence/causalLearningFacade.js';
import {
  applyRecommendationTrust,
} from '../../../src/core/intelligence/recommendationTrustEngine.js';

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
  clearAlertHistory();
  clearSeasonMemory();
  registerCausalProvider(null);
});

// ═══ §1 signalQualityEngine ══════════════════════════════════

describe('scoreSignalQuality', () => {
  it('empty input → INSUFFICIENT', () => {
    const v = scoreSignalQuality({});
    expect(v.signalQuality).toBe(SIGNAL_QUALITY.INSUFFICIENT);
    expect(v.trustScore).toBeLessThanOrEqual(0.20);
  });

  it('many strong signals → HIGH', () => {
    const now = Date.now();
    const v = scoreSignalQuality({
      weather:    { fetchedAt: now - 30 * 60 * 1000 },
      scans:      [{ id: 's1' }, { id: 's2' }],
      cropStage:  'flowering', region: 'Ashanti',
      taskCompletion:  [{ completed: true }, { completed: true }, { completed: false }],
      outcomeFeedback: [{ outcome: 'improved' }, { outcome: 'resolved' }, { outcome: 'resolved' }],
      continuityMemory: { resolvedCount: 5 },
      nowMs: now,
    });
    expect(v.signalQuality).toBe(SIGNAL_QUALITY.HIGH);
    expect(v.trustScore).toBeGreaterThan(0.7);
  });

  it('stale weather → penalty + flagged', () => {
    const now = Date.now();
    const v = scoreSignalQuality({
      weather:    { fetchedAt: now - 4 * 60 * 60 * 1000 },
      scans:      [{ id: 's1' }],
      cropStage:  'flowering', region: 'Ashanti',
      nowMs: now,
    });
    expect(v.suppressedSignals.some((s) => s.kind === 'weather')).toBe(true);
  });

  it('no scans + no tasks → combined penalty', () => {
    const v = scoreSignalQuality({
      weather: { fetchedAt: Date.now() - 10 * 60 * 1000 },
      cropStage: 'flowering', region: 'Ashanti',
    });
    expect(v.suppressedSignals.some((s) => s.kind === 'no_activity')).toBe(true);
  });

  it('garbage never throws', () => {
    expect(() => scoreSignalQuality(null)).not.toThrow();
    expect(() => scoreSignalQuality('hi')).not.toThrow();
  });
});

// ═══ §2 recommendationTrustEngine ════════════════════════════

describe('applyRecommendationTrust', () => {
  it('empty input returns frozen fallback', () => {
    const v = applyRecommendationTrust({});
    expect(v.engineVersion).toBe('rec-trust-v1');
    expect(v.trustedRecommendations.length).toBe(0);
    expect(['high', 'medium', 'low']).toContain(v.trustConfidence);
  });

  it('insufficient signal quality suppresses non-urgent candidates', () => {
    const v = applyRecommendationTrust({
      candidates: [
        { candidateId: 'marketplace_match', urgency: 'low' },
        { candidateId: 'crop_survival_frost', urgency: 'high' },
      ],
      signalQuality: scoreSignalQuality({}),
    });
    const ids = v.trustedRecommendations.map((c) => c.candidateId);
    expect(ids).toContain('crop_survival_frost');
    expect(ids).not.toContain('marketplace_match');
    expect(v.suppressed.some((s) => s.reason === 'low_signal_quality')).toBe(true);
  });

  it('repetitive advice suppressed when prior tick had the same id', () => {
    const v = applyRecommendationTrust({
      candidates: [{ candidateId: 'watering_routine', urgency: 'low' }],
      priorRecommendations: ['watering_routine'],
    });
    expect(v.trustedRecommendations.length).toBe(0);
    expect(v.suppressed[0].reason).toBe('recently_shown');
  });

  it('contradiction: watering + rain-skip drops watering', () => {
    const v = applyRecommendationTrust({
      candidates: [
        { candidateId: 'watering_routine',     urgency: 'medium' },
        { candidateId: 'weather_protect_rain', urgency: 'medium' },
      ],
    });
    const ids = v.trustedRecommendations.map((c) => c.candidateId);
    expect(ids).toContain('weather_protect_rain');
    expect(ids).not.toContain('watering_routine');
  });

  it('garbage never throws', () => {
    expect(() => applyRecommendationTrust(null)).not.toThrow();
  });
});

// ═══ §5 alertFatigueEngine ═══════════════════════════════════

describe('alertFatigueEngine', () => {
  it('first show allowed', () => {
    const v = gateAlert({ candidateId: 'rec-1', urgency: 'high' });
    expect(v.allowed).toBe(true);
    expect(v.reason).toBe('within_budget');
  });

  it('second show within cooldown is blocked', () => {
    recordAlertShown('rec-1', 'high');
    const v = gateAlert({ candidateId: 'rec-1', urgency: 'high' });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('urgency_cooldown');
    expect(v.msUntilNextAllowed).toBeGreaterThan(0);
  });

  it('repeated-ignore doubles the cooldown', () => {
    recordAlertShown('rec-1', 'low');
    // Time-travel 23h later — still under 24h × 2 = 48h.
    const futureMs = Date.now() + (23 * 60 * 60 * 1000);
    const v = gateAlert({ candidateId: 'rec-1', urgency: 'low',
      ignoredCount: 2, nowMs: futureMs });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('repeated_ignore_cooldown');
  });

  it('per-day cap at 6 distinct shows', () => {
    for (let i = 0; i < 6; i++) recordAlertShown('rec-' + i, 'high');
    const v = gateAlert({ candidateId: 'rec-new', urgency: 'high' });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('per_day_cap_reached');
  });

  it('no candidate id → blocked safely', () => {
    expect(gateAlert({}).allowed).toBe(false);
    expect(gateAlert({}).reason).toBe('no_candidate_id');
  });

  it('PII keys stripped from recorded meta', () => {
    recordAlertShown('rec-1', 'high', {
      userId: 'u-42', phone: '+1', lat: 6.7, ok: true,
    });
    const cd = getCooldowns();
    const json = JSON.stringify(cd);
    expect(json).not.toContain('u-42');
    expect(json).not.toContain('+1');
    expect(json).not.toContain('6.7');
  });

  it('garbage never throws', () => {
    expect(() => gateAlert(null)).not.toThrow();
    expect(() => recordAlertShown(null, 'high')).not.toThrow();
  });
});

// ═══ §8 multiSeasonMemory ════════════════════════════════════

describe('multiSeasonMemory', () => {
  it('recordSeasonEvent + getSeasonEvents roundtrip', () => {
    recordSeasonEvent(SEASON_EVENT.DISEASE_DETECTED, {
      crop: 'pepper', region: 'Ashanti', issueCategory: 'leaf_spots',
      atMs: Date.parse('2024-07-15'),
    });
    const events = getSeasonEvents();
    expect(events.length).toBe(1);
    expect(events[0].crop).toBe('pepper');
    expect(events[0].season).toBe('summer');
    expect(events[0].year).toBe(2024);
  });

  it('rejects invalid event kinds', () => {
    expect(recordSeasonEvent('made_up', {})).toBeNull();
  });

  it('garbage never throws', () => {
    expect(() => recordSeasonEvent(null, null)).not.toThrow();
    expect(() => getMultiSeasonSnapshot(null)).not.toThrow();
  });

  it('multi-year recurring cycles detected', () => {
    recordSeasonEvent(SEASON_EVENT.DISEASE_DETECTED, {
      crop: 'pepper', region: 'A', issueCategory: 'leaf_spots',
      atMs: Date.parse('2023-07-15'),
    });
    recordSeasonEvent(SEASON_EVENT.DISEASE_DETECTED, {
      crop: 'pepper', region: 'A', issueCategory: 'leaf_spots',
      atMs: Date.parse('2024-07-15'),
    });
    const snap = getMultiSeasonSnapshot({ crop: 'pepper', region: 'A' });
    expect(snap.recurringDiseaseCycles.length).toBeGreaterThan(0);
    expect(snap.recurringDiseaseCycles[0].category).toBe('leaf_spots');
    expect(snap.seasonsObserved).toBe(2);
    expect(snap.learningDepth).toBe('developing');
  });

  it('intervention outcomes aggregated', () => {
    recordSeasonEvent(SEASON_EVENT.INTERVENTION_OK, {
      crop: 'pepper', intervention: 'neem_spray',
      atMs: Date.parse('2024-07-15'),
    });
    recordSeasonEvent(SEASON_EVENT.INTERVENTION_BAD, {
      crop: 'pepper', intervention: 'neem_spray',
      atMs: Date.parse('2024-08-01'),
    });
    const snap = getMultiSeasonSnapshot({ crop: 'pepper' });
    expect(snap.interventionOutcomes.neem_spray.helped).toBe(1);
    expect(snap.interventionOutcomes.neem_spray.ignored).toBe(1);
  });

  it('learning depth is rich after 3 seasons + 20+ events', () => {
    for (let i = 0; i < 21; i++) {
      const month = (i % 12) + 1;
      recordSeasonEvent(SEASON_EVENT.DISEASE_DETECTED, {
        crop: 'pepper', issueCategory: 'leaf_spots',
        atMs: Date.parse('2023-' + String(month).padStart(2, '0') + '-15'),
      });
    }
    const snap = getMultiSeasonSnapshot({ crop: 'pepper' });
    expect(snap.learningDepth).toBe('rich');
  });
});

// ═══ §7 causalLearningFacade ═════════════════════════════════

describe('probeCausalReadiness', () => {
  it('returns unavailable without a provider', () => {
    const v = probeCausalReadiness({
      question: CAUSAL_QUESTION.INTERVENTION_TO_OUTCOME,
    });
    expect(v.causalReadiness).toBe('unavailable');
  });

  it('rejects invalid questions', () => {
    const v = probeCausalReadiness({ question: 'made_up' });
    expect(v.question).toBeNull();
    expect(v.reasonHidden).toBe('no_question');
  });

  it('data sufficiency thresholds', () => {
    const v = probeCausalReadiness({
      question: CAUSAL_QUESTION.INTERVENTION_TO_OUTCOME,
      dataset: {
        events: new Array(30), scans: new Array(20), outcomes: new Array(20),
      },
    });
    expect(v.dataSufficiency).toBe('rich');
  });

  it('with provider + flag still off → unavailable (flag gates)', () => {
    registerCausalProvider(() => ({ causalReadiness: 'ready' }));
    const v = probeCausalReadiness({
      question: CAUSAL_QUESTION.INTERVENTION_TO_OUTCOME,
    });
    // YIELD_PREDICTION flag is OFF by default → still unavailable.
    expect(v.causalReadiness).toBe('unavailable');
    expect(v.reasonHidden).toBe('flag_off');
  });

  it('garbage never throws', () => {
    expect(() => probeCausalReadiness(null)).not.toThrow();
  });
});

// ═══ Calm wording ═══════════════════════════════════════════

describe('Calm wording — no AI / % across signal-trust outputs', () => {
  it('signalQuality output has no raw AI / panic copy', () => {
    const v = scoreSignalQuality({});
    const json = JSON.stringify(v);
    expect(json).not.toMatch(/%/);
    expect(json.toLowerCase()).not.toMatch(/\b(ai|neural|panic|urgent|emergency)\b/);
  });

  it('alert fatigue cooldowns have no PII or panic verbs', () => {
    const cd = getCooldowns();
    const json = JSON.stringify(cd);
    expect(json.toLowerCase()).not.toMatch(/\b(panic|urgent|emergency)\b/);
  });
});

// ═══ _internal ═══════════════════════════════════════════════

describe('_internal helpers', () => {
  it('alertFatigue cooldown windows are 4h / 12h / 24h', () => {
    const w = fatigueInternal._COOLDOWN_BY_URGENCY;
    expect(w.high).toBe(4 * 60 * 60 * 1000);
    expect(w.medium).toBe(12 * 60 * 60 * 1000);
    expect(w.low).toBe(24 * 60 * 60 * 1000);
  });
});
