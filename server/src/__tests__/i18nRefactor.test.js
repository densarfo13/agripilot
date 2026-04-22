/**
 * i18nRefactor.test.js — locks the JSON-driven react-i18next
 * refactor (spec §1–19):
 *
 *   1. All six locale files exist with identical key shapes
 *   2. Every required top-level namespace is present
 *   3. Every required leaf key resolves in every language
 *   4. normalizeCropKey accepts display strings in every language
 *   5. normalizeStageKey accepts localised stage aliases
 *   6. normalizeStatusKey accepts localised status aliases
 *   7. Legacy cassava/bankye/manioc/yuca all map to 'cassava'
 *   8. setLanguage writes to farroway_language + mirrors to legacy
 *   9. i18next bootstrap file imports all 6 locale files
 *  10. LanguageSelectorI18n uses SUPPORTED_LANGUAGES from the new
 *      setLanguage helper
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}
function readJson(rel) { return JSON.parse(readFile(rel)); }

// ─── Locale files ────────────────────────────────────────────────
const LOCALES = ['en', 'tw', 'fr', 'es', 'pt', 'sw'];
const REQUIRED_NAMESPACES = [
  'nav', 'dashboard', 'tasks', 'farm', 'settings',
  'tips', 'reminders', 'market', 'status', 'stages', 'crops', 'common',
];
// Subset of leaf keys required by the spec that MUST exist in every
// language (rendering sanity — spec §19 acceptance checks).
const REQUIRED_LEAFS = [
  'nav.home', 'nav.farm', 'nav.tasks', 'nav.reports',
  'dashboard.smart_assistant', 'dashboard.crop_progress', 'dashboard.message_start',
  'dashboard.today_focus', 'dashboard.good_job',
  'tasks.total', 'tasks.pending', 'tasks.completed', 'tasks.scout_pests',
  'farm.crop_information', 'farm.primary_crop', 'farm.farm_status',
  'settings.settings', 'settings.language', 'settings.daily_reminders',
  'settings.weather_alerts', 'settings.risk_alerts', 'settings.reminder_time',
  'settings.copy', 'settings.farmer_id',
  'tips.daily_tip', 'tips.tip_consistency',
  'reminders.title', 'reminders.none',
  'market.title', 'market.check_prices',
  'status.fair', 'status.good', 'status.excellent', 'status.poor',
  'stages.planting', 'stages.harvest',
  'crops.cassava', 'crops.maize', 'crops.rice', 'crops.tomato',
  'common.none', 'common.open_count',
];

function getPath(obj, dotKey) {
  return dotKey.split('.').reduce((acc, k) => (acc && acc[k]), obj);
}

describe('locale files', () => {
  const bundles = {};
  beforeEach(() => {
    for (const l of LOCALES) bundles[l] = readJson(`src/i18n/locales/${l}.json`);
  });

  it('all six locale files exist', () => {
    for (const l of LOCALES) {
      expect(fs.existsSync(path.join(process.cwd(), `src/i18n/locales/${l}.json`)))
        .toBe(true);
    }
  });

  it('every required namespace is present in every language', () => {
    for (const l of LOCALES) {
      for (const ns of REQUIRED_NAMESPACES) {
        expect(bundles[l][ns], `${l} is missing namespace ${ns}`).toBeDefined();
      }
    }
  });

  it('every required leaf key resolves to a non-empty string in every language', () => {
    for (const l of LOCALES) {
      for (const leaf of REQUIRED_LEAFS) {
        const v = getPath(bundles[l], leaf);
        expect(typeof v, `${l}.${leaf} should be a string`).toBe('string');
        expect(v.length, `${l}.${leaf} should not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it('common.open_count includes the {{count}} interpolation token', () => {
    for (const l of LOCALES) {
      expect(bundles[l].common.open_count).toMatch(/\{\{count\}\}/);
    }
  });

  it('every language has the same key shape as English (no missing rows)', () => {
    const en = bundles.en;
    for (const l of LOCALES) {
      if (l === 'en') continue;
      for (const ns of REQUIRED_NAMESPACES) {
        for (const key of Object.keys(en[ns])) {
          expect(bundles[l][ns][key],
            `${l}.${ns}.${key} is missing (should mirror en)`).toBeDefined();
        }
      }
    }
  });
});

// ─── Localisation normalisers ────────────────────────────────────
import {
  normalizeCropKey, normalizeStageKey, normalizeStatusKey,
} from '../../../src/utils/localization.js';

describe('normalizeCropKey', () => {
  it('maps every language variant of cassava to "cassava"', () => {
    for (const alias of ['cassava', 'CASSAVA', 'Cassava', 'bankye', 'manioc',
                          'yuca', 'mandioca', 'muhogo']) {
      expect(normalizeCropKey(alias)).toBe('cassava');
    }
  });

  it('maps every language variant of maize to "maize"', () => {
    for (const alias of ['maize', 'aburo', 'maïs', 'mais', 'milho', 'mahindi', 'corn']) {
      expect(normalizeCropKey(alias)).toBe('maize');
    }
  });

  it('falls back to "cassava" for null / empty inputs (spec default)', () => {
    expect(normalizeCropKey(null)).toBe('cassava');
    expect(normalizeCropKey(undefined)).toBe('cassava');
    expect(normalizeCropKey('')).toBe('cassava');
  });

  it('preserves unknown but cleanly-lowercased values for debuggability', () => {
    expect(normalizeCropKey('Dragonfruit')).toBe('dragonfruit');
  });
});

describe('normalizeStageKey', () => {
  it('maps localised planting stage back to the canonical key', () => {
    for (const alias of ['planting', 'dua', 'plantation', 'siembra',
                          'plantio', 'kupanda']) {
      expect(normalizeStageKey(alias)).toBe('planting');
    }
  });

  it('maps harvest variants', () => {
    for (const alias of ['harvest', 'twabere', 'récolte', 'cosecha',
                          'colheita', 'mavuno']) {
      expect(normalizeStageKey(alias)).toBe('harvest');
    }
  });
});

describe('normalizeStatusKey', () => {
  it('maps every language variant of fair / good / excellent / poor', () => {
    expect(normalizeStatusKey('Fair')).toBe('fair');
    expect(normalizeStatusKey('Ɛyɛ kakra')).toBe('fair');
    expect(normalizeStatusKey('bueno')).toBe('good');
    expect(normalizeStatusKey('excelente')).toBe('excellent');
    expect(normalizeStatusKey('faible')).toBe('poor');
    expect(normalizeStatusKey('dhaifu')).toBe('poor');
  });

  it('defaults to "fair" for empty input', () => {
    expect(normalizeStatusKey(null)).toBe('fair');
  });
});

// ─── Bootstrap + setLanguage wiring ─────────────────────────────
describe('i18next bootstrap', () => {
  const src = readFile('src/i18n/i18next.js');

  it('imports all six locale JSON files', () => {
    for (const l of LOCALES) {
      expect(src).toMatch(new RegExp(`from ['"]\\./locales/${l}\\.json['"]`));
    }
  });

  it('registers all six languages as resources', () => {
    for (const l of LOCALES) {
      expect(src).toMatch(new RegExp(`${l}:\\s*\\{\\s*translation:`));
    }
  });

  it('reads the stored language before init (persistence)', () => {
    expect(src).toMatch(/farroway_language/);
    expect(src).toMatch(/fallbackLng:\s*['"]en['"]/);
  });

  it('listens on farroway:langchange to stay in sync with the legacy engine', () => {
    expect(src).toMatch(/addEventListener\(['"]farroway:langchange['"]/);
    expect(src).toMatch(/changeLanguage/);
  });
});

describe('setLanguageI18n', () => {
  const src = readFile('src/i18n/setLanguageI18n.js');

  it('exports SUPPORTED_LANGUAGES with 6 codes', () => {
    expect(src).toMatch(/SUPPORTED_LANGUAGES/);
    for (const l of LOCALES) {
      expect(src).toMatch(new RegExp(`code:\\s*['"]${l}['"]`));
    }
  });

  it('persists to farroway_language AND calls the legacy setLanguage', () => {
    expect(src).toMatch(/farroway_language/);
    expect(src).toMatch(/setLegacyLanguage/);
  });

  it('calls i18next.changeLanguage on switch', () => {
    expect(src).toMatch(/i18n\.changeLanguage/);
  });
});

// ─── Component wiring ───────────────────────────────────────────
describe('LanguageSelectorI18n', () => {
  const src = readFile('src/components/LanguageSelectorI18n.jsx');

  it('uses react-i18next and the new setLanguage helper', () => {
    expect(src).toMatch(/from ['"]react-i18next['"]/);
    expect(src).toMatch(/from ['"]\.\.\/i18n\/setLanguageI18n/);
  });

  it('labels the selector with t("settings.language")', () => {
    expect(src).toMatch(/t\(['"]settings\.language['"]\)/);
  });

  it('renders every SUPPORTED_LANGUAGES option', () => {
    expect(src).toMatch(/SUPPORTED_LANGUAGES\.map/);
  });
});

// ─── main.jsx bootstrap ─────────────────────────────────────────
describe('main.jsx', () => {
  it('imports the i18next bootstrap before rendering', () => {
    const src = readFile('src/main.jsx');
    expect(src).toMatch(/import ['"]\.\/i18n\/i18next/);
  });
});
