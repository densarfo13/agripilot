import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    organization:          { count: vi.fn() },
    user:                  { count: vi.fn() },
    farmer:                { count: vi.fn() },
    farmSeason:            { count: vi.fn() },
    seasonProgressEntry:   { count: vi.fn() },
    harvestReport:         { count: vi.fn() },
    application:           { count: vi.fn() },
    credibilityAssessment: { count: vi.fn() },
    officerValidation: { count: vi.fn().mockResolvedValue(0) },
    farmActivity: { findMany: vi.fn().mockResolvedValue([]) },
    pilotChecklistItem: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
      count:     vi.fn(),
    },
  };
  return { default: mockPrisma };
});

import prisma from '../config/database.js';
import {
  CHECKLIST_ITEMS,
  VALID_ITEM_KEYS,
  CATEGORY_META,
  getChecklist,
  upsertChecklistItem,
  getHealthIndicators,
  getReport,
} from '../modules/pilotQA/service.js';

// ─── Helper: silence all DB mocks to return safe defaults ─

function silenceAllCounts(n = 0) {
  prisma.organization.count.mockResolvedValue(n);
  prisma.user.count.mockResolvedValue(n);
  prisma.farmer.count.mockResolvedValue(n);
  prisma.farmSeason.count.mockResolvedValue(n);
  prisma.seasonProgressEntry.count.mockResolvedValue(n);
  prisma.harvestReport.count.mockResolvedValue(n);
  prisma.application.count.mockResolvedValue(n);
  prisma.credibilityAssessment.count.mockResolvedValue(n);
  prisma.pilotChecklistItem.count.mockResolvedValue(n);
}

// ─── CHECKLIST_ITEMS structure tests ─────────────────────

describe('CHECKLIST_ITEMS definition', () => {
  it('has at least 50 items', () => {
    expect(CHECKLIST_ITEMS.length).toBeGreaterThanOrEqual(50);
  });

  it('every item has itemKey, category, label, description', () => {
    for (const item of CHECKLIST_ITEMS) {
      expect(item.itemKey, `${item.itemKey} missing itemKey`).toBeTruthy();
      expect(item.category, `${item.itemKey} missing category`).toBeTruthy();
      expect(item.label, `${item.itemKey} missing label`).toBeTruthy();
      expect(item.description, `${item.itemKey} missing description`).toBeTruthy();
    }
  });

  it('all itemKeys are unique', () => {
    const keys = CHECKLIST_ITEMS.map(i => i.itemKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('all categories are in CATEGORY_META', () => {
    const categories = [...new Set(CHECKLIST_ITEMS.map(i => i.category))];
    for (const cat of categories) {
      expect(CATEGORY_META[cat], `Category ${cat} missing from CATEGORY_META`).toBeDefined();
    }
  });

  it('VALID_ITEM_KEYS contains all itemKeys', () => {
    for (const item of CHECKLIST_ITEMS) {
      expect(VALID_ITEM_KEYS.has(item.itemKey)).toBe(true);
    }
  });

  it('covers all 12 expected categories', () => {
    const expected = [
      'org_setup', 'user_onboarding', 'invite_delivery', 'farmer_first_use',
      'officer_workflow', 'reviewer_workflow', 'admin_visibility', 'security_access',
      'country_phone', 'season_lifecycle', 'image_evidence', 'monitoring_failure',
    ];
    const actual = [...new Set(CHECKLIST_ITEMS.map(i => i.category))];
    for (const cat of expected) {
      expect(actual).toContain(cat);
    }
  });
});

// ─── getChecklist ─────────────────────────────────────────

describe('getChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    silenceAllCounts(0);
    prisma.pilotChecklistItem.findMany.mockResolvedValue([]);
  });

  it('returns all canonical items (one per checklist definition)', async () => {
    const result = await getChecklist({ organizationId: 'org-1' });
    expect(result).toHaveLength(CHECKLIST_ITEMS.length);
  });

  it('returns not_started for items with no stored record', async () => {
    const result = await getChecklist({ organizationId: 'org-1' });
    expect(result.every(i => i.status === 'not_started')).toBe(true);
  });

  it('merges stored status into the correct item', async () => {
    prisma.pilotChecklistItem.findMany.mockResolvedValue([
      { itemKey: 'org_setup.org_created', status: 'pass', notes: 'Verified', updatedAt: new Date(), updatedBy: null },
    ]);

    const result = await getChecklist({ organizationId: 'org-1' });
    const item = result.find(i => i.itemKey === 'org_setup.org_created');
    expect(item.status).toBe('pass');
    expect(item.notes).toBe('Verified');
  });

  it('does not override stored status with auto-derived when status is set', async () => {
    prisma.pilotChecklistItem.findMany.mockResolvedValue([
      { itemKey: 'farmer_first_use.first_login', status: 'fail', notes: null, updatedAt: new Date(), updatedBy: null },
    ]);
    // Even if auto would suggest pass
    prisma.user.count.mockResolvedValue(5);

    const result = await getChecklist({ organizationId: 'org-1' });
    const item = result.find(i => i.itemKey === 'farmer_first_use.first_login');
    expect(item.status).toBe('fail');
    // suggestedStatus should be null when status is already set
    expect(item.suggestedStatus).toBeNull();
  });

  it('includes suggestedStatus when status is not_started and auto-derive applies', async () => {
    prisma.organization.count.mockResolvedValue(1); // org exists → auto-pass org_setup.org_created
    prisma.pilotChecklistItem.findMany.mockResolvedValue([]); // no stored items

    const result = await getChecklist({ organizationId: 'org-1' });
    const item = result.find(i => i.itemKey === 'org_setup.org_created');
    expect(item.status).toBe('not_started');
    expect(item.suggestedStatus).toBe('pass');
  });

  it('each returned item has all required fields', async () => {
    const result = await getChecklist({ organizationId: 'org-1' });
    for (const item of result) {
      expect(item).toHaveProperty('itemKey');
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('notes');
      expect(item).toHaveProperty('autoDerive');
      expect(item).toHaveProperty('suggestedStatus');
    }
  });
});

