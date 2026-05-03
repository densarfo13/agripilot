import { describe, it, expect } from 'vitest';

/**
 * Live Admin Issue Dashboard — alert-rule unit tests.
 * Covers:
 *   • Each spec rule fires at the right threshold (yellow / red)
 *   • Rules don't fire on quiet metrics
 *   • System-status rollup picks the worst severity
 *   • Top user confusion signals derive cleanly
 *   • Alerts carry stable ids + suggested-action text
 *   • Schema responds with a clean JSON shape (no internals)
 */

import {
  buildAlerts, rollupSystemStatus, topConfusionSignals, _internal,
} from '../modules/events/alerts.js';

const baseMetrics = Object.freeze({
  windowDays: 7,
  sampleSize: 100,
  dau: 12,
  wau: 50,
  taskViewed: 100, taskCompleted: 80, completionRate: 0.80,
  appErrors: 0, screenStuck: 0,
  buyerInterest: 0, fundingViewed: 0, photoUploaded: 10, locationDenied: 0,
  uploadFailed: 0, rateLimitHits: 0, onboardingCompleted: 9,
  farmsCreated: { today: 0, total: 0 },
  growsCreated: { today: 0, total: 0 },
  userTypeSplit: { farmer: 6, backyard: 4, ngo: 0, buyer: 0, other: 0 },
  languageUsage: {},
  topErrors: [], topStuckRoutes: [],
});

describe('buildAlerts — crash rule', () => {
  it('fires yellow on 1 crash', () => {
    const a = buildAlerts({ ...baseMetrics, appErrors: 1, topErrors: [{ key: '/scan', count: 1 }] });
    expect(a.find((x) => x.category === 'crashes').severity).toBe('yellow');
  });

  it('fires red on 3 crashes', () => {
    const a = buildAlerts({ ...baseMetrics, appErrors: 3, topErrors: [{ key: '/scan', count: 3 }] });
    expect(a.find((x) => x.category === 'crashes').severity).toBe('red');
  });

  it('does not fire when 0 crashes', () => {
    const a = buildAlerts(baseMetrics);
    expect(a.find((x) => x.category === 'crashes')).toBeUndefined();
  });

  it('attaches the top affected error route', () => {
    const a = buildAlerts({ ...baseMetrics, appErrors: 2, topErrors: [{ key: '/scan', count: 2 }] });
    const crash = a.find((x) => x.category === 'crashes');
    expect(crash.affected).toContain('/scan');
  });
});

describe('buildAlerts — stuck rule', () => {
  it('fires yellow on 1 stuck event', () => {
    const a = buildAlerts({ ...baseMetrics, screenStuck: 1, topStuckRoutes: [{ key: '/dashboard', count: 1 }] });
    const stuck = a.find((x) => x.category === 'stuck');
    expect(stuck.severity).toBe('yellow');
    expect(stuck.affected).toContain('/dashboard');
  });

  it('does not fire when no stuck events', () => {
    const a = buildAlerts(baseMetrics);
    expect(a.find((x) => x.category === 'stuck')).toBeUndefined();
  });
});

describe('buildAlerts — completion rule', () => {
  it('fires yellow when completion is < 40%', () => {
    const a = buildAlerts({ ...baseMetrics, completionRate: 0.30 });
    expect(a.find((x) => x.category === 'completion').severity).toBe('yellow');
  });

  it('fires red when completion is < 20%', () => {
    const a = buildAlerts({ ...baseMetrics, completionRate: 0.10 });
    expect(a.find((x) => x.category === 'completion').severity).toBe('red');
  });

  it('does NOT fire when there is no task traffic', () => {
    const a = buildAlerts({ ...baseMetrics, completionRate: 0.10, taskViewed: 0 });
    expect(a.find((x) => x.category === 'completion')).toBeUndefined();
  });

  it('does NOT fire when completion is healthy', () => {
    const a = buildAlerts({ ...baseMetrics, completionRate: 0.65 });
    expect(a.find((x) => x.category === 'completion')).toBeUndefined();
  });
});

