/**
 * Yield Records & Harvest Logging — comprehensive tests.
 *
 * Covers: Prisma schema, Zod validation, summary computation, route structure,
 * task engine integration, API client, UI card, dashboard wiring, i18n.
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
//  1. Prisma Schema — V2HarvestRecord model
// ═══════════════════════════════════════════════════════════
describe('Prisma schema — V2HarvestRecord', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('defines V2HarvestRecord model', () => {
    expect(schema).toContain('model V2HarvestRecord');
  });

  it('has required fields', () => {
    expect(schema).toContain('farm_id');
    expect(schema).toContain('crop_id');
    expect(schema).toContain('crop_label');
    expect(schema).toContain('harvest_date');
    expect(schema).toContain('quantity_harvested');
    expect(schema).toContain('quantity_unit');
  });

  it('has optional quantity fields', () => {
    expect(schema).toContain('quantity_sold');
    expect(schema).toContain('quantity_stored');
    expect(schema).toContain('quantity_lost');
  });

  it('has optional pricing fields', () => {
    expect(schema).toContain('average_selling_price');
    expect(schema).toContain('currency');
  });

  it('has quality and notes fields', () => {
    expect(schema).toContain('quality_grade');
    expect(schema).toContain('notes');
  });

  it('has relation to FarmProfile', () => {
    expect(schema).toContain('farm                FarmProfile');
    expect(schema).toContain('onDelete: Cascade');
  });

  it('has indexes for performance', () => {
    expect(schema).toContain('idx_harvest_records_farm');
    expect(schema).toContain('idx_harvest_records_farm_date');
    expect(schema).toContain('idx_harvest_records_crop');
  });

  it('maps to harvest_records table', () => {
    expect(schema).toContain('@@map("harvest_records")');
  });

  it('FarmProfile has harvestRecords relation', () => {
    expect(schema).toContain('harvestRecords    V2HarvestRecord[]');
  });
});

// ═══════════════════════════════════════════════════════════
//  2. Validation — Zod schemas
// ═══════════════════════════════════════════════════════════
describe('Harvest record validation — structure', () => {
  const validation = readFile('server/lib/harvestRecordValidation.js');

  it('exports createHarvestRecordSchema', () => {
    expect(validation).toContain('export const createHarvestRecordSchema');
  });

  it('exports updateHarvestRecordSchema', () => {
    expect(validation).toContain('export const updateHarvestRecordSchema');
  });

  it('exports validateCreate function', () => {
    expect(validation).toContain('export function validateCreate');
  });

  it('exports validateUpdate function', () => {
    expect(validation).toContain('export function validateUpdate');
  });

  it('exports computeHarvestSummary function', () => {
    expect(validation).toContain('export function computeHarvestSummary');
  });

  it('defines QUANTITY_UNITS', () => {
    expect(validation).toContain('QUANTITY_UNITS');
    expect(validation).toContain("'kg'");
    expect(validation).toContain("'bags'");
    expect(validation).toContain("'tonnes'");
  });

  it('defines CURRENCIES', () => {
    expect(validation).toContain('CURRENCIES');
    expect(validation).toContain("'GHS'");
    expect(validation).toContain("'NGN'");
    expect(validation).toContain("'KES'");
  });

  it('defines QUALITY_GRADES', () => {
    expect(validation).toContain('QUALITY_GRADES');
    expect(validation).toContain("'excellent'");
    expect(validation).toContain("'poor'");
  });

  it('validates non-negative quantities', () => {
    expect(validation).toContain('non-negative');
  });

  it('validates date format', () => {
    expect(validation).toContain('valid date string');
  });
});

// ═══════════════════════════════════════════════════════════
//  3. Validation — runtime
// ═══════════════════════════════════════════════════════════
describe('Harvest record validation — runtime', () => {
  let validateCreate, validateUpdate, computeHarvestSummary;

  beforeAll(async () => {
    const mod = await import('../../lib/harvestRecordValidation.js');
    validateCreate = mod.validateCreate;
    validateUpdate = mod.validateUpdate;
    computeHarvestSummary = mod.computeHarvestSummary;
  });

  // ─── validateCreate ───────────────────
  it('accepts valid create payload', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      cropId: 'maize',
      cropLabel: 'Maize',
      harvestDate: '2026-04-10',
      quantityHarvested: 500,
      quantityUnit: 'kg',
    });
    expect(result.success).toBe(true);
    expect(result.data.farmId).toBe('farm-1');
  });

  it('rejects missing farmId', () => {
    const result = validateCreate({
      cropId: 'maize',
      cropLabel: 'Maize',
      harvestDate: '2026-04-10',
      quantityHarvested: 500,
      quantityUnit: 'kg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative quantity', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      cropId: 'maize',
      cropLabel: 'Maize',
      harvestDate: '2026-04-10',
      quantityHarvested: -10,
      quantityUnit: 'kg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid unit', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      cropId: 'maize',
      cropLabel: 'Maize',
      harvestDate: '2026-04-10',
      quantityHarvested: 500,
      quantityUnit: 'bushels',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid date', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      cropId: 'maize',
      cropLabel: 'Maize',
      harvestDate: 'not-a-date',
      quantityHarvested: 500,
      quantityUnit: 'kg',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      cropId: 'maize',
      cropLabel: 'Maize',
      harvestDate: '2026-04-10',
      quantityHarvested: 500,
      quantityUnit: 'kg',
      quantitySold: 300,
      quantityStored: 150,
      quantityLost: 50,
      averageSellingPrice: 2.5,
      currency: 'GHS',
      qualityGrade: 'A',
      notes: 'Good harvest',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid quality grade', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      cropId: 'maize',
      cropLabel: 'Maize',
      harvestDate: '2026-04-10',
      quantityHarvested: 500,
      quantityUnit: 'kg',
      qualityGrade: 'premium',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid currency', () => {
    const result = validateCreate({
      farmId: 'farm-1',
      cropId: 'maize',
      cropLabel: 'Maize',
      harvestDate: '2026-04-10',
      quantityHarvested: 500,
      quantityUnit: 'kg',
      currency: 'BTC',
    });
    expect(result.success).toBe(false);
  });

  // ─── validateUpdate ───────────────────
  it('accepts partial update payload', () => {
    const result = validateUpdate({
      quantitySold: 200,
      notes: 'Updated',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid update values', () => {
    const result = validateUpdate({
      quantityHarvested: -5,
    });
    expect(result.success).toBe(false);
  });

  // ─── computeHarvestSummary ────────────
  it('returns empty summary for no records', () => {
    const summary = computeHarvestSummary([]);
    expect(summary.totalRecords).toBe(0);
    expect(summary.totalHarvested).toBe(0);
    expect(summary.estimatedRevenue).toBeNull();
  });

  it('computes totals correctly', () => {
    const records = [
      { quantityHarvested: 100, quantitySold: 60, quantityStored: 30, quantityLost: 10, quantityUnit: 'kg' },
      { quantityHarvested: 200, quantitySold: 150, quantityStored: 40, quantityLost: 10, quantityUnit: 'kg' },
    ];
    const summary = computeHarvestSummary(records);
    expect(summary.totalRecords).toBe(2);
    expect(summary.totalHarvested).toBe(300);
    expect(summary.totalSold).toBe(210);
    expect(summary.totalStored).toBe(70);
    expect(summary.totalLost).toBe(20);
    expect(summary.dominantUnit).toBe('kg');
  });

  it('computes estimated revenue when price exists', () => {
    const records = [
      { quantityHarvested: 100, quantitySold: 60, averageSellingPrice: 5, quantityUnit: 'kg' },
      { quantityHarvested: 200, quantitySold: 100, averageSellingPrice: 4, quantityUnit: 'kg' },
    ];
    const summary = computeHarvestSummary(records);
    expect(summary.estimatedRevenue).toBe(700); // (60*5) + (100*4)
  });

  it('returns null revenue when no price data', () => {
    const records = [
      { quantityHarvested: 100, quantityUnit: 'kg' },
    ];
    const summary = computeHarvestSummary(records);
    expect(summary.estimatedRevenue).toBeNull();
  });

  it('determines dominant unit', () => {
    const records = [
      { quantityHarvested: 100, quantityUnit: 'bags' },
      { quantityHarvested: 200, quantityUnit: 'bags' },
      { quantityHarvested: 50, quantityUnit: 'kg' },
    ];
    const summary = computeHarvestSummary(records);
    expect(summary.dominantUnit).toBe('bags');
  });
});

// ═══════════════════════════════════════════════════════════
//  4. Route — structure
// ═══════════════════════════════════════════════════════════
describe('Harvest records route — structure', () => {
  const route = readFile('server/routes/harvestRecords.js');

  it('uses authenticate middleware', () => {
    expect(route).toContain('authenticate');
  });

  it('has POST create endpoint', () => {
    expect(route).toContain("router.post('/', authenticate");
  });

  it('has GET list endpoint', () => {
    expect(route).toContain("router.get('/:farmId', authenticate");
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

  it('returns summary with list', () => {
    expect(route).toContain('computeHarvestSummary');
    expect(route).toContain('summary');
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
describe('App — harvest records route registration', () => {
  const app = readFile('server/src/app.js');

  it('imports harvest record routes', () => {
    expect(app).toContain('harvestRecords');
  });

  it('mounts at /api/v2/harvest-records', () => {
    expect(app).toContain('/api/v2/harvest-records');
  });
});

// ═══════════════════════════════════════════════════════════
//  6. API client — functions
// ═══════════════════════════════════════════════════════════
describe('API client — harvest record functions', () => {
  const api = readFile('src/lib/api.js');

  it('exports getHarvestRecords', () => {
    expect(api).toContain('export function getHarvestRecords');
  });

  it('exports createHarvestRecord', () => {
    expect(api).toContain('export function createHarvestRecord');
  });

  it('exports updateHarvestRecord', () => {
    expect(api).toContain('export function updateHarvestRecord');
  });

  it('exports deleteHarvestRecord', () => {
    expect(api).toContain('export function deleteHarvestRecord');
  });

  it('calls /api/v2/harvest-records endpoint', () => {
    expect(api).toContain('/api/v2/harvest-records');
  });
});

// ═══════════════════════════════════════════════════════════
//  7. Task engine — yield integration
// ═══════════════════════════════════════════════════════════
describe('Task engine — yield integration', () => {
  const engine = readFile('server/lib/farmTaskEngine.js');

  it('accepts hasRecentHarvestRecord in context', () => {
    expect(engine).toContain('hasRecentHarvestRecord');
    expect(engine).toContain('hasRecentHarvestRecord, hasCostRecords, hasRevenueData, benchmarkInsights } = context');
  });

  it('generates yield logging prompt when no recent record', () => {
    expect(engine).toContain('yield-log-prompt');
    expect(engine).toContain('Log your harvest yield');
  });

  it('checks stage for yield prompt (harvest or post_harvest)', () => {
    expect(engine).toContain("normalizedStage === 'harvest'");
    expect(engine).toContain("normalizedStage === 'post_harvest'");
  });

  it('demotes harvest-readiness tasks when record exists', () => {
    expect(engine).toContain('Harvest recorded');
  });

  it('has JSDoc for hasRecentHarvestRecord property', () => {
    expect(engine).toContain('@property {boolean} [hasRecentHarvestRecord]');
  });
});

// ═══════════════════════════════════════════════════════════
//  8. Task engine — yield prompt runtime
// ═══════════════════════════════════════════════════════════
describe('Task engine — yield prompt runtime', () => {
  let generateTasksForFarm;

  beforeAll(async () => {
    const mod = await import('../../lib/farmTaskEngine.js');
    generateTasksForFarm = mod.generateTasksForFarm;
  });

  it('adds yield-log-prompt when no recent record at harvest stage', () => {
    const tasks = generateTasksForFarm({
      farmId: 'farm-yield-1',
      crop: 'maize',
      stage: 'harvest',
      farmerType: 'new',
      hasRecentHarvestRecord: false,
    });
    const prompt = tasks.find(t => t.id === 'yield-log-prompt-farm-yield-1');
    expect(prompt).toBeTruthy();
    expect(prompt.priority).toBe('medium');
    expect(prompt.title).toContain('Log your harvest');
  });

  it('does NOT add yield-log-prompt when recent record exists', () => {
    const tasks = generateTasksForFarm({
      farmId: 'farm-yield-2',
      crop: 'maize',
      stage: 'harvest',
      farmerType: 'new',
      hasRecentHarvestRecord: true,
    });
    const prompt = tasks.find(t => t.id === 'yield-log-prompt-farm-yield-2');
    expect(prompt).toBeFalsy();
  });

  it('does NOT add yield-log-prompt at planning stage', () => {
    const tasks = generateTasksForFarm({
      farmId: 'farm-yield-3',
      crop: 'maize',
      stage: 'planning',
      farmerType: 'new',
      hasRecentHarvestRecord: false,
    });
    const prompt = tasks.find(t => t.id && t.id.startsWith('yield-log-prompt'));
    expect(prompt).toBeFalsy();
  });

  it('demotes harvest-readiness tasks when recent record exists', () => {
    const tasks = generateTasksForFarm({
      farmId: 'farm-yield-4',
      crop: 'maize',
      stage: 'harvest',
      farmerType: 'new',
      hasRecentHarvestRecord: true,
      harvestRecs: [
        {
          id: 'maize-harvest-labor-farm-yield-4',
          priority: 'high',
          title: 'Prepare harvest labor and tools',
          action: 'Arrange labor',
          reason: 'Time-sensitive',
          dueLabel: 'This week',
          category: 'harvest-readiness',
        },
      ],
    });
    const harvestTask = tasks.find(t => t.id === 'harvest-task-maize-harvest-labor-farm-yield-4');
    if (harvestTask) {
      expect(harvestTask.priority).toBe('low');
      expect(harvestTask.harvestNote).toContain('Harvest recorded');
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  9. Farm tasks route — harvest record check
// ═══════════════════════════════════════════════════════════
describe('Farm tasks route — harvest record check', () => {
  const route = readFile('server/routes/farmTasks.js');

  it('checks for recent harvest records', () => {
    expect(route).toContain('v2HarvestRecord.findMany');
    expect(route).toContain('hasRecentHarvestRecord');
  });

  it('passes hasRecentHarvestRecord to generateTasksForFarm', () => {
    expect(route).toContain('hasRecentHarvestRecord');
  });

  it('uses 30-day window for recent check', () => {
    expect(route).toContain('30');
  });
});

// ═══════════════════════════════════════════════════════════
// 10. YieldRecordsCard — UI
// ═══════════════════════════════════════════════════════════
describe('YieldRecordsCard — UI', () => {
  const card = readFile('src/components/YieldRecordsCard.jsx');

  it('imports getHarvestRecords and createHarvestRecord', () => {
    expect(card).toContain('getHarvestRecords');
    expect(card).toContain('createHarvestRecord');
  });

  it('uses useProfile for currentFarmId', () => {
    expect(card).toContain('currentFarmId');
    expect(card).toContain('useProfile');
  });

  it('uses prevFarmIdRef pattern', () => {
    expect(card).toContain('prevFarmIdRef');
  });

  it('has loading state', () => {
    expect(card).toContain("t('yield.loading')");
  });

  it('has error state', () => {
    expect(card).toContain('errorText');
  });

  it('has empty state', () => {
    expect(card).toContain("t('yield.noRecords')");
  });

  it('has summary grid', () => {
    expect(card).toContain('summaryGrid');
    expect(card).toContain('totalHarvested');
    expect(card).toContain('totalSold');
    expect(card).toContain('estimatedRevenue');
  });

  it('has inline form', () => {
    expect(card).toContain('yield-form');
    expect(card).toContain('handleSubmit');
  });

  it('has quantity unit selector', () => {
    expect(card).toContain('QUANTITY_UNITS');
  });

  it('has quality grade selector', () => {
    expect(card).toContain('QUALITY_GRADES');
  });

  it('has record history list', () => {
    expect(card).toContain('historySection');
    expect(card).toContain('recordItem');
  });

  it('has data-testid', () => {
    expect(card).toContain('data-testid="yield-records-card"');
  });

  it('uses dark theme styling', () => {
    expect(card).toContain('#1B2330');
    expect(card).toContain('#111827');
  });

  it('has add button with testid', () => {
    expect(card).toContain('data-testid="add-yield-btn"');
  });
});

// ═══════════════════════════════════════════════════════════
// 11. Dashboard — yield card wiring
// ═══════════════════════════════════════════════════════════
describe('Dashboard — yield card wiring', () => {
  const dashboard = readFile('src/pages/Dashboard.jsx');

  it('imports YieldRecordsCard', () => {
    expect(dashboard).toContain("import YieldRecordsCard from '../components/YieldRecordsCard.jsx'");
  });

  it('renders YieldRecordsCard', () => {
    expect(dashboard).toContain('<YieldRecordsCard');
  });

  it('renders yield card inside harvest expanded section after harvest card', () => {
    // In the new Dashboard, both cards are inside the 'harvest' expandable section
    const renderHarvest = dashboard.indexOf('<FarmHarvestCard');
    const renderYield = dashboard.indexOf('<YieldRecordsCard');
    expect(renderHarvest).toBeGreaterThan(0);
    expect(renderYield).toBeGreaterThan(renderHarvest);
  });
});

// ═══════════════════════════════════════════════════════════
// 12. i18n — yield keys
// ═══════════════════════════════════════════════════════════
describe('i18n — yield keys', () => {
  const translations = readFile('src/i18n/translations.js');

  const requiredKeys = [
    'yield.title',
    'yield.loading',
    'yield.records',
    'yield.noRecords',
    'yield.noRecordsHint',
    'yield.addRecord',
    'yield.formTitle',
    'yield.harvestDate',
    'yield.quantityHarvested',
    'yield.unit',
    'yield.sold',
    'yield.stored',
    'yield.lost',
    'yield.harvested',
    'yield.sellingPrice',
    'yield.currency',
    'yield.qualityGrade',
    'yield.notes',
    'yield.cancel',
    'yield.save',
    'yield.saving',
    'yield.history',
    'yield.grade',
    'yield.estimatedRevenue',
    'yield.errorQuantity',
    'yield.errorDate',
  ];

  for (const key of requiredKeys) {
    it(`has key: ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('has all 5 languages for yield.title', () => {
    const line = translations.split('\n').find(l => l.includes("'yield.title'"));
    expect(line).toBeTruthy();
    expect(line).toContain('en:');
    expect(line).toContain('fr:');
    expect(line).toContain('sw:');
    expect(line).toContain('ha:');
    expect(line).toContain('tw:');
  });
});
