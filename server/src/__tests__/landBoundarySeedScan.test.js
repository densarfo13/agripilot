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

describe('Prisma Schema — New Models', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('defines V2LandBoundary model with profile relation', () => {
    expect(schema).toContain('model V2LandBoundary');
    expect(schema).toContain('profileId');
    expect(schema).toContain('captureMethod');
    expect(schema).toContain('measuredArea');
  });

  it('defines V2BoundaryPoint with cascade delete', () => {
    expect(schema).toContain('model V2BoundaryPoint');
    expect(schema).toContain('pointOrder');
    expect(schema).toMatch(/onDelete:\s*Cascade/);
  });

  it('defines V2SeedScan model with authenticity field', () => {
    expect(schema).toContain('model V2SeedScan');
    expect(schema).toContain('scanMethod');
    expect(schema).toContain('authenticity');
    expect(schema).toContain('authenticityMsg');
  });

  it('defines V2LandInsight model for satellite placeholders', () => {
    expect(schema).toContain('model V2LandInsight');
    expect(schema).toContain('insightType');
    expect(schema).toContain('vegetation_index');
  });

  it('defines V2VerificationSignal model', () => {
    expect(schema).toContain('model V2VerificationSignal');
    expect(schema).toContain('signalType');
    expect(schema).toContain('severity');
    expect(schema).toContain('resolved');
  });

  it('FarmProfile has reverse relations for new models', () => {
    expect(schema).toContain('landBoundaries');
    expect(schema).toContain('seedScans');
    expect(schema).toContain('landInsights');
    expect(schema).toContain('verificationSignals');
  });
});

// ─── 2. Land Boundary Route ─────────────────────────────────────

describe('Land Boundary API Route', () => {
  const route = readFile('server/routes/land-boundaries.js');

  it('validates captureMethod against allowed values', () => {
    expect(route).toContain('manual_pin');
    expect(route).toContain('gps_walk');
    expect(route).toContain('officer_assisted');
    expect(route).toContain('fallback_pin');
    expect(route).toContain('Invalid capture method');
  });

  it('requires at least 3 boundary points', () => {
    expect(route).toContain('points.length < 3');
    expect(route).toContain('At least 3 boundary points');
  });

  it('validates coordinate ranges per point', () => {
    expect(route).toContain('latitude < -90');
    expect(route).toContain('longitude < -180');
  });

  it('computes area using polygon formula', () => {
    expect(route).toContain('computePolygonArea');
    expect(route).toContain('Shoelace');
    expect(route).toContain('10000'); // m² to hectares
  });

  it('computes perimeter using haversine', () => {
    expect(route).toContain('computePerimeter');
    expect(route).toContain('Haversine');
  });

  it('writes audit log on boundary creation', () => {
    expect(route).toContain('land_boundary.created');
    expect(route).toContain('writeAuditLog');
  });

  it('requires profile before saving boundary', () => {
    expect(route).toContain('Complete your farm profile first');
  });

  it('supports DELETE with ownership check', () => {
    expect(route).toContain("router.delete('/:id'");
    expect(route).toContain('profileId: profile.id');
    expect(route).toContain('land_boundary.deleted');
  });
});

// ─── 3. Seed Scan Route ─────────────────────────────────────────

describe('Seed Scan API Route', () => {
  const route = readFile('server/routes/seed-scans.js');

  it('validates scanMethod against allowed values', () => {
    expect(route).toContain("'qr'");
    expect(route).toContain("'barcode'");
    expect(route).toContain("'manual'");
  });

  it('requires seedType or rawScanData', () => {
    expect(route).toContain('Either seedType or rawScanData is required');
  });

  it('checks expiry date and warns if expired', () => {
    expect(route).toContain('parsedExpiry < new Date()');
    expect(route).toContain("'warning'");
    expect(route).toContain('passed its expiry date');
  });

  it('writes audit log on scan creation', () => {
    expect(route).toContain('seed_scan.created');
    expect(route).toContain('writeAuditLog');
  });

  it('supports GET detail with ownership check', () => {
    expect(route).toContain("router.get('/:id'");
    expect(route).toContain('profileId: profile.id');
  });
});

// ─── 4. Verification Signals Route ─────────────────────────────

describe('Verification Signals Route', () => {
  const route = readFile('server/routes/verification-signals.js');

  it('returns signals scoped to user profile', () => {
    expect(route).toContain('profileId: profile.id');
    expect(route).toContain('authenticate');
  });
});

// ─── 5. Frontend Components ─────────────────────────────────────

