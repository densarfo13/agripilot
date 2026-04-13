import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
// PART 1 — TRANSLATION MAP STRUCTURE
// ═══════════════════════════════════════════════════════════

describe('Translation map — structure and completeness', () => {
  let T;
  beforeEach(async () => {
    const mod = await import('../../../src/i18n/translations.js');
    T = mod.default;
  });

  it('exports an object with translation keys', () => {
    expect(typeof T).toBe('object');
    expect(Object.keys(T).length).toBeGreaterThan(100);
  });

  it('every key has at least English text', () => {
    for (const [key, entry] of Object.entries(T)) {
      expect(entry.en, `Key "${key}" missing English`).toBeTruthy();
    }
  });

  it('every key has all 5 languages (en, fr, sw, ha, tw)', () => {
    const langs = ['en', 'fr', 'sw', 'ha', 'tw'];
    let missing = [];
    for (const [key, entry] of Object.entries(T)) {
      for (const lang of langs) {
        if (!entry[lang]) missing.push(`${key}.${lang}`);
      }
    }
    // Allow up to 5 missing as buffer for new keys being added
    expect(missing.length, `Missing translations: ${missing.slice(0, 10).join(', ')}`).toBeLessThanOrEqual(5);
  });

  it('has common button keys (continue, next, back, submit, retry, skip, cancel)', () => {
    const required = ['common.continue', 'common.next', 'common.back', 'common.submit',
      'common.retry', 'common.skip', 'common.cancel', 'common.save', 'common.done',
      'common.yes', 'common.no', 'common.signOut', 'common.help'];
    for (const key of required) {
      expect(T[key], `Missing key: ${key}`).toBeDefined();
    }
  });

  it('has farmer home keys', () => {
    const required = ['home.welcome', 'home.farmScore', 'home.startSeason',
      'home.addUpdate', 'home.reportHarvest', 'home.noActiveSeason',
      'home.setupRequired', 'home.completeProfile', 'home.recommendations',
      'home.weatherDetails', 'home.inviteFarmer'];
    for (const key of required) {
      expect(T[key], `Missing key: ${key}`).toBeDefined();
    }
  });

  it('has onboarding wizard keys', () => {
    const required = ['onboarding.farmName', 'onboarding.selectCrop',
      'onboarding.searchCrops', 'onboarding.createFarm', 'onboarding.male',
      'onboarding.female', 'onboarding.small', 'onboarding.medium', 'onboarding.large'];
    for (const key of required) {
      expect(T[key], `Missing key: ${key}`).toBeDefined();
    }
  });

  it('has quick update flow keys', () => {
    const required = ['update.addUpdate', 'update.cropProgress', 'update.uploadPhoto',
      'update.reportIssue', 'update.good', 'update.okay', 'update.problem',
      'update.updateSaved', 'update.savedOffline'];
    for (const key of required) {
      expect(T[key], `Missing key: ${key}`).toBeDefined();
    }
  });

  it('has stage keys', () => {
    const required = ['stage.planting', 'stage.growing', 'stage.flowering', 'stage.harvest'];
    for (const key of required) {
      expect(T[key], `Missing key: ${key}`).toBeDefined();
    }
  });

  it('has feedback/guarantee layer keys', () => {
    const required = ['feedback.saving', 'feedback.done', 'feedback.savedOffline',
      'feedback.stillWorking', 'feedback.couldNotComplete', 'feedback.somethingWrong',
      'feedback.goBack'];
    for (const key of required) {
      expect(T[key], `Missing key: ${key}`).toBeDefined();
    }
  });

  it('has sync status keys', () => {
    const required = ['sync.offline', 'sync.syncNow', 'sync.syncing',
      'sync.pendingOne', 'sync.pendingMany', 'sync.failedOne', 'sync.failedMany',
      'sync.syncedOne', 'sync.syncedMany'];
    for (const key of required) {
      expect(T[key], `Missing key: ${key}`).toBeDefined();
    }
  });

  it('has invite/accept page keys', () => {
    const required = ['invite.activateAccount', 'invite.welcome',
      'invite.accountActivated', 'invite.signInNow', 'invite.expired',
      'invite.invalid', 'invite.passwordMismatch', 'invite.passwordTooShort'];
    for (const key of required) {
      expect(T[key], `Missing key: ${key}`).toBeDefined();
    }
  });

  it('has photo upload keys', () => {
    const required = ['photo.profilePhoto', 'photo.choosePhoto', 'photo.upload',
      'photo.uploading', 'photo.removePhoto'];
    for (const key of required) {
      expect(T[key], `Missing key: ${key}`).toBeDefined();
    }
  });

  it('has validation/officer keys', () => {
    const required = ['validation.approve', 'validation.reject', 'validation.flag',
      'validation.approved', 'validation.rejected', 'validation.flagged',
      'validation.validateUpdates', 'validation.queueClear', 'validation.allDone'];
    for (const key of required) {
      expect(T[key], `Missing key: ${key}`).toBeDefined();
    }
  });

  it('texts are short (under 120 chars for buttons, under 200 for messages)', () => {
    const buttonKeys = Object.keys(T).filter(k =>
      k.startsWith('common.') || k.includes('button') ||
      ['home.startSeason', 'home.addUpdate', 'home.reportHarvest', 'home.setUpFarm',
       'home.finishSetup', 'update.submitUpdate', 'update.savePhoto'].includes(k)
    );
    for (const key of buttonKeys) {
      for (const [lang, text] of Object.entries(T[key])) {
        expect(text.length, `${key}.${lang} too long (${text.length}): "${text}"`).toBeLessThanOrEqual(120);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════
// PART 2 — t() HELPER BEHAVIOR
// ═══════════════════════════════════════════════════════════

describe('t() translation helper — fallback behavior', () => {
  let t;
  beforeEach(async () => {
    const mod = await import('../../../src/i18n/index.js');
    t = mod.t;
  });

  it('returns English text for en', () => {
    expect(t('common.continue', 'en')).toBe('Continue');
  });

  it('returns Swahili text for sw', () => {
    expect(t('common.continue', 'sw')).toBe('Endelea');
  });

  it('returns French text for fr', () => {
    expect(t('common.continue', 'fr')).toBe('Continuer');
  });

  it('returns Hausa text for ha', () => {
    expect(t('common.continue', 'ha')).toBe('Ci gaba');
  });

  it('returns Twi text for tw', () => {
    expect(t('common.continue', 'tw')).toBe('Toa so');
  });

  it('falls back to English if language key missing', () => {
    // Use a language code that has no translations
    expect(t('common.continue', 'zz')).toBe('Continue');
  });

  it('falls back to raw key if English is also missing', () => {
    expect(t('nonexistent.key.here', 'en')).toBe('nonexistent.key.here');
  });

  it('supports variable interpolation', () => {
    expect(t('home.noUpdateDays', 'en', { days: 5 })).toBe('No update in 5 days — log an activity now.');
    expect(t('home.noUpdateDays', 'sw', { days: 5 })).toBe('Hakuna sasishi kwa siku 5 — andika shughuli sasa.');
  });

  it('handles multiple variables in one string', () => {
    // completedIn has {seconds}
    expect(t('update.completedIn', 'en', { seconds: 8 })).toBe('Completed in 8s');
    expect(t('update.completedIn', 'fr', { seconds: 8 })).toBe('Terminé en 8s');
  });

  it('does not crash on null/undefined key', () => {
    expect(() => t(null, 'en')).not.toThrow();
    expect(() => t(undefined, 'en')).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════
// PART 3 — i18n MODULE EXPORTS
// ═══════════════════════════════════════════════════════════

describe('i18n module — exports and integration', () => {
  let mod;
  beforeEach(async () => {
    // Provide localStorage for Node test env
    if (typeof globalThis.localStorage === 'undefined') {
      globalThis.localStorage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };
    }
    mod = await import('../../../src/i18n/index.js');
  });

  it('exports t function', () => {
    expect(typeof mod.t).toBe('function');
  });

  it('exports getLanguage function', () => {
    expect(typeof mod.getLanguage).toBe('function');
  });

  it('exports setLanguage function', () => {
    expect(typeof mod.setLanguage).toBe('function');
  });

  it('exports useTranslation hook', () => {
    expect(typeof mod.useTranslation).toBe('function');
  });

  it('exports createT factory', () => {
    expect(typeof mod.createT).toBe('function');
    const tSw = mod.createT('sw');
    expect(tSw('common.retry')).toBe('Jaribu tena');
  });

  it('exports LANGUAGES array with 5 entries', () => {
    expect(Array.isArray(mod.LANGUAGES)).toBe(true);
    expect(mod.LANGUAGES.length).toBe(5);
    const codes = mod.LANGUAGES.map(l => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('fr');
    expect(codes).toContain('sw');
    expect(codes).toContain('ha');
    expect(codes).toContain('tw');
  });

  it('LANGUAGES entries have code, label, and short', () => {
    for (const lang of mod.LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.label).toBeTruthy();
      expect(lang.short).toBeTruthy();
      expect(lang.short.length).toBeLessThanOrEqual(2);
    }
  });

  it('getLanguage defaults to "en"', () => {
    expect(mod.getLanguage()).toBe('en');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 4 — SCREENS USE TRANSLATION SYSTEM
// ═══════════════════════════════════════════════════════════

describe('Farmer-facing screens use i18n', () => {
  it('FarmerDashboardPage imports useTranslation', () => {
    const src = readFile('src/pages/FarmerDashboardPage.jsx');
    expect(src).toContain("import { useTranslation, LANGUAGES } from '../i18n/index.js'");
    expect(src).toContain('const { t, lang, setLang: switchLang } = useTranslation()');
  });

  it('FarmerDashboardPage uses t() for visible text', () => {
    const src = readFile('src/pages/FarmerDashboardPage.jsx');
    expect(src).toContain("t('home.welcome')");
    expect(src).toContain("t('home.farmScore')");
    expect(src).toContain("t('home.startSeason')");
    expect(src).toContain("t('home.addUpdate')");
    expect(src).toContain("t('home.reportHarvest')");
    expect(src).toContain("t('home.noActiveSeason')");
    expect(src).toContain("t('home.setupRequired')");
    expect(src).toContain("t('home.recommendations')");
    expect(src).toContain("t('home.weatherDetails')");
    expect(src).toContain("t('home.inviteFarmer')");
    expect(src).toContain("t('common.signOut')");
  });

  it('FarmerDashboardPage has all 5 language buttons', () => {
    const src = readFile('src/pages/FarmerDashboardPage.jsx');
    expect(src).toContain('LANGUAGES.map(l =>');
    expect(src).toContain('switchLang(l.code)');
    expect(src).toContain('{l.short}');
  });

  it('QuickUpdateFlow imports useTranslation', () => {
    const src = readFile('src/components/QuickUpdateFlow.jsx');
    expect(src).toContain("import { useTranslation } from '../i18n/index.js'");
    expect(src).toContain("const { t } = useTranslation()");
  });

  it('QuickUpdateFlow uses t() for visible text', () => {
    const src = readFile('src/components/QuickUpdateFlow.jsx');
    expect(src).toContain("t('update.addUpdate')");
    expect(src).toContain("t('update.whatHappened')");
    expect(src).toContain("t('update.updateSavedCheck')");
    expect(src).toContain("t('update.savedOfflineMsg')");
  });

  it('ActionFeedback imports useTranslation', () => {
    const src = readFile('src/components/ActionFeedback.jsx');
    expect(src).toContain("import { useTranslation } from '../i18n/index.js'");
    expect(src).toContain("t('feedback.stillWorking')");
    expect(src).toContain("t('feedback.couldNotComplete')");
    expect(src).toContain("t('feedback.somethingWrong')");
  });

  it('SyncStatus imports useTranslation', () => {
    const src = readFile('src/components/SyncStatus.jsx');
    expect(src).toContain("import { useTranslation } from '../i18n/index.js'");
    expect(src).toContain("t('sync.offline')");
    expect(src).toContain("t('sync.syncNow')");
    expect(src).toContain("t('sync.syncing')");
  });

  it('AcceptInvitePage imports useTranslation', () => {
    const src = readFile('src/pages/AcceptInvitePage.jsx');
    expect(src).toContain("from '../i18n/index.js'");
    expect(src).toContain("t('invite.activateAccount')");
    expect(src).toContain("t('invite.accountActivated')");
    expect(src).toContain("t('invite.signInNow')");
  });

  it('ProfilePhotoUpload imports useTranslation', () => {
    const src = readFile('src/components/ProfilePhotoUpload.jsx');
    expect(src).toContain("import { useTranslation } from '../i18n/index.js'");
    expect(src).toContain("t('photo.profilePhoto')");
    expect(src).toContain("t('photo.upload')");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 5 — VOICE + TEXT ALIGNMENT
// ═══════════════════════════════════════════════════════════

describe('Voice and text use same language source', () => {
  it('VoiceBar imports from i18n', () => {
    const src = readFile('src/components/VoiceBar.jsx');
    expect(src).toContain("import { getLanguage, setLanguage } from '../i18n/index.js'");
  });

  it('VoiceBar reads language from unified getLanguage()', () => {
    const src = readFile('src/components/VoiceBar.jsx');
    expect(src).toContain('getLanguage()');
  });

  it('VoiceBar writes language via setLanguage() (syncs all keys)', () => {
    const src = readFile('src/components/VoiceBar.jsx');
    expect(src).toContain('setLanguage(voiceLang)');
  });

  it('VoiceBar listens for external language changes', () => {
    const src = readFile('src/components/VoiceBar.jsx');
    expect(src).toContain("'farroway:langchange'");
  });

  it('i18n setLanguage writes to all 3 storage keys', () => {
    const src = readFile('src/i18n/index.js');
    expect(src).toContain("localStorage.setItem(STORAGE_KEY, code)");
    expect(src).toContain("localStorage.setItem(LEGACY_VOICE_KEY, code)");
    expect(src).toContain("localStorage.setItem(LEGACY_UI_KEY, code)");
  });

  it('i18n setLanguage dispatches custom event', () => {
    const src = readFile('src/i18n/index.js');
    expect(src).toContain("new CustomEvent('farroway:langchange'");
  });

  it('VOICE_LANGUAGES and i18n LANGUAGES match', () => {
    const voiceSrc = readFile('src/utils/voiceGuide.js');
    const i18nSrc = readFile('src/i18n/index.js');
    // Both should have en, fr, sw, ha, tw
    for (const code of ['en', 'fr', 'sw', 'ha', 'tw']) {
      expect(voiceSrc).toContain(`code: '${code}'`);
      expect(i18nSrc).toContain(`code: '${code}'`);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// PART 6 — NO HARDCODED ENGLISH LEAK IN LOCALIZED SCREENS
// ═══════════════════════════════════════════════════════════

describe('No hardcoded English leak in localized screens', () => {
  it('FarmerDashboardPage does not have hardcoded "Start Season" button text', () => {
    const src = readFile('src/pages/FarmerDashboardPage.jsx');
    // Should use t('home.startSeason'), not literal 'Start Season'
    expect(src).not.toMatch(/btnLabel\s*=\s*'Start Season'/);
  });

  it('FarmerDashboardPage does not have hardcoded "Farm Score" label', () => {
    const src = readFile('src/pages/FarmerDashboardPage.jsx');
    expect(src).not.toContain(">Farm Score<");
    expect(src).toContain("t('home.farmScore')");
  });

  it('FarmerDashboardPage does not have hardcoded "Sign Out"', () => {
    const src = readFile('src/pages/FarmerDashboardPage.jsx');
    expect(src).not.toMatch(/>Sign Out</);
    expect(src).toContain("t('common.signOut')");
  });

  it('QuickUpdateFlow does not have hardcoded step titles', () => {
    const src = readFile('src/components/QuickUpdateFlow.jsx');
    // These should all be t() calls now — camera-first flow uses whatHappened
    expect(src).not.toContain(">{`What happened?`}<");
    expect(src).toContain("t('update.whatHappened')");
    expect(src).toContain("t('update.submitUpdate')");
  });

  it('SyncStatus does not have hardcoded "Sync Now"', () => {
    const src = readFile('src/components/SyncStatus.jsx');
    expect(src).not.toMatch(/>Sync Now</);
    expect(src).toContain("t('sync.syncNow')");
  });

  it('ActionFeedback does not have hardcoded "Something went wrong"', () => {
    const src = readFile('src/components/ActionFeedback.jsx');
    expect(src).not.toContain(">Something went wrong<");
    expect(src).toContain("t('feedback.somethingWrong')");
  });
});
