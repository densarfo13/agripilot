/**
 * Harvest & Post-Harvest — comprehensive tests.
 *
 * Covers: rules structure, engine logic, weather adjustment,
 * crop/stage filtering, fallback behavior, task engine integration,
 * route registration, API function, UI card, dashboard wiring, i18n.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readFile(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, '../../..', relativePath), 'utf8');
}

// ═══════════════════════════════════════════════════════════
//  1. Harvest Rules — structure and content
// ═══════════════════════════════════════════════════════════
describe('Harvest Rules — structure', () => {
  const rules = readFile('server/lib/harvestRules.js');

  it('exports HARVEST_RULES array', () => {
    expect(rules).toContain('export const HARVEST_RULES');
  });

  it('exports adjustPriority function', () => {
    expect(rules).toContain('export function adjustPriority');
  });

  it('exports PRIORITY_ORDER', () => {
    expect(rules).toContain('export { PRIORITY_ORDER }');
  });

  it('has weather helper functions', () => {
    expect(rules).toContain('hasHeavyRainRisk');
    expect(rules).toContain('hasRainExpected');
    expect(rules).toContain('hasDrySpellRisk');
    expect(rules).toContain('hasHighHumidity');
    expect(rules).toContain('isHot');
  });

  it('has rules for maize', () => {
    expect(rules).toContain('maize-harvest-labor');
    expect(rules).toContain('maize-dryness-check');
    expect(rules).toContain('maize-drying-storage');
  });

  it('has rules for rice', () => {
    expect(rules).toContain('rice-harvest-timing');
    expect(rules).toContain('rice-drying-storage');
  });

  it('has rules for cassava', () => {
    expect(rules).toContain('cassava-harvest-window');
    expect(rules).toContain('cassava-transport-processing');
  });

  it('has rules for tomato', () => {
    expect(rules).toContain('tomato-harvest-frequent');
    expect(rules).toContain('tomato-sort-spoilage');
  });

  it('has rules for cocoa', () => {
    expect(rules).toContain('cocoa-pod-harvest');
    expect(rules).toContain('cocoa-fermentation-drying');
  });

  it('each rule has required fields', () => {
    const requiredFields = ['id', 'crops', 'stages', 'category', 'basePriority', 'title', 'reason', 'action', 'dueLabel'];
    for (const field of requiredFields) {
      expect(rules).toContain(field);
    }
  });

  it('uses harvest-readiness and post-harvest categories', () => {
    expect(rules).toContain("'harvest-readiness'");
    expect(rules).toContain("'post-harvest'");
  });

  it('has weatherBoost and weatherReduce on rules', () => {
    expect(rules).toContain('weatherBoost');
    expect(rules).toContain('weatherReduce');
  });
});

// ═══════════════════════════════════════════════════════════
//  2. Harvest Engine — logic
// ═══════════════════════════════════════════════════════════
describe('Harvest Engine — logic', () => {
  const engine = readFile('server/lib/harvestEngine.js');

  it('exports generateHarvestRecommendations', () => {
    expect(engine).toContain('export function generateHarvestRecommendations');
  });

  it('exports getAllHarvestRules', () => {
    expect(engine).toContain('export function getAllHarvestRules');
  });

  it('imports rules from harvestRules.js', () => {
    expect(engine).toContain("from './harvestRules.js'");
  });

  it('filters rules by crop', () => {
    expect(engine).toContain('rule.crops.includes');
  });

  it('filters rules by stage', () => {
    expect(engine).toContain('rule.stages.includes');
  });

  it('applies weather boost', () => {
    expect(engine).toContain('rule.weatherBoost');
    expect(engine).toContain('adjustPriority(priority, +1)');
  });

  it('applies weather reduce', () => {
    expect(engine).toContain('rule.weatherReduce');
    expect(engine).toContain('adjustPriority(priority, -1)');
  });

  it('adds confidence note when no weather data', () => {
    expect(engine).toContain('Weather data unavailable');
  });

  it('sorts by priority high first', () => {
    expect(engine).toContain('PRIORITY_ORDER.indexOf');
  });

  it('returns recommendation objects with required fields', () => {
    const fields = ['id', 'farmId', 'category', 'priority', 'title', 'reason', 'action', 'dueLabel', 'crop', 'stage', 'weatherAdjusted', 'confidenceNote'];
    for (const field of fields) {
      expect(engine).toContain(field);
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  3. Harvest Engine — runtime
// ═══════════════════════════════════════════════════════════
describe('Harvest Engine — runtime', () => {
  let generateHarvestRecommendations, getAllHarvestRules;

  beforeAll(async () => {
    const mod = await import('../../lib/harvestEngine.js');
    generateHarvestRecommendations = mod.generateHarvestRecommendations;
    getAllHarvestRules = mod.getAllHarvestRules;
  });

  it('returns array for maize harvest stage', () => {
    const recs = generateHarvestRecommendations({
      farmId: 'farm-1',
      crop: 'maize',
      stage: 'harvest',
    });
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown crop', () => {
    const recs = generateHarvestRecommendations({
      farmId: 'farm-1',
      crop: 'banana',
      stage: 'harvest',
    });
    expect(recs).toEqual([]);
  });

  it('returns empty array for non-harvest stage', () => {
    const recs = generateHarvestRecommendations({
      farmId: 'farm-1',
      crop: 'maize',
      stage: 'planning',
    });
    expect(recs).toEqual([]);
  });

  it('includes harvest-readiness and post-harvest categories for maize', () => {
    const recs = generateHarvestRecommendations({
      farmId: 'farm-1',
      crop: 'maize',
      stage: 'harvest',
    });
    const categories = [...new Set(recs.map(r => r.category))];
    expect(categories).toContain('harvest-readiness');
    expect(categories).toContain('post-harvest');
  });

  it('sets weatherAdjusted=false when no weather data', () => {
    const recs = generateHarvestRecommendations({
      farmId: 'farm-1',
      crop: 'rice',
      stage: 'harvest',
    });
    for (const rec of recs) {
      expect(rec.weatherAdjusted).toBe(false);
    }
  });

  it('sets confidenceNote when no weather data', () => {
    const recs = generateHarvestRecommendations({
      farmId: 'farm-1',
      crop: 'rice',
      stage: 'harvest',
    });
    for (const rec of recs) {
      expect(rec.confidenceNote).toBeTruthy();
    }
  });

  it('adjusts priority when weather data is present', () => {
    const recs = generateHarvestRecommendations({
      farmId: 'farm-1',
      crop: 'maize',
      stage: 'harvest',
      weather: { hasWeatherData: true, rainExpected: true, humidityPct: 90 },
    });
    const adjusted = recs.filter(r => r.weatherAdjusted);
    expect(adjusted.length).toBeGreaterThan(0);
  });

  it('sets confidenceNote to null when weather data is present', () => {
    const recs = generateHarvestRecommendations({
      farmId: 'farm-1',
      crop: 'maize',
      stage: 'harvest',
      weather: { hasWeatherData: true },
    });
    for (const rec of recs) {
      expect(rec.confidenceNote).toBeNull();
    }
  });

  it('returns recs for all 5 crops at harvest stage', () => {
    const crops = ['maize', 'rice', 'cassava', 'tomato', 'cocoa'];
    for (const crop of crops) {
      const recs = generateHarvestRecommendations({
        farmId: 'farm-1',
        crop,
        stage: 'harvest',
      });
      expect(recs.length).toBeGreaterThan(0);
    }
  });

  it('returns recs at post_harvest stage', () => {
    const crops = ['maize', 'rice', 'cassava', 'tomato', 'cocoa'];
    for (const crop of crops) {
      const recs = generateHarvestRecommendations({
        farmId: 'farm-1',
        crop,
        stage: 'post_harvest',
      });
      expect(recs.length).toBeGreaterThan(0);
    }
  });

  it('getAllHarvestRules returns all rules', () => {
    const rules = getAllHarvestRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThanOrEqual(11);
  });

  it('each recommendation has a unique id scoped to farm', () => {
    const recs = generateHarvestRecommendations({
      farmId: 'test-farm-99',
      crop: 'maize',
      stage: 'harvest',
    });
    for (const rec of recs) {
      expect(rec.id).toContain('test-farm-99');
    }
    const ids = recs.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ═══════════════════════════════════════════════════════════
//  4. Harvest Rules — adjustPriority
// ═══════════════════════════════════════════════════════════
describe('adjustPriority', () => {
  let adjustPriority;

  beforeAll(async () => {
    const mod = await import('../../lib/harvestRules.js');
    adjustPriority = mod.adjustPriority;
  });

  it('boosts low to medium', () => {
    expect(adjustPriority('low', +1)).toBe('medium');
  });

  it('boosts medium to high', () => {
    expect(adjustPriority('medium', +1)).toBe('high');
  });

  it('high stays high on boost', () => {
    expect(adjustPriority('high', +1)).toBe('high');
  });

  it('reduces high to medium', () => {
    expect(adjustPriority('high', -1)).toBe('medium');
  });

  it('reduces medium to low', () => {
    expect(adjustPriority('medium', -1)).toBe('low');
  });

  it('low stays low on reduce', () => {
    expect(adjustPriority('low', -1)).toBe('low');
  });
});

// ═══════════════════════════════════════════════════════════
//  5. Harvest route — structure
// ═══════════════════════════════════════════════════════════
describe('Harvest route — structure', () => {
  const route = readFile('server/routes/farmHarvest.js');

  it('uses authenticate middleware', () => {
    expect(route).toContain('authenticate');
  });

  it('checks farm ownership via userId', () => {
    expect(route).toContain('userId: req.user.id');
  });

  it('returns 404 for not-found farm', () => {
    expect(route).toContain('404');
  });

  it('imports generateHarvestRecommendations', () => {
    expect(route).toContain('generateHarvestRecommendations');
  });

  it('returns recommendations in response', () => {
    expect(route).toContain('recommendations');
  });

  it('handles archived farms', () => {
    expect(route).toContain('archived');
  });
});

// ═══════════════════════════════════════════════════════════
//  6. Task engine — harvest integration
// ═══════════════════════════════════════════════════════════
describe('Task engine — harvest integration', () => {
  const engine = readFile('server/lib/farmTaskEngine.js');

  it('accepts harvestRecs in context', () => {
    expect(engine).toContain('harvestRecs');
    expect(engine).toContain('seasonal, weather, risks, inputRecs, harvestRecs, hasRecentHarvestRecord, hasCostRecords, hasRevenueData, benchmarkInsights } = context');
  });

  it('injects high-priority harvest recs as tasks', () => {
    expect(engine).toContain("rec.priority === 'high'");
    expect(engine).toContain('harvest-task-');
  });

  it('adds harvestNote to injected tasks', () => {
    expect(engine).toContain('harvestNote');
  });

  it('distinguishes post-harvest from harvest-readiness notes', () => {
    expect(engine).toContain('Post-harvest');
    expect(engine).toContain('Harvest readiness');
  });
});

// ═══════════════════════════════════════════════════════════
//  7. Farm tasks route — harvest wiring
// ═══════════════════════════════════════════════════════════
describe('Farm tasks route — harvest wiring', () => {
  const route = readFile('server/routes/farmTasks.js');

  it('imports generateHarvestRecommendations', () => {
    expect(route).toContain('generateHarvestRecommendations');
    expect(route).toContain("from '../lib/harvestEngine.js'");
  });

  it('passes harvestRecs to generateTasksForFarm', () => {
    expect(route).toContain('harvestRecs');
  });

  it('returns harvestRecs in response', () => {
    expect(route).toContain('harvestRecs');
  });
});

// ═══════════════════════════════════════════════════════════
//  8. App registration
// ═══════════════════════════════════════════════════════════
describe('App — harvest route registration', () => {
  const app = readFile('server/src/app.js');

  it('imports farm harvest routes', () => {
    expect(app).toContain('farmHarvest');
  });

  it('mounts at /api/v2/farm-harvest', () => {
    expect(app).toContain('/api/v2/farm-harvest');
  });
});

// ═══════════════════════════════════════════════════════════
//  9. API client — getFarmHarvest
// ═══════════════════════════════════════════════════════════
describe('API client — getFarmHarvest', () => {
  const api = readFile('src/lib/api.js');

  it('exports getFarmHarvest function', () => {
    expect(api).toContain('export function getFarmHarvest');
  });

  it('calls /api/v2/farm-harvest/ endpoint', () => {
    expect(api).toContain('/api/v2/farm-harvest/');
  });

  it('encodes farmId', () => {
    expect(api).toContain('encodeURIComponent(farmId)');
  });
});

// ═══════════════════════════════════════════════════════════
// 10. FarmHarvestCard — UI
// ═══════════════════════════════════════════════════════════
describe('FarmHarvestCard — UI', () => {
  const card = readFile('src/components/FarmHarvestCard.jsx');

  it('imports getFarmHarvest from api', () => {
    expect(card).toContain('getFarmHarvest');
  });

  it('uses useProfile for currentFarmId', () => {
    expect(card).toContain('currentFarmId');
    expect(card).toContain('useProfile');
  });

  it('uses prevFarmIdRef pattern for farm switching', () => {
    expect(card).toContain('prevFarmIdRef');
  });

  it('has loading state', () => {
    expect(card).toContain("t('harvest.loading')");
  });

  it('has error state', () => {
    expect(card).toContain('errorText');
  });

  it('has empty state', () => {
    expect(card).toContain("t('harvest.noRecs')");
  });

  it('shows category icons', () => {
    expect(card).toContain('harvest-readiness');
    expect(card).toContain('post-harvest');
  });

  it('shows priority labels', () => {
    expect(card).toContain('harvest.priority.');
  });

  it('shows post-harvest tag', () => {
    expect(card).toContain('harvest.postHarvestTag');
  });

  it('shows weather adjusted tag', () => {
    expect(card).toContain('harvest.weatherAdjusted');
  });

  it('shows confidence note', () => {
    expect(card).toContain('confidenceNote');
  });

  it('has data-testid', () => {
    expect(card).toContain('data-testid="farm-harvest-card"');
  });

  it('uses dark theme styling', () => {
    expect(card).toContain('#1B2330');
    expect(card).toContain('#111827');
  });
});

// ═══════════════════════════════════════════════════════════
// 11. Dashboard — harvest card wiring
// ═══════════════════════════════════════════════════════════
describe('Dashboard — harvest card wiring', () => {
  const dashboard = readFile('src/pages/Dashboard.jsx');

  it('imports FarmHarvestCard', () => {
    expect(dashboard).toContain("import FarmHarvestCard from '../components/FarmHarvestCard.jsx'");
  });

  it('renders FarmHarvestCard', () => {
    expect(dashboard).toContain('<FarmHarvestCard');
  });

  it('renders harvest card inside harvest expanded section', () => {
    // In the new Dashboard, harvest card is inside the 'harvest' expandable section
    const harvestSection = dashboard.indexOf("expandedSection === 'harvest'");
    const renderHarvest = dashboard.indexOf('<FarmHarvestCard');
    expect(harvestSection).toBeGreaterThan(0);
    expect(renderHarvest).toBeGreaterThan(harvestSection);
  });
});

// ═══════════════════════════════════════════════════════════
// 12. FarmTasksCard — harvestNote rendering
// ═══════════════════════════════════════════════════════════
describe('FarmTasksCard — harvestNote rendering', () => {
  const card = readFile('src/components/FarmTasksCard.jsx');

  it('renders harvestNote field', () => {
    expect(card).toContain('task.harvestNote');
  });

  it('uses harvest icon', () => {
    expect(card).toContain('harvestNote');
  });

  it('has harvestNote style', () => {
    expect(card).toContain("color: '#FDBA74'");
  });
});

// ═══════════════════════════════════════════════════════════
// 13. i18n — harvest keys
// ═══════════════════════════════════════════════════════════
describe('i18n — harvest keys', () => {
  const translations = readFile('src/i18n/translations.js');

  const requiredKeys = [
    'harvest.title',
    'harvest.loading',
    'harvest.noRecs',
    'harvest.items',
    'harvest.priority.high',
    'harvest.priority.medium',
    'harvest.priority.low',
    'harvest.postHarvestTag',
    'harvest.weatherAdjusted',
  ];

  for (const key of requiredKeys) {
    it(`has key: ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('has all 5 languages for harvest.title', () => {
    const line = translations.split('\n').find(l => l.includes("'harvest.title'"));
    expect(line).toBeTruthy();
    expect(line).toContain('en:');
    expect(line).toContain('fr:');
    expect(line).toContain('sw:');
    expect(line).toContain('ha:');
    expect(line).toContain('tw:');
  });
});
