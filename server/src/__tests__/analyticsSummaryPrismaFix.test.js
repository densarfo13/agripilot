/**
 * analyticsSummaryPrismaFix.test.js — regression guard for the 2026-07-05 production crash.
 *
 * GET /api/v2/analytics-summary 500'd with PrismaClientValidationError because it filtered
 * `prisma.officerValidation` on a non-existent `status` field (and used the wrong `farmSeason`
 * season-relation key). These tests lock the schema-valid query shape + the never-crash envelope.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(__dirname, '../../routes/analytics-summary.js'), 'utf8');

describe('analytics-summary Prisma fix', () => {
  it('does NOT filter officerValidation by a non-existent `status` field', () => {
    // The exact crash: officerValidation.count({ where: { ... status: 'approved'|'pending' }})
    expect(SRC).not.toMatch(/officerValidation[\s\S]{0,80}status\s*:/);
    expect(SRC).not.toContain("status: 'approved'");
    expect(SRC).not.toContain("status: 'pending'");
  });

  it('validatedUpdates uses validatedAt (a real, non-null OfficerValidation field)', () => {
    expect(SRC).toMatch(/officerValidation\.count\(\{\s*where:\s*\{[^}]*validatedAt:\s*\{\s*not:\s*null/);
  });

  it('pendingValidations uses completedAt: null (schema-honest, since validatedAt is non-nullable)', () => {
    expect(SRC).toMatch(/officerValidation\.count\(\{\s*where:\s*\{[^}]*completedAt:\s*null/);
  });

  it('uses the real `season` relation key, not the invalid `farmSeason`, for season-org scoping', () => {
    expect(SRC).not.toMatch(/farmSeason:\s*\{\s*farmer/);
    expect(SRC).toMatch(/season:\s*\{\s*farmer:\s*\{\s*organizationId/);
  });

  it('wraps the handler so any failure returns the safe analytics_summary_failed envelope (no dashboard crash)', () => {
    expect(SRC).toContain("error: 'analytics_summary_failed'");
    expect(SRC).toContain("message: 'Unable to load analytics summary'");
    expect(SRC).toMatch(/ok:\s*false/);
    // The catch degrades to 200 so the admin dashboard renders a safe state.
    expect(SRC).toMatch(/catch\s*\(err\)[\s\S]{0,200}status\(200\)/);
  });

  it('does not infer approved FARMERS from OfficerValidation — uses Farmer.registrationStatus', () => {
    // approvedFarmers must come from the Farmer model, never OfficerValidation.
    expect(SRC).toMatch(/farmer\.count\(\{\s*where:\s*\{[^}]*registrationStatus:\s*'approved'/);
  });
});
