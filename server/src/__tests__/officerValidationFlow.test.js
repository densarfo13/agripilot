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

// ─── Backend: Validation Queue Endpoint ─────────────────

describe('Validation Queue API', () => {
  const code = readFile('server/src/modules/seasons/routes.js');

  it('has GET /validation-queue endpoint', () => {
    expect(code).toContain("router.get('/validation-queue'");
  });

  it('requires officer/admin authorization', () => {
    const idx = code.indexOf("'/validation-queue'");
    const chunk = code.slice(idx, idx + 200);
    expect(chunk).toContain('super_admin');
    expect(chunk).toContain('institutional_admin');
    expect(chunk).toContain('field_officer');
  });

  it('supports limit and offset pagination', () => {
    const idx = code.indexOf("'/validation-queue'");
    const chunk = code.slice(idx, idx + 1500);
    expect(chunk).toContain('req.query.limit');
    expect(chunk).toContain('req.query.offset');
  });

  it('scopes to assigned farmers for field officers', () => {
    const idx = code.indexOf("'/validation-queue'");
    const chunk = code.slice(idx, idx + 1500);
    expect(chunk).toContain('assignedOfficerId');
  });

  it('scopes to organization for admins', () => {
    const idx = code.indexOf("'/validation-queue'");
    const chunk = code.slice(idx, idx + 1500);
    expect(chunk).toContain('organizationId');
    expect(chunk).toContain('extractOrganization');
  });

  it('includes farmer info in queue items', () => {
    const idx = code.indexOf("'/validation-queue'");
    const chunk = code.slice(idx, idx + 3000);
    expect(chunk).toContain('farmerName');
    expect(chunk).toContain('farmerRegion');
    expect(chunk).toContain('farmerImage');
    expect(chunk).toContain('cropType');
  });

  it('includes recent progress entries and images', () => {
    const idx = code.indexOf("'/validation-queue'");
    const chunk = code.slice(idx, idx + 5000);
    expect(chunk).toContain('progressEntries');
    expect(chunk).toContain('imageUrl');
    expect(chunk).toContain('recentImages');
  });

  it('includes last validation date for staleness check', () => {
    const idx = code.indexOf("'/validation-queue'");
    const chunk = code.slice(idx, idx + 5000);
    expect(chunk).toContain('lastValidationDate');
    expect(chunk).toContain('daysSinceValidation');
  });

  it('computes priority based on validation recency', () => {
    const idx = code.indexOf("'/validation-queue'");
    const chunk = code.slice(idx, idx + 4000);
    expect(chunk).toContain("priority = 'high'");
    expect(chunk).toContain("priority = 'medium'");
    expect(chunk).toContain("priority = 'normal'");
  });

  it('sorts queue by priority then staleness', () => {
    const idx = code.indexOf("'/validation-queue'");
    const chunk = code.slice(idx, idx + 4500);
    expect(chunk).toContain('queue.sort');
    expect(chunk).toContain('priority');
  });
});

// ─── Frontend: OfficerValidationPage ────────────────────

describe('OfficerValidationPage — Structure', () => {
  const code = readFile('src/pages/OfficerValidationPage.jsx');

  it('exports a default function component', () => {
    expect(code).toContain('export default function OfficerValidationPage');
  });

  it('has page test ID', () => {
    expect(code).toContain('data-testid="officer-validation-page"');
  });

  it('fetches from /seasons/validation-queue', () => {
    expect(code).toContain('/seasons/validation-queue');
  });

  it('imports getCropLabel and getCropIcon', () => {
    expect(code).toContain('getCropLabel');
    expect(code).toContain('getCropIcon');
  });
});

describe('OfficerValidationPage — Queue Screen', () => {
  const code = readFile('src/pages/OfficerValidationPage.jsx');

  it('has header with count and progress', () => {
    expect(code).toContain('validation-header');
    expect(code).toContain('headerCount');
    expect(code).toContain('counterBadge');
  });

  it('has progress bar showing completion', () => {
    expect(code).toContain('progressBar');
    expect(code).toContain('progressFill');
    expect(code).toContain('completedIds.size');
  });

  it('tracks completed items via completedIds Set', () => {
    expect(code).toContain('completedIds');
    expect(code).toContain('new Set');
  });

  it('filters completed items from pending queue', () => {
    expect(code).toContain('pendingQueue');
    expect(code).toContain('completedIds.has');
  });

  it('shows empty state when queue is clear', () => {
    expect(code).toContain('validation-empty');
    expect(code).toContain("t('validation.queueClear')");
  });

  it('shows done state when all items validated', () => {
    expect(code).toContain('validation-done');
    expect(code).toContain("t('validation.allDone')");
  });
});

