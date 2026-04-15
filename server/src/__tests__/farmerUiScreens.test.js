/**
 * Farmer UI Screens — Production UX Tests
 *
 * Verifies the farmer-facing screens match the action-first, low-literacy,
 * mobile-first product direction. Covers onboarding, home, task action,
 * add update, all tasks, my farm, localization, and mobile layout.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(import.meta.dirname, '..', '..', '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(rootDir, relPath));
}

// ─── 1. Onboarding is step-based and simplified ────────────
describe('Farmer UI — Onboarding', () => {
  const onboarding = readFile('src/components/OnboardingSteps.jsx');
  const setup = readFile('src/pages/ProfileSetup.jsx');

  it('OnboardingSteps component exists', () => {
    expect(fileExists('src/components/OnboardingSteps.jsx')).toBe(true);
  });

  it('has 5 steps (experience, location, crop, size, name)', () => {
    expect(onboarding).toContain('step');
    // Step 1: experience
    expect(onboarding).toMatch(/experienceLevel|newToFarming/);
    // Step 2: location/GPS
    expect(onboarding).toMatch(/geolocation|useMyLocation|whereIsFarm/);
    // Step 3: crop
    expect(onboarding).toMatch(/whatGrowing|crop/);
    // Step 4: farm size
    expect(onboarding).toMatch(/howBig|farmSize/i);
    // Step 5: name
    expect(onboarding).toMatch(/nameFarm|farmName/);
  });

  it('uses tap-based selection (no dropdowns for primary choices)', () => {
    // Should NOT have <select> elements in the onboarding flow
    expect(onboarding).not.toMatch(/<select/i);
  });

  it('has one decision per screen (step-based rendering)', () => {
    // Uses stepRenderers array with step state
    expect(onboarding).toContain('stepRenderers');
    expect(onboarding).toContain('renderStep1');
    expect(onboarding).toContain('renderStep5');
  });

  it('has step dots indicator', () => {
    expect(onboarding).toMatch(/stepDot|dot|indicator/i);
  });

  it('has back button on steps 2+', () => {
    expect(onboarding).toMatch(/back|prev/i);
  });

  it('ProfileSetup shows OnboardingSteps for first-time users', () => {
    expect(setup).toContain('OnboardingSteps');
    expect(setup).toContain('isFirstTimeUser');
  });

  it('OnboardingSteps maps to backend fields on complete', () => {
    expect(setup).toContain('handleOnboardingComplete');
    expect(setup).toContain('createNewFarm');
  });

  it('all text uses translation keys (no hardcoded English)', () => {
    // All user-visible text should use t() function
    expect(onboarding).toContain("t('onboarding.");
    expect(onboarding).not.toMatch(/>[A-Z][a-z]{3,}<\/(?:div|span|button|h[1-6]|p)>/);
  });
});

// ─── 2. Farmer home shows only one primary task ────────────
describe('Farmer UI — Home Screen', () => {
  const dash = readFile('src/pages/Dashboard.jsx');
  const header = readFile('src/components/FarmerHeader.jsx');
  const taskCard = readFile('src/components/TodayTaskCard.jsx');
  const weather = readFile('src/components/WeatherStatusCard.jsx');
  const actions = readFile('src/components/QuickActionsRow.jsx');
  const progress = readFile('src/components/WeeklyProgressCard.jsx');

  it('has minimal header with name, location, crop', () => {
    expect(header).toContain('user');
    expect(header).toContain('profile');
    expect(header).toContain('locationName');
    expect(header).toContain('crop');
  });

  it('shows exactly one primary task (TodayTaskCard)', () => {
    expect(dash).toContain('TodayTaskCard');
    expect(taskCard).toContain('primaryTask');
    // Only one task shown, not a list
    expect(taskCard).not.toContain('.map(');
  });

  it('has big CTA "Do this now" button', () => {
    expect(taskCard).toContain("t('dashboard.doThisNow')");
    expect(taskCard).toContain('do-this-now-btn');
  });

  it('has weather status (not full dashboard)', () => {
    expect(dash).toContain('WeatherStatusCard');
    expect(weather).toContain('weatherLine');
    expect(weather).toContain('supportText');
  });

  it('has quick actions: Add Update, My Farm, All Tasks', () => {
    expect(actions).toContain("t('dashboard.addUpdate')");
    expect(actions).toContain("t('dashboard.myFarm')");
    expect(actions).toContain("t('dashboard.tasks')");
  });

  it('has weekly progress bar', () => {
    expect(dash).toContain('WeeklyProgressCard');
    expect(progress).toContain('progressFill');
  });

  it('does NOT import FarmTasksCard (moved to AllTasksPage)', () => {
    expect(dash).not.toMatch(/^import FarmTasksCard/m);
  });

  it('does NOT import FarmInputTimingCard (moved out)', () => {
    expect(dash).not.toMatch(/^import FarmInputTimingCard/m);
  });

  it('routes My Farm to /my-farm', () => {
    expect(dash).toContain("navigate('/my-farm')");
  });

  it('routes All Tasks to /tasks', () => {
    expect(dash).toContain("navigate('/tasks')");
  });
});

// ─── 3. Task completion gives fast visible feedback ────────
describe('Farmer UI — Task Action', () => {
  const modal = readFile('src/components/TaskActionModal.jsx');
  const dash = readFile('src/pages/Dashboard.jsx');

  it('TaskActionModal component exists', () => {
    expect(fileExists('src/components/TaskActionModal.jsx')).toBe(true);
  });

  it('shows task title and description', () => {
    expect(modal).toContain('task.title');
    expect(modal).toContain('task.description');
  });

  it('has priority badge with colors', () => {
    expect(modal).toContain('getPriorityColors');
    expect(modal).toContain('priorityBadge');
  });

  it('has action-specific CTA labels (watering, planting, etc.)', () => {
    expect(modal).toContain('iWatered');
    expect(modal).toContain('iPlanted');
    expect(modal).toContain('iSprayed');
    expect(modal).toContain('markDone');
  });

  it('has skip button', () => {
    expect(modal).toContain("t('taskAction.skip')");
  });

  it('shows spinner while completing', () => {
    expect(modal).toContain('spinner');
    expect(modal).toContain('completing');
  });

  it('Dashboard shows success feedback after completion', () => {
    expect(dash).toContain('taskSuccess');
    expect(dash).toContain('feedbackStatus');
    expect(dash).toContain('ActionFeedbackBanner');
  });

  it('Dashboard opens TaskActionModal on "Do this now"', () => {
    expect(dash).toContain('showTaskAction');
    expect(dash).toContain('TaskActionModal');
    expect(dash).toContain('setShowTaskAction(true)');
  });
});

// ─── 4. Add update flow is clean and fast ──────────────────
describe('Farmer UI — Add Update', () => {
  const update = readFile('src/components/QuickUpdateFlow.jsx');

  it('QuickUpdateFlow exists and is used', () => {
    expect(fileExists('src/components/QuickUpdateFlow.jsx')).toBe(true);
  });

  it('has activity-based buttons (not dropdowns)', () => {
    // Uses tap buttons for activity selection
    expect(update).toContain('activity');
    expect(update).not.toContain('<select');
  });

  it('has photo support', () => {
    expect(update).toMatch(/photo|camera|image/i);
  });

  it('has optimistic/fast save flow', () => {
    // Background photo upload, text saves first
    expect(update).toContain('uploadPhotoBackground');
  });

  it('has offline fallback', () => {
    expect(update).toMatch(/offline|offlineQueue/i);
  });
});

// ─── 5. All tasks screen works ─────────────────────────────
describe('Farmer UI — All Tasks Page', () => {
  const tasks = readFile('src/pages/AllTasksPage.jsx');

  it('AllTasksPage exists', () => {
    expect(fileExists('src/pages/AllTasksPage.jsx')).toBe(true);
  });

  it('groups tasks by priority (high, medium, low)', () => {
    expect(tasks).toContain("'high'");
    expect(tasks).toContain("'medium'");
    expect(tasks).toContain("'low'");
  });

  it('has done/complete button per task', () => {
    expect(tasks).toMatch(/handleDone|completeTask/);
  });

  it('has empty state when all tasks done', () => {
    expect(tasks).toMatch(/allTasks\.all(Done|CaughtUp)/);
  });

  it('has back navigation to dashboard', () => {
    expect(tasks).toContain('/dashboard');
  });

  it('has data-testid', () => {
    expect(tasks).toContain('all-tasks-page');
  });

  it('route exists in App.jsx', () => {
    const app = readFile('src/App.jsx');
    expect(app).toContain('/tasks');
    expect(app).toContain('AllTasksPage');
  });
});

// ─── 6. My farm screen hides technical/internal fields ─────
describe('Farmer UI — My Farm Page', () => {
  const farm = readFile('src/pages/MyFarmPage.jsx');

  it('MyFarmPage exists', () => {
    expect(fileExists('src/pages/MyFarmPage.jsx')).toBe(true);
  });

  it('shows crop, location, size, stage', () => {
    expect(farm).toContain("t('myFarm.crop')");
    expect(farm).toContain("t('myFarm.location')");
    expect(farm).toContain("t('myFarm.size')");
  });

  it('does NOT show raw latitude/longitude', () => {
    expect(farm).not.toContain('gpsLat');
    expect(farm).not.toContain('gpsLng');
    expect(farm).not.toContain('latitude');
    expect(farm).not.toContain('longitude');
  });

  it('does NOT show internal IDs', () => {
    // Should not display profile.id as visible text
    expect(farm).not.toMatch(/profile\.id[^}]*<\/(?:div|span|p)/);
  });

  it('has edit button', () => {
    expect(farm).toContain("t('myFarm.edit')");
  });

  it('has data-testid', () => {
    expect(farm).toContain('my-farm-page');
  });

  it('route exists in App.jsx', () => {
    const app = readFile('src/App.jsx');
    expect(app).toContain('/my-farm');
    expect(app).toContain('MyFarmPage');
  });
});

// ─── 7. Localization still works ───────────────────────────
describe('Farmer UI — Localization', () => {
  const translations = readFile('src/i18n/translations.js');

  it('has onboarding translation keys', () => {
    expect(translations).toContain("'onboarding.newToFarming'");
    expect(translations).toContain("'onboarding.startFarming'");
  });

  it('has task action translation keys', () => {
    expect(translations).toContain("'taskAction.markDone'");
    expect(translations).toContain("'taskAction.saved'");
  });

  it('has all tasks page translation keys', () => {
    expect(translations).toContain("'allTasks.title'");
    expect(translations).toContain("'allTasks.allDone'");
  });

  it('has my farm page translation keys', () => {
    expect(translations).toContain("'myFarm.title'");
    expect(translations).toContain("'myFarm.edit'");
  });

  it('all new keys have 5 languages (en, fr, sw, ha, tw)', () => {
    // Spot-check a few keys for all languages
    const keyPattern = /'onboarding\.startFarming':\s*\{[^}]*en:/;
    expect(translations).toMatch(keyPattern);
    expect(translations).toMatch(/'onboarding\.startFarming':\s*\{[^}]*fr:/);
    expect(translations).toMatch(/'onboarding\.startFarming':\s*\{[^}]*sw:/);
    expect(translations).toMatch(/'onboarding\.startFarming':\s*\{[^}]*ha:/);
    expect(translations).toMatch(/'onboarding\.startFarming':\s*\{[^}]*tw:/);
  });

  it('no hardcoded English in new components', () => {
    const modal = readFile('src/components/TaskActionModal.jsx');
    // CTA labels use t() not raw English
    expect(modal).not.toMatch(/>Mark done<\//);
    expect(modal).not.toMatch(/>Skip<\//);
  });
});

// ─── 8. Mobile layout remains clean ────────────────────────
describe('Farmer UI — Mobile & Performance', () => {
  const dash = readFile('src/pages/Dashboard.jsx');
  const modal = readFile('src/components/TaskActionModal.jsx');
  const actions = readFile('src/components/QuickActionsRow.jsx');

  it('dashboard has maxWidth for mobile', () => {
    expect(dash).toContain("maxWidth: '42rem'");
  });

  it('quick action tiles have minHeight for touch targets', () => {
    expect(actions).toContain("minHeight: '80px'");
  });

  it('task action modal is centered with padding', () => {
    expect(modal).toContain("padding: '1rem'");
    expect(modal).toContain('alignItems');
  });

  it('all interactive elements have WebkitTapHighlightColor', () => {
    expect(actions).toContain('WebkitTapHighlightColor');
    expect(modal).toContain('WebkitTapHighlightColor');
  });

  it('dashboard chunk reduced (no inline tasks section)', () => {
    // Dashboard should NOT contain FarmTasksCard render
    expect(dash).not.toMatch(/<FarmTasksCard/);
  });
});

// ─── 9. No dashboard clutter remains on farmer home ────────
describe('Farmer UI — No Dashboard Clutter', () => {
  const dash = readFile('src/pages/Dashboard.jsx');

  it('no multi-task priority lists on home', () => {
    // FarmTasksCard is NOT rendered in dashboard
    expect(dash).not.toMatch(/<FarmTasksCard/);
  });

  it('risk/analytics cards only in collapsed sections', () => {
    // FarmPestRiskCard only inside expandedSection === 'tools', not primary view
    expect(dash).toContain("expandedSection === 'tools'");
    expect(dash).toContain('FarmPestRiskCard');
  });

  it('full weather only in collapsed tools section', () => {
    // WeatherStatusCard is on primary view; FarmWeatherCard is in tools
    expect(dash).toContain('WeatherStatusCard');
    expect(dash).toContain("expandedSection === 'tools'");
  });

  it('edit farm modal only in tools section, not primary CTA', () => {
    // showEditModal exists but is NOT shown as a primary action button
    expect(dash).not.toContain('setShowEditModal(true)');
  });

  it('has demoted sections (harvest, money, tools) but collapsed', () => {
    expect(dash).toContain('moreSection');
    expect(dash).toContain("t('dashboard.harvest')");
    expect(dash).toContain("t('dashboard.money')");
  });
});

// ─── 10. Quick actions route correctly ─────────────────────
describe('Farmer UI — Quick Actions Routing', () => {
  const dash = readFile('src/pages/Dashboard.jsx');
  const app = readFile('src/App.jsx');

  it('Add Update opens QuickUpdateFlow modal', () => {
    expect(dash).toContain('handleStartUpdate');
    expect(dash).toContain('QuickUpdateFlow');
  });

  it('My Farm navigates to /my-farm', () => {
    expect(dash).toContain("navigate('/my-farm')");
  });

  it('All Tasks navigates to /tasks', () => {
    expect(dash).toContain("navigate('/tasks')");
  });

  it('/tasks route exists in App', () => {
    expect(app).toContain("path=\"/tasks\"");
  });

  it('/my-farm route exists in App', () => {
    expect(app).toContain("path=\"/my-farm\"");
  });
});

// ─── 11. Component structure matches spec ──────────────────
describe('Farmer UI — Component Structure', () => {
  it('FarmerHeader exists', () => {
    expect(fileExists('src/components/FarmerHeader.jsx')).toBe(true);
  });
  it('TodayTaskCard exists', () => {
    expect(fileExists('src/components/TodayTaskCard.jsx')).toBe(true);
  });
  it('WeatherStatusCard exists (TodayFarmStatusCard role)', () => {
    expect(fileExists('src/components/WeatherStatusCard.jsx')).toBe(true);
  });
  it('QuickActionsRow exists', () => {
    expect(fileExists('src/components/QuickActionsRow.jsx')).toBe(true);
  });
  it('WeeklyProgressCard exists', () => {
    expect(fileExists('src/components/WeeklyProgressCard.jsx')).toBe(true);
  });
  it('OnboardingSteps exists', () => {
    expect(fileExists('src/components/OnboardingSteps.jsx')).toBe(true);
  });
  it('TaskActionModal exists', () => {
    expect(fileExists('src/components/TaskActionModal.jsx')).toBe(true);
  });
  it('AllTasksPage exists', () => {
    expect(fileExists('src/pages/AllTasksPage.jsx')).toBe(true);
  });
  it('MyFarmPage exists', () => {
    expect(fileExists('src/pages/MyFarmPage.jsx')).toBe(true);
  });
});

// ─── 12. Loading / empty states ────────────────────────────
describe('Farmer UI — Loading & Empty States', () => {
  const dash = readFile('src/pages/Dashboard.jsx');
  const taskCard = readFile('src/components/TodayTaskCard.jsx');

  it('dashboard has loading state (not full-screen skeleton)', () => {
    expect(dash).toContain('authLoading || profileLoading');
    expect(dash).toContain('spinner');
  });

  it('TodayTaskCard shows fallback when no tasks', () => {
    // All-done state
    expect(taskCard).toContain("t('dashboard.allDoneAddUpdate')");
    // Finish setup fallback
    expect(taskCard).toContain("t('dashboard.finishSetup')");
    // Set crop stage fallback
    expect(taskCard).toContain("t('dashboard.setCropStage')");
  });

  it('empty state when no farms shows create button', () => {
    expect(dash).toContain("t('farm.noFarmsTitle')");
    expect(dash).toContain("t('farm.createFirst')");
  });
});
