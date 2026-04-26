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

// ─── Activation Reliability ─────────────────────────────

describe('Activation Reliability', () => {
  it('OnboardingWizard uses useDraft for form persistence', () => {
    const code = readFile('src/components/OnboardingWizard.jsx');
    expect(code).toContain("useDraft(");
    expect(code).toContain("'onboarding-wizard'");
  });

  it('OnboardingWizard has submit guard to prevent double-submit', () => {
    const code = readFile('src/components/OnboardingWizard.jsx');
    expect(code).toContain('submitGuardRef');
    expect(code).toContain('submitGuardRef.current = true');
  });

  it('OnboardingWizard pushes history for forward steps', () => {
    const code = readFile('src/components/OnboardingWizard.jsx');
    expect(code).toContain('step > 0');
    expect(code).toContain('pushState');
  });

  it('OnboardingWizard uses UNIT_OPTIONS for land size unit selection', () => {
    const code = readFile('src/components/OnboardingWizard.jsx');
    expect(code).toContain('UNIT_OPTIONS');
    expect(code).toContain('landSizeUnit');
  });

  it('FarmerDashboardPage shows error on profile fetch failure', () => {
    const code = readFile('src/pages/FarmerDashboardPage.jsx');
    expect(code).toContain('profileError');
    expect(code).toContain('Could not load your profile');
  });

  it('FarmerDashboardPage does not trigger onboarding on fetchProfiles failure', () => {
    const code = readFile('src/pages/FarmerDashboardPage.jsx');
    expect(code).toContain('do NOT show onboarding');
  });

  it('FarmerDashboardPage createProfile failure keeps wizard open', () => {
    const code = readFile('src/pages/FarmerDashboardPage.jsx');
    expect(code).toContain('onboardingError');
    expect(code).toContain('Failed to create your farm profile');
  });
});

// ─── First Action Success ────────────────────────────────

describe('First Action Success', () => {
  it('FarmerProgressTab uses useDraft for progress form', () => {
    const code = readFile('src/pages/FarmerProgressTab.jsx');
    expect(code).toContain("useDraft(");
    expect(code).toContain("progress-form:");
  });

  it('FarmerProgressTab shows success/error feedback', () => {
    const code = readFile('src/pages/FarmerProgressTab.jsx');
    expect(code).toContain('showSuccess');
    expect(code).toContain('setFormError');
  });

  it('FarmerProgressTab tracks first_update_submitted', () => {
    const code = readFile('src/pages/FarmerProgressTab.jsx');
    expect(code).toContain("'first_update_submitted'");
  });

  it('FarmerProgressTab has same-day duplicate warning', () => {
    const code = readFile('src/pages/FarmerProgressTab.jsx');
    expect(code).toContain('dupWarning');
    expect(code).toContain("t('progress.duplicateWarning')");
  });
});

// ─── Invite Trust ────────────────────────────────────────

describe('Invite Trust', () => {
  it('AcceptInvitePage tracks invite_opened', () => {
    const code = readFile('src/pages/AcceptInvitePage.jsx');
    expect(code).toContain("'invite_opened'");
  });

  it('AcceptInvitePage shows next-step guidance', () => {
    const code = readFile('src/pages/AcceptInvitePage.jsx');
    expect(code).toContain('What happens next');
  });

  it('FarmerDetailPage has resend invite', () => {
    const code = readFile('src/pages/FarmerDetailPage.jsx');
    expect(code).toContain('resend-invite');
  });

  it('server has resend rate limiter', () => {
    const code = readFile('server/src/middleware/rateLimiters.js');
    expect(code).toContain('resendInviteLimiter');
  });
});

// ─── Duplicate Safeguards ────────────────────────────────

