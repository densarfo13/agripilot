/**
 * issueAutoTriage.test.js — rules-based automation for the issue
 * pipeline. Covers severity inference, officer matching + workload,
 * suggested responses, safety guards, and the end-to-end wiring
 * via createIssue({ autoTriage: true }).
 *
 * No resolution, no escalation, and never a downgrade of an explicit
 * severity — those are the safety contracts in autoTriage.js.
 */

import { describe, it, expect, beforeEach } from 'vitest';

function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => (map.has(k) ? map.get(k) : null),
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
    addEventListener:    () => {},
    removeEventListener: () => {},
  };
}

// Import both modules so the side-effect in autoTriage.js wires the
// planner into the store before the tests run.
import {
  inferSeverity,
  suggestResponse,
  pickOfficer,
  autoProcessIssue,
  _internal as triageInternals,
} from '../../../src/lib/issues/autoTriage.js';

import {
  createIssue,
  setOfficerRegistry,
  getOfficerRegistry,
  getIssueById,
  ISSUE_STATUS,
  ISSUE_SEVERITY,
  _internal,
} from '../../../src/lib/issues/issueStore.js';

beforeEach(() => {
  installLocalStorage();
  _internal.clearAll();
});

// ─── Severity inference ──────────────────────────────────────────
describe('inferSeverity', () => {
  it('respects explicit severity no matter what the text says', () => {
    expect(inferSeverity({
      description: 'urgent and dying everywhere',
      explicit:    ISSUE_SEVERITY.LOW,
    })).toBe(ISSUE_SEVERITY.LOW);
  });

  it('detects high-severity keywords', () => {
    expect(inferSeverity({ description: 'urgent, whole farm destroyed' }))
      .toBe(ISSUE_SEVERITY.HIGH);
    expect(inferSeverity({ description: 'plants are dying' }))
      .toBe(ISSUE_SEVERITY.HIGH);
  });

  it('detects low-severity cues', () => {
    expect(inferSeverity({ description: 'a few yellow leaves' }))
      .toBe(ISSUE_SEVERITY.LOW);
    expect(inferSeverity({ description: 'just one small spot on a plant' }))
      .toBe(ISSUE_SEVERITY.LOW);
  });

  it('falls back to the type baseline when no keywords match', () => {
    expect(inferSeverity({ description: 'plain description', issueType: 'weather_damage' }))
      .toBe(ISSUE_SEVERITY.HIGH);
    expect(inferSeverity({ description: 'plain description', issueType: 'soil' }))
      .toBe(ISSUE_SEVERITY.LOW);
    expect(inferSeverity({ description: '', issueType: 'pest' }))
      .toBe(ISSUE_SEVERITY.MEDIUM);
  });
});

// ─── Suggested responses ─────────────────────────────────────────
describe('suggestResponse', () => {
  it('returns a pest-specific line for pest issues', () => {
    expect(suggestResponse('pest')).toMatch(/leaves/i);
  });
  it('returns the irrigation line for water issues', () => {
    expect(suggestResponse('irrigation')).toMatch(/irrigation/i);
  });
  it('falls back to `other` for unknown types', () => {
    expect(suggestResponse('mystery')).toBe(triageInternals.SUGGESTIONS.other);
  });
});

