import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ─── Action-First Farmer Home Screen ────────────────────

describe('Action-First Home Screen — Layout Structure', () => {
  const code = readFile('src/pages/FarmerDashboardPage.jsx');

  it('imports getCropIcon for crop status hero', () => {
    expect(code).toContain("getCropIcon");
    expect(code).toContain("from '../utils/crops.js'");
  });

  it('has crop status hero section', () => {
    expect(code).toContain('crop-status-hero');
    expect(code).toContain('heroCropIcon');
    expect(code).toContain('heroCropName');
    expect(code).toContain('heroBadge');
  });

  it('hero shows weather at a glance', () => {
    expect(code).toContain('heroWeather');
    expect(code).toContain('heroTemp');
    expect(code).toContain('heroRain');
  });

  it('has primary action section with large button', () => {
    expect(code).toContain('primary-action-section');
    expect(code).toContain('primary-action-btn');
    expect(code).toContain('primaryActionBtn');
  });

  it('primary action button has 56px+ minHeight and gradient', () => {
    expect(code).toContain("minHeight: '56px'");
    expect(code).toContain('linear-gradient');
  });

  it('primary action button has tap-safe styling', () => {
    expect(code).toContain("WebkitTapHighlightColor: 'transparent'");
  });

  it('has next-step text below primary action', () => {
    expect(code).toContain('next-step-text');
    expect(code).toContain('nextStepText');
  });

  it('has progress section with ring SVG', () => {
    expect(code).toContain('progress-section');
    expect(code).toContain('progress-ring');
    expect(code).toContain('<svg');
    expect(code).toContain('strokeDasharray');
  });

  it('progress ring maps lifecycle stages to percentages', () => {
    expect(code).toContain('stageProgress');
    expect(code).toContain('land_preparation');
    expect(code).toContain('planting');
    expect(code).toContain('flowering');
    expect(code).toContain('harvest');
  });

  it('has last activity display', () => {
    expect(code).toContain('last-activity');
    expect(code).toContain('lastActivityIcon');
    expect(code).toContain("t('home.lastUpdate')");
  });

  it('last activity shows relative time (Today/Yesterday/N days ago)', () => {
    expect(code).toContain("t('home.today')");
    expect(code).toContain("t('home.yesterday')");
    expect(code).toContain("t('home.daysAgo')");
  });

  it('shows overdue badge when stale', () => {
    expect(code).toContain('staleBadge');
    expect(code).toContain("t('home.overdue')");
  });

  it('has no-season nudge card', () => {
    expect(code).toContain('no-season-nudge');
    expect(code).toContain("t('home.noActiveSeason')");
  });

  it('has help floating action button', () => {
    expect(code).toContain('help-button');
    expect(code).toContain('helpFab');
    expect(code).toContain("aria-label=\"Get help\"");
  });
});

describe('Action-First Home Screen — Next Step Logic', () => {
  const code = readFile('src/pages/FarmerDashboardPage.jsx');

  it('prioritizes API-derived tasks (REPORT_HARVEST, START_SEASON)', () => {
    expect(code).toContain("nextTask?.taskType === 'REPORT_HARVEST'");
    expect(code).toContain("nextTask?.taskType === 'START_SEASON'");
  });

  it('falls back through season state hierarchy', () => {
    // no active season → harvest stage → overdue → default
    expect(code).toContain('!hasActiveSeason');
    expect(code).toContain('isHarvestStage');
    expect(code).toContain('updateOverdue');
  });

  it('uses lifecycle recommendations as final fallback', () => {
    expect(code).toContain('lifecycle?.recommendations?.[0]');
  });

  it('button labels match actions: Start Season / Report Harvest / Add Update', () => {
    expect(code).toContain("btnLabel = t('home.startSeason')");
    expect(code).toContain("btnLabel = t('home.reportHarvest')");
    expect(code).toContain("btnLabel = t('home.addUpdate')");
  });
});

describe('Action-First Home Screen — Compact Secondary Cards', () => {
  const code = readFile('src/pages/FarmerDashboardPage.jsx');

  it('weather insight shows top recommendation inline', () => {
    expect(code).toContain('weather-insight');
    expect(code).toContain('weatherInsightCard');
    expect(code).toContain('weatherRecs.recommendations[0].title');
  });

  it('farm score is shown in compact form', () => {
    expect(code).toContain('farm-score-compact');
    expect(code).toContain('scoreCircleSmall');
    expect(code).toContain("t('home.farmScore')");
  });
});