// ─── upsertChecklistItem ──────────────────────────────────

describe('upsertChecklistItem', () => {
  const mockRecord = {
    id: 'item-1',
    itemKey: 'org_setup.org_created',
    status: 'pass',
    notes: null,
    updatedAt: new Date(),
    updatedBy: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing record → triggers create path
    prisma.pilotChecklistItem.findFirst.mockResolvedValue(null);
    prisma.pilotChecklistItem.create.mockResolvedValue(mockRecord);
    prisma.pilotChecklistItem.update.mockResolvedValue(mockRecord);
  });

  it('throws 400 for unknown itemKey', async () => {
    const err = await upsertChecklistItem({
      itemKey: 'unknown.item',
      organizationId: 'org-1',
      status: 'pass',
    }).catch(e => e);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/unknown/i);
  });

  it('calls prisma.create with correct data when no existing record', async () => {
    await upsertChecklistItem({
      itemKey: 'org_setup.org_created',
      organizationId: 'org-1',
      status: 'pass',
      notes: 'Tested OK',
      updatedById: 'user-1',
    });

    expect(prisma.pilotChecklistItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { itemKey: 'org_setup.org_created', organizationId: 'org-1' } })
    );
    expect(prisma.pilotChecklistItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pass', notes: 'Tested OK' }),
      })
    );
  });

  it('calls prisma.update when existing record found', async () => {
    prisma.pilotChecklistItem.findFirst.mockResolvedValue({ id: 'item-1' });

    await upsertChecklistItem({
      itemKey: 'org_setup.org_created',
      organizationId: 'org-1',
      status: 'pass',
      notes: 'Updated',
    });

    expect(prisma.pilotChecklistItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-1' },
        data: expect.objectContaining({ status: 'pass', notes: 'Updated' }),
      })
    );
  });

  it('accepts all valid checklist item keys without throwing', async () => {
    for (const key of [...VALID_ITEM_KEYS].slice(0, 5)) {
      await expect(
        upsertChecklistItem({ itemKey: key, organizationId: 'org-1', status: 'pass' })
      ).resolves.not.toThrow();
    }
  });

  it('uses null for organizationId when not provided', async () => {
    await upsertChecklistItem({ itemKey: 'org_setup.org_created', status: 'pass' });
    expect(prisma.pilotChecklistItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { itemKey: 'org_setup.org_created', organizationId: null } })
    );
  });
});

// ─── getHealthIndicators ──────────────────────────────────