describe('buildAlerts — upload rule', () => {
  it('fires yellow when upload_failed > 5', () => {
    const a = buildAlerts({ ...baseMetrics, uploadFailed: 6 });
    expect(a.find((x) => x.category === 'upload').severity).toBe('yellow');
  });

  it('fires when failure rate exceeds 10% even with low absolute count', () => {
    const a = buildAlerts({ ...baseMetrics, uploadFailed: 2, photoUploaded: 1 });
    // 2 fails / (2 fails + 1 ok) = 66.7% → fires
    expect(a.find((x) => x.category === 'upload')).toBeTruthy();
  });

  it('does not fire when upload volume is healthy', () => {
    const a = buildAlerts({ ...baseMetrics, uploadFailed: 1, photoUploaded: 50 });
    expect(a.find((x) => x.category === 'upload')).toBeUndefined();
  });
});

describe('buildAlerts — rate-limit rule', () => {
  it('fires yellow at >= 5 hits', () => {
    const a = buildAlerts({ ...baseMetrics, rateLimitHits: 5 });
    expect(a.find((x) => x.category === 'rateLimit').severity).toBe('yellow');
  });

  it('does not fire below threshold', () => {
    const a = buildAlerts({ ...baseMetrics, rateLimitHits: 4 });
    expect(a.find((x) => x.category === 'rateLimit')).toBeUndefined();
  });
});

describe('buildAlerts — onboarding rule', () => {
  it('fires yellow when completion is < 60%', () => {
    const m = {
      ...baseMetrics,
      onboardingCompleted: 5,
      userTypeSplit: { farmer: 7, backyard: 3, ngo: 0, buyer: 0, other: 0 },
    };
    expect(buildAlerts(m).find((x) => x.category === 'onboarding').severity).toBe('yellow');
  });

  it('fires red when completion is < 40%', () => {
    const m = {
      ...baseMetrics,
      onboardingCompleted: 3,
      userTypeSplit: { farmer: 7, backyard: 3, ngo: 0, buyer: 0, other: 0 },
    };
    expect(buildAlerts(m).find((x) => x.category === 'onboarding').severity).toBe('red');
  });

  it('does not fire when no userType selections happened', () => {
    const m = {
      ...baseMetrics,
      onboardingCompleted: 0,
      userTypeSplit: { farmer: 0, backyard: 0, ngo: 0, buyer: 0, other: 0 },
    };
    expect(buildAlerts(m).find((x) => x.category === 'onboarding')).toBeUndefined();
  });
});

describe('buildAlerts — zero-traffic guard', () => {
  it('emits a green info-alert when DAU is 0 and sampleSize is 0', () => {
    const a = buildAlerts({ ...baseMetrics, dau: 0, sampleSize: 0 });
    const noTraffic = a.find((x) => x.id === 'no-traffic');
    expect(noTraffic).toBeTruthy();
    expect(noTraffic.severity).toBe('green');
  });

  it('does not emit no-traffic when DAU is 0 but events are flowing', () => {
    const a = buildAlerts({ ...baseMetrics, dau: 0, sampleSize: 50 });
    expect(a.find((x) => x.id === 'no-traffic')).toBeUndefined();
  });
});

