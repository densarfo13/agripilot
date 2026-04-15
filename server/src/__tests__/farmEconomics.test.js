/**
 * Farm Economics & Profit Tracking — comprehensive tests.
 *
 * Covers: Prisma schema, Zod validation, cost summary, economics computation,
 * route structure, task engine integration, API client, UI card, dashboard wiring, i18n.
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
//  1. Prisma Schema — V2FarmCostRecord model
// ═══════════════════════════════════════════════════════════
describe('Prisma schema — V2FarmCostRecord', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('defines V2FarmCostRecord model', () => {
    expect(schema).toContain('model V2FarmCostRecord');
  });

  it('has required fields', () => {
    expect(schema).toContain('farm_id');
    expect(schema).toContain('date');
    expect(schema).toContain('category');
    expect(schema).toContain('description');
    expect(schema).toContain('amount');
  });

  it('has optional fields', () => {
    expect(schema).toContain('currency');
    expect(schema).toContain('notes');
  });

  it('has relation to FarmProfile', () => {
    expect(schema).toContain('farm        FarmProfile @relation');
    expect(schema).toContain('onDelete: Cascade');
  });

  it('has indexes for performance', () => {
    expect(schema).toContain('idx_cost_records_farm');
    expect(schema).toContain('idx_cost_records_farm_date');
    expect(schema).toContain('idx_cost_records_category');
  });

  it('maps to farm_cost_records table', () => {
    expect(schema).toContain('@@map("farm_cost_records")');
  });

  it('FarmProfile has costRecords relation', () => {
    expect(schema).toContain('costRecords       V2FarmCostRecord[]');
  });
});

// ═══════════════════════════════════════════════════════════
//  2. Validation — structure
// ═══════════════════════════════════════════════════════════
describe('Farm cost validation — structure', () => {
  const validation = readFile('server/lib/farmCostValidation.js');

  it('exports createCostRecordSchema', () => {
    expect(validation).toContain('export const createCostRecordSchema');
  });

  it('exports updateCostRecordSchema', () => {
    expect(validation).toContain('export const updateCostRecordSchema');
  });

  it('exports validateCreate', () => {
    expect(validation).toContain('export function validateCreate');
  });

  it('exports validateUpdate', () => {
    expect(validation).toContain('export function validateUpdate');
  });

  it('exports computeCostSummary', () => {
    expect(validation).toContain('export function computeCostSummary');
  });

  it('exports computeFarmEconomics', () => {
    expect(validation).toContain('export function computeFarmEconomics');
  });

  it('defines COST_CATEGORIES', () => {
    expect(validation).toContain('COST_CATEGORIES');
    expect(validation).toContain("'seeds'");
    expect(validation).toContain("'fertilizer'");
    expect(validation).toContain("'labor'");
    expect(validation).toContain("'transport'");
    expect(validation).toContain("'land_preparation'");
  });

  it('validates non-negative amount', () => {
    expect(validation).toContain('non-negative');
  });

  it('validates date format', () => {
    expect(validation).toContain('valid date string');
  });
});

// ═══════════════════════════════════════════════════════════
//  3. Validation — runtime
// ═══════════════════════════════════════════════════════════
describe('Farm cost validation — runtime', () => {
  let validateCreate, validateUpdate, computeCostSummary, computeFarmEconomics;

  beforeAll(async () => {
    const mod = await import('../../lib/farmCostValidation.js');
    validateCreate = mod.validateCreate;
    validateUpdate = mod.validateUpdate;
    computeCostSummary = mod.computeCostSummary;
    computeFarmEconomics = mod.computeFarmEconomics;
  });

  // ─── validateCreate ───────────────────
  it('accepts valid create payload', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      date: '2026-04-01',
      category: 'seeds',
      description: 'Bought maize seeds',
      amount: 250,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing farmId', () => {
    const result = validateCreate({
      date: '2026-04-01',
      category: 'seeds',
      description: 'Seeds',
      amount: 100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      date: '2026-04-01',
      category: 'seeds',
      description: 'Seeds',
      amount: -50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      date: '2026-04-01',
      category: 'rent',
      description: 'Rent',
      amount: 100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid date', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      date: 'not-a-date',
      category: 'seeds',
      description: 'Seeds',
      amount: 100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing description', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      date: '2026-04-01',
      category: 'seeds',
      description: '',
      amount: 100,
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional currency', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      date: '2026-04-01',
      category: 'labor',
      description: 'Hired weeding',
      amount: 500,
      currency: 'GHS',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid currency', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      date: '2026-04-01',
      category: 'labor',
      description: 'Hired help',
      amount: 500,
      currency: 'BTC',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all 11 cost categories', () => {
    const categories = [
      'seeds', 'fertilizer', 'pesticide', 'herbicide', 'labor',
      'irrigation', 'transport', 'storage', 'equipment', 'land_preparation', 'other',
    ];
    for (const cat of categories) {
      const result = validateCreate({
        farmId: 'farm-1',
        date: '2026-04-01',
        category: cat,
        description: `Test ${cat}`,
        amount: 100,
      });
      expect(result.success).toBe(true);
    }
  });

  // ─── validateUpdate ──────────────────���
  it('accepts partial update', () => {
    const result = validateUpdate({ amount: 300, notes: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid update values', () => {
    const result = validateUpdate({ amount: -10 });
    expect(result.success).toBe(false);
  });

  // ─── computeCostSummary ───────────────
  it('returns empty summary for no records', () => {
    const summary = computeCostSummary([]);
    expect(summary.totalRecords).toBe(0);
    expect(summary.totalCosts).toBe(0);
    expect(summary.categoryBreakdown).toEqual({});
  });

  it('computes totals and breakdown correctly', () => {
    const records = [
      { amount: 200, category: 'seeds' },
      { amount: 300, category: 'fertilizer' },
      { amount: 150, category: 'seeds' },
      { amount: 500, category: 'labor' },
    ];
    const summary = computeCostSummary(records);
    expect(summary.totalRecords).toBe(4);
    expect(summary.totalCosts).toBe(1150);
    expect(summary.categoryBreakdown.seeds).toBe(350);
    expect(summary.categoryBreakdown.fertilizer).toBe(300);
    expect(summary.categoryBreakdown.labor).toBe(500);
  });

  // ─── computeFarmEconomics ─────────────
  it('computes economics with both revenue and costs', () => {
    const harvestRecords = [
      { quantitySold: 100, averageSellingPrice: 5 },
      { quantitySold: 50, averageSellingPrice: 4 },
    ];
    const costRecords = [
      { amount: 200, category: 'seeds' },
      { amount: 300, category: 'fertilizer' },
    ];
    const eco = computeFarmEconomics(harvestRecords, costRecords);
    expect(eco.totalRevenue).toBe(700); // (100*5) + (50*4)
    expect(eco.totalCosts).toBe(500);
    expect(eco.estimatedProfit).toBe(200);
    expect(eco.revenueIsPartial).toBe(false);
  });

  it('returns null revenue when no price data', () => {
    const eco = computeFarmEconomics(
      [{ quantityHarvested: 100 }],
      [{ amount: 200, category: 'seeds' }],
    );
    expect(eco.totalRevenue).toBeNull();
    expect(eco.estimatedProfit).toBeNull();
    expect(eco.totalCosts).toBe(200);
  });

  it('flags partial revenue when some records lack price', () => {
    const eco = computeFarmEconomics(
      [
        { quantitySold: 100, averageSellingPrice: 5 },
        { quantitySold: 50 }, // no price
      ],
      [],
    );
    expect(eco.totalRevenue).toBe(500);
    expect(eco.revenueIsPartial).toBe(true);
  });

  it('handles empty inputs', () => {
    const eco = computeFarmEconomics([], []);
    expect(eco.totalRevenue).toBeNull();
    expect(eco.totalCosts).toBe(0);
    expect(eco.estimatedProfit).toBeNull();
  });

  it('computes negative profit correctly', () => {
    const eco = computeFarmEconomics(
      [{ quantitySold: 10, averageSellingPrice: 5 }],
      [{ amount: 1000, category: 'labor' }],
    );
    expect(eco.totalRevenue).toBe(50);
    expect(eco.totalCosts).toBe(1000);
    expect(eco.estimatedProfit).toBe(-950);
  });
});

// ═══════════════════════════════════════════════════════════
//  4. Route — structure
// ═══════════════════════════════════════════════════════════
describe('Farm costs route — structure', () => {
  const route = readFile('server/routes/farmCosts.js');

  it('uses authenticate middleware', () => {
    expect(route).toContain('authenticate');
  });

  it('has POST create endpoint', () => {
    expect(route).toContain("router.post('/', authenticate");
  });

  it('has GET list endpoint', () => {
    expect(route).toContain("router.get('/:farmId', authenticate");
  });

  it('has GET economics endpoint', () => {
    expect(route).toContain("router.get('/:farmId/economics', authenticate");
  });

  it('has PATCH update endpoint', () => {
    expect(route).toContain("router.patch('/:id', authenticate");
  });

  it('has DELETE endpoint', () => {
    expect(route).toContain("router.delete('/:id', authenticate");
  });

  it('verifies farm ownership via userId', () => {
    expect(route).toContain('userId: req.user.id');
  });

  it('returns 404 for missing farm', () => {
    expect(route).toContain('Farm not found');
  });

  it('returns 400 for archived farm', () => {
    expect(route).toContain('archived');
  });

  it('computes economics from both record types', () => {
    expect(route).toContain('computeFarmEconomics');
    expect(route).toContain('v2HarvestRecord');
    expect(route).toContain('v2FarmCostRecord');
  });

  it('validates create payload', () => {
    expect(route).toContain('validateCreate');
  });

  it('validates update payload', () => {
    expect(route).toContain('validateUpdate');
  });

  it('verifies ownership through farm on update/delete', () => {
    expect(route).toContain('existing.farm.userId');
  });
});

// ═══════════════════════════════════════════════════════════
//  5. App — route registration
// ═══════════════════════════════════════════════════════════
describe('App — farm costs route registration', () => {
  const app = readFile('server/src/app.js');

  it('imports farm cost routes', () => {
    expect(app).toContain('farmCosts');
  });

  it('mounts at /api/v2/farm-costs', () => {
    expect(app).toContain('/api/v2/farm-costs');
  });
});

// ═══════════════════════════════════════════════════════════
//  6. API client — functions
// ═══════════════════════════════════════════════════════════
describe('API client — farm cost functions', () => {
  const api = readFile('src/lib/api.js');

  it('exports getFarmCosts', () => {
    expect(api).toContain('export function getFarmCosts');
  });

  it('exports createFarmCost', () => {
    expect(api).toContain('export function createFarmCost');
  });

  it('exports updateFarmCost', () => {
    expect(api).toContain('export function updateFarmCost');
  });

  it('exports deleteFarmCost', () => {
    expect(api).toContain('export function deleteFarmCost');
  });

  it('exports getFarmEconomics', () => {
    expect(api).toContain('export function getFarmEconomics');
  });

  it('calls /api/v2/farm-costs endpoint', () => {
    expect(api).toContain('/api/v2/farm-costs');
  });

  it('economics endpoint includes /economics path', () => {
    expect(api).toContain('/economics');
  });
});

// ═══════════════════════════════════════════════════════════
//  7. Task engine — economics integration
// ═══════════════════════════════════════════════════════════
describe('Task engine — economics integration', () => {
  const engine = readFile('server/lib/farmTaskEngine.js');

  it('accepts hasCostRecords in context', () => {
    expect(engine).toContain('hasCostRecords');
  });

  it('accepts hasRevenueData in context', () => {
    expect(engine).toContain('hasRevenueData');
  });

  it('accepts benchmarkInsights in context', () => {
    expect(engine).toContain('benchmarkInsights');
  });

  it('generates cost logging prompt when no costs', () => {
    expect(engine).toContain('cost-log-prompt');
    expect(engine).toContain('Start logging farm costs to track profitability');
  });

  it('generates revenue prompt when harvest but no price', () => {
    expect(engine).toContain('revenue-prompt');
    expect(engine).toContain('Add selling price to estimate revenue');
  });

  it('adds economicsNote to prompts', () => {
    expect(engine).toContain('economicsNote');
  });

  it('has JSDoc for hasCostRecords and hasRevenueData', () => {
    expect(engine).toContain('@property {boolean} [hasCostRecords]');
    expect(engine).toContain('@property {boolean} [hasRevenueData]');
  });
});

// ═══════════════════════════════════════════════════════════
//  8. Task engine — economics prompts runtime
// ═══════════════════════════════════════════════════════════
describe('Task engine — economics prompts runtime', () => {
  let generateTasksForFarm;

  beforeAll(async () => {
    const mod = await import('../../lib/farmTaskEngine.js');
    generateTasksForFarm = mod.generateTasksForFarm;
  });

  it('adds cost-log-prompt when no cost records', () => {
    const tasks = generateTasksForFarm({
      farmId: 'eco-1',
      crop: 'maize',
      stage: 'growing',
      farmerType: 'new',
      hasCostRecords: false,
    });
    const prompt = tasks.find(t => t.id === 'cost-log-prompt-eco-1');
    expect(prompt).toBeTruthy();
    expect(prompt.priority).toBe('low');
    expect(prompt.economicsNote).toBeTruthy();
  });

  it('does NOT add cost-log-prompt when cost records exist', () => {
    const tasks = generateTasksForFarm({
      farmId: 'eco-2',
      crop: 'maize',
      stage: 'growing',
      farmerType: 'new',
      hasCostRecords: true,
    });
    const prompt = tasks.find(t => t.id === 'cost-log-prompt-eco-2');
    expect(prompt).toBeFalsy();
  });

  it('adds revenue-prompt when harvest but no revenue data', () => {
    const tasks = generateTasksForFarm({
      farmId: 'eco-3',
      crop: 'maize',
      stage: 'harvest',
      farmerType: 'new',
      hasRecentHarvestRecord: true,
      hasRevenueData: false,
    });
    const prompt = tasks.find(t => t.id === 'revenue-prompt-eco-3');
    expect(prompt).toBeTruthy();
    expect(prompt.economicsNote).toBeTruthy();
  });

  it('does NOT add revenue-prompt when revenue data exists', () => {
    const tasks = generateTasksForFarm({
      farmId: 'eco-4',
      crop: 'maize',
      stage: 'harvest',
      farmerType: 'new',
      hasRecentHarvestRecord: true,
      hasRevenueData: true,
    });
    const prompt = tasks.find(t => t.id === 'revenue-prompt-eco-4');
    expect(prompt).toBeFalsy();
  });

  it('does NOT add revenue-prompt when no harvest record', () => {
    const tasks = generateTasksForFarm({
      farmId: 'eco-5',
      crop: 'maize',
      stage: 'harvest',
      farmerType: 'new',
      hasRecentHarvestRecord: false,
      hasRevenueData: false,
    });
    const prompt = tasks.find(t => t.id === 'revenue-prompt-eco-5');
    expect(prompt).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════
//  9. Farm tasks route — economics checks
// ═══════════════════════════════════════════════════════════
describe('Farm tasks route — economics checks', () => {
  const route = readFile('server/routes/farmTasks.js');

  it('checks for cost records', () => {
    expect(route).toContain('v2FarmCostRecord.count');
    expect(route).toContain('hasCostRecords');
  });

  it('checks for revenue data', () => {
    expect(route).toContain('hasRevenueData');
  });

  it('passes hasCostRecords to generateTasksForFarm', () => {
    expect(route).toContain('hasCostRecords');
  });

  it('passes hasRevenueData to generateTasksForFarm', () => {
    expect(route).toContain('hasRevenueData');
  });
});

// ═══════════════════════════════════════════════════════════
// 10. FarmTasksCard — economicsNote rendering
// ═══════════════════════════════════════════════════════════
describe('FarmTasksCard — economicsNote rendering', () => {
  const card = readFile('src/components/FarmTasksCard.jsx');

  it('renders economicsNote field', () => {
    expect(card).toContain('task.economicsNote');
  });

  it('has economicsNote style', () => {
    expect(card).toContain('economicsNote');
    expect(card).toContain("color: '#86EFAC'");
  });
});

// ═══════════════════════════════════════════════════════════
// 11. FarmEconomicsCard — UI
// ═══════════════════════════════════════════════════════════
describe('FarmEconomicsCard — UI', () => {
  const card = readFile('src/components/FarmEconomicsCard.jsx');

  it('imports getFarmCosts, createFarmCost, getFarmEconomics', () => {
    expect(card).toContain('getFarmCosts');
    expect(card).toContain('createFarmCost');
    expect(card).toContain('getFarmEconomics');
  });

  it('uses useProfile for currentFarmId', () => {
    expect(card).toContain('currentFarmId');
    expect(card).toContain('useProfile');
  });

  it('uses prevFarmIdRef pattern', () => {
    expect(card).toContain('prevFarmIdRef');
  });

  it('has loading state', () => {
    expect(card).toContain("t('economics.loading')");
  });

  it('has error state', () => {
    expect(card).toContain('errorText');
  });

  it('has empty state', () => {
    expect(card).toContain("t('economics.noRecords')");
  });

  it('shows revenue metric', () => {
    expect(card).toContain('totalRevenue');
    expect(card).toContain("t('economics.revenue')");
  });

  it('shows costs metric', () => {
    expect(card).toContain('totalCosts');
    expect(card).toContain("t('economics.totalCosts')");
  });

  it('shows profit metric', () => {
    expect(card).toContain('estimatedProfit');
    expect(card).toContain("t('economics.profit')");
  });

  it('shows partial revenue indicator', () => {
    expect(card).toContain('revenueIsPartial');
    expect(card).toContain("t('economics.partial')");
  });

  it('shows cost breakdown', () => {
    expect(card).toContain('categoryBreakdown');
    expect(card).toContain('breakdownSection');
  });

  it('has COST_CATEGORIES list', () => {
    expect(card).toContain('COST_CATEGORIES');
    expect(card).toContain("'seeds'");
    expect(card).toContain("'labor'");
  });

  it('has inline cost form', () => {
    expect(card).toContain('cost-form');
    expect(card).toContain('handleSubmit');
  });

  it('has cost history toggle', () => {
    expect(card).toContain('showCosts');
    expect(card).toContain('historyToggle');
  });

  it('has data-testid', () => {
    expect(card).toContain('data-testid="farm-economics-card"');
  });

  it('has add button with testid', () => {
    expect(card).toContain('data-testid="add-cost-btn"');
  });

  it('uses dark theme styling', () => {
    expect(card).toContain('#1B2330');
    expect(card).toContain('#111827');
  });

  it('shows profit in green when positive', () => {
    expect(card).toContain('#86EFAC');
  });

  it('shows profit in red when negative', () => {
    expect(card).toContain('#FCA5A5');
  });
});

// ═══════════════════════════════════════════════════════════
// 12. Dashboard — economics card wiring
// ═══════════════════════════════════════════════════════════
describe('Dashboard — economics card wiring', () => {
  const dashboard = readFile('src/pages/Dashboard.jsx');

  it('imports FarmEconomicsCard', () => {
    expect(dashboard).toContain("import FarmEconomicsCard from '../components/FarmEconomicsCard.jsx'");
  });

  it('renders FarmEconomicsCard', () => {
    expect(dashboard).toContain('<FarmEconomicsCard');
  });

  it('renders economics card inside money expanded section', () => {
    // In the new Dashboard, economics is inside the 'money' expandable section
    const moneySection = dashboard.indexOf("expandedSection === 'money'");
    const renderEconomics = dashboard.indexOf('<FarmEconomicsCard');
    expect(moneySection).toBeGreaterThan(0);
    expect(renderEconomics).toBeGreaterThan(moneySection);
  });
});

// ═══════════════════════════════════════════════════════════
// 13. i18n — economics keys
// ═══════════════════════════════════════════════════════════
describe('i18n — economics keys', () => {
  const translations = readFile('src/i18n/translations.js');

  const requiredKeys = [
    'economics.title',
    'economics.loading',
    'economics.costs',
    'economics.revenue',
    'economics.totalCosts',
    'economics.profit',
    'economics.partial',
    'economics.costBreakdown',
    'economics.noRecords',
    'economics.noRecordsHint',
    'economics.addCost',
    'economics.formTitle',
    'economics.date',
    'economics.category',
    'economics.description',
    'economics.amount',
    'economics.currency',
    'economics.notes',
    'economics.cancel',
    'economics.save',
    'economics.saving',
    'economics.showHistory',
    'economics.hideHistory',
    'economics.errorAmount',
    'economics.errorDate',
    'economics.errorDescription',
    // Cost categories
    'economics.cat.seeds',
    'economics.cat.fertilizer',
    'economics.cat.pesticide',
    'economics.cat.herbicide',
    'economics.cat.labor',
    'economics.cat.irrigation',
    'economics.cat.transport',
    'economics.cat.storage',
    'economics.cat.equipment',
    'economics.cat.land_preparation',
    'economics.cat.other',
  ];

  for (const key of requiredKeys) {
    it(`has key: ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('has all 5 languages for economics.title', () => {
    const line = translations.split('\n').find(l => l.includes("'economics.title'"));
    expect(line).toBeTruthy();
    expect(line).toContain('en:');
    expect(line).toContain('fr:');
    expect(line).toContain('sw:');
    expect(line).toContain('ha:');
    expect(line).toContain('tw:');
  });
});
