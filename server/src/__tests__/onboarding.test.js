import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ─── 1. Prisma Schema — OnboardingStatus enum + OnboardingEvent model ──

describe('Prisma Schema — onboarding tracking', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('defines OnboardingStatus enum with 4 values', () => {
    expect(schema).toContain('enum OnboardingStatus');
    expect(schema).toContain('not_started');
    expect(schema).toContain('in_progress');
    expect(schema).toContain('completed');
    expect(schema).toContain('abandoned');
  });

  it('User model has onboarding fields', () => {
    expect(schema).toContain('onboardingStatus');
    expect(schema).toContain('onboardingStartedAt');
    expect(schema).toContain('onboardedAt');
    expect(schema).toContain('onboardingLastStep');
    expect(schema).toContain('onboardingSource');
  });

  it('defines OnboardingEvent model with required fields', () => {
    expect(schema).toContain('model OnboardingEvent');
    expect(schema).toContain('event_type');
    expect(schema).toContain('step_name');
    expect(schema).toContain('metadata_json');
    expect(schema).toContain('event_timestamp');
    expect(schema).toContain('onboarding_events');
  });

  it('has indexes on onboarding fields', () => {
    expect(schema).toContain('idx_users_onboarding_status');
    expect(schema).toContain('idx_onboarding_events_user');
    expect(schema).toContain('idx_onboarding_events_type');
    expect(schema).toContain('idx_onboarding_events_ts');
  });

  it('User model has onboardingEvents relation', () => {
    expect(schema).toContain('onboardingEvents');
    expect(schema).toContain('OnboardingEvent[]');
  });
});

// ─── 2. Migration SQL ──

describe('Migration — onboarding tracking', () => {
  const sql = readFile('server/prisma/migrations/20260412_onboarding_tracking/migration.sql');

  it('creates OnboardingStatus enum', () => {
    expect(sql).toContain('CREATE TYPE "OnboardingStatus"');
    expect(sql).toContain("'not_started'");
    expect(sql).toContain("'completed'");
  });

  it('adds onboarding columns to users table', () => {
    expect(sql).toContain('ALTER TABLE "users"');
    expect(sql).toContain('"onboarding_status"');
    expect(sql).toContain('"onboarding_started_at"');
    expect(sql).toContain('"onboarded_at"');
  });

  it('back-fills completed users from farmers table', () => {
    expect(sql).toContain('UPDATE "users"');
    expect(sql).toContain('"onboarding_completed_at"');
  });

  it('creates onboarding_events table', () => {
    expect(sql).toContain('CREATE TABLE "onboarding_events"');
    expect(sql).toContain('"event_type"');
    expect(sql).toContain('"step_name"');
  });

  it('adds foreign key constraint', () => {
    expect(sql).toContain('onboarding_events_user_id_fkey');
    expect(sql).toContain('ON DELETE CASCADE');
  });
});

// ─── 3. Onboarding Service — state machine + analytics ──

describe('Onboarding Service', () => {
  const code = readFile('server/src/modules/onboarding/service.js');

  it('exports all lifecycle functions', () => {
    expect(code).toContain('export async function startOnboarding');
    expect(code).toContain('export async function recordStepCompleted');
    expect(code).toContain('export async function completeOnboarding');
    expect(code).toContain('export async function abandonOnboarding');
    expect(code).toContain('export async function resumeOnboarding');
    expect(code).toContain('export async function getOnboardingStatus');
    expect(code).toContain('export async function getOnboardingAnalytics');
  });

  it('defines valid state transitions', () => {
    expect(code).toContain("not_started:");
    expect(code).toContain("in_progress:");
    expect(code).toContain("abandoned:");
    expect(code).toContain("completed:");
    // completed is terminal
    expect(code).toMatch(/completed:\s*\[\]/);
  });

  it('validates transitions and rejects invalid ones', () => {
    expect(code).toContain('Cannot transition from');
    expect(code).toContain('statusCode: 400');
  });

  it('records events inside a transaction', () => {
    expect(code).toContain('$transaction');
    expect(code).toContain('onboardingEvent.create');
  });

  it('selects onboardingStartedAt in transaction to guard "set once"', () => {
    expect(code).toContain('onboardingStartedAt: true');
  });

  it('computes analytics: completion rate, avg time, drop-off by step', () => {
    expect(code).toContain('completionRate');
    expect(code).toContain('avgOnboardingMinutes');
    expect(code).toContain('dropOffByStep');
    expect(code).toContain('abandonmentRate');
    expect(code).toContain('bySource');
  });
});