describe('buildAlerts — output shape', () => {
  it('returns alerts sorted red → yellow → green', () => {
    const m = {
      ...baseMetrics,
      appErrors: 5,                 // red
      screenStuck: 1,               // yellow
      sampleSize: 50,
    };
    const a = buildAlerts(m);
    const order = a.map((x) => x.severity);
    expect(order).toEqual([...order].sort((a, b) => {
      const r = { red: 0, yellow: 1, green: 2 };
      return r[a] - r[b];
    }));
  });

  it('every alert carries id + severity + category + title + description + action', () => {
    const a = buildAlerts({ ...baseMetrics, appErrors: 3 });
    for (const alert of a) {
      expect(alert.id).toBeTruthy();
      expect(alert.severity).toMatch(/^(red|yellow|green)$/);
      expect(alert.category).toBeTruthy();
      expect(alert.title).toBeTruthy();
      expect(alert.description).toBeTruthy();
      expect(alert.action).toBeTruthy();
      expect(Array.isArray(alert.affected)).toBe(true);
    }
  });

  it('alert ids are stable across runs', () => {
    const m = { ...baseMetrics, appErrors: 1 };
    const a1 = buildAlerts(m).map((x) => x.id);
    const a2 = buildAlerts(m).map((x) => x.id);
    expect(a1).toEqual(a2);
  });

  it('does not throw on partial / null input', () => {
    expect(() => buildAlerts(null)).not.toThrow();
    expect(() => buildAlerts({})).not.toThrow();
    expect(() => buildAlerts({ appErrors: 'not-a-number' })).not.toThrow();
  });
});

describe('rollupSystemStatus', () => {
  it('returns green for empty alerts', () => {
    expect(rollupSystemStatus([])).toBe('green');
    expect(rollupSystemStatus(null)).toBe('green');
  });

  it('returns yellow when at least one yellow', () => {
    expect(rollupSystemStatus([{ severity: 'yellow' }])).toBe('yellow');
  });

  it('returns red when at least one red', () => {
    expect(rollupSystemStatus([
      { severity: 'yellow' },
      { severity: 'red' },
      { severity: 'yellow' },
    ])).toBe('red');
  });

  it('green takes the lowest priority', () => {
    expect(rollupSystemStatus([
      { severity: 'green' },
      { severity: 'yellow' },
    ])).toBe('yellow');
  });
});

describe('topConfusionSignals', () => {
  it('combines stuck + error counts and ranks by score', () => {
    const m = {
      topStuckRoutes: [{ key: '/dashboard', count: 5 }, { key: '/scan', count: 1 }],
      topErrors:      [{ key: '/scan', count: 3 }],
    };
    const out = topConfusionSignals(m, 5);
    // /dashboard: 5 * 2 + 0 = 10
    // /scan:     1 * 2 + 3 = 5
    expect(out[0].route).toBe('/dashboard');
    expect(out[1].route).toBe('/scan');
    expect(out[0].score).toBe(10);
  });

  it('returns empty array when neither map has entries', () => {
    expect(topConfusionSignals({})).toEqual([]);
  });

  it('respects the limit', () => {
    const m = {
      topStuckRoutes: [
        { key: '/a', count: 1 }, { key: '/b', count: 1 },
        { key: '/c', count: 1 }, { key: '/d', count: 1 },
        { key: '/e', count: 1 }, { key: '/f', count: 1 },
      ],
      topErrors: [],
    };
    expect(topConfusionSignals(m, 3).length).toBe(3);
  });
});

describe('alerts internals', () => {
  it('exports threshold constants matching the spec', () => {
    expect(_internal.THRESHOLDS.crashesYellow).toBe(1);
    expect(_internal.THRESHOLDS.crashesRed).toBe(3);
    expect(_internal.THRESHOLDS.stuckYellow).toBe(1);
    expect(_internal.THRESHOLDS.completionYellow).toBe(0.40);
    expect(_internal.THRESHOLDS.completionRed).toBe(0.20);
    expect(_internal.THRESHOLDS.uploadYellow).toBe(5);
    expect(_internal.THRESHOLDS.rateLimitYellow).toBe(5);
    expect(_internal.THRESHOLDS.onboardingYellow).toBe(0.60);
    expect(_internal.THRESHOLDS.onboardingRed).toBe(0.40);
  });

  it('actions never include stack-trace or Prisma keywords', () => {
    for (const action of Object.values(_internal.ACTIONS)) {
      expect(String(action).toLowerCase()).not.toMatch(/prisma|database_url|jwt_secret|at object|node_modules/);
    }
  });
});
