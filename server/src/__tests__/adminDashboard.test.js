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

// ─── Structure & Imports ────────────────────────────────

describe('Admin Dashboard — Structure', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('exports a default function component', () => {
    expect(code).toContain('export default function DashboardPage');
  });

  it('has admin-dashboard test ID', () => {
    expect(code).toContain('data-testid="admin-dashboard"');
  });

  it('imports api client', () => {
    expect(code).toContain("from '../api/client.js'");
  });

  it('imports SkeletonDashboard for loading state', () => {
    expect(code).toContain('SkeletonDashboard');
  });

  it('imports ADMIN_ROLES for role checks', () => {
    expect(code).toContain('ADMIN_ROLES');
  });

  it('imports getCropLabel from crops utility', () => {
    expect(code).toContain('getCropLabel');
  });

  it('imports PriorityBadge from TrustRiskBadge', () => {
    expect(code).toContain('PriorityBadge');
  });

  it('does NOT import Recharts on initial load', () => {
    expect(code).not.toContain('from \'recharts\'');
    expect(code).not.toContain('BarChart');
    expect(code).not.toContain('PieChart');
  });
});

// ─── Data Fetching ──────────────────────────────────────

describe('Admin Dashboard — Data Fetching', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('fetches portfolio summary', () => {
    expect(code).toContain('/portfolio/summary');
  });

  it('fetches application stats', () => {
    expect(code).toContain('/applications/stats');
  });

  it('fetches pending registrations for admins', () => {
    expect(code).toContain('/users/pending-registrations');
  });

  it('fetches pilot metrics conditionally', () => {
    expect(code).toContain('/pilot/metrics');
    expect(code).toContain('canSeePilotMetrics');
  });

  it('fetches needs-attention for eligible users', () => {
    expect(code).toContain('/pilot/needs-attention');
    expect(code).toContain('canSeeAttention');
  });

  it('fetches tasks list', () => {
    expect(code).toContain('/tasks');
    expect(code).toContain('canSeeTasks');
  });

  it('fetches alerts for pilot metrics users', () => {
    expect(code).toContain('/pilot/alerts');
  });

  it('fetches performance dashboard (benchmarks)', () => {
    expect(code).toContain('/performance/dashboard');
  });

  it('uses Promise.all for parallel loading', () => {
    expect(code).toContain('Promise.all');
  });

  it('handles loading state with skeleton', () => {
    expect(code).toContain('if (loading) return <SkeletonDashboard');
  });

  it('handles error state with retry', () => {
    expect(code).toContain('Unable to load dashboard data');
    expect(code).toContain('Retry');
    expect(code).toContain('window.location.reload()');
  });
});

// ─── Hero Metrics ───────────────────────────────────────

describe('Admin Dashboard — Hero Metrics', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('has hero-metrics test ID', () => {
    expect(code).toContain('data-testid="hero-metrics"');
  });

  it('shows total farmers metric', () => {
    expect(code).toContain('metric-total-farmers');
    expect(code).toContain('Total Farmers');
  });

  it('shows active metric', () => {
    expect(code).toContain('metric-active');
    expect(code).toContain('activeFarmers');
  });

  it('shows validated metric', () => {
    expect(code).toContain('metric-validated');
    expect(code).toContain('validatedSeasons');
  });

  it('shows needs-attention metric', () => {
    expect(code).toContain('metric-attention');
    expect(code).toContain('needsAttention');
  });

  it('uses 4-column grid for metrics', () => {
    const idx = code.indexOf('metricsGrid:');
    const chunk = code.slice(idx, idx + 200);
    expect(chunk).toContain("repeat(4, 1fr)");
  });

  it('metrics are clickable (navigate on click)', () => {
    expect(code).toContain("onClick={() => navigate('/farmers')}");
    expect(code).toContain("onClick={() => navigate('/officer-validation')}");
  });

  it('highlights attention metric when count > 0', () => {
    expect(code).toContain('needsAttention > 0');
    expect(code).toContain('2px solid rgba(239,68,68,0.4)');
  });
});

// ─── Attention Panel ────────────────────────────────────

