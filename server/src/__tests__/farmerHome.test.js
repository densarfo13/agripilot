/**
 * Farmer Home — action-first dashboard tests
 *
 * Verifies the simplified farmer dashboard structure per the spec:
 *  1. Farmer home shows only one primary task
 *  2. Highest-priority incomplete task is selected (high > medium > low)
 *  3. Weather block remains small and readable
 *  4. Quick actions work (3 tiles)
 *  5. Weekly progress renders correctly
 *  6. Old cluttered sections are removed from main page
 *  7. Fallback appears when no tasks exist
 *  8. Mobile layout remains clean
 *  9. Component structure matches spec
 * 10. i18n keys exist for all farmer-visible text
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const readFile = (rel) =>
  fs.readFileSync(path.resolve(__dirname, '../../..', rel), 'utf-8');

const dashboard = readFile('src/pages/Dashboard.jsx');
const farmerHeader = readFile('src/components/FarmerHeader.jsx');
const todayTask = readFile('src/components/TodayTaskCard.jsx');
const weatherCard = readFile('src/components/WeatherStatusCard.jsx');
const quickActions = readFile('src/components/QuickActionsRow.jsx');
const weeklyProgress = readFile('src/components/WeeklyProgressCard.jsx');
const translations = readFile('src/i18n/translations.js');

// ═══════════════════════════════════════════════════════════
//  1. Farmer home shows only one primary task
// ═══════════════════════════════════════════════════════════
describe('Farmer home — single primary task', () => {
  it('Dashboard renders TodayTaskCard (not a task list)', () => {
    expect(dashboard).toContain('<TodayTaskCard');
  });

  it('TodayTaskCard shows exactly one task title', () => {
    expect(todayTask).toContain('primaryTask.title');
    // Should NOT render a .map() over multiple tasks
    expect(todayTask).not.toMatch(/tasks\.map|taskList\.map|allTasks\.map/);
  });

  it('TodayTaskCard has a single CTA button (Do this now)', () => {
    expect(todayTask).toContain('data-testid="do-this-now-btn"');
    expect(todayTask).toContain("dashboard.doThisNow");
  });
});

// ═══════════════════════════════════════════════════════════
//  2. Highest-priority task is selected (high > medium > low)
// ═══════════════════════════════════════════════════════════
describe('Farmer home — task priority selection', () => {
  it('loadPrimaryTask walks high > medium > low', () => {
    // The priority chain must appear in order
    const highIdx = dashboard.indexOf("tk.priority === 'high'");
    const medIdx = dashboard.indexOf("tk.priority === 'medium'");
    const lowIdx = dashboard.indexOf("tk.priority === 'low'");
    expect(highIdx).toBeGreaterThan(-1);
    expect(medIdx).toBeGreaterThan(highIdx);
    expect(lowIdx).toBeGreaterThan(medIdx);
  });

  it('trusts server-filtered tasks (no localStorage filtering)', () => {
    // Server returns only pending tasks; no client-side done filtering
    expect(dashboard).not.toContain('loadDoneSet');
    expect(dashboard).not.toContain('DONE_KEY');
    expect(dashboard).toContain('completedCount');
    expect(dashboard).toContain('getFarmTasks');
  });
});

// ═══════════════════════════════════════════════════════════
//  3. Weather block is small and readable
// ═══════════════════════════════════════════════════════════
describe('Farmer home — weather status', () => {
  it('Dashboard renders WeatherStatusCard', () => {
    expect(dashboard).toContain('<WeatherStatusCard');
  });

  it('WeatherStatusCard has "Today on your farm" title', () => {
    expect(weatherCard).toContain("dashboard.todayOnFarm");
  });

  it('WeatherStatusCard shows a support sentence', () => {
    expect(weatherCard).toContain('supportText');
  });

  it('WeatherStatusCard includes Listen button (VoicePromptButton)', () => {
    expect(weatherCard).toContain('VoicePromptButton');
  });

  it('weather status line is max 1-2 short lines (no dense grid)', () => {
    // No grid layout or metrics table in weather card
    expect(weatherCard).not.toMatch(/gridTemplateColumns|<table|metricsGrid/);
  });
});

// ═══════════════════════════════════════════════════════════
//  4. Quick actions (3 tiles)
// ═══════════════════════════════════════════════════════════
describe('Farmer home — quick actions', () => {
  it('Dashboard renders QuickActionsRow', () => {
    expect(dashboard).toContain('<QuickActionsRow');
  });

  it('QuickActionsRow has exactly 3 buttons', () => {
    const buttons = quickActions.match(/<button/g);
    expect(buttons).toHaveLength(3);
  });

  it('has Add Update action', () => {
    expect(quickActions).toContain("dashboard.addUpdate");
    expect(quickActions).toContain('data-testid="add-update-btn"');
  });

  it('has My Farm action', () => {
    expect(quickActions).toContain("dashboard.myFarm");
  });

  it('has All Tasks action with badge', () => {
    expect(quickActions).toContain("dashboard.tasks");
    expect(quickActions).toContain('taskCount');
  });

  it('tiles have large tap targets (minHeight >= 80px)', () => {
    expect(quickActions).toMatch(/minHeight:\s*['"]80px['"]/);
  });
});

// ═══════════════════════════════════════════════════════════
//  5. Weekly progress renders correctly
// ═══════════════════════════════════════════════════════════
describe('Farmer home — weekly progress', () => {
  it('Dashboard renders WeeklyProgressCard', () => {
    expect(dashboard).toContain('<WeeklyProgressCard');
  });

  it('shows "This week" title', () => {
    expect(weeklyProgress).toContain("dashboard.thisWeek");
  });

  it('shows X of Y tasks done', () => {
    expect(weeklyProgress).toContain('doneThisWeek');
    expect(weeklyProgress).toContain('weekTotal');
    expect(weeklyProgress).toContain("dashboard.tasksDoneWeek");
  });

  it('has a progress bar', () => {
    expect(weeklyProgress).toContain('progressTrack');
    expect(weeklyProgress).toContain('progressFill');
  });

  it('returns null when no tasks', () => {
    expect(weeklyProgress).toContain('if (weekTotal <= 0) return null');
  });
});

// ═══════════════════════════════════════════════════════════
//  6. Old cluttered sections removed from main page
// ═══════════════════════════════════════════════════════════
describe('Farmer home — clutter removed', () => {
  it('does not import WeeklySummaryCard', () => {
    expect(dashboard).not.toContain("import WeeklySummaryCard");
  });

  it('does not import FarmSummaryCard', () => {
    expect(dashboard).not.toContain("import FarmSummaryCard");
  });

  it('does not import NextActionCard', () => {
    expect(dashboard).not.toContain("import NextActionCard");
  });

  it('does not import GuidedFarmingCard', () => {
    expect(dashboard).not.toContain("import GuidedFarmingCard");
  });

  it('does not import FarmReadinessCard', () => {
    expect(dashboard).not.toContain("import FarmReadinessCard");
  });

  it('does not import FarmSnapshotCard', () => {
    expect(dashboard).not.toContain("import FarmSnapshotCard");
  });

  it('does not import PrimaryFarmActionCard', () => {
    expect(dashboard).not.toContain("import PrimaryFarmActionCard");
  });

  it('does not render isOperationsMode reordering', () => {
    expect(dashboard).not.toContain('isOperationsMode');
  });

  it('no edit-farm button on the main page', () => {
    // Edit modal exists but is not triggered from a visible button
    expect(dashboard).not.toMatch(/showEditModal\s*&&\s*!profile/);
  });
});

// ═══════════════════════════════════════════════════════════
//  7. Fallback states when no tasks exist
// ═══════════════════════════════════════════════════════════
describe('Farmer home — task fallback states', () => {
  it('shows "Finish your farm setup" when setup incomplete', () => {
    expect(todayTask).toContain("dashboard.finishSetup");
    expect(todayTask).toContain('data-testid="finish-setup-btn"');
  });

  it('shows "Set your crop stage" when no stage set', () => {
    expect(todayTask).toContain("dashboard.setCropStage");
    expect(todayTask).toContain('data-testid="set-stage-btn"');
  });

  it('shows "All tasks done! Add update" when all done', () => {
    expect(todayTask).toContain("dashboard.allDoneAddUpdate");
    expect(todayTask).toContain('data-testid="add-update-fallback-btn"');
  });

  it('fallback CTAs route to the right action', () => {
    // setup fallback calls onGoToSetup
    expect(todayTask).toContain('onGoToSetup');
    // stage fallback calls onSetStage
    expect(todayTask).toContain('onSetStage');
    // all-done fallback calls onAddUpdate
    expect(todayTask).toContain('onAddUpdate');
  });
});

// ═══════════════════════════════════════════════════════════
//  8. Mobile layout is clean
// ═══════════════════════════════════════════════════════════
describe('Farmer home — mobile UX', () => {
  it('CTA button has min touch height (52px)', () => {
    expect(todayTask).toMatch(/minHeight:\s*['"]52px['"]/);
  });

  it('quick action tiles have min touch height (80px)', () => {
    expect(quickActions).toMatch(/minHeight:\s*['"]80px['"]/);
  });

  it('no dropdown-heavy interactions on home', () => {
    expect(dashboard).not.toMatch(/<select/);
    expect(todayTask).not.toMatch(/<select/);
    expect(quickActions).not.toMatch(/<select/);
  });

  it('no paragraph longer than 2 lines (descriptions are short)', () => {
    // TodayTaskCard desc is a single div, not multi-paragraph
    expect(todayTask).not.toMatch(/<p[^>]*>[^<]{200,}/);
  });
});

// ═══════════════════════════════════════════════════════════
//  9. Component structure matches spec
// ═══════════════════════════════════════════════════════════
describe('Farmer home — component structure', () => {
  it('FarmerHeader exists and exports default', () => {
    expect(farmerHeader).toContain('export default function FarmerHeader');
  });

  it('TodayTaskCard exists and exports default', () => {
    expect(todayTask).toContain('export default function TodayTaskCard');
  });

  it('WeatherStatusCard exists and exports default', () => {
    expect(weatherCard).toContain('export default function WeatherStatusCard');
  });

  it('QuickActionsRow exists and exports default', () => {
    expect(quickActions).toContain('export default function QuickActionsRow');
  });

  it('WeeklyProgressCard exists and exports default', () => {
    expect(weeklyProgress).toContain('export default function WeeklyProgressCard');
  });

  it('Dashboard imports all 5 sub-components', () => {
    expect(dashboard).toContain("import FarmerHeader from");
    expect(dashboard).toContain("import TodayTaskCard from");
    expect(dashboard).toContain("import WeatherStatusCard from");
    expect(dashboard).toContain("import QuickActionsRow from");
    expect(dashboard).toContain("import WeeklyProgressCard from");
  });

  it('FarmerHeader shows name + location + crop', () => {
    expect(farmerHeader).toContain('user?.fullName');
    expect(farmerHeader).toContain('locationName');
    expect(farmerHeader).toContain('cropDisplay');
  });
});

// ═══════════════════════════════════════════════════════════
//  10. i18n keys exist for all farmer-visible text
// ═══════════════════════════════════════════════════════════
describe('Farmer home — i18n translations', () => {
  const requiredKeys = [
    'dashboard.todaysTask',
    'dashboard.doThisNow',
    'dashboard.todayOnFarm',
    'dashboard.addUpdate',
    'dashboard.myFarm',
    'dashboard.tasks',
    'dashboard.thisWeek',
    'dashboard.of',
    'dashboard.tasksDoneWeek',
    'dashboard.weatherUnknown',
    'dashboard.finishSetup',
    'dashboard.setCropStage',
    'dashboard.allDoneAddUpdate',
  ];

  for (const key of requiredKeys) {
    it(`has translation key: ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('all dashboard keys have all 5 languages', () => {
    for (const key of requiredKeys) {
      const idx = translations.indexOf(`'${key}'`);
      // Get the next ~300 chars after the key to check languages
      const snippet = translations.slice(idx, idx + 300);
      expect(snippet).toContain('en:');
      expect(snippet).toContain('fr:');
      expect(snippet).toContain('sw:');
      expect(snippet).toContain('ha:');
      expect(snippet).toContain('tw:');
    }
  });
});
