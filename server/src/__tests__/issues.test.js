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

// ─── SLA Tracking ───────────────────────────────────────

describe('SLA Tracking', () => {
  it('schema has firstResponseAt and resolvedAt fields', () => {
    const s = readFile('server/prisma/schema.prisma');
    expect(s).toContain('firstResponseAt');
    expect(s).toContain('first_response_at');
    expect(s).toContain('resolvedAt');
    expect(s).toContain('resolved_at');
  });

  it('backend auto-sets firstResponseAt on first status change from OPEN', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('firstResponseAt');
    expect(c).toContain("existing.status === 'OPEN'");
    expect(c).toContain('!existing.firstResponseAt');
  });

  it('backend auto-sets resolvedAt on FIXED or VERIFIED', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("status === 'FIXED'");
    expect(c).toContain('!existing.resolvedAt');
    expect(c).toContain('data.resolvedAt = new Date()');
  });

  it('backend clears resolvedAt on reopen', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("status === 'OPEN' && existing.resolvedAt");
    expect(c).toContain('data.resolvedAt = null');
  });

  it('insights include SLA metrics', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('avgFirstResponseHrs');
    expect(c).toContain('avgResolveHrs');
    expect(c).toContain('sampledResponse');
    expect(c).toContain('sampledResolved');
  });

  it('admin UI shows SLA in insights panel', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('Avg First Response');
    expect(ui).toContain('Avg Resolution Time');
    expect(ui).toContain('insights.sla');
  });

  it('admin UI shows issue age on cards', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('ageLabel');
    expect(ui).toContain('old');
  });
});

// ─── Bulk Operations ────────────────────────────────────

describe('Bulk Operations', () => {
  it('backend has PATCH /api/issues/bulk endpoint', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.patch('/bulk'");
    expect(c).toContain('updateMany');
    expect(c).toContain('issues_bulk_updated');
  });

  it('bulk endpoint validates ids array (1-50)', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('ids.length > 50');
    expect(c).toContain('ids.length === 0');
  });

  it('bulk endpoint supports status, assignedToId, priority, category', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    // The destructuring in the bulk handler
    expect(c).toContain('ids, status, assignedToId, priority, category');
  });

  it('admin UI has bulk selection checkboxes', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('selectedIds');
    expect(ui).toContain('toggleSelect');
    expect(ui).toContain('toggleSelectAll');
    expect(ui).toContain('Select all on page');
  });

  it('admin UI has bulk action bar', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('Bulk Action...');
    expect(ui).toContain('Start All');
    expect(ui).toContain('Close All');
    expect(ui).toContain('Unassign All');
    expect(ui).toContain('executeBulk');
  });
});

// ─── Issue Comments ─────────────────────────────────────

describe('Issue Comments', () => {
  it('schema has IssueComment model', () => {
    const s = readFile('server/prisma/schema.prisma');
    expect(s).toContain('model IssueComment');
    expect(s).toContain('issueId');
    expect(s).toContain('issue_comments');
    expect(s).toContain('IssueCommenter');
  });

  it('schema has comment index on issueId', () => {
    const s = readFile('server/prisma/schema.prisma');
    expect(s).toContain('idx_issue_comments_issue');
  });

  it('Issue model has comments relation', () => {
    const s = readFile('server/prisma/schema.prisma');
    expect(s).toContain('comments     IssueComment[]');
  });

  it('backend has GET /:id/comments endpoint', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.get('/:id/comments'");
    expect(c).toContain('issueComment.findMany');
  });

  it('backend has POST /:id/comments endpoint with validation', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.post('/:id/comments'");
    expect(c).toContain('issueComment.create');
    expect(c).toContain('1000');
    expect(c).toContain('issue_comment_added');
  });

  it('backend has rate limiter on comments', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('commentLimiter');
  });

  it('admin GET /issues includes comment count', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('_count: { select: { comments: true } }');
  });

  it('admin UI has comment thread in expanded card', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('showComments');
    expect(ui).toContain('commentText');
    expect(ui).toContain('addComment');
    expect(ui).toContain('loadComments');
    expect(ui).toContain('Hide Comments');
    expect(ui).toContain('Add a comment');
    expect(ui).toContain('No comments yet');
  });
});

