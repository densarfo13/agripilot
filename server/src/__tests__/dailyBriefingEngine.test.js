/**
 * dailyBriefingEngine.test.js — Daily Return Loop + Notification
 * Engine Fix.
 *
 * dailyBriefingEngine turns the predictive briefing into ≤2 calm,
 * farmer-vs-garden notification messages. It must consume the
 * canonical snapshot (never bypass it) and never spam.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generateDailyBriefingNotifications,
  getMorningBriefingNotification,
} from '../../../src/core/notifications/dailyBriefingEngine.js';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── 1. Output shape + spam cap ────────────────────────────

describe('generateDailyBriefingNotifications — output', () => {
  it('returns an array of at most 2 notifications (spec §3 cap)', () => {
    const notes = generateDailyBriefingNotifications();
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBeLessThanOrEqual(2);
  });

  it('every notification carries the documented fields', () => {
    for (const n of generateDailyBriefingNotifications()) {
      expect(typeof n.id).toBe('string');
      expect(typeof n.kind).toBe('string');
      expect(['high', 'medium', 'low']).toContain(n.urgency);
      expect(['farm', 'garden']).toContain(n.mode);
      expect(typeof n.title).toBe('string');
      expect(n.title.length).toBeGreaterThan(0);
      expect(typeof n.body).toBe('string');
      expect(n.body.length).toBeGreaterThan(0);
      expect(typeof n.language).toBe('string');
    }
  });

  it('notifications are ordered most-urgent first', () => {
    const rank = { high: 3, medium: 2, low: 1 };
    const notes = generateDailyBriefingNotifications();
    for (let i = 1; i < notes.length; i += 1) {
      expect(rank[notes[i - 1].urgency]).toBeGreaterThanOrEqual(rank[notes[i].urgency]);
    }
  });

  it('never produces a generic "open app" reminder', () => {
    for (const n of generateDailyBriefingNotifications()) {
      expect(n.body.toLowerCase()).not.toMatch(/open the app|open app|check the app/);
    }
  });
});

// ─── 2. Resilience ─────────────────────────────────────────

describe('generateDailyBriefingNotifications — resilience', () => {
  it('never throws on garbage options', () => {
    expect(() => generateDailyBriefingNotifications(42)).not.toThrow();
    expect(() => generateDailyBriefingNotifications(null)).not.toThrow();
    expect(() => getMorningBriefingNotification('x')).not.toThrow();
  });

  it('getMorningBriefingNotification returns one note or null', () => {
    const m = getMorningBriefingNotification();
    expect(m === null || typeof m === 'object').toBe(true);
  });
});

// ─── 3. Consumes the canonical snapshot, no duplication ────

describe('dailyBriefingEngine — consumes getPredictiveBriefing', () => {
  const src = read('src/core/notifications/dailyBriefingEngine.js');

  it('reads the predictive briefing (which consumes getIntelligenceSnapshot)', () => {
    expect(src).toMatch(/from '\.\.\/prediction\/getPredictiveBriefing\.js'/);
  });

  it('does not re-implement a risk or recommendation engine', () => {
    expect(src).not.toMatch(/import[^;]*predictiveRisk/);
    expect(src).not.toMatch(/import[^;]*computeContextIntelligence/);
  });

  it('tailors farmer vs garden framing (spec §2)', () => {
    expect(src).toMatch(/Today on your farm/);
    expect(src).toMatch(/Today in your garden/);
  });
});