describe('OfficerValidationPage — Detail View', () => {
  const code = readFile('src/pages/OfficerValidationPage.jsx');

  it('has image-first layout with aspect ratio', () => {
    expect(code).toContain('validation-image');
    expect(code).toContain('mainImage');
    expect(code).toContain("objectFit: 'cover'");
    expect(code).toContain("aspectRatio: '4/3'");
  });

  it('handles no-image case with placeholder', () => {
    expect(code).toContain('no-image-placeholder');
    expect(code).toContain("t('validation.noPhoto')");
  });

  it('shows priority badge on image', () => {
    expect(code).toContain('priority-badge');
    expect(code).toContain('PRIORITY_COLORS');
  });

  it('shows counter overlay (N / total)', () => {
    expect(code).toContain('counterOverlay');
  });

  it('shows farmer name and crop info', () => {
    expect(code).toContain('validation-info');
    expect(code).toContain('farmerName');
    expect(code).toContain('farmMeta');
  });

  it('shows entry summary with activity type, condition, date', () => {
    expect(code).toContain('entrySummary');
    expect(code).toContain('entryTag');
    expect(code).toContain('conditionTag');
    expect(code).toContain('dateTag');
  });

  it('shows region/district location', () => {
    expect(code).toContain('regionBadge');
    expect(code).toContain('farmerRegion');
    expect(code).toContain('farmerDistrict');
  });

  it('uses eager loading for images', () => {
    expect(code).toContain('loading="eager"');
  });
});

describe('OfficerValidationPage — Actions', () => {
  const code = readFile('src/pages/OfficerValidationPage.jsx');

  it('has Approve, Reject, Flag action buttons', () => {
    expect(code).toContain('approve-btn');
    expect(code).toContain('reject-btn');
    expect(code).toContain('flag-btn');
  });

  it('action buttons have 64px minHeight for large tap targets', () => {
    const approveIdx = code.indexOf('approveBtn:');
    const chunk = code.slice(approveIdx, approveIdx + 400);
    expect(chunk).toContain("minHeight: '64px'");
  });

  it('approve action submits immediately (no confirmation)', () => {
    // Approve doesn't set actionMode — goes straight to POST
    expect(code).toContain("handleAction('approve')");
    expect(code).toContain("actionType === 'approve'");
  });

  it('reject/flag require notes before submission', () => {
    expect(code).toContain("actionMode !== actionType");
    expect(code).toContain('setActionMode(actionType)');
    expect(code).toContain('note-input-section');
    expect(code).toContain('note-input');
  });

  it('has note submit button that activates when note is filled', () => {
    expect(code).toContain('note-submit-btn');
    expect(code).toContain('!note.trim()');
  });

  it('note input supports Enter key to submit', () => {
    expect(code).toContain("e.key === 'Enter'");
  });

  it('has cancel button for note input', () => {
    expect(code).toContain('noteCancelBtn');
    expect(code).toContain("setActionMode(null)");
  });

  it('submits to /seasons/{id}/officer-validate', () => {
    expect(code).toContain('/seasons/${current.seasonId}/officer-validate');
  });

  it('submit guard prevents double-tap', () => {
    expect(code).toContain('submitGuardRef');
    expect(code).toContain('submitGuardRef.current = true');
  });

  it('tracks officer_validation pilot event', () => {
    expect(code).toContain("'officer_validation'");
    expect(code).toContain('trackPilotEvent');
  });
});

describe('OfficerValidationPage — Notes for Reject/Flag', () => {
  const code = readFile('src/pages/OfficerValidationPage.jsx');

  it('prefixes note with [REJECTED] for rejections', () => {
    expect(code).toContain('[REJECTED]');
  });

  it('prefixes note with [FLAGGED] for flags', () => {
    expect(code).toContain('[FLAGGED]');
  });

  it('approve sends no note', () => {
    expect(code).toContain("actionType === 'approve'");
    expect(code).toContain('note: actionType === \'approve\' ? null');
  });
});

