/**
 * Pest & Disease Risk Integration — comprehensive tests.
 *
 * Tests cover:
 *  1. Risk rules structure and coverage
 *  2. Severity adjustment helper
 *  3. Weather condition helpers
 *  4. Risk engine — generateRisksForFarm
 *  5. Risk engine — weather-based severity adjustment
 *  6. Risk engine — crop/stage filtering
 *  7. Risk engine — fallback behavior (no weather)
 *  8. Task engine — risk-based task injection
 *  9. Farm risks route structure
 * 10. Farm tasks route — risk integration
 * 11. Frontend API function
 * 12. FarmPestRiskCard component
 * 13. FarmTasksCard riskNote rendering
 * 14. Dashboard wiring
 * 15. App route registration
 * 16. i18n keys
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  RISK_RULES,
  adjustSeverity,
  SEVERITY_ORDER,
  isHighHumidity,
  isRainy,
  isDrySpell,
  isHot,
  isWarm,
} from '../../lib/pestRiskRules.js';
import {
  generateRisksForFarm,
  generateTasksFromRisks,
  getAllRiskRules,
} from '../../lib/pestRiskEngine.js';
import { generateTasksForFarm } from '../../lib/farmTaskEngine.js';

function readFile(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  1. Risk rules structure and coverage
// ═══════════════════════════════════════════════════════════
describe('Risk rules structure', () => {
  it('exports RISK_RULES array with 10 rules', () => {
    expect(Array.isArray(RISK_RULES)).toBe(true);
    expect(RISK_RULES.length).toBe(10);
  });

  it('covers maize with fall armyworm and leaf blight', () => {
    const maize = RISK_RULES.filter(r => r.crops.includes('maize'));
    expect(maize.length).toBe(2);
    const ids = maize.map(r => r.id);
    expect(ids).toContain('maize-fall-armyworm');
    expect(ids).toContain('maize-leaf-blight');
  });

  it('covers tomato with fungal disease and leaf miner', () => {
    const tomato = RISK_RULES.filter(r => r.crops.includes('tomato'));
    expect(tomato.length).toBe(2);
    const ids = tomato.map(r => r.id);
    expect(ids).toContain('tomato-fungal-disease');
    expect(ids).toContain('tomato-leaf-miner');
  });

  it('covers rice with blast and stem borer', () => {
    const rice = RISK_RULES.filter(r => r.crops.includes('rice'));
    expect(rice.length).toBe(2);
    const ids = rice.map(r => r.id);
    expect(ids).toContain('rice-blast');
    expect(ids).toContain('rice-stem-borer');
  });

  it('covers cassava with mosaic and mealybug', () => {
    const cassava = RISK_RULES.filter(r => r.crops.includes('cassava'));
    expect(cassava.length).toBe(2);
    const ids = cassava.map(r => r.id);
    expect(ids).toContain('cassava-mosaic');
    expect(ids).toContain('cassava-mealybug');
  });

  it('covers cocoa with black pod and capsid', () => {
    const cocoa = RISK_RULES.filter(r => r.crops.includes('cocoa'));
    expect(cocoa.length).toBe(2);
    const ids = cocoa.map(r => r.id);
    expect(ids).toContain('cocoa-black-pod');
    expect(ids).toContain('cocoa-capsid');
  });

  it('every rule has required fields', () => {
    for (const rule of RISK_RULES) {
      expect(rule.id).toBeTruthy();
      expect(Array.isArray(rule.crops)).toBe(true);
      expect(Array.isArray(rule.stages)).toBe(true);
      expect(['pest', 'disease']).toContain(rule.type);
      expect(SEVERITY_ORDER).toContain(rule.baseSeverity);
      expect(rule.title).toBeTruthy();
      expect(rule.reason).toBeTruthy();
      expect(rule.action).toBeTruthy();
    }
  });

  it('every rule has unique id', () => {
    const ids = RISK_RULES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ═══════════════════════════════════════════════════════════
//  2. Severity adjustment helper
// ═══════════════════════════════════════════════════════════
describe('adjustSeverity', () => {
  it('raises low to medium', () => {
    expect(adjustSeverity('low', +1)).toBe('medium');
  });

  it('raises medium to high', () => {
    expect(adjustSeverity('medium', +1)).toBe('high');
  });

  it('caps at high', () => {
    expect(adjustSeverity('high', +1)).toBe('high');
  });

  it('lowers medium to low', () => {
    expect(adjustSeverity('medium', -1)).toBe('low');
  });

  it('lowers high to medium', () => {
    expect(adjustSeverity('high', -1)).toBe('medium');
  });

  it('floors at low', () => {
    expect(adjustSeverity('low', -1)).toBe('low');
  });
});

// ═══════════════════════════════════════════════════════════
//  3. Weather condition helpers
// ═══════════════════════════════════════════════════════════
describe('Weather condition helpers', () => {
  it('isHighHumidity returns true when > 80%', () => {
    expect(isHighHumidity({ humidityPct: 85 })).toBe(true);
    expect(isHighHumidity({ humidityPct: 60 })).toBe(false);
    expect(isHighHumidity(null)).toBe(false);
  });

  it('isRainy returns true when rain expected or heavy rain risk', () => {
    expect(isRainy({ rainExpected: true })).toBe(true);
    expect(isRainy({ heavyRainRisk: true })).toBe(true);
    expect(isRainy({ rainExpected: false, heavyRainRisk: false })).toBe(false);
  });

  it('isDrySpell returns true when dry spell risk', () => {
    expect(isDrySpell({ drySpellRisk: true })).toBe(true);
    expect(isDrySpell({ drySpellRisk: false })).toBe(false);
  });

  it('isHot returns true when > 32°C', () => {
    expect(isHot({ temperatureC: 35 })).toBe(true);
    expect(isHot({ temperatureC: 28 })).toBe(false);
  });

  it('isWarm returns true when > 25°C', () => {
    expect(isWarm({ temperatureC: 28 })).toBe(true);
    expect(isWarm({ temperatureC: 20 })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
//  4. Risk engine — generateRisksForFarm
// ═══════════════════════════════════════════════════════════
describe('generateRisksForFarm', () => {
  it('returns array of risks', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
    });
    expect(Array.isArray(risks)).toBe(true);
    expect(risks.length).toBeGreaterThan(0);
  });

  it('each risk has required fields', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'tomato', stage: 'flowering',
    });
    for (const r of risks) {
      expect(r.id).toBeTruthy();
      expect(r.farmId).toBe('f1');
      expect(['pest', 'disease']).toContain(r.type);
      expect(SEVERITY_ORDER).toContain(r.severity);
      expect(r.title).toBeTruthy();
      expect(r.reason).toBeTruthy();
      expect(r.action).toBeTruthy();
      expect(r.crop).toBe('tomato');
      expect(r.stage).toBe('flowering');
    }
  });

  it('returns empty array for unknown crop', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'banana', stage: 'vegetative',
    });
    expect(risks.length).toBe(0);
  });

  it('returns empty array for non-matching stage', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'post_harvest',
    });
    expect(risks.length).toBe(0);
  });

  it('sorts by severity — high first', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
      weather: { hasWeatherData: true, drySpellRisk: true, temperatureC: 30, humidityPct: 40 },
    });
    if (risks.length > 1) {
      const severities = risks.map(r => SEVERITY_ORDER.indexOf(r.severity));
      for (let i = 1; i < severities.length; i++) {
        expect(severities[i]).toBeLessThanOrEqual(severities[i - 1]);
      }
    }
  });

  it('includes farmId in risk id', () => {
    const risks = generateRisksForFarm({
      farmId: 'xyz', crop: 'rice', stage: 'vegetative',
    });
    for (const r of risks) {
      expect(r.id).toContain('xyz');
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  5. Risk engine — weather-based severity adjustment
// ═══════════════════════════════════════════════════════════
describe('Risk engine — weather adjustment', () => {
  it('boosts maize armyworm risk during dry spell', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
      weather: { hasWeatherData: true, drySpellRisk: true, temperatureC: 30, humidityPct: 40, rainExpected: false, heavyRainRisk: false },
    });
    const armyworm = risks.find(r => r.id.includes('armyworm'));
    expect(armyworm).toBeTruthy();
    expect(armyworm.severity).toBe('high'); // medium boosted to high
    expect(armyworm.weatherAdjusted).toBe(true);
  });

  it('boosts tomato fungal disease risk in high humidity + rain', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'tomato', stage: 'flowering',
      weather: { hasWeatherData: true, humidityPct: 90, rainExpected: true, heavyRainRisk: false, drySpellRisk: false, temperatureC: 28 },
    });
    const fungal = risks.find(r => r.id.includes('fungal'));
    expect(fungal).toBeTruthy();
    expect(fungal.severity).toBe('high');
    expect(fungal.weatherAdjusted).toBe(true);
  });

  it('boosts cocoa black pod risk in rainy + humid conditions', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'cocoa', stage: 'fruiting',
      weather: { hasWeatherData: true, humidityPct: 88, rainExpected: true, heavyRainRisk: true, drySpellRisk: false, temperatureC: 26 },
    });
    const blackPod = risks.find(r => r.id.includes('black-pod'));
    expect(blackPod).toBeTruthy();
    expect(blackPod.severity).toBe('high');
    expect(blackPod.weatherAdjusted).toBe(true);
  });

  it('reduces cocoa capsid risk in rainy + humid conditions', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'cocoa', stage: 'fruiting',
      weather: { hasWeatherData: true, humidityPct: 88, rainExpected: true, heavyRainRisk: true, drySpellRisk: false, temperatureC: 26 },
    });
    const capsid = risks.find(r => r.id.includes('capsid'));
    expect(capsid).toBeTruthy();
    expect(capsid.weatherAdjusted).toBe(true);
    // low base, reduced stays low
    expect(capsid.severity).toBe('low');
  });

  it('reduces cassava mosaic risk in rainy conditions', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'cassava', stage: 'vegetative',
      weather: { hasWeatherData: true, rainExpected: true, heavyRainRisk: false, drySpellRisk: false, humidityPct: 70, temperatureC: 25 },
    });
    const mosaic = risks.find(r => r.id.includes('mosaic'));
    expect(mosaic).toBeTruthy();
    expect(mosaic.severity).toBe('low'); // medium reduced to low
    expect(mosaic.weatherAdjusted).toBe(true);
  });

  it('marks weatherAdjusted = false when no weather data', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
    });
    for (const r of risks) {
      expect(r.weatherAdjusted).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  6. Risk engine — crop/stage filtering
// ═══════════════════════════════════════════════════════════
describe('Risk engine — crop/stage filtering', () => {
  it('returns maize risks for vegetative stage', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
    });
    expect(risks.length).toBe(2);
    expect(risks.some(r => r.id.includes('armyworm'))).toBe(true);
    expect(risks.some(r => r.id.includes('leaf-blight'))).toBe(true);
  });

  it('returns rice risks for flowering stage', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'rice', stage: 'flowering',
    });
    expect(risks.length).toBe(2);
    expect(risks.some(r => r.id.includes('blast'))).toBe(true);
    expect(risks.some(r => r.id.includes('stem-borer'))).toBe(true);
  });

  it('returns cocoa risks for fruiting stage', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'cocoa', stage: 'fruiting',
    });
    expect(risks.length).toBe(2);
    expect(risks.some(r => r.id.includes('black-pod'))).toBe(true);
    expect(risks.some(r => r.id.includes('capsid'))).toBe(true);
  });

  it('returns cassava risks for germination stage', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'cassava', stage: 'germination',
    });
    // Only mosaic applies at germination
    expect(risks.some(r => r.id.includes('mosaic'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  7. Risk engine — fallback behavior (no weather)
// ═══════════════════════════════════════════════════════════
describe('Risk engine — fallback behavior', () => {
  it('adds confidenceNote when no weather data', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
    });
    for (const r of risks) {
      expect(r.confidenceNote).toBeTruthy();
      expect(r.confidenceNote).toContain('Weather data unavailable');
    }
  });

  it('has null confidenceNote when weather data is available', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative',
      weather: { hasWeatherData: true, humidityPct: 60, rainExpected: false, heavyRainRisk: false, drySpellRisk: false, temperatureC: 28 },
    });
    for (const r of risks) {
      expect(r.confidenceNote).toBeNull();
    }
  });

  it('still generates risks without weather — uses baseSeverity', () => {
    const risks = generateRisksForFarm({
      farmId: 'f1', crop: 'tomato', stage: 'flowering',
    });
    expect(risks.length).toBeGreaterThan(0);
    const fungal = risks.find(r => r.id.includes('fungal'));
    expect(fungal.severity).toBe('medium'); // base, no adjustment
  });
});

// ═══════════════════════════════════════════════════════════
//  8. generateTasksFromRisks
// ═══════════════════════════════════════════════════════════
describe('generateTasksFromRisks', () => {
  it('generates tasks from high/medium risks', () => {
    const risks = [
      { id: 'r1-f1', severity: 'high', type: 'pest', crop: 'maize', title: 'Fall armyworm risk', action: 'Scout fields', reason: 'Destructive pest' },
      { id: 'r2-f1', severity: 'low', type: 'disease', crop: 'maize', title: 'Leaf blight', action: 'Check leaves', reason: 'Minor risk' },
    ];
    const tasks = generateTasksFromRisks(risks, 'f1');
    expect(tasks.length).toBe(1); // only high
    expect(tasks[0].priority).toBe('high');
    expect(tasks[0].riskNote).toContain('Pest risk');
  });

  it('generates tasks for medium severity', () => {
    const risks = [
      { id: 'r1-f1', severity: 'medium', type: 'disease', crop: 'tomato', title: 'Fungal disease risk', action: 'Apply fungicide', reason: 'Humid conditions' },
    ];
    const tasks = generateTasksFromRisks(risks, 'f1');
    expect(tasks.length).toBe(1);
    expect(tasks[0].priority).toBe('medium');
    expect(tasks[0].riskNote).toContain('Disease risk');
  });

  it('returns empty for low severity only', () => {
    const risks = [
      { id: 'r1-f1', severity: 'low', type: 'pest', crop: 'rice', title: 'Watch', action: 'Monitor', reason: 'Low' },
    ];
    const tasks = generateTasksFromRisks(risks, 'f1');
    expect(tasks.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
//  9. Task engine — risk-based task injection
// ═══════════════════════════════════════════════════════════
describe('Task engine — risk-based tasks', () => {
  it('injects risk tasks when risks are provided', () => {
    const risks = [
      { id: 'maize-fall-armyworm-f1', severity: 'high', type: 'pest', crop: 'maize', title: 'Fall armyworm risk', action: 'Scout fields', reason: 'Destructive pest' },
    ];
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      risks,
    });
    const riskTasks = tasks.filter(t => t.id.startsWith('risk-task-'));
    expect(riskTasks.length).toBe(1);
    expect(riskTasks[0].riskNote).toContain('Pest risk');
    expect(riskTasks[0].priority).toBe('high');
  });

  it('does not inject low-severity risk tasks', () => {
    const risks = [
      { id: 'maize-leaf-blight-f1', severity: 'low', type: 'disease', crop: 'maize', title: 'Leaf blight', action: 'Check', reason: 'Minor' },
    ];
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      risks,
    });
    const riskTasks = tasks.filter(t => t.id.startsWith('risk-task-'));
    expect(riskTasks.length).toBe(0);
  });

  it('works without risks provided', () => {
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
    });
    const riskTasks = tasks.filter(t => t.id.startsWith('risk-task-'));
    expect(riskTasks.length).toBe(0);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('source file contains risk injection logic', () => {
    const engine = readFile('server/lib/farmTaskEngine.js');
    expect(engine).toContain('risks');
    expect(engine).toContain('risk.severity');
    expect(engine).toContain('riskNote');
    expect(engine).toContain('risk-task-');
  });
});

// ═══════════════════════════════════════════════════════════
// 10. Farm risks route
// ═══════════════════════════════════════════════════════════
describe('Farm risks route', () => {
  const route = readFile('server/routes/farmRisks.js');

  it('imports authenticate middleware', () => {
    expect(route).toContain('authenticate');
  });

  it('imports generateRisksForFarm', () => {
    expect(route).toContain('generateRisksForFarm');
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

  it('fetches weather for risk context', () => {
    expect(route).toContain('getWeatherForFarm');
  });

  it('builds seasonal context', () => {
    expect(route).toContain('getSeasonalContext');
  });
});

// ═══════════════════════════════════════════════════════════
// 11. Farm tasks route — risk integration
// ═══════════════════════════════════════════════════════════
describe('Farm tasks route — risk integration', () => {
  const route = readFile('server/routes/farmTasks.js');

  it('imports generateRisksForFarm', () => {
    expect(route).toContain('generateRisksForFarm');
  });

  it('generates risks for the farm', () => {
    expect(route).toContain('generateRisksForFarm');
  });

  it('passes risks to generateTasksForFarm', () => {
    expect(route).toContain('risks: farmRisks');
  });

  it('returns risks in response', () => {
    expect(route).toContain('risks: farmRisks');
  });

  it('handles risk generation failure gracefully', () => {
    expect(route).toContain('non-blocking');
  });
});

// ═══════════════════════════════════════════════════════════
// 12. Frontend API
// ═══════════════════════════════════════════════════════════
describe('Frontend API — farm risks', () => {
  const api = readFile('src/lib/api.js');

  it('exports getFarmRisks', () => {
    expect(api).toContain('export function getFarmRisks');
  });

  it('calls /api/v2/farm-risks/ endpoint', () => {
    expect(api).toContain('/api/v2/farm-risks/');
  });
});

// ═══════════════════════════════════════════════════════════
// 13. FarmPestRiskCard component
// ═══════════════════════════════════════════════════════════
describe('FarmPestRiskCard component', () => {
  const card = readFile('src/components/FarmPestRiskCard.jsx');

  it('imports getFarmRisks', () => {
    expect(card).toContain('getFarmRisks');
  });

  it('uses currentFarmId from profile context', () => {
    expect(card).toContain('currentFarmId');
  });

  it('has data-testid farm-pest-risk-card', () => {
    expect(card).toContain('farm-pest-risk-card');
  });

  it('displays risk title', () => {
    expect(card).toContain('risk.title');
  });

  it('displays severity badge', () => {
    expect(card).toContain('severityBadge');
    expect(card).toContain('risk.severity');
  });

  it('displays risk reason', () => {
    expect(card).toContain('risk.reason');
  });

  it('displays recommended action', () => {
    expect(card).toContain('risk.action');
  });

  it('shows confidence note when available', () => {
    expect(card).toContain('confidenceNote');
  });

  it('shows weather-adjusted tag', () => {
    expect(card).toContain('weatherAdjusted');
    expect(card).toContain('pestRisk.weatherAdjusted');
  });

  it('shows pest/disease icons', () => {
    expect(card).toContain('🐛');
    expect(card).toContain('🦠');
  });

  it('clears risks on farm switch', () => {
    expect(card).toContain('prevFarmIdRef');
  });

  it('handles empty state', () => {
    expect(card).toContain('pestRisk.noRisks');
  });

  it('shows high alert count', () => {
    expect(card).toContain('pestRisk.highAlerts');
  });
});

// ═══════════════════════════════════════════════════════════
// 14. FarmTasksCard — riskNote rendering
// ═══════════════════════════════════════════════════════════
describe('FarmTasksCard — risk note', () => {
  const card = readFile('src/components/FarmTasksCard.jsx');

  it('renders riskNote when present', () => {
    expect(card).toContain('task.riskNote');
  });

  it('has riskNote style', () => {
    expect(card).toContain('riskNote');
  });
});

// ═══════════════════════════════════════════════════════════
// 15. Dashboard — FarmPestRiskCard wiring
// ═══════════════════════════════════════════════════════════
describe('Dashboard — FarmPestRiskCard', () => {
  const dash = readFile('src/pages/Dashboard.jsx');

  it('imports FarmPestRiskCard', () => {
    expect(dash).toContain("import FarmPestRiskCard from '../components/FarmPestRiskCard.jsx'");
  });

  it('renders FarmPestRiskCard', () => {
    expect(dash).toContain('<FarmPestRiskCard');
  });
});

// ═══════════════════════════════════════════════════════════
// 16. App route registration
// ═══════════════════════════════════════════════════════════
describe('App route registration', () => {
  const app = readFile('server/src/app.js');

  it('imports farm risk routes', () => {
    expect(app).toContain('v2FarmRiskRoutes');
  });

  it('mounts at /api/v2/farm-risks', () => {
    expect(app).toContain('/api/v2/farm-risks');
  });
});

// ═══════════════════════════════════════════════════════════
// 17. i18n — pest risk keys
// ═══════════════════════════════════════════════════════════
describe('i18n — pest risk keys', () => {
  const translations = readFile('src/i18n/translations.js');

  const requiredKeys = [
    'pestRisk.title',
    'pestRisk.loading',
    'pestRisk.noRisks',
    'pestRisk.highAlerts',
    'pestRisk.severity.high',
    'pestRisk.severity.medium',
    'pestRisk.severity.low',
    'pestRisk.weatherAdjusted',
  ];

  for (const key of requiredKeys) {
    it(`has ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('has translations in all 5 languages for pestRisk.title', () => {
    const idx = translations.indexOf("'pestRisk.title'");
    const chunk = translations.slice(idx, idx + 300);
    expect(chunk).toContain('en:');
    expect(chunk).toContain('fr:');
    expect(chunk).toContain('sw:');
    expect(chunk).toContain('ha:');
    expect(chunk).toContain('tw:');
  });
});

// ═══════════════════════════════════════════════════════════
// 18. getAllRiskRules export
// ═══════════════════════════════════════════════════════════
describe('getAllRiskRules', () => {
  it('returns the same rules array', () => {
    expect(getAllRiskRules()).toBe(RISK_RULES);
  });
});
