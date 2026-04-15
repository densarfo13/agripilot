/**
 * Task Architecture Regression Tests
 *
 * These tests lock the architecture to prevent regressions in:
 *   - severity derivation
 *   - localization resolution
 *   - weather override consistency
 *   - view model integrity
 *   - style/severity alignment
 *
 * Run with: npx vitest run src/domain/tasks/__tests__/taskArchitecture.test.js
 */
import { describe, it, expect } from 'vitest';
import { getTaskSeverity } from '../getTaskSeverity.js';
import { getTaskStateStyle } from '../taskStateStyles.js';
import { resolveFarmerText } from '../farmerTextResolver.js';
import { buildFarmerTaskViewModel, buildTaskListViewModels, TASK_VIEWMODEL_SCHEMA_VERSION } from '../buildFarmerTaskViewModel.js';

// ─── Mock t() function ──────────────────────────────────────
function mockT(key, vars) {
  // Return key as-is to detect untranslated keys
  return key;
}

// ─── Test fixtures ──────────────────────────────────────────
const SAFE_WEATHER = { status: 'safe', riskLevel: 'none', adjustments: {}, rainTiming: 'none' };
const CAUTION_WEATHER = { status: 'caution', riskLevel: 'low', adjustments: { watering: -5 }, rainTiming: 'later' };
const DANGER_WEATHER = { status: 'danger', riskLevel: 'high', adjustments: { watering: -10, drying: -10 }, rainTiming: 'now' };
const WARNING_HIGH_WEATHER = { status: 'warning', riskLevel: 'high', adjustments: { watering: -10 }, rainTiming: 'now' };

const DRYING_TASK = { id: 'post-dry', title: 'Dry harvest', description: 'Spread grain on tarps', priority: 'medium', actionType: 'drying' };
const WATERING_TASK = { id: 'flower-water', title: 'Water crop', description: 'Water during flowering', priority: 'medium', actionType: 'watering' };
const WEEDING_TASK = { id: 'veg-weed', title: 'Remove weeds', description: 'Remove weeds around plants', priority: 'low' };
const HIGH_PEST_TASK = { id: 'veg-pest-check', title: 'Check for pests', description: 'Look for insects', priority: 'high' };

// ─── 1. Severity derivation ─────────────────────────────────
describe('getTaskSeverity', () => {
  it('returns normal for low priority + safe weather', () => {
    expect(getTaskSeverity({ priority: 'low', weatherGuidance: SAFE_WEATHER })).toBe('normal');
  });

  it('returns normal for medium priority + safe weather', () => {
    expect(getTaskSeverity({ priority: 'medium', weatherGuidance: SAFE_WEATHER })).toBe('normal');
  });

  it('returns caution for high priority + safe weather', () => {
    expect(getTaskSeverity({ priority: 'high', weatherGuidance: SAFE_WEATHER })).toBe('caution');
  });

  it('returns caution for medium priority + danger weather', () => {
    expect(getTaskSeverity({ priority: 'medium', weatherGuidance: DANGER_WEATHER })).toBe('caution');
  });

  it('returns urgent for high priority + danger weather', () => {
    expect(getTaskSeverity({ priority: 'high', weatherGuidance: DANGER_WEATHER })).toBe('urgent');
  });

  it('returns urgent for high priority + warning with high risk', () => {
    expect(getTaskSeverity({ priority: 'high', weatherGuidance: WARNING_HIGH_WEATHER })).toBe('urgent');
  });

  it('returns urgent when isWeatherOverride is true', () => {
    expect(getTaskSeverity({ priority: 'medium', weatherGuidance: SAFE_WEATHER, isWeatherOverride: true })).toBe('urgent');
  });

  it('returns normal for null weather', () => {
    expect(getTaskSeverity({ priority: 'medium', weatherGuidance: null })).toBe('normal');
  });
});

