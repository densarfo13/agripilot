/**
 * experienceModeLayer.test.js — verifies the Simple / Standard
 * presentation layer. No new intelligence — just shape changes.
 */

// localStorage shim for the preference reads.
const _s = new Map();
const _ls = {
  getItem:    (k) => (_s.has(k) ? _s.get(k) : null),
  setItem:    (k, v) => { _s.set(k, String(v)); },
  removeItem: (k) => { _s.delete(k); },
  clear:      () => { _s.clear(); },
};
if (typeof globalThis.window === 'undefined') globalThis.window = { localStorage: _ls };
else if (!globalThis.window.localStorage) globalThis.window.localStorage = _ls;

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EXPERIENCE_MODE,
  getExperienceMode, setExperienceMode, clearExperienceMode,
  isSimpleMode, isStandardMode, getExperienceModeMeta,
} from '../../../src/core/experience/experienceMode.js';
import {
  formatRecommendationForMode,
  formatScanResultForMode,
  formatTaskForMode,
  formatWeatherInsightForMode,
  formatNotificationForMode,
} from '../../../src/core/experience/renderByExperienceMode.js';

// ─── experienceMode store ─────────────────────────────────

describe('experienceMode store', () => {
  beforeEach(() => { _s.clear(); clearExperienceMode(); });

  it('defaults to simple', () => {
    expect(getExperienceMode()).toBe(EXPERIENCE_MODE.SIMPLE);
    expect(isSimpleMode()).toBe(true);
    expect(isStandardMode()).toBe(false);
  });

  it('persists standard', () => {
    setExperienceMode('standard');
    expect(getExperienceMode()).toBe(EXPERIENCE_MODE.STANDARD);
    expect(isStandardMode()).toBe(true);
  });

  it('coerces unknown values to simple', () => {
    setExperienceMode('expert_pro_max');
    expect(getExperienceMode()).toBe(EXPERIENCE_MODE.SIMPLE);
  });

  it('bridges from the legacy "experienced" preference', () => {
    _s.set('farroway:experience_level', 'experienced');
    expect(getExperienceMode()).toBe(EXPERIENCE_MODE.STANDARD);
  });

  it('getExperienceModeMeta exposes labels + density flags', () => {
    setExperienceMode('simple');
    const meta = getExperienceModeMeta();
    expect(meta.mode).toBe('simple');
    expect(meta.label.key).toBe('experience.simple');
    expect(meta.detailLevel).toBe('low');
    expect(meta.uiDensity).toBe('spacious');
  });
});

// ─── recommendation formatter ────────────────────────────

describe('formatRecommendationForMode', () => {
  const rec = {
    title:   { key: 't.title', fallback: 'Water tomato today' },
    reason:  { key: 't.why',   fallback: 'Hot day expected.' },
    urgency: 'normal',
    bestTime:'morning',
    confidence: 'firm',
    microHelp: { key: 'help', fallback: 'Steady watering keeps plants healthy.' },
  };

  it('simple mode keeps title + reason only', () => {
    const v = formatRecommendationForMode(rec, 'simple');
    expect(v.mode).toBe('simple');
    expect(v.title).toBeTruthy();
    expect(v.reason).toBeTruthy();
    expect(v.urgency).toBeUndefined();
    expect(v.confidence).toBeUndefined();
  });

  it('standard mode keeps the operational details', () => {
    const v = formatRecommendationForMode(rec, 'standard');
    expect(v.mode).toBe('standard');
    expect(v.urgency).toBe('normal');
    expect(v.bestTime).toBe('morning');
    expect(v.confidence).toBe('firm');
    expect(v.microHelp).toBeTruthy();
  });

  it('never throws on garbage input', () => {
    expect(() => formatRecommendationForMode(null, 'simple')).not.toThrow();
    expect(formatRecommendationForMode(null, 'simple')).toBe(null);
  });
});

// ─── task formatter ──────────────────────────────────────

describe('formatTaskForMode', () => {
  const task = {
    title: { key: 'k', fallback: 'Water tomatoes' },
    reason: { key: 'why', fallback: 'Heat expected.' },
    bestTime: 'morning', urgency: 'normal', actionType: 'water',
  };
  it('simple drops bestTime / urgency / source', () => {
    const v = formatTaskForMode(task, 'simple');
    expect(v.title).toBeTruthy();
    expect(v.reason).toBeTruthy();
    expect(v.bestTime).toBeUndefined();
    expect(v.urgency).toBeUndefined();
  });
  it('standard keeps them', () => {
    const v = formatTaskForMode(task, 'standard');
    expect(v.bestTime).toBe('morning');
    expect(v.urgency).toBe('normal');
    expect(v.source).toBe('water');
  });
});

// ─── scan result formatter ───────────────────────────────

describe('formatScanResultForMode — no raw confidence in simple', () => {
  const result = {
    whatWeNoticed:    { key: 'noticed', fallback: 'Possible leaf spots on tomato.' },
    whatToCheckNext:  { key: 'next',    fallback: 'Check spread tomorrow.' },
    possibleIssue:    { key: 'issue',   fallback: 'Possible leaf spot' },
    confidence:       'likely',
    confidenceLabel:  'high',
    safetyNote:       { key: 'safe',    fallback: 'Consult a local expert.' },
    urgency:          'normal',
    followUpTask:     { titleKey: 'k', titleFallback: 'Re-check tomorrow' },
  };

  it('simple mode strips raw confidence + technical fields', () => {
    const v = formatScanResultForMode(result, 'simple');
    expect(v.whatWeFound).toBeTruthy();
    expect(v.whatToDoNext).toBeTruthy();
    expect(v.confidenceLabel).toBeUndefined();
    expect(v.confidence).toBeUndefined();
    expect(v.urgency).toBeUndefined();
  });

  it('standard mode keeps the confidence label + safety note + follow-up', () => {
    const v = formatScanResultForMode(result, 'standard');
    expect(v.confidence).toBe('likely');
    expect(v.confidenceLabel).toBe('high');
    expect(v.safetyNote).toBeTruthy();
    expect(v.followUpTask).toBeTruthy();
  });
});

// ─── weather formatter ───────────────────────────────────

describe('formatWeatherInsightForMode', () => {
  const insight = {
    localizedMessage: { key: 'wx.m', fallback: 'Rain expected. You may delay watering.' },
    severity: 'normal', type: 'watering', advice: 'Delay irrigation.',
  };

  it('simple mode = message only', () => {
    const v = formatWeatherInsightForMode(insight, 'simple');
    expect(v.message).toBeTruthy();
    expect(v.severity).toBeUndefined();
    expect(v.advice).toBeUndefined();
  });

  it('standard mode keeps severity + advice', () => {
    const v = formatWeatherInsightForMode(insight, 'standard');
    expect(v.severity).toBe('normal');
    expect(v.advice).toBe('Delay irrigation.');
  });
});

// ─── notification formatter ──────────────────────────────

describe('formatNotificationForMode', () => {
  const n = {
    id: 'n1', kind: 'task_reminder', urgency: 'normal',
    title: 'Check tomato leaves today',
    body:  'Recent rain raises fungal risk — inspect lower leaves.',
    language: 'en',
  };
  it('simple mode keeps title only — drops the body line', () => {
    const v = formatNotificationForMode(n, 'simple');
    expect(v.title).toBe(n.title);
    expect(v.body).toBe('');
  });
  it('standard mode keeps both', () => {
    const v = formatNotificationForMode(n, 'standard');
    expect(v.body).toMatch(/fungal|inspect/i);
    expect(v.urgency).toBe('normal');
  });
});
