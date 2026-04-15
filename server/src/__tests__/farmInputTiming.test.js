/**
 * Input & Fertilizer Timing Integration — comprehensive tests.
 *
 * Tests cover:
 *  1. Input timing rules structure and coverage
 *  2. Priority adjustment helper
 *  3. Weather helpers
 *  4. Input timing engine — generateInputRecommendations
 *  5. Input timing engine — weather delay behavior
 *  6. Input timing engine — weather boost behavior
 *  7. Input timing engine — crop/stage filtering
 *  8. Input timing engine — fallback (no weather)
 *  9. Task engine — input-based task injection
 * 10. Farm inputs route structure
 * 11. Farm tasks route — input integration
 * 12. Frontend API function
 * 13. FarmInputTimingCard component
 * 14. FarmTasksCard inputNote rendering
 * 15. Dashboard wiring
 * 16. App route registration
 * 17. i18n keys
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  INPUT_TIMING_RULES,
  adjustPriority,
  PRIORITY_ORDER,
  hasHeavyRainRisk,
  hasRainExpected,
  hasDrySpellRisk,
  hasHighHumidity,
} from '../../lib/inputTimingRules.js';
import {
  generateInputRecommendations,
  getAllInputRules,
} from '../../lib/inputTimingEngine.js';
import { generateTasksForFarm } from '../../lib/farmTaskEngine.js';

function readFile(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  1. Input timing rules structure and coverage
// ═══════════════════════════════════════════════════════════
describe('Input timing rules structure', () => {
  it('exports INPUT_TIMING_RULES array with 14 rules', () => {
    expect(Array.isArray(INPUT_TIMING_RULES)).toBe(true);
    expect(INPUT_TIMING_RULES.length).toBe(14);
  });

  it('covers maize with 4 rules', () => {
    const maize = INPUT_TIMING_RULES.filter(r => r.crops.includes('maize'));
    expect(maize.length).toBe(4);
  });

  it('covers rice with 3 rules', () => {
    const rice = INPUT_TIMING_RULES.filter(r => r.crops.includes('rice'));
    expect(rice.length).toBe(3);
  });

  it('covers cassava with 2 rules', () => {
    const cassava = INPUT_TIMING_RULES.filter(r => r.crops.includes('cassava'));
    expect(cassava.length).toBe(2);
  });

  it('covers tomato with 3 rules', () => {
    const tomato = INPUT_TIMING_RULES.filter(r => r.crops.includes('tomato'));
    expect(tomato.length).toBe(3);
  });

  it('covers cocoa with 2 rules', () => {
    const cocoa = INPUT_TIMING_RULES.filter(r => r.crops.includes('cocoa'));
    expect(cocoa.length).toBe(2);
  });

  it('every rule has required fields', () => {
    for (const rule of INPUT_TIMING_RULES) {
      expect(rule.id).toBeTruthy();
      expect(Array.isArray(rule.crops)).toBe(true);
      expect(Array.isArray(rule.stages)).toBe(true);
      expect(rule.category).toBeTruthy();
      expect(PRIORITY_ORDER).toContain(rule.basePriority);
      expect(rule.title).toBeTruthy();
      expect(rule.delayTitle).toBeTruthy();
      expect(rule.reason).toBeTruthy();
      expect(rule.action).toBeTruthy();
      expect(rule.delayAction).toBeTruthy();
      expect(rule.dueLabel).toBeTruthy();
    }
  });

  it('every rule has unique id', () => {
    const ids = INPUT_TIMING_RULES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses valid categories', () => {
    const validCats = ['fertilizer', 'irrigation', 'soil', 'pest-control', 'planting-input', 'other'];
    for (const rule of INPUT_TIMING_RULES) {
      expect(validCats).toContain(rule.category);
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  2. Priority adjustment helper
// ═══════════════════════════════════════════════════════════
describe('adjustPriority', () => {
  it('raises low to medium', () => {
    expect(adjustPriority('low', +1)).toBe('medium');
  });

  it('raises medium to high', () => {
    expect(adjustPriority('medium', +1)).toBe('high');
  });

  it('caps at high', () => {
    expect(adjustPriority('high', +1)).toBe('high');
  });

  it('lowers high to medium', () => {
    expect(adjustPriority('high', -1)).toBe('medium');
  });

  it('floors at low', () => {
    expect(adjustPriority('low', -1)).toBe('low');
  });
});

// ═══════════════════════════════════════════════════════════
//  3. Weather helpers
// ═══════════════════════════════════════════════════════════
describe('Weather helpers', () => {
  it('hasHeavyRainRisk', () => {
    expect(hasHeavyRainRisk({ heavyRainRisk: true })).toBe(true);
    expect(hasHeavyRainRisk({ heavyRainRisk: false })).toBe(false);
    expect(hasHeavyRainRisk(null)).toBe(false);
  });

  it('hasRainExpected', () => {
    expect(hasRainExpected({ rainExpected: true })).toBe(true);
    expect(hasRainExpected({ rainExpected: false })).toBe(false);
  });

  it('hasDrySpellRisk', () => {
    expect(hasDrySpellRisk({ drySpellRisk: true })).toBe(true);
    expect(hasDrySpellRisk({ drySpellRisk: false })).toBe(false);
  });

  it('hasHighHumidity', () => {
    expect(hasHighHumidity({ humidityPct: 90 })).toBe(true);
    expect(hasHighHumidity({ humidityPct: 60 })).toBe(false);
    expect(hasHighHumidity(null)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
//  4. Input timing engine — generateInputRecommendations
// ═══════════════════════════════════════════════════════════
describe('generateInputRecommendations', () => {
  it('returns array of recommendations', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
    });
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
  });

  it('each recommendation has required fields', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'tomato', stage: 'flowering',
    });
    for (const r of recs) {
      expect(r.id).toBeTruthy();
      expect(r.farmId).toBe('f1');
      expect(r.category).toBeTruthy();
      expect(PRIORITY_ORDER).toContain(r.priority);
      expect(r.title).toBeTruthy();
      expect(r.reason).toBeTruthy();
      expect(r.action).toBeTruthy();
      expect(r.dueLabel).toBeTruthy();
      expect(typeof r.isDelayed).toBe('boolean');
      expect(typeof r.weatherAdjusted).toBe('boolean');
    }
  });

  it('returns empty for unknown crop', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'banana', stage: 'vegetative',
    });
    expect(recs.length).toBe(0);
  });

  it('sorts by priority — high first', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
    });
    if (recs.length > 1) {
      const priorities = recs.map(r => PRIORITY_ORDER.indexOf(r.priority));
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  5. Weather delay behavior
// ═══════════════════════════════════════════════════════════
describe('Input timing — weather delay', () => {
  it('delays maize topdress fertilizer during heavy rain', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
      weather: { hasWeatherData: true, heavyRainRisk: true, rainExpected: true, drySpellRisk: false, humidityPct: 70 },
    });
    const topdress = recs.find(r => r.id.includes('topdress'));
    expect(topdress).toBeTruthy();
    expect(topdress.isDelayed).toBe(true);
    expect(topdress.title).toContain('Delay');
    expect(topdress.weatherAdjusted).toBe(true);
  });

  it('delays maize planting fertilizer during heavy rain', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'maize', stage: 'planting',
      weather: { hasWeatherData: true, heavyRainRisk: true, rainExpected: true, drySpellRisk: false, humidityPct: 60 },
    });
    const basal = recs.find(r => r.id.includes('planting-fertilizer'));
    expect(basal).toBeTruthy();
    expect(basal.isDelayed).toBe(true);
  });

  it('delays tomato fungicide when rain expected', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'tomato', stage: 'flowering',
      weather: { hasWeatherData: true, rainExpected: true, heavyRainRisk: false, drySpellRisk: false, humidityPct: 60 },
    });
    const fungicide = recs.find(r => r.id.includes('disease-prevention'));
    expect(fungicide).toBeTruthy();
    expect(fungicide.isDelayed).toBe(true);
  });

  it('delays cocoa sanitation spray when rain expected', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'cocoa', stage: 'fruiting',
      weather: { hasWeatherData: true, rainExpected: true, heavyRainRisk: false, drySpellRisk: false, humidityPct: 70 },
    });
    const sanitation = recs.find(r => r.id.includes('sanitation'));
    expect(sanitation).toBeTruthy();
    expect(sanitation.isDelayed).toBe(true);
  });

  it('does not delay when conditions are favorable', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
      weather: { hasWeatherData: true, heavyRainRisk: false, rainExpected: false, drySpellRisk: false, humidityPct: 60 },
    });
    const topdress = recs.find(r => r.id.includes('topdress'));
    expect(topdress).toBeTruthy();
    expect(topdress.isDelayed).toBe(false);
    expect(topdress.title).not.toContain('Delay');
  });
});

// ═══════════════════════════════════════════════════════════
//  6. Weather boost behavior
// ═══════════════════════════════════════════════════════════
describe('Input timing — weather boost', () => {
  it('boosts rice water management during dry spell', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'rice', stage: 'vegetative',
      weather: { hasWeatherData: true, drySpellRisk: true, heavyRainRisk: false, rainExpected: false, humidityPct: 40 },
    });
    const water = recs.find(r => r.id.includes('water-management'));
    expect(water).toBeTruthy();
    expect(water.priority).toBe('high'); // medium boosted to high
    expect(water.weatherAdjusted).toBe(true);
  });

  it('boosts tomato fungicide when humidity is high', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'tomato', stage: 'vegetative',
      weather: { hasWeatherData: true, humidityPct: 90, rainExpected: false, heavyRainRisk: false, drySpellRisk: false },
    });
    const fungicide = recs.find(r => r.id.includes('disease-prevention'));
    expect(fungicide).toBeTruthy();
    expect(fungicide.priority).toBe('high'); // medium boosted to high
  });
});

// ═══════════════════════════════════════════════════════════
//  7. Crop/stage filtering
// ═══════════════════════════════════════════════════════════
describe('Input timing — crop/stage filtering', () => {
  it('returns maize recommendations for land_preparation', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'maize', stage: 'land_preparation',
    });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some(r => r.id.includes('landprep'))).toBe(true);
  });

  it('returns rice recommendations for planting', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'rice', stage: 'planting',
    });
    expect(recs.some(r => r.id.includes('rice-planting'))).toBe(true);
  });

  it('returns cassava recommendations for germination', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'cassava', stage: 'germination',
    });
    expect(recs.some(r => r.id.includes('cassava-early'))).toBe(true);
  });

  it('returns cocoa recommendations for flowering', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'cocoa', stage: 'flowering',
    });
    expect(recs.length).toBeGreaterThan(0);
  });

  it('returns empty for post_harvest (no input rules)', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'maize', stage: 'post_harvest',
    });
    expect(recs.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
//  8. Fallback (no weather)
// ═══════════════════════════════════════════════════════════
describe('Input timing — fallback', () => {
  it('adds confidenceNote when no weather data', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
    });
    for (const r of recs) {
      expect(r.confidenceNote).toBeTruthy();
      expect(r.confidenceNote).toContain('Weather data unavailable');
    }
  });

  it('has null confidenceNote when weather data is available', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
      weather: { hasWeatherData: true, heavyRainRisk: false, rainExpected: false, drySpellRisk: false, humidityPct: 60 },
    });
    for (const r of recs) {
      expect(r.confidenceNote).toBeNull();
    }
  });

  it('uses basePriority without weather', () => {
    const recs = generateInputRecommendations({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
    });
    const topdress = recs.find(r => r.id.includes('topdress'));
    expect(topdress.priority).toBe('high'); // base priority
    expect(topdress.isDelayed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
//  9. Task engine — input-based task injection
// ═══════════════════════════════════════════════════════════
describe('Task engine — input-based tasks', () => {
  it('injects high-priority input recs as tasks', () => {
    const inputRecs = [{
      id: 'maize-vegetative-topdress-f1',
      priority: 'high',
      title: 'Apply first top-dress fertilizer',
      action: 'Apply urea',
      reason: 'Nitrogen needed',
      dueLabel: 'This week',
      category: 'fertilizer',
      isDelayed: false,
      crop: 'maize',
      stage: 'vegetative',
    }];
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      inputRecs,
    });
    const inputTasks = tasks.filter(t => t.id.startsWith('input-task-'));
    expect(inputTasks.length).toBe(1);
    expect(inputTasks[0].inputNote).toContain('fertilizer');
    expect(inputTasks[0].priority).toBe('high');
  });

  it('does not inject medium-priority input recs as tasks', () => {
    const inputRecs = [{
      id: 'tomato-disease-prevention-f1',
      priority: 'medium',
      title: 'Preventive fungicide',
      action: 'Apply copper',
      reason: 'Fungal risk',
      dueLabel: 'This week',
      category: 'pest-control',
      isDelayed: false,
      crop: 'tomato',
      stage: 'flowering',
    }];
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'tomato', stage: 'flowering', farmerType: 'new',
      inputRecs,
    });
    const inputTasks = tasks.filter(t => t.id.startsWith('input-task-'));
    expect(inputTasks.length).toBe(0);
  });

  it('marks delayed input tasks with delay note', () => {
    const inputRecs = [{
      id: 'maize-vegetative-topdress-f1',
      priority: 'high',
      title: 'Delay top-dress fertilizer',
      action: 'Wait for rain to pass',
      reason: 'Nitrogen needed',
      dueLabel: 'This week',
      category: 'fertilizer',
      isDelayed: true,
      crop: 'maize',
      stage: 'vegetative',
    }];
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      inputRecs,
    });
    const inputTasks = tasks.filter(t => t.id.startsWith('input-task-'));
    expect(inputTasks[0].inputNote).toContain('Delayed');
  });

  it('works without inputRecs', () => {
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
    });
    const inputTasks = tasks.filter(t => t.id.startsWith('input-task-'));
    expect(inputTasks.length).toBe(0);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('source file contains input injection logic', () => {
    const engine = readFile('server/lib/farmTaskEngine.js');
    expect(engine).toContain('inputRecs');
    expect(engine).toContain('input-task-');
    expect(engine).toContain('inputNote');
  });
});

// ═══════════════════════════════════════════════════════════
// 10. Farm inputs route
// ═══════════════════════════════════════════════════════════
describe('Farm inputs route', () => {
  const route = readFile('server/routes/farmInputs.js');

  it('imports authenticate middleware', () => {
    expect(route).toContain('authenticate');
  });

  it('imports generateInputRecommendations', () => {
    expect(route).toContain('generateInputRecommendations');
  });

  it('has GET /:farmId endpoint', () => {
    expect(route).toContain("'/:farmId'");
  });

  it('checks farm ownership via userId', () => {
    expect(route).toContain('req.user.id');
  });

  it('returns 404 if farm not found', () => {
    expect(route).toContain('404');
    expect(route).toContain('Farm not found');
  });

  it('handles archived farms', () => {
    expect(route).toContain('archived');
  });

  it('fetches weather for context', () => {
    expect(route).toContain('getWeatherForFarm');
  });

  it('builds seasonal context', () => {
    expect(route).toContain('getSeasonalContext');
  });

  it('notes rules-based provider', () => {
    expect(route).toContain('rules-based');
  });
});

// ═══════════════════════════════════════════════════════════
// 11. Farm tasks route — input integration
// ═══════════════════════════════════════════════════════════
describe('Farm tasks route — input integration', () => {
  const route = readFile('server/routes/farmTasks.js');

  it('imports generateInputRecommendations', () => {
    expect(route).toContain('generateInputRecommendations');
  });

  it('passes inputRecs to generateTasksForFarm', () => {
    expect(route).toContain('inputRecs: farmInputRecs');
  });

  it('returns inputRecs in response', () => {
    expect(route).toContain('inputRecs: farmInputRecs');
  });

  it('handles input generation failure gracefully', () => {
    expect(route).toContain('non-blocking');
  });
});

// ═══════════════════════════════════════════════════════════
// 12. Frontend API
// ═══════════════════════════════════════════════════════════
describe('Frontend API — farm inputs', () => {
  const api = readFile('src/lib/api.js');

  it('exports getFarmInputs', () => {
    expect(api).toContain('export function getFarmInputs');
  });

  it('calls /api/v2/farm-inputs/ endpoint', () => {
    expect(api).toContain('/api/v2/farm-inputs/');
  });
});

// ═══════════════════════════════════════════════════════════
// 13. FarmInputTimingCard component
// ═══════════════════════════════════════════════════════════
describe('FarmInputTimingCard component', () => {
  const card = readFile('src/components/FarmInputTimingCard.jsx');

  it('imports getFarmInputs', () => {
    expect(card).toContain('getFarmInputs');
  });

  it('uses currentFarmId from profile context', () => {
    expect(card).toContain('currentFarmId');
  });

  it('has data-testid farm-input-timing-card', () => {
    expect(card).toContain('farm-input-timing-card');
  });

  it('displays recommendation title', () => {
    expect(card).toContain('rec.title');
  });

  it('displays priority', () => {
    expect(card).toContain('rec.priority');
  });

  it('displays dueLabel', () => {
    expect(card).toContain('rec.dueLabel');
  });

  it('displays reason', () => {
    expect(card).toContain('rec.reason');
  });

  it('displays action', () => {
    expect(card).toContain('rec.action');
  });

  it('shows delay tag when delayed', () => {
    expect(card).toContain('isDelayed');
    expect(card).toContain('delay-tag');
    expect(card).toContain('inputTiming.delayed');
  });

  it('shows confidence note', () => {
    expect(card).toContain('confidenceNote');
  });

  it('shows category icons', () => {
    expect(card).toContain('CATEGORY_ICONS');
    expect(card).toContain('fertilizer');
    expect(card).toContain('irrigation');
  });

  it('clears recs on farm switch', () => {
    expect(card).toContain('prevFarmIdRef');
  });

  it('handles empty state', () => {
    expect(card).toContain('inputTiming.noRecs');
  });
});

// ═══════════════════════════════════════════════════════════
// 14. FarmTasksCard — inputNote rendering
// ═══════════════════════════════════════════════════════════
describe('FarmTasksCard — input note', () => {
  const card = readFile('src/components/FarmTasksCard.jsx');

  it('renders inputNote when present', () => {
    expect(card).toContain('task.inputNote');
  });

  it('has inputNote style', () => {
    expect(card).toContain('inputNote');
  });
});

// ═══════════════════════════════════════════════════════════
// 15. FarmInputTimingCard — component exists
// ═══════════════════════════════════════════════════════════
describe('FarmInputTimingCard — exists as standalone component', () => {
  it('FarmInputTimingCard component file exists', () => {
    const exists = fs.existsSync(path.resolve(process.cwd(), 'src/components/FarmInputTimingCard.jsx'));
    expect(exists).toBe(true);
  });

  it('FarmInputTimingCard exports a default function', () => {
    const card = readFile('src/components/FarmInputTimingCard.jsx');
    expect(card).toContain('export default function FarmInputTimingCard');
  });
});

// ═══════════════════════════════════════════════════════════
// 16. App route registration
// ═══════════════════════════════════════════════════════════
describe('App route registration', () => {
  const app = readFile('server/src/app.js');

  it('imports farm input routes', () => {
    expect(app).toContain('v2FarmInputRoutes');
  });

  it('mounts at /api/v2/farm-inputs', () => {
    expect(app).toContain('/api/v2/farm-inputs');
  });
});

// ═══════════════════════════════════════════════════════════
// 17. i18n — input timing keys
// ═══════════════════════════════════════════════════════════
describe('i18n — input timing keys', () => {
  const translations = readFile('src/i18n/translations.js');

  const requiredKeys = [
    'inputTiming.title',
    'inputTiming.loading',
    'inputTiming.noRecs',
    'inputTiming.items',
    'inputTiming.delayed',
    'inputTiming.priority.high',
    'inputTiming.priority.medium',
    'inputTiming.priority.low',
  ];

  for (const key of requiredKeys) {
    it(`has ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('has translations in all 5 languages for inputTiming.title', () => {
    const idx = translations.indexOf("'inputTiming.title'");
    const chunk = translations.slice(idx, idx + 300);
    expect(chunk).toContain('en:');
    expect(chunk).toContain('fr:');
    expect(chunk).toContain('sw:');
    expect(chunk).toContain('ha:');
    expect(chunk).toContain('tw:');
  });
});

// ═══════════════════════════════════════════════════════════
// 18. getAllInputRules
// ═══════════════════════════════════════════════════════════
describe('getAllInputRules', () => {
  it('returns the same rules array', () => {
    expect(getAllInputRules()).toBe(INPUT_TIMING_RULES);
  });
});