// ─── Officer picker ──────────────────────────────────────────────
describe('pickOfficer', () => {
  const registry = [
    { id: 'ofc_1', name: 'Ada',   regions: ['AS'], crops: ['maize', 'cassava'] },
    { id: 'ofc_2', name: 'Kofi',  regions: ['CP'], crops: ['maize'] },
    { id: 'ofc_3', name: 'Amina', regions: ['LA'], crops: ['tomato'] },
  ];

  it('returns null when registry is empty', () => {
    expect(pickOfficer({ issue: { crop: 'maize' }, registry: [] })).toBeNull();
  });

  it('returns null when no officer covers region OR crop', () => {
    const issue = { crop: 'sorghum', location: 'KR' };
    expect(pickOfficer({ issue, registry })).toBeNull();
  });

  it('picks the officer whose region + crop both match', () => {
    const issue = { crop: 'maize', location: 'AS' };
    expect(pickOfficer({ issue, registry }).id).toBe('ofc_1');
  });

  it('breaks ties using workload (fewer active issues wins)', () => {
    const issue = { crop: 'maize', location: 'AS' };
    const twoMatchers = [
      { id: 'ofc_1', name: 'A', regions: ['AS'], crops: ['maize'] },
      { id: 'ofc_9', name: 'B', regions: ['AS'], crops: ['maize'] },
    ];
    const picked = pickOfficer({
      issue,
      registry: twoMatchers,
      activeCountsByOfficer: { ofc_1: 5, ofc_9: 1 },
    });
    expect(picked.id).toBe('ofc_9');
  });

  it('workload can flip the winner', () => {
    const issue = { crop: 'maize', location: 'AS' };
    const oneFullMatch = [
      { id: 'ofc_crop_only', name: 'X', regions: [], crops: ['maize'] }, // crop only
      { id: 'ofc_both',       name: 'Y', regions: ['AS'], crops: ['maize'] }, // both
    ];
    // ofc_both scores higher by default; overload it so its negative
    // swamps the advantage.
    const picked = pickOfficer({
      issue,
      registry: oneFullMatch,
      activeCountsByOfficer: { ofc_both: 10, ofc_crop_only: 0 },
    });
    expect(picked.id).toBe('ofc_crop_only');
  });
});

// ─── autoProcessIssue orchestrator ───────────────────────────────
describe('autoProcessIssue', () => {
  it('when registry is empty → admin queue + systemNote says so', () => {
    const issue = { issueType: 'pest', description: 'spots on leaves', crop: 'maize' };
    const plan = autoProcessIssue(issue, { registry: [], allIssues: [] });
    expect(plan.assignTo).toBeNull();
    expect(plan.systemNote.text).toMatch(/admin queue/i);
    expect(plan.farmerAck).toMatch(/admin is reviewing/i);
  });

  it('when an officer matches → assignTo set + ack says "assigned"', () => {
    const issue = { issueType: 'pest', description: 'spots', crop: 'maize', location: 'AS' };
    const registry = [{ id: 'ofc_1', name: 'Ada', regions: ['AS'], crops: ['maize'] }];
    const plan = autoProcessIssue(issue, { registry, allIssues: [] });
    expect(plan.assignTo).toBe('ofc_1');
    expect(plan.systemNote.text).toMatch(/auto-assigned/i);
    expect(plan.farmerAck).toMatch(/received and assigned/i);
    expect(plan.suggestedNote.text).toMatch(/leaves/i);
  });

  it('severity honours explicit value but fills in when absent', () => {
    // Explicit high passes through.
    const explicit = autoProcessIssue(
      { issueType: 'pest', description: 'mild', severity: ISSUE_SEVERITY.HIGH },
      { registry: [] },
    );
    expect(explicit.severity).toBe(ISSUE_SEVERITY.HIGH);
    // No explicit → keyword promotion.
    const derived = autoProcessIssue(
      { issueType: 'pest', description: 'whole farm destroyed' },
      { registry: [] },
    );
    expect(derived.severity).toBe(ISSUE_SEVERITY.HIGH);
  });
});

