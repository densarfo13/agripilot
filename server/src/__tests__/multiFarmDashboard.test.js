/**
 * Multi-Farm Dashboard — source-code enforcement tests.
 *
 * Verifies:
 * 1. FarmSwitcher always visible, sorted, recovery-safe
 * 2. FarmSummaryCard shows current farm context
 * 3. FarmEditModal allows editing farm details
 * 4. SeasonContext accepts farmId and auto-refreshes on farm switch
 * 5. API getActiveSeason/getLandBoundaries/getSeedScans accept farmId
 * 6. Dashboard has farm-scoped data loading, empty/switching states
 * 7. ProfileContext: currentFarmId, localStorage persistence, farmSwitching, editFarm, sortFarms
 * 8. Backend: PATCH /:id edit endpoint, duplicate protection, farmId scoping
 * 9. ProfileSetup: newFarm=1 mode uses createNewFarm
 * 10. i18n keys for all new UI
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  1. FARM SWITCHER — always visible, sorted, recovery-safe
// ═══════════════════════════════════════════════════════════

describe('FarmSwitcher — always visible', () => {
  const src = read('src/components/FarmSwitcher.jsx');

  it('does NOT have the old length <= 1 early return', () => {
    expect(src).not.toContain('activeFarms.length <= 1) return null');
  });

  it('computes hasFarms flag', () => {
    expect(src).toContain('const hasFarms = activeFarms && activeFarms.length > 0');
  });

  it('computes hasMultiple flag', () => {
    expect(src).toContain('const hasMultiple = activeFarms && activeFarms.length > 1');
  });

  it('shows "Your Farm" label for single-farm users', () => {
    expect(src).toContain("t('farm.yourFarm')");
  });

  it('shows "Default Farm" label for multi-farm users', () => {
    expect(src).toContain("t('farm.defaultFarm')");
  });

  it('conditionally shows farm count only for multiple farms', () => {
    expect(src).toContain('hasMultiple && (');
    expect(src).toContain("t('farm.farms')");
  });

  it('always shows add new farm button', () => {
    expect(src).toContain("t('farm.addNew')");
    expect(src).toContain('data-testid="add-farm-btn"');
  });

  it('only shows offline hint for multi-farm', () => {
    expect(src).toContain('!isOnline && hasMultiple');
  });

  it('tracks farm switch analytics', () => {
    expect(src).toContain("safeTrackEvent('farm.switched'");
  });

  it('respects farmSwitching state from context', () => {
    expect(src).toContain('farmSwitching');
    expect(src).toContain('switching || farmSwitching');
  });

  it('falls back to first active farm if no default', () => {
    expect(src).toContain('activeFarms.find((f) => f.isDefault) || activeFarms[0]');
  });

  it('navigates to /profile/setup?newFarm=1 for add farm', () => {
    expect(src).toContain("navigate('/profile/setup?newFarm=1')");
  });
});

// ═══════════════════════════════════════════════════════════
//  2. FARM SUMMARY CARD
// ═══════════════════════════════════════════════════════════

describe('FarmSummaryCard', () => {
  const src = read('src/components/FarmSummaryCard.jsx');

  it('exports default function FarmSummaryCard', () => {
    expect(src).toContain('export default function FarmSummaryCard');
  });

  it('shows farm name', () => {
    expect(src).toContain('profile.farmName');
  });

  it('shows location/country', () => {
    expect(src).toContain('profile.location');
    expect(src).toContain('profile.country');
  });

  it('shows size with unit', () => {
    expect(src).toContain('profile.size');
    expect(src).toContain('profile.sizeUnit');
  });

  it('shows crop', () => {
    expect(src).toContain('profile.cropName || profile.cropType');
  });

  it('shows active status badge', () => {
    expect(src).toContain("t('farm.statusActive')");
    expect(src).toContain('statusBadge');
  });

  it('has edit button that calls onEdit', () => {
    expect(src).toContain("t('farm.editFarm')");
    expect(src).toContain('onEdit(profile)');
    expect(src).toContain('data-testid="farm-edit-btn"');
  });

  it('has data-testid for the card', () => {
    expect(src).toContain('data-testid="farm-summary-card"');
  });

  it('returns null when no profile', () => {
    expect(src).toContain('if (!profile) return null');
  });
});

// ═══════════════════════════════════════════════════════════
//  3. FARM EDIT MODAL
// ═══════════════════════════════════════════════════════════

describe('FarmEditModal', () => {
  const src = read('src/components/FarmEditModal.jsx');

  it('exports default function FarmEditModal', () => {
    expect(src).toContain('export default function FarmEditModal');
  });

  it('uses editFarm from ProfileContext', () => {
    expect(src).toContain('const { editFarm } = useProfile()');
  });

  it('has editable farmName field', () => {
    expect(src).toContain('data-testid="edit-farm-name"');
    expect(src).toContain("update('farmName'");
  });

  it('has location field', () => {
    expect(src).toContain("update('location'");
  });

  it('has country field', () => {
    expect(src).toContain("update('country'");
  });

  it('has size and sizeUnit fields', () => {
    expect(src).toContain("update('size'");
    expect(src).toContain("update('sizeUnit'");
  });

  it('has crop field', () => {
    expect(src).toContain("update('cropType'");
  });

  it('validates farmName before save', () => {
    expect(src).toContain('!form.farmName.trim()');
  });

  it('calls editFarm with farm.id', () => {
    expect(src).toContain('editFarm(farm.id, payload)');
  });

  it('has cancel and save buttons', () => {
    expect(src).toContain("t('common.cancel')");
    expect(src).toContain("t('common.save')");
  });

  it('shows saving state', () => {
    expect(src).toContain("t('common.saving')");
    expect(src).toContain('disabled={saving}');
  });

  it('has error display', () => {
    expect(src).toContain("t('farm.editFailed')");
  });

  it('has data-testid for modal', () => {
    expect(src).toContain('data-testid="farm-edit-modal"');
  });

  it('tracks edit events', () => {
    expect(src).toContain("safeTrackEvent('farm.edit_saved'");
  });
});

// ═══════════════════════════════════════════════════════════
//  4. SEASON CONTEXT — farm-aware refresh
// ═══════════════════════════════════════════════════════════

describe('SeasonContext — farm-aware refresh', () => {
  const src = read('src/context/SeasonContext.jsx');

  it('imports useProfile', () => {
    expect(src).toContain("import { useProfile } from './ProfileContext.jsx'");
  });

  it('tracks currentFarmId from profile', () => {
    expect(src).toContain('const currentFarmId = profile?.id || null');
  });

  it('refreshSeason accepts optional farmId parameter', () => {
    expect(src).toContain('const refreshSeason = useCallback(async (farmId)');
  });

  it('passes farmId to getActiveSeason', () => {
    expect(src).toContain('getActiveSeason(farmId || undefined)');
  });

  it('auto-refreshes when currentFarmId changes', () => {
    expect(src).toContain('currentFarmId !== prevFarmIdRef.current');
    expect(src).toContain('refreshSeason(currentFarmId)');
  });
});

// ═══════════════════════════════════════════════════════════
//  5. API — farm-scoped endpoints
// ═══════════════════════════════════════════════════════════

describe('API — farm-scoped data fetching', () => {
  const src = read('src/lib/api.js');

  it('getActiveSeason accepts farmId', () => {
    expect(src).toContain('export function getActiveSeason(farmId)');
    expect(src).toContain('?farmId=');
  });

  it('getLandBoundaries accepts farmId', () => {
    expect(src).toContain('export function getLandBoundaries(farmId)');
    const fnBody = src.substring(src.indexOf('export function getLandBoundaries'), src.indexOf('export function getLandBoundaries') + 200);
    expect(fnBody).toContain('farmId');
  });

  it('getSeedScans accepts farmId', () => {
    expect(src).toContain('export function getSeedScans(farmId)');
    const fnBody = src.substring(src.indexOf('export function getSeedScans'), src.indexOf('export function getSeedScans') + 200);
    expect(fnBody).toContain('farmId');
  });

  it('exports updateFarm function', () => {
    expect(src).toContain('export function updateFarm(farmId, payload)');
  });

  it('updateFarm calls PATCH endpoint', () => {
    const fnBody = src.substring(src.indexOf('export function updateFarm'), src.indexOf('export function updateFarm') + 200);
    expect(fnBody).toContain("method: 'PATCH'");
  });
});

// ═══════════════════════════════════════════════════════════
//  6. DASHBOARD — farm-scoped state, empty, switching
// ═══════════════════════════════════════════════════════════

describe('Dashboard — farm-scoped data isolation', () => {
  const src = read('src/pages/Dashboard.jsx');

  it('FarmSummaryCard component file exists', () => {
    expect(existsSync(join(root, 'src/components/FarmSummaryCard.jsx'))).toBe(true);
  });

  it('imports FarmEditModal', () => {
    expect(src).toContain("import FarmEditModal from '../components/FarmEditModal.jsx'");
  });

  it('FarmSummaryCard component file exists and exports default', () => {
    const cardSrc = read('src/components/FarmSummaryCard.jsx');
    expect(cardSrc).toContain("export default function FarmSummaryCard");
  });

  it('renders FarmEditModal when showEditModal', () => {
    expect(src).toContain('showEditModal && profile && (');
    expect(src).toContain('<FarmEditModal');
  });

  it('tracks currentFarmId from context', () => {
    expect(src).toContain('currentFarmId');
  });

  it('tracks farmSwitching state', () => {
    expect(src).toContain('farmSwitching');
  });

  it('shows switching loading state', () => {
    expect(src).toContain("t('farm.switchingFarm')");
    expect(src).toContain('switchLoading');
  });

  it('clears previous farm data on switch', () => {
    expect(src).toContain('setBoundaries([])');
    expect(src).toContain('setSeedScans([])');
    expect(src).toContain('currentFarmId !== prevFarmIdRef.current');
  });

  it('passes farmId to loadFarmScopedData', () => {
    expect(src).toContain('getLandBoundaries(farmId)');
    expect(src).toContain('getSeedScans(farmId)');
  });

  it('has farmDataLoading state', () => {
    expect(src).toContain('farmDataLoading');
    expect(src).toContain('setFarmDataLoading');
  });

  it('renders FarmSwitcher (always visible)', () => {
    expect(src).toContain('<FarmSwitcher />');
  });

  it('has empty state for no farms', () => {
    expect(src).toContain("t('farm.noFarmsTitle')");
    expect(src).toContain("t('farm.noFarmsDesc')");
    expect(src).toContain("t('farm.createFirst')");
  });

  it('tracks dashboard.viewed with farmId', () => {
    expect(src).toContain("safeTrackEvent('dashboard.viewed', { farmId: currentFarmId })");
  });
});

// ═══════════════════════════════════════════════════════════
//  7. PROFILE CONTEXT — farm management
// ═══════════════════════════════════════════════════════════

describe('ProfileContext — multi-farm management', () => {
  const src = read('src/context/ProfileContext.jsx');

  it('defines CURRENT_FARM_KEY for localStorage', () => {
    expect(src).toContain("const CURRENT_FARM_KEY = 'agripilot_currentFarmId'");
  });

  it('has getPersistedFarmId helper', () => {
    expect(src).toContain('function getPersistedFarmId()');
    expect(src).toContain('localStorage.getItem(CURRENT_FARM_KEY)');
  });

  it('has persistFarmId helper', () => {
    expect(src).toContain('function persistFarmId(farmId)');
    expect(src).toContain('localStorage.setItem(CURRENT_FARM_KEY, farmId)');
  });

  it('has resolveCurrentFarm with priority chain', () => {
    expect(src).toContain('function resolveCurrentFarm(farms, persistedId)');
    // Priority: persisted → default → first active
    expect(src).toContain('persistedId');
    expect(src).toContain('f.isDefault');
    expect(src).toContain('active[0]');
  });

  it('has sortFarms function', () => {
    expect(src).toContain('function sortFarms(farms)');
    // Sorts: active first, default first, most recently updated
    expect(src).toContain('statusOrder');
    expect(src).toContain('a.isDefault');
    expect(src).toContain('updatedAt');
  });

  it('exports currentFarmId in context', () => {
    expect(src).toContain('currentFarmId');
    expect(src).toContain("const currentFarmId = profile?.id || null");
  });

  it('exports farmSwitching state', () => {
    expect(src).toContain('farmSwitching');
    expect(src).toContain('setFarmSwitching');
  });

  it('exports editFarm function', () => {
    expect(src).toContain('editFarm');
    expect(src).toContain('apiUpdateFarm(farmId, payload)');
  });

  it('persists farm on profile load', () => {
    expect(src).toContain('persistFarmId(serverProfile.id)');
  });

  it('persists farm on switch', () => {
    expect(src).toContain('persistFarmId(switched.id)');
  });

  it('clears persisted farm on logout', () => {
    expect(src).toContain('persistFarmId(null)');
  });

  it('sorts farms in refreshFarms', () => {
    expect(src).toContain('const sorted = sortFarms(list)');
    expect(src).toContain('setFarms(sorted)');
  });

  it('resolves persisted farm on init if different from server', () => {
    expect(src).toContain('const persistedId = getPersistedFarmId()');
    expect(src).toContain('resolveCurrentFarm(farmsList, persistedId)');
  });

  it('switchFarm sets farmSwitching flag', () => {
    expect(src).toContain('setFarmSwitching(true)');
    // Also in finally block
    expect(src).toContain('setFarmSwitching(false)');
  });

  it('editFarm updates profile if editing current farm', () => {
    expect(src).toContain('updated.id === profile?.id');
  });
});

// ═══════════════════════════════════════════════════════════
//  8. BACKEND — edit endpoint, duplicate protection, farm scoping
// ═══════════════════════════════════════════════════════════

describe('Backend — PATCH /:id edit endpoint', () => {
  const route = read('server/routes/farmProfile.js');

  it('has PATCH /:id route', () => {
    expect(route).toContain("router.patch('/:id'");
  });

  it('verifies ownership via userId check', () => {
    const patchSection = route.substring(route.indexOf("router.patch('/:id'"), route.indexOf("router.patch('/:id'") + 1500);
    expect(patchSection).toContain('userId: req.user.id');
  });

  it('returns 404 if farm not found', () => {
    const patchSection = route.substring(route.indexOf("router.patch('/:id'"), route.indexOf("router.patch('/:id'") + 1500);
    expect(patchSection).toContain('Farm not found');
  });

  it('only allows specific fields to be updated', () => {
    expect(route).toContain("const allowedFields = [");
    expect(route).toContain("'farmName'");
    expect(route).toContain("'location'");
    expect(route).toContain("'country'");
    expect(route).toContain("'cropType'");
  });

  it('recomputes land size when size changes', () => {
    expect(route).toContain('computeLandSizeFields(sizeVal, sizeUnit)');
  });

  it('writes audit log for edit', () => {
    expect(route).toContain("'farm_profile.edited'");
  });

  it('records crop usage if crop changed', () => {
    expect(route).toContain('if (data.crop)');
    expect(route).toContain('recordCropUsage');
  });
});

describe('Backend — duplicate protection on POST /new', () => {
  const route = read('server/routes/farmProfile.js');

  it('checks for duplicate farm name + location', () => {
    expect(route).toContain('farmName: validation.data.farmName');
    expect(route).toContain('locationName: validation.data.location');
    expect(route).toContain("status: { not: 'archived' }");
  });

  it('returns 409 for duplicates', () => {
    expect(route).toContain('409');
    expect(route).toContain('A farm with the same name and location already exists');
  });

  it('returns duplicateFarmId in response', () => {
    expect(route).toContain('duplicateFarmId');
  });
});

describe('Backend — farm-scoped land boundaries', () => {
  const route = read('server/routes/land-boundaries.js');

  it('accepts ?farmId= query parameter', () => {
    expect(route).toContain('req.query.farmId');
  });

  it('looks up farm by id + userId when farmId provided', () => {
    expect(route).toContain('id: farmId, userId: req.user.id');
  });

  it('falls back to default farm when no farmId', () => {
    expect(route).toContain('isDefault: true');
  });
});

describe('Backend — farm-scoped seed scans', () => {
  const route = read('server/routes/seed-scans.js');

  it('accepts ?farmId= query parameter', () => {
    expect(route).toContain('req.query.farmId');
  });

  it('looks up farm by id + userId when farmId provided', () => {
    expect(route).toContain('id: farmId, userId: req.user.id');
  });

  it('falls back to default farm when no farmId', () => {
    expect(route).toContain('isDefault: true');
  });
});

// ═══════════════════════════════════════════════════════════
//  9. PROFILE SETUP — newFarm mode
// ═══════════════════════════════════════════════════════════

describe('ProfileSetup — newFarm mode', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('imports useSearchParams', () => {
    expect(src).toContain("useSearchParams");
  });

  it('reads newFarm query parameter', () => {
    expect(src).toContain("searchParams.get('newFarm')");
    expect(src).toContain('isNewFarmMode');
  });

  it('imports createNewFarm from api', () => {
    expect(src).toContain("import { createNewFarm } from '../lib/api.js'");
  });

  it('uses createNewFarm when in newFarm mode', () => {
    expect(src).toContain('isNewFarmMode ? createNewFarm(form) : saveProfile(form)');
  });

  it('starts with blank form in newFarm mode', () => {
    expect(src).toContain('if (isNewFarmMode)');
    expect(src).toContain('...initialForm');
  });

  it('switches to new farm after creation', () => {
    expect(src).toContain('await switchFarm(newProfile.id)');
  });

  it('navigates to dashboard after new farm creation', () => {
    // In newFarm mode save handler, goes to dashboard not farmer-type
    // Find the second occurrence of isNewFarmMode (in handleSave, not form init)
    const saveSection = src.substring(src.indexOf('isNewFarm: isNewFarmMode'));
    expect(saveSection).toContain("navigate('/dashboard')");
  });

  it('refreshes farms list after new farm creation', () => {
    expect(src).toContain('await refreshFarms()');
  });
});

// ═══════════════════════════════════════════════════════════
//  10. i18n — all new keys
// ═══════════════════════════════════════════════════════════

describe('i18n — multi-farm dashboard keys', () => {
  const translations = read('src/i18n/translations.js');

  const requiredKeys = [
    'farm.yourFarm',
    'farm.noFarmsTitle',
    'farm.noFarmsDesc',
    'farm.createFirst',
    'farm.editFarm',
    'farm.editFailed',
    'farm.statusActive',
    'farm.statusArchived',
    'farm.switchingFarm',
    'farm.duplicateError',
    'common.cancel',
    'common.save',
    'common.saving',
  ];

  for (const key of requiredKeys) {
    it(`has key: ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('all new keys have 5 languages', () => {
    for (const key of requiredKeys) {
      const start = translations.indexOf(`'${key}'`);
      const block = translations.substring(start, start + 600);
      expect(block).toContain('en:');
      expect(block).toContain('fr:');
      expect(block).toContain('sw:');
      expect(block).toContain('ha:');
      expect(block).toContain('tw:');
    }
  });

  it('preserves existing farm switcher keys', () => {
    expect(translations).toContain("'farm.defaultFarm'");
    expect(translations).toContain("'farm.addNew'");
    expect(translations).toContain("'farm.tapToSetDefault'");
    expect(translations).toContain("'farm.switchFailed'");
    expect(translations).toContain("'farm.activeFarm'");
    expect(translations).toContain("'farm.unnamed'");
  });
});

// ═══════════════════════════════════════════════════════════
//  EXISTING INFRASTRUCTURE — preserved
// ═══════════════════════════════════════════════════════════

describe('Existing multi-farm infrastructure preserved', () => {
  it('ProfileContext still has switchFarm', () => {
    const src = read('src/context/ProfileContext.jsx');
    expect(src).toContain('const switchFarm = useCallback');
    expect(src).toContain('apiSetDefault(farmId)');
  });

  it('ProfileContext still computes activeFarms', () => {
    const src = read('src/context/ProfileContext.jsx');
    expect(src).toContain("farms.filter((f) => f.status === 'active')");
  });

  it('API still has multi-farm endpoints', () => {
    const src = read('src/lib/api.js');
    expect(src).toContain('export function getFarms()');
    expect(src).toContain('export function createNewFarm(');
    expect(src).toContain('export function setDefaultFarm(');
    expect(src).toContain('export function deactivateFarm(');
    expect(src).toContain('export function archiveFarm(');
  });

  it('SeasonContext still exports all original functions', () => {
    const src = read('src/context/SeasonContext.jsx');
    expect(src).toContain('refreshSeason');
    expect(src).toContain('beginSeason');
    expect(src).toContain('finishSeason');
    expect(src).toContain('markTaskComplete');
  });

  it('Backend still has all farm CRUD endpoints', () => {
    const route = read('server/routes/farmProfile.js');
    expect(route).toContain("router.get('/', authenticate");
    expect(route).toContain("router.get('/list', authenticate");
    expect(route).toContain("router.post('/', authenticate");
    expect(route).toContain("router.post('/new', authenticate");
    expect(route).toContain("router.post('/:id/set-default', authenticate");
    expect(route).toContain("router.post('/:id/activate', authenticate");
    expect(route).toContain("router.post('/:id/deactivate', authenticate");
    expect(route).toContain("router.post('/:id/archive', authenticate");
    expect(route).toContain("router.patch('/:id', authenticate");
  });

  it('Backend enforces ownership on all endpoints', () => {
    const route = read('server/routes/farmProfile.js');
    // Count userId: req.user.id occurrences — should be in every endpoint
    const matches = route.match(/userId: req\.user\.id/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(8);
  });
});
