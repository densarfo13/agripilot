/**
 * issueStore.test.js — farmer → admin → field officer pipeline.
 *
 * Covers spec §13:
 *   1. farmer can create issue
 *   2. issue defaults to open
 *   3. admin can assign issue
 *   4. officer only sees assigned issues
 *   5. officer can add note
 *   6. officer can mark resolved
 *   7. farmer sees updated status
 *   8. metrics calculate correctly
 *   9. no crash if issue list empty
 *  + transition rules + unseen-change tracking
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
  return map;
}

import {
  createIssue,
  assignIssue,
  updateIssueStatus,
  addIssueNote,
  getIssuesForRole,
  getAllIssues,
  getIssueById,
  getIssueMetrics,
  markIssueSeen,
  getUnseenStatusChanges,
  ISSUE_STATUS,
  ISSUE_SEVERITY,
  ISSUE_TYPES,
  _internal,
} from '../../../src/lib/issues/issueStore.js';

beforeEach(() => {
  installLocalStorage();
  _internal.clearAll();
});

// ─── Farmer capture ──────────────────────────────────────────────
describe('createIssue', () => {
  it('creates an open issue from valid input', () => {
    const iss = createIssue({
      farmerId: 'u1', farmId: 'f1', farmerName: 'Ada',
      crop: 'maize', location: 'Ashanti', program: 'ngo_gh_2026',
      issueType: 'pest', severity: 'high',
      description: 'Armyworm on half the plot',
    });
    expect(iss).toBeTruthy();
    expect(iss.status).toBe(ISSUE_STATUS.OPEN);
    expect(iss.severity).toBe('high');
    expect(iss.assignedTo).toBeNull();
    expect(Array.isArray(iss.notes)).toBe(true);
    expect(iss.notes).toHaveLength(0);
    expect(iss.createdAt).toBeGreaterThan(0);
    expect(iss.updatedAt).toBe(iss.createdAt);
  });

  it('defaults severity to medium + rejects invalid severity', () => {
    const iss = createIssue({
      issueType: 'disease', description: 'Leaf blight',
      severity: 'catastrophic',
    });
    expect(iss.severity).toBe(ISSUE_SEVERITY.MEDIUM);
  });

  it('rejects missing description or unknown type', () => {
    expect(createIssue({ issueType: 'pest', description: '' })).toBeNull();
    expect(createIssue({ issueType: 'ufo_sighting', description: 'abc' })).toBeNull();
  });

  it('lowercases the crop code for analytics parity', () => {
    const iss = createIssue({ issueType: 'pest', description: 'x', crop: 'MAIZE' });
    expect(iss.crop).toBe('maize');
  });
});

// ─── Admin assignment ────────────────────────────────────────────
describe('assignIssue', () => {
  it('moves open → assigned + stamps assignedTo + updatedAt', () => {
    const iss = createIssue({ issueType: 'pest', description: 'x' });
    const after = assignIssue(iss.id, 'ofc_1', { adminId: 'admin_7' });
    expect(after.status).toBe(ISSUE_STATUS.ASSIGNED);
    expect(after.assignedTo).toBe('ofc_1');
    expect(after.updatedAt).toBeGreaterThanOrEqual(iss.updatedAt);
    expect(after.firstAssignedAt).toBeGreaterThan(0);
    // System note appended so farmer timeline can show it.
    expect(after.notes.length).toBe(1);
    expect(after.notes[0].system).toBe(true);
  });

  it('returns null for unknown ids', () => {
    expect(assignIssue('missing', 'ofc_1')).toBeNull();
    expect(assignIssue(null, 'ofc_1')).toBeNull();
    expect(assignIssue('x', null)).toBeNull();
  });
});

// ─── Officer scope + actions ─────────────────────────────────────
describe('getIssuesForRole + officer actions', () => {
  it('officer sees only issues assigned to them', () => {
    const a = createIssue({ issueType: 'pest', description: 'a' });
    const b = createIssue({ issueType: 'disease', description: 'b' });
    const c = createIssue({ issueType: 'soil', description: 'c' });
    assignIssue(a.id, 'ofc_1');
    assignIssue(b.id, 'ofc_2');
    // c stays open + unassigned

    const ofc1 = getIssuesForRole('field_officer', { officerId: 'ofc_1' });
    const ofc2 = getIssuesForRole('field_officer', { officerId: 'ofc_2' });
    expect(ofc1.map((i) => i.id)).toEqual([a.id]);
    expect(ofc2.map((i) => i.id)).toEqual([b.id]);
    expect(getIssuesForRole('admin')).toHaveLength(3);
  });

  it('officer can add a free-text note', () => {
    const iss = createIssue({ issueType: 'pest', description: 'x' });
    assignIssue(iss.id, 'ofc_1');
    const after = addIssueNote(iss.id, {
      authorRole: 'field_officer', authorId: 'ofc_1',
      text: 'Sprayed west section',
    });
    const userNotes = after.notes.filter((n) => !n.system);
    expect(userNotes).toHaveLength(1);
    expect(userNotes[0].text).toBe('Sprayed west section');
  });

  it('officer can mark resolved from assigned or in_progress', () => {
    const iss1 = createIssue({ issueType: 'pest', description: 'a' });
    assignIssue(iss1.id, 'ofc_1');
    const resolved = updateIssueStatus(iss1.id, ISSUE_STATUS.RESOLVED, {
      authorRole: 'field_officer', authorId: 'ofc_1',
    });
    expect(resolved.status).toBe(ISSUE_STATUS.RESOLVED);
    expect(resolved.resolvedAt).toBeGreaterThan(0);

    const iss2 = createIssue({ issueType: 'disease', description: 'b' });
    assignIssue(iss2.id, 'ofc_1');
    updateIssueStatus(iss2.id, ISSUE_STATUS.IN_PROGRESS, { authorRole: 'field_officer' });
    const resolved2 = updateIssueStatus(iss2.id, ISSUE_STATUS.RESOLVED, { authorRole: 'field_officer' });
    expect(resolved2.status).toBe(ISSUE_STATUS.RESOLVED);
  });

  it('officer can escalate + admin can re-assign', () => {
    const iss = createIssue({ issueType: 'pest', description: 'x' });
    assignIssue(iss.id, 'ofc_1');
    const escalated = updateIssueStatus(iss.id, ISSUE_STATUS.ESCALATED, {
      authorRole: 'field_officer', authorId: 'ofc_1',
    });
    expect(escalated.status).toBe(ISSUE_STATUS.ESCALATED);
    // Admin re-assigns to a different officer.
    const reassigned = assignIssue(iss.id, 'ofc_2');
    expect(reassigned.status).toBe(ISSUE_STATUS.ASSIGNED);
    expect(reassigned.assignedTo).toBe('ofc_2');
  });

  it('rejects invalid status transitions silently', () => {
    const iss = createIssue({ issueType: 'pest', description: 'x' });
    // open → in_progress is NOT a valid transition (must go assigned first).
    expect(updateIssueStatus(iss.id, ISSUE_STATUS.IN_PROGRESS)).toBeNull();
    // resolved is terminal — can't re-open.
    assignIssue(iss.id, 'ofc_1');
    updateIssueStatus(iss.id, ISSUE_STATUS.RESOLVED, { authorRole: 'field_officer' });
    expect(updateIssueStatus(iss.id, ISSUE_STATUS.IN_PROGRESS)).toBeNull();
  });
});

// ─── Farmer status view ──────────────────────────────────────────
describe('farmer view + unseen changes', () => {
  it('farmer sees only their own issues + reflects the latest status', () => {
    const a = createIssue({ farmerId: 'u1', issueType: 'pest',    description: 'a' });
    const b = createIssue({ farmerId: 'u2', issueType: 'disease', description: 'b' });
    assignIssue(a.id, 'ofc_1');
    updateIssueStatus(a.id, ISSUE_STATUS.IN_PROGRESS, { authorRole: 'field_officer' });
    const u1 = getIssuesForRole('farmer', { farmerId: 'u1' });
    expect(u1).toHaveLength(1);
    expect(u1[0].status).toBe(ISSUE_STATUS.IN_PROGRESS);
    expect(getIssuesForRole('farmer', { farmerId: 'u2' })[0].id).toBe(b.id);
  });

  it('getUnseenStatusChanges honours markIssueSeen', async () => {
    const iss = createIssue({ farmerId: 'u1', issueType: 'pest', description: 'x' });
    expect(getUnseenStatusChanges({ role: 'farmer', farmerId: 'u1' })).toHaveLength(1);
    markIssueSeen(iss.id);
    expect(getUnseenStatusChanges({ role: 'farmer', farmerId: 'u1' })).toHaveLength(0);
    // Wait one tick so the next assignment stamps a strictly later
    // updatedAt than the markIssueSeen write.
    await new Promise((r) => setTimeout(r, 5));
    assignIssue(iss.id, 'ofc_1');
    expect(getUnseenStatusChanges({ role: 'farmer', farmerId: 'u1' })).toHaveLength(1);
  });
});

// ─── Metrics ─────────────────────────────────────────────────────
describe('getIssueMetrics', () => {
  it('counts by status + high severity + computes avg response', () => {
    const a = createIssue({ issueType: 'pest',    severity: 'high',   description: 'a' });
    const b = createIssue({ issueType: 'disease', severity: 'medium', description: 'b' });
    const c = createIssue({ issueType: 'soil',    severity: 'high',   description: 'c' });
    assignIssue(a.id, 'ofc_1');
    assignIssue(b.id, 'ofc_1');
    updateIssueStatus(a.id, ISSUE_STATUS.IN_PROGRESS, { authorRole: 'field_officer' });
    updateIssueStatus(b.id, ISSUE_STATUS.RESOLVED,    { authorRole: 'field_officer' });

    const m = getIssueMetrics();
    expect(m.total).toBe(3);
    expect(m.open).toBe(1);           // c
    expect(m.inProgress).toBe(1);     // a
    expect(m.resolved).toBe(1);       // b
    expect(m.highSeverity).toBe(2);   // a + c
    expect(m.avgResponseMs).toBeGreaterThanOrEqual(0);
  });

  it('empty store → zero metrics, never NaN', () => {
    const m = getIssueMetrics();
    expect(m.total).toBe(0);
    expect(m.open).toBe(0);
    expect(m.avgResponseMs).toBeNull();
  });
});

// ─── Robustness ──────────────────────────────────────────────────
describe('robustness', () => {
  it('no crash when the store is empty', () => {
    expect(getAllIssues()).toEqual([]);
    expect(getIssuesForRole('admin')).toEqual([]);
    expect(getIssuesForRole('farmer', { farmerId: 'u1' })).toEqual([]);
    expect(getIssuesForRole('field_officer', { officerId: 'ofc_1' })).toEqual([]);
    expect(getIssueById('nope')).toBeNull();
  });

  it('frozen outputs — consumer mutation is a no-op', () => {
    const iss = createIssue({ issueType: 'pest', description: 'x' });
    expect(Object.isFrozen(iss)).toBe(true);
    expect(Object.isFrozen(iss.notes)).toBe(true);
    const fetched = getIssueById(iss.id);
    expect(Object.isFrozen(fetched)).toBe(true);
  });

  it('ISSUE_TYPES is a stable frozen list', () => {
    expect(ISSUE_TYPES).toContain('pest');
    expect(ISSUE_TYPES).toContain('other');
    expect(Object.isFrozen(ISSUE_TYPES)).toBe(true);
  });
});