describe('Admin Dashboard — Attention Panel', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('has attention-panel test ID', () => {
    expect(code).toContain('data-testid="attention-panel"');
  });

  it('shows Action Required header', () => {
    expect(code).toContain('Action Required');
  });

  it('shows urgent count in badge', () => {
    expect(code).toContain('urgent');
    expect(code).toContain("i.priority === 'High'");
  });

  it('merges fraud queue warnings', () => {
    expect(code).toContain('queues.fraud');
    expect(code).toContain('fraud flag');
  });

  it('merges escalated queue warnings', () => {
    expect(code).toContain('queues.escalated');
    expect(code).toContain('escalated');
  });

  it('merges expiring invites', () => {
    expect(code).toContain('expiringInvites');
    expect(code).toContain('expiring');
  });

  it('merges tasks (up to 6)', () => {
    expect(code).toContain('tasks.slice(0, 6)');
    expect(code).toContain('TASK_ICONS');
  });

  it('merges alerts (up to 3)', () => {
    expect(code).toContain('alerts.slice(0, 3)');
  });

  it('shows max 8 items before overflow', () => {
    expect(code).toContain('attentionItems.slice(0, 8)');
    expect(code).toContain('attentionItems.length > 8');
  });

  it('attention items have icon, label, detail, arrow', () => {
    expect(code).toContain('attentionIcon');
    expect(code).toContain('attentionLabel');
    expect(code).toContain('attentionDetail');
    expect(code).toContain('attentionArrow');
  });

  it('items navigate on click', () => {
    expect(code).toContain('item.href');
    expect(code).toContain('navigate(item.href)');
  });

  it('shows all-caught-up when no attention items', () => {
    expect(code).toContain('data-testid="all-caught-up"');
    expect(code).toContain('All caught up');
    expect(code).toContain('No pending tasks');
  });

  it('has task overflow using tasks.length', () => {
    expect(code).toContain('tasks.length');
    expect(code).toContain('View all');
  });
});

// ─── Activity Trend ─────────────────────────────────────

describe('Admin Dashboard — Activity Trend', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('has activity-trend test ID', () => {
    expect(code).toContain('data-testid="activity-trend"');
  });

  it('shows adoption rate', () => {
    expect(code).toContain('adoptionRate');
  });

  it('shows engagement rate', () => {
    expect(code).toContain('engagementRate');
  });

  it('derives trend direction from adoption threshold', () => {
    expect(code).toContain('trendUp');
    expect(code).toContain('adoptionRate >= 50');
  });
});

// ─── Farmer Pipeline ────────────────────────────────────

describe('Admin Dashboard — Farmer Pipeline', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('has farmer-pipeline test ID', () => {
    expect(code).toContain('farmer-status-overview');
  });

  it('shows Approved Farmers label (not Active)', () => {
    expect(code).toContain('Approved Farmers');
    expect(code).not.toContain('>Active Farmers<');
  });

  it('shows Pending status', () => {
    expect(code).toContain("label: 'Pending'");
  });

  it('shows Invited status', () => {
    expect(code).toContain("label: 'Invited'");
  });

  it('shows With Season status', () => {
    expect(code).toContain("label: 'With Season'");
  });

  it('shows Updating status', () => {
    expect(code).toContain("label: 'Updating'");
  });

  it('shows Harvested status', () => {
    expect(code).toContain("label: 'Harvested'");
  });

  it('shows Women and Youth demographics', () => {
    expect(code).toContain('womenFarmers');
    expect(code).toContain('youthFarmers');
    expect(code).toContain('Women');
    expect(code).toContain('Youth');
  });

  it('navigates to farmers page on View all', () => {
    expect(code).toContain("navigate('/farmers')");
    expect(code).toContain('View all');
  });
});

// ─── Quick Actions ──────────────────────────────────────

describe('Admin Dashboard — Quick Actions', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('has quick-actions test ID', () => {
    expect(code).toContain('data-testid="quick-actions"');
  });

  it('has Invite Farmer action', () => {
    expect(code).toContain('action-invite');
    expect(code).toContain('Invite Farmer');
  });

  it('has Resend Invites action', () => {
    expect(code).toContain('action-resend');
    expect(code).toContain('Resend Invites');
  });

  it('has Assign Officer action', () => {
    expect(code).toContain('action-assign');
    expect(code).toContain('Assign Officer');
  });

  it('has Validate action', () => {
    expect(code).toContain('action-validate');
    expect(code).toContain('Validate');
    expect(code).toContain("navigate('/officer-validation')");
  });
});

// ─── Export ─────────────────────────────────────────────

describe('Admin Dashboard — Export', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('has export button with test ID', () => {
    expect(code).toContain('data-testid="export-btn"');
  });

  it('exports to CSV via pilot-report endpoint', () => {
    expect(code).toContain("'/reports/pilot-report?format=csv'");
    expect(code).toContain('text/csv');
  });

  it('button text says Export CSV', () => {
    expect(code).toContain('Export CSV');
  });

  it('creates blob and downloads', () => {
    expect(code).toContain('URL.createObjectURL');
    expect(code).toContain('.download');
  });

  it('only shows export for pilot metrics users', () => {
    expect(code).toContain('canSeePilotMetrics');
    expect(code).toContain('handleExport');
  });
});

// ─── Expandable Portfolio Details ───────────────────────