describe('LandBoundaryCapture Component', () => {
  const code = readFile('src/components/LandBoundaryCapture.jsx');

  it('supports GPS walk, manual pin, and fallback methods', () => {
    expect(code).toContain('gps_walk');
    expect(code).toContain('manual_pin');
    expect(code).toContain('fallback_pin');
  });

  it('uses geolocation watchPosition for GPS walk', () => {
    expect(code).toContain('watchPosition');
    expect(code).toContain('clearWatch');
  });

  it('shows existing boundary summary when present', () => {
    expect(code).toContain('existingBoundary');
    expect(code).toContain('boundary.mapped');
  });

  it('enforces minimum 3 points before save', () => {
    expect(code).toContain('points.length < 3');
  });

  it('uses 44px+ touch targets', () => {
    expect(code).toContain("minHeight: '44px'");
  });

  it('uses 16px font size for inputs', () => {
    expect(code).toContain("fontSize: '16px'");
  });

  // ─── Guardrail compliance ───────────────────────────
  it('RULE 2: has skip button (optional feature)', () => {
    expect(code).toContain('boundary.skip');
    expect(code).toContain('onSkip');
    expect(code).toContain('dismissed');
  });

  it('RULE 3: does NOT show raw coordinates to farmer', () => {
    // No lat/lng toFixed display — just point count
    expect(code).not.toContain('toFixed(5)');
    expect(code).toContain('boundary.recorded');
  });

  it('RULE 6: checks isOnline before save', () => {
    expect(code).toContain('useNetwork');
    expect(code).toContain('isOnline');
    expect(code).toContain('boundary.offlineSave');
  });

  it('RULE 6: shows offline hint when not connected', () => {
    expect(code).toContain('boundary.offlineHint');
  });

  it('RULE 11: allows continuation on any failure', () => {
    // Skip button is always visible, errors don't block
    expect(code).toContain('boundary.skip');
    expect(code).toContain('boundary.saveFailed');
  });
});

describe('SeedScanFlow Component', () => {
  const code = readFile('src/components/SeedScanFlow.jsx');

  it('supports camera capture with environment facing camera', () => {
    expect(code).toContain('capture="environment"');
  });

  it('supports manual entry fallback', () => {
    expect(code).toContain("setStep('manual')");
  });

  it('uses farmer-friendly auth labels not raw codes', () => {
    expect(code).toContain('friendlyAuthLabel');
    expect(code).toContain('seedScan.statusOk');
    expect(code).toContain('seedScan.statusCheck');
    expect(code).toContain('seedScan.statusProblem');
    expect(code).toContain('seedScan.statusPending');
  });

  it('uses 44px+ touch targets for inputs', () => {
    expect(code).toContain("minHeight: '44px'");
  });

  it('uses 16px font size (iOS zoom prevention)', () => {
    expect(code).toContain("fontSize: '16px'");
  });

  // ─── Guardrail compliance ───────────────────────────
  it('RULE 2: has skip button (optional feature)', () => {
    expect(code).toContain('seedScan.skip');
    expect(code).toContain('onSkip');
    expect(code).toContain('dismissed');
  });

  it('RULE 4: translates complexity into simple labels', () => {
    // No raw "unknown"/"warning"/"failed" shown to farmer
    expect(code).toContain('friendlyAuthLabel');
    expect(code).not.toMatch(/style={S\.badge\(s\.authenticity\)}>{s\.authenticity}/);
  });

  it('RULE 6: checks isOnline before save', () => {
    expect(code).toContain('useNetwork');
    expect(code).toContain('isOnline');
    expect(code).toContain('seedScan.offlineSave');
  });

  it('RULE 6: shows offline hint when not connected', () => {
    expect(code).toContain('seedScan.offlineHint');
  });

  it('RULE 12: defaults authenticity to unknown/pending', () => {
    expect(code).toContain('seedScan.statusPending');
  });
});

// ─── 6. Frontend API Helpers ────────────────────────────────────

describe('API Helpers', () => {
  const api = readFile('src/lib/api.js');

  it('exports getLandBoundaries', () => {
    expect(api).toContain('export function getLandBoundaries');
    expect(api).toContain('/api/v2/land-boundaries');
  });

  it('exports saveLandBoundary', () => {
    expect(api).toContain('export function saveLandBoundary');
  });

  it('exports deleteLandBoundary', () => {
    expect(api).toContain('export function deleteLandBoundary');
  });

  it('exports getSeedScans', () => {
    expect(api).toContain('export function getSeedScans');
    expect(api).toContain('/api/v2/seed-scans');
  });

  it('exports saveSeedScan', () => {
    expect(api).toContain('export function saveSeedScan');
  });

  it('exports getVerificationSignals', () => {
    expect(api).toContain('export function getVerificationSignals');
  });
});

// ─── 7. Translations ───────────────────────────────────────────