// ─── In-App Notifications ───────────────────────────────

describe('In-App Notifications', () => {
  it('schema has StaffNotification model', () => {
    const s = readFile('server/prisma/schema.prisma');
    expect(s).toContain('model StaffNotification');
    expect(s).toContain('staff_notifications');
    expect(s).toContain('StaffNotifications');
    expect(s).toContain('idx_staff_notif_user_read');
  });

  it('backend has notifyStaff helper', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('async function notifyStaff');
    expect(c).toContain('staffNotification.create');
  });

  it('backend has GET /notifications endpoint', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.get('/notifications'");
    expect(c).toContain('unreadCount');
  });

  it('backend has PATCH /notifications/read endpoint', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.patch('/notifications/read'");
    expect(c).toContain('read: true');
  });

  it('sends notification on assignment', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("notifyStaff(assignedToId, 'issue_assigned'");
  });

  it('sends notification on status change to reporter', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("notifyStaff(existing.userId, 'issue_status_changed'");
  });

  it('sends notification on comment to assignee', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("notifyStaff(fullIssue.assignedToId, 'issue_comment'");
  });

  it('admin UI has notification bell with unread count', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('unreadCount');
    expect(ui).toContain('showNotifs');
    expect(ui).toContain('loadNotifications');
    expect(ui).toContain('Mark all read');
    expect(ui).toContain('Notifications');
  });
});

// ─── SLA Breach Alerts ──────────────────────────────────

describe('SLA Breach Alerts', () => {
  it('backend has SLA_THRESHOLDS config', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('SLA_THRESHOLDS');
    expect(c).toContain('response: 4');
    expect(c).toContain('resolve: 24');
  });

  it('insights include breach counts', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('breachedResponse');
    expect(c).toContain('breachedResolve');
    expect(c).toContain('thresholds');
  });

  it('admin UI shows SLA breach alerts in insights', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('SLA Breaches');
    expect(ui).toContain('awaiting first response');
    expect(ui).toContain('past resolution deadline');
  });

  it('admin UI shows SLA BREACH flag on cards', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('isBreached');
    expect(ui).toContain('SLA BREACH');
  });
});

// ─── File Attachments ───────────────────────────────────

describe('File Attachments', () => {
  it('schema has IssueAttachment model', () => {
    const s = readFile('server/prisma/schema.prisma');
    expect(s).toContain('model IssueAttachment');
    expect(s).toContain('issue_attachments');
    expect(s).toContain('IssueUploader');
    expect(s).toContain('idx_issue_attachments_issue');
  });

  it('Issue model has attachments relation', () => {
    const s = readFile('server/prisma/schema.prisma');
    expect(s).toContain('attachments  IssueAttachment[]');
  });

  it('backend has multer upload config', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('issueUpload');
    expect(c).toContain('multer');
    expect(c).toContain('uploads/issues');
    expect(c).toContain('MAX_ATTACHMENT_SIZE');
    expect(c).toContain('ALLOWED_MIME_TYPES');
  });

  it('backend has GET /:id/attachments endpoint', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.get('/:id/attachments'");
    expect(c).toContain('issueAttachment.findMany');
  });

  it('backend has POST /:id/attachments endpoint', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.post('/:id/attachments'");
    expect(c).toContain('issueAttachment.create');
    expect(c).toContain('issue_attachment_added');
  });

  it('admin UI has attachment section in expanded card', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('showAttachments');
    expect(ui).toContain('uploadFile');
    expect(ui).toContain('Upload');
    expect(ui).toContain('toggleAttachments');
    expect(ui).toContain('No attachments');
  });
});

// ─── User-Facing Comments ───────────────────────────────