describe('Admin Dashboard — Expandable Details', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('has details-toggle button', () => {
    expect(code).toContain('data-testid="details-toggle"');
  });

  it('toggles showMoreDetails state', () => {
    expect(code).toContain('showMoreDetails');
    expect(code).toContain('setShowMoreDetails');
  });

  it('has aria-expanded for accessibility', () => {
    expect(code).toContain('aria-expanded={showMoreDetails}');
  });

  it('has portfolio-details section', () => {
    expect(code).toContain('data-testid="portfolio-details"');
  });

  it('shows application count', () => {
    expect(code).toContain('portfolio.totalApplications');
  });

  it('shows requested and recommended amounts', () => {
    expect(code).toContain('totalRequestedAmount');
    expect(code).toContain('totalRecommendedAmount');
  });

  it('shows average verification score', () => {
    expect(code).toContain('avgVerificationScore');
  });

  it('shows benchmark summary when available', () => {
    expect(code).toContain('benchmarkSummary');
    expect(code).toContain('Season Adoption');
    expect(code).toContain('Engagement');
    expect(code).toContain('Validation');
  });

  it('shows queue counts in details', () => {
    expect(code).toContain('Verification:');
    expect(code).toContain('Fraud:');
    expect(code).toContain('Pending:');
  });

  it('shows recent applications list', () => {
    expect(code).toContain('recentApplications');
    expect(code).toContain('Recent Applications');
  });

  it('links to full pilot metrics', () => {
    expect(code).toContain('Full Pilot Metrics');
    expect(code).toContain("navigate('/pilot-metrics')");
  });
});

// ─── Welcome Card ───────────────────────────────────────

describe('Admin Dashboard — Welcome Card', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('shows welcome card for first-run admin', () => {
    expect(code).toContain('data-testid="welcome-card"');
    expect(code).toContain('Welcome');
  });

  it('only appears when totalFarmers and applications are 0', () => {
    expect(code).toContain('totalFarmers === 0');
    expect(code).toContain('portfolio.totalApplications === 0');
  });

  it('has 3 getting started steps', () => {
    expect(code).toContain('Add your first farmers');
    expect(code).toContain('Create a farm season');
    expect(code).toContain('Submit a loan application');
  });
});

// ─── Task Navigation Map ────────────────────────────────

describe('Admin Dashboard — Task Navigation', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('has TASK_NAV map for all task types', () => {
    expect(code).toContain('TASK_NAV');
    expect(code).toContain('APPROVE_ONBOARDING');
    expect(code).toContain('RESOLVE_INVITE');
    expect(code).toContain('ASSIGN_OFFICER');
    expect(code).toContain('REVIEW_HIGH_RISK');
    expect(code).toContain('REVIEW_BACKLOG');
    expect(code).toContain('VALIDATE_UPDATE');
    expect(code).toContain('FOLLOW_UP_STALE');
    expect(code).toContain('CONFIRM_HARVEST');
  });

  it('has TASK_ICONS map with emoji per type', () => {
    expect(code).toContain('TASK_ICONS');
    expect(code).toContain('👤');
    expect(code).toContain('📩');
    expect(code).toContain('⚠️');
  });

  it('navigates to correct routes per task type', () => {
    expect(code).toContain('/farmer-registrations');
    expect(code).toContain('/officer-validation');
    expect(code).toContain('/applications');
  });
});

// ─── Mobile UX ──────────────────────────────────────────

describe('Admin Dashboard — Mobile UX', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('export button has 44px minHeight tap target', () => {
    const idx = code.indexOf('exportBtn:');
    const chunk = code.slice(idx, idx + 300);
    expect(chunk).toContain("minHeight: '44px'");
  });

  it('body container is max 700px centered', () => {
    expect(code).toContain("maxWidth: '700px'");
    expect(code).toContain("margin: '0 auto'");
  });

  it('header is sticky', () => {
    expect(code).toContain("position: 'sticky'");
    expect(code).toContain('top: 0');
  });

  it('export button has WebkitTapHighlightColor transparent', () => {
    const idx = code.indexOf('exportBtn:');
    const chunk = code.slice(idx, idx + 300);
    expect(chunk).toContain("WebkitTapHighlightColor: 'transparent'");
  });

  it('uses number formatter for large values', () => {
    expect(code).toContain('fmt');
    expect(code).toContain('1000000');
    expect(code).toContain('1000');
  });
});

// ─── Role Guards ────────────────────────────────────────

describe('Admin Dashboard — Role Guards', () => {
  const code = readFile('src/pages/DashboardPage.jsx');

  it('checks isAdmin for role-specific features', () => {
    expect(code).toContain('isAdmin');
    expect(code).toContain("ADMIN_ROLES.includes(user?.role)");
  });

  it('canSeePilotMetrics includes investor_viewer', () => {
    expect(code).toContain('canSeePilotMetrics');
    expect(code).toContain('investor_viewer');
  });

  it('canSeeAttention includes field_officer', () => {
    expect(code).toContain('canSeeAttention');
    expect(code).toContain('field_officer');
  });

  it('canSeeTasks excludes investor_viewer', () => {
    expect(code).toContain('canSeeTasks');
    expect(code).toContain("user?.role !== 'investor_viewer'");
  });
});