// ─── 2. Severity → style consistency ────────────────────────
describe('getTaskStateStyle', () => {
  it('normal severity never produces red accent', () => {
    const style = getTaskStateStyle('normal');
    expect(style.accentColor).not.toBe('#EF4444');
    expect(style.priorityColor).not.toBe('#EF4444');
  });

  it('caution severity uses amber, not red', () => {
    const style = getTaskStateStyle('caution');
    expect(style.accentColor).toBe('#F59E0B');
    expect(style.priorityColor).toBe('#F59E0B');
    expect(style.accentColor).not.toBe('#EF4444');
  });

  it('urgent severity uses red', () => {
    const style = getTaskStateStyle('urgent');
    expect(style.accentColor).toBe('#EF4444');
  });

  it('caution CTA is not disabled', () => {
    const style = getTaskStateStyle('caution');
    expect(style.ctaDisabled).toBe(false);
  });

  it('urgent CTA is disabled', () => {
    const style = getTaskStateStyle('urgent');
    expect(style.ctaDisabled).toBe(true);
  });

  it('unknown severity falls back to normal', () => {
    const style = getTaskStateStyle('unknown');
    expect(style.accentColor).toBe('#22C55E');
  });
});

// ─── 3. Farmer text resolution ──────────────────────────────
describe('resolveFarmerText', () => {
  it('resolves localized title for server task (en)', () => {
    const text = resolveFarmerText({ task: DRYING_TASK, action: null, lang: 'en', t: mockT });
    expect(text.title).toBe('Dry harvest');
  });

  it('resolves localized title for server task (fr)', () => {
    const text = resolveFarmerText({ task: DRYING_TASK, action: null, lang: 'fr', t: mockT });
    expect(text.title).toBe('Sécher la récolte');
  });

  it('resolves localized title for server task (sw)', () => {
    const text = resolveFarmerText({ task: WEEDING_TASK, action: null, lang: 'sw', t: mockT });
    expect(text.title).toBe('Palilia');
  });

  it('resolves title from action when no task', () => {
    const action = { title: 'Setup your farm', reason: 'Complete your profile', cta: 'Start' };
    const text = resolveFarmerText({ task: null, action, lang: 'en', t: mockT });
    expect(text.title).toBe('Setup your farm');
    expect(text.ctaLabel).toBe('Start');
  });

  it('hides supporting line for non-English', () => {
    const text = resolveFarmerText({ task: { ...DRYING_TASK, reason: 'English reason' }, action: null, lang: 'fr', t: mockT });
    expect(text.supportingLine).toBeNull();
  });

  it('shows supporting line for English', () => {
    const text = resolveFarmerText({ task: { ...DRYING_TASK, reason: 'English reason' }, action: null, lang: 'en', t: mockT });
    expect(text.supportingLine).toBe('English reason');
  });
});

