/**
 * Farm Benchmarking — comprehensive tests.
 *
 * Covers: benchmarking engine (periods, metrics, trends, insights),
 * validation, route, task engine integration, API client, UI card,
 * dashboard wiring, i18n.
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
//  1. Benchmarking engine — structure
// ═══════════════════════════════════════════════════════════
describe('Benchmarking engine — structure', () => {
  const engine = readFile('server/lib/farmBenchmarking.js');

  it('exports calculateFarmBenchmarks', () => {
    expect(engine).toContain('export function calculateFarmBenchmarks');
  });

  it('exports detectBenchmarkInsights', () => {
    expect(engine).toContain('export function detectBenchmarkInsights');
  });

  it('exports validateBenchmarkQuery', () => {
    expect(engine).toContain('export function validateBenchmarkQuery');
  });

  it('exports buildDefaultPeriods', () => {
    expect(engine).toContain('export function buildDefaultPeriods');
  });

  it('exports buildYearPeriods', () => {
    expect(engine).toContain('export function buildYearPeriods');
  });

  it('exports benchmarkQuerySchema', () => {
    expect(engine).toContain('export const benchmarkQuerySchema');
  });

  it('defines trend types', () => {
    expect(engine).toContain("'up'");
    expect(engine).toContain("'down'");
    expect(engine).toContain("'flat'");
    expect(engine).toContain("'no_data'");
  });

  it('filters by period using date ranges', () => {
    expect(engine).toContain('filterByPeriod');
  });

  it('computes percentage change', () => {
    expect(engine).toContain('changePercent');
  });

  it('handles insufficient data', () => {
    expect(engine).toContain('insufficientDataReason');
    expect(engine).toContain('hasEnoughData');
  });
});

// ═══════════════════════════════════════════════════════════
//  2. Benchmarking engine — runtime
// ═══════════════════════════════════════════════════════════
describe('Benchmarking engine — runtime', () => {
  let calculateFarmBenchmarks, detectBenchmarkInsights, validateBenchmarkQuery,
    buildDefaultPeriods, buildYearPeriods;

  beforeAll(async () => {
    const mod = await import('../../lib/farmBenchmarking.js');
    calculateFarmBenchmarks = mod.calculateFarmBenchmarks;
    detectBenchmarkInsights = mod.detectBenchmarkInsights;
    validateBenchmarkQuery = mod.validateBenchmarkQuery;
    buildDefaultPeriods = mod.buildDefaultPeriods;
    buildYearPeriods = mod.buildYearPeriods;
  });

  // ─── Period builders ──────────────────
  it('buildDefaultPeriods returns two 6-month periods', () => {
    const p = buildDefaultPeriods();
    expect(p.current).toBeTruthy();
    expect(p.previous).toBeTruthy();
    expect(p.current.label).toContain('Current');
    expect(p.previous.label).toContain('Previous');
  });

  it('buildYearPeriods returns two 12-month periods', () => {
    const p = buildYearPeriods();
    expect(p.current.label).toContain('12 months');
    expect(p.previous.label).toContain('12 months');
  });

  // ─── Validation ───────────────────────
  it('validates empty query', () => {
    const result = validateBenchmarkQuery({});
    expect(result.success).toBe(true);
  });

  it('validates mode parameter', () => {
    expect(validateBenchmarkQuery({ mode: 'season' }).success).toBe(true);
    expect(validateBenchmarkQuery({ mode: 'year' }).success).toBe(true);
    expect(validateBenchmarkQuery({ mode: 'custom' }).success).toBe(true);
    expect(validateBenchmarkQuery({ mode: 'invalid' }).success).toBe(false);
  });

  it('validates date parameters', () => {
    expect(validateBenchmarkQuery({ currentStart: '2026-01-01' }).success).toBe(true);
    expect(validateBenchmarkQuery({ currentStart: 'bad-date' }).success).toBe(false);
  });

  // ─── Benchmarks with no data ──────────
  it('handles empty records', () => {
    const result = calculateFarmBenchmarks({
      farmId: 'bench-1',
      harvestRecords: [],
      costRecords: [],
    });
    expect(result.hasEnoughData).toBe(false);
    expect(result.insufficientDataReason).toBeTruthy();
    expect(result.yield.trend).toBe('no_data');
  });

  // ─── Benchmarks with current only ─────
  it('shows insufficient when only current period has data', () => {
    const now = new Date();
    const result = calculateFarmBenchmarks({
      farmId: 'bench-2',
      harvestRecords: [
        { harvestDate: now.toISOString(), quantityHarvested: 500, quantitySold: 300, averageSellingPrice: 5 },
      ],
      costRecords: [
        { date: now.toISOString(), amount: 200, category: 'seeds' },
      ],
    });
    expect(result.hasEnoughData).toBe(false);
    expect(result.insufficientDataReason).toContain('Not enough past data');
    expect(result.currentTotals.totalHarvested).toBe(500);
  });

  // ─── Full comparison ──────────────────
  it('computes full comparison with both periods', () => {
    const currentDate = new Date();
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 7);

    const result = calculateFarmBenchmarks({
      farmId: 'bench-3',
      harvestRecords: [
        { harvestDate: currentDate.toISOString(), quantityHarvested: 600, quantitySold: 400, averageSellingPrice: 5 },
        { harvestDate: prevDate.toISOString(), quantityHarvested: 400, quantitySold: 300, averageSellingPrice: 4 },
      ],
      costRecords: [
        { date: currentDate.toISOString(), amount: 500, category: 'seeds' },
        { date: prevDate.toISOString(), amount: 400, category: 'seeds' },
      ],
    });

    expect(result.hasEnoughData).toBe(true);
    expect(result.yield.current).toBe(600);
    expect(result.yield.previous).toBe(400);
    expect(result.yield.trend).toBe('up');
    expect(result.yield.changePercent).toBe(50);
    expect(result.revenue.current).toBe(2000);
    expect(result.revenue.previous).toBe(1200);
    expect(result.costs.current).toBe(500);
    expect(result.costs.previous).toBe(400);
    expect(result.profit.current).toBe(1500);
    expect(result.profit.previous).toBe(800);
  });

  // ─── Trends ───────────────────────────
  it('detects down trend', () => {
    const currentDate = new Date();
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 7);

    const result = calculateFarmBenchmarks({
      farmId: 'bench-4',
      harvestRecords: [
        { harvestDate: currentDate.toISOString(), quantityHarvested: 200, quantitySold: 100, averageSellingPrice: 3 },
        { harvestDate: prevDate.toISOString(), quantityHarvested: 500, quantitySold: 400, averageSellingPrice: 5 },
      ],
      costRecords: [],
    });

    expect(result.yield.trend).toBe('down');
    expect(result.revenue.trend).toBe('down');
  });

  it('detects flat trend', () => {
    const currentDate = new Date();
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 7);

    const result = calculateFarmBenchmarks({
      farmId: 'bench-5',
      harvestRecords: [
        { harvestDate: currentDate.toISOString(), quantityHarvested: 500 },
        { harvestDate: prevDate.toISOString(), quantityHarvested: 500 },
      ],
      costRecords: [],
    });

    expect(result.yield.trend).toBe('flat');
    expect(result.yield.changePercent).toBe(0);
  });

  // ─── Custom periods ───────────────────
  it('supports custom periods', () => {
    const result = calculateFarmBenchmarks({
      farmId: 'bench-6',
      harvestRecords: [
        { harvestDate: '2026-03-01', quantityHarvested: 100 },
        { harvestDate: '2025-03-01', quantityHarvested: 80 },
      ],
      costRecords: [],
      currentPeriod: { label: 'Q1 2026', startDate: '2026-01-01', endDate: '2026-04-01' },
      previousPeriod: { label: 'Q1 2025', startDate: '2025-01-01', endDate: '2025-04-01' },
    });

    expect(result.currentPeriod.label).toBe('Q1 2026');
    expect(result.previousPeriod.label).toBe('Q1 2025');
    expect(result.yield.current).toBe(100);
    expect(result.yield.previous).toBe(80);
  });

  // ─── Year mode ────────────────────────
  it('supports year mode', () => {
    const result = calculateFarmBenchmarks({
      farmId: 'bench-7',
      harvestRecords: [],
      costRecords: [],
      mode: 'year',
    });
    expect(result.currentPeriod.label).toContain('12 months');
  });

  // ─── Revenue null when no price data ──
  it('returns null revenue when no price data', () => {
    const currentDate = new Date();
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 7);

    const result = calculateFarmBenchmarks({
      farmId: 'bench-8',
      harvestRecords: [
        { harvestDate: currentDate.toISOString(), quantityHarvested: 500 },
        { harvestDate: prevDate.toISOString(), quantityHarvested: 400 },
      ],
      costRecords: [],
    });

    expect(result.revenue.current).toBeNull();
    expect(result.revenue.previous).toBeNull();
    expect(result.profit.current).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
//  3. Benchmark insights
// ═══════════════════════════════════════════════════════════
describe('Benchmark insights — runtime', () => {
  let detectBenchmarkInsights;

  beforeAll(async () => {
    const mod = await import('../../lib/farmBenchmarking.js');
    detectBenchmarkInsights = mod.detectBenchmarkInsights;
  });

  it('returns noComparisonData when no benchmark', () => {
    const result = detectBenchmarkInsights(null);
    expect(result.noComparisonData).toBe(true);
  });

  it('returns noComparisonData when not enough data', () => {
    const result = detectBenchmarkInsights({ hasEnoughData: false });
    expect(result.noComparisonData).toBe(true);
  });

  it('detects profit drop (>=10%)', () => {
    const result = detectBenchmarkInsights({
      hasEnoughData: true,
      profit: { trend: 'down', changePercent: -25 },
      yield: { trend: 'flat', changePercent: 0 },
      costs: { trend: 'flat', changePercent: 0 },
    });
    expect(result.profitDropped).toBe(true);
    expect(result.noComparisonData).toBe(false);
  });

  it('detects yield drop (>=10%)', () => {
    const result = detectBenchmarkInsights({
      hasEnoughData: true,
      profit: { trend: 'flat', changePercent: 0 },
      yield: { trend: 'down', changePercent: -15 },
      costs: { trend: 'flat', changePercent: 0 },
    });
    expect(result.yieldDropped).toBe(true);
  });

  it('detects costs increase (>=15%)', () => {
    const result = detectBenchmarkInsights({
      hasEnoughData: true,
      profit: { trend: 'flat', changePercent: 0 },
      yield: { trend: 'flat', changePercent: 0 },
      costs: { trend: 'up', changePercent: 20 },
    });
    expect(result.costsIncreased).toBe(true);
  });

  it('returns false for all when metrics are good', () => {
    const result = detectBenchmarkInsights({
      hasEnoughData: true,
      profit: { trend: 'up', changePercent: 10 },
      yield: { trend: 'up', changePercent: 5 },
      costs: { trend: 'down', changePercent: -3 },
    });
    expect(result.profitDropped).toBe(false);
    expect(result.yieldDropped).toBe(false);
    expect(result.costsIncreased).toBe(false);
    expect(result.noComparisonData).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
//  4. Route — structure
// ═══════════════════════════════════════════════════════════
describe('Benchmarks route — structure', () => {
  const route = readFile('server/routes/farmBenchmarks.js');

  it('uses authenticate middleware', () => {
    expect(route).toContain('authenticate');
  });

  it('has GET endpoint', () => {
    expect(route).toContain("router.get('/:farmId', authenticate");
  });

  it('verifies farm ownership', () => {
    expect(route).toContain('userId: req.user.id');
  });

  it('returns 404 for missing farm', () => {
    expect(route).toContain('Farm not found');
  });

  it('fetches both harvest and cost records', () => {
    expect(route).toContain('v2HarvestRecord.findMany');
    expect(route).toContain('v2FarmCostRecord.findMany');
  });

  it('calls calculateFarmBenchmarks', () => {
    expect(route).toContain('calculateFarmBenchmarks');
  });

  it('calls detectBenchmarkInsights', () => {
    expect(route).toContain('detectBenchmarkInsights');
  });

  it('validates query params', () => {
    expect(route).toContain('validateBenchmarkQuery');
  });

  it('supports mode parameter', () => {
    expect(route).toContain('query.mode');
  });

  it('supports custom periods', () => {
    expect(route).toContain('currentStart');
    expect(route).toContain('previousEnd');
  });
});

// ═══════════════════════════════════════════════════════════
//  5. App — route registration
// ═══════════════════════════════════════════════════════════
describe('App — benchmarks route registration', () => {
  const app = readFile('server/src/app.js');

  it('imports farm benchmark routes', () => {
    expect(app).toContain('farmBenchmarks');
  });

  it('mounts at /api/v2/farm-benchmarks', () => {
    expect(app).toContain('/api/v2/farm-benchmarks');
  });
});

// ═══════════════════════════════════════════════════════════
//  6. API client
// ═══════════════════════════════════════════════════════════
describe('API client — farm benchmarks', () => {
  const api = readFile('src/lib/api.js');

  it('exports getFarmBenchmarks', () => {
    expect(api).toContain('export function getFarmBenchmarks');
  });

  it('calls /api/v2/farm-benchmarks endpoint', () => {
    expect(api).toContain('/api/v2/farm-benchmarks/');
  });

  it('supports mode parameter', () => {
    expect(api).toContain('mode=');
  });
});

// ═══════════════════════════════════════════════════════════
//  7. Task engine — benchmark integration
// ═══════════════════════════════════════════════════════════
describe('Task engine — benchmark integration', () => {
  const engine = readFile('server/lib/farmTaskEngine.js');

  it('accepts benchmarkInsights in context', () => {
    expect(engine).toContain('benchmarkInsights');
    expect(engine).toContain('benchmarkInsights } = context');
  });

  it('generates benchmark-data-prompt when no comparison data', () => {
    expect(engine).toContain('benchmark-data-prompt');
    expect(engine).toContain('Keep logging harvest and costs to unlock performance comparison');
  });

  it('generates profit review task on profit drop', () => {
    expect(engine).toContain('benchmark-profit-review');
    expect(engine).toContain('Review input costs and selling prices');
  });

  it('generates yield review task on yield drop', () => {
    expect(engine).toContain('benchmark-yield-review');
    expect(engine).toContain('Review crop stage, timing, and losses');
  });

  it('generates cost review task on cost increase', () => {
    expect(engine).toContain('benchmark-cost-review');
    expect(engine).toContain('Review fertilizer timing and costs');
  });

  it('adds benchmarkNote to tasks', () => {
    expect(engine).toContain('benchmarkNote');
  });

  it('has JSDoc for benchmarkInsights', () => {
    expect(engine).toContain('@property');
    expect(engine).toContain('benchmarkInsights');
  });
});

// ═══════════════════════════════════════════════════════════
//  8. Task engine — benchmark tasks runtime
// ═══════════════════════════════════════════════════════════
describe('Task engine — benchmark tasks runtime', () => {
  let generateTasksForFarm;

  beforeAll(async () => {
    const mod = await import('../../lib/farmTaskEngine.js');
    generateTasksForFarm = mod.generateTasksForFarm;
  });

  it('adds benchmark-data-prompt when noComparisonData', () => {
    const tasks = generateTasksForFarm({
      farmId: 'bm-1',
      crop: 'maize',
      stage: 'growing',
      farmerType: 'new',
      benchmarkInsights: { noComparisonData: true, profitDropped: false, yieldDropped: false, costsIncreased: false },
    });
    const prompt = tasks.find(t => t.id === 'benchmark-data-prompt-bm-1');
    expect(prompt).toBeTruthy();
    expect(prompt.benchmarkNote).toBeTruthy();
  });

  it('adds profit review when profitDropped', () => {
    const tasks = generateTasksForFarm({
      farmId: 'bm-2',
      crop: 'maize',
      stage: 'harvest',
      farmerType: 'new',
      benchmarkInsights: { noComparisonData: false, profitDropped: true, yieldDropped: false, costsIncreased: false },
    });
    const task = tasks.find(t => t.id === 'benchmark-profit-review-bm-2');
    expect(task).toBeTruthy();
    expect(task.priority).toBe('medium');
  });

  it('adds yield review when yieldDropped', () => {
    const tasks = generateTasksForFarm({
      farmId: 'bm-3',
      crop: 'maize',
      stage: 'harvest',
      farmerType: 'new',
      benchmarkInsights: { noComparisonData: false, profitDropped: false, yieldDropped: true, costsIncreased: false },
    });
    const task = tasks.find(t => t.id === 'benchmark-yield-review-bm-3');
    expect(task).toBeTruthy();
    expect(task.priority).toBe('medium');
  });

  it('adds cost review when costsIncreased', () => {
    const tasks = generateTasksForFarm({
      farmId: 'bm-4',
      crop: 'maize',
      stage: 'growing',
      farmerType: 'new',
      benchmarkInsights: { noComparisonData: false, profitDropped: false, yieldDropped: false, costsIncreased: true },
    });
    const task = tasks.find(t => t.id === 'benchmark-cost-review-bm-4');
    expect(task).toBeTruthy();
  });

  it('adds NO benchmark tasks when all metrics are good', () => {
    const tasks = generateTasksForFarm({
      farmId: 'bm-5',
      crop: 'maize',
      stage: 'growing',
      farmerType: 'new',
      benchmarkInsights: { noComparisonData: false, profitDropped: false, yieldDropped: false, costsIncreased: false },
    });
    const benchTasks = tasks.filter(t => t.id && t.id.startsWith('benchmark-'));
    expect(benchTasks).toHaveLength(0);
  });

  it('adds no benchmark tasks when benchmarkInsights is null', () => {
    const tasks = generateTasksForFarm({
      farmId: 'bm-6',
      crop: 'maize',
      stage: 'growing',
      farmerType: 'new',
      benchmarkInsights: null,
    });
    const benchTasks = tasks.filter(t => t.id && t.id.startsWith('benchmark-'));
    expect(benchTasks).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════
//  9. Farm tasks route — benchmark wiring
// ═══════════════════════════════════════════════════════════
describe('Farm tasks route — benchmark wiring', () => {
  const route = readFile('server/routes/farmTasks.js');

  it('imports calculateFarmBenchmarks', () => {
    expect(route).toContain('calculateFarmBenchmarks');
    expect(route).toContain("from '../lib/farmBenchmarking.js'");
  });

  it('imports detectBenchmarkInsights', () => {
    expect(route).toContain('detectBenchmarkInsights');
  });

  it('passes benchmarkInsights to generateTasksForFarm', () => {
    expect(route).toContain('benchmarkInsights');
  });
});

// ═══════════════════════════════════════════════════════════
// 10. FarmTasksCard — benchmarkNote rendering
// ═══════════════════════════════════════════════════════════
describe('FarmTasksCard — benchmarkNote rendering', () => {
  const card = readFile('src/components/FarmTasksCard.jsx');

  it('renders benchmarkNote field', () => {
    expect(card).toContain('task.benchmarkNote');
  });

  it('has benchmarkNote style', () => {
    expect(card).toContain('benchmarkNote');
    expect(card).toContain("color: '#A5B4FC'");
  });
});

// ═══════════════════════════════════════════════════════════
// 11. FarmBenchmarkCard — UI
// ═══════════════════════════════════════════════════════════
describe('FarmBenchmarkCard — UI', () => {
  const card = readFile('src/components/FarmBenchmarkCard.jsx');

  it('imports getFarmBenchmarks', () => {
    expect(card).toContain('getFarmBenchmarks');
  });

  it('uses useProfile for currentFarmId', () => {
    expect(card).toContain('currentFarmId');
    expect(card).toContain('useProfile');
  });

  it('uses prevFarmIdRef pattern', () => {
    expect(card).toContain('prevFarmIdRef');
  });

  it('has loading state', () => {
    expect(card).toContain("t('benchmark.loading')");
  });

  it('has error state', () => {
    expect(card).toContain('errorText');
  });

  it('shows not-enough-data state', () => {
    expect(card).toContain('hasEnoughData');
    expect(card).toContain('insufficientDataReason');
  });

  it('shows current totals when partial data', () => {
    expect(card).toContain('currentTotals');
    expect(card).toContain('currentOnlySection');
  });

  it('shows 4 metrics in comparison mode', () => {
    expect(card).toContain("t('benchmark.yield')");
    expect(card).toContain("t('benchmark.revenue')");
    expect(card).toContain("t('benchmark.costs')");
    expect(card).toContain("t('benchmark.profit')");
  });

  it('shows trend indicators', () => {
    expect(card).toContain('TrendBadge');
    expect(card).toContain('changePercent');
  });

  it('shows previous values', () => {
    expect(card).toContain("t('benchmark.prev')");
  });

  it('shows period labels', () => {
    expect(card).toContain('currentPeriod');
    expect(card).toContain('previousPeriod');
    expect(card).toContain("t('benchmark.vs')");
  });

  it('inverts cost trend colors', () => {
    expect(card).toContain('inverted');
  });

  it('has data-testid', () => {
    expect(card).toContain('data-testid="farm-benchmark-card"');
  });

  it('uses dark theme styling', () => {
    expect(card).toContain('#1B2330');
    expect(card).toContain('#111827');
  });
});

// ═══════════════════════════════════════════════════════════
// 12. Dashboard — benchmark card wiring
// ═══════════════════════════════════════════════════════════
describe('Dashboard — benchmark card wiring', () => {
  const dashboard = readFile('src/pages/Dashboard.jsx');

  it('imports FarmBenchmarkCard', () => {
    expect(dashboard).toContain("import FarmBenchmarkCard from '../components/FarmBenchmarkCard.jsx'");
  });

  it('renders FarmBenchmarkCard', () => {
    expect(dashboard).toContain('<FarmBenchmarkCard');
  });

  it('renders benchmark card inside money expanded section after economics', () => {
    // In the new Dashboard, both cards are inside the 'money' expandable section
    const renderEconomics = dashboard.indexOf('<FarmEconomicsCard');
    const renderBenchmark = dashboard.indexOf('<FarmBenchmarkCard');
    expect(renderEconomics).toBeGreaterThan(0);
    expect(renderBenchmark).toBeGreaterThan(renderEconomics);
  });
});

// ═══════════════════════════════════════════════════════════
// 13. i18n — benchmark keys
// ═══════════════════════════════════════════════════════════
describe('i18n — benchmark keys', () => {
  const translations = readFile('src/i18n/translations.js');

  const requiredKeys = [
    'benchmark.title',
    'benchmark.loading',
    'benchmark.noData',
    'benchmark.noDataHint',
    'benchmark.currentPeriod',
    'benchmark.yield',
    'benchmark.revenue',
    'benchmark.costs',
    'benchmark.profit',
    'benchmark.vs',
    'benchmark.prev',
  ];

  for (const key of requiredKeys) {
    it(`has key: ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('has all 5 languages for benchmark.title', () => {
    const line = translations.split('\n').find(l => l.includes("'benchmark.title'"));
    expect(line).toBeTruthy();
    expect(line).toContain('en:');
    expect(line).toContain('fr:');
    expect(line).toContain('sw:');
    expect(line).toContain('ha:');
    expect(line).toContain('tw:');
  });
});
