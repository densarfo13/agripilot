/**
 * taskPlanEngine.test.js — pure-function tests for the crop-cycle
 * task template generator. No DB, no network.
 */
import { describe, it, expect } from 'vitest';
import {
  templateFor,
  generateWeeklyTasks,
  summarizeTasks,
} from '../services/cropCycles/taskPlanEngine.js';

describe('templateFor', () => {
  it('returns the specialized template for tomato', () => {
    const t = templateFor('tomato');
    expect(t.length).toBeGreaterThan(5);
    expect(t.some((s) => /deep|transplant/i.test(s.title))).toBe(true);
  });
  it('falls back to the default template for unknown crops', () => {
    const t = templateFor('swiss_chard');
    expect(t.length).toBeGreaterThan(0);
    expect(t[0].title).toMatch(/prep/i);
  });
});

describe('generateWeeklyTasks', () => {
  it('assigns concrete dueDate values relative to plantedDate', () => {
    const planted = new Date('2026-04-01T00:00:00Z');
    const tasks = generateWeeklyTasks({ cropKey: 'tomato', plantedDate: planted });
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      expect(t.dueDate).toBeInstanceOf(Date);
      expect(t.dueDate.getTime()).toBeGreaterThanOrEqual(planted.getTime());
      expect(typeof t.title).toBe('string');
      expect(['low', 'medium', 'high']).toContain(t.priority);
    }
  });
  it('clamps negative offsets to the planted date', () => {
    const planted = new Date('2026-04-01T00:00:00Z');
    const tasks = generateWeeklyTasks({ cropKey: 'cotton', plantedDate: planted });
    const plantedDay = planted.toISOString().slice(0, 10);
    for (const t of tasks) {
      expect(t.dueDate.toISOString().slice(0, 10)).not.toBe('2026-03-27');
      expect(t.dueDate.getTime()).toBeGreaterThanOrEqual(planted.getTime());
    }
    expect(tasks[0].dueDate.toISOString().slice(0, 10)).toBe(plantedDay);
  });
  it('returns [] for invalid plantedDate', () => {
    expect(generateWeeklyTasks({ cropKey: 'tomato', plantedDate: 'banana' })).toEqual([]);
  });
});

describe('summarizeTasks', () => {
  it('counts completed / overdue / dueSoon correctly', () => {
    const now = new Date('2026-04-10T00:00:00Z');
    const tasks = [
      { status: 'completed', dueDate: new Date('2026-04-01') },
      { status: 'pending',   dueDate: new Date('2026-04-05') }, // overdue
      { status: 'pending',   dueDate: new Date('2026-04-11') }, // dueSoon
      { status: 'pending',   dueDate: new Date('2026-04-25') },
      { status: 'skipped',   dueDate: new Date('2026-04-05') }, // neither
    ];
    const s = summarizeTasks(tasks, now);
    expect(s).toEqual({
      total: 5, completed: 1, overdue: 1, dueSoon: 1, progressPercent: 20,
    });
  });
  it('progressPercent is 0 when there are no tasks', () => {
    expect(summarizeTasks([])).toMatchObject({ progressPercent: 0 });
  });
});
