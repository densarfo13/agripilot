import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ─── 1. farmScore — GPS optional, threshold 75 ──────────────────

describe('farmScore — pilot-readiness fixes', () => {
  const code = readFile('src/lib/farmScore.js');

  it('threshold is 75 (not 85)', () => {
    expect(code).toContain('rounded >= 75');
  });

  it('GPS fields are optional bonus (not required for Ready)', () => {
    expect(code).toContain('GPS is optional bonus');
  });

  it('required fields total enough for Ready without GPS', () => {
    expect(code).toContain('Required fields');
    expect(code).toContain('enough for "Ready" without GPS');
  });
});

// ─── 2. Translation completeness — setup.* keys ─────────────────

describe('Translations — setup.* keys', () => {
  const translations = readFile('src/i18n/translations.js');

  const setupKeys = [
    'setup.loading', 'setup.title', 'setup.subtitle', 'setup.voiceWelcome',
    'setup.readAloud', 'setup.completed', 'setup.yourName', 'setup.farmName',
    'setup.country', 'setup.village', 'setup.farmSize', 'setup.mainCrop',
    'setup.selectCrop', 'setup.exactLocation', 'setup.gpsDesc', 'setup.gettingGPS',
    'setup.getLocation', 'setup.latitude', 'setup.longitude', 'setup.gpsHint',
    'setup.gpsNotSupported', 'setup.gpsSlow', 'setup.gpsFailed',
    'setup.gpsPermissionDenied', 'setup.gpsSignalWeak', 'setup.gpsTimeout',
    'setup.saveTimeout', 'setup.saveFailed', 'setup.savedOffline',
    'setup.savedSuccess', 'setup.syncRetry', 'setup.saving', 'setup.saveFarm',
  ];

  for (const key of setupKeys) {
    it(`has key '${key}'`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('setup.title has all 5 languages', () => {
    const block = translations.substring(
      translations.indexOf("'setup.title'"),
      translations.indexOf("'setup.title'") + 200,
    );
    expect(block).toContain('en:');
    expect(block).toContain('fr:');
    expect(block).toContain('sw:');
    expect(block).toContain('ha:');
    expect(block).toContain('tw:');
  });
});

// ─── 3. Translation completeness — auth.* keys ──────────────────

describe('Translations — auth.* keys', () => {
  const translations = readFile('src/i18n/translations.js');

  const authKeys = [
    'auth.welcomeBack', 'auth.signInPrompt', 'auth.email', 'auth.password',
    'auth.emailRequired', 'auth.passwordRequired', 'auth.loginFailed',
    'auth.forgotPassword', 'auth.signIn', 'auth.signingIn',
    'auth.noAccount', 'auth.createOne',
  ];

  for (const key of authKeys) {
    it(`has key '${key}'`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }
});

// ─── 4. Translation completeness — dashboard/component keys ─────

describe('Translations — dashboard + component keys', () => {
  const translations = readFile('src/i18n/translations.js');

  const keys = [
    'dashboard.loading', 'dashboard.welcome', 'dashboard.hint',
    'dashboard.voiceGuide', 'dashboard.playGuidance',
    'dashboard.setupBanner', 'dashboard.setupBannerDesc', 'dashboard.completeSetup',
    'action.finishSetup', 'action.seasonActive', 'action.continueWork',
    'action.readyToStart', 'action.startSeason',
    'weather.title', 'weather.loading', 'weather.unavailable',
    'weather.addGps', 'weather.rainLikely', 'weather.safeActivity',
    'readiness.good', 'readiness.goodDesc', 'readiness.incomplete', 'readiness.progress',
    'recommend.title', 'recommend.addGps', 'recommend.allGood',
    'farm.myFarm', 'farm.edit', 'farm.crop', 'farm.size', 'farm.location',
    'farm.gps', 'farm.gpsAdded', 'farm.gpsNotAdded',
    'support.title', 'support.desc', 'support.sent', 'support.failed',
    'support.subject', 'support.describe', 'support.sending', 'support.sendRequest',
    'tasks.title', 'tasks.loading', 'tasks.setupFirst', 'tasks.startSeason',
    'tasks.pending', 'tasks.noTasks', 'tasks.due', 'tasks.markDone', 'tasks.completed',
    'farmerId.notAssigned', 'farmerId.copied',
  ];

  for (const key of keys) {
    it(`has key '${key}'`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }
});

// ─── 5. Dashboard — wired to t() ────────────────────────────────

describe('Dashboard — localization wiring', () => {
  const dashboard = readFile('src/pages/Dashboard.jsx');

  it('imports useTranslation', () => {
    expect(dashboard).toContain("useTranslation");
  });

  it('uses t() for loading text', () => {
    expect(dashboard).toContain("t('dashboard.loading')");
  });

  it('uses t() for welcome', () => {
    expect(dashboard).toContain("t('dashboard.welcome')");
  });

  it('uses t() for hint', () => {
    expect(dashboard).toContain("t('dashboard.hint')");
  });

  it('uses t() for setup banner', () => {
    expect(dashboard).toContain("t('dashboard.setupBanner')");
    expect(dashboard).toContain("t('dashboard.completeSetup')");
  });

  it('no hardcoded English "Welcome" in h1', () => {
    expect(dashboard).not.toMatch(/>\s*Welcome\s*\{/);
  });
});

// ─── 6. Farmer-facing components — wired to t() ─────────────────

describe('Components — localization wiring', () => {
  it('PrimaryFarmActionCard uses t()', () => {
    const code = readFile('src/components/PrimaryFarmActionCard.jsx');
    expect(code).toContain("t('action.finishSetup')");
    expect(code).toContain("t('action.seasonActive')");
    expect(code).toContain("t('action.startSeason')");
  });

  it('WeatherDecisionCard uses t()', () => {
    const code = readFile('src/components/WeatherDecisionCard.jsx');
    expect(code).toContain("t('weather.title')");
    expect(code).toContain("t('weather.loading')");
    expect(code).toContain("t(decisionKey)");
  });

  it('FarmReadinessCard uses t()', () => {
    const code = readFile('src/components/FarmReadinessCard.jsx');
    expect(code).toContain("t('readiness.good')");
    expect(code).toContain("t('readiness.incomplete')");
    expect(code).toContain("t('dashboard.completeSetup')");
  });

  it('ActionRecommendationsCard uses t()', () => {
    const code = readFile('src/components/ActionRecommendationsCard.jsx');
    expect(code).toContain("t('recommend.title')");
    expect(code).toContain("'recommend.addGps'");
  });

  it('FarmSnapshotCard uses t()', () => {
    const code = readFile('src/components/FarmSnapshotCard.jsx');
    expect(code).toContain("t('farm.myFarm')");
    expect(code).toContain("t('farm.edit')");
    expect(code).toContain("t('farm.location')");
  });

  it('SupportCard uses t()', () => {
    const code = readFile('src/components/SupportCard.jsx');
    expect(code).toContain("t('support.title')");
    expect(code).toContain("t('support.sendRequest')");
  });

  it('SeasonTasksCard uses t()', () => {
    const code = readFile('src/components/SeasonTasksCard.jsx');
    expect(code).toContain("t('tasks.title')");
    expect(code).toContain("t('tasks.markDone')");
    expect(code).toContain("t('tasks.completed')");
  });

  it('FarmerIdCard uses t()', () => {
    const code = readFile('src/components/FarmerIdCard.jsx');
    expect(code).toContain("t('farmerId.notAssigned')");
    expect(code).toContain("t('farmerId.copied')");
  });
});

// ─── 7. Supply readiness — admin list includes connected ────────

describe('Supply readiness — list/export consistency', () => {
  const route = readFile('server/routes/supply-readiness.js');

  it('admin list includes both active and connected status', () => {
    // Find the admin/list handler section
    const listIdx = route.indexOf("router.get('/admin/list'");
    const exportIdx = route.indexOf("router.get('/admin/export.csv'");
    const listSection = route.substring(listIdx, exportIdx);
    expect(listSection).toContain("in: ['active', 'connected']");
  });

  it('admin export includes both active and connected status', () => {
    const exportIdx = route.indexOf("router.get('/admin/export.csv'");
    const exportSection = route.substring(exportIdx);
    expect(exportSection).toContain("in: ['active', 'connected']");
  });
});

// ─── 8. Instrumentation — tracking events ───────────────────────

describe('Proof-readiness instrumentation', () => {
  it('Login tracks success and failure', () => {
    const login = readFile('src/pages/Login.jsx');
    expect(login).toContain("safeTrackEvent('auth.login.success'");
    expect(login).toContain("safeTrackEvent('auth.login.failed'");
  });

  it('PrimaryFarmActionCard tracks season start/failure', () => {
    const card = readFile('src/components/PrimaryFarmActionCard.jsx');
    expect(card).toContain("safeTrackEvent('season.started'");
    expect(card).toContain("safeTrackEvent('season.start_failed'");
  });

  it('Dashboard tracks view', () => {
    const dashboard = readFile('src/pages/Dashboard.jsx');
    expect(dashboard).toContain("safeTrackEvent('dashboard.viewed'");
  });

  it('ProfileSetup tracks GPS and save events', () => {
    const setup = readFile('src/pages/ProfileSetup.jsx');
    expect(setup).toContain("safeTrackEvent('gps.");
    expect(setup).toContain("safeTrackEvent('profile.");
  });

  it('SellReadinessInput tracks save and skip', () => {
    const sell = readFile('src/components/SellReadinessInput.jsx');
    expect(sell).toContain("safeTrackEvent('supply_readiness.saved'");
    expect(sell).toContain("safeTrackEvent('supply_readiness.skipped'");
  });
});

// ─── 9. ProfileSetup — localized ────────────────────────────────

describe('ProfileSetup — localization', () => {
  const setup = readFile('src/pages/ProfileSetup.jsx');

  it('imports useTranslation from i18n', () => {
    expect(setup).toContain("useTranslation");
  });

  it('uses t() for title', () => {
    expect(setup).toContain("t('setup.title')");
  });

  it('uses t() for GPS messages', () => {
    expect(setup).toContain("t('setup.gpsNotSupported')");
    expect(setup).toContain("t('setup.gpsFailed')");
    expect(setup).toContain("t('setup.gpsPermissionDenied')");
  });

  it('uses t() for save states', () => {
    expect(setup).toContain("t('setup.savedOffline')");
    expect(setup).toContain("t('setup.savedSuccess')");
    expect(setup).toContain("t('setup.saveFailed')");
  });
});

// ─── 10. Login — localized ──────────────────────────────────────

describe('Login — localization', () => {
  const login = readFile('src/pages/Login.jsx');

  it('imports useTranslation', () => {
    expect(login).toContain("useTranslation");
  });

  it('uses t() for all visible strings', () => {
    expect(login).toContain("t('auth.welcomeBack')");
    expect(login).toContain("t('auth.signIn')");
    expect(login).toContain("t('auth.email')");
    expect(login).toContain("t('auth.password')");
  });
});
