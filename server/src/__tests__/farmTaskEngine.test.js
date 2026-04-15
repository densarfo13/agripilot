/**
 * Farm Task Engine — unit tests + source-code enforcement.
 *
 * Covers:
 * 1. Task engine generates correct tasks for each crop × stage
 * 2. Farmer type wording changes (new vs experienced)
 * 3. All 5 crops produce tasks across all stages
 * 4. Task structure has required fields
 * 5. Farm-scoped: tasks carry farmId
 * 6. Server route exists and enforces ownership
 * 7. Frontend API function exists
 * 8. FarmTasksCard component wired correctly
 * 9. Dashboard integration
 * 10. i18n keys present
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  1. TASK ENGINE — core generation
// ═══════════════════════════════════════════════════════════

describe('Farm Task Engine — generateTasksForFarm', () => {
  it('generates tasks for maize + planting', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'farm-1',
      crop: 'maize',
      stage: 'planting',
      farmerType: 'new',
    });
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks.every((t) => t.farmId === 'farm-1')).toBe(true);
    expect(tasks.every((t) => t.crop === 'maize')).toBe(true);
    expect(tasks.every((t) => t.stage === 'planting')).toBe(true);
  });

  it('generates tasks for rice + vegetative', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'farm-2',
      crop: 'rice',
      stage: 'vegetative',
      farmerType: 'experienced',
    });
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks.some((t) => t.title.toLowerCase().includes('nitrogen') || t.title.toLowerCase().includes('weed'))).toBe(true);
  });

  it('generates tasks for cassava + land_preparation', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'farm-3',
      crop: 'cassava',
      stage: 'land_preparation',
      farmerType: 'new',
    });
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks.some((t) => t.title.toLowerCase().includes('mound') || t.title.toLowerCase().includes('clear'))).toBe(true);
  });

  it('generates tasks for tomato + flowering', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'farm-4',
      crop: 'tomato',
      stage: 'flowering',
      farmerType: 'experienced',
    });
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks.some((t) => t.title.toLowerCase().includes('pest') || t.title.toLowerCase().includes('water') || t.title.toLowerCase().includes('moisture'))).toBe(true);
  });

  it('generates tasks for cocoa + post_harvest', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'farm-5',
      crop: 'cocoa',
      stage: 'post_harvest',
      farmerType: 'new',
    });
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks.some((t) => t.title.toLowerCase().includes('ferment'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  2. FARMER TYPE — wording changes
// ═══════════════════════════════════════════════════════════

describe('Farm Task Engine — farmer type wording', () => {
  it('new farmer gets more guided wording', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const newTasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'planting', farmerType: 'new',
    });
    const expTasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'planting', farmerType: 'experienced',
    });
    // Same number of tasks
    expect(newTasks.length).toBe(expTasks.length);
    // But different titles
    const newTitles = newTasks.map((t) => t.title);
    const expTitles = expTasks.map((t) => t.title);
    expect(newTitles).not.toEqual(expTitles);
  });

  it('defaults to new farmer when farmerType is null', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'planting', farmerType: null,
    });
    const newTasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'planting', farmerType: 'new',
    });
    expect(tasks.map((t) => t.title)).toEqual(newTasks.map((t) => t.title));
  });
});

// ═══════════════════════════════════════════════════════════
//  3. ALL CROPS × ALL STAGES — coverage
// ═══════════════════════════════════════════════════════════

describe('Farm Task Engine — all crop/stage combinations produce tasks', () => {
  const crops = ['maize', 'rice', 'cassava', 'tomato', 'cocoa'];
  const stages = [
    'planning', 'land_preparation', 'planting', 'germination',
    'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest',
  ];

  for (const crop of crops) {
    for (const stage of stages) {
      it(`${crop} × ${stage} produces at least 1 task`, async () => {
        const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
        const tasks = generateTasksForFarm({
          farmId: 'test', crop, stage, farmerType: 'new',
        });
        expect(tasks.length).toBeGreaterThanOrEqual(1);
      });
    }
  }
});

// ═══════════════════════════════════════════════════════════
//  4. TASK STRUCTURE — required fields
// ═══════════════════════════════════════════════════════════

describe('Farm Task Engine — task structure', () => {
  it('every task has all required fields', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'struct-test', crop: 'maize', stage: 'planting', farmerType: 'new',
    });
    const required = ['id', 'farmId', 'title', 'description', 'priority', 'reason', 'dueLabel', 'crop', 'stage', 'status', 'createdAt'];
    for (const task of tasks) {
      for (const field of required) {
        expect(task).toHaveProperty(field);
        expect(task[field]).toBeTruthy();
      }
    }
  });

  it('task id includes farmId for uniqueness', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'unique-farm', crop: 'maize', stage: 'planting', farmerType: 'new',
    });
    expect(tasks.every((t) => t.id.includes('unique-farm'))).toBe(true);
  });

  it('priority is one of high/medium/low', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'f', crop: 'maize', stage: 'vegetative', farmerType: 'new',
    });
    expect(tasks.every((t) => ['high', 'medium', 'low'].includes(t.priority))).toBe(true);
  });

  it('status defaults to pending', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'f', crop: 'maize', stage: 'planting', farmerType: 'new',
    });
    expect(tasks.every((t) => t.status === 'pending')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  5. EXPORTS — module shape
// ═══════════════════════════════════════════════════════════

describe('Farm Task Engine — exports', () => {
  it('exports generateTasksForFarm', async () => {
    const mod = await import('../../../server/lib/farmTaskEngine.js');
    expect(typeof mod.generateTasksForFarm).toBe('function');
  });

  it('exports getAllRules', async () => {
    const mod = await import('../../../server/lib/farmTaskEngine.js');
    expect(typeof mod.getAllRules).toBe('function');
    const rules = mod.getAllRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(20);
  });

  it('exports CROP_STAGES', async () => {
    const mod = await import('../../../server/lib/farmTaskEngine.js');
    expect(Array.isArray(mod.CROP_STAGES)).toBe(true);
    expect(mod.CROP_STAGES).toContain('planning');
    expect(mod.CROP_STAGES).toContain('post_harvest');
    expect(mod.CROP_STAGES.length).toBe(9);
  });

  it('exports SUPPORTED_CROPS', async () => {
    const mod = await import('../../../server/lib/farmTaskEngine.js');
    expect(mod.SUPPORTED_CROPS).toEqual(['maize', 'rice', 'cassava', 'tomato', 'cocoa']);
  });
});

// ═══════════════════════════════════════════════════════════
//  6. SERVER ROUTE — source enforcement
// ═══════════════════════════════════════════════════════════

describe('Server — farm tasks route', () => {
  const route = read('server/routes/farmTasks.js');

  it('exports Express router', () => {
    expect(route).toContain('export default router');
  });

  it('has GET /:id/tasks route', () => {
    expect(route).toContain("router.get('/:id/tasks'");
  });

  it('uses authenticate middleware', () => {
    expect(route).toContain('authenticate');
  });

  it('verifies farm ownership', () => {
    expect(route).toContain('userId: req.user.id');
  });

  it('returns 404 if farm not found', () => {
    expect(route).toContain('Farm not found');
  });

  it('handles archived farms', () => {
    expect(route).toContain('archived');
    expect(route).toContain('Archived farms have no active tasks');
  });

  it('imports generateTasksForFarm', () => {
    expect(route).toContain("import { generateTasksForFarm");
  });

  it('calls generateTasksForFarm with context', () => {
    expect(route).toContain('generateTasksForFarm({');
    expect(route).toContain('farmId:');
    expect(route).toContain('crop:');
    expect(route).toContain('stage');
    expect(route).toContain('farmerType:');
  });

  it('supports ?stage= query param override', () => {
    expect(route).toContain('req.query.stage');
  });

  it('uses resolveStage from shared cropStages module', () => {
    expect(route).toContain('resolveStage');
    expect(route).toContain("from '../lib/cropStages.js'");
  });

  it('is registered in app.js', () => {
    const app = read('server/src/app.js');
    expect(app).toContain('v2FarmTaskRoutes');
    expect(app).toContain('/api/v2/farm-tasks');
  });
});

// ═══════════════════════════════════════════════════════════
//  7. FRONTEND API — getFarmTasks
// ═══════════════════════════════════════════════════════════

describe('Frontend API — getFarmTasks', () => {
  const src = read('src/lib/api.js');

  it('exports getFarmTasks function', () => {
    expect(src).toContain('export function getFarmTasks(farmId');
  });

  it('calls /api/v2/farm-tasks/:farmId/tasks', () => {
    expect(src).toContain('/api/v2/farm-tasks/');
    expect(src).toContain('/tasks');
  });

  it('supports optional stage parameter', () => {
    const fn = src.substring(src.indexOf('export function getFarmTasks'), src.indexOf('export function getFarmTasks') + 200);
    expect(fn).toContain('stage');
  });
});

// ═══════════════════════════════════════════════════════════
//  8. FARM TASKS CARD — component
// ═══════════════════════════════════════════════════════════

describe('FarmTasksCard — component', () => {
  const src = read('src/components/FarmTasksCard.jsx');

  it('exports default function', () => {
    expect(src).toContain('export default function FarmTasksCard');
  });

  it('uses currentFarmId from context', () => {
    expect(src).toContain('currentFarmId');
  });

  it('calls getFarmTasks API', () => {
    expect(src).toContain('getFarmTasks(farmId)');
  });

  it('clears tasks on farm switch', () => {
    expect(src).toContain('setTasks([])');
    expect(src).toContain('currentFarmId !== prevFarmIdRef.current');
  });

  it('has loading state', () => {
    expect(src).toContain("t('farmTasks.loading')");
    expect(src).toContain('setLoading');
  });

  it('has empty state', () => {
    expect(src).toContain("t('farmTasks.noTasks')");
  });

  it('has error state', () => {
    expect(src).toContain('setError');
    expect(src).toContain('errorText');
  });

  it('shows priority with colored label and done button', () => {
    expect(src).toContain('PRIORITY_COLORS');
    expect(src).toContain('doneBtn');
  });

  it('shows dueLabel', () => {
    expect(src).toContain('task.dueLabel');
  });

  it('shows reason with lightbulb icon', () => {
    expect(src).toContain('task.reason');
    expect(src).toContain('reasonIcon');
  });

  it('shows title and description', () => {
    expect(src).toContain('task.title');
    expect(src).toContain('task.description');
  });

  it('sorts high priority first', () => {
    // Server returns only pending tasks; component sorts them directly
    expect(src).toContain("tasks.filter((t) => t.priority === 'high')");
    expect(src).toContain("tasks.filter((t) => t.priority !== 'high')");
    expect(src).toContain('[...highTasks, ...otherTasks]');
  });

  it('has data-testid', () => {
    expect(src).toContain('data-testid="farm-tasks-card"');
  });

  it('returns null when no profile', () => {
    expect(src).toContain('if (!profile) return null');
  });
});

// ═══════════════════════════════════════════════════════════
//  9. FarmTasksCard — standalone component + AllTasksPage
// ═══════════════════════════════════════════════════════════

describe('FarmTasksCard — standalone and AllTasksPage integration', () => {
  it('FarmTasksCard component file exists', () => {
    const exists = require('fs').existsSync(join(root, 'src/components/FarmTasksCard.jsx'));
    expect(exists).toBe(true);
  });

  it('AllTasksPage exists as standalone page', () => {
    const exists = require('fs').existsSync(join(root, 'src/pages/AllTasksPage.jsx'));
    expect(exists).toBe(true);
  });

  it('AllTasksPage is a default export', () => {
    const src = read('src/pages/AllTasksPage.jsx');
    expect(src).toContain('export default function AllTasksPage');
  });
});

// ═══════════════════════════════════════════════════════════
//  10. i18n — keys
// ═══════════════════════════════════════════════════════════

describe('i18n — farm task keys', () => {
  const translations = read('src/i18n/translations.js');

  const requiredKeys = [
    'farmTasks.title',
    'farmTasks.loading',
    'farmTasks.noTasks',
    'farmTasks.tasks',
    'farmTasks.priorityHigh',
    'farmTasks.priorityMedium',
    'farmTasks.priorityLow',
  ];

  for (const key of requiredKeys) {
    it(`has key: ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('all keys have 5 languages', () => {
    for (const key of requiredKeys) {
      const start = translations.indexOf(`'${key}'`);
      const block = translations.substring(start, start + 400);
      expect(block).toContain('en:');
      expect(block).toContain('fr:');
      expect(block).toContain('sw:');
      expect(block).toContain('ha:');
      expect(block).toContain('tw:');
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  11. TASK RULES — quality checks
// ═══════════════════════════════════════════════════════════

describe('Task Rules — quality', () => {
  it('every rule has both new and experienced wording', async () => {
    const { getAllRules } = await import('../../../server/lib/farmTaskEngine.js');
    const rules = getAllRules();
    for (const rule of rules) {
      expect(rule.title.new).toBeTruthy();
      expect(rule.title.experienced).toBeTruthy();
      expect(rule.description.new).toBeTruthy();
      expect(rule.description.experienced).toBeTruthy();
      expect(rule.title.new).not.toBe(rule.title.experienced);
    }
  });

  it('every rule has a reason', async () => {
    const { getAllRules } = await import('../../../server/lib/farmTaskEngine.js');
    const rules = getAllRules();
    for (const rule of rules) {
      expect(rule.reason).toBeTruthy();
      expect(rule.reason.length).toBeGreaterThan(10);
    }
  });

  it('every rule has a valid priority', async () => {
    const { getAllRules } = await import('../../../server/lib/farmTaskEngine.js');
    const rules = getAllRules();
    for (const rule of rules) {
      expect(['high', 'medium', 'low']).toContain(rule.priority);
    }
  });

  it('every rule has a dueLabel', async () => {
    const { getAllRules } = await import('../../../server/lib/farmTaskEngine.js');
    const rules = getAllRules();
    for (const rule of rules) {
      expect(rule.dueLabel).toBeTruthy();
    }
  });

  it('crop-specific rules reference only supported crops', async () => {
    const { getAllRules, SUPPORTED_CROPS } = await import('../../../server/lib/farmTaskEngine.js');
    const rules = getAllRules();
    for (const rule of rules) {
      for (const crop of rule.crops) {
        if (crop !== '*') {
          expect(SUPPORTED_CROPS).toContain(crop);
        }
      }
    }
  });

  it('rules cover all 9 stages', async () => {
    const { getAllRules, CROP_STAGES } = await import('../../../server/lib/farmTaskEngine.js');
    const rules = getAllRules();
    const coveredStages = new Set(rules.flatMap((r) => r.stages));
    for (const stage of CROP_STAGES) {
      expect(coveredStages.has(stage)).toBe(true);
    }
  });

  it('region-specific rules have valid region strings', async () => {
    const { getAllRules } = await import('../../../server/lib/farmTaskEngine.js');
    const rules = getAllRules();
    const validRegions = ['global', 'west_africa', 'east_africa', 'tropical', 'arid'];
    for (const rule of rules) {
      if (rule.region) {
        expect(validRegions).toContain(rule.region);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  REGION FILTERING
// ═══════════════════════════════════════════════════════════

describe('Farm Task Engine — region filtering', () => {
  it('corn + planning in Ghana includes West Africa rules', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'farm-r1',
      crop: 'maize',
      stage: 'land_preparation',
      farmerType: 'new',
      country: 'Ghana',
    });
    expect(tasks.some((t) => t.id.includes('region-wa'))).toBe(true);
  });

  it('corn + planning with no country omits region-specific rules', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'farm-r2',
      crop: 'maize',
      stage: 'land_preparation',
      farmerType: 'new',
    });
    expect(tasks.some((t) => t.id.includes('region-wa'))).toBe(false);
    expect(tasks.some((t) => t.id.includes('region-ea'))).toBe(false);
  });

  it('maize + planning in Kenya includes East Africa rules', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'farm-r3',
      crop: 'maize',
      stage: 'planning',
      farmerType: 'new',
      country: 'Kenya',
    });
    expect(tasks.some((t) => t.id.includes('region-ea'))).toBe(true);
  });

  it('Kenya farm does NOT get West Africa rules', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'farm-r4',
      crop: 'maize',
      stage: 'land_preparation',
      farmerType: 'new',
      country: 'Kenya',
    });
    expect(tasks.some((t) => t.id.includes('region-wa'))).toBe(false);
  });

  it('stage change updates tasks correctly', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const planningTasks = generateTasksForFarm({
      farmId: 'farm-r5', crop: 'maize', stage: 'planning', farmerType: 'new',
    });
    const harvestTasks = generateTasksForFarm({
      farmId: 'farm-r5', crop: 'maize', stage: 'harvest', farmerType: 'new',
    });
    const planIds = planningTasks.map((t) => t.id);
    const harvestIds = harvestTasks.map((t) => t.id);
    // Different stages produce different task sets
    expect(planIds).not.toEqual(harvestIds);
  });

  it('unknown crop still gets generic (*) tasks', async () => {
    const { generateTasksForFarm } = await import('../../../server/lib/farmTaskEngine.js');
    const tasks = generateTasksForFarm({
      farmId: 'farm-r6', crop: 'papaya', stage: 'planning', farmerType: 'new',
    });
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    // Should get wildcard rules
    expect(tasks.every((t) => t.crop === 'papaya')).toBe(true);
  });

  it('resolveRegion maps countries correctly', async () => {
    const { resolveRegion } = await import('../../../server/lib/farmTaskEngine.js');
    expect(resolveRegion('Ghana')).toBe('west_africa');
    expect(resolveRegion('Nigeria')).toBe('west_africa');
    expect(resolveRegion('Kenya')).toBe('east_africa');
    expect(resolveRegion('Tanzania')).toBe('east_africa');
    expect(resolveRegion('France')).toBe('global');
    expect(resolveRegion('')).toBe('global');
    expect(resolveRegion(undefined)).toBe('global');
  });
});

// ═══════════════════════════════════════════════════════════
//  MARK AS DONE — FarmTasksCard
// ═══════════════════════════════════════════════════════════

describe('FarmTasksCard — mark as done UI', () => {
  const cardSrc = read('src/components/FarmTasksCard.jsx');

  it('uses server-side completion (no localStorage persistence)', () => {
    expect(cardSrc).not.toContain('farroway_done_tasks');
    expect(cardSrc).not.toContain('localStorage.getItem');
    expect(cardSrc).not.toContain('localStorage.setItem');
    expect(cardSrc).toContain('completeTask');
  });

  it('has handleDone function', () => {
    expect(cardSrc).toContain('async function handleDone(task)');
  });

  it('renders done button with data-testid', () => {
    expect(cardSrc).toContain('done-btn-');
    expect(cardSrc).toContain('Mark as done');
  });

  it('tracks completed tasks via completedIds Set', () => {
    // Server returns only pending; completed tracked by ID set for count display
    expect(cardSrc).toContain('completedIds');
    expect(cardSrc).toContain('new Set');
    expect(cardSrc).toContain('setCompletedIds');
  });

  it('shows completed section with count', () => {
    expect(cardSrc).toContain('farmTasks.taskDone');
    expect(cardSrc).toContain('farmTasks.tasksDone');
  });

  it('completed tasks show with strikethrough', () => {
    expect(cardSrc).toContain('line-through');
  });

  it('high priority tasks have visual highlight', () => {
    expect(cardSrc).toContain('taskItemHigh');
    expect(cardSrc).toContain('borderLeft');
  });

  it('completed section shows count only (no undo per-task)', () => {
    // Completed section shows a count, not individual items with undo
    expect(cardSrc).toContain('doneCount');
    expect(cardSrc).toContain('completedIds.size');
    expect(cardSrc).not.toContain("'Undo'");
  });
});