describe('User-Facing Comments', () => {
  it('backend uses canAccessIssue for comment auth (reporter + admin)', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('canAccessIssue');
    expect(c).toContain('isReporter');
    expect(c).toContain('isAdmin');
  });

  it('user My Issues shows expandable comments', () => {
    const ui = readFile('src/components/ReportIssueButton.jsx');
    expect(ui).toContain('expandedIssue');
    expect(ui).toContain('issueComments');
    expect(ui).toContain('loadIssueComments');
    expect(ui).toContain('sendComment');
    expect(ui).toContain('No comments yet');
    expect(ui).toContain('Add a comment');
  });
});

// ─── Email Notifications ────────────────────────────────

describe('Email Notifications', () => {
  it('backend imports delivery service', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("import { isEmailConfigured } from '../notifications/deliveryService.js'");
  });

  it('backend has sendIssueEmail helper', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('async function sendIssueEmail');
    expect(c).toContain('sgMail.send');
    expect(c).toContain('[Issues]');
  });

  it('notifyStaff checks user preferences before sending', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('notifPreferences');
    expect(c).toContain('typePref.inApp');
    expect(c).toContain('typePref.email');
    expect(c).toContain('isEmailConfigured()');
  });

  it('has DEFAULT_NOTIF_PREFS config', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('DEFAULT_NOTIF_PREFS');
    expect(c).toContain('issue_assigned');
    expect(c).toContain('issue_status_changed');
    expect(c).toContain('issue_comment');
    expect(c).toContain('sla_breach');
  });
});

// ─── Notification Preferences ───────────────────────────

describe('Notification Preferences', () => {
  it('schema has notifPreferences on User', () => {
    const s = readFile('server/prisma/schema.prisma');
    expect(s).toContain('notifPreferences');
    expect(s).toContain('notif_preferences');
  });

  it('backend has GET /notifications/preferences endpoint', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.get('/notifications/preferences'");
    expect(c).toContain('DEFAULT_NOTIF_PREFS');
  });

  it('backend has PATCH /notifications/preferences endpoint', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.patch('/notifications/preferences'");
    expect(c).toContain('notifPreferences: clean');
  });

  it('admin UI has preferences panel', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('showPrefs');
    expect(ui).toContain('notifPrefs');
    expect(ui).toContain('Notification Preferences');
    expect(ui).toContain('savePrefs');
    expect(ui).toContain('In-app');
    expect(ui).toContain('Email');
  });
});

// ─── SLA Config Per Org ─────────────────────────────────

describe('SLA Config Per Org', () => {
  it('schema has slaConfig on Organization', () => {
    const s = readFile('server/prisma/schema.prisma');
    expect(s).toContain('slaConfig');
    expect(s).toContain('sla_config');
  });

  it('backend has GET /sla-config endpoint', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.get('/sla-config'");
    expect(c).toContain('orgConfig');
  });

  it('backend has PATCH /sla-config endpoint', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain("router.patch('/sla-config'");
    expect(c).toContain('sla_config_updated');
  });

  it('insights uses org SLA config when available', () => {
    const c = readFile('server/src/modules/issues/routes.js');
    expect(c).toContain('effectiveThresholds');
    expect(c).toContain('org.slaConfig');
  });

  it('admin UI has SLA config panel', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain('showSlaConfig');
    expect(ui).toContain('slaEditing');
    expect(ui).toContain('saveSlaConfig');
    expect(ui).toContain('SLA Thresholds');
    expect(ui).toContain('loadSlaConfig');
  });
});

// ─── Attachment Previews ────────────────────────────────

describe('Attachment Previews', () => {
  it('admin UI shows image thumbnails', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain("mimeType?.startsWith('image/')");
    expect(ui).toContain('objectFit');
    expect(ui).toContain('<img src=');
  });

  it('admin UI shows file type badges for non-images', () => {
    const ui = readFile('src/pages/AdminIssuesPage.jsx');
    expect(ui).toContain("'PDF'");
    expect(ui).toContain("'FILE'");
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
