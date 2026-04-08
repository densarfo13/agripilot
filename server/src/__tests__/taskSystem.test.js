import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    farmer: { findUnique: vi.fn(), findMany: vi.fn() },
    farmSeason: { findMany: vi.fn() },
    application: { findMany: vi.fn() },
    seasonProgressEntry: { count: vi.fn() },
  };
  return { default: mockPrisma };
});

import prisma from '../config/database.js';
import {
  getFarmerTasks,
  getFieldOfficerTasks,
  getReviewerTasks,
  getAdminTasks,
  getTasksForUser,
} from '../modules/tasks/service.js';

// ─── Helpers ───────────────────────────────────────────────

const now = new Date();
const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000);
const daysAhead = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  prisma.seasonProgressEntry.count.mockResolvedValue(0);
});

function makeFarmer(overrides = {}) {
  return {
    id: 'farmer-1',
    fullName: 'Alice Farmer',
    registrationStatus: 'approved',
    invitedAt: null,
    approvedAt: daysAgo(30),
    organizationId: 'org-1',
    farmSeasons: [],
    userAccount: { id: 'user-1', lastLoginAt: new Date() },
    assignedOfficerId: 'officer-1',
    ...overrides,
  };
}

function makeActiveSeason(overrides = {}) {
  return {
    id: 'season-1',
    status: 'active',
    cropType: 'maize',
    plantingDate: daysAgo(60),
    expectedHarvestDate: daysAhead(60),
    createdAt: daysAgo(60),
    lastActivityDate: daysAgo(5),
    progressEntries: [
      { id: 'e1', entryDate: daysAgo(5), imageUrl: null, entryType: 'activity' },
    ],
    officerValidations: [],
    harvestReport: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// getFarmerTasks
// ═══════════════════════════════════════════════════════════

describe('getFarmerTasks', () => {
  it('returns START_SEASON when approved farmer has no active season', async () => {
    prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ farmSeasons: [] }));
    const tasks = await getFarmerTasks('farmer-1');
    expect(tasks.some(t => t.taskType === 'START_SEASON')).toBe(true);
  });

  it('does not return other tasks when START_SEASON is returned (no active season)', async () => {
    prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ farmSeasons: [] }));
    const tasks = await getFarmerTasks('farmer-1');
    // START_SEASON is the only task — nothing else actionable without a season
    expect(tasks.length).toBe(1);
    expect(tasks[0].taskType).toBe('START_SEASON');
  });

  it('returns REPORT_HARVEST when harvest date is overdue', async () => {
    const season = makeActiveSeason({ expectedHarvestDate: daysAgo(5), harvestReport: null });
    prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ farmSeasons: [season] }));
    const tasks = await getFarmerTasks('farmer-1');
    expect(tasks.some(t => t.taskType === 'REPORT_HARVEST')).toBe(true);
    const harvestTask = tasks.find(t => t.taskType === 'REPORT_HARVEST');
    expect(harvestTask.priority).toBe('High');
    expect(harvestTask.seasonId).toBe('season-1');
  });

  it('returns LOG_UPDATE with High priority when 14+ days since last update', async () => {
    const season = makeActiveSeason({ lastActivityDate: daysAgo(16), progressEntries: [] });
    prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ farmSeasons: [season] }));
    const tasks = await getFarmerTasks('farmer-1');
    const updateTask = tasks.find(t => t.taskType === 'LOG_UPDATE');
    expect(updateTask).toBeDefined();
    expect(updateTask.priority).toBe('High');
  });

  it('returns LOG_UPDATE with Medium priority when 7-13 days since last update', async () => {
    const season = makeActiveSeason({ lastActivityDate: daysAgo(9), progressEntries: [] });
    prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ farmSeasons: [season] }));
    const tasks = await getFarmerTasks('farmer-1');
    const updateTask = tasks.find(t => t.taskType === 'LOG_UPDATE');
    expect(updateTask).toBeDefined();
    expect(updateTask.priority).toBe('Medium');
  });

  it('returns no tasks for recently active season with harvest in future', async () => {
    const season = makeActiveSeason({ lastActivityDate: daysAgo(2), expectedHarvestDate: daysAhead(60) });
    prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ farmSeasons: [season] }));
    const tasks = await getFarmerTasks('farmer-1');
    // No high-priority tasks expected for a healthy season
    expect(tasks.every(t => t.taskType !== 'REPORT_HARVEST')).toBe(true);
    expect(tasks.every(t => t.taskType !== 'LOG_UPDATE')).toBe(true);
  });

  it('returns empty array if farmer not found', async () => {
    prisma.farmer.findUnique.mockResolvedValue(null);
    const tasks = await getFarmerTasks('nonexistent');
    expect(tasks).toEqual([]);
  });

  it('includes farmerId and seasonId in task refs', async () => {
    const season = makeActiveSeason({ expectedHarvestDate: daysAgo(3) });
    prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ farmSeasons: [season] }));
    const tasks = await getFarmerTasks('farmer-1');
    const harvestTask = tasks.find(t => t.taskType === 'REPORT_HARVEST');
    expect(harvestTask.farmerId).toBe('farmer-1');
    expect(harvestTask.seasonId).toBe('season-1');
  });
});