describe('Duplicate Safeguards', () => {
  it('farmer create route checks for duplicates', () => {
    const code = readFile('server/src/modules/farmers/routes.js');
    expect(code).toContain('checkDuplicateFarmer');
    expect(code).toContain('confirmDuplicate');
  });

  it('farmer invite route checks for duplicates', () => {
    const code = readFile('server/src/modules/farmers/routes.js');
    const matches = (code.match(/checkDuplicateFarmer/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(2);
  });
});

// ─── Land Size Consistency ───────────────────────────────

describe('Land Size Consistency', () => {
  it('all three models have landSize fields', () => {
    const schema = readFile('server/prisma/schema.prisma');
    for (const model of ['FarmProfile', 'Farmer', 'FarmSeason']) {
      const idx = schema.indexOf(`model ${model}`);
      const block = schema.slice(idx, schema.indexOf('@@map', idx));
      expect(block).toContain('landSizeValue');
      expect(block).toContain('landSizeUnit');
      expect(block).toContain('landSizeHectares');
    }
  });

  it('backend services compute land size', () => {
    for (const f of ['server/src/modules/farmProfiles/service.js', 'server/src/modules/farmers/service.js', 'server/src/modules/seasons/service.js']) {
      const code = readFile(f);
      expect(code).toContain('computeLandSizeFields');
    }
  });

  it('all forms have unit selector', () => {
    for (const f of ['src/components/OnboardingWizard.jsx', 'src/pages/FarmerRegisterPage.jsx', 'src/pages/FarmerProgressTab.jsx', 'src/pages/FarmersPage.jsx', 'src/pages/NewApplicationPage.jsx']) {
      const code = readFile(f);
      expect(code).toContain('UNIT_OPTIONS');
    }
  });
});

// ─── Reporting Consistency ───────────────────────────────

describe('Reporting Consistency', () => {
  it('Dashboard does not fall back to totalApplications for farmer count', () => {
    const code = readFile('src/pages/DashboardPage.jsx');
    // The "Active Farmers" card must not use totalApplications as fallback
    expect(code).not.toMatch(/approved\s*\?\?\s*portfolio\.totalApplications/);
    expect(code).toContain('?? 0}');
  });
});

// ─── UI Consistency ──────────────────────────────────────

describe('UI Consistency', () => {
  it('CSS has all alert-inline variants', () => {
    const css = readFile('src/index.css');
    for (const v of ['success', 'danger', 'warning', 'info']) {
      expect(css).toContain(`.alert-inline-${v}`);
    }
  });

  it('CSS has btn-outline-danger', () => {
    const css = readFile('src/index.css');
    expect(css).toContain('.btn-outline-danger');
  });

  it('EmptyState in all farmer tabs', () => {
    for (const f of ['FarmerActivitiesTab', 'FarmerMarketTab', 'FarmerRemindersTab', 'FarmerStorageTab', 'FarmerNotificationsTab', 'FarmerOverviewTab']) {
      const code = readFile(`src/pages/${f}.jsx`);
      expect(code).toContain("import EmptyState from");
    }
  });

  it('no farmer tab uses className="empty-state"', () => {
    for (const f of ['FarmerActivitiesTab', 'FarmerMarketTab', 'FarmerRemindersTab', 'FarmerStorageTab', 'FarmerNotificationsTab', 'FarmerOverviewTab', 'FarmerProgressTab']) {
      const code = readFile(`src/pages/${f}.jsx`);
      expect(code).not.toContain('className="empty-state"');
    }
  });

  it('no farmer-facing page uses hardcoded #EF4444 on danger buttons', () => {
    const pages = ['FarmerMarketTab', 'FarmerProgressTab', 'FarmerActivitiesTab'];
    for (const f of pages) {
      const code = readFile(`src/pages/${f}.jsx`);
      expect(code).not.toMatch(/style=\{[^}]*borderColor.*#EF4444/);
    }
  });
});

// ─── Pilot Metrics ───────────────────────────────────────

describe('Pilot Metrics', () => {
  it('tracks core funnel: invite -> onboarding -> first update -> season', () => {
    expect(readFile('src/pages/AcceptInvitePage.jsx')).toContain("'invite_opened'");
    expect(readFile('src/components/OnboardingWizard.jsx')).toContain("'onboarding_started'");
    expect(readFile('src/pages/FarmerDashboardPage.jsx')).toContain("'onboarding_completed'");
    expect(readFile('src/pages/FarmerProgressTab.jsx')).toContain("'first_update_submitted'");
    expect(readFile('src/pages/FarmerProgressTab.jsx')).toContain("'season_created'");
  });
});

// ─── Phase 3: Error Recovery ─────────────────────────────

describe('Admin Error Recovery', () => {
  it('FraudQueuePage uses inline error instead of alert()', () => {
    const code = readFile('src/pages/FraudQueuePage.jsx');
    expect(code).not.toContain("alert(");
    expect(code).toContain('actionError');
    expect(code).toContain('alert-inline-danger');
  });

  it('PilotMetricsPage uses state error instead of alert()', () => {
    const code = readFile('src/pages/PilotMetricsPage.jsx');
    expect(code).not.toContain("alert(");
  });

  it('AdminControlPage tabs have error states', () => {
    const code = readFile('src/pages/AdminControlPage.jsx');
    // All 4 tabs should have loadError handling
    const errorMatches = (code.match(/setLoadError/g) || []).length;
    expect(errorMatches).toBeGreaterThanOrEqual(4);
    expect(code).toContain('alert-inline-danger');
  });

  it('FarmerDetailPage HistoricalPerformance has error state', () => {
    const code = readFile('src/pages/FarmerDetailPage.jsx');
    expect(code).toContain('Could not load performance history');
  });
});

// ─── Phase 3: No silent catch blocks in admin pages ─────

describe('No silent error swallowing in critical paths', () => {
  it('FraudQueuePage has no empty catch blocks', () => {
    const code = readFile('src/pages/FraudQueuePage.jsx');
    expect(code).not.toMatch(/\.catch\(\(\)\s*=>\s*\{\s*\}\)/);
  });

  it('AdminControlPage SystemOverview has no empty catch', () => {
    const code = readFile('src/pages/AdminControlPage.jsx');
    // All .catch blocks should set error state
    const emptyCatches = (code.match(/\.catch\(\(\)\s*=>\s*\{\s*\}\)/g) || []).length;
    // Only non-critical paths (like benchmarks fallback) may have empty catches
    expect(emptyCatches).toBeLessThanOrEqual(0);
  });
});
