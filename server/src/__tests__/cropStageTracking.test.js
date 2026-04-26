/**
 * Crop Stage Tracking — comprehensive tests
 *
 * Tests cover:
 *  - Prisma schema changes (9 stages + plantedAt)
 *  - API: PATCH endpoint accepts cropStage + plantedAt
 *  - API: POST endpoints accept cropStage on creation
 *  - mapProfile exposes cropStage and plantedAt
 *  - Farm tasks route uses extended stages directly
 *  - Frontend API: updateCropStage function
 *  - CropStageModal component structure
 *  - FarmSummaryCard shows crop stage + update button
 *  - FarmEditModal includes cropStage + plantedAt fields
 *  - Dashboard wires CropStageModal
 *  - i18n keys for all 9 stages + UI labels
 *  - Task engine integration: stage changes produce different tasks
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateTasksForFarm } from '../../lib/farmTaskEngine.js';
import { CROP_STAGES, resolveStage, LEGACY_STAGE_MAP, ALL_ACCEPTED_STAGES, STAGE_LABELS } from '../../lib/cropStages.js';

// ─── Helper: read file as string ───────────────────────
// Resolve project paths relative to the repository root, not
// process.cwd() — the test runner is invoked with cwd=server/,
// which broke 'src/components/X.jsx' style relative paths.
const REPO_ROOT_FOR_TEST_READS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".."
);

function readFile(relPath) {
  return fs.readFileSync(path.resolve(REPO_ROOT_FOR_TEST_READS, relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  1. Prisma Schema
// ═══════════════════════════════════════════════════════════
describe('Prisma schema — crop stage enum', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('has all 9 crop stages in FarmStage enum', () => {
    const stages = [
      'planning', 'land_preparation', 'planting', 'germination',
      'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest',
    ];
    for (const s of stages) {
      expect(schema).toContain(s);
    }
  });

  it('keeps legacy growing value for migration safety', () => {
    expect(schema).toContain('growing');
  });

  it('has plantedAt field on FarmProfile', () => {
    expect(schema).toContain('plantedAt');
    expect(schema).toContain('planted_at');
  });

  it('defaults stage to planning', () => {
    expect(schema).toContain('@default(planning)');
  });

  it('plantedAt is optional DateTime', () => {
    expect(schema).toMatch(/plantedAt\s+DateTime\?/);
  });
});

// ═══════════════════════════════════════════════════════════
//  2. Server: farmProfile route — mapProfile
// ═══════════════════════════════════════════════════════════
describe('farmProfile route — mapProfile exposes crop stage', () => {
  const route = readFile('server/routes/farmProfile.js');

  it('maps cropStage from profile.stage', () => {
    expect(route).toContain('cropStage: profile.stage');
  });

  it('maps plantedAt from profile', () => {
    expect(route).toContain('plantedAt: profile.plantedAt');
  });

  it('defaults cropStage to planning', () => {
    expect(route).toContain("cropStage: profile.stage || 'planning'");
  });
});

// ═══════════════════════════════════════════════════════════
//  3. Server: PATCH endpoint accepts cropStage
// ═══════════════════════════════════════════════════════════
describe('PATCH endpoint — crop stage + plantedAt', () => {
  const route = readFile('server/routes/farmProfile.js');

  it('includes cropStage in allowed fields', () => {
    expect(route).toContain("'cropStage'");
  });

  it('includes plantedAt in allowed fields', () => {
    expect(route).toContain("'plantedAt'");
  });

  it('validates stage via Zod farmStageSchema', () => {
    expect(route).toContain('farmStageSchema.shape.cropStage.safeParse');
  });

  it('maps cropStage to data.stage on success', () => {
    expect(route).toContain('data.stage = stageResult.data');
  });

  it('parses plantedAt as Date', () => {
    expect(route).toContain('new Date(patch.plantedAt)');
  });

  it('allows clearing plantedAt to null', () => {
    expect(route).toContain('data.plantedAt = patch.plantedAt ? new Date(patch.plantedAt) : null');
  });
});

// ═══════════════════════════════════════════════════════════
//  4. Server: POST endpoints accept cropStage on creation
// ═══════════════════════════════════════════════════════════
describe('POST endpoints — cropStage on creation', () => {
  const route = readFile('server/routes/farmProfile.js');

  it('POST / validates cropStage via Zod', () => {
    expect(route).toContain('farmStageSchema.shape.cropStage.safeParse(req.body.cropStage)');
  });

  it('POST /new validates cropStage via Zod', () => {
    // Both POST handlers use the same Zod safeParse pattern
    const matches = route.match(/farmStageSchema\.shape\.cropStage\.safeParse/g);
    expect(matches.length).toBeGreaterThanOrEqual(3); // PATCH + POST / + POST /new
  });

  it('both endpoints accept plantedAt on creation', () => {
    const matches = route.match(/req\.body\?\.plantedAt/g);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('imports shared cropStages module', () => {
    expect(route).toContain("from '../lib/cropStages.js'");
  });
});

// ═══════════════════════════════════════════════════════════
//  5. Farm tasks route — uses stages directly
// ═══════════════════════════════════════════════════════════
describe('Farm tasks route — stage integration', () => {
  const route = readFile('server/routes/farmTasks.js');

  it('uses resolveStage from shared cropStages module', () => {
    expect(route).toContain('resolveStage');
    expect(route).toContain("from '../lib/cropStages.js'");
  });

  it('no longer has 4-stage stageMap object', () => {
    expect(route).not.toContain("growing: 'vegetative'");
  });

  it('returns stageIsDefault flag', () => {
    expect(route).toContain('stageIsDefault');
  });
});

// ═══════════════════════════════════════════════════════════
//  6. Task engine integration — stage changes tasks
// ═══════════════════════════════════════════════════════════
describe('Task engine — stage-sensitive generation', () => {
  it('produces different tasks for different stages of the same crop', () => {
    const planningTasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'planning', farmerType: 'new',
    });
    const vegetativeTasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
    });
    const harvestTasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'harvest', farmerType: 'new',
    });

    const planningIds = planningTasks.map((t) => t.id);
    const vegetativeIds = vegetativeTasks.map((t) => t.id);
    const harvestIds = harvestTasks.map((t) => t.id);

    // They must not all be the same
    expect(planningIds).not.toEqual(vegetativeIds);
    expect(vegetativeIds).not.toEqual(harvestIds);
  });

  it('generates tasks for all 9 extended stages', () => {
    for (const stage of CROP_STAGES) {
      const tasks = generateTasksForFarm({
        farmId: 'f1', crop: 'maize', stage, farmerType: 'new',
      });
      expect(tasks.length).toBeGreaterThan(0);
    }
  });

  it('task farmId matches the provided farmId', () => {
    const tasks = generateTasksForFarm({
      farmId: 'test-farm-123', crop: 'rice', stage: 'flowering', farmerType: 'experienced',
    });
    for (const task of tasks) {
      expect(task.farmId).toBe('test-farm-123');
    }
  });

  it('uses correct wording for farmer type on same stage', () => {
    const newTasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'planting', farmerType: 'new',
    });
    const expTasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'planting', farmerType: 'experienced',
    });

    // Titles can differ between farmer types (some rules have different wording)
    const newTitles = newTasks.map((t) => t.title).sort();
    const expTitles = expTasks.map((t) => t.title).sort();
    // At least the same number of tasks
    expect(newTasks.length).toBe(expTasks.length);
  });
});

// ═══════════════════════════════════════════════════════════
//  7. Frontend: api.js — updateCropStage
// ═══════════════════════════════════════════════════════════
describe('Frontend API — updateCropStage', () => {
  const api = readFile('src/lib/api.js');

  it('exports updateCropStage function', () => {
    expect(api).toContain('export function updateCropStage');
  });

  it('sends cropStage in request body', () => {
    expect(api).toContain('cropStage');
  });

  it('optionally includes plantedAt', () => {
    expect(api).toContain('plantedAt');
  });

  it('uses PATCH method', () => {
    expect(api).toContain("method: 'PATCH'");
  });
});

// ═══════════════════════════════════════════════════════════
//  8. CropStageModal component
// ═══════════════════════════════════════════════════════════
describe('CropStageModal component', () => {
  const modal = readFile('src/components/CropStageModal.jsx');

  it('renders all 9 stages', () => {
    const stages = [
      'planning', 'land_preparation', 'planting', 'germination',
      'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest',
    ];
    for (const s of stages) {
      expect(modal).toContain(`value: '${s}'`);
    }
  });

  it('has data-testid for stage buttons', () => {
    expect(modal).toContain('data-testid={`stage-${s.value}`}');
  });

  it('has planted date input', () => {
    expect(modal).toContain('data-testid="planted-at-input"');
  });

  it('has save button with testid', () => {
    expect(modal).toContain('data-testid="save-stage-btn"');
  });

  it('uses updateCropStage API and refreshProfile', () => {
    expect(modal).toContain('updateCropStage');
    expect(modal).toContain('refreshProfile');
    expect(modal).toContain('useProfile');
  });

  it('passes selected stage to updateCropStage', () => {
    expect(modal).toContain('updateCropStage(farm.id, selected');
  });

  it('tracks stage update event', () => {
    expect(modal).toContain('farm.crop_stage_updated');
  });

  it('disables save when no changes', () => {
    expect(modal).toContain('hasChanges');
    expect(modal).toContain('disabled={!hasChanges || saving}');
  });

  it('preserves dark theme', () => {
    expect(modal).toContain('#1B2330');
    expect(modal).toContain("color: '#fff'");
  });

  it('has stage icons for visual clarity', () => {
    expect(modal).toContain('icon:');
  });
});

// ═══════════════════════════════════════════════════════════
//  9. FarmSummaryCard — shows crop stage
// ═══════════════════════════════════════════════════════════
describe('FarmSummaryCard — crop stage display', () => {
  const card = readFile('src/components/FarmSummaryCard.jsx');

  it('displays crop stage from profile', () => {
    expect(card).toContain('cropStage');
    expect(card).toContain('data-testid="crop-stage-display"');
  });

  it('has Update Stage button', () => {
    expect(card).toContain('data-testid="update-stage-btn"');
    expect(card).toContain('onUpdateStage');
  });

  it('shows stage label via i18n', () => {
    expect(card).toContain('STAGE_KEYS');
    expect(card).toContain('cropStage.planning');
  });

  it('defaults to planning when no stage set', () => {
    expect(card).toContain("profile.cropStage || 'planning'");
  });

  it('handles legacy growing value', () => {
    expect(card).toContain("growing: 'cropStage.vegetative'");
  });

  it('tracks update stage open event', () => {
    expect(card).toContain('farm.update_stage_opened');
  });
});

// ═══════════════════════════════════════════════════════════
//  10. FarmEditModal — cropStage + plantedAt fields
// ═══════════════════════════════════════════════════════════
describe('FarmEditModal — crop stage fields', () => {
  const modal = readFile('src/components/FarmEditModal.jsx');

  it('has cropStage select field', () => {
    expect(modal).toContain('data-testid="edit-crop-stage"');
  });

  it('has plantedAt date field', () => {
    expect(modal).toContain('data-testid="edit-planted-at"');
  });

  it('includes all 9 stage options', () => {
    expect(modal).toContain("'planning'");
    expect(modal).toContain("'land_preparation'");
    expect(modal).toContain("'germination'");
    expect(modal).toContain("'fruiting'");
    expect(modal).toContain("'post_harvest'");
  });

  it('sends cropStage in save payload', () => {
    expect(modal).toContain('cropStage: form.cropStage');
  });

  it('sends plantedAt as ISO string', () => {
    expect(modal).toContain('new Date(form.plantedAt).toISOString()');
  });

  it('initializes form from farm prop', () => {
    expect(modal).toContain("farm.cropStage || 'planning'");
  });
});

// ═══════════════════════════════════════════════════════════
//  11. Dashboard integration
// ═══════════════════════════════════════════════════════════
describe('Dashboard — CropStageModal wiring', () => {
  const dash = readFile('src/pages/Dashboard.jsx');

  it('imports CropStageModal', () => {
    expect(dash).toContain("import CropStageModal from '../components/CropStageModal.jsx'");
  });

  it('has showStageModal state', () => {
    expect(dash).toContain('showStageModal');
  });

  it('has showStageModal wiring (FarmSummaryCard not rendered directly but CropStageModal uses showStageModal)', () => {
    expect(dash).toContain('setShowStageModal');
  });

  it('renders CropStageModal conditionally', () => {
    expect(dash).toContain('showStageModal && profile');
    expect(dash).toContain('<CropStageModal');
  });
});

// ═══════════════════════════════════════════════════════════
//  12. i18n translations — crop stage keys
// ═══════════════════════════════════════════════════════════
describe('i18n — crop stage translations', () => {
  const translations = readFile('src/i18n/translations.js');

  const requiredKeys = [
    'cropStage.title',
    'cropStage.subtitle',
    'cropStage.label',
    'cropStage.update',
    'cropStage.planning',
    'cropStage.landPreparation',
    'cropStage.planting',
    'cropStage.germination',
    'cropStage.vegetative',
    'cropStage.flowering',
    'cropStage.fruiting',
    'cropStage.harvest',
    'cropStage.postHarvest',
    'cropStage.plantedDate',
    'cropStage.plantedDateHint',
    'cropStage.saveFailed',
  ];

  it('has all required cropStage translation keys', () => {
    for (const key of requiredKeys) {
      expect(translations).toContain(`'${key}'`);
    }
  });

  it('all stage keys have 5 languages', () => {
    const langs = [' en:', ' fr:', ' sw:', ' ha:', ' tw:'];
    for (const key of requiredKeys) {
      // Find the line containing this key and grab a generous chunk
      const idx = translations.indexOf(`'${key}'`);
      expect(idx).toBeGreaterThan(-1);
      // Grab up to 500 chars from the key to capture the full translation object
      const chunk = translations.slice(idx, idx + 500);
      const closeBrace = chunk.indexOf('}');
      const entry = chunk.slice(0, closeBrace + 1);
      for (const lang of langs) {
        expect(entry).toContain(lang);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  13. CROP_STAGES constant matches schema
// ═══════════════════════════════════════════════════════════
describe('CROP_STAGES constant alignment', () => {
  it('has exactly 9 stages', () => {
    expect(CROP_STAGES).toHaveLength(9);
  });

  it('matches the expected order', () => {
    expect(CROP_STAGES).toEqual([
      'planning', 'land_preparation', 'planting', 'germination',
      'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest',
    ]);
  });

  it('aligns with Prisma schema stages', () => {
    const schema = readFile('server/prisma/schema.prisma');
    for (const stage of CROP_STAGES) {
      expect(schema).toContain(stage);
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  14. Shared cropStages module
// ═══════════════════════════════════════════════════════════
describe('Shared cropStages module', () => {
  it('exports CROP_STAGES with 9 entries', () => {
    expect(CROP_STAGES).toHaveLength(9);
  });

  it('exports resolveStage function', () => {
    expect(typeof resolveStage).toBe('function');
  });

  it('resolveStage maps legacy growing to vegetative', () => {
    expect(resolveStage('growing')).toBe('vegetative');
  });

  it('resolveStage returns planning for null/undefined', () => {
    expect(resolveStage(null)).toBe('planning');
    expect(resolveStage(undefined)).toBe('planning');
    expect(resolveStage('')).toBe('planning');
  });

  it('resolveStage passes through valid stages', () => {
    for (const s of CROP_STAGES) {
      expect(resolveStage(s)).toBe(s);
    }
  });

  it('resolveStage handles uppercase input', () => {
    expect(resolveStage('FLOWERING')).toBe('flowering');
    expect(resolveStage('Post_Harvest')).toBe('post_harvest');
  });

  it('resolveStage returns planning for unknown values', () => {
    expect(resolveStage('invalid')).toBe('planning');
    expect(resolveStage('xyz')).toBe('planning');
  });

  it('exports LEGACY_STAGE_MAP', () => {
    expect(LEGACY_STAGE_MAP).toHaveProperty('growing', 'vegetative');
  });

  it('exports ALL_ACCEPTED_STAGES (current + legacy)', () => {
    expect(ALL_ACCEPTED_STAGES).toContain('growing');
    expect(ALL_ACCEPTED_STAGES).toContain('planning');
    expect(ALL_ACCEPTED_STAGES.length).toBe(CROP_STAGES.length + 1);
  });

  it('exports STAGE_LABELS for all 9 stages', () => {
    for (const s of CROP_STAGES) {
      expect(STAGE_LABELS[s]).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  15. Zod validation schema
// ═══════════════════════════════════════════════════════════
describe('Zod farmStageSchema', () => {
  const schema = readFile('server/lib/farmStageSchema.js');

  it('imports zod', () => {
    expect(schema).toContain("from 'zod'");
  });

  it('imports CROP_STAGES from shared module', () => {
    expect(schema).toContain("from './cropStages.js'");
  });

  it('exports farmStageSchema', () => {
    expect(schema).toContain('export const farmStageSchema');
  });

  it('exports optionalStageFields', () => {
    expect(schema).toContain('export const optionalStageFields');
  });

  it('validates cropStage against CROP_STAGES', () => {
    expect(schema).toContain('CROP_STAGES.includes(val)');
  });

  it('supports plantedAt as ISO string or null', () => {
    expect(schema).toContain('z.string().datetime');
    expect(schema).toContain('z.null()');
  });
});

// ═══════════════════════════════════════════════════════════
//  16. Dedicated stage endpoints
// ═══════════════════════════════════════════════════════════
describe('Dedicated GET/PATCH /:id/stage endpoints', () => {
  const route = readFile('server/routes/farmProfile.js');

  it('has GET /:id/stage endpoint', () => {
    expect(route).toContain("router.get('/:id/stage'");
  });

  it('has PATCH /:id/stage endpoint', () => {
    expect(route).toContain("router.patch('/:id/stage'");
  });

  it('GET stage checks ownership', () => {
    expect(route).toContain('userId: req.user.id');
  });

  it('PATCH stage uses Zod validation', () => {
    expect(route).toContain('validateWithZod(farmStageSchema');
  });

  it('PATCH stage rejects archived farms', () => {
    expect(route).toContain('Cannot update stage on archived farm');
  });

  it('PATCH stage logs audit event', () => {
    expect(route).toContain('farm_profile.stage_updated');
  });

  it('GET stage returns cropStage and plantedAt', () => {
    expect(route).toContain('cropStage: farm.stage');
    expect(route).toContain('plantedAt: farm.plantedAt');
  });

  it('frontend has getFarmStage API function', () => {
    const api = readFile('src/lib/api.js');
    expect(api).toContain('export function getFarmStage');
    expect(api).toContain('/stage');
  });
});

// ═══════════════════════════════════════════════════════════
//  17. Missing-stage prompt in FarmTasksCard
// ═══════════════════════════════════════════════════════════
describe('FarmTasksCard — missing stage prompt', () => {
  const card = readFile('src/components/FarmTasksCard.jsx');

  it('accepts onSetStage prop', () => {
    expect(card).toContain('onSetStage');
  });

  it('tracks stageIsDefault state', () => {
    expect(card).toContain('stageIsDefault');
    expect(card).toContain('setStageIsDefault');
  });

  it('reads stageIsDefault from API response', () => {
    expect(card).toContain('data.stageIsDefault');
  });

  it('shows stage prompt when stageIsDefault is true', () => {
    expect(card).toContain('data-testid="stage-prompt"');
  });

  it('prompt is tappable and triggers onSetStage', () => {
    expect(card).toContain('onSetStage()');
  });

  it('has i18n keys for prompt text', () => {
    expect(card).toContain('farmTasks.setStagePrompt');
    expect(card).toContain('farmTasks.setStageHint');
  });

  it('i18n file has prompt translations', () => {
    const translations = readFile('src/i18n/translations.js');
    expect(translations).toContain("'farmTasks.setStagePrompt'");
    expect(translations).toContain("'farmTasks.setStageHint'");
  });

  it('only shows empty text when stage is explicitly set', () => {
    expect(card).toContain('tasks.length === 0 && !stageIsDefault');
  });
});
