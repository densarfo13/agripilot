import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ─── Data Model ─────────────────────────────────────────

describe('Issue Data Model', () => {
  const schema = () => readFile('server/prisma/schema.prisma');

  it('has Issue model with all fields', () => {
    const s = schema();
    for (const f of ['issueType', 'category', 'priority', 'description', 'status', 'pageRoute', 'adminNote', 'resolutionNote']) {
      expect(s).toContain(f);
    }
  });

  it('has IssueCategory enum: BLOCKER, FRICTION, TRUST, FEATURE', () => {
    const s = schema();
    expect(s).toContain('enum IssueCategory');
    for (const c of ['BLOCKER', 'FRICTION', 'TRUST', 'FEATURE']) expect(s).toContain(c);
  });

  it('has IssuePriority enum: HIGH, MEDIUM, LOW', () => {
    const s = schema();
    expect(s).toContain('enum IssuePriority');
    // HIGH/MEDIUM/LOW appear in the enum block
    const enumBlock = s.slice(s.indexOf('enum IssuePriority'), s.indexOf('}', s.indexOf('enum IssuePriority')) + 1);
    expect(enumBlock).toContain('HIGH');
    expect(enumBlock).toContain('MEDIUM');
    expect(enumBlock).toContain('LOW');
  });

  it('has IssueStatus enum: OPEN, IN_PROGRESS, FIXED, VERIFIED', () => {
    const s = schema();
    expect(s).toContain('enum IssueStatus');
    for (const st of ['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED']) expect(s).toContain(st);
  });

  it('has indexes for category and priority', () => {
    const s = schema();
    expect(s).toContain('idx_issues_category');
    expect(s).toContain('idx_issues_priority');
  });

  it('User and Organization have Issue relations', () => {
    const s = schema();
    const userBlock = s.slice(s.indexOf('model User'), s.indexOf('@@map("users")'));
    expect(userBlock).toContain('Issue[]');
    const orgBlock = s.slice(s.indexOf('model Organization'), s.indexOf('@@map("organizations")'));
    expect(orgBlock).toContain('Issue[]');
  });
});

// ─── Categorization ─────────────────────────────────────

describe('Issue Categorization', () => {
  const code = () => readFile('server/src/modules/issues/routes.js');

  it('validates category from VALID_CATEGORIES', () => {
    const c = code();
    expect(c).toContain('VALID_CATEGORIES');
    expect(c).toContain("'BLOCKER'");
    expect(c).toContain("'FRICTION'");
    expect(c).toContain("'TRUST'");
    expect(c).toContain("'FEATURE'");
  });

  it('defaults to FRICTION when no category provided', () => {
    const c = code();
    expect(c).toContain("'FRICTION'");
    expect(c).toContain('resolvedCategory');
  });
});

// ─── Priority Auto-Mapping ──────────────────────────────

describe('Priority Auto-Mapping', () => {
  const code = () => readFile('server/src/modules/issues/routes.js');

  it('has CATEGORY_PRIORITY_MAP', () => {
    const c = code();
    expect(c).toContain('CATEGORY_PRIORITY_MAP');
  });

  it('maps BLOCKER → HIGH', () => {
    expect(code()).toContain("BLOCKER: 'HIGH'");
  });

  it('maps TRUST → HIGH', () => {
    expect(code()).toContain("TRUST: 'HIGH'");
  });

  it('maps FRICTION → MEDIUM', () => {
    expect(code()).toContain("FRICTION: 'MEDIUM'");
  });

  it('maps FEATURE → LOW', () => {
    expect(code()).toContain("FEATURE: 'LOW'");
  });

  it('allows explicit priority override', () => {
    const c = code();
    expect(c).toContain('VALID_PRIORITIES.includes(priority)');
    expect(c).toContain('resolvedPriority');
  });

  it('frontend shows auto-priority from category', () => {
    const ui = readFile('src/components/ReportIssueButton.jsx');
    expect(ui).toContain('CATEGORY_PRIORITY');
    expect(ui).toContain('autoPriority');
    expect(ui).toContain('auto-set from category');
  });
});

// ─── Status Workflow ────────────────────────────────────

describe('Status Workflow', () => {
  it('backend validates OPEN, IN_PROGRESS, FIXED, VERIFIED', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("'OPEN'");
    expect(c).toContain("'IN_PROGRESS'");
    expect(c).toContain("'FIXED'");
    expect(c).toContain("'VERIFIED'");
  });

  it('admin UI has correct status workflow buttons', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    // OPEN → Start → IN_PROGRESS
    expect(ui).toContain("status: 'IN_PROGRESS'");
    // IN_PROGRESS → Fixed → FIXED
    expect(ui).toContain("status: 'FIXED'");
    // FIXED → Verify → VERIFIED
    expect(ui).toContain("status: 'VERIFIED'");
    // Reopen for FIXED/VERIFIED
    expect(ui).toContain("status: 'OPEN'");
  });
});