// ─── 4. View model integrity ────────────────────────────────
describe('buildFarmerTaskViewModel', () => {
  it('returns a view model with _schemaVersion', () => {
    const vm = buildFarmerTaskViewModel({
      task: WEEDING_TASK, action: null, weatherGuidance: SAFE_WEATHER,
      language: 'en', t: mockT, mode: 'simple',
    });
    expect(vm._schemaVersion).toBe(TASK_VIEWMODEL_SCHEMA_VERSION);
  });

  it('includes severity and stateStyle', () => {
    const vm = buildFarmerTaskViewModel({
      task: HIGH_PEST_TASK, action: null, weatherGuidance: DANGER_WEATHER,
      language: 'en', t: mockT, mode: 'standard',
    });
    expect(vm.severity).toBe('urgent');
    expect(vm.stateStyle).toBeDefined();
    expect(vm.stateStyle.accentColor).toBe('#EF4444');
  });

  it('has localized title in non-English', () => {
    const vm = buildFarmerTaskViewModel({
      task: WATERING_TASK, action: null, weatherGuidance: SAFE_WEATHER,
      language: 'ha', t: mockT, mode: 'standard',
    });
    expect(vm.title).toBe('Shayar da amfani');
  });

  it('includes icon and iconBg', () => {
    const vm = buildFarmerTaskViewModel({
      task: WATERING_TASK, action: null, weatherGuidance: SAFE_WEATHER,
      language: 'en', t: mockT, mode: 'simple',
    });
    expect(vm.icon).toBeTruthy();
    expect(vm.iconBg).toBeTruthy();
  });

  it('marks weather-overridden tasks', () => {
    const action = {
      key: 'weather_override', icon: '🌧️', iconBg: 'rgba(14,165,233,0.12)',
      title: 'Protect harvest', reason: 'Rain expected', cta: 'Do this now',
      priority: 'high', weatherOverride: true, task: DRYING_TASK,
    };
    const vm = buildFarmerTaskViewModel({
      task: DRYING_TASK, action, weatherGuidance: DANGER_WEATHER,
      language: 'en', t: mockT, mode: 'simple',
    });
    expect(vm.isWeatherOverridden).toBe(true);
    expect(vm.severity).toBe('urgent');
  });

  it('simple and standard mode share same text content', () => {
    const params = {
      task: WEEDING_TASK, action: null, weatherGuidance: SAFE_WEATHER,
      language: 'fr', t: mockT,
    };
    const simple = buildFarmerTaskViewModel({ ...params, mode: 'simple' });
    const standard = buildFarmerTaskViewModel({ ...params, mode: 'standard' });
    expect(simple.title).toBe(standard.title);
    expect(simple.descriptionShort).toBe(standard.descriptionShort);
    expect(simple.severity).toBe(standard.severity);
  });
});

// ─── 5. Task list view models ───────────────────────────────
describe('buildTaskListViewModels', () => {
  it('builds view models for all tasks', () => {
    const vms = buildTaskListViewModels({
      tasks: [DRYING_TASK, WEEDING_TASK, HIGH_PEST_TASK],
      weatherGuidance: SAFE_WEATHER, language: 'en', t: mockT, mode: 'standard',
    });
    expect(vms).toHaveLength(3);
    vms.forEach(vm => {
      expect(vm._schemaVersion).toBe(TASK_VIEWMODEL_SCHEMA_VERSION);
      expect(vm.title).toBeTruthy();
      expect(vm.severity).toBeTruthy();
    });
  });

  it('localizes all tasks in the list for non-English', () => {
    const vms = buildTaskListViewModels({
      tasks: [DRYING_TASK, WEEDING_TASK],
      weatherGuidance: null, language: 'tw', t: mockT, mode: 'standard',
    });
    // Twi titles should NOT be the English originals
    expect(vms[0].title).not.toBe('Dry harvest');
    expect(vms[1].title).not.toBe('Remove weeds');
  });

  it('handles empty task array', () => {
    const vms = buildTaskListViewModels({
      tasks: [], weatherGuidance: null, language: 'en', t: mockT, mode: 'standard',
    });
    expect(vms).toHaveLength(0);
  });
});