// ═══════════════════════════════════════════════════════════
// getFieldOfficerTasks
// ═══════════════════════════════════════════════════════════

describe('getFieldOfficerTasks', () => {
  function makeAssignedFarmer(overrides = {}) {
    return {
      id: 'farmer-fo-1',
      fullName: 'Bob Farmer',
      registrationStatus: 'approved',
      organizationId: 'org-1',
      assignedOfficerId: 'officer-1',
      farmSeasons: [],
      ...overrides,
    };
  }

  it('returns FOLLOW_UP_STALE for assigned farmer inactive 14+ days', async () => {
    const season = makeActiveSeason({ lastActivityDate: daysAgo(16) });
    prisma.farmer.findMany.mockResolvedValue([makeAssignedFarmer({ farmSeasons: [season] })]);
    const tasks = await getFieldOfficerTasks('officer-1', 'org-1');
    expect(tasks.some(t => t.taskType === 'FOLLOW_UP_STALE')).toBe(true);
    const staleTask = tasks.find(t => t.taskType === 'FOLLOW_UP_STALE');
    expect(staleTask.farmerId).toBe('farmer-fo-1');
  });

  it('returns CONFIRM_HARVEST when harvest reported but no harvest validation', async () => {
    const season = makeActiveSeason({
      harvestReport: { id: 'hr1', createdAt: daysAgo(4) },
      officerValidations: [], // no harvest validation
    });
    prisma.farmer.findMany.mockResolvedValue([makeAssignedFarmer({ farmSeasons: [season] })]);
    const tasks = await getFieldOfficerTasks('officer-1', 'org-1');
    expect(tasks.some(t => t.taskType === 'CONFIRM_HARVEST')).toBe(true);
  });

  it('does NOT return CONFIRM_HARVEST when harvest is already validated', async () => {
    const season = makeActiveSeason({
      harvestReport: { id: 'hr1', createdAt: daysAgo(4) },
      officerValidations: [
        { id: 'v1', validationType: 'harvest', confirmedHarvest: true, validatedAt: daysAgo(2) },
      ],
    });
    prisma.farmer.findMany.mockResolvedValue([makeAssignedFarmer({ farmSeasons: [season] })]);
    const tasks = await getFieldOfficerTasks('officer-1', 'org-1');
    expect(tasks.some(t => t.taskType === 'CONFIRM_HARVEST')).toBe(false);
  });

  it('does NOT include tasks for farmers assigned to different officer', async () => {
    // Org scope is enforced via DB query — mock returns only assigned farmers
    prisma.farmer.findMany.mockResolvedValue([]); // different officer, no farmers
    const tasks = await getFieldOfficerTasks('other-officer', 'org-1');
    expect(tasks).toEqual([]);
  });

  it('returns VALIDATE_UPDATE when farmer has entries newer than last validation', async () => {
    const season = makeActiveSeason({
      progressEntries: [{ id: 'e1', entryDate: daysAgo(2), imageUrl: null, entryType: 'activity' }],
      officerValidations: [
        { id: 'v1', validationType: 'stage', validatedAt: daysAgo(5) }, // older than latest entry
      ],
    });
    prisma.farmer.findMany.mockResolvedValue([makeAssignedFarmer({ farmSeasons: [season] })]);
    const tasks = await getFieldOfficerTasks('officer-1', 'org-1');
    expect(tasks.some(t => t.taskType === 'VALIDATE_UPDATE')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// getReviewerTasks
// ═══════════════════════════════════════════════════════════

describe('getReviewerTasks', () => {
  it('returns REVIEW_APPLICATION for assigned pending applications', async () => {
    prisma.application.findMany
      .mockResolvedValueOnce([
        { id: 'app-1', createdAt: daysAgo(3), status: 'submitted', farmer: { fullName: 'Alice' } },
      ])
      .mockResolvedValueOnce([]) // no blocked
      .mockResolvedValueOnce([]); // no overdue unassigned

    const tasks = await getReviewerTasks('reviewer-1', 'org-1');
    expect(tasks.some(t => t.taskType === 'REVIEW_APPLICATION')).toBe(true);
    expect(tasks.find(t => t.taskType === 'REVIEW_APPLICATION')?.applicationId).toBe('app-1');
  });

  it('returns REVIEW_OVERDUE for applications pending 7+ days', async () => {
    prisma.application.findMany
      .mockResolvedValueOnce([
        { id: 'app-2', createdAt: daysAgo(10), status: 'submitted', farmer: { fullName: 'Bob' } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const tasks = await getReviewerTasks('reviewer-1', 'org-1');
    const overdueTask = tasks.find(t => t.taskType === 'REVIEW_OVERDUE');
    expect(overdueTask).toBeDefined();
    expect(overdueTask.priority).toBe('High');
  });

  it('returns RESOLVE_BLOCKER for needs_more_evidence applications', async () => {
    prisma.application.findMany
      .mockResolvedValueOnce([]) // no pending
      .mockResolvedValueOnce([
        { id: 'app-3', createdAt: daysAgo(5), farmer: { fullName: 'Carol' } },
      ])
      .mockResolvedValueOnce([]); // no unassigned

    const tasks = await getReviewerTasks('reviewer-1', 'org-1');
    expect(tasks.some(t => t.taskType === 'RESOLVE_BLOCKER')).toBe(true);
  });

  it('returns no reviewer tasks if queue is empty', async () => {
    prisma.application.findMany.mockResolvedValue([]);
    const tasks = await getReviewerTasks('reviewer-1', 'org-1');
    expect(tasks).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// getAdminTasks
// ═══════════════════════════════════════════════════════════

describe('getAdminTasks', () => {
  beforeEach(() => {
    prisma.farmer.findMany.mockResolvedValue([]);
    prisma.farmSeason.findMany.mockResolvedValue([]);
    prisma.application.findMany.mockResolvedValue([]);
  });

  it('returns APPROVE_ONBOARDING for pending farmers', async () => {
    prisma.farmer.findMany
      .mockResolvedValueOnce([
        { id: 'f1', fullName: 'Pending Farmer', region: 'Central', selfRegistered: true, createdAt: daysAgo(5) },
      ]) // pending_approval
      .mockResolvedValueOnce([]); // stalled invites

    const tasks = await getAdminTasks('org-1');
    expect(tasks.some(t => t.taskType === 'APPROVE_ONBOARDING')).toBe(true);
    expect(tasks.find(t => t.taskType === 'APPROVE_ONBOARDING')?.farmerId).toBe('f1');
  });

  it('returns RESOLVE_INVITE for stalled invites (7+ days)', async () => {
    prisma.farmer.findMany
      .mockResolvedValueOnce([]) // no pending approval
      .mockResolvedValueOnce([
        { id: 'f2', fullName: 'Stalled Farmer', invitedAt: daysAgo(10) },
      ]); // stalled invites

    const tasks = await getAdminTasks('org-1');
    expect(tasks.some(t => t.taskType === 'RESOLVE_INVITE')).toBe(true);
  });

  it('returns ASSIGN_OFFICER for seasons without assigned officer', async () => {
    prisma.farmer.findMany.mockResolvedValue([]);
    prisma.farmSeason.findMany
      .mockResolvedValueOnce([
        { id: 's1', cropType: 'maize', createdAt: daysAgo(10), farmer: { id: 'f3', fullName: 'No Officer Farmer' } },
      ]) // unassigned seasons
      .mockResolvedValueOnce([]); // high risk seasons

    const tasks = await getAdminTasks('org-1');
    expect(tasks.some(t => t.taskType === 'ASSIGN_OFFICER')).toBe(true);
  });

  it('returns REVIEW_BACKLOG for applications pending 14+ days', async () => {
    prisma.application.findMany.mockResolvedValue([
      { id: 'app-old', createdAt: daysAgo(16), farmer: { fullName: 'Delayed Farmer' } },
    ]);

    const tasks = await getAdminTasks('org-1');
    expect(tasks.some(t => t.taskType === 'REVIEW_BACKLOG')).toBe(true);
  });

  it('returns empty array when org has no issues', async () => {
    prisma.farmer.findMany.mockResolvedValue([]);
    prisma.farmSeason.findMany.mockResolvedValue([]);
    prisma.application.findMany.mockResolvedValue([]);
    const tasks = await getAdminTasks('org-1');
    expect(tasks).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// getTasksForUser — role routing
// ═══════════════════════════════════════════════════════════

describe('getTasksForUser — role routing', () => {
  it('investor_viewer gets empty task list', async () => {
    const tasks = await getTasksForUser({ userId: 'iv-1', role: 'investor_viewer', organizationId: 'org-1', farmerId: null });
    expect(tasks).toEqual([]);
  });

  it('farmer with no farmerId gets empty task list', async () => {
    const tasks = await getTasksForUser({ userId: 'u1', role: 'farmer', organizationId: null, farmerId: null });
    expect(tasks).toEqual([]);
  });

  it('farmer with farmerId delegates to getFarmerTasks', async () => {
    prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ farmSeasons: [] }));
    const tasks = await getTasksForUser({ userId: 'u1', role: 'farmer', organizationId: null, farmerId: 'farmer-1' });
    expect(tasks.some(t => t.taskType === 'START_SEASON')).toBe(true);
  });

  it('field_officer delegates to getFieldOfficerTasks', async () => {
    prisma.farmer.findMany.mockResolvedValue([]);
    const tasks = await getTasksForUser({ userId: 'fo-1', role: 'field_officer', organizationId: 'org-1', farmerId: null });
    expect(Array.isArray(tasks)).toBe(true);
  });

  it('reviewer delegates to getReviewerTasks', async () => {
    prisma.application.findMany.mockResolvedValue([]);
    const tasks = await getTasksForUser({ userId: 'r-1', role: 'reviewer', organizationId: 'org-1', farmerId: null });
    expect(Array.isArray(tasks)).toBe(true);
  });

  it('institutional_admin delegates to getAdminTasks', async () => {
    prisma.farmer.findMany.mockResolvedValue([]);
    prisma.farmSeason.findMany.mockResolvedValue([]);
    prisma.application.findMany.mockResolvedValue([]);
    const tasks = await getTasksForUser({ userId: 'adm-1', role: 'institutional_admin', organizationId: 'org-1', farmerId: null });
    expect(Array.isArray(tasks)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Task output structure
// ═══════════════════════════════════════════════════════════

describe('task output structure', () => {
  it('all tasks have required fields', async () => {
    const season = makeActiveSeason({ expectedHarvestDate: daysAgo(5) });
    prisma.farmer.findUnique.mockResolvedValue(makeFarmer({ farmSeasons: [season] }));
    const tasks = await getFarmerTasks('farmer-1');

    for (const t of tasks) {
      expect(t).toHaveProperty('taskType');
      expect(t).toHaveProperty('title');
      expect(t).toHaveProperty('reason');
      expect(t).toHaveProperty('priority');
      expect(t).toHaveProperty('status', 'open');
      expect(t).toHaveProperty('createdAt');
      expect(['High', 'Medium', 'Low']).toContain(t.priority);
    }
  });
});

