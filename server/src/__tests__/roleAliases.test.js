import { describe, it, expect } from 'vitest';
import {
  SPEC_ROLES,
  normalizeRole,
  expandRoles,
  isRoleInGroup,
} from '../middleware/roleAliases.js';

describe('roleAliases', () => {
  describe('normalizeRole', () => {
    it('maps legacy names onto canonical spec names', () => {
      expect(normalizeRole('super_admin')).toBe('platform_admin');
      expect(normalizeRole('admin')).toBe('platform_admin');
      expect(normalizeRole('institutional_admin')).toBe('ngo_admin');
      expect(normalizeRole('staff')).toBe('ngo_admin');
      expect(normalizeRole('ngo')).toBe('ngo_admin');
      expect(normalizeRole('field_officer')).toBe('field_agent');
      expect(normalizeRole('agent')).toBe('field_agent');
    });

    it('passes canonical names through unchanged', () => {
      expect(normalizeRole('platform_admin')).toBe('platform_admin');
      expect(normalizeRole('farmer')).toBe('farmer');
      expect(normalizeRole('buyer')).toBe('buyer');
      expect(normalizeRole('backyard_user')).toBe('backyard_user');
    });

    it('returns empty string for null / undefined / empty input', () => {
      expect(normalizeRole(null)).toBe('');
      expect(normalizeRole(undefined)).toBe('');
      expect(normalizeRole('')).toBe('');
      expect(normalizeRole('  ')).toBe('');
    });

    it('lower-cases the input', () => {
      expect(normalizeRole('SUPER_ADMIN')).toBe('platform_admin');
      expect(normalizeRole('Farmer')).toBe('farmer');
    });

    it('passes unknown roles through (deny-by-default for typos)', () => {
      expect(normalizeRole('robot_overlord')).toBe('robot_overlord');
    });
  });

  describe('expandRoles', () => {
    it('expands platform_admin to include all admin aliases', () => {
      const out = expandRoles(['platform_admin']);
      expect(out).toContain('platform_admin');
      expect(out).toContain('super_admin');
      expect(out).toContain('admin');
    });

    it('expands ngo_admin to include institutional_admin / ngo / staff', () => {
      const out = expandRoles('ngo_admin');
      expect(out).toContain('ngo_admin');
      expect(out).toContain('institutional_admin');
      expect(out).toContain('ngo');
      expect(out).toContain('staff');
    });

    it('expands field_agent to include field_officer / agent', () => {
      const out = expandRoles(['field_agent']);
      expect(out).toContain('field_agent');
      expect(out).toContain('field_officer');
      expect(out).toContain('agent');
    });

    it('handles legacy names as input — same expansion', () => {
      expect(expandRoles(['super_admin'])).toEqual(
        expect.arrayContaining(['platform_admin', 'super_admin', 'admin']),
      );
    });

    it('dedupes overlapping inputs', () => {
      const out = expandRoles(['platform_admin', 'super_admin']);
      const adminCount = out.filter((r) => r === 'super_admin').length;
      expect(adminCount).toBe(1);
    });

    it('passes unknown roles through (deny-by-default)', () => {
      const out = expandRoles(['mystery_role']);
      expect(out).toEqual(['mystery_role']);
    });

    it('skips null / empty entries', () => {
      const out = expandRoles([null, '', '  ', 'farmer']);
      expect(out).toEqual(['farmer']);
    });
  });

  describe('isRoleInGroup', () => {
    it('matches a legacy actual role to a spec-name allow list', () => {
      // User has legacy 'super_admin' in their JWT; allow list uses
      // spec name 'platform_admin'. Should match.
      expect(isRoleInGroup('super_admin', ['platform_admin'])).toBe(true);
      expect(isRoleInGroup('institutional_admin', ['ngo_admin'])).toBe(true);
      expect(isRoleInGroup('field_officer', ['field_agent'])).toBe(true);
    });

    it('rejects when the actual role is outside the allowed group', () => {
      expect(isRoleInGroup('farmer', ['platform_admin'])).toBe(false);
      expect(isRoleInGroup('buyer', ['ngo_admin'])).toBe(false);
    });

    it('returns false for empty / null actual role', () => {
      expect(isRoleInGroup(null, ['farmer'])).toBe(false);
      expect(isRoleInGroup('', ['farmer'])).toBe(false);
    });
  });

  describe('SPEC_ROLES', () => {
    it('exports all 6 canonical role names', () => {
      expect(SPEC_ROLES.BACKYARD_USER).toBe('backyard_user');
      expect(SPEC_ROLES.FARMER).toBe('farmer');
      expect(SPEC_ROLES.BUYER).toBe('buyer');
      expect(SPEC_ROLES.NGO_ADMIN).toBe('ngo_admin');
      expect(SPEC_ROLES.FIELD_AGENT).toBe('field_agent');
      expect(SPEC_ROLES.PLATFORM_ADMIN).toBe('platform_admin');
    });
  });
});
