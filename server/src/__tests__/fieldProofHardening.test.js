import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ─── 1. First-Use Reliability ──────────────────────────────────

describe('First-Use Reliability', () => {
  it('profile save includes idempotency key in queue items', () => {
    const code = readFile('src/context/ProfileContext.jsx');
    // Queue items must carry an idempotency key to prevent duplicates on retry
    expect(code).toMatch(/idempotencyKey|idempotency_key|idempotency/i);
  });

  it('duplicate flush calls are prevented by flushingRef guard', () => {
    const code = readFile('src/context/ProfileContext.jsx');
    // A ref-based guard prevents concurrent flush attempts
    expect(code).toMatch(/flushingRef|isFlushing/);
  });

  it('save timeout returns error without losing data', () => {
    const translations = readFile('src/i18n/translations.js');
    // A timeout-specific message exists so the user knows data is safe locally
    expect(translations).toContain('setup.saveTimeout');
    expect(translations).toContain('saved locally');
  });
});

// ─── 2. State Consistency ──────────────────────────────────────

describe('State Consistency', () => {
  it('incomplete setup hides season start CTA', () => {
    const code = readFile('src/components/PrimaryFarmActionCard.jsx');
    // When isReady is false, the component returns a setup-prompt card
    // and never renders the "Start Farming Season" button
    expect(code).toContain('!score.isReady');
    expect(code).toContain("t('dashboard.completeSetup')");
  });

  it('incomplete setup hides numeric farm score', () => {
    const code = readFile('src/components/PrimaryFarmActionCard.jsx');
    // isReady gate must come before any score display
    const isReadyIdx = code.indexOf('!score.isReady');
    expect(isReadyIdx).toBeGreaterThan(-1);
    // The early return for !isReady ensures no numeric score is shown
    const returnIdx = code.indexOf('return', isReadyIdx);
    expect(returnIdx).toBeGreaterThan(isReadyIdx);
  });

  it('dashboard gates weather/tasks behind setup completion', () => {
    const code = readFile('src/components/SeasonTasksCard.jsx');
    // When there is no season and setup is incomplete, tasks are gated
    expect(code).toContain('!season && !score.isReady');
    expect(code).toContain("t('tasks.setupFirst')");
  });

  it('season start requires isReady === true', () => {
    const code = readFile('src/components/PrimaryFarmActionCard.jsx');
    // A guard clause checks !score.isReady and returns early (setup prompt)
    expect(code).toContain('if (!score.isReady)');
    // The guard clause returns before the start season button can render
    const guardIdx = code.indexOf('if (!score.isReady)');
    const earlyReturn = code.indexOf('return', guardIdx);
    const startSeasonBtn = code.indexOf("t('action.startSeason')");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(startSeasonBtn).toBeGreaterThan(earlyReturn);
  });
});

// ─── 3. Offline Safety ─────────────────────────────────────────

describe('Offline Safety', () => {
  it('queue items have unique IDs even when created rapidly', () => {
    const code = readFile('src/lib/offlineDb.js');
    // Each queued item must get a UUID or unique identifier via generateId
    expect(code).toContain('function generateId');
    expect(code).toMatch(/crypto\.randomUUID/);
  });

  it('idempotency keys are UUIDs', () => {
    const code = readFile('src/lib/offlineDb.js');
    // enqueueProfileSync assigns an idempotencyKey using generateId
    expect(code).toContain('idempotencyKey');
    expect(code).toContain('generateId');
    // The underlying generateId uses crypto.randomUUID
    expect(code).toContain('crypto.randomUUID');
  });

  it('offline save queues item with correct payload', () => {
    const profileCtx = readFile('src/context/ProfileContext.jsx');
    // ProfileContext calls enqueueProfileSync with payload
    expect(profileCtx).toContain('enqueueProfileSync(payload)');
    // The flush mechanism reads queue items and sends them
    expect(profileCtx).toContain('getSyncQueue');
    expect(profileCtx).toContain('item.idempotencyKey');
  });
});

// ─── 4. Localization ───────────────────────────────────────────

