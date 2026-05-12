/**
 * dailyBriefing.test.js — pins the §1 contract:
 *   1. Returns a stable shape on garbage input.
 *   2. Greeting respects time of day + farmer name shape.
 *   3. Weather + risk + pattern + tasks each contribute lines.
 *   4. Capped at 5 lines.
 *   5. Empty inputs → a calm fallback line.
 *   6. Severity escalates when a high-level risk fires.
 */

import { describe, it, expect } from 'vitest';
import { composeDailyBriefing } from '../../../src/lib/dailyBriefing.js';

// Fixed local date — 2026-05-12 09:00.
const NOW = new Date(2026, 4, 12, 9, 0, 0);

describe('composeDailyBriefing — contract', () => {
  it('returns a stable shape on null / garbage input', () => {
    const r = composeDailyBriefing(null);
    expect(r).toHaveProperty('greeting');
    expect(r).toHaveProperty('lines');
    expect(r).toHaveProperty('severity');
    expect(r).toHaveProperty('factors');
    expect(Array.isArray(r.lines)).toBe(true);
  });

  it('greets the farmer by first name when one is provided', () => {
    const r = composeDailyBriefing({ farmerName: 'Dennis Kofi', now: NOW });
    expect(r.greeting).toBe('Good morning, Dennis.');
  });

  it('drops the comma form when no recognisable name is provided', () => {
    const r = composeDailyBriefing({ farmerName: 'dennis@example.com', now: NOW });
    expect(r.greeting).toBe('Good morning.');
  });

  it('switches greeting based on local hour', () => {
    const afternoon = new Date(2026, 4, 12, 14, 0, 0);
    const evening   = new Date(2026, 4, 12, 19, 0, 0);
    expect(composeDailyBriefing({ now: afternoon }).greeting).toMatch(/afternoon/);
    expect(composeDailyBriefing({ now: evening  }).greeting).toMatch(/evening/);
  });

  it('surfaces a top high-level risk above weather summary', () => {
    const r = composeDailyBriefing({
      farmerName: 'Dennis',
      now: NOW,
      weather: { humidity: 80, tempC: 27 },
      risks: [{
        kind: 'fungal',
        level: 'high',
        headline: 'High humidity today increases fungal risk for tomatoes.',
        action: 'Delay irrigation until evening.',
      }],
    });
    expect(r.severity).toBe('urgent');
    expect(r.lines.some((l) => /fungal risk/i.test(l))).toBe(true);
    expect(r.lines.some((l) => /Delay irrigation/i.test(l))).toBe(true);
  });

  it('falls back to a weather summary when no risk fires', () => {
    const r = composeDailyBriefing({
      now: NOW,
      weather: { summary: 'Partly cloudy, 24°C' },
    });
    expect(r.lines.some((l) => /Partly cloudy/.test(l))).toBe(true);
    expect(r.severity).toBe('calm');
  });

  it('mentions a worsening recovery trend', () => {
    const r = composeDailyBriefing({
      now: NOW,
      pattern: { trend: 'worsening', previous: { daysAgo: 2 }, recurrence: { count: 0 } },
    });
    expect(r.lines.some((l) => /worse|closer look/i.test(l))).toBe(true);
    expect(r.severity).toBe('watch');
  });

  it('celebrates an improving trend', () => {
    const r = composeDailyBriefing({
      now: NOW,
      pattern: { trend: 'improving', previous: { daysAgo: 3 }, recurrence: { count: 0 } },
    });
    expect(r.lines.some((l) => /improving|Good news/i.test(l))).toBe(true);
  });

  it('mentions a recurrence pattern of 3+', () => {
    const r = composeDailyBriefing({
      now: NOW,
      pattern: { trend: 'stable', previous: null, recurrence: { count: 3 } },
    });
    expect(r.lines.some((l) => /Recurring|pattern/i.test(l))).toBe(true);
  });

  it('counts pending tasks and flags high-priority ones', () => {
    const r = composeDailyBriefing({
      now: NOW,
      scanTasks: [
        { completed: false, urgency: 'high' },
        { completed: false, urgency: 'medium' },
        { completed: true,  urgency: 'high' },
      ],
    });
    expect(r.lines.some((l) => /high-priority/i.test(l))).toBe(true);
  });

  it('shows the calm fallback line when there is nothing to say', () => {
    const r = composeDailyBriefing({ now: NOW });
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatch(/Nothing urgent/);
  });

  it('caps output at 5 lines', () => {
    const r = composeDailyBriefing({
      now: NOW,
      weather: { summary: 'Sunny' },
      risks: [
        { kind: 'fungal', level: 'high', headline: 'A', action: 'B' },
        { kind: 'heat',   level: 'high', headline: 'C', action: 'D' },
      ],
      pattern: { trend: 'worsening', previous: { daysAgo: 1 }, recurrence: { count: 4 } },
      scanTasks: [{ completed: false, urgency: 'high' }],
      healthScore: { score: 32, band: 'urgent' },
    });
    expect(r.lines.length).toBeLessThanOrEqual(5);
  });
});
