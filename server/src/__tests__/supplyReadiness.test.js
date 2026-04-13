import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ─── 1. Prisma Schema ──────────────────────────────────────────

describe('Prisma Schema — V2SupplyReadiness', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('defines V2SupplyReadiness model', () => {
    expect(schema).toContain('model V2SupplyReadiness');
    expect(schema).toContain('readyToSell');
    expect(schema).toContain('estimatedQuantity');
    expect(schema).toContain('quantityUnit');
    expect(schema).toContain('expectedHarvestDate');
    expect(schema).toContain('priceExpectation');
  });

  it('has unique constraint on profileId + crop + status', () => {
    expect(schema).toContain('uq_supply_profile_crop_active');
  });

  it('has indexes for performance', () => {
    expect(schema).toContain('idx_v2_supply_profile');
    expect(schema).toContain('idx_v2_supply_ready');
    expect(schema).toContain('idx_v2_supply_status');
  });

  it('has connectedAt and connectedBy for buyer connection workflow', () => {
    expect(schema).toContain('connectedAt');
    expect(schema).toContain('connectedBy');
  });

  it('FarmProfile has supplyReadiness reverse relation', () => {
    expect(schema).toContain('supplyReadiness');
  });
});

// ─── 2. Server Route ────────────────────────────────────────────

describe('Supply Readiness API Route', () => {
  const route = readFile('server/routes/supply-readiness.js');

  it('has farmer GET /mine endpoint', () => {
    expect(route).toContain("router.get('/mine'");
    expect(route).toContain('authenticate');
  });

  it('has farmer POST /mine endpoint with validation', () => {
    expect(route).toContain("router.post('/mine'");
    expect(route).toContain("readyToSell must be true or false");
    expect(route).toContain('VALID_UNITS');
  });

  it('validates quantityUnit against allowed values', () => {
    expect(route).toContain("'kg'");
    expect(route).toContain("'bags'");
    expect(route).toContain("'tonnes'");
    expect(route).toContain("'crates'");
  });

  it('requires farm profile before saving', () => {
    expect(route).toContain('Complete your farm profile first');
  });

  it('upserts based on existing active record', () => {
    expect(route).toContain("status: 'active'");
    expect(route).toContain('v2SupplyReadiness.findFirst');
    expect(route).toContain('v2SupplyReadiness.update');
    expect(route).toContain('v2SupplyReadiness.create');
  });

  it('writes audit log on create/update', () => {
    expect(route).toContain('supply_readiness.updated');
    expect(route).toContain('supply_readiness.created');
    expect(route).toContain('writeAuditLog');
  });

  it('has admin list endpoint with trust signal enrichment', () => {
    expect(route).toContain("router.get('/admin/list'");
    expect(route).toContain('trustLevel');
    expect(route).toContain('trustLabel');
    expect(route).toContain('profileComplete');
    expect(route).toContain('landMapped');
    expect(route).toContain('seedRecorded');
  });

  it('computes 4 trust levels', () => {
    expect(route).toContain("'low'");
    expect(route).toContain("'medium'");
    expect(route).toContain("'good'");
    expect(route).toContain("'high'");
  });

  it('has admin connect endpoint', () => {
    expect(route).toContain("router.post('/admin/:id/connect'");
    expect(route).toContain("status: 'connected'");
    expect(route).toContain('connectedAt');
    expect(route).toContain('supply_readiness.connected');
  });

  it('has CSV export endpoint', () => {
    expect(route).toContain("router.get('/admin/export.csv'");
    expect(route).toContain('text/csv');
    expect(route).toContain('supply-readiness.csv');
  });

  it('supports crop and readyOnly filters on admin list', () => {
    expect(route).toContain('req.query');
    expect(route).toContain('readyOnly');
    expect(route).toContain('where.crop');
  });
});

// ─── 3. Route Mounting ──────────────────────────────────────────

describe('Supply Readiness Route Mounting', () => {
  const app = readFile('server/src/app.js');

  it('imports supply readiness routes', () => {
    expect(app).toContain('v2SupplyReadinessRoutes');
    expect(app).toContain("supply-readiness.js");
  });

  it('mounts at /api/v2/supply-readiness', () => {
    expect(app).toContain("'/api/v2/supply-readiness'");
  });
});

// ─── 4. Frontend API Helpers ────────────────────────────────────

describe('Supply Readiness API Helpers', () => {
  const api = readFile('src/lib/api.js');

  it('exports getMySupplyReadiness', () => {
    expect(api).toContain('export function getMySupplyReadiness');
    expect(api).toContain('/api/v2/supply-readiness/mine');
  });

  it('exports saveSupplyReadiness', () => {
    expect(api).toContain('export function saveSupplyReadiness');
  });

  it('exports getAdminSupplyList with filter support', () => {
    expect(api).toContain('export function getAdminSupplyList');
    expect(api).toContain('readyOnly');
  });

  it('exports connectSupplyToBuyer', () => {
    expect(api).toContain('export function connectSupplyToBuyer');
    expect(api).toContain('/connect');
  });

  it('exports exportSupplyCSV', () => {
    expect(api).toContain('export function exportSupplyCSV');
    expect(api).toContain('export.csv');
  });
});

// ─── 5. SellReadinessInput Component ────────────────────────────

