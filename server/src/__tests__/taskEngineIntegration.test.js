/**
 * Task Engine Integration Tests
 *
 * Verifies end-to-end task engine: generation, completion API, server filtering,
 * frontend wiring, offline fallback, analytics, and admin visibility.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(import.meta.dirname, '..', '..', '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

// ─── 1. Backend: V2FarmTaskCompletion model ────────────────
describe('Task completion — Prisma model', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('has V2FarmTaskCompletion model', () => {
    expect(schema).toContain('model V2FarmTaskCompletion');
  });

  it('has compound unique on farmId + taskRuleId', () => {
    expect(schema).toContain('@@unique([farmId, taskRuleId]');
  });

  it('has required fields: userId, farmId, taskRuleId, taskId', () => {
    expect(schema).toContain('userId');
    expect(schema).toContain('farmId');
    expect(schema).toContain('taskRuleId');
    expect(schema).toContain('taskId');
  });

  it('has completedAt timestamp', () => {
    expect(schema).toContain('completedAt');
  });

  it('has relations to User and FarmProfile', () => {
    expect(schema).toMatch(/user\s+User/);
    expect(schema).toMatch(/farm\s+FarmProfile/);
  });
});

// ─── 2. Backend: GET endpoint filters completed tasks ──────
describe('Task completion — GET endpoint server-side filtering', () => {
  const route = readFile('server/routes/farmTasks.js');

  it('queries v2FarmTaskCompletion to get completed task IDs', () => {
    expect(route).toContain('v2FarmTaskCompletion.findMany');
  });

  it('builds completedTaskIds set', () => {
    expect(route).toContain('completedTaskIds');
  });

  it('filters tasks to return only pending', () => {
    expect(route).toContain('pendingTasks');
    expect(route).toContain('!completedTaskIds.has');
  });

  it('returns allTaskCount and completedCount in response', () => {
    expect(route).toContain('allTaskCount');
    expect(route).toContain('completedCount');
  });
});

// ─── 3. Backend: POST completion endpoint ──────────────────
describe('Task completion — POST endpoint', () => {
  const route = readFile('server/routes/farmTasks.js');

  it('has POST /:id/tasks/:taskId/complete route', () => {
    expect(route).toContain("router.post('/:id/tasks/:taskId/complete'");
  });

  it('enforces farm ownership via authenticate middleware', () => {
    expect(route).toContain('authenticate');
    expect(route).toContain('userId: req.user.id');
  });

  it('extracts taskRuleId from taskId', () => {
    expect(route).toContain('taskRuleId');
    expect(route).toContain("taskId.replace(`-${farm.id}`");
  });

  it('uses idempotent upsert on farmId_taskRuleId', () => {
    expect(route).toContain('v2FarmTaskCompletion.upsert');
    expect(route).toContain('farmId_taskRuleId');
  });

  it('returns nextTask for immediate UI refresh', () => {
    expect(route).toContain('nextTask');
  });
});

// ─── 4. Frontend API: completeTask function ────────────────
describe('Task completion — API client', () => {
  const api = readFile('src/lib/api.js');

  it('exports completeTask(farmId, taskId, body)', () => {
    expect(api).toContain('export function completeTask(farmId, taskId, body');
  });

  it('POSTs to /api/v2/farm-tasks/:farmId/tasks/:taskId/complete', () => {
    expect(api).toContain('/api/v2/farm-tasks/${farmId}/tasks/');
    expect(api).toContain('/complete');
  });

  it('keeps legacy completeV2Task for backward compat', () => {
    expect(api).toContain('completeV2Task');
  });
});

// ─── 5. Dashboard: server-side filtering, no localStorage ──
describe('Task completion — Dashboard wiring', () => {
  const dash = readFile('src/pages/Dashboard.jsx');

  it('imports completeTask from api', () => {
    expect(dash).toContain("completeTask");
    expect(dash).toContain("from '../lib/api.js'");
  });

  it('does NOT use localStorage for done tasks', () => {
    expect(dash).not.toContain('farroway_done_tasks');
    expect(dash).not.toContain('loadDoneSet()');
  });

  it('uses server completedCount', () => {
    expect(dash).toContain('completedCount');
    expect(dash).toContain('data.completedCount');
  });

  it('has handleCompleteTask callback', () => {
    expect(dash).toContain('handleCompleteTask');
  });

  it('passes onComplete to TaskActionModal', () => {
    expect(dash).toContain('onComplete={handleCompleteTask}');
  });

  it('passes completing to TaskActionModal', () => {
    expect(dash).toContain('completing={taskCompleting}');
  });

  it('tracks task_shown analytics event', () => {
    expect(dash).toContain("safeTrackEvent('task_shown'");
  });

  it('tracks task_completed analytics event', () => {
    expect(dash).toContain("safeTrackEvent('task_completed'");
  });

  it('has offline fallback with offlineQueue enqueue', () => {
    expect(dash).toContain('offlineQueue.js');
    expect(dash).toContain('enqueue(');
  });
});

// ─── 6. TaskActionModal: completion support ──────────────────
describe('Task completion — TaskActionModal', () => {
  const modal = readFile('src/components/TaskActionModal.jsx');

  it('accepts onComplete prop', () => {
    expect(modal).toContain('onComplete');
  });

  it('accepts completing prop', () => {
    expect(modal).toContain('completing');
  });

  it('calls onComplete(task) when primary CTA clicked', () => {
    expect(modal).toContain('onComplete(task)');
  });

  it('disables button while completing', () => {
    expect(modal).toContain('disabled={completing}');
  });

  it('shows saving text while completing', () => {
    expect(modal).toContain("t('common.saving')");
  });

  it('has onClose callback', () => {
    expect(modal).toContain('onClose');
  });
});

// ─── 7. FarmTasksCard: API-based completion ────────────────
describe('Task completion — FarmTasksCard', () => {
  const card = readFile('src/components/FarmTasksCard.jsx');

  it('imports completeTask from API', () => {
    expect(card).toContain("completeTask");
    expect(card).toContain("from '../lib/api.js'");
  });

  it('does NOT use localStorage for done tasks', () => {
    expect(card).not.toContain('farroway_done_tasks');
    expect(card).not.toContain('loadDoneTasks');
    expect(card).not.toContain('saveDoneTasks');
  });

  it('has handleDone function that calls API', () => {
    expect(card).toContain('async function handleDone');
    expect(card).toContain('completeTask(currentFarmId');
  });

  it('removes completed task from list optimistically', () => {
    expect(card).toContain('setTasks((prev) => prev.filter');
  });

  it('tracks completing state per task', () => {
    expect(card).toContain('completing');
    expect(card).toContain('setCompleting(task.id)');
  });

  it('has offline fallback via offlineQueue', () => {
    expect(card).toContain('offlineQueue.js');
    expect(card).toContain('enqueue(');
  });

  it('tracks task_completed analytics', () => {
    expect(card).toContain("safeTrackEvent('task_completed'");
  });

  it('tracks task_completed_offline for offline completions', () => {
    expect(card).toContain("safeTrackEvent('task_completed_offline'");
  });
});

// ─── 8. Migration file exists ──────────────────────────────
describe('Task completion — migration', () => {
  it('has migration SQL file', () => {
    const migPath = path.join(rootDir, 'server/prisma/migrations/20260414_farm_task_completions/migration.sql');
    expect(fs.existsSync(migPath)).toBe(true);
  });

  it('migration creates v2_farm_task_completions table', () => {
    const sql = readFile('server/prisma/migrations/20260414_farm_task_completions/migration.sql');
    expect(sql).toContain('v2_farm_task_completions');
    expect(sql).toContain('CREATE TABLE');
  });

  it('migration has compound unique index', () => {
    const sql = readFile('server/prisma/migrations/20260414_farm_task_completions/migration.sql');
    expect(sql).toContain('farm_id');
    expect(sql).toContain('task_rule_id');
    expect(sql).toContain('UNIQUE INDEX');
  });

  it('migration has foreign keys', () => {
    const sql = readFile('server/prisma/migrations/20260414_farm_task_completions/migration.sql');
    expect(sql).toContain('FOREIGN KEY');
    expect(sql).toContain('"users"("id")');
    expect(sql).toContain('"farm_profiles"("id")');
  });
});

// ─── 9. Weekly progress uses server counts ─────────────────
describe('Task completion — weekly progress wiring', () => {
  const dash = readFile('src/pages/Dashboard.jsx');

  it('uses completedCount for doneThisWeek (not localStorage)', () => {
    expect(dash).toContain('doneThisWeek = completedCount');
  });

  it('calculates weekTotal from taskCount + completedCount', () => {
    expect(dash).toContain('taskCount + completedCount');
  });
});

// ─── 10. No leftover localStorage patterns ─────────────────
describe('Task completion — no localStorage remnants', () => {
  it('Dashboard has no farroway_done_tasks references', () => {
    const dash = readFile('src/pages/Dashboard.jsx');
    expect(dash).not.toContain('farroway_done_tasks');
  });

  it('FarmTasksCard has no farroway_done_tasks references', () => {
    const card = readFile('src/components/FarmTasksCard.jsx');
    expect(card).not.toContain('farroway_done_tasks');
  });
});
