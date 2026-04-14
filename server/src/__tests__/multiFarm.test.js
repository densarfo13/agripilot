/**
 * Multi-Farm Support — source-code enforcement tests.
 *
 * Verifies multi-active farms: multiple farms active simultaneously,
 * isDefault for convenience, farm selection in update flow,
 * per-farm seasons, and accurate reporting.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  SCHEMA — data model supports multi-active farms
// ═══════════════════════════════════════════════════════════

describe('Multi-farm schema', () => {
  const schema = read('server/prisma/schema.prisma');

  it('FarmProfile has status field with default active', () => {
    expect(schema).toContain('status');
    expect(schema).toContain('@default("active")');
  });

  it('FarmProfile has isDefault boolean field', () => {
    expect(schema).toContain('isDefault');
    expect(schema).toContain('@default(false)');
    expect(schema).toContain('is_default');
  });

  it('FarmProfile userId is NOT unique (allows 1:many)', () => {
    const lines = schema.split('\n');
    const userIdLine = lines.find((l) => l.includes('user_id_direct'));
    expect(userIdLine).toBeTruthy();
    expect(userIdLine).not.toContain('@unique');
  });

  it('FarmProfile has index on userId for query performance', () => {
    expect(schema).toContain('idx_farm_profiles_user');
  });

  it('FarmProfile has index on status', () => {
    expect(schema).toContain('idx_farm_profiles_status');
  });

  it('FarmProfile has composite index on userId + isDefault', () => {
    expect(schema).toContain('idx_farm_profiles_default');
  });

  it('V2Season has farmProfileId FK to FarmProfile', () => {
    expect(schema).toContain('farmProfileId');
    expect(schema).toContain('farm_profile_id');
  });

  it('V2Season has index on farmProfileId', () => {
    expect(schema).toContain('idx_v2_seasons_farm_profile');
  });

  it('User model has farmProfiles relation (plural)', () => {
    expect(schema).toContain('farmProfiles');
  });
});

// ═══════════════════════════════════════════════════════════
//  MIGRATION — multi-active + isDefault
// ═══════════════════════════════════════════════════════════

describe('Multi-active farms migration', () => {
  const sql = read('server/prisma/migrations/20260413_multi_active_farms/migration.sql');

  it('adds is_default column', () => {
    expect(sql).toContain('ADD COLUMN "is_default"');
    expect(sql).toContain('DEFAULT false');
  });

  it('backfills default farm for existing users', () => {
    expect(sql).toContain('SET "is_default" = true');
    expect(sql).toContain("status");
  });

  it('reactivates inactive (non-archived) farms', () => {
    expect(sql).toContain("SET \"status\" = 'active'");
    expect(sql).toContain("WHERE \"status\" = 'inactive'");
  });

  it('creates index for default farm lookups', () => {
    expect(sql).toContain('idx_farm_profiles_default');
  });
});

// ═══════════════════════════════════════════════════════════
//  BACKEND — farmProfile routes support multi-active
// ═══════════════════════════════════════════════════════════

describe('Farm profile routes — multi-active', () => {
  const src = read('server/routes/farmProfile.js');

  it('GET / returns default farm first, then active farm', () => {
    expect(src).toContain('isDefault: true');
    expect(src).toContain("status: 'active'");
  });

  it('maps isDefault in response', () => {
    expect(src).toContain('isDefault: profile.isDefault');
  });

  it('has GET /list endpoint for all farms', () => {
    expect(src).toContain("'/list'");
    expect(src).toContain('findMany');
  });

  it('list sorts by isDefault desc (default first)', () => {
    expect(src).toContain("isDefault: 'desc'");
  });

  it('POST /new does NOT deactivate other farms', () => {
    // Should NOT contain updateMany to set status inactive in the /new route
    const newRouteSection = src.split("'/new'")[1]?.split('router.')[0] || '';
    expect(newRouteSection).not.toContain("status: 'inactive'");
  });

  it('POST /new sets isDefault only when first farm', () => {
    expect(src).toContain('existingCount === 0');
    expect(src).toContain('isDefault: existingCount === 0');
  });

  it('has POST /:id/set-default endpoint', () => {
    expect(src).toContain("'/:id/set-default'");
  });

  it('set-default uses transaction to ensure single default', () => {
    expect(src).toContain('$transaction');
    expect(src).toContain('isDefault: false');
    expect(src).toContain('isDefault: true');
  });

  it('set-default blocks non-active farms', () => {
    expect(src).toContain('Only active farms can be set as default');
  });

  it('has POST /:id/activate endpoint (reactivate)', () => {
    expect(src).toContain("'/:id/activate'");
  });

  it('activate does NOT deactivate other farms', () => {
    const activateSection = src.split("'/:id/activate'")[1]?.split('router.')[0] || '';
    expect(activateSection).not.toContain('updateMany');
  });

  it('has POST /:id/deactivate endpoint', () => {
    expect(src).toContain("'/:id/deactivate'");
  });

  it('deactivate promotes next farm as default if needed', () => {
    expect(src).toContain('wasDefault');
    expect(src).toContain('farm_profile.deactivated');
  });

  it('has POST /:id/archive endpoint', () => {
    expect(src).toContain("'/:id/archive'");
  });

  it('archive clears isDefault and promotes next farm', () => {
    const archiveSection = src.split("'/:id/archive'")[1] || '';
    expect(archiveSection).toContain('isDefault: false');
    expect(archiveSection).toContain('wasDefault');
  });

  it('writes audit logs for all farm operations', () => {
    expect(src).toContain('farm_profile.created_new');
    expect(src).toContain('farm_profile.set_default');
    expect(src).toContain('farm_profile.activated');
    expect(src).toContain('farm_profile.deactivated');
    expect(src).toContain('farm_profile.archived');
  });
});

// ═══════════════════════════════════════════════════════════
//  BACKEND — seasons are per-farm (not global)
// ═══════════════════════════════════════════════════════════

describe('Season routes — per-farm seasons', () => {
  const src = read('server/routes/seasons.js');

  it('GET /active supports farmId query param', () => {
    expect(src).toContain('req.query.farmId');
  });

  it('GET /active falls back to default farm', () => {
    expect(src).toContain('isDefault: true');
  });

  it('POST /start accepts farmId in body', () => {
    expect(src).toContain('req.body?.farmId');
  });

  it('POST /start checks active season per-farm not globally', () => {
    expect(src).toContain('farmProfileId: profile.id');
    expect(src).toContain('This farm already has an active season');
  });

  it('POST /start sets farmProfileId on the new season', () => {
    expect(src).toContain('farmProfileId: profile.id');
  });

  it('POST /start resolves default farm when no farmId given', () => {
    expect(src).toContain('isDefault: true');
  });
});

// ═══════════════════════════════════════════════════════════
//  BACKEND — related routes use findFirst with status
// ═══════════════════════════════════════════════════════════

describe('Related V2 routes use findFirst with active status', () => {
  const files = [
    'server/routes/land-boundaries.js',
    'server/routes/supply-readiness.js',
    'server/routes/verification-signals.js',
    'server/routes/seed-scans.js',
  ];

  for (const file of files) {
    it(`${file} does not use findUnique on userId`, () => {
      const src = read(file);
      const hasOldPattern = /farmProfile\.findUnique\(/.test(src);
      expect(hasOldPattern).toBe(false);
    });

    it(`${file} uses findFirst with active status`, () => {
      const src = read(file);
      expect(src).toContain('findFirst');
      expect(src).toContain("status: 'active'");
    });
  }
});

// ═══════════════════════════════════════════════════════════
//  FRONTEND — API functions for multi-farm
// ═══════════════════════════════════════════════════════════

describe('Frontend API — multi-farm endpoints', () => {
  const src = read('src/lib/api.js');

  it('exports getFarms function', () => {
    expect(src).toContain('export function getFarms');
    expect(src).toContain('/api/v2/farm-profile/list');
  });

  it('exports createNewFarm function', () => {
    expect(src).toContain('export function createNewFarm');
    expect(src).toContain('/api/v2/farm-profile/new');
  });

  it('exports setDefaultFarm function', () => {
    expect(src).toContain('export function setDefaultFarm');
    expect(src).toContain('/set-default');
  });

  it('exports switchActiveFarm function', () => {
    expect(src).toContain('export function switchActiveFarm');
    expect(src).toContain('/activate');
  });

  it('exports deactivateFarm function', () => {
    expect(src).toContain('export function deactivateFarm');
    expect(src).toContain('/deactivate');
  });

  it('exports archiveFarm function', () => {
    expect(src).toContain('export function archiveFarm');
    expect(src).toContain('/archive');
  });
});

// ═══════════════════════════════════════════════════════════
//  FRONTEND — ProfileContext supports multi-active
// ═══════════════════════════════════════════════════════════

describe('ProfileContext — multi-active support', () => {
  const src = read('src/context/ProfileContext.jsx');

  it('imports getFarms and setDefaultFarm from API', () => {
    expect(src).toContain('getFarms');
    expect(src).toContain('apiSetDefault');
  });

  it('has farms state array', () => {
    expect(src).toContain('const [farms, setFarms] = useState([])');
  });

  it('has activeFarms computed property', () => {
    expect(src).toContain('activeFarms');
    expect(src).toContain("f.status === 'active'");
  });

  it('exposes activeFarms in context value', () => {
    expect(src).toContain('activeFarms,');
  });

  it('switchFarm calls setDefault (not old activate)', () => {
    expect(src).toContain('apiSetDefault(farmId)');
  });

  it('switchFarm blocks when offline', () => {
    expect(src).toContain('Cannot switch farms while offline');
  });
});

// ═══════════════════════════════════════════════════════════
//  FRONTEND — FarmSwitcher shows multi-active farms
// ═══════════════════════════════════════════════════════════

describe('FarmSwitcher component', () => {
  const src = read('src/components/FarmSwitcher.jsx');

  it('uses activeFarms from context', () => {
    expect(src).toContain('activeFarms');
  });

  it('is always visible (no early return for single farm)', () => {
    expect(src).not.toContain('activeFarms.length <= 1) return null');
    expect(src).toContain('const hasFarms = activeFarms && activeFarms.length > 0');
    expect(src).toContain('const hasMultiple = activeFarms && activeFarms.length > 1');
  });

  it('finds default farm by isDefault', () => {
    expect(src).toContain('f.isDefault');
  });

  it('shows default farm badge', () => {
    expect(src).toContain("t('farm.defaultFarm')");
  });

  it('shows farm count', () => {
    expect(src).toContain('activeFarms.length');
    expect(src).toContain("t('farm.farms')");
  });

  it('has tap-to-set-default hint on other farms', () => {
    expect(src).toContain("t('farm.tapToSetDefault')");
  });

  it('has add new farm button', () => {
    expect(src).toContain("t('farm.addNew')");
    expect(src).toContain('newFarm=1');
  });

  it('shows offline hint when not online', () => {
    expect(src).toContain("t('farm.offlineSwitch')");
  });
});

// ═══════════════════════════════════════════════════════════
//  FRONTEND — FarmPicker for update flow
// ═══════════════════════════════════════════════════════════

describe('FarmPicker component', () => {
  const src = read('src/components/FarmPicker.jsx');

  it('uses activeFarms from context', () => {
    expect(src).toContain('activeFarms');
  });

  it('shows "Which farm?" title', () => {
    expect(src).toContain("t('farm.whichFarm')");
  });

  it('renders a card for each active farm', () => {
    expect(src).toContain('activeFarms.map');
    expect(src).toContain('onSelect(farm)');
  });

  it('shows default badge on default farm', () => {
    expect(src).toContain('farm.isDefault');
    expect(src).toContain("t('farm.default')");
  });

  it('has test IDs for each farm card', () => {
    expect(src).toContain('pick-farm-');
  });

  it('has cancel/close button', () => {
    expect(src).toContain('onCancel');
  });
});

// ═══════════════════════════════════════════════════════════
//  FRONTEND — Dashboard integration
// ═══════════════════════════════════════════════════════════

describe('Dashboard — multi-farm integration', () => {
  const src = read('src/pages/Dashboard.jsx');

  it('imports FarmSwitcher', () => {
    expect(src).toContain("import FarmSwitcher from '../components/FarmSwitcher.jsx'");
  });

  it('imports FarmPicker', () => {
    expect(src).toContain("import FarmPicker from '../components/FarmPicker.jsx'");
  });

  it('renders FarmSwitcher component', () => {
    expect(src).toContain('<FarmSwitcher');
  });

  it('has farm picker flow for multi-farm updates', () => {
    expect(src).toContain('showFarmPicker');
    expect(src).toContain('hasMultipleFarms');
    expect(src).toContain('<FarmPicker');
  });

  it('tracks selected farm for update flow', () => {
    expect(src).toContain('selectedUpdateFarm');
  });

  it('passes selected farm to QuickUpdateFlow', () => {
    expect(src).toContain('selectedUpdateFarm?.id');
  });

  it('uses activeFarms from context', () => {
    expect(src).toContain('activeFarms');
  });
});

// ═══════════════════════════════════════════════════════════
//  FRONTEND — PrimaryFarmActionCard passes farmId
// ═══════════════════════════════════════════════════════════

describe('PrimaryFarmActionCard — farm-scoped season start', () => {
  const src = read('src/components/PrimaryFarmActionCard.jsx');

  it('passes farmId when starting a season', () => {
    expect(src).toContain('farmId: profile?.id');
  });
});

// ═══════════════════════════════════════════════════════════
//  i18n — translation keys for multi-active farms
// ═══════════════════════════════════════════════════════════

describe('i18n — farm keys', () => {
  const src = read('src/i18n/translations.js');

  const requiredKeys = [
    'farm.activeFarm',
    'farm.unnamed',
    'farm.addNew',
    'farm.switchFailed',
    'farm.offlineSwitch',
    'farm.switchSuccess',
    'farm.archiveConfirm',
    'farm.defaultFarm',
    'farm.default',
    'farm.farms',
    'farm.tapToSetDefault',
    'farm.whichFarm',
    'farm.myFarms',
  ];

  for (const key of requiredKeys) {
    it(`has translation key: ${key}`, () => {
      expect(src).toContain(`'${key}'`);
    });
  }

  it('farm keys have English translations', () => {
    for (const key of requiredKeys) {
      const keyPattern = new RegExp(`'${key.replace('.', '\\.')}':\\s*\\{[^}]*en:`);
      expect(src).toMatch(keyPattern);
    }
  });
});