describe('Action-First Home Screen — Expandable Sections', () => {
  const code = readFile('src/pages/FarmerDashboardPage.jsx');

  it('has ExpandableSection component with open/close toggle', () => {
    expect(code).toContain('function ExpandableSection');
    expect(code).toContain('aria-expanded');
    expect(code).toContain("setOpen(o => !o)");
  });

  it('expandable sections use 48px+ minHeight headers', () => {
    expect(code).toContain("minHeight: '48px'");
  });

  it('has all secondary sections as expandable', () => {
    expect(code).toContain('details-section');
    expect(code).toContain('recommendations-section');
    expect(code).toContain('weather-section');
    expect(code).toContain('referral-section');
    expect(code).toContain('applications-section');
    expect(code).toContain('notifications-section');
  });

  it('My Farm Details section includes farm profile and seasons', () => {
    const detailsIdx = code.indexOf('details-section');
    const chunk = code.slice(detailsIdx, detailsIdx + 1500);
    expect(chunk).toContain('farmProfile.farmName');
    expect(chunk).toContain('farmProfile.locationName');
    expect(chunk).toContain('farmProfile.stage');
  });

  it('Recommendations section preserves Done/Skip/Note actions', () => {
    const recsIdx = code.indexOf('recommendations-section');
    const chunk = code.slice(recsIdx, recsIdx + 2000);
    expect(chunk).toContain('handleRecAction');
    expect(chunk).toContain("'completed'");
    expect(chunk).toContain("'skipped'");
  });

  it('Referral section preserves copy and share tracking', () => {
    const refIdx = code.indexOf('referral-section');
    const chunk = code.slice(refIdx, refIdx + 1000);
    expect(chunk).toContain('clipboard');
    expect(chunk).toContain("'referral_shared'");
  });
});

describe('Action-First Home Screen — Mobile UX', () => {
  const code = readFile('src/pages/FarmerDashboardPage.jsx');

  it('primary action button is full-width (width 100%)', () => {
    expect(code).toContain("width: '100%'");
  });

  it('help FAB is fixed position bottom-right', () => {
    expect(code).toContain("position: 'fixed'");
    expect(code).toContain("bottom: '1.25rem'");
    expect(code).toContain("right: '1.25rem'");
  });

  it('help FAB is 52px tap target', () => {
    expect(code).toContain("width: '52px'");
    expect(code).toContain("height: '52px'");
  });

  it('all tap targets have WebkitTapHighlightColor transparent', () => {
    // Primary action btn + expand headers + help FAB
    const matches = (code.match(/WebkitTapHighlightColor:\s*'transparent'/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(3);
  });

  it('expand headers have minHeight 48px for touch', () => {
    const headerIdx = code.indexOf('expandHeader:');
    const chunk = code.slice(headerIdx, headerIdx + 300);
    expect(chunk).toContain("minHeight: '48px'");
  });

  it('referral copy button has 44px minHeight', () => {
    const refIdx = code.indexOf('referral-section');
    const chunk = code.slice(refIdx, refIdx + 800);
    expect(chunk).toContain("minHeight: '44px'");
  });
});

describe('Action-First Home Screen — Visual Hierarchy', () => {
  const code = readFile('src/pages/FarmerDashboardPage.jsx');

  it('hero card comes before primary action in approved state', () => {
    const heroIdx = code.indexOf('crop-status-hero');
    const actionIdx = code.indexOf('primary-action-section');
    const progressIdx = code.indexOf('progress-section');
    expect(heroIdx).toBeLessThan(actionIdx);
    expect(actionIdx).toBeLessThan(progressIdx);
  });

  it('compact cards come before expandable sections', () => {
    const scoreIdx = code.indexOf('farm-score-compact');
    const expandIdx = code.indexOf('details-section');
    expect(scoreIdx).toBeLessThan(expandIdx);
  });

  it('expandable sections come after primary content', () => {
    const actionIdx = code.indexOf('primary-action-btn');
    const detailsIdx = code.indexOf('details-section');
    const recsIdx = code.indexOf('recommendations-section');
    expect(detailsIdx).toBeGreaterThan(actionIdx);
    expect(recsIdx).toBeGreaterThan(actionIdx);
  });

  it('progress ring shows percentage text', () => {
    expect(code).toContain('progressPct}%');
  });
});

describe('Action-First Home Screen — Data Integrity', () => {
  const code = readFile('src/pages/FarmerDashboardPage.jsx');

  it('preserves all existing API calls', () => {
    expect(code).toContain('/auth/farmer-profile');
    expect(code).toContain('fetchProfiles');
    expect(code).toContain('fetchRecommendations');
    expect(code).toContain('fetchWeather');
    expect(code).toContain('fetchWeatherRecs');
    expect(code).toContain('fetchFinanceScore');
    expect(code).toContain('fetchReferral');
    expect(code).toContain('/lifecycle/farmers/');
    expect(code).toContain('/seasons/farmer/');
    expect(code).toContain('/tasks');
  });

  it('preserves onboarding flow', () => {
    expect(code).toContain('showOnboarding');
    expect(code).toContain('OnboardingWizard');
    expect(code).toContain('handleOnboardingComplete');
    expect(code).toContain('onboardingError');
  });

  it('preserves pilot event tracking', () => {
    expect(code).toContain('trackPilotEvent');
    expect(code).toContain("'onboarding_completed'");
    expect(code).toContain('dashboard_viewed');
  });

  it('preserves pending/rejected status views', () => {
    expect(code).toContain("t('home.pendingApproval')");
    expect(code).toContain("t('home.registrationDeclined')");
    expect(code).toContain('isPending');
    expect(code).toContain('isRejected');
  });

  it('preserves profileError handling', () => {
    expect(code).toContain('profileError');
    expect(code).toContain('Could not load your profile');
  });
});