// ─── Resolution Tracking ────────────────────────────────

describe('Resolution Tracking', () => {
  it('backend supports resolutionNote in PATCH', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('resolutionNote');
    expect(c).toContain('2000'); // max length
  });

  it('admin UI has resolution note editor', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('resEditing');
    expect(ui).toContain('resolutionNote');
    expect(ui).toContain('+ Resolution');
    expect(ui).toContain('What was done to fix this');
  });

  it('user sees resolution note in My Issues', () => {
    const ui = readFile('src/components/ReportIssueButton.jsx');
    expect(ui).toContain('resolutionNote');
    expect(ui).toContain('Resolution:');
  });
});

// ─── Admin Filters ──────────────────────────────────────

describe('Admin View Filters', () => {
  it('backend accepts category and priority query params', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('req.query.category');
    expect(c).toContain('req.query.priority');
  });

  it('admin UI has category and priority filter dropdowns', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('catFilter');
    expect(ui).toContain('prioFilter');
    expect(ui).toContain("'All Categories'");
    expect(ui).toContain("'All Priorities'");
  });

  it('issues sorted by priority (HIGH first) then date', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("priority: 'asc'");
    expect(c).toContain("createdAt: 'desc'");
  });
});

// ─── Insights View ──────────────────────────────────────

describe('Insights View', () => {
  it('backend has GET /api/issues/insights endpoint', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.get('/insights'");
    expect(c).toContain('byCategory');
    expect(c).toContain('byPriority');
    expect(c).toContain('byStatus');
    expect(c).toContain('frequent');
  });

  it('insights counts by category, priority, status, and type', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("groupBy");
    expect(c).toContain("by: ['category']");
    expect(c).toContain("by: ['priority']");
    expect(c).toContain("by: ['status']");
    expect(c).toContain("by: ['issueType']");
  });

  it('insights finds most frequent issues', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('prefixCounts');
    expect(c).toContain('frequent');
  });

  it('admin UI has insights panel with toggle', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('showInsights');
    expect(ui).toContain('insights');
    expect(ui).toContain('Issue Insights');
    expect(ui).toContain('Most Frequent');
  });
});

// ─── Assignment ─────────────────────────────────────────

describe('Issue Assignment', () => {
  it('schema has assignedToId field on Issue model', () => {
    const s = readFile('server/prisma/schema.prisma');
    expect(s).toContain('assignedToId');
    expect(s).toContain('assigned_to_id');
  });

  it('schema has IssueAssignee relation', () => {
    const s = readFile('server/prisma/schema.prisma');
    expect(s).toContain('IssueAssignee');
    expect(s).toContain('IssueReporter');
  });

  it('schema has assignee index', () => {
    const s = readFile('server/prisma/schema.prisma');
    expect(s).toContain('idx_issues_assignee');
  });

  it('backend supports assignedToId in PATCH', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('assignedToId');
    expect(c).toContain("data.assignedToId = assignedToId || null");
  });

  it('backend has GET /api/issues/assignees endpoint', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.get('/assignees'");
    expect(c).toContain('super_admin');
    expect(c).toContain('institutional_admin');
    expect(c).toContain('reviewer');
  });

  it('backend supports assignedToMe and unassigned filters', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('assignedToMe');
    expect(c).toContain("where.assignedToId = req.user.sub");
    expect(c).toContain("where.assignedToId = null");
  });

  it('backend includes assignedTo in GET /issues select', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("assignedTo: { select: { id: true, fullName: true } }");
  });

  it('admin UI has assignee filter dropdown', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('assignFilter');
    expect(ui).toContain('All Assignees');
    expect(ui).toContain('Assigned to Me');
    expect(ui).toContain('Unassigned');
  });

  it('admin UI has assign dropdown on expanded card', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain("Assign:");
    expect(ui).toContain("assignedToId");
    expect(ui).toContain("assignees.map");
  });

  it('admin UI loads assignees list', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain("/issues/assignees");
    expect(ui).toContain("setAssignees");
  });
});

// ─── No Regression ──────────────────────────────────────

describe('No Regression', () => {
  it('routes registered in app.js', () => {
    const app = readFile('server/src/app.js');
    expect(app).toContain("app.use('/api/issues', issueRoutes)");
  });

  it('button in Layout, page routed', () => {
    expect(readFile('src/components/Layout.jsx')).toContain('<ReportIssueButton');
    expect(readFile('src/App.jsx')).toContain("path=\"admin/issues\"");
  });
});
