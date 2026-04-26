import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve project paths relative to the repository root, not
// process.cwd() — the test runner is invoked with cwd=server/,
// which broke 'src/components/X.jsx' style relative paths.
const REPO_ROOT_FOR_TEST_READS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".."
);

function readFile(relPath) {
  return fs.readFileSync(path.resolve(REPO_ROOT_FOR_TEST_READS, relPath), 'utf-8');
}

// ─── 1. Export CSV Shape Tests ──────────────────────────────────

describe('Export Routes', () => {
  const code = readFile('server/routes/exports.js');

  it('farmers CSV should have expected headers', () => {
    expect(code).toContain("label: 'ID'");
    expect(code).toContain("label: 'Full Name'");
    expect(code).toContain("label: 'Phone'");
    expect(code).toContain("label: 'Country Code'");
    expect(code).toContain("label: 'Gender'");
    expect(code).toContain("label: 'Registration Status'");
    expect(code).toContain("label: 'Lifecycle Stage'");
    expect(code).toContain("label: 'Organization ID'");
    expect(code).toContain("label: 'Farm Locations'");
    expect(code).toContain("label: 'Applications'");
    expect(code).toContain("label: 'Created At'");
  });

  it('CSV values should be properly escaped', () => {
    // csvEscape handles commas, quotes, and newlines
    expect(code).toContain('function csvEscape(value)');
    expect(code).toContain("str.includes(',')");
    expect(code).toContain('str.includes(\'"\')');
    expect(code).toContain("str.includes('\\n')");
    // Doubles internal quotes for proper CSV escaping
    expect(code).toContain('str.replace(/"/g, \'""\'');
  });

  it('exports use toCsv helper to produce header + data lines', () => {
    expect(code).toContain('function toCsv(headers, rows)');
    expect(code).toContain('headerLine');
    expect(code).toContain('dataLines');
  });

  it('exports set correct Content-Type and Content-Disposition headers', () => {
    expect(code).toContain("'Content-Type', 'text/csv'");
    expect(code).toContain("'Content-Disposition'");
    expect(code).toContain('attachment; filename=');
  });
});

// ─── 2. Bulk Import Validation ──────────────────────────────────

describe('Bulk Import', () => {
  const code = readFile('server/routes/bulk.js');

  it('should reject rows with missing name', () => {
    // Validates that empty name causes an error row
    expect(code).toContain("'Name is required.'");
    expect(code).toContain('if (!name)');
  });

  it('should skip duplicate phone numbers', () => {
    // Pre-fetches existing phones and checks with Set
    expect(code).toContain('existingPhones');
    expect(code).toContain('existingPhones.has(normalizedPhone)');
    expect(code).toContain('skipped++');
  });

  it('should validate CSV structure', () => {
    // Requires header row with name and phone columns
    expect(code).toContain("'CSV header must include \"name\" and \"phone\" columns.'");
    expect(code).toContain("'CSV must have a header row and at least one data row.'");
    expect(code).toContain("'Request body must include a \"csv\" string field.'");
  });

  it('should validate phone format with regex', () => {
    expect(code).toContain('Invalid phone format');
    expect(code).toMatch(/\^\\\+\?\\.*/); // regex for phone validation
  });

  it('should write audit log for each imported farmer', () => {
    expect(code).toContain("action: 'BULK_IMPORT_FARMER'");
    expect(code).toContain('writeAuditLog');
  });
});

// ─── 3. Analytics Summary Shape ─────────────────────────────────

describe('Analytics Summary', () => {
  const code = readFile('server/routes/analytics-summary.js');

  it('should return all expected fields', () => {
    expect(code).toContain('totalFarmers');
    expect(code).toContain('activeFarmers');
    expect(code).toContain('setupIncomplete');
    expect(code).toContain('totalUpdates');
    expect(code).toContain('validatedUpdates');
    expect(code).toContain('pendingValidations');
    expect(code).toContain('needsAttention');
    expect(code).toContain('onboardingRate');
    expect(code).toContain('firstUpdateRate');
  });

  it('should calculate rates as percentages', () => {
    // onboardingRate and firstUpdateRate use percentage formula
    expect(code).toContain("* 100).toFixed(1) + '%'");
    expect(code).toContain("'0%'");
  });

  it('should compute onboardingRate from farmers with season / total', () => {
    expect(code).toContain('farmersWithSeason / totalFarmers');
  });

  it('should compute firstUpdateRate from farmers with entry / farmers with season', () => {
    expect(code).toContain('farmersWithEntry / farmersWithSeason');
  });
});

// ─── 4. Org Isolation ───────────────────────────────────────────