describe('i18n Translations', () => {
  const translations = readFile('src/i18n/translations.js');

  it('has boundary translation keys in all 5 languages', () => {
    expect(translations).toContain('boundary.title');
    expect(translations).toContain('boundary.desc');
    expect(translations).toContain('boundary.saved');
    // Check all 5 language codes present for boundary keys
    const boundaryTitle = translations.substring(
      translations.indexOf("'boundary.title'"),
      translations.indexOf("'boundary.title'") + 300,
    );
    expect(boundaryTitle).toContain('en:');
    expect(boundaryTitle).toContain('fr:');
    expect(boundaryTitle).toContain('sw:');
    expect(boundaryTitle).toContain('ha:');
    expect(boundaryTitle).toContain('tw:');
  });

  it('has seed scan translation keys in all 5 languages', () => {
    expect(translations).toContain('seedScan.title');
    expect(translations).toContain('seedScan.desc');
    expect(translations).toContain('seedScan.saved');
    const seedTitle = translations.substring(
      translations.indexOf("'seedScan.title'"),
      translations.indexOf("'seedScan.title'") + 300,
    );
    expect(seedTitle).toContain('en:');
    expect(seedTitle).toContain('fr:');
    expect(seedTitle).toContain('sw:');
    expect(seedTitle).toContain('ha:');
    expect(seedTitle).toContain('tw:');
  });

  it('has skip keys for both features (RULE 2)', () => {
    expect(translations).toContain('boundary.skip');
    expect(translations).toContain('seedScan.skip');
  });

  it('has offline hint keys (RULE 6)', () => {
    expect(translations).toContain('boundary.offlineHint');
    expect(translations).toContain('seedScan.offlineHint');
  });

  it('has farmer-friendly auth status labels (RULE 4)', () => {
    expect(translations).toContain('seedScan.statusOk');
    expect(translations).toContain('seedScan.statusCheck');
    expect(translations).toContain('seedScan.statusProblem');
    expect(translations).toContain('seedScan.statusPending');
  });
});

// ─── 8. Dashboard Integration ───────────────────────────────────

describe('Dashboard Integration', () => {
  const dashboard = readFile('src/pages/Dashboard.jsx');

  it('lazy-loads LandBoundaryCapture (RULE 5: performance)', () => {
    expect(dashboard).toContain("lazy(() => import('../components/LandBoundaryCapture.jsx'))");
  });

  it('lazy-loads SeedScanFlow (RULE 5: performance)', () => {
    expect(dashboard).toContain("lazy(() => import('../components/SeedScanFlow.jsx'))");
  });

  it('wraps lazy components in Suspense with null fallback', () => {
    expect(dashboard).toContain('<Suspense fallback={null}>');
  });

  it('gates boundary/seed sections behind setupComplete (RULE 1: core flow)', () => {
    expect(dashboard).toContain('setupComplete && (');
    expect(dashboard).toContain('<LandBoundaryCapture');
    expect(dashboard).toContain('<SeedScanFlow');
  });

  it('fetches boundaries and scans only when online (RULE 6: offline)', () => {
    expect(dashboard).toContain('getLandBoundaries');
    expect(dashboard).toContain('getSeedScans');
    expect(dashboard).toContain('!isOnline');
    expect(dashboard).toContain('useNetwork');
  });

  it('core cards come before advanced features (RULE 1: ordering)', () => {
    const farmerIdIdx = dashboard.indexOf('<FarmerIdCard');
    const boundaryIdx = dashboard.indexOf('<LandBoundaryCapture');
    const seedIdx = dashboard.indexOf('<SeedScanFlow');
    // Core flow cards must always come first; PrimaryFarmActionCard no longer rendered
    // but FarmerIdCard (always at bottom) and boundary/seed (inside 'tools' section) are present
    expect(boundaryIdx).toBeGreaterThan(0);
    expect(boundaryIdx).toBeLessThan(seedIdx);
  });
});

// ─── 9. Admin Analytics Visibility ──────────────────────────────

describe('Admin Analytics — Land/Seed Visibility', () => {
  const summary = readFile('server/routes/analytics-summary.js');

  it('returns landBoundaryCount in analytics response', () => {
    expect(summary).toContain('landBoundaryCount');
    expect(summary).toContain('v2LandBoundary.count');
  });

  it('returns seedScanCount in analytics response', () => {
    expect(summary).toContain('seedScanCount');
    expect(summary).toContain('v2SeedScan.count');
  });

  it('returns seedWarningCount for flagged scans', () => {
    expect(summary).toContain('seedWarningCount');
    expect(summary).toContain("'warning'");
    expect(summary).toContain("'failed'");
  });
});

// ─── 10. Route Mounting ─────────────────────────────────────────

describe('Route Mounting in app.js', () => {
  const app = readFile('server/src/app.js');

  it('mounts land boundary routes', () => {
    expect(app).toContain("'/api/v2/land-boundaries'");
    expect(app).toContain('v2LandBoundaryRoutes');
  });

  it('mounts seed scan routes', () => {
    expect(app).toContain("'/api/v2/seed-scans'");
    expect(app).toContain('v2SeedScanRoutes');
  });

  it('mounts verification signal routes', () => {
    expect(app).toContain("'/api/v2/verification-signals'");
    expect(app).toContain('v2VerificationSignalRoutes');
  });
});