// ─── End-to-end wiring via createIssue({ autoTriage: true }) ─────
describe('createIssue({ autoTriage: true })', () => {
  it('assigns + flips status to assigned when an officer matches', () => {
    setOfficerRegistry([
      { id: 'ofc_1', name: 'Ada', regions: ['AS'], crops: ['maize'] },
    ]);
    const iss = createIssue({
      farmerId: 'u1', farmerName: 'Farmer A',
      issueType: 'pest', description: 'armyworm spreading', crop: 'maize', location: 'AS',
      autoTriage: true,
    });
    expect(iss.status).toBe(ISSUE_STATUS.ASSIGNED);
    expect(iss.assignedTo).toBe('ofc_1');
    expect(iss.firstAssignedAt).toBeGreaterThan(0);
    const suggestion = iss.notes.find((n) => n.suggested);
    expect(suggestion).toBeTruthy();
    expect(suggestion.text).toMatch(/leaves/i);
    expect(iss.farmerAck).toMatch(/received and assigned/i);
  });

  it('routes to admin queue when no officer matches, status stays open', () => {
    setOfficerRegistry([
      { id: 'ofc_far', regions: ['LA'], crops: ['tomato'] },
    ]);
    const iss = createIssue({
      issueType: 'pest', description: 'spots',
      crop: 'maize', location: 'AS',
      autoTriage: true,
    });
    expect(iss.status).toBe(ISSUE_STATUS.OPEN);
    expect(iss.assignedTo).toBeNull();
    const sysNote = iss.notes.find((n) => !n.suggested);
    expect(sysNote.text).toMatch(/admin queue/i);
  });

  it('never auto-resolves even for "trivial" reports', () => {
    const iss = createIssue({
      issueType: 'soil', description: 'a few yellow leaves', autoTriage: true,
    });
    expect(iss.status).not.toBe(ISSUE_STATUS.RESOLVED);
    // Low severity inferred but still needs manual follow-up.
    expect(iss.severity).toBe(ISSUE_SEVERITY.LOW);
  });

  it('respects explicit severity even when text suggests higher', () => {
    const iss = createIssue({
      issueType: 'pest', description: 'urgent', severity: ISSUE_SEVERITY.LOW,
      autoTriage: true,
    });
    expect(iss.severity).toBe(ISSUE_SEVERITY.LOW);
  });

  it('workload balances between two qualified officers', () => {
    setOfficerRegistry([
      { id: 'ofc_a', regions: ['AS'], crops: ['maize'] },
      { id: 'ofc_b', regions: ['AS'], crops: ['maize'] },
    ]);
    // First issue → one of them.
    const first  = createIssue({ issueType: 'pest', description: 'x', crop: 'maize', location: 'AS', autoTriage: true });
    // Second → the other (lower workload).
    const second = createIssue({ issueType: 'pest', description: 'y', crop: 'maize', location: 'AS', autoTriage: true });
    expect(first.assignedTo).not.toBe(second.assignedTo);
  });

  it('stores issue with crop + location metadata attached', () => {
    setOfficerRegistry([{ id: 'ofc_1', regions: ['AS'], crops: ['maize'] }]);
    const iss = createIssue({
      issueType: 'pest', description: 'spots',
      crop: 'MAIZE', location: 'AS', program: 'ngo_gh_2026',
      autoTriage: true,
    });
    expect(iss.crop).toBe('maize');       // lowercased
    expect(iss.location).toBe('AS');
    expect(iss.program).toBe('ngo_gh_2026');
  });
});

// ─── Officer registry helpers ────────────────────────────────────
describe('officer registry', () => {
  it('get/set round-trips through localStorage', () => {
    setOfficerRegistry([
      { id: 'ofc_1', name: 'Ada', regions: ['AS'], crops: ['maize'] },
    ]);
    const reg = getOfficerRegistry();
    expect(reg).toHaveLength(1);
    expect(reg[0].id).toBe('ofc_1');
  });

  it('returns [] when nothing has been set', () => {
    expect(getOfficerRegistry()).toEqual([]);
  });
});

// ─── Frozen output still holds after auto-triage ─────────────────
describe('freezing', () => {
  it('auto-triaged issue is frozen end-to-end', () => {
    setOfficerRegistry([{ id: 'ofc_1', regions: ['AS'], crops: ['maize'] }]);
    const iss = createIssue({
      issueType: 'pest', description: 'x', crop: 'maize', location: 'AS',
      autoTriage: true,
    });
    expect(Object.isFrozen(iss)).toBe(true);
    expect(Object.isFrozen(iss.notes)).toBe(true);
    const fetched = getIssueById(iss.id);
    expect(Object.isFrozen(fetched)).toBe(true);
  });
});
