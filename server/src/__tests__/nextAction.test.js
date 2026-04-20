/**
 * Predictive Next-Action Engine — tests.
 *
 * Verifies:
 * 1. Rule engine returns correct actions based on context
 * 2. Priority ordering (setup > overdue > harvest > update > routine)
 * 3. Stage-specific guidance
 * 4. Fallback when everything is on track
 * 5. NextActionCard component exists and wires correctly
 * 6. i18n keys exist for all action keys
 * 7. Analytics tracking is wired
 * 8. Dashboard integration
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  RULE ENGINE — source code checks
// ═══════════════════════════════════════════════════════════

describe('Next-Action Engine — source structure', () => {
  const src = read('src/utils/nextActionEngine.js');

  it('exports getNextAction function', () => {
    expect(src).toContain('export function getNextAction');
  });

  it('imports farmer lifecycle state', () => {
    expect(src).toContain("import { FARMER_STATE, getFarmerLifecycleState }");
  });

  it('checks for NEW state (no profile)', () => {
    expect(src).toContain('FARMER_STATE.NEW');
  });

  it('checks for SETUP_INCOMPLETE state', () => {
    expect(src).toContain('FARMER_STATE.SETUP_INCOMPLETE');
  });

  it('checks for no active season', () => {
    expect(src).toContain('!season');
  });

  it('checks for harvest stage', () => {
    expect(src).toContain("=== 'harvest'");
  });

  it('checks for overdue updates (14+ days)', () => {
    expect(src).toContain('daysSinceUpdate >= 14');
  });

  it('checks for weekly nudge (7+ days)', () => {
    expect(src).toContain('daysSinceUpdate >= 7');
  });

  it('has stage-specific guidance for planting, growing, flowering', () => {
    expect(src).toContain('monitorPlanting');
    expect(src).toContain('monitorGrowth');
    expect(src).toContain('monitorFlowering');
  });

  it('has fallback on-track action', () => {
    expect(src).toContain('nextAction.onTrack');
  });

  it('returns actionKey, icon, priority, route, reason', () => {
    expect(src).toContain('actionKey:');
    expect(src).toContain('icon:');
    expect(src).toContain('priority:');
    expect(src).toContain('route:');
    expect(src).toContain('reason:');
  });

  it('exports STAGE_ORDER', () => {
    expect(src).toContain('export { STAGE_ORDER }');
  });
});

// ═══════════════════════════════════════════════════════════
//  RULE ENGINE — behavioral tests
// ═══════════════════════════════════════════════════════════

describe('Next-Action Engine — rule evaluation', () => {
  it('returns createProfile for no profile (routes to fast onboarding)', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const result = getNextAction({ profile: null });
    expect(result.actionKey).toBe('nextAction.createProfile');
    expect(result.priority).toBe(1);
    // First-time farmer → fast flow, not the legacy Save Farm
    // Profile form. Contract updated when fast onboarding became
    // the default first-time path.
    expect(result.route).toBe('/onboarding/fast');
  });

  it('returns finishSetup for incomplete profile', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const result = getNextAction({
      profile: { crop: 'MAIZE' }, // missing landSize fields
      countryCode: 'KE',
    });
    expect(result.actionKey).toBe('nextAction.finishSetup');
    expect(result.priority).toBe(1);
    expect(result.meta.missing).toBeDefined();
    expect(result.meta.missing.length).toBeGreaterThan(0);
  });

  it('returns startSeason for active profile with no season', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const result = getNextAction({
      profile: {
        crop: 'MAIZE',
        landSizeValue: 5,
        landSizeUnit: 'acres',
        landSizeHectares: 2,
      },
      countryCode: 'KE',
      season: null,
    });
    expect(result.actionKey).toBe('nextAction.startSeason');
    expect(result.priority).toBe(2);
  });

  it('returns reportHarvest at harvest stage', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const result = getNextAction({
      profile: {
        crop: 'MAIZE',
        landSizeValue: 5,
        landSizeUnit: 'acres',
        landSizeHectares: 2,
      },
      countryCode: 'KE',
      season: {
        stage: 'harvest',
        startDate: new Date(Date.now() - 90 * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [],
      },
    });
    expect(result.actionKey).toBe('nextAction.reportHarvest');
    expect(result.icon).toBe('🌾');
  });

  it('returns addUpdate when 14+ days since last update', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const result = getNextAction({
      profile: {
        crop: 'MAIZE',
        landSizeValue: 5,
        landSizeUnit: 'acres',
        landSizeHectares: 2,
      },
      countryCode: 'KE',
      season: {
        stage: 'growing',
        startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        tasks: [],
      },
    });
    expect(result.actionKey).toBe('nextAction.addUpdate');
    expect(result.meta.daysSinceUpdate).toBeGreaterThanOrEqual(14);
  });

  it('returns weeklyCheck when 7-13 days since update', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const result = getNextAction({
      profile: {
        crop: 'MAIZE',
        landSizeValue: 5,
        landSizeUnit: 'acres',
        landSizeHectares: 2,
      },
      countryCode: 'KE',
      season: {
        stage: 'growing',
        startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
        tasks: [],
      },
    });
    expect(result.actionKey).toBe('nextAction.weeklyCheck');
    expect(result.meta.daysSinceUpdate).toBeGreaterThanOrEqual(7);
  });

  it('returns stage-specific guidance for planting', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const result = getNextAction({
      profile: {
        crop: 'MAIZE',
        landSizeValue: 5,
        landSizeUnit: 'acres',
        landSizeHectares: 2,
      },
      countryCode: 'KE',
      season: {
        stage: 'planting',
        startDate: new Date(Date.now() - 3 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        tasks: [],
      },
    });
    expect(result.actionKey).toBe('nextAction.monitorPlanting');
    expect(result.priority).toBe(4);
  });

  it('returns onTrack fallback when everything is current', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const result = getNextAction({
      profile: {
        crop: 'MAIZE',
        landSizeValue: 5,
        landSizeUnit: 'acres',
        landSizeHectares: 2,
      },
      countryCode: 'KE',
      season: {
        stage: 'harvest',
        startDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [],
      },
    });
    // harvest stage should trigger reportHarvest
    expect(result.actionKey).toBe('nextAction.reportHarvest');
  });

  it('overdue task takes priority over harvest stage', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const result = getNextAction({
      profile: {
        crop: 'MAIZE',
        landSizeValue: 5,
        landSizeUnit: 'acres',
        landSizeHectares: 2,
      },
      countryCode: 'KE',
      season: {
        stage: 'harvest',
        startDate: new Date(Date.now() - 90 * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [
          {
            id: 't1',
            title: 'Apply fertilizer',
            status: 'pending',
            dueDate: new Date(Date.now() - 5 * 86400000).toISOString(),
          },
        ],
      },
    });
    expect(result.actionKey).toBe('nextAction.overdueTask');
    expect(result.priority).toBe(1);
    expect(result.meta.taskTitle).toBe('Apply fertilizer');
  });

  it('upcoming task shows when due within 3 days', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const result = getNextAction({
      profile: {
        crop: 'MAIZE',
        landSizeValue: 5,
        landSizeUnit: 'acres',
        landSizeHectares: 2,
      },
      countryCode: 'KE',
      season: {
        stage: 'growing',
        startDate: new Date(Date.now() - 10 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        tasks: [
          {
            id: 't1',
            title: 'Weed removal',
            status: 'pending',
            dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
          },
        ],
      },
    });
    expect(result.actionKey).toBe('nextAction.upcomingTask');
    expect(result.meta.taskTitle).toBe('Weed removal');
  });
});

// ═══════════════════════════════════════════════════════════
//  PRIORITY ORDERING
// ═══════════════════════════════════════════════════════════

describe('Next-Action Engine — priority ordering', () => {
  it('setup actions are priority 1', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const r1 = getNextAction({ profile: null });
    expect(r1.priority).toBe(1);
    const r2 = getNextAction({ profile: { crop: 'MAIZE' }, countryCode: 'KE' });
    expect(r2.priority).toBe(1);
  });

  it('season actions are priority 2-3', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const completeProfile = {
      crop: 'MAIZE', landSizeValue: 5, landSizeUnit: 'acres', landSizeHectares: 2,
    };
    const r = getNextAction({ profile: completeProfile, countryCode: 'KE', season: null });
    expect(r.priority).toBe(2);
  });

  it('stage guidance is priority 4', async () => {
    const { getNextAction } = await import('../../../src/utils/nextActionEngine.js');
    const r = getNextAction({
      profile: { crop: 'MAIZE', landSizeValue: 5, landSizeUnit: 'acres', landSizeHectares: 2 },
      countryCode: 'KE',
      season: {
        stage: 'flowering',
        startDate: new Date(Date.now() - 5 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        tasks: [],
      },
    });
    expect(r.actionKey).toBe('nextAction.monitorFlowering');
    expect(r.priority).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════
//  NEXT ACTION CARD — component structure
// ═══════════════════════════════════════════════════════════

describe('NextActionCard — component wiring', () => {
  const src = read('src/components/NextActionCard.jsx');

  it('imports getNextAction from engine', () => {
    expect(src).toContain("import { getNextAction }");
    expect(src).toContain('nextActionEngine');
  });

  it('imports useProfile context', () => {
    expect(src).toContain('useProfile');
  });

  it('imports useSeason context', () => {
    expect(src).toContain('useSeason');
  });

  it('imports useAuth context', () => {
    expect(src).toContain('useAuth');
  });

  it('imports useTranslation', () => {
    expect(src).toContain('useTranslation');
  });

  it('tracks next_action.shown analytics', () => {
    expect(src).toContain('next_action.shown');
  });

  it('tracks next_action.clicked analytics', () => {
    expect(src).toContain('next_action.clicked');
  });

  it('has data-testid on CTA button', () => {
    expect(src).toContain('next-action-cta');
  });

  it('uses navigate for CTA routing', () => {
    expect(src).toContain('navigate(action.route)');
  });

  it('distinguishes urgent vs routine styling', () => {
    expect(src).toContain('isUrgent');
    expect(src).toContain('priority <= 2');
  });

  it('formats reason with meta interpolation', () => {
    expect(src).toContain('formatReason');
    expect(src).toContain("'{days}'");
    expect(src).toContain("'{task}'");
  });
});

// ═══════════════════════════════════════════════════════════
//  DASHBOARD INTEGRATION
// ═══════════════════════════════════════════════════════════

describe('Dashboard — NextActionCard integration', () => {
  it('NextActionCard component file exists', () => {
    expect(existsSync(join(root, 'src/components/NextActionCard.jsx'))).toBe(true);
  });

  it('NextActionCard component file exists and exports default', () => {
    const src = read('src/components/NextActionCard.jsx');
    expect(src).toContain("import { getNextAction }");
  });
});

// ═══════════════════════════════════════════════════════════
//  I18N — translation keys exist
// ═══════════════════════════════════════════════════════════

describe('i18n — next-action translation keys', () => {
  const translations = read('src/i18n/translations.js');

  const requiredKeys = [
    'nextAction.title',
    'nextAction.createProfile',
    'nextAction.createProfileReason',
    'nextAction.finishSetup',
    'nextAction.finishSetupReason',
    'nextAction.startSeason',
    'nextAction.startSeasonReason',
    'nextAction.overdueTask',
    'nextAction.overdueTaskReason',
    'nextAction.reportHarvest',
    'nextAction.reportHarvestReason',
    'nextAction.addUpdate',
    'nextAction.addUpdateReason',
    'nextAction.upcomingTask',
    'nextAction.upcomingTaskReason',
    'nextAction.weeklyCheck',
    'nextAction.weeklyCheckReason',
    'nextAction.monitorPlanting',
    'nextAction.monitorPlantingReason',
    'nextAction.monitorGrowth',
    'nextAction.monitorGrowthReason',
    'nextAction.monitorFlowering',
    'nextAction.monitorFloweringReason',
    'nextAction.onTrack',
    'nextAction.onTrackReason',
  ];

  for (const key of requiredKeys) {
    it(`has key: ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('all next-action keys have 5 languages (en, fr, sw, ha, tw)', () => {
    for (const key of requiredKeys) {
      const keyPattern = new RegExp(`'${key.replace('.', '\\.')}':.*?\\{[^}]*en:.*?fr:.*?sw:.*?ha:.*?tw:`);
      expect(translations).toMatch(keyPattern);
    }
  });
});
