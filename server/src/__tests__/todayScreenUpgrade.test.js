/**
 * todayScreenUpgrade.test.js — covers the Today-screen upgrade:
 *
 *   - ProgressSummaryCard.deriveStatus rules (on_track / slight_delay /
 *     needs_attention) and the i18n keys it maps to.
 *   - Every new key the action-first layout references resolves to a
 *     non-empty string in every supported locale, and differs from the
 *     English fallback for non-English locales.
 *
 * This is the same "no English leak" guard used by i18nWireup, scoped
 * to just the keys this screen added.
 */
import { describe, it, expect } from 'vitest';
import { t } from '../../../src/i18n/index.js';
import { _internal as progressInternal } from '../../../src/components/farmer/ProgressSummaryCard.jsx';

const { deriveStatus, STATUS_KEY } = progressInternal;

// ─── deriveStatus ─────────────────────────────────────────
describe('ProgressSummaryCard.deriveStatus', () => {
  it('defaults to on_track with zero overdue and low risk', () => {
    expect(deriveStatus({ percent: 60, overdueCount: 0, riskLevel: 'low' })).toBe('on_track');
  });

  it('slight_delay when one task is overdue', () => {
    expect(deriveStatus({ percent: 40, overdueCount: 1, riskLevel: 'low' })).toBe('slight_delay');
  });

  it('slight_delay when progress is visibly behind (0 < pct < 50, no overdue)', () => {
    expect(deriveStatus({ percent: 20, overdueCount: 0, riskLevel: 'low' })).toBe('slight_delay');
  });

  it('needs_attention when 3+ overdue tasks pile up', () => {
    expect(deriveStatus({ percent: 50, overdueCount: 3, riskLevel: 'low' })).toBe('needs_attention');
  });

  it('needs_attention when overall risk is high even if progress is fine', () => {
    expect(deriveStatus({ percent: 90, overdueCount: 0, riskLevel: 'high' })).toBe('needs_attention');
  });

  it('STATUS_KEY maps to actionHome.progress.status.* i18n keys', () => {
    expect(STATUS_KEY.on_track).toBe('actionHome.progress.status.onTrack');
    expect(STATUS_KEY.slight_delay).toBe('actionHome.progress.status.slightDelay');
    expect(STATUS_KEY.needs_attention).toBe('actionHome.progress.status.needsAttention');
  });
});

// ─── i18n — new keys introduced by the Today upgrade ──────
const NEW_KEYS = [
  'actionHome.progress.status.onTrack',
  'actionHome.progress.status.slightDelay',
  'actionHome.progress.status.needsAttention',
  'actionHome.nextHint.label',
];

const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];

describe('Today-upgrade i18n keys resolve in every locale', () => {
  it.each(NEW_KEYS)('%s has a non-empty English string', (key) => {
    expect(t(key, 'en')).toBeTruthy();
  });

  it.each(
    NON_EN_LOCALES.flatMap((lang) => NEW_KEYS.map((key) => [lang, key])),
  )('[%s] %s is localized (no English leak)', (lang, key) => {
    const en = t(key, 'en');
    const localized = t(key, lang);
    expect(localized).toBeTruthy();
    expect(localized).not.toBe(en);
  });
});

describe('Unknown locale falls back to English cleanly', () => {
  it.each(['', 'zz', null, undefined])(
    'locale %p returns the English label',
    (lang) => {
      for (const key of NEW_KEYS) expect(t(key, lang)).toBe(t(key, 'en'));
    },
  );
});
