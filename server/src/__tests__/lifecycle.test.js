import { describe, it, expect } from 'vitest';

// Mock prisma before importing lifecycle service
import { vi } from 'vitest';
vi.mock('../../config/database.js', () => ({ default: {} }));

import { STAGE_ORDER, ACTIVITY_STAGE_MAP, STAGE_REMINDERS, getStageInfo } from '../modules/lifecycle/service.js';

describe('Lifecycle Stage Engine', () => {
  describe('STAGE_ORDER', () => {
    it('has 6 stages in correct order', () => {
      expect(STAGE_ORDER).toEqual([
        'pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest',
      ]);
    });

    it('pre_planting is first', () => {
      expect(STAGE_ORDER[0]).toBe('pre_planting');
    });

    it('post_harvest is last', () => {
      expect(STAGE_ORDER[STAGE_ORDER.length - 1]).toBe('post_harvest');
    });
  });

  describe('ACTIVITY_STAGE_MAP', () => {
    it('maps planting activity to planting stage', () => {
      expect(ACTIVITY_STAGE_MAP.planting).toBe('planting');
    });

    it('maps fertilizing, spraying, irrigation, weeding to vegetative', () => {
      expect(ACTIVITY_STAGE_MAP.fertilizing).toBe('vegetative');
      expect(ACTIVITY_STAGE_MAP.spraying).toBe('vegetative');
      expect(ACTIVITY_STAGE_MAP.irrigation).toBe('vegetative');
      expect(ACTIVITY_STAGE_MAP.weeding).toBe('vegetative');
    });

    it('maps harvesting to harvest', () => {
      expect(ACTIVITY_STAGE_MAP.harvesting).toBe('harvest');
    });

    it('maps storage and selling to post_harvest', () => {
      expect(ACTIVITY_STAGE_MAP.storage).toBe('post_harvest');
      expect(ACTIVITY_STAGE_MAP.selling).toBe('post_harvest');
    });

    it('maps other to null (does not drive stage)', () => {
      expect(ACTIVITY_STAGE_MAP.other).toBeNull();
    });

    it('every mapped stage exists in STAGE_ORDER', () => {
      for (const [, stage] of Object.entries(ACTIVITY_STAGE_MAP)) {
        if (stage !== null) {
          expect(STAGE_ORDER).toContain(stage);
        }
      }
    });
  });

  describe('STAGE_REMINDERS', () => {
    it('has reminders for every stage', () => {
      for (const stage of STAGE_ORDER) {
        expect(STAGE_REMINDERS[stage]).toBeDefined();
        expect(STAGE_REMINDERS[stage].length).toBeGreaterThan(0);
      }
    });

    it('all reminder types are valid known types', () => {
      const VALID_REMINDER_TYPES = [
        'fertilizing', 'weeding', 'spraying', 'irrigation', 'harvesting',
        'storage_check', 'market_check', 'pest_inspection', 'drying_reminder',
        'harvest_check', 'farm_visit_followup', 'evidence_completion', 'general', 'custom',
      ];

      for (const [stage, reminders] of Object.entries(STAGE_REMINDERS)) {
        for (const r of reminders) {
          expect(VALID_REMINDER_TYPES).toContain(r.type);
        }
      }
    });

    it('all reminders have title, message, type, and daysFromNow', () => {
      for (const [, reminders] of Object.entries(STAGE_REMINDERS)) {
        for (const r of reminders) {
          expect(r).toHaveProperty('title');
          expect(r).toHaveProperty('message');
          expect(r).toHaveProperty('type');
          expect(r).toHaveProperty('daysFromNow');
          expect(typeof r.daysFromNow).toBe('number');
          expect(r.daysFromNow).toBeGreaterThan(0);
        }
      }
    });

    it('pre_planting includes evidence_completion reminders', () => {
      const types = STAGE_REMINDERS.pre_planting.map(r => r.type);
      expect(types).toContain('evidence_completion');
    });

    it('post_harvest includes storage_check and market_check', () => {
      const types = STAGE_REMINDERS.post_harvest.map(r => r.type);
      expect(types).toContain('storage_check');
      expect(types).toContain('market_check');
    });

    it('messages use {crop} placeholder for personalization', () => {
      // At least some messages should have {crop}
      let hasCropPlaceholder = false;
      for (const [, reminders] of Object.entries(STAGE_REMINDERS)) {
        for (const r of reminders) {
          if (r.message.includes('{crop}')) {
            hasCropPlaceholder = true;
            break;
          }
        }
      }
      expect(hasCropPlaceholder).toBe(true);
    });
  });

  describe('getStageInfo', () => {
    it('returns info for all valid stages', () => {
      for (const stage of STAGE_ORDER) {
        const info = getStageInfo(stage);
        expect(info).toHaveProperty('label');
        expect(info).toHaveProperty('color');
        expect(info).toHaveProperty('description');
        expect(typeof info.label).toBe('string');
        expect(info.color).toMatch(/^#[0-9a-f]{6}$/);
      }
    });

    it('returns pre_planting info for unknown stage', () => {
      const info = getStageInfo('nonexistent');
      expect(info.label).toBe('Pre-Planting');
    });

    it('returns correct label for each stage', () => {
      expect(getStageInfo('pre_planting').label).toBe('Pre-Planting');
      expect(getStageInfo('planting').label).toBe('Planting');
      expect(getStageInfo('vegetative').label).toBe('Vegetative Growth');
      expect(getStageInfo('flowering').label).toBe('Flowering');
      expect(getStageInfo('harvest').label).toBe('Harvest');
      expect(getStageInfo('post_harvest').label).toBe('Post-Harvest');
    });
  });
});
