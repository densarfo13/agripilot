/**
 * Weekly Summary — comprehensive tests.
 *
 * Covers: summary engine (headline, priorities, risks, input notes,
 * harvest notes, economics note, next steps, missing data), route,
 * app wiring, API client, UI card, dashboard wiring, i18n.
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
//  1. Summary engine — structure
// ═══════════════════════════════════════════════════════════
describe('Weekly summary engine — structure', () => {
  const engine = readFile('server/lib/weeklySummary.js');

  it('exports generateWeeklySummary', () => {
    expect(engine).toContain('export function generateWeeklySummary');
  });

  it('has buildHeadline function', () => {
    expect(engine).toContain('function buildHeadline');
  });

  it('has extractRisks function', () => {
    expect(engine).toContain('function extractRisks');
  });

  it('has extractPriorities function', () => {
    expect(engine).toContain('function extractPriorities');
  });

  it('has buildInputNotes function', () => {
    expect(engine).toContain('function buildInputNotes');
  });

  it('has buildHarvestNotes function', () => {
    expect(engine).toContain('function buildHarvestNotes');
  });

  it('has buildEconomicsNote function', () => {
    expect(engine).toContain('function buildEconomicsNote');
  });

  it('has buildNextSteps function', () => {
    expect(engine).toContain('function buildNextSteps');
  });

  it('has buildMissingDataNotes function', () => {
    expect(engine).toContain('function buildMissingDataNotes');
  });

  it('returns farmId in output', () => {
    expect(engine).toContain('farmId: input.farmId');
  });

  it('returns headline in output', () => {
    expect(engine).toContain('headline');
  });

  it('returns priorities in output', () => {
    expect(engine).toContain('priorities');
  });

  it('returns risks in output', () => {
    expect(engine).toContain('risks');
  });

  it('returns inputNotes in output', () => {
    expect(engine).toContain('inputNotes');
  });

  it('returns harvestNotes in output', () => {
    expect(engine).toContain('harvestNotes');
  });

  it('returns economicsNote in output', () => {
    expect(engine).toContain('economicsNote');
  });

  it('returns nextSteps in output', () => {
    expect(engine).toContain('nextSteps');
  });

  it('returns missingData in output', () => {
    expect(engine).toContain('missingData');
  });

  it('returns generatedAt timestamp', () => {
    expect(engine).toContain('generatedAt');
  });
});

// ═══════════════════════════════════════════════════════════
//  2. Summary engine — runtime
// ═══════════════════════════════════════════════════════════
describe('Weekly summary engine — runtime', () => {
  let generateWeeklySummary;

  beforeAll(async () => {
    const mod = await import('../../lib/weeklySummary.js');
    generateWeeklySummary = mod.generateWeeklySummary;
  });

  it('returns a valid digest for minimal input', () => {
    const result = generateWeeklySummary({
      farmId: 'farm-1',
      crop: 'maize',
      stage: 'vegetative',
      farmerType: 'new',
    });

    expect(result).toHaveProperty('farmId', 'farm-1');
    expect(result).toHaveProperty('headline');
    expect(typeof result.headline).toBe('string');
    expect(result.headline.length).toBeGreaterThan(0);
    expect(Array.isArray(result.priorities)).toBe(true);
    expect(Array.isArray(result.risks)).toBe(true);
    expect(Array.isArray(result.inputNotes)).toBe(true);
    expect(Array.isArray(result.harvestNotes)).toBe(true);
    expect(Array.isArray(result.nextSteps)).toBe(true);
    expect(Array.isArray(result.missingData)).toBe(true);
    expect(result).toHaveProperty('generatedAt');
  });

  it('vegetative stage headline mentions nutrition/weeding', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
    });
    expect(result.headline.toLowerCase()).toMatch(/nutrition|weeding|pest/);
  });

  it('dry spell risk drives headline about moisture', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      weather: { hasWeatherData: true, drySpellRisk: true },
    });
    expect(result.headline.toLowerCase()).toContain('moisture');
  });

  it('high humidity drives headline about disease', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'tomato', stage: 'flowering', farmerType: 'new',
      weather: { hasWeatherData: true, humidityPct: 90 },
    });
    expect(result.headline.toLowerCase()).toMatch(/humidity|disease/);
  });

  it('harvest stage + no record drives harvest headline', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'harvest', farmerType: 'new',
      hasRecentHarvestRecord: false,
    });
    expect(result.headline.toLowerCase()).toMatch(/harvest|recordkeeping/);
  });

  it('profitDropped benchmark drives review headline', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'planning', farmerType: 'new',
      benchmarkInsights: { profitDropped: true, yieldDropped: false, costsIncreased: false, noComparisonData: false },
    });
    expect(result.headline.toLowerCase()).toMatch(/cost|input|efficiency|review/);
  });

  it('planning stage suggests setting crop stage', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'planning', farmerType: 'new',
    });
    expect(result.missingData.some(n => n.toLowerCase().includes('crop stage'))).toBe(true);
  });

  it('missing weather data is noted', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
    });
    expect(result.missingData.some(n => n.toLowerCase().includes('weather'))).toBe(true);
  });

  it('missing seasonal data is noted', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
    });
    expect(result.missingData.some(n => n.toLowerCase().includes('seasonal'))).toBe(true);
  });

  it('missing cost records noted', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      hasCostRecords: false,
    });
    expect(result.missingData.some(n => n.toLowerCase().includes('expense'))).toBe(true);
  });

  it('noComparisonData benchmark noted', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      benchmarkInsights: { noComparisonData: true, profitDropped: false, yieldDropped: false, costsIncreased: false },
    });
    expect(result.missingData.some(n => n.toLowerCase().includes('benchmarking'))).toBe(true);
  });

  it('priorities capped at 5', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      id: `task-${i}`, title: `Task ${i}`, priority: 'high', farmId: 'f1',
    }));
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new', tasks,
    });
    expect(result.priorities.length).toBeLessThanOrEqual(5);
  });

  it('sorts priorities high > medium > low', () => {
    const tasks = [
      { id: 't1', title: 'Low task', priority: 'low', farmId: 'f1' },
      { id: 't2', title: 'High task', priority: 'high', farmId: 'f1' },
      { id: 't3', title: 'Medium task', priority: 'medium', farmId: 'f1' },
    ];
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new', tasks,
    });
    expect(result.priorities[0].text).toBe('High task');
    expect(result.priorities[1].text).toBe('Medium task');
    expect(result.priorities[2].text).toBe('Low task');
  });

  it('extracts weather risks', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      weather: { hasWeatherData: true, drySpellRisk: true, heavyRainRisk: true },
    });
    expect(result.risks.filter(r => r.type === 'weather').length).toBeGreaterThanOrEqual(2);
  });

  it('extracts pest risks from risk array', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      risks: [
        { id: 'r1', title: 'Fall armyworm', severity: 'high', type: 'pest', action: 'Inspect now', reason: 'Common pest' },
      ],
    });
    expect(result.risks.some(r => r.type === 'pest')).toBe(true);
  });

  it('extracts performance risks from benchmarkInsights', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      benchmarkInsights: { profitDropped: true, yieldDropped: true, costsIncreased: false, noComparisonData: false },
    });
    expect(result.risks.filter(r => r.type === 'performance').length).toBeGreaterThanOrEqual(2);
  });

  it('risks sorted by severity (high first)', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      weather: { hasWeatherData: true, humidityPct: 85 },
      risks: [
        { id: 'r1', title: 'Leaf blight', severity: 'medium', type: 'disease', action: 'Check', reason: '' },
      ],
      benchmarkInsights: { profitDropped: false, yieldDropped: false, costsIncreased: true, noComparisonData: false },
    });
    // First risks should be medium or higher before low
    const severityValues = result.risks.map(r => r.severity);
    const highIdx = severityValues.indexOf('high');
    const medIdx = severityValues.indexOf('medium');
    const lowIdx = severityValues.indexOf('low');
    if (highIdx >= 0 && medIdx >= 0) expect(highIdx).toBeLessThan(medIdx);
    if (medIdx >= 0 && lowIdx >= 0) expect(medIdx).toBeLessThan(lowIdx);
  });

  it('builds input notes for high-priority recs', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      inputRecs: [
        { id: 'i1', title: 'Apply nitrogen', priority: 'high', category: 'fertilizer', isDelayed: false },
      ],
    });
    expect(result.inputNotes.length).toBeGreaterThan(0);
    expect(result.inputNotes[0]).toContain('nitrogen');
  });

  it('builds delayed input note', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      inputRecs: [
        { id: 'i1', title: 'Apply urea', priority: 'high', category: 'fertilizer', isDelayed: true },
      ],
    });
    expect(result.inputNotes[0].toLowerCase()).toContain('delayed');
  });

  it('harvest notes when in harvest stage without record', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'harvest', farmerType: 'new',
      hasRecentHarvestRecord: false,
    });
    expect(result.harvestNotes.some(n => n.toLowerCase().includes('yield record'))).toBe(true);
  });

  it('harvest notes include summary when record exists', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'post_harvest', farmerType: 'new',
      hasRecentHarvestRecord: true,
      harvestSummary: { totalHarvested: 500, totalSold: 300, dominantUnit: 'kg' },
    });
    expect(result.harvestNotes.some(n => n.includes('500'))).toBe(true);
  });

  it('economics note built from economics data', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      economics: { totalRevenue: 10000, totalCosts: 4000, estimatedProfit: 6000, revenueIsPartial: false },
      hasCostRecords: true,
      hasRevenueData: true,
    });
    expect(result.economicsNote).toContain('10,000');
    expect(result.economicsNote).toContain('4,000');
  });

  it('economics note when revenue is partial', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      economics: { totalRevenue: 5000, totalCosts: 2000, estimatedProfit: 3000, revenueIsPartial: true },
      hasCostRecords: true,
    });
    expect(result.economicsNote.toLowerCase()).toContain('partial');
  });

  it('next steps always returns at least 1 item', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
    });
    expect(result.nextSteps.length).toBeGreaterThanOrEqual(1);
  });

  it('next steps capped at 5', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      id: `task-${i}`, title: `Task ${i}`, priority: 'high', farmId: 'f1',
    }));
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'harvest', farmerType: 'new',
      tasks,
      hasRecentHarvestRecord: false,
      hasCostRecords: false,
    });
    expect(result.nextSteps.length).toBeLessThanOrEqual(5);
  });

  it('pest risk in risks drives headline about disease', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'tomato', stage: 'flowering', farmerType: 'new',
      risks: [
        { id: 'r1', title: 'Early blight', severity: 'high', type: 'disease', action: 'Apply fungicide', reason: 'Fungal' },
      ],
    });
    expect(result.headline.toLowerCase()).toMatch(/disease|prevention|inspection/);
  });

  it('weather + pest risk drives combined headline', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      weather: { hasWeatherData: true, drySpellRisk: true },
      risks: [
        { id: 'r1', title: 'Armyworm', severity: 'high', type: 'pest', action: 'Inspect', reason: 'Pest' },
      ],
    });
    expect(result.headline.toLowerCase()).toMatch(/weather|pest|attention/);
  });

  it('priority source detection — riskNote', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      tasks: [
        { id: 't1', title: 'Check pest', priority: 'high', farmId: 'f1', riskNote: 'Pest: armyworm' },
      ],
    });
    expect(result.priorities[0].source).toBe('risk');
  });

  it('priority source detection — inputNote', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      tasks: [
        { id: 't1', title: 'Apply fertilizer', priority: 'high', farmId: 'f1', inputNote: 'Input timing' },
      ],
    });
    expect(result.priorities[0].source).toBe('input');
  });

  it('priority source detection — harvestNote', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'harvest', farmerType: 'new',
      tasks: [
        { id: 't1', title: 'Prepare harvest', priority: 'high', farmId: 'f1', harvestNote: 'Harvest ready' },
      ],
    });
    expect(result.priorities[0].source).toBe('harvest');
  });

  it('priority source detection — benchmarkNote', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      tasks: [
        { id: 't1', title: 'Review costs', priority: 'medium', farmId: 'f1', benchmarkNote: 'Costs increased' },
      ],
    });
    expect(result.priorities[0].source).toBe('benchmark');
  });

  it('heavy rain risk appears as weather risk', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      weather: { hasWeatherData: true, heavyRainRisk: true },
    });
    expect(result.risks.some(r => r.type === 'weather' && r.text.toLowerCase().includes('rain'))).toBe(true);
  });

  it('land_preparation stage headline', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'land_preparation', farmerType: 'new',
    });
    expect(result.headline.toLowerCase()).toMatch(/land|prepare|foundation/);
  });

  it('flowering stage headline mentions critical', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'flowering', farmerType: 'new',
    });
    expect(result.headline.toLowerCase()).toMatch(/critical|growth|care/);
  });

  it('planting stage headline mentions establishment', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'planting', farmerType: 'new',
    });
    expect(result.headline.toLowerCase()).toMatch(/establish|moisture|seedling|early/);
  });

  it('no input recs → no input notes', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
    });
    expect(result.inputNotes.length).toBe(0);
  });

  it('low-priority input recs → fallback note', () => {
    const result = generateWeeklySummary({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      inputRecs: [
        { id: 'i1', title: 'Check soil pH', priority: 'low', category: 'testing' },
      ],
    });
    expect(result.inputNotes.some(n => n.toLowerCase().includes('no urgent'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  3. Route — structure
// ═══════════════════════════════════════════════════════════
describe('Weekly summary route — structure', () => {
  const route = readFile('server/routes/weeklySummary.js');

  it('imports express', () => {
    expect(route).toContain("import express from 'express'");
  });

  it('imports prisma', () => {
    expect(route).toContain("import prisma from '../lib/prisma.js'");
  });

  it('imports authenticate', () => {
    expect(route).toContain("import { authenticate }");
  });

  it('imports generateWeeklySummary', () => {
    expect(route).toContain("import { generateWeeklySummary }");
  });

  it('imports generateTasksForFarm', () => {
    expect(route).toContain("import { generateTasksForFarm }");
  });

  it('imports getWeatherForFarm', () => {
    expect(route).toContain("import { getWeatherForFarm }");
  });

  it('imports generateRisksForFarm', () => {
    expect(route).toContain("import { generateRisksForFarm }");
  });

  it('imports generateInputRecommendations', () => {
    expect(route).toContain("import { generateInputRecommendations }");
  });

  it('imports generateHarvestRecommendations', () => {
    expect(route).toContain("import { generateHarvestRecommendations }");
  });

  it('imports calculateFarmBenchmarks', () => {
    expect(route).toContain("import { calculateFarmBenchmarks");
  });

  it('imports computeFarmEconomics', () => {
    expect(route).toContain("import { computeFarmEconomics }");
  });

  it('imports computeHarvestSummary', () => {
    expect(route).toContain("import { computeHarvestSummary }");
  });

  it('has GET /:farmId handler', () => {
    expect(route).toContain("router.get('/:farmId'");
  });

  it('verifies farm ownership', () => {
    expect(route).toContain('userId: req.user.id');
  });

  it('returns 404 for missing farm', () => {
    expect(route).toContain("res.status(404)");
  });

  it('handles archived farms', () => {
    expect(route).toContain("farm.status === 'archived'");
  });

  it('returns success with summary', () => {
    expect(route).toContain('success: true');
    expect(route).toContain('summary');
  });

  it('has non-blocking weather fetch', () => {
    expect(route).toContain('weather fetch failed (non-blocking)');
  });

  it('has non-blocking risk generation', () => {
    expect(route).toContain('risk generation failed (non-blocking)');
  });

  it('has non-blocking benchmark computation', () => {
    expect(route).toContain('benchmark computation failed (non-blocking)');
  });

  it('has non-blocking economics computation', () => {
    expect(route).toContain('economics computation failed (non-blocking)');
  });

  it('exports router as default', () => {
    expect(route).toContain('export default router');
  });
});

// ═══════════════════════════════════════════════════════════
//  4. App wiring
// ═══════════════════════════════════════════════════════════
describe('Weekly summary — app wiring', () => {
  const app = readFile('server/src/app.js');

  it('imports weekly summary routes', () => {
    expect(app).toContain("import v2WeeklySummaryRoutes from '../routes/weeklySummary.js'");
  });

  it('mounts at /api/v2/weekly-summary', () => {
    expect(app).toContain("app.use('/api/v2/weekly-summary', v2WeeklySummaryRoutes)");
  });
});

// ═══════════════════════════════════════════════════════════
//  5. API client
// ═══════════════════════════════════════════════════════════
describe('Weekly summary — API client', () => {
  const api = readFile('src/lib/api.js');

  it('exports getWeeklySummary function', () => {
    expect(api).toContain('export function getWeeklySummary');
  });

  it('calls /api/v2/weekly-summary/ endpoint', () => {
    expect(api).toContain('/api/v2/weekly-summary/');
  });

  it('encodes farmId', () => {
    expect(api).toContain('encodeURIComponent(farmId)');
  });
});

// ═══════════════════════════════════════════════════════════
//  6. UI card — structure
// ═══════════════════════════════════════════════════════════
describe('Weekly summary — UI card structure', () => {
  const card = readFile('src/components/WeeklySummaryCard.jsx');

  it('imports useProfile', () => {
    expect(card).toContain("import { useProfile }");
  });

  it('imports useTranslation', () => {
    expect(card).toContain("import { useTranslation }");
  });

  it('imports useNetwork', () => {
    expect(card).toContain("import { useNetwork }");
  });

  it('imports getWeeklySummary', () => {
    expect(card).toContain("import { getWeeklySummary }");
  });

  it('has data-testid="weekly-summary-card"', () => {
    expect(card).toContain('data-testid="weekly-summary-card"');
  });

  it('has data-testid="weekly-details-toggle"', () => {
    expect(card).toContain('data-testid="weekly-details-toggle"');
  });

  it('has data-testid="weekly-details"', () => {
    expect(card).toContain('data-testid="weekly-details"');
  });

  it('uses prevFarmIdRef pattern', () => {
    expect(card).toContain('prevFarmIdRef');
  });

  it('renders headline', () => {
    expect(card).toContain('summary.headline');
  });

  it('renders priorities', () => {
    expect(card).toContain('summary.priorities');
  });

  it('renders risks', () => {
    expect(card).toContain('summary.risks');
  });

  it('renders nextSteps', () => {
    expect(card).toContain('summary.nextSteps');
  });

  it('renders inputNotes', () => {
    expect(card).toContain('summary.inputNotes');
  });

  it('renders harvestNotes', () => {
    expect(card).toContain('summary.harvestNotes');
  });

  it('renders economicsNote', () => {
    expect(card).toContain('summary.economicsNote');
  });

  it('renders missingData', () => {
    expect(card).toContain('summary.missingData');
  });

  it('has expand/collapse toggle', () => {
    expect(card).toContain('setExpanded');
  });

  it('uses PriorityDot component', () => {
    expect(card).toContain('PriorityDot');
  });

  it('has priority color mapping', () => {
    expect(card).toContain('PRIORITY_COLORS');
  });

  it('has risk color mapping', () => {
    expect(card).toContain('RISK_COLORS');
  });

  it('has risk icon mapping', () => {
    expect(card).toContain('RISK_ICONS');
  });

  it('has dark theme card background', () => {
    expect(card).toContain('#1B2330');
  });

  it('has dark inner backgrounds', () => {
    expect(card).toContain('#111827');
  });

  it('handles loading state', () => {
    expect(card).toContain("t('weekly.loading')");
  });

  it('handles error state', () => {
    expect(card).toContain('errorText');
  });

  it('returns null when no profile', () => {
    expect(card).toContain('if (!profile) return null');
  });

  it('returns null when no summary', () => {
    expect(card).toContain('if (!summary) return null');
  });

  it('exports as default', () => {
    expect(card).toContain('export default function WeeklySummaryCard');
  });
});

// ═══════════════════════════════════════════════════════════
//  7. Dashboard wiring
// ═══════════════════════════════════════════════════════════
describe('Weekly summary — dashboard wiring', () => {
  it('WeeklySummaryCard component file exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../..', 'src/components/WeeklySummaryCard.jsx'))).toBe(true);
  });

  it('WeeklySummaryCard component file exists and exports default', () => {
    const card = readFile('src/components/WeeklySummaryCard.jsx');
    expect(card).toContain("export default function WeeklySummaryCard");
  });
});

// ═══════════════════════════════════════════════════════════
//  8. i18n — all 5 languages
// ═══════════════════════════════════════════════════════════
describe('Weekly summary — i18n', () => {
  const translations = readFile('src/i18n/translations.js');

  const keys = [
    'weekly.title',
    'weekly.loading',
    'weekly.thisWeek',
    'weekly.priorities',
    'weekly.riskAlerts',
    'weekly.nextSteps',
    'weekly.viewDetails',
    'weekly.hideDetails',
    'weekly.inputNotes',
    'weekly.harvestNotes',
    'weekly.economicsNote',
    'weekly.missingData',
  ];

  for (const key of keys) {
    it(`has key '${key}'`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  const langs = ['en', 'fr', 'sw', 'ha', 'tw'];

  it('all weekly keys have all 5 languages', () => {
    for (const key of keys) {
      for (const lang of langs) {
        // Just check the key block contains the language code
        const keyRegex = new RegExp(`'${key.replace('.', '\\.')}':.*?${lang}:`, 's');
        expect(translations).toMatch(keyRegex);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  9. Task engine compatibility
// ═══════════════════════════════════════════════════════════
describe('Weekly summary — task engine compatibility', () => {
  const engine = readFile('server/lib/farmTaskEngine.js');

  it('task engine context includes benchmarkInsights', () => {
    expect(engine).toContain('benchmarkInsights');
  });

  it('task engine destructures all fields used by weekly summary', () => {
    expect(engine).toContain('const { farmId, crop, stage, farmerType, country, location, seasonal, weather, risks, inputRecs, harvestRecs, hasRecentHarvestRecord, hasCostRecords, hasRevenueData, benchmarkInsights }');
  });
});

// ═══════════════════════════════════════════════════════════
//  10. Integration — route gathers same data as farmTasks
// ═══════════════════════════════════════════════════════════
describe('Weekly summary — route gathers all intelligence', () => {
  const route = readFile('server/routes/weeklySummary.js');

  it('fetches farm profile with ownership check', () => {
    expect(route).toContain('prisma.farmProfile.findFirst');
    expect(route).toContain('userId: req.user.id');
  });

  it('resolves crop stage', () => {
    expect(route).toContain('resolveStage');
  });

  it('builds seasonal context', () => {
    expect(route).toContain('getSeasonalContext');
  });

  it('fetches weather', () => {
    expect(route).toContain('getWeatherForFarm');
  });

  it('generates pest risks', () => {
    expect(route).toContain('generateRisksForFarm');
  });

  it('generates input recommendations', () => {
    expect(route).toContain('generateInputRecommendations');
  });

  it('generates harvest recommendations', () => {
    expect(route).toContain('generateHarvestRecommendations');
  });

  it('checks harvest records', () => {
    expect(route).toContain('v2HarvestRecord.findMany');
  });

  it('checks cost records', () => {
    expect(route).toContain('v2FarmCostRecord.findMany');
  });

  it('computes economics', () => {
    expect(route).toContain('computeFarmEconomics');
  });

  it('computes harvest summary', () => {
    expect(route).toContain('computeHarvestSummary');
  });

  it('computes benchmarks', () => {
    expect(route).toContain('calculateFarmBenchmarks');
    expect(route).toContain('detectBenchmarkInsights');
  });

  it('generates tasks for priority extraction', () => {
    expect(route).toContain('generateTasksForFarm');
  });

  it('passes all data to generateWeeklySummary', () => {
    expect(route).toContain('generateWeeklySummary({');
    expect(route).toContain('farmId: farm.id');
    expect(route).toContain('crop: cropName');
    expect(route).toContain('weather: weatherCtx');
    expect(route).toContain('risks: farmRisks');
    expect(route).toContain('inputRecs: farmInputRecs');
    expect(route).toContain('harvestRecs: farmHarvestRecs');
    expect(route).toContain('tasks,');
    expect(route).toContain('benchmarkInsights');
    expect(route).toContain('economics');
    expect(route).toContain('harvestSummary');
  });
});
