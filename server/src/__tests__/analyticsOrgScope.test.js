/**
 * analyticsOrgScope.test.js — locks the 2026-07-06 analytics tenant-isolation fix.
 *
 * RELEASE_READINESS.md scored analytics Security=2: `analytics/service.js` had zero
 * organizationId scoping, so an institutional_admin (NGO admin) calling /counts or
 * /voice-summary saw GLOBAL cross-org event counts. Fixed via the canonical
 * `orgWhereViaUser` helper (AnalyticsEvent.user → User.organizationId) — no new service,
 * no schema change. This test locks the helper contract + the wiring.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { orgWhereViaUser } from '../middleware/orgScope.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('orgWhereViaUser — canonical analytics tenant filter', () => {
  it('super_admin (cross-org) → {} (global, unchanged)', () => {
    expect(orgWhereViaUser({ isCrossOrg: true, organizationId: 'org-1' })).toEqual({});
  });
  it('no organization → {} (fail-open only for un-scoped; matches sibling helpers)', () => {
    expect(orgWhereViaUser({ organizationId: null })).toEqual({});
  });
  it('institutional_admin (org-scoped) → { user: { organizationId } } (isolates the NGO)', () => {
    expect(orgWhereViaUser({ organizationId: 'org-7' })).toEqual({ user: { organizationId: 'org-7' } });
  });
});

describe('analytics wiring — leak is closed', () => {
  const routes = read('modules/analytics/routes.js');
  const service = read('modules/analytics/service.js');

  it('router extracts organization + passes orgWhereViaUser on both admin routes', () => {
    expect(routes).toMatch(/import\s*\{\s*extractOrganization,\s*orgWhereViaUser\s*\}\s*from '.*orgScope\.js'/);
    // both /counts and /voice-summary must run extractOrganization and forward the filter
    expect(routes).toMatch(/\/counts'[^\n]*extractOrganization[\s\S]*getEventCounts\([^)]*orgWhereViaUser\(req\)\)/);
    expect(routes).toMatch(/\/voice-summary'[^\n]*extractOrganization[\s\S]*getVoiceAnalyticsSummary\([^)]*orgWhereViaUser\(req\)\)/);
  });

  it('service spreads the orgFilter into every analytics where-clause', () => {
    expect(service).toMatch(/getEventCounts\(since = null, orgFilter = \{\}\)/);
    expect(service).toMatch(/getVoiceAnalyticsSummary\(since = null, orgFilter = \{\}\)/);
    // the spread must be present in the where objects
    expect((service.match(/\.\.\.orgFilter/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
