/**
 * ngoImportService.test.js — contract for the pure NGO import
 * helpers + the resolveRootRoute helper on the client side.
 */

import { describe, it, expect } from 'vitest';

import {
  parseCsvImport, normalizeImportRow, dedupeByPhone,
  validateImportBatch, _internal,
} from '../../../server/src/modules/ngoImport/ngoImportService.js';
import {
  resolveRootRoute, userBelongsToProgram,
} from '../../../src/core/welcome/resolveRootRoute.js';

// ─── parseCsvImport ──────────────────────────────────────────
describe('parseCsvImport', () => {
  it('parses a plain CSV with commas', () => {
    const csv = 'name,phone,crop\nKwame Mensah,233550000,cassava\nAma,233551111,maize\n';
    const rows = parseCsvImport(csv);
    expect(rows.length).toBe(2);
    expect(rows[0].name).toBe('Kwame Mensah');
    expect(rows[0].phone).toBe('233550000');
    expect(rows[0].crop).toBe('cassava');
  });

  it('handles quoted fields with embedded commas', () => {
    const csv = 'name,location\n"Jollof, Kwame","North, Ashanti"\n';
    const rows = parseCsvImport(csv);
    expect(rows[0].name).toBe('Jollof, Kwame');
    expect(rows[0].location).toBe('North, Ashanti');
  });

  it('handles escaped quotes inside quoted fields', () => {
    const csv = 'name\n"She said ""hi"""\n';
    const rows = parseCsvImport(csv);
    expect(rows[0].name).toBe('She said "hi"');
  });

  it('skips fully empty lines and all-comma rows', () => {
    const csv = 'name,phone\nAma,1\n\n,,\nKwame,2\n';
    const rows = parseCsvImport(csv);
    expect(rows.length).toBe(2);
  });

  it('normalizes headers to lowercase', () => {
    const csv = 'Name,Phone\nAma,1\n';
    expect(parseCsvImport(csv)[0].name).toBe('Ama');
  });

  it('returns [] for missing / header-only CSV', () => {
    expect(parseCsvImport('')).toEqual([]);
    expect(parseCsvImport('name,phone\n')).toEqual([]);
    expect(parseCsvImport(null)).toEqual([]);
  });

  it('handles \\r\\n line endings', () => {
    const csv = 'name,phone\r\nAma,1\r\nKwame,2\r\n';
    expect(parseCsvImport(csv).length).toBe(2);
  });
});

// ─── normalizeImportRow ──────────────────────────────────────
describe('normalizeImportRow', () => {
  it('accepts a complete row', () => {
    const { row, errors, ok } = normalizeImportRow({
      name: ' Kwame ', phone: '+233-55-000 0000',
      crop: 'cassava', location: 'Ashanti', program: 'Cassava Program',
    });
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
    expect(row.name).toBe('Kwame');
    expect(row.phone).toBe('+233550000000');  // spaces/dashes stripped
    expect(row.crop).toBe('CASSAVA');          // uppercased
  });

  it('flags missing required fields', () => {
    const { errors } = normalizeImportRow({ phone: '1234567' });
    expect(errors).toContain('missing_name');
  });

  it('flags an invalid phone', () => {
    const { errors } = normalizeImportRow({ name: 'A', phone: 'abc' });
    expect(errors).toContain('invalid_phone');
  });

  it('flags an invalid email', () => {
    const { errors } = normalizeImportRow({
      name: 'A', phone: '12345678', email: 'no-at-sign',
    });
    expect(errors).toContain('invalid_email');
  });

  it('frozen output', () => {
    const { row } = normalizeImportRow({ name: 'A', phone: '12345678' });
    expect(Object.isFrozen(row)).toBe(true);
  });
});

// ─── dedupeByPhone ───────────────────────────────────────────
describe('dedupeByPhone', () => {
  it('drops duplicates, first wins', () => {
    const { kept, dropped } = dedupeByPhone([
      { phone: '1', name: 'A' },
      { phone: '2', name: 'B' },
      { phone: '1', name: 'A2' },
    ]);
    expect(kept.length).toBe(2);
    expect(kept[0].name).toBe('A');
    expect(dropped[0].reason).toBe('duplicate_phone');
  });

  it('keeps rows with no phone — we cannot dedupe them', () => {
    const { kept } = dedupeByPhone([
      { name: 'A' }, { name: 'B' },
    ]);
    expect(kept.length).toBe(2);
  });

  it('safe on non-array input', () => {
    expect(dedupeByPhone(null).kept).toEqual([]);
  });
});

// ─── validateImportBatch ────────────────────────────────────
describe('validateImportBatch', () => {
  it('splits valid + invalid + dedupes', () => {
    const { valid, invalid } = validateImportBatch([
      { name: 'Ama',   phone: '12345678' },
      { name: 'Kwame', phone: '12345678' }, // duplicate phone
      { name: '',      phone: '87654321' }, // missing name
      { name: 'Kofi',  phone: '87654321' }, // but previous was invalid, so this is first with that phone
    ]);
    expect(valid.length).toBe(2);
    // The first invalid entry is missing name, then dedup of 12345678
    expect(invalid.length).toBe(2);
  });

  it('empty / non-array → empty split', () => {
    expect(validateImportBatch(null)).toEqual({ valid: [], invalid: [] });
  });
});

// ─── resolveRootRoute ────────────────────────────────────────
describe('resolveRootRoute', () => {
  it('ngo user → /program-dashboard regardless of farm state', () => {
    const r = resolveRootRoute({
      user: { onboardingSource: 'ngo' },
      farms: [{ id: 'f', status: 'active' }],
    });
    expect(r).toBe('/program-dashboard');
  });

  it('also accepts user.source (spec field name)', () => {
    const r = resolveRootRoute({ user: { source: 'NGO' } });
    expect(r).toBe('/program-dashboard');
  });

  it('non-ngo user with active farm → /dashboard', () => {
    const r = resolveRootRoute({
      user: { onboardingSource: 'self_register' },
      farms: [{ id: 'f', status: 'active' }],
    });
    expect(r).toBe('/dashboard');
  });

  it('non-ngo user with complete legacy profile → /dashboard', () => {
    const r = resolveRootRoute({
      user: { onboardingSource: 'self_register' },
      profile: { id: 'f', cropType: 'MAIZE', country: 'Ghana' },
    });
    expect(r).toBe('/dashboard');
  });

  it('non-ngo, no farm → /welcome-farmer', () => {
    const r = resolveRootRoute({ user: { onboardingSource: 'self_register' } });
    expect(r).toBe('/welcome-farmer');
  });

  it('null user → /welcome-farmer', () => {
    const r = resolveRootRoute({ user: null });
    expect(r).toBe('/welcome-farmer');
  });
});

describe('userBelongsToProgram', () => {
  it('returns program string for ngo user', () => {
    expect(userBelongsToProgram({
      onboardingSource: 'ngo', program: 'Cassava Program',
    })).toBe('Cassava Program');
  });

  it('returns null for non-ngo user with a program (defensive)', () => {
    expect(userBelongsToProgram({
      onboardingSource: 'self_register', program: 'Cassava',
    })).toBeNull();
  });

  it('returns null for ngo user with empty program', () => {
    expect(userBelongsToProgram({
      onboardingSource: 'ngo', program: '   ',
    })).toBeNull();
  });

  it('safe on null / non-object', () => {
    expect(userBelongsToProgram(null)).toBeNull();
    expect(userBelongsToProgram('nope')).toBeNull();
  });
});