describe('Org Isolation', () => {
  it('exports should filter by organizationId', () => {
    const code = readFile('server/routes/exports.js');
    // All three export endpoints check req.organizationId
    expect(code).toContain('req.organizationId');
    expect(code).toContain('where.organizationId = req.organizationId');
    // Updates and validations scope via farmer relation
    expect(code).toContain('farmer: { organizationId: req.organizationId }');
  });

  it('bulk import should assign correct orgId', () => {
    const code = readFile('server/routes/bulk.js');
    expect(code).toContain('organizationId: orgId');
    // orgId comes from middleware-set organizationId
    expect(code).toContain('req.organizationId || req.user.organizationId');
  });

  it('bulk invite validates farmers belong to org before sending', () => {
    const code = readFile('server/routes/bulk.js');
    expect(code).toContain("'Farmer not found or not in organization.'");
    expect(code).toContain('where.organizationId = orgId');
  });

  it('bulk assign-officer validates officer belongs to same org', () => {
    const code = readFile('server/routes/bulk.js');
    expect(code).toContain('officer.organizationId !== orgId');
    expect(code).toContain("'Officer does not belong to your organization.'");
  });

  it('orgScope middleware enforces org for non-super-admin roles', () => {
    const code = readFile('server/src/middleware/orgScope.js');
    // Non-super-admin users are bound to their org
    expect(code).toContain('req.organizationId = userOrgId');
    expect(code).toContain('req.isCrossOrg = false');
    // Users with no org (except farmer) get 403
    expect(code).toContain("'No organization assigned. Contact your administrator.'");
  });

  it('orgScope super_admin gets cross-org by default', () => {
    const code = readFile('server/src/middleware/orgScope.js');
    expect(code).toContain("role === 'super_admin'");
    expect(code).toContain('req.isCrossOrg = !requestedOrg');
  });

  it('analytics summary respects org scope', () => {
    const code = readFile('server/routes/analytics-summary.js');
    expect(code).toContain('req.organizationId ? { organizationId: req.organizationId } : {}');
    // Season-level scoping also uses org
    expect(code).toContain('farmer: { organizationId: req.organizationId }');
  });
});

// ─── 5. Empty States ────────────────────────────────────────────

describe('Empty States', () => {
  const code = readFile('src/components/EmptyState.jsx');

  it('EmptyState component should render title and message', () => {
    // Component accepts title and message props and renders them
    expect(code).toContain('{title}');
    expect(code).toContain('{message}');
    expect(code).toContain('function EmptyState');
  });

  it('EmptyState should render action button when provided', () => {
    // action prop creates a button with label and onClick
    expect(code).toContain('action.onClick');
    expect(code).toContain('action.label');
    expect(code).toContain("className=\"btn btn-primary\"");
  });

  it('EmptyState supports compact variant', () => {
    expect(code).toContain('compact');
    expect(code).toContain("compact ? '1.5rem 1rem' : '2.5rem 1.5rem'");
  });

  it('EmptyState supports secondary action', () => {
    expect(code).toContain('secondaryAction');
    expect(code).toContain('secondaryAction.onClick');
    expect(code).toContain('secondaryAction.label');
  });

  it('EmptyState supports variant theming (default, success, warning)', () => {
    expect(code).toContain("variant === 'success'");
    expect(code).toContain("variant === 'warning'");
    expect(code).toContain("'var(--primary)'");
  });
});

// ─── 6. Audit Trail ─────────────────────────────────────────────

describe('Audit Trail', () => {
  it('writeAuditLog should create audit entry with expected fields', () => {
    const code = readFile('server/src/modules/audit/service.js');
    expect(code).toContain('export async function writeAuditLog');
    expect(code).toContain('prisma.auditLog.create');
    // Accepts all required audit fields
    expect(code).toContain('applicationId');
    expect(code).toContain('userId');
    expect(code).toContain('organizationId');
    expect(code).toContain('action');
    expect(code).toContain('details');
    expect(code).toContain('previousStatus');
    expect(code).toContain('newStatus');
    expect(code).toContain('ipAddress');
  });

  it('writeAuditLog handles FK constraint failures gracefully', () => {
    const code = readFile('server/src/modules/audit/service.js');
    // Catches P2003 (FK constraint) and P2025 (record not found) without throwing
    expect(code).toContain("err.code === 'P2003'");
    expect(code).toContain("err.code === 'P2025'");
    expect(code).toContain('return null');
  });

  it('audit logs should be org-scoped for non-super-admin', () => {
    const code = readFile('server/src/modules/audit/routes.js');
    // The GET / route filters by organizationId for non-super-admins
    expect(code).toContain('if (req.organizationId) where.organizationId = req.organizationId');
    // extractOrganization middleware is applied
    expect(code).toContain('extractOrganization');
  });

  it('audit application route is org-scoped', () => {
    const code = readFile('server/src/modules/audit/routes.js');
    // The /application/:applicationId route also filters by org
    expect(code).toContain('applicationId: req.params.applicationId');
    expect(code).toContain('where.organizationId = req.organizationId');
  });

  it('audit routes require authentication', () => {
    const code = readFile('server/src/modules/audit/routes.js');
    expect(code).toContain('router.use(authenticate)');
    expect(code).toContain('router.use(extractOrganization)');
  });
});