describe('OfficerValidationPage — Navigation', () => {
  const code = readFile('src/pages/OfficerValidationPage.jsx');

  it('auto-advances to next item after action', () => {
    expect(code).toContain('Auto-advance after brief feedback');
    expect(code).toContain('setTimeout');
    expect(code).toContain('goNext()');
  });

  it('has prev/next navigation buttons', () => {
    expect(code).toContain('nav-prev');
    expect(code).toContain('nav-next');
    expect(code).toContain('nav-bar');
  });

  it('nav buttons are 44px minHeight tap targets', () => {
    const navIdx = code.indexOf('navBtn:');
    const chunk = code.slice(navIdx, navIdx + 250);
    expect(chunk).toContain("minHeight: '44px'");
  });

  it('shows action feedback overlay on decision', () => {
    expect(code).toContain('action-feedback');
    expect(code).toContain('feedbackOverlay');
    expect(code).toContain('actionFeedback');
  });

  it('feedback shows Approved/Rejected/Flagged text', () => {
    expect(code).toContain("msg: actionType === 'approve' ? 'Approved");
    expect(code).toContain("'Rejected'");
    expect(code).toContain("'Flagged'");
  });

  it('has keyboard shortcuts for desktop', () => {
    expect(code).toContain('keyboard-hints');
    expect(code).toContain("e.key === 'a'");
    expect(code).toContain("e.key === 'r'");
    expect(code).toContain("e.key === 'f'");
    expect(code).toContain("e.key === 'ArrowRight'");
    expect(code).toContain("e.key === 'ArrowLeft'");
  });

  it('keyboard shortcuts disabled while typing note', () => {
    expect(code).toContain('if (actionMode) return');
  });
});

describe('OfficerValidationPage — Edge Cases', () => {
  const code = readFile('src/pages/OfficerValidationPage.jsx');

  it('handles no-image with visible placeholder', () => {
    expect(code).toContain('no-image-placeholder');
  });

  it('handles failed validation submit with error feedback', () => {
    expect(code).toContain("type: 'error'");
    expect(code).toContain('Failed');
    expect(code).toContain('tap to retry');
  });

  it('tracks elapsed time per validation', () => {
    expect(code).toContain('startTimeRef');
    expect(code).toContain('elapsed');
  });

  it('shows entry count for context ("+N more")', () => {
    expect(code).toContain('entryCount');
    expect(code).toContain('more');
  });
});

describe('OfficerValidationPage — Mobile UX', () => {
  const code = readFile('src/pages/OfficerValidationPage.jsx');

  it('all action buttons have WebkitTapHighlightColor transparent', () => {
    const matches = (code.match(/WebkitTapHighlightColor:\s*'transparent'/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(5);
  });

  it('action buttons are in a 3-column grid', () => {
    expect(code).toContain("gridTemplateColumns: '1fr 1fr 1fr'");
  });

  it('card container is max 600px centered', () => {
    expect(code).toContain("maxWidth: '600px'");
    expect(code).toContain("margin: '0 auto'");
  });

  it('header is sticky', () => {
    expect(code).toContain("position: 'sticky'");
    expect(code).toContain("top: 0");
  });

  it('note input has 44px minHeight', () => {
    const noteIdx = code.indexOf('noteInput:');
    const chunk = code.slice(noteIdx, noteIdx + 300);
    expect(chunk).toContain("minHeight: '44px'");
  });
});

// ─── App.jsx Route Registration ─────────────────────────

describe('OfficerValidationPage — Route Registration', () => {
  const code = readFile('src/App.jsx');

  it('lazy imports OfficerValidationPage', () => {
    expect(code).toContain("lazy(() => import('./pages/OfficerValidationPage.jsx'))");
  });

  it('registers /officer-validation route', () => {
    expect(code).toContain('path="officer-validation"');
  });

  it('restricts to STAFF_ROLES', () => {
    const idx = code.indexOf('officer-validation');
    const chunk = code.slice(idx, idx + 200);
    expect(chunk).toContain('STAFF_ROLES');
  });
});

// ─── Throughput Estimate ────────────────────────────────

describe('OfficerValidationPage — Throughput Design', () => {
  const code = readFile('src/pages/OfficerValidationPage.jsx');

  it('approve is single-tap (no forms, no confirmation)', () => {
    // Approve goes straight to API — no actionMode set
    expect(code).not.toContain("confirm(");
    expect(code).not.toContain("window.confirm");
  });

  it('auto-advance delay is under 500ms', () => {
    // setTimeout(goNext, 400)
    expect(code).toContain('400');
  });

  it('validation payload is minimal (no forms)', () => {
    // Only sends validationType + stage + condition + optional note
    expect(code).toContain('validationType');
    expect(code).toContain('confirmedStage');
    expect(code).toContain('confirmedCondition');
  });
});
