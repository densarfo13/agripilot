import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ─── Issue Model ────────────────────────────────────────

describe('Issue Data Model', () => {
  it('schema has Issue model with all required fields', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('model Issue');
    expect(schema).toContain('issueType');
    expect(schema).toContain('description');
    expect(schema).toContain('priority');
    expect(schema).toContain('status');
    expect(schema).toContain('pageRoute');
    expect(schema).toContain('adminNote');
    expect(schema).toContain('user_id');
    expect(schema).toContain('org_id');
  });

  it('schema has IssueType enum with all values', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('enum IssueType');
    for (const t of ['BUG', 'DATA_ISSUE', 'ACCESS_ISSUE', 'FEATURE_REQUEST']) {
      expect(schema).toContain(t);
    }
  });

  it('schema has IssueStatus enum', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('enum IssueStatus');
    for (const s of ['OPEN', 'IN_PROGRESS', 'RESOLVED']) {
      expect(schema).toContain(s);
    }
  });

  it('Issue model has performance indexes', () => {
    const schema = readFile('server/prisma/schema.prisma');
    for (const idx of ['idx_issues_user', 'idx_issues_org', 'idx_issues_status', 'idx_issues_type', 'idx_issues_created']) {
      expect(schema).toContain(idx);
    }
  });

  it('User and Organization have Issue relations', () => {
    const schema = readFile('server/prisma/schema.prisma');
    const userBlock = schema.slice(schema.indexOf('model User'), schema.indexOf('@@map("users")'));
    expect(userBlock).toContain('Issue[]');
    const orgBlock = schema.slice(schema.indexOf('model Organization'), schema.indexOf('@@map("organizations")'));
    expect(orgBlock).toContain('Issue[]');
  });
});

// ─── Issue API Routes ───────────────────────────────────

describe('Issue API Routes', () => {
  const code = () => readFile('server/src/modules/issues/routes.js');

  it('POST validates description required', () => {
    expect(code()).toContain("'description is required'");
  });

  it('POST validates issueType from enum', () => {
    const c = code();
    expect(c).toContain('VALID_TYPES');
    expect(c).toContain("'BUG'");
    expect(c).toContain("'DATA_ISSUE'");
  });

  it('POST accepts and validates priority', () => {
    const c = code();
    expect(c).toContain('VALID_PRIORITIES');
    expect(c).toContain('resolvedPriority');
    expect(c).toContain("'low'");
    expect(c).toContain("'medium'");
    expect(c).toContain("'high'");
  });

  it('POST captures userId and orgId automatically', () => {
    const c = code();
    expect(c).toContain('req.user.sub');
    expect(c).toContain('req.organizationId');
  });

  it('POST returns 201 with confirmation', () => {
    const c = code();
    expect(c).toContain('201');
    expect(c).toContain('Issue reported successfully');
  });

  it('has rate limiting', () => {
    const c = code();
    expect(c).toContain('issueLimiter');
    expect(c).toContain('rateLimit');
  });

  it('logs creation and status updates via opsEvent', () => {
    const c = code();
    expect(c).toContain("opsEvent('workflow', 'issue_created'");
    expect(c).toContain("opsEvent('workflow', 'issue_status_updated'");
  });

  it('GET /mine endpoint exists for user issue tracking', () => {
    const c = code();
    expect(c).toContain("router.get('/mine'");
    expect(c).toContain('userId: req.user.sub');
  });

  it('GET / enforces admin-only with org scope', () => {
    const c = code();
    expect(c).toContain("authorize('super_admin', 'institutional_admin')");
    expect(c).toContain("req.user.role === 'institutional_admin'");
  });

  it('PATCH validates status and priority', () => {
    const c = code();
    expect(c).toContain('VALID_STATUSES');
    expect(c).toContain('VALID_PRIORITIES');
    expect(c).toContain('Not authorized to update this issue');
  });

  it('PATCH supports adminNote', () => {
    const c = code();
    expect(c).toContain('adminNote');
    expect(c).toContain('1000');
  });

  it('routes registered in app.js', () => {
    const app = readFile('server/src/app.js');
    expect(app).toContain("import issueRoutes from './modules/issues/routes.js'");
    expect(app).toContain("app.use('/api/issues', issueRoutes)");
  });
});

// ─── Issue UI ───────────────────────────────────────────

describe('Issue UI — ReportIssueButton', () => {
  const code = () => readFile('src/components/ReportIssueButton.jsx');

  it('has issue type and priority selectors', () => {
    const c = code();
    expect(c).toContain('issueType');
    expect(c).toContain('priority');
    expect(c).toContain('ISSUE_TYPES');
    expect(c).toContain('PRIORITIES');
  });

  it('auto-captures page route via useLocation', () => {
    const c = code();
    expect(c).toContain('useLocation');
    expect(c).toContain('location.pathname');
    expect(c).toContain('pageRoute');
  });

  it('shows success confirmation after submit', () => {
    const c = code();
    expect(c).toContain('Issue reported successfully');
    expect(c).toContain('alert-inline-success');
  });

  it('has My Issues tab for user tracking', () => {
    const c = code();
    expect(c).toContain("tab === 'mine'");
    expect(c).toContain('/issues/mine');
    expect(c).toContain('myIssues');
    expect(c).toContain('adminNote');
  });

  it('is included in Layout on every authenticated page', () => {
    const layout = readFile('src/components/Layout.jsx');
    expect(layout).toContain("import ReportIssueButton");
    expect(layout).toContain("<ReportIssueButton");
  });
});

describe('Issue UI — AdminIssuesPage', () => {
  const code = () => readFile('src/pages/AdminIssuesPage.jsx');

  it('has status and type filters', () => {
    const c = code();
    expect(c).toContain('statusFilter');
    expect(c).toContain('typeFilter');
  });

  it('shows priority with color coding', () => {
    const c = code();
    expect(c).toContain('PRIORITY_DOT');
    expect(c).toContain('issue.priority');
  });

  it('has admin note editing', () => {
    const c = code();
    expect(c).toContain('noteEditing');
    expect(c).toContain('adminNote');
    expect(c).toContain('+ Add Note');
  });

  it('has priority change buttons', () => {
    const c = code();
    expect(c).toContain("['low', 'medium', 'high']");
    expect(c).toContain('priority: p');
  });

  it('is routed and in sidebar', () => {
    const app = readFile('src/App.jsx');
    expect(app).toContain('AdminIssuesPage');
    expect(app).toContain("path=\"admin/issues\"");
    const layout = readFile('src/components/Layout.jsx');
    expect(layout).toContain("to: '/admin/issues'");
  });
});

// ─── No Regression ──────────────────────────────────────

describe('No Regression', () => {
  it('Layout still renders Outlet', () => {
    expect(readFile('src/components/Layout.jsx')).toContain('<Outlet');
  });

  it('all existing admin routes intact', () => {
    const app = readFile('src/App.jsx');
    for (const r of ['admin/users', 'admin/security', 'admin/control', 'admin/notifications', 'admin/pilot-qa', 'admin/issues']) {
      expect(app).toContain(r);
    }
  });
});
