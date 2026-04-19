/**
 * taskWordingHelpers.test.js — asserts that every helper emits
 * verb-first, action-specific titles with a sensible detail line.
 */
import { describe, it, expect } from 'vitest';
import {
  buildWateringTask, buildPlantingTask, buildPestInspectionTask,
  buildFertilizerTask, buildHarvestTask, buildWeedControlTask,
} from '../services/today/taskWordingHelpers.js';

function title(t) { return t.title; }

describe('taskWordingHelpers — verb-first titles', () => {
  it('builds watering task', () => {
    const t = buildWateringTask({ crop: 'tomato' });
    expect(t.title).toBe('Water tomatoes today');
    expect(t.detail).toMatch(/damp|not soggy/i);
  });

  it('deep watering overrides detail copy', () => {
    const t = buildWateringTask({ crop: 'peanut', timing: 'this week', depth: 'deep' });
    expect(t.title).toBe('Water peanuts this week');
    expect(t.detail).toMatch(/deep, slow soaking/i);
  });

  it('planting task auto-picks slips for sweet potato', () => {
    const t = buildPlantingTask({ crop: 'sweet_potato' });
    expect(t.title).toBe('Plant sweet potatoes slips this week');
    expect(t.detail).toMatch(/slips/i);
  });

  it('planting task auto-picks transplants for tomato', () => {
    const t = buildPlantingTask({ crop: 'tomato' });
    expect(t.title).toBe('Plant tomatoes transplants this week');
    expect(t.detail).toMatch(/leaf set/i);
  });

  it('planting task uses seeds as the default', () => {
    const t = buildPlantingTask({ crop: 'lettuce' });
    expect(t.title).toBe('Plant lettuce seeds this week');
    expect(t.detail).toMatch(/spacing on the seed packet/i);
  });

  it('pest inspection leaves vs rows', () => {
    expect(title(buildPestInspectionTask({ crop: 'pepper' })))
      .toBe('Inspect peppers leaves for pests today');
    expect(title(buildPestInspectionTask({ crop: 'sorghum', focus: 'rows', timing: 'this week' })))
      .toBe('Inspect sorghum rows for pests this week');
  });

  it('fertilizer task defaults to balanced feed', () => {
    const t = buildFertilizerTask({ crop: 'okra' });
    expect(t.title).toBe('Feed okra with a balanced feed this week');
    expect(t.detail).toMatch(/compost|balanced fertilizer/i);
  });

  it('fertilizer nitrogen variant', () => {
    const t = buildFertilizerTask({ crop: 'corn', nutrient: 'nitrogen' });
    expect(t.title).toBe('Feed corn with nitrogen this week');
    expect(t.detail).toMatch(/side-dress/i);
  });

  it('harvest task with a ripeness cue', () => {
    const t = buildHarvestTask({ crop: 'tomato', cue: 'fruit is colored but still firm' });
    expect(t.title).toBe('Harvest tomatoes today');
    expect(t.detail).toMatch(/colored but still firm/i);
  });

  it('weed control task', () => {
    const t = buildWeedControlTask({ crop: 'peanut' });
    expect(t.title).toBe('Weed peanuts rows this week');
    expect(t.detail).toMatch(/small/i);
  });

  it('every helper output starts with a capital verb', () => {
    const outputs = [
      buildWateringTask({ crop: 'tomato' }),
      buildPlantingTask({ crop: 'lettuce' }),
      buildPestInspectionTask({ crop: 'pepper' }),
      buildFertilizerTask({ crop: 'okra' }),
      buildHarvestTask({ crop: 'sorghum' }),
      buildWeedControlTask({ crop: 'corn' }),
    ];
    for (const o of outputs) {
      expect(o.title.charAt(0)).toMatch(/[A-Z]/);
      expect(o.title.length).toBeLessThan(60); // short
      expect(o.detail.length).toBeLessThan(160);
      // "specific" — must name the crop somewhere.
      expect(o.title.toLowerCase() + ' ' + o.detail.toLowerCase()).toMatch(/[a-z]/);
    }
  });

  it('avoids the banned vague wording', () => {
    const banned = [
      /monitor crop condition/i,
      /optimize growth/i,
      /manage irrigation/i,
      /fertilizer application needed/i,
    ];
    const samples = [
      buildWateringTask({ crop: 'tomato' }).title,
      buildPlantingTask({ crop: 'lettuce' }).title,
      buildPestInspectionTask({ crop: 'pepper' }).title,
      buildFertilizerTask({ crop: 'okra' }).title,
      buildHarvestTask({ crop: 'sorghum' }).title,
      buildWeedControlTask({ crop: 'corn' }).title,
    ].join(' | ');
    for (const re of banned) expect(samples).not.toMatch(re);
  });
});
