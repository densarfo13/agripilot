/**
 * Seasonal Timing — comprehensive tests
 *
 * Covers: schema, shared module, Zod validation, API endpoints,
 * task engine integration, frontend API, UI components, i18n.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  isMonthInRange, isInPlantingWindow, isInSeason,
  getSeasonalContext, formatMonthRange,
  SEASONAL_FIELDS, MONTH_LABELS, MONTH_SHORT,
} from '../../lib/seasonalTiming.js';
import { generateTasksForFarm } from '../../lib/farmTaskEngine.js';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  1. Prisma Schema
// ═══════════════════════════════════════════════════════════
describe('Prisma schema — seasonal timing fields', () => {
  const schema = readFile('server/prisma/schema.prisma');

  const fields = [
    'season_start_month', 'season_end_month',
    'planting_window_start_month', 'planting_window_end_month',
    'current_season_label',
    'last_rainy_season_start', 'last_dry_season_start',
  ];

  it('has all 7 seasonal timing columns', () => {
    for (const f of fields) {
      expect(schema).toContain(f);
    }
  });

  it('month fields are Int?', () => {
    expect(schema).toMatch(/seasonStartMonth\s+Int\?/);
    expect(schema).toMatch(/seasonEndMonth\s+Int\?/);
  });

  it('date fields are DateTime?', () => {
    expect(schema).toMatch(/lastRainySeasonStart\s+DateTime\?/);
    expect(schema).toMatch(/lastDrySeasonStart\s+DateTime\?/);
  });

  it('currentSeasonLabel is String?', () => {
    expect(schema).toMatch(/currentSeasonLabel\s+String\?/);
  });
});

// ═══════════════════════════════════════════════════════════
//  2. Shared seasonalTiming module
// ═══════════════════════════════════════════════════════════
describe('seasonalTiming module — helpers', () => {
  it('exports SEASONAL_FIELDS with 7 entries', () => {
    expect(SEASONAL_FIELDS).toHaveLength(7);
  });

  it('exports MONTH_LABELS with 13 entries (index 0 empty)', () => {
    expect(MONTH_LABELS).toHaveLength(13);
    expect(MONTH_LABELS[0]).toBe('');
    expect(MONTH_LABELS[1]).toBe('January');
    expect(MONTH_LABELS[12]).toBe('December');
  });

  it('exports MONTH_SHORT with 13 entries', () => {
    expect(MONTH_SHORT).toHaveLength(13);
    expect(MONTH_SHORT[3]).toBe('Mar');
  });

  describe('isMonthInRange', () => {
    it('returns true for month within non-wrapping range', () => {
      expect(isMonthInRange(5, 3, 8)).toBe(true);
    });

    it('returns false for month outside non-wrapping range', () => {
      expect(isMonthInRange(2, 3, 8)).toBe(false);
    });

    it('handles wrap-around (Nov–Mar)', () => {
      expect(isMonthInRange(12, 11, 3)).toBe(true);
      expect(isMonthInRange(1, 11, 3)).toBe(true);
      expect(isMonthInRange(6, 11, 3)).toBe(false);
    });

    it('returns null for missing data', () => {
      expect(isMonthInRange(5, null, 8)).toBeNull();
      expect(isMonthInRange(null, 3, 8)).toBeNull();
    });
  });

  describe('isInPlantingWindow', () => {
    it('returns true when current month is in window', () => {
      const timing = { plantingWindowStartMonth: 3, plantingWindowEndMonth: 6 };
      const april = new Date(2026, 3, 15); // April = month 4
      expect(isInPlantingWindow(timing, april)).toBe(true);
    });

    it('returns false when outside window', () => {
      const timing = { plantingWindowStartMonth: 3, plantingWindowEndMonth: 6 };
      const october = new Date(2026, 9, 15); // October = month 10
      expect(isInPlantingWindow(timing, october)).toBe(false);
    });

    it('returns null when timing data is missing', () => {
      expect(isInPlantingWindow(null)).toBeNull();
      expect(isInPlantingWindow({})).toBeNull();
    });
  });

  describe('isInSeason', () => {
    it('returns true when in active season', () => {
      const timing = { seasonStartMonth: 4, seasonEndMonth: 10 };
      const july = new Date(2026, 6, 15);
      expect(isInSeason(timing, july)).toBe(true);
    });

    it('returns false when off-season', () => {
      const timing = { seasonStartMonth: 4, seasonEndMonth: 10 };
      const jan = new Date(2026, 0, 15);
      expect(isInSeason(timing, jan)).toBe(false);
    });
  });

  describe('getSeasonalContext', () => {
    it('returns structured context with all fields', () => {
      const timing = {
        seasonStartMonth: 3, seasonEndMonth: 9,
        plantingWindowStartMonth: 3, plantingWindowEndMonth: 5,
        currentSeasonLabel: 'Main 2026',
      };
      const ctx = getSeasonalContext(timing, new Date(2026, 3, 15)); // April
      expect(ctx.currentMonth).toBe(4);
      expect(ctx.inSeason).toBe(true);
      expect(ctx.inPlantingWindow).toBe(true);
      expect(ctx.hasSeasonalData).toBe(true);
      expect(ctx.seasonLabel).toBe('Main 2026');
    });

    it('returns hasSeasonalData=false when no timing', () => {
      const ctx = getSeasonalContext(null);
      expect(ctx.hasSeasonalData).toBe(false);
      expect(ctx.inSeason).toBeNull();
      expect(ctx.inPlantingWindow).toBeNull();
    });
  });

  describe('formatMonthRange', () => {
    it('formats valid range', () => {
      expect(formatMonthRange(3, 7)).toBe('Mar – Jul');
    });

    it('returns null for missing data', () => {
      expect(formatMonthRange(null, 7)).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════
//  3. Zod validation schema
// ═══════════════════════════════════════════════════════════
describe('seasonalTimingSchema — Zod', () => {
  const schema = readFile('server/lib/seasonalTimingSchema.js');

  it('imports zod', () => {
    expect(schema).toContain("from 'zod'");
  });

  it('exports seasonalTimingSchema', () => {
    expect(schema).toContain('export const seasonalTimingSchema');
  });

  it('validates month range 1–12', () => {
    expect(schema).toContain('.min(1)');
    expect(schema).toContain('.max(12)');
  });

  it('all fields are optional/nullable', () => {
    expect(schema).toContain('.nullable()');
    expect(schema).toContain('.optional()');
  });

  it('validates datetime strings for date fields', () => {
    expect(schema).toContain('z.string().datetime');
  });

  it('limits season label to 100 chars', () => {
    expect(schema).toContain('.max(100');
  });
});

// ═══════════════════════════════════════════════════════════
//  4. Server: dedicated endpoints
// ═══════════════════════════════════════════════════════════
describe('Server — seasonal timing endpoints', () => {
  const route = readFile('server/routes/farmProfile.js');

  it('has GET /:id/seasonal-timing', () => {
    expect(route).toContain("router.get('/:id/seasonal-timing'");
  });

  it('has PATCH /:id/seasonal-timing', () => {
    expect(route).toContain("router.patch('/:id/seasonal-timing'");
  });

  it('GET checks ownership', () => {
    expect(route).toContain('userId: req.user.id');
  });

  it('PATCH uses Zod validation', () => {
    expect(route).toContain('validateWithZod(seasonalTimingSchema');
  });

  it('PATCH rejects archived farms', () => {
    expect(route).toContain('Cannot update seasonal timing on archived farm');
  });

  it('PATCH logs audit event', () => {
    expect(route).toContain('farm_profile.seasonal_timing_updated');
  });

  it('imports seasonalTimingSchema', () => {
    expect(route).toContain("from '../lib/seasonalTimingSchema.js'");
  });

  it('imports SEASONAL_FIELDS', () => {
    expect(route).toContain("from '../lib/seasonalTiming.js'");
  });
});

// ═══════════════════════════════════════════════════════════
//  5. Server: mapProfile exposes seasonal fields
// ═══════════════════════════════════════════════════════════
describe('mapProfile — seasonal fields', () => {
  const route = readFile('server/routes/farmProfile.js');

  it('exposes seasonStartMonth', () => {
    expect(route).toContain('seasonStartMonth: profile.seasonStartMonth');
  });

  it('exposes seasonEndMonth', () => {
    expect(route).toContain('seasonEndMonth: profile.seasonEndMonth');
  });

  it('exposes plantingWindowStartMonth', () => {
    expect(route).toContain('plantingWindowStartMonth: profile.plantingWindowStartMonth');
  });

  it('exposes currentSeasonLabel', () => {
    expect(route).toContain('currentSeasonLabel: profile.currentSeasonLabel');
  });
});

// ═══════════════════════════════════════════════════════════
//  6. Server: PATCH /:id accepts seasonal fields
// ═══════════════════════════════════════════════════════════
describe('PATCH /:id — seasonal fields in allowed list', () => {
  const route = readFile('server/routes/farmProfile.js');

  it('uses SEASONAL_FIELDS in allowed list', () => {
    expect(route).toContain('...SEASONAL_FIELDS');
  });

  it('validates seasonal patch via Zod', () => {
    expect(route).toContain('seasonalTimingSchema.safeParse(seasonalPatch)');
  });
});

// ═══════════════════════════════════════════════════════════
//  7. Task engine — seasonal integration
// ═══════════════════════════════════════════════════════════
describe('Task engine — seasonal context', () => {
  const engine = readFile('server/lib/farmTaskEngine.js');

  it('accepts seasonal in context', () => {
    expect(engine).toContain('seasonal');
    expect(engine).toContain('seasonal, weather, risks, inputRecs, harvestRecs, hasRecentHarvestRecord, hasCostRecords, hasRevenueData, benchmarkInsights } = context');
  });

  it('checks seasonal.hasSeasonalData', () => {
    expect(engine).toContain('seasonal.hasSeasonalData');
  });

  it('adjusts priority based on planting window', () => {
    expect(engine).toContain('seasonal.inPlantingWindow');
  });

  it('adds seasonalNote to tasks', () => {
    expect(engine).toContain('seasonalNote');
  });

  it('generates tasks with seasonal note when outside planting window', () => {
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'planning', farmerType: 'new',
      seasonal: {
        currentMonth: 10,
        inPlantingWindow: false,
        inSeason: true,
        hasSeasonalData: true,
        seasonLabel: null,
      },
    });
    expect(tasks.length).toBeGreaterThan(0);
    const noted = tasks.filter((t) => t.seasonalNote);
    expect(noted.length).toBeGreaterThan(0);
  });

  it('boosts urgency when planting window is open', () => {
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'planning', farmerType: 'new',
      seasonal: {
        currentMonth: 4,
        inPlantingWindow: true,
        inSeason: true,
        hasSeasonalData: true,
        seasonLabel: null,
      },
    });
    const noted = tasks.filter((t) => t.seasonalNote);
    expect(noted.length).toBeGreaterThan(0);
    expect(noted[0].seasonalNote).toContain('Planting window is open');
  });

  it('works without seasonal data (backward compatible)', () => {
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
    });
    expect(tasks.length).toBeGreaterThan(0);
    // No seasonal note when no seasonal data
    const noted = tasks.filter((t) => t.seasonalNote);
    expect(noted.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
//  8. Farm tasks route — passes seasonal context
// ═══════════════════════════════════════════════════════════
describe('Farm tasks route — seasonal integration', () => {
  const route = readFile('server/routes/farmTasks.js');

  it('imports getSeasonalContext', () => {
    expect(route).toContain("from '../lib/seasonalTiming.js'");
    expect(route).toContain('getSeasonalContext');
  });

  it('fetches seasonal timing fields from farm', () => {
    expect(route).toContain('seasonStartMonth: true');
    expect(route).toContain('plantingWindowStartMonth: true');
  });

  it('builds seasonal context', () => {
    expect(route).toContain('getSeasonalContext(');
  });

  it('passes seasonal to generateTasksForFarm', () => {
    expect(route).toContain('seasonal,');
    expect(route).toContain('seasonal');
  });

  it('returns seasonal in response', () => {
    expect(route).toContain('seasonal,');
  });
});

// ═══════════════════════════════════════════════════════════
//  9. Frontend API
// ═══════════════════════════════════════════════════════════
describe('Frontend API — seasonal timing', () => {
  const api = readFile('src/lib/api.js');

  it('exports getSeasonalTiming', () => {
    expect(api).toContain('export function getSeasonalTiming');
  });

  it('exports updateSeasonalTiming', () => {
    expect(api).toContain('export function updateSeasonalTiming');
  });

  it('uses /seasonal-timing endpoint', () => {
    expect(api).toContain('/seasonal-timing');
  });
});

// ═══════════════════════════════════════════════════════════
//  10. SeasonalTimingModal component
// ═══════════════════════════════════════════════════════════
describe('SeasonalTimingModal component', () => {
  const modal = readFile('src/components/SeasonalTimingModal.jsx');

  it('has season start/end month selects', () => {
    expect(modal).toContain('testId="season-start"');
    expect(modal).toContain('testId="season-end"');
  });

  it('has planting window start/end selects', () => {
    expect(modal).toContain('testId="planting-start"');
    expect(modal).toContain('testId="planting-end"');
  });

  it('has season label input', () => {
    expect(modal).toContain('data-testid="season-label"');
  });

  it('has rainy/dry date inputs', () => {
    expect(modal).toContain('data-testid="last-rainy"');
    expect(modal).toContain('data-testid="last-dry"');
  });

  it('has save button', () => {
    expect(modal).toContain('data-testid="save-seasonal-btn"');
  });

  it('calls updateSeasonalTiming API', () => {
    expect(modal).toContain('updateSeasonalTiming');
  });

  it('refreshes profile after save', () => {
    expect(modal).toContain('refreshProfile');
  });

  it('tracks analytics event', () => {
    expect(modal).toContain('farm.seasonal_timing_updated');
  });

  it('preserves dark theme', () => {
    expect(modal).toContain('#1B2330');
  });
});

// ═══════════════════════════════════════════════════════════
//  11. FarmSummaryCard — seasonal display
// ═══════════════════════════════════════════════════════════
describe('FarmSummaryCard — seasonal timing display', () => {
  const card = readFile('src/components/FarmSummaryCard.jsx');

  it('shows seasonal timing data', () => {
    expect(card).toContain('data-testid="seasonal-timing-display"');
  });

  it('shows set-season prompt when no data', () => {
    expect(card).toContain('data-testid="seasonal-timing-prompt"');
  });

  it('accepts onEditSeason prop', () => {
    expect(card).toContain('onEditSeason');
  });

  it('formats month ranges', () => {
    expect(card).toContain('formatRange');
  });

  it('shows season label when present', () => {
    expect(card).toContain('currentSeasonLabel');
  });
});

// ═══════════════════════════════════════════════════════════
//  12. Dashboard integration
// ═══════════════════════════════════════════════════════════
describe('Dashboard — seasonal modal wiring', () => {
  const dash = readFile('src/pages/Dashboard.jsx');

  it('imports SeasonalTimingModal', () => {
    expect(dash).toContain("import SeasonalTimingModal from '../components/SeasonalTimingModal.jsx'");
  });

  it('has showSeasonModal state', () => {
    expect(dash).toContain('showSeasonModal');
  });

  it('has showSeasonModal state for seasonal editing', () => {
    expect(dash).toContain('showSeasonModal');
    expect(dash).toContain('setShowSeasonModal');
  });

  it('renders SeasonalTimingModal conditionally', () => {
    expect(dash).toContain('showSeasonModal && profile');
    expect(dash).toContain('<SeasonalTimingModal');
  });
});

// ═══════════════════════════════════════════════════════════
//  13. FarmTasksCard — seasonal notes
// ═══════════════════════════════════════════════════════════
describe('FarmTasksCard — seasonal notes', () => {
  const card = readFile('src/components/FarmTasksCard.jsx');

  it('renders seasonalNote when present', () => {
    expect(card).toContain('task.seasonalNote');
    expect(card).toContain('seasonalNote');
  });

  it('has styling for seasonal notes', () => {
    expect(card).toContain('seasonalNote:');
  });
});

// ═══════════════════════════════════════════════════════════
//  14. i18n translations
// ═══════════════════════════════════════════════════════════
describe('i18n — seasonal timing keys', () => {
  const translations = readFile('src/i18n/translations.js');

  const keys = [
    'seasonal.title', 'seasonal.subtitle', 'seasonal.season',
    'seasonal.seasonRange', 'seasonal.plantingWindow',
    'seasonal.start', 'seasonal.end',
    'seasonal.seasonLabel', 'seasonal.seasonLabelPlaceholder',
    'seasonal.lastRainy', 'seasonal.lastDry',
    'seasonal.edit', 'seasonal.setPrompt', 'seasonal.saveFailed',
  ];

  it('has all required seasonal translation keys', () => {
    for (const key of keys) {
      expect(translations).toContain(`'${key}'`);
    }
  });

  it('all keys have 5 languages', () => {
    const langs = [' en:', ' fr:', ' sw:', ' ha:', ' tw:'];
    for (const key of keys) {
      const idx = translations.indexOf(`'${key}'`);
      expect(idx).toBeGreaterThan(-1);
      const chunk = translations.slice(idx, idx + 500);
      const closeBrace = chunk.indexOf('}');
      const entry = chunk.slice(0, closeBrace + 1);
      for (const lang of langs) {
        expect(entry).toContain(lang);
      }
    }
  });
});