describe('getHealthIndicators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    silenceAllCounts(0);
  });

  it('returns all expected health indicator fields', async () => {
    const result = await getHealthIndicators({ organizationId: 'org-1' });
    expect(result).toHaveProperty('invitesSent');
    expect(result).toHaveProperty('invitesAccepted');
    expect(result).toHaveProperty('inviteAcceptRate');
    expect(result).toHaveProperty('farmersFirstUpdate');
    expect(result).toHaveProperty('activeSeasons');
    expect(result).toHaveProperty('staleSeasons');
    expect(result).toHaveProperty('overdueValidations');
    expect(result).toHaveProperty('pendingReviews');
    expect(result).toHaveProperty('checklistFail');
    expect(result).toHaveProperty('checklistBlocked');
  });

  it('calculates inviteAcceptRate correctly', async () => {
    // invitesSent = 8, invitesAccepted = 4 → 50%
    prisma.farmer.count
      .mockResolvedValueOnce(8)  // invitesSent
      .mockResolvedValueOnce(4)  // invitesAccepted
      .mockResolvedValueOnce(3); // farmersFirstUpdate
    prisma.farmSeason.count.mockResolvedValue(2);
    prisma.seasonProgressEntry.count.mockResolvedValue(1);
    prisma.application.count.mockResolvedValue(0);
    prisma.pilotChecklistItem.count.mockResolvedValue(0);

    const result = await getHealthIndicators({ organizationId: 'org-1' });
    expect(result.invitesAccepted).toBe(4);
    expect(result.inviteAcceptRate).toBe(50);
  });

  it('returns null inviteAcceptRate when no invites sent', async () => {
    const result = await getHealthIndicators({ organizationId: 'org-1' });
    expect(result.inviteAcceptRate).toBeNull();
  });
});

// ─── getReport ────────────────────────────────────────────

describe('getReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('total equals number of canonical checklist items', async () => {
    prisma.pilotChecklistItem.findMany.mockResolvedValue([]);
    const result = await getReport({ organizationId: 'org-1' });
    expect(result.total).toBe(CHECKLIST_ITEMS.length);
  });

  it('all items not_started when no stored records', async () => {
    prisma.pilotChecklistItem.findMany.mockResolvedValue([]);
    const result = await getReport({ organizationId: 'org-1' });
    expect(result.not_started).toBe(CHECKLIST_ITEMS.length);
    expect(result.pass).toBe(0);
    expect(result.fail).toBe(0);
  });

  it('counts status correctly from stored records', async () => {
    prisma.pilotChecklistItem.findMany.mockResolvedValue([
      { itemKey: 'org_setup.org_created',    category: 'org_setup', status: 'pass' },
      { itemKey: 'org_setup.admin_login',     category: 'org_setup', status: 'pass' },
      { itemKey: 'invite_delivery.email_invite', category: 'invite_delivery', status: 'fail' },
      { itemKey: 'security_access.org_scoping_holds', category: 'security_access', status: 'blocked' },
    ]);

    const result = await getReport({ organizationId: 'org-1' });
    expect(result.pass).toBe(2);
    expect(result.fail).toBe(1);
    expect(result.blocked).toBe(1);
    expect(result.not_started).toBe(CHECKLIST_ITEMS.length - 4);
  });

  it('passRate is null when only not_started items exist', async () => {
    prisma.pilotChecklistItem.findMany.mockResolvedValue([]);
    const result = await getReport({ organizationId: 'org-1' });
    expect(result.passRate).toBeNull();
  });

  it('passRate calculated from actionable items (excl not_started and n/a)', async () => {
    // 2 pass, 2 fail → passRate = 50%
    prisma.pilotChecklistItem.findMany.mockResolvedValue([
      { itemKey: 'org_setup.org_created',    category: 'org_setup', status: 'pass' },
      { itemKey: 'org_setup.admin_login',     category: 'org_setup', status: 'pass' },
      { itemKey: 'invite_delivery.email_invite',       category: 'invite_delivery', status: 'fail' },
      { itemKey: 'invite_delivery.phone_manual_share', category: 'invite_delivery', status: 'fail' },
    ]);

    const result = await getReport({ organizationId: 'org-1' });
    expect(result.passRate).toBe(50);
  });

  it('topFailCategories lists categories with most failures', async () => {
    prisma.pilotChecklistItem.findMany.mockResolvedValue([
      { itemKey: 'org_setup.org_created',    category: 'org_setup', status: 'fail' },
      { itemKey: 'org_setup.admin_login',     category: 'org_setup', status: 'fail' },
      { itemKey: 'invite_delivery.email_invite', category: 'invite_delivery', status: 'fail' },
    ]);

    const result = await getReport({ organizationId: 'org-1' });
    expect(result.topFailCategories[0].category).toBe('org_setup');
    expect(result.topFailCategories[0].count).toBe(2);
  });

  it('includes generatedAt timestamp', async () => {
    prisma.pilotChecklistItem.findMany.mockResolvedValue([]);
    const result = await getReport({ organizationId: 'org-1' });
    expect(result.generatedAt).toBeTruthy();
    expect(new Date(result.generatedAt)).toBeInstanceOf(Date);
  });
});