// ─── 4. Onboarding Routes ──

describe('Onboarding Routes', () => {
  const code = readFile('server/src/modules/onboarding/routes.js');

  it('has farmer-facing endpoints', () => {
    expect(code).toContain("router.get('/status'");
    expect(code).toContain("router.post('/start'");
    expect(code).toContain("router.post('/step'");
    expect(code).toContain("router.post('/complete'");
    expect(code).toContain("router.post('/abandon'");
    expect(code).toContain("router.post('/resume'");
  });

  it('has admin analytics endpoint', () => {
    expect(code).toContain("router.get('/admin/analytics'");
    expect(code).toContain("'super_admin', 'institutional_admin'");
  });

  it('has admin user detail endpoint', () => {
    expect(code).toContain("router.get('/admin/user/:userId'");
  });

  it('requires authentication and uses req.user.sub', () => {
    expect(code).toContain('authenticate');
    expect(code).toContain('req.user.sub');
    expect(code).not.toContain('req.user.id');
  });
});

// ─── 5. Integration — wired into app.js, auth.js, farmSetup ──

describe('Onboarding integration wiring', () => {
  it('app.js mounts onboarding routes', () => {
    const app = readFile('server/src/app.js');
    expect(app).toContain("import onboardingRoutes from './modules/onboarding/routes.js'");
    expect(app).toContain("app.use('/api/onboarding', onboardingRoutes)");
  });

  it('registration flow triggers startOnboarding', () => {
    const auth = readFile('server/routes/auth.js');
    expect(auth).toContain('startOnboarding');
    expect(auth).toContain("source: 'self_register'");
  });

  it('atomicFarmSetup triggers completeOnboarding', () => {
    const service = readFile('server/src/modules/farmProfiles/service.js');
    expect(service).toContain('completeOnboarding');
  });

  it('admin user list returns onboarding fields', () => {
    const admin = readFile('server/src/modules/auth/admin-routes.js');
    expect(admin).toContain('onboardingStatus: true');
    expect(admin).toContain('onboardingStartedAt: true');
    expect(admin).toContain('onboardedAt: true');
  });

  it('admin user list supports onboardingStatus filter', () => {
    const admin = readFile('server/src/modules/auth/admin-routes.js');
    expect(admin).toContain('onboardingStatus');
    expect(admin).toContain("'not_started', 'in_progress', 'completed', 'abandoned'");
  });
});

// ─── 6. Frontend — AdminUsersPage onboarding UI ──

describe('AdminUsersPage — onboarding UI', () => {
  const page = readFile('src/pages/AdminUsersPage.jsx');

  it('has onboarding filter tabs', () => {
    expect(page).toContain('ONBOARDING_FILTERS');
    expect(page).toContain('onboardingFilter');
    expect(page).toContain('handleOnboardingFilterChange');
  });

  it('has OnboardingStatusBadge component', () => {
    expect(page).toContain('function OnboardingStatusBadge');
    expect(page).toContain('ONBOARDING_BADGE_STYLES');
    expect(page).toContain('ONBOARDING_LABELS');
  });

  it('has OnboardingCard component for summary stats', () => {
    expect(page).toContain('function OnboardingCard');
    expect(page).toContain('Completion Rate');
    expect(page).toContain('Avg. Time');
    expect(page).toContain('Abandoned');
  });

  it('table includes onboarding column', () => {
    expect(page).toContain('<th>Onboarding</th>');
    expect(page).toContain('<OnboardingStatusBadge');
  });

  it('fetches onboarding analytics on mount', () => {
    expect(page).toContain("api.get('/onboarding/admin/analytics')");
    expect(page).toContain('onboardingStats');
  });
});
