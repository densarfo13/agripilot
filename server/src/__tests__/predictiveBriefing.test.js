/**
 * predictiveBriefing.test.js — Predictive Intelligence v1 Upgrade.
 *
 * getPredictiveBriefing.js is the consolidated §7 "Daily Farm
 * Briefing" surface. It consumes getIntelligenceSnapshot() (spec
 * §1) and assembles the predictive briefing Home / Tasks / Copilot
 * read — it must NOT re-implement any risk math.
 *
 * Coverage:
 *   - getPredictiveBriefing() returns the documented shape
 *   - risks are ordered most-severe first
 *   - getPredictedRisks / getTopRisk are consistent
 *   - resilient — never throws
 *   - it composes the snapshot (geo/connectivity carried through)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getPredictiveBriefing,
  getPredictedRisks,
  getTopRisk,
} from '../../../src/core/prediction/getPredictiveBriefing.js';
import { getIntelligenceSnapshot } from '../../../src/core/intelligence/getIntelligenceSnapshot.js';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const RANK = { high: 3, medium: 2, low: 1 };
const rankOf = (r) => RANK[String(r && r.level || '').toLowerCase()] || 0;

// ─── 1. Briefing shape ─────────────────────────────────────

describe('getPredictiveBriefing — briefing shape', () => {
  it('returns every documented field', () => {
    const b = getPredictiveBriefing();
    expect(typeof b.generatedAt).toBe('number');
    expect(b.geo).toBeTruthy();
    expect('weather' in b).toBe(true);
    expect(b.cropStatus).toBeTruthy();
    expect('crop' in b.cropStatus).toBe(true);
    expect('cropStage' in b.cropStatus).toBe(true);
    expect(Array.isArray(b.risks)).toBe(true);
    expect('topRisk' in b).toBe(true);
    expect('priorityTask' in b).toBe(true);
    expect('nextBestAction' in b).toBe(true);
    expect('alert' in b).toBe(true);
    expect('briefing' in b).toBe(true);
    expect(['online', 'offline']).toContain(b.connectivity);
  });

  it('composes the snapshot — geo + connectivity carry through', () => {
    const b = getPredictiveBriefing({ nowMs: 1700000000000 });
    const s = getIntelligenceSnapshot({ nowMs: 1700000000000 });
    expect(b.geo.language).toBe(s.geo.language);
    expect(b.connectivity).toBe(s.connectivity);
  });
});

// ─── 2. Risk ordering ──────────────────────────────────────

describe('getPredictiveBriefing — risk ordering', () => {
  it('risks are ordered most-severe first', () => {
    const risks = getPredictiveBriefing().risks;
    for (let i = 1; i < risks.length; i += 1) {
      expect(rankOf(risks[i - 1])).toBeGreaterThanOrEqual(rankOf(risks[i]));
    }
  });

  it('topRisk is the first ordered risk (or null when clear)', () => {
    const b = getPredictiveBriefing();
    if (b.risks.length === 0) {
      expect(b.topRisk).toBeNull();
    } else {
      expect(b.topRisk).toBe(b.risks[0]);
    }
  });

  it('getTopRisk agrees with getPredictedRisks[0]', () => {
    const risks = getPredictedRisks();
    const top = getTopRisk();
    if (risks.length === 0) expect(top).toBeNull();
    else expect(top).toBe(risks[0]);
  });
});

// ─── 3. Resilience ─────────────────────────────────────────

describe('getPredictiveBriefing — never throws', () => {
  it('handles garbage options', () => {
    expect(() => getPredictiveBriefing(42)).not.toThrow();
    expect(() => getPredictiveBriefing(null)).not.toThrow();
    expect(() => getPredictedRisks('x')).not.toThrow();
    expect(() => getTopRisk(undefined)).not.toThrow();
  });

  it('getPredictedRisks always returns an array', () => {
    expect(Array.isArray(getPredictedRisks())).toBe(true);
  });
});

// ─── 4. No competing engine ────────────────────────────────

describe('getPredictiveBriefing — consumes the snapshot, no duplication', () => {
  it('imports getIntelligenceSnapshot and does not re-implement risk math', () => {
    const src = read('src/core/prediction/getPredictiveBriefing.js');
    expect(src).toMatch(/from '\.\.\/intelligence\/getIntelligenceSnapshot\.js'/);
    // it must not IMPORT the raw risk engine — it reads risks
    // through the snapshot (a docstring mention is fine).
    expect(src).not.toMatch(/import[^;]*predictiveRisk/);
  });
});
