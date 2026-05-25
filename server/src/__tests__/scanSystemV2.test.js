/**
 * scanSystemV2.test.js — verifies the World-Class Scan System v2
 * additions:
 *   • scanImageStore.js          (facade)
 *   • scanFollowupEngine.js      (follow-up plan generator)
 *   • diseaseMemory.js           (recurring + recovery tracker)
 *   • scanProgressionTimeline.js (before/after + health indicator)
 *   • scanStreakEngine.js        (streak + scan reminder)
 *   • scanI18nAudit.js           (window.__scanI18nAudit hook)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  storeStableScanImage as storeScanImage,
  getCurrentScanImage,
  clearScanImage,
  isValidForAnalysis,
} from '../../../src/core/scan/scanImageStore.js';
import { buildFollowupPlan }
  from '../../../src/core/scan/scanFollowupEngine.js';
import {
  summariseDiseaseMemory, isRecurringIssue,
  recoveryTrendFor, seasonalPatternFor,
} from '../../../src/core/scan/diseaseMemory.js';
import {
  buildProgressionTimeline, pairBeforeAfter, healthIndicator,
} from '../../../src/core/scan/scanProgressionTimeline.js';
import {
  computeScanStreak, scanReminderDue,
} from '../../../src/core/scan/scanStreakEngine.js';
import {
  runScanI18nAudit, installScanI18nAuditHook,
} from '../../../src/core/scan/scanI18nAudit.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 5, 1);

// ─── scanImageStore facade ────────────────────────────────

describe('scanImageStore facade', () => {
  beforeEach(() => clearScanImage());

  it('re-exports the canonical store API', () => {
    expect(typeof storeScanImage).toBe('function');
    expect(typeof getCurrentScanImage).toBe('function');
    expect(typeof isValidForAnalysis).toBe('function');
  });
});

// ─── scanFollowupEngine ───────────────────────────────────

describe('buildFollowupPlan', () => {
  it('fungal_risk → recheck task + base-water prevention + hedged disclaimer', () => {
    const p = buildFollowupPlan({
      issueCategory:   'fungal_risk',
      confidenceLabel: 'medium',
      crop:            'tomato',
      stage:           'flowering',
      weather:         { humidityPct: 88, rainProbability24hPct: 60 },
      nowMs:           NOW,
    });
    expect(p.ok).toBe(true);
    expect(p.followupTask.fallback).toMatch(/check|leaves/i);
    expect(p.preventionTip.fallback).toMatch(/airflow|base/i);
    expect(p.reminder.atMs).toBeGreaterThan(NOW);
    expect(p.disclaimer.fallback).toMatch(/local conditions|starting point/i);
  });

  it('needs_review → returns ok:false with the "choose a clearer photo" envelope', () => {
    const p = buildFollowupPlan({
      issueCategory:   'unknown_needs_clearer_photo',
      confidenceLabel: 'needs_review',
      crop:            'tomato',
      nowMs:           NOW,
    });
    expect(p.ok).toBe(false);
    expect(p.reason).toBe('needs_review');
    expect(p.followupTask).toBe(null);
    expect(p.preventionTip.fallback).toMatch(/clearer photo/i);
  });

  it('high-confidence fungal recheck is tighter than medium-confidence', () => {
    const high = buildFollowupPlan({
      issueCategory: 'fungal_risk', confidenceLabel: 'high', crop: 'tomato', nowMs: NOW,
    });
    const med = buildFollowupPlan({
      issueCategory: 'fungal_risk', confidenceLabel: 'medium', crop: 'tomato', nowMs: NOW,
    });
    expect(high.reminder.atMs).toBeLessThan(med.reminder.atMs);
  });

  it('recurrence message changes with scan history depth', () => {
    const firstTime = buildFollowupPlan({
      issueCategory: 'fungal_risk', confidenceLabel: 'medium', crop: 'tomato',
      scanHistory: [], nowMs: NOW,
    });
    const secondTime = buildFollowupPlan({
      issueCategory: 'fungal_risk', confidenceLabel: 'medium', crop: 'tomato',
      scanHistory: [{ issueCategory: 'fungal_risk' }],
      nowMs: NOW,
    });
    const recurring = buildFollowupPlan({
      issueCategory: 'fungal_risk', confidenceLabel: 'medium', crop: 'tomato',
      scanHistory: [
        { issueCategory: 'fungal_risk' },
        { issueCategory: 'fungal_risk' },
        { issueCategory: 'fungal_risk' },
      ],
      nowMs: NOW,
    });
    expect(firstTime.recurrenceCheck.fallback).toMatch(/first time/i);
    expect(secondTime.recurrenceCheck.fallback).toMatch(/second time|watching/i);
    expect(recurring.recurrenceCheck.fallback).toMatch(/recurring|review/i);
  });

  it('hedged wording — no "treat with" / "guaranteed" anywhere', () => {
    const samples = [
      buildFollowupPlan({ issueCategory: 'fungal_risk',    confidenceLabel: 'high',   crop: 't', nowMs: NOW }),
      buildFollowupPlan({ issueCategory: 'pest_damage',    confidenceLabel: 'high',   crop: 'm', nowMs: NOW }),
      buildFollowupPlan({ issueCategory: 'nutrient_stress',confidenceLabel: 'medium', crop: 'p', nowMs: NOW }),
      buildFollowupPlan({ issueCategory: 'healthy',        confidenceLabel: 'high',   crop: 't', nowMs: NOW }),
    ];
    for (const p of samples) {
      const blob = JSON.stringify(p);
      expect(blob.toLowerCase()).not.toMatch(/treat with|apply chemical|guaranteed|definitely/);
    }
  });

  it('never throws on garbage input', () => {
    expect(() => buildFollowupPlan(null)).not.toThrow();
    // Empty/null context still produces a generic ok:true plan
    // (issue defaults to 'unknown', confidence to 'low'), so the
    // surface always has SOMETHING calm to render — the safety
    // gate is the dedicated needs_review branch tested above.
    const r = buildFollowupPlan(null);
    expect(typeof r.ok).toBe('boolean');
  });
});

// ─── diseaseMemory ────────────────────────────────────────

describe('summariseDiseaseMemory', () => {
  it('flags recurring issues with count + last-seen', () => {
    const m = summariseDiseaseMemory({
      scanHistory: [
        { issueCategory: 'fungal_risk', createdAt: NOW - 30 * DAY },
        { issueCategory: 'fungal_risk', createdAt: NOW - 15 * DAY },
        { issueCategory: 'pest_damage', createdAt: NOW - 5 * DAY },
      ],
      nowMs: NOW,
    });
    const fungal = m.recurringIssues.find((x) => x.issue === 'fungal_risk');
    expect(fungal).toBeTruthy();
    expect(fungal.count).toBe(2);
    expect(fungal.lastSeenMs).toBe(NOW - 15 * DAY);
    // pest_damage has only 1 occurrence → not recurring
    expect(m.recurringIssues.find((x) => x.issue === 'pest_damage')).toBeUndefined();
  });

  it('computes recovery success rate from followupOutcome', () => {
    const m = summariseDiseaseMemory({
      scanHistory: [
        { issueCategory: 'fungal_risk', followupOutcome: 'recovered' },
        { issueCategory: 'fungal_risk', followupOutcome: 'recovered' },
        { issueCategory: 'pest_damage', followupOutcome: 'ignored'   },
      ],
      nowMs: NOW,
    });
    // 2 of 3 with an outcome were positive (improved/recovered) = 0.67
    expect(m.recoverySuccess).toBeCloseTo(0.67, 2);
  });

  it('ignored alerts surface their count per issue', () => {
    const m = summariseDiseaseMemory({
      scanHistory: [
        { issueCategory: 'fungal_risk', followupOutcome: 'ignored' },
        { issueCategory: 'fungal_risk', followupOutcome: 'ignored' },
        { issueCategory: 'water_stress', followupOutcome: 'ignored' },
      ],
      nowMs: NOW,
    });
    const fungal = m.ignoredAlerts.find((x) => x.issue === 'fungal_risk');
    expect(fungal && fungal.count).toBe(2);
  });

  it('healthy scans never count as a recurring "issue"', () => {
    const m = summariseDiseaseMemory({
      scanHistory: [
        { issueCategory: 'healthy' }, { issueCategory: 'healthy' },
      ],
      nowMs: NOW,
    });
    expect(m.recurringIssues).toEqual([]);
  });

  it('isRecurringIssue: true on ≥ 2 occurrences', () => {
    expect(isRecurringIssue([{ issueCategory: 'fungal_risk' }], 'fungal_risk')).toBe(false);
    expect(isRecurringIssue([
      { issueCategory: 'fungal_risk' },
      { issueCategory: 'fungal_risk' },
    ], 'fungal_risk')).toBe(true);
  });

  it('recoveryTrendFor returns issue + attempted + successRate', () => {
    const r = recoveryTrendFor([
      { issueCategory: 'fungal_risk', followupOutcome: 'recovered' },
      { issueCategory: 'fungal_risk', followupOutcome: 'unchanged' },
    ], 'fungal_risk');
    expect(r.issue).toBe('fungal_risk');
    expect(r.attempted).toBe(2);
    expect(r.successRate).toBeCloseTo(0.5, 2);
  });

  it('seasonalPatternFor returns the months an issue was seen', () => {
    const months = seasonalPatternFor([
      { issueCategory: 'fungal_risk', createdAt: Date.UTC(2026, 0, 1) }, // Jan
      { issueCategory: 'fungal_risk', createdAt: Date.UTC(2026, 5, 1) }, // Jun
      { issueCategory: 'fungal_risk', createdAt: Date.UTC(2025, 5, 1) }, // Jun
    ], 'fungal_risk');
    expect(months).toEqual([1, 6]);
  });

  it('never throws on garbage input', () => {
    expect(() => summariseDiseaseMemory(null)).not.toThrow();
  });
});

// ─── scanProgressionTimeline ──────────────────────────────

describe('buildProgressionTimeline + pairBeforeAfter + healthIndicator', () => {
  const history = [
    { id: 'a', issueCategory: 'fungal_risk', confidenceLabel: 'high',   createdAt: NOW - 14 * DAY },
    { id: 'b', issueCategory: 'fungal_risk', confidenceLabel: 'medium', createdAt: NOW - 7  * DAY },
    { id: 'c', issueCategory: 'fungal_risk', confidenceLabel: 'low',    createdAt: NOW - 1  * DAY, followupOutcome: 'improved' },
  ];

  it('timeline returns entries sorted oldest → newest', () => {
    const tl = buildProgressionTimeline({ scanHistory: history, issueCategory: 'fungal_risk' });
    expect(tl.entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('pairBeforeAfter returns the most-recent pair', () => {
    const pair = pairBeforeAfter({ scanHistory: history, issueCategory: 'fungal_risk' });
    expect(pair.before.id).toBe('b');
    expect(pair.after.id).toBe('c');
  });

  it('pairBeforeAfter returns null with < 2 scans', () => {
    expect(pairBeforeAfter({ scanHistory: [history[0]] })).toBe(null);
  });

  it('healthIndicator improving when confidence drops + outcome positive', () => {
    expect(healthIndicator({ scanHistory: history, issueCategory: 'fungal_risk' }))
      .toBe('improving');
  });

  it('healthIndicator declining when confidence rises', () => {
    const decliningHistory = [
      { id: 'a', issueCategory: 'fungal_risk', confidenceLabel: 'low',  createdAt: NOW - 7 * DAY },
      { id: 'b', issueCategory: 'fungal_risk', confidenceLabel: 'high', createdAt: NOW - 1 * DAY },
    ];
    expect(healthIndicator({ scanHistory: decliningHistory, issueCategory: 'fungal_risk' }))
      .toBe('declining');
  });

  it('healthIndicator unknown with < 2 scans', () => {
    expect(healthIndicator({ scanHistory: [history[0]] })).toBe('unknown');
  });
});

// ─── scanStreakEngine ─────────────────────────────────────

describe('computeScanStreak + scanReminderDue', () => {
  it('empty history → zero streak', () => {
    const s = computeScanStreak({ scanHistory: [], nowMs: NOW });
    expect(s.currentStreakDays).toBe(0);
    expect(s.lastScanMs).toBe(null);
  });

  it('3 consecutive days → current streak 3, hot streak true', () => {
    const s = computeScanStreak({
      scanHistory: [
        { createdAt: NOW - 2 * DAY },
        { createdAt: NOW - 1 * DAY },
        { createdAt: NOW },
      ],
      nowMs: NOW,
    });
    expect(s.currentStreakDays).toBe(3);
    expect(s.isHotStreak).toBe(true);
  });

  it('longest streak reflects the historical max', () => {
    const s = computeScanStreak({
      scanHistory: [
        // 3-day historical streak
        { createdAt: NOW - 30 * DAY },
        { createdAt: NOW - 29 * DAY },
        { createdAt: NOW - 28 * DAY },
        // 1 isolated recent scan
        { createdAt: NOW },
      ],
      nowMs: NOW,
    });
    expect(s.longestStreakDays).toBe(3);
  });

  it('first scan reminder when history is empty', () => {
    const r = scanReminderDue({ scanHistory: [], nowMs: NOW });
    expect(r.due).toBe(true);
    expect(r.kind).toBe('first_scan');
  });

  it('gentle nudge after 7+ idle days', () => {
    const r = scanReminderDue({
      scanHistory: [{ createdAt: NOW - 10 * DAY }],
      nowMs: NOW,
    });
    expect(r.due).toBe(true);
    expect(r.kind).toBe('gentle_nudge');
    expect(r.daysSince).toBeGreaterThanOrEqual(7);
  });

  it('no nudge inside the 7-day window', () => {
    const r = scanReminderDue({
      scanHistory: [{ createdAt: NOW - 2 * DAY }],
      nowMs: NOW,
    });
    expect(r.due).toBe(false);
  });
});

// ─── scanI18nAudit ────────────────────────────────────────

describe('scanI18nAudit', () => {
  beforeEach(() => {
    delete globalThis.window;
    delete globalThis.document;
  });

  it('SSR context → ok:false', () => {
    const r = runScanI18nAudit();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('ssr_context');
  });

  it('English locale → empty candidates even when text exists', () => {
    globalThis.window = { __farrowayLocale: 'en' };
    globalThis.document = {
      documentElement: { lang: 'en' },
      body: { tagName: 'BODY' },
      querySelectorAll: () => [{
        tagName: 'DIV',
        getAttribute: () => null,
        parentElement: null,
      }],
      createTreeWalker: () => ({ nextNode: () => null }),
    };
    const r = runScanI18nAudit();
    expect(r.ok).toBe(true);
    expect(r.isEnglishLocale).toBe(true);
    expect(r.candidates).toEqual([]);
  });

  it('installScanI18nAuditHook attaches window.__scanI18nAudit', () => {
    globalThis.window = {};
    expect(installScanI18nAuditHook()).toBe(true);
    expect(typeof globalThis.window.__scanI18nAudit).toBe('function');
  });

  it('hook is idempotent — does not overwrite an existing function', () => {
    const existing = () => 'pre-existing';
    globalThis.window = { __scanI18nAudit: existing };
    installScanI18nAuditHook();
    expect(globalThis.window.__scanI18nAudit).toBe(existing);
  });

  it('never throws on garbage input', () => {
    expect(() => runScanI18nAudit()).not.toThrow();
    expect(() => runScanI18nAudit({ strict: true })).not.toThrow();
    expect(() => installScanI18nAuditHook()).not.toThrow();
  });
});