describe('SellReadinessInput Component', () => {
  const code = readFile('src/components/SellReadinessInput.jsx');

  it('has Yes/No toggle for readyToSell', () => {
    expect(code).toContain('setReadyToSell(true)');
    expect(code).toContain('setReadyToSell(false)');
    expect(code).toContain("t('common.yes')");
    expect(code).toContain("t('common.no')");
  });

  it('shows quantity, unit, harvest date, quality notes when ready', () => {
    expect(code).toContain('estimatedQuantity');
    expect(code).toContain('quantityUnit');
    expect(code).toContain('expectedHarvestDate');
    expect(code).toContain('qualityNotes');
  });

  it('uses 44px+ touch targets (RULE 3/7: low-literacy UX)', () => {
    expect(code).toContain("minHeight: '44px'");
    expect(code).toContain("minHeight: '48px'");
  });

  it('uses 16px font size (RULE 3: iOS zoom prevention)', () => {
    expect(code).toContain("fontSize: '16px'");
  });

  // ─── Guardrail compliance ───────────────────────────
  it('RULE 2: has skip button (optional feature)', () => {
    expect(code).toContain("t('supply.skip')");
    expect(code).toContain('onSkip');
    expect(code).toContain('dismissed');
  });

  it('RULE 6: checks isOnline before save', () => {
    expect(code).toContain('useNetwork');
    expect(code).toContain('isOnline');
    expect(code).toContain("t('supply.offlineSave')");
  });

  it('RULE 6: shows offline hint when not connected', () => {
    expect(code).toContain("t('supply.offlineHint')");
  });

  it('RULE 11: allows continuation on any failure (skip always visible)', () => {
    expect(code).toContain("t('supply.skip')");
    expect(code).toContain("t('supply.saveFailed')");
  });

  it('loads existing supply readiness on mount', () => {
    expect(code).toContain('getMySupplyReadiness');
  });
});

// ─── 6. Dashboard Integration ───────────────────────────────────

describe('Dashboard — Supply Readiness Integration', () => {
  const dashboard = readFile('src/pages/Dashboard.jsx');

  it('lazy-loads SellReadinessInput (RULE 5: performance)', () => {
    expect(dashboard).toContain("lazy(() => import('../components/SellReadinessInput.jsx'))");
  });

  it('wraps in Suspense with null fallback', () => {
    expect(dashboard).toContain('<Suspense fallback={null}>');
    expect(dashboard).toContain('<SellReadinessInput');
  });

  it('gates behind setupComplete (RULE 1: core flow)', () => {
    expect(dashboard).toContain('setupComplete');
    expect(dashboard).toContain('<SellReadinessInput');
  });

  it('places supply readiness after seed scan (ordering)', () => {
    const seedIdx = dashboard.indexOf('<SeedScanFlow');
    const supplyIdx = dashboard.indexOf('<SellReadinessInput');
    expect(seedIdx).toBeLessThan(supplyIdx);
  });
});

// ─── 7. Admin Page ──────────────────────────────────────────────

describe('SupplyReadinessPage (Admin)', () => {
  const page = readFile('src/pages/SupplyReadinessPage.jsx');

  it('displays farmer name and location', () => {
    expect(page).toContain('r.farmer?.name');
    expect(page).toContain('r.farmer?.location');
  });

  it('shows trust level badge', () => {
    expect(page).toContain('r.trust?.level');
    expect(page).toContain('r.trust?.label');
  });

  it('has buyer linking via createBuyerLink', () => {
    expect(page).toContain('createBuyerLink');
    expect(page).toContain('Link Buyer');
  });

  it('has CSV export buttons for supply and links', () => {
    expect(page).toContain('exportSupplyCSV');
    expect(page).toContain('exportBuyerLinksCSV');
    expect(page).toContain('Export Supply CSV');
  });

  it('supports readyOnly and crop filters', () => {
    expect(page).toContain('readyOnly');
    expect(page).toContain('cropFilter');
  });
});

// ─── 8. App Route + Nav ─────────────────────────────────────────

describe('App Routing — Supply Readiness', () => {
  const app = readFile('src/App.jsx');

  it('lazy-loads SupplyReadinessPage', () => {
    expect(app).toContain("import('./pages/SupplyReadinessPage.jsx')");
  });

  it('mounts admin/supply route with ADMIN_ROLES guard', () => {
    expect(app).toContain('admin/supply');
    expect(app).toContain('SupplyReadinessPage');
    expect(app).toContain('ADMIN_ROLES');
  });
});

describe('Layout Nav — Supply Readiness', () => {
  const layout = readFile('src/components/Layout.jsx');

  it('has Supply Readiness nav link in Admin section', () => {
    expect(layout).toContain("'/admin/supply'");
    expect(layout).toContain('Supply Readiness');
  });
});

// ─── 9. i18n Translations ───────────────────────────────────────

describe('i18n — Supply Readiness Keys', () => {
  const translations = readFile('src/i18n/translations.js');

  it('has supply readiness translation keys', () => {
    expect(translations).toContain("'supply.title'");
    expect(translations).toContain("'supply.desc'");
    expect(translations).toContain("'supply.readyQuestion'");
    expect(translations).toContain("'supply.quantity'");
    expect(translations).toContain("'supply.harvestDate'");
    expect(translations).toContain("'supply.saved'");
  });

  it('has all 5 languages for supply.title', () => {
    const block = translations.substring(
      translations.indexOf("'supply.title'"),
      translations.indexOf("'supply.title'") + 200,
    );
    expect(block).toContain('en:');
    expect(block).toContain('fr:');
    expect(block).toContain('sw:');
    expect(block).toContain('ha:');
    expect(block).toContain('tw:');
  });

  it('has skip key (RULE 2)', () => {
    expect(translations).toContain("'supply.skip'");
  });

  it('has offline hint and save keys (RULE 6)', () => {
    expect(translations).toContain("'supply.offlineHint'");
    expect(translations).toContain("'supply.offlineSave'");
  });
});
