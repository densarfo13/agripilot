import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ─── Issue Model ────────────────────────────────────────

describe('Issue Data Model', () => {
  it('schema has Issue model with required fields', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('model Issue');
    expect(schema).toContain('issueType');
    expect(schema).toContain('description');
    expect(schema).toContain('status');
    expect(schema).toContain('pageRoute');
    expect(schema).toContain('adminNote');
    expect(schema).toContain('user_id');
    expect(schema).toContain('org_id');
  });

  it('schema has IssueType enum with all values', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('enum IssueType');
    expect(schema).toContain('BUG');
    expect(schema).toContain('DATA_ISSUE');
    expect(schema).toContain('ACCESS_ISSUE');
    expect(schema).toContain('FEATURE_REQUEST');
  });

  it('schema has IssueStatus enum with all values', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('enum IssueStatus');
    expect(schema).toContain('OPEN');
    expect(schema).toContain('IN_PROGRESS');
    expect(schema).toContain('RESOLVED');
  });

  it('Issue model has indexes for performance', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('idx_issues_user');
    expect(schema).toContain('idx_issues_org');
    expect(schema).toContain('idx_issues_status');
    expect(schema).toContain('idx_issues_type');
    expect(schema).toContain('idx_issues_created');
  });

  it('User and Organization have Issue relations', () => {
    const schema = readFile('server/prisma/schema.prisma');
    // Check User model has issues relation
    const userBlock = schema.slice(schema.indexOf('model User'), schema.indexOf('@@map("users")'));
    expect(userBlock).toContain('Issue[]');
    // Check Organization model has issues relation
    const orgBlock = schema.slice(schema.indexOf('model Organization'), schema.indexOf('@@map("organizations")'));
    expect(orgBlock).toContain('Issue[]');
  });
});

// ─── Issue Routes ───────────────────────────────────────

describe('Issue API Routes', () => {
  it('routes file validates description is required', () => {
    const code = readFile('server/src/modules/issues/routes.js');
    expect(code).toContain("'description is required'");
  });

  it('routes file validates issueType against valid list', () => {
    const code = readFile('server/src/modules/issues/routes.js');
    expect(code).toContain('VALID_TYPES');
    expect(code).toContain('BUG');
    expect(code).toContain('DATA_ISSUE');
    expect(code).toContain('ACCESS_ISSUE');
    expect(code).toContain('FEATURE_REQUEST');
  });

  it('routes file validates status on update', () => {
    const code = readFile('server/src/modules/issues/routes.js');
    expect(code).toContain('VALID_STATUSES');
    expect(code).toContain("'OPEN'");
    expect(code).toContain("'IN_PROGRESS'");
    expect(code).toContain("'RESOLVED'");
  });

  it('routes file has rate limiting', () => {
    const code = readFile('server/src/modules/issues/routes.js');
    expect(code).toContain('issueLimiter');
    expect(code).toContain('rateLimit');
  });

  it('routes file captures userId and orgId automatically', () => {
    const code = readFile('server/src/modules/issues/routes.js');
    expect(code).toContain('req.user.sub');
    expect(code).toContain('req.organizationId');
  });

  it('routes file logs issue creation via opsEvent', () => {
    const code = readFile('server/src/modules/issues/routes.js');
    expect(code).toContain("opsEvent('workflow', 'issue_created'");
    expect(code).toContain("opsEvent('workflow', 'issue_status_updated'");
  });

  it('routes file enforces org scope for institutional_admin', () => {
    const code = readFile('server/src/modules/issues/routes.js');
    expect(code).toContain("req.user.role === 'institutional_admin'");
    expect(code).toContain('Not authorized to update this issue');
  });

  it('POST returns 201 with confirmation message', () => {
    const code = readFile('server/src/modules/issues/routes.js');
    expect(code).toContain('201');
    expect(code).toContain('Issue reported successfully');
  });

  it('routes are registered in app.js', () => {
    const app = readFile('server/src/app.js');
    expect(app).toContain("import issueRoutes from './modules/issues/routes.js'");
    expect(app).toContain("app.use('/api/issues', issueRoutes)");
  });
});

// ─── Issue UI ───────────────────────────────────────────

describe('Issue UI Components', () => {
  it('ReportIssueButton component exists with form', () => {
    const code = readFile('src/components/ReportIssueButton.jsx');
    expect(code).toContain("issueType");
    expect(code).toContain("description");
    expect(code).toContain("pageRoute");
    expect(code).toContain("useLocation");
    expect(code).toContain("/issues");
  });

  it('ReportIssueButton shows success confirmation', () => {
    const code = readFile('src/components/ReportIssueButton.jsx');
    expect(code).toContain('Issue reported successfully');
    expect(code).toContain('alert-inline-success');
  });

  it('ReportIssueButton is included in Layout', () => {
    const code = readFile('src/components/Layout.jsx');
    expect(code).toContain("import ReportIssueButton");
    expect(code).toContain("<ReportIssueButton");
  });

  it('AdminIssuesPage exists with filter and status update', () => {
    const code = readFile('src/pages/AdminIssuesPage.jsx');
    expect(code).toContain('statusFilter');
    expect(code).toContain('typeFilter');
    expect(code).toContain('updateStatus');
    expect(code).toContain("'/issues'");
  });

  it('AdminIssuesPage is routed and in sidebar', () => {
    const app = readFile('src/App.jsx');
    expect(app).toContain('AdminIssuesPage');
    expect(app).toContain("path=\"admin/issues\"");
    const layout = readFile('src/components/Layout.jsx');
    expect(layout).toContain("to: '/admin/issues'");
  });
});

// ─── No Regression ──────────────────────────────────────

describe('No Regression', () => {
  it('Layout still has Outlet for page rendering', () => {
    const code = readFile('src/components/Layout.jsx');
    expect(code).toContain('<Outlet');
  });

  it('App still has all existing admin routes', () => {
    const code = readFile('src/App.jsx');
    expect(code).toContain('admin/users');
    expect(code).toContain('admin/security');
    expect(code).toContain('admin/control');
    expect(code).toContain('admin/notifications');
    expect(code).toContain('admin/pilot-qa');
    expect(code).toContain('admin/issues');
  });
});