// ─── 6. Weather override changes task for rain + drying ─────
describe('weather override scenario', () => {
  it('drying task in rain gets overridden to protection task', () => {
    // Simulates what the decision engine does
    const overriddenAction = {
      key: 'weather_override',
      icon: '🌧️',
      iconBg: 'rgba(14,165,233,0.12)',
      title: 'wxConflict.protectHarvest', // from t() — would be translated
      reason: 'wxConflict.protectHarvestReason',
      cta: 'guided.taskCta',
      priority: 'high',
      weatherOverride: true,
      task: DRYING_TASK,
    };

    const vm = buildFarmerTaskViewModel({
      task: DRYING_TASK, action: overriddenAction,
      weatherGuidance: DANGER_WEATHER, language: 'en', t: mockT, mode: 'simple',
    });

    expect(vm.isWeatherOverridden).toBe(true);
    expect(vm.actionKey).toBe('weather_override');
    expect(vm.severity).toBe('urgent');
    // Title should come from the override action, not the original task
    expect(vm.title).toBe('wxConflict.protectHarvest');
  });

  it('rain scenario produces same override in all languages', () => {
    const overriddenAction = {
      key: 'weather_override', icon: '🌧️', iconBg: 'rgba(14,165,233,0.12)',
      title: 'Protect harvest', reason: 'Rain expected', cta: 'Do now',
      priority: 'high', weatherOverride: true, task: DRYING_TASK,
    };

    const langs = ['en', 'fr', 'sw', 'ha', 'tw'];
    const vms = langs.map(lang => buildFarmerTaskViewModel({
      task: DRYING_TASK, action: overriddenAction,
      weatherGuidance: DANGER_WEATHER, language: lang, t: mockT, mode: 'simple',
    }));

    // All should be weather-overridden and urgent
    vms.forEach(vm => {
      expect(vm.isWeatherOverridden).toBe(true);
      expect(vm.severity).toBe('urgent');
      expect(vm.actionKey).toBe('weather_override');
    });
  });
});

// ─── 7. Cache schema version ────────────────────────────────
describe('cache schema version', () => {
  it('TASK_VIEWMODEL_SCHEMA_VERSION is at least 2', () => {
    expect(TASK_VIEWMODEL_SCHEMA_VERSION).toBeGreaterThanOrEqual(2);
  });

  it('view model always includes schema version', () => {
    const vm = buildFarmerTaskViewModel({
      task: WEEDING_TASK, action: null, weatherGuidance: null,
      language: 'en', t: mockT, mode: 'standard',
    });
    expect(vm._schemaVersion).toBe(TASK_VIEWMODEL_SCHEMA_VERSION);
  });
});

// ─── 8. Translation key coverage ────────────────────────────
describe('translation coverage', () => {
  it('all 42 tasks have localized titles in all 5 languages', () => {
    // Import task translations to check coverage
    const TASK_IDS = [
      'plan-select-seed', 'plan-budget', 'plan-soil-test',
      'landprep-clear', 'landprep-till-maize', 'landprep-beds-tomato',
      'landprep-mound-cassava', 'landprep-shade-cocoa', 'landprep-level-rice',
      'plant-seeds', 'plant-first-water', 'plant-cassava-cuttings',
      'plant-cocoa-seedlings', 'plant-tomato-transplant',
      'germ-check-emergence', 'germ-moisture', 'germ-check-cassava',
      'veg-weed', 'veg-fertilize-maize', 'veg-fertilize-rice',
      'veg-pest-check', 'veg-prune-cocoa',
      'flower-water', 'flower-second-fert', 'flower-pest-tomato',
      'flower-pollination-cocoa',
      'fruit-monitor', 'fruit-grain-fill', 'fruit-support-tomato',
      'fruit-cassava-tuber',
      'harvest-readiness', 'harvest-tools', 'harvest-storage',
      'post-dry', 'post-sort', 'post-market',
      'post-process-cassava', 'post-process-cocoa',
      'region-ea-altitude-timing', 'region-ea-terrace',
      'region-wa-fire-prep', 'region-wa-harmattan-care',
    ];
    const LANGS = ['en', 'fr', 'sw', 'ha', 'tw'];

    TASK_IDS.forEach(id => {
      const task = { id, title: `English ${id}`, description: `Desc ${id}`, priority: 'medium' };
      LANGS.forEach(lang => {
        const vm = buildFarmerTaskViewModel({
          task, action: null, weatherGuidance: null,
          language: lang, t: mockT, mode: 'standard',
        });
        // Title should NOT be the fallback "English <id>" for non-English
        if (lang !== 'en') {
          expect(vm.title).not.toBe(`English ${id}`);
        }
      });
    });
  });
});