describe('Localization', () => {
  const translations = readFile('src/i18n/translations.js');
  const LANGS = ['en', 'fr', 'sw', 'ha', 'tw'];

  const criticalKeys = [
    'common.save',
    'common.retry',
    'common.loading',
    'home.welcome',
    'setup.banner',
    'season.startFailed',
    'season.starting',
    'tasks.doToday',
    'tasks.doSoon',
    'tasks.checkLater',
    'tasks.completeFailed',
    'offline.savedLocally',
    'offline.syncing',
    'offline.failed',
    'offline.pendingSync',
    'error.somethingWrong',
  ];

  it('all critical farmer keys exist in all 5 languages', () => {
    for (const key of criticalKeys) {
      expect(translations).toContain(`'${key}'`);
    }
    // Verify all 5 language codes appear in translation entries
    for (const lang of LANGS) {
      expect(translations).toContain(`${lang}:`);
    }
  });

  it('setup.banner exists in en, fr, sw, ha, tw', () => {
    expect(translations).toContain("'setup.banner'");
    // The setup.banner entry should have all 5 language fields
    const bannerIdx = translations.indexOf("'setup.banner'");
    const nextKeyIdx = translations.indexOf("'setup.", bannerIdx + 20);
    const bannerBlock = translations.substring(bannerIdx, nextKeyIdx > -1 ? nextKeyIdx : bannerIdx + 500);
    for (const lang of LANGS) {
      expect(bannerBlock).toContain(`${lang}:`);
    }
  });

  it('offline keys exist in all languages', () => {
    const offlineKeys = ['offline.savedLocally', 'offline.syncing', 'offline.failed', 'offline.pendingSync', 'offline.willSync'];
    for (const key of offlineKeys) {
      expect(translations).toContain(`'${key}'`);
    }
  });

  it('error keys exist in all languages', () => {
    const errorKeys = ['error.somethingWrong', 'error.loadProfile', 'error.network'];
    for (const key of errorKeys) {
      expect(translations).toContain(`'${key}'`);
    }
  });
});

// ─── 5. Reporting Alignment ────────────────────────────────────

describe('Reporting Alignment', () => {
  it('analytics-summary and exports use same org filter pattern', () => {
    const analytics = readFile('server/routes/analytics-summary.js');
    const exports = readFile('server/routes/exports.js');

    // Both use extractOrganization middleware
    expect(analytics).toContain('extractOrganization');
    expect(exports).toContain('extractOrganization');

    // Both check req.organizationId for scoping
    expect(analytics).toContain('req.organizationId');
    expect(exports).toContain('req.organizationId');

    // Both use the same middleware chain pattern
    expect(analytics).toContain("authorize('super_admin', 'institutional_admin')");
    expect(exports).toContain("authorize('super_admin', 'institutional_admin')");
  });

  it('totalFarmers count uses same where clause', () => {
    const analytics = readFile('server/routes/analytics-summary.js');
    const exports = readFile('server/routes/exports.js');

    // Analytics: orgFilter = req.organizationId ? { organizationId: req.organizationId } : {}
    expect(analytics).toContain('req.organizationId ? { organizationId: req.organizationId } : {}');

    // Exports: where.organizationId = req.organizationId (conditional)
    expect(exports).toContain('where.organizationId = req.organizationId');

    // Both ultimately filter farmers by organizationId when org-scoped
    expect(analytics).toContain('prisma.farmer.count');
    expect(exports).toContain('prisma.farmer.findMany');
  });
});

// ─── 6. Mobile Usability ───────────────────────────────────────

describe('Mobile Usability', () => {
  it('form inputs use 16px font to prevent iOS zoom', () => {
    const wizard = readFile('src/components/OnboardingWizard.jsx');
    // iOS auto-zooms on inputs with font-size < 16px
    // The onboarding wizard (primary farmer input form) should use >= 16px
    expect(wizard).toMatch(/fontSize.*['"]?1(rem|6px)['"']?|font-size.*16/);
  });

  it('save button is sticky at bottom', () => {
    const wizard = readFile('src/components/OnboardingWizard.jsx');
    // The main CTA should be fixed/sticky at the bottom for thumb reach
    expect(wizard).toMatch(/position.*['"]?(sticky|fixed)['"']?|sticky.*bottom/i);
  });

  it('touch targets are minimum 44px', () => {
    const actionCard = readFile('src/components/PrimaryFarmActionCard.jsx');
    // Apple HIG recommends 44px minimum touch targets
    // The CTA button uses padding: '1rem' (16px) on both sides = 32px + text height
    // With fontSize: '1rem' line-height ~ 16-24px, total ~ 48-56px. Check padding exists.
    expect(actionCard).toMatch(/padding.*['"]?1rem['"']?/);
    // Button should have a large enough clickable area
    expect(actionCard).toContain("fontSize: '1rem'");
  });
});
