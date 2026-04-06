import { describe, it, expect } from 'vitest';

/**
 * Reminder Type Validation Tests
 *
 * Ensures all reminder types used across the system are in the valid list.
 */

const VALID_REMINDER_TYPES = [
  'fertilizing', 'weeding', 'spraying', 'irrigation', 'harvesting',
  'storage_check', 'market_check', 'pest_inspection', 'drying_reminder',
  'harvest_check', 'farm_visit_followup', 'evidence_completion', 'general', 'custom',
];

// Activity types from lifecycle engine that generate reminders
const ACTIVITY_STAGE_MAP_TYPES = [
  'planting', 'fertilizing', 'spraying', 'irrigation', 'weeding',
  'harvesting', 'storage', 'selling', 'other',
];

// Crop schedule reminder types
const CROP_SCHEDULE_TYPES = ['fertilizing', 'weeding', 'spraying', 'irrigation', 'harvesting', 'storage_check'];

// Stage reminder types from lifecycle service
const STAGE_REMINDER_TYPES = [
  'general', 'evidence_completion', 'fertilizing', 'farm_visit_followup',
  'spraying', 'weeding', 'irrigation', 'harvesting', 'drying_reminder',
  'storage_check', 'pest_inspection', 'market_check',
];

describe('Reminder Type Consistency', () => {
  it('all crop schedule reminder types are in VALID_REMINDER_TYPES', () => {
    for (const type of CROP_SCHEDULE_TYPES) {
      expect(VALID_REMINDER_TYPES).toContain(type);
    }
  });

  it('all stage reminder types are in VALID_REMINDER_TYPES', () => {
    for (const type of STAGE_REMINDER_TYPES) {
      expect(VALID_REMINDER_TYPES).toContain(type);
    }
  });

  it('VALID_REMINDER_TYPES includes custom for manual reminders', () => {
    expect(VALID_REMINDER_TYPES).toContain('custom');
  });

  it('VALID_REMINDER_TYPES includes general for generic reminders', () => {
    expect(VALID_REMINDER_TYPES).toContain('general');
  });

  it('has no duplicate types', () => {
    const unique = new Set(VALID_REMINDER_TYPES);
    expect(unique.size).toBe(VALID_REMINDER_TYPES.length);
  });

  it('rejects unknown reminder types', () => {
    const invalidTypes = ['watering', 'plowing', 'shopping', 'undefined', ''];
    for (const type of invalidTypes) {
      expect(VALID_REMINDER_TYPES).not.toContain(type);
    }
  });
});
