/**
 * consistencyHelpers.test.js — contract for the §1–§10
 * data-reliability helpers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import consistencyPkg, {
  isActiveFarmer, farmerStatus,
  enforceProgramOnFarm, programsConsistent,
  validateImportRowWithProgram, validateImportBatchWithPrograms,
  paginate, buildEnhancedExportRow, EXPORT_COLUMNS_V2,
} from '../../../server/src/core/consistencyHelpers.js';

import auditPkg, { logAuditAction, ALLOWED_ACTIONS } from '../../../server/src/core/auditLog.js';

const NOW = new Date('2026-04-20T12:00:00Z').getTime();
const day = 24 * 60 * 60 * 1000;

// ─── isActiveFarmer / farmerStatus — §4 ────────────────────
describe('isActiveFarmer', () => {
  it('true when lastActivity within 7 days', () => {
    expect(isActiveFarmer(new Date(NOW - 3 * day), NOW)).toBe(true);
    expect(isActiveFarmer(new Date(NOW - 6.9 * day), NOW)).toBe(true);
  });
  it('false when >7 days old', () => {
    expect(isActiveFarmer(new Date(NOW - 8 * day), NOW)).toBe(false);
  });
  it('false when lastActivity missing / bad', () => {
    expect(isActiveFarmer(null, NOW)).toBe(false);
    expect(isActiveFarmer('not-a-date', NOW)).toBe(false);
    expect(isActiveFarmer(undefined, NOW)).toBe(false);
  });
  it('accepts ISO string / ms number / Date', () => {
    const iso = new Date(NOW - 2 * day).toISOString();
    expect(isActiveFarmer(iso, NOW)).toBe(true);
    expect(isActiveFarmer(NOW - 2 * day, NOW)).toBe(true);
  });
  it('negative age (clock skew) is not active', () => {
    expect(isActiveFarmer(NOW + 1000, NOW)).toBe(false);
  });
  it('windowDays is configurable', () => {
    expect(isActiveFarmer(new Date(NOW - 20 * day), NOW, 30)).toBe(true);
    expect(isActiveFarmer(new Date(NOW - 20 * day), NOW, 14)).toBe(false);
  });
});

describe('farmerStatus', () => {
  it('returns Active / Inactive strings per §6', () => {
    expect(farmerStatus(new Date(NOW - 2 * day), NOW)).toBe('Active');
    expect(farmerStatus(new Date(NOW - 10 * day), NOW)).toBe('Inactive');
    expect(farmerStatus(null, NOW)).toBe('Inactive');
  });
});

// ─── enforceProgramOnFarm — §1 ──────────────────────────────
describe('enforceProgramOnFarm', () => {
  it('already_consistent when farm.program === user.program', () => {
    const out = enforceProgramOnFarm({ program: 'A' }, { id: 'f', program: 'A' });
    expect(out.changed).toBe(false);
    expect(out.reason).toBe('already_consistent');
  });

  it('forces farm.program to match user.program', () => {
    const out = enforceProgramOnFarm({ program: 'A' }, { id: 'f', program: 'B' });
    expect(out.changed).toBe(true);
    expect(out.reason).toBe('match_user_program');
    expect(out.farm.program).toBe('A');
  });

  it('preserves farm.program when user has none', () => {
    const out = enforceProgramOnFarm({}, { id: 'f', program: 'B' });
    expect(out.changed).toBe(false);
    expect(out.reason).toBe('user_program_missing');
    expect(out.farm.program).toBe('B');
  });

  it('returns frozen output', () => {
    const out = enforceProgramOnFarm({ program: 'A' }, { id: 'f' });
    expect(Object.isFrozen(out)).toBe(true);
    expect(Object.isFrozen(out.farm)).toBe(true);
  });

  it('safe on null inputs', () => {
    const out = enforceProgramOnFarm(null, null);
    expect(out.changed).toBe(false);
  });
});

describe('programsConsistent', () => {
  it('true when user has no program (nothing to enforce)', () => {
    expect(programsConsistent({}, { program: 'B' })).toBe(true);
  });
  it('true when both match', () => {
    expect(programsConsistent({ program: 'A' }, { program: 'A' })).toBe(true);
  });
  it('false when they differ', () => {
    expect(programsConsistent({ program: 'A' }, { program: 'B' })).toBe(false);
  });
});

// ─── validateImportRowWithProgram — §8 ──────────────────────
describe('validateImportRowWithProgram', () => {
  it('ok when name + phone + program present', () => {
    const { row, errors, ok } = validateImportRowWithProgram({
      name: 'Ama', phone: '0555', program: 'Cassava Program',
    });
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
    expect(row.program).toBe('Cassava Program');
  });

  it('flags missing name, phone, program', () => {
    const { errors } = validateImportRowWithProgram({});
    expect(errors).toContain('missing_name');
    expect(errors).toContain('missing_phone');
    expect(errors).toContain('missing_program');
  });

  it('flags unknown program when knownPrograms supplied', () => {
    const { errors } = validateImportRowWithProgram(
      { name: 'A', phone: '1', program: 'Mystery Program' },
      ['Cassava Program', 'Maize Program'],
    );
    expect(errors).toContain('unknown_program');
  });

  it('allows known program with case-insensitive match', () => {
    const { ok } = validateImportRowWithProgram(
      { name: 'A', phone: '1', program: 'cassava program' },
      ['Cassava Program'],
    );
    expect(ok).toBe(true);
  });

  it('row is frozen on success', () => {
    const { row } = validateImportRowWithProgram({
      name: 'A', phone: '1', program: 'X',
    });
    expect(Object.isFrozen(row)).toBe(true);
  });
});

describe('validateImportBatchWithPrograms', () => {
  it('returns {imported, failed} counts per spec §8', () => {
    const out = validateImportBatchWithPrograms([
      { name: 'Ama',   phone: '1', program: 'A' },
      { name: 'Kwame', phone: '1', program: 'A' }, // duplicate phone
      { name: '',      phone: '2', program: 'A' }, // missing name
      { name: 'Kofi',  phone: '3', program: 'A' },
    ]);
    expect(out.imported).toBe(2);
    expect(out.failed).toBe(2);
  });

  it('dedupes by phone across the batch', () => {
    const out = validateImportBatchWithPrograms([
      { name: 'A', phone: '1', program: 'X' },
      { name: 'B', phone: '1', program: 'X' },
    ]);
    expect(out.imported).toBe(1);
    expect(out.invalid[0].errors).toContain('duplicate_phone');
  });
});

// ─── paginate — §7 ─────────────────────────────────────────
describe('paginate', () => {
  const rows = Array.from({ length: 123 }, (_, i) => ({ i }));

  it('page 1 of 50 returns first 50 + metadata', () => {
    const r = paginate(rows, { page: 1, limit: 50 });
    expect(r.data.length).toBe(50);
    expect(r.total).toBe(123);
    expect(r.totalPages).toBe(3);
    expect(r.hasMore).toBe(true);
  });

  it('last page returns the remainder', () => {
    const r = paginate(rows, { page: 3, limit: 50 });
    expect(r.data.length).toBe(23);
    expect(r.hasMore).toBe(false);
  });

  it('page > totalPages clamped down', () => {
    const r = paginate(rows, { page: 99, limit: 50 });
    expect(r.page).toBe(3);
  });

  it('limit clamped to [1, 500]; 0 falls back to default', () => {
    // 0 is treated as "use default" (50) per the || fallback; any
    // truthy negative or tiny number is clamped to 1.
    expect(paginate(rows, { limit: 0 }).limit).toBe(50);
    expect(paginate(rows, { limit: -5 }).limit).toBe(1);
    expect(paginate(rows, { limit: 9999 }).limit).toBe(500);
  });

  it('non-array input is safe', () => {
    const r = paginate(null);
    expect(r.total).toBe(0);
    expect(r.data).toEqual([]);
  });

  it('result is frozen', () => {
    expect(Object.isFrozen(paginate([1, 2, 3]))).toBe(true);
  });
});

// ─── buildEnhancedExportRow — §10 ──────────────────────────
describe('buildEnhancedExportRow', () => {
  it('returns all 7 columns with completion % formatted', () => {
    const row = buildEnhancedExportRow({
      farmerName: 'Ama', crop: 'MAIZE', location: 'Ashanti',
      risk: 'high', score: 42, completionRate: 0.65,
      lastActivity: '2026-04-18T00:00:00Z',
    });
    expect(row.farmer_name).toBe('Ama');
    expect(row.completion_rate).toBe('65%');
    expect(row.risk).toBe('high');
  });

  it('EXPORT_COLUMNS_V2 matches the returned keys exactly', () => {
    const row = buildEnhancedExportRow({});
    const rowKeys = Object.keys(row).sort();
    const defined = [...EXPORT_COLUMNS_V2].sort();
    expect(rowKeys).toEqual(defined);
  });

  it('missing fields become empty strings', () => {
    const row = buildEnhancedExportRow({});
    expect(row.completion_rate).toBe('');
    expect(row.farmer_name).toBe('');
  });

  it('returns frozen object', () => {
    expect(Object.isFrozen(buildEnhancedExportRow({}))).toBe(true);
  });
});

// ─── audit log — §9 ────────────────────────────────────────
describe('logAuditAction', () => {
  function fakePrisma() {
    const rows = [];
    return {
      _rows: rows,
      adminAuditLog: {
        create: async ({ data }) => {
          const row = { id: `a_${rows.length + 1}`, createdAt: new Date(), ...data };
          rows.push(row);
          return row;
        },
      },
    };
  }

  it('writes a row with every supplied field', async () => {
    const db = fakePrisma();
    const out = await logAuditAction(db, {
      actorId: 'u1', actorRole: 'admin',
      action: 'ngo_import',
      targetId: 'f1', targetKind: 'farm',
      payload: { count: 10 }, ip: '1.2.3.4', userAgent: 'curl',
    });
    expect(out.ok).toBe(true);
    expect(db._rows[0].action).toBe('ngo_import');
    expect(db._rows[0].targetKind).toBe('farm');
  });

  it('rejects unknown action', async () => {
    const out = await logAuditAction(fakePrisma(), { action: 'make_coffee' });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('unknown_action');
  });

  it('rejects unknown targetKind', async () => {
    const out = await logAuditAction(fakePrisma(), {
      action: 'ngo_import', targetKind: 'moon',
    });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('unknown_target_kind');
  });

  it('rejects missing action', async () => {
    expect((await logAuditAction(fakePrisma(), {})).reason).toBe('missing_action');
  });

  it('no prisma → no_prisma, never throws', async () => {
    expect((await logAuditAction(null, { action: 'ngo_import' })).reason).toBe('no_prisma');
  });

  it('DB throw is caught and returns db_failed', async () => {
    const bad = { adminAuditLog: { create: async () => { throw new Error('boom'); } } };
    const out = await logAuditAction(bad, { action: 'ngo_import' });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('db_failed');
  });

  it('ALLOWED_ACTIONS whitelist is stable', () => {
    expect(ALLOWED_ACTIONS.has('ngo_import')).toBe(true);
    expect(ALLOWED_ACTIONS.has('farmer_update')).toBe(true);
    expect(ALLOWED_ACTIONS.has('csv_export')).toBe(true);
    expect(ALLOWED_ACTIONS.has('make_coffee')).toBe(false);
  });
});

// ─── default exports sanity ────────────────────────────────
describe('module surface', () => {
  it('consistency default export mirrors named exports', () => {
    expect(typeof consistencyPkg.isActiveFarmer).toBe('function');
    expect(typeof consistencyPkg.paginate).toBe('function');
  });
  it('audit default export mirrors named exports', () => {
    expect(typeof auditPkg.logAuditAction).toBe('function');
  });
});
