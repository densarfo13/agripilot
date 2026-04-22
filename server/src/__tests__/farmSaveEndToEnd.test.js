/**
 * farmSaveEndToEnd.test.js — locks the end-to-end Add/Edit Farm
 * save flow so canonical values round-trip cleanly between the
 * FarmForm payload and the /api/v2/farm-profile backend
 * validator, and the user sees a specific error (not "Validation
 * failed") when something is wrong.
 *
 *   1. validateFarmProfilePayload accepts SQFT + SQM for backyard
 *   2. Unit aliases ("sq ft", "acres", "Hectares") normalise on
 *      the server side
 *   3. crop / cropType aliasing — both shapes validate cleanly
 *   4. state / stateCode aliasing
 *   5. farmSize / size aliasing
 *   6. location fallback works from stateCode + country
 *   7. Unknown unit surfaces a specific fieldError: "Invalid size
 *      unit: <input>"
 *   8. Size = 0 or -1 surfaces "Farm size must be greater than 0"
 *   9. FarmForm payload (canonical frontend shape) validates
 *      against the server without any translation layer
 *  10. formatApiError surfaces fetch-wrapper fieldErrors as a
 *      readable summary (not "No network connection")
 *  11. formatApiError pretty-prints field names in the summary
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// src/api/client.js pulls in the zustand auth store, which touches
// localStorage at module-load. Install an in-memory shim before the
// import so the test harness doesn't crash under Node.
const store = new Map();
const mem = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: (i) => Array.from(store.keys())[i] || null,
  get length() { return store.size; },
};
globalThis.window = globalThis.window || {};
globalThis.window.localStorage = mem;
globalThis.localStorage = mem;

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const { validateFarmProfilePayload } = await import('../../../server/lib/validation.js');
const { formatApiError } = await import('../../../src/api/client.js');

// Helper: minimum valid payload shape the validator expects.
function base(extra = {}) {
  return {
    farmerName: 'Jane Farmer',
    farmName:   'Maple Field',
    country:    'US',
    location:   'MD, US',
    cropType:   'pepper',
    size:       100,
    sizeUnit:   'SQFT',
    stateCode:  'MD',
    farmType:   'backyard',
    ...extra,
  };
}

// ─── Server validator — canonical + alias acceptance ────────────
describe('validateFarmProfilePayload', () => {
  it('accepts SQFT for a backyard farm', () => {
    const r = validateFarmProfilePayload(base());
    expect(r.isValid).toBe(true);
    expect(r.data.sizeUnit).toBe('SQFT');
    expect(r.data.size).toBe(100);
  });

  it('accepts SQM for a backyard farm', () => {
    const r = validateFarmProfilePayload(base({ sizeUnit: 'SQM' }));
    expect(r.isValid).toBe(true);
    expect(r.data.sizeUnit).toBe('SQM');
  });

  it('accepts "sq ft" / "Square feet" / "sqft" and normalises to SQFT', () => {
    for (const raw of ['sq ft', 'SQ FT', 'Square feet', 'sqft', 'SQFT']) {
      const r = validateFarmProfilePayload(base({ sizeUnit: raw }));
      expect(r.isValid, `unit "${raw}" should be valid`).toBe(true);
      expect(r.data.sizeUnit).toBe('SQFT');
    }
  });

  it('accepts lowercase acres / hectares and normalises', () => {
    expect(validateFarmProfilePayload(base({ sizeUnit: 'acres' })).data.sizeUnit).toBe('ACRE');
    expect(validateFarmProfilePayload(base({ sizeUnit: 'hectares' })).data.sizeUnit).toBe('HECTARE');
    expect(validateFarmProfilePayload(base({ sizeUnit: 'Acres' })).data.sizeUnit).toBe('ACRE');
  });

  it('accepts "SQUARE_METER" as a legacy alias for SQM', () => {
    const r = validateFarmProfilePayload(base({ sizeUnit: 'SQUARE_METER' }));
    expect(r.isValid).toBe(true);
    expect(r.data.sizeUnit).toBe('SQM');
  });

  it('surfaces "Invalid size unit: <raw>" for a totally unknown unit', () => {
    const r = validateFarmProfilePayload(base({ sizeUnit: 'GALLONS' }));
    expect(r.isValid).toBe(false);
    expect(r.errors.sizeUnit).toBe('Invalid size unit: GALLONS');
  });

  it('accepts `crop` alias in place of `cropType`', () => {
    const payload = { ...base(), cropType: undefined, crop: 'pepper' };
    const r = validateFarmProfilePayload(payload);
    expect(r.isValid).toBe(true);
    expect(r.data.cropType).toBe('pepper');
  });

  it('accepts `state` alias in place of `stateCode`', () => {
    const payload = { ...base(), stateCode: undefined, state: 'MD' };
    const r = validateFarmProfilePayload(payload);
    expect(r.isValid).toBe(true);
    expect(r.data.stateCode).toBe('MD');
  });

  it('accepts `farmSize` alias in place of `size`', () => {
    const payload = { ...base(), size: undefined, farmSize: 250 };
    const r = validateFarmProfilePayload(payload);
    expect(r.isValid).toBe(true);
    expect(r.data.size).toBe(250);
  });

  it('accepts `locationLabel` or `locationName` in place of `location`', () => {
    expect(validateFarmProfilePayload({ ...base(), location: undefined,
      locationLabel: 'MD, US' }).isValid).toBe(true);
    expect(validateFarmProfilePayload({ ...base(), location: undefined,
      locationName: 'MD, US' }).isValid).toBe(true);
  });

  it('returns "Farm size must be greater than 0" on zero / negative size', () => {
    expect(validateFarmProfilePayload(base({ size: 0 })).errors.size)
      .toBe('Farm size must be greater than 0');
    expect(validateFarmProfilePayload(base({ size: -5 })).errors.size)
      .toBe('Farm size must be greater than 0');
  });

  it('returns specific missing-field errors, not a blanket "Validation failed"', () => {
    const r = validateFarmProfilePayload({});
    expect(r.isValid).toBe(false);
    expect(r.errors.farmerName).toBe('Farmer name is required');
    expect(r.errors.farmName).toBe('Farm name is required');
    expect(r.errors.country).toBe('Country is required');
    expect(r.errors.cropType).toBe('Crop type is required');
    expect(r.errors.size).toBe('Farm size is required');
  });

  it('accepts the EXACT payload shape the FarmForm ships', () => {
    const exactFromFrontend = {
      farmerName: 'Dens Sarfo',                // now set by the route from req.user when absent
      farmName: 'My Backyard Pepper Farm',
      crop: 'pepper',                          // alias → cropType
      cropType: 'pepper',
      otherCropName: '',
      country: 'US',
      state: 'MD',                             // alias → stateCode
      stateCode: 'MD',
      farmType: 'backyard',
      size: 100,
      farmSize: 100,
      sizeUnit: 'SQFT',
      normalizedAreaSqm: 9.2903,
      cropStage: 'land_preparation',
      plantingDate: '2025-05-01',
      plantedAt: '2025-05-01',
      location: 'MD, US',
      isActiveFarm: true,
    };
    const r = validateFarmProfilePayload(exactFromFrontend);
    expect(r.isValid).toBe(true);
    expect(r.data.farmType).toBe('backyard');
    expect(r.data.sizeUnit).toBe('SQFT');
    expect(r.data.cropType).toBe('pepper');
    expect(r.data.stateCode).toBe('MD');
  });
});

// ─── Route-level alias handling (source-level) ──────────────────
describe('farmProfile route — alias + fallback handling', () => {
  const routeSrc = readFile('server/routes/farmProfile.js');

  it('POST /new pulls farmerName from req.user when body omits it', () => {
    expect(routeSrc).toMatch(/if \(!body\.farmerName && req\.user\)/);
    expect(routeSrc).toMatch(/req\.user\.fullName \|\| req\.user\.name/);
  });

  it('POST /new accepts crop/state/farmSize aliases', () => {
    expect(routeSrc).toMatch(/body\.crop != null && body\.cropType == null[\s\S]*body\.cropType = body\.crop/);
    expect(routeSrc).toMatch(/body\.state != null && body\.stateCode == null[\s\S]*body\.stateCode = body\.state/);
    expect(routeSrc).toMatch(/body\.farmSize != null && body\.size == null[\s\S]*body\.size = body\.farmSize/);
  });

  it('POST /new derives location from stateCode + country when absent', () => {
    expect(routeSrc).toMatch(/if \(!body\.location && !body\.locationLabel && !body\.locationName\)/);
    expect(routeSrc).toMatch(/body\.location = `\$\{s\}, \$\{c\}`/);
  });

  it('400 responses include a readable error summary, not just "Validation failed"', () => {
    expect(routeSrc).toMatch(/fieldSummary = Object\.entries\(validation\.errors\)/);
    expect(routeSrc).toMatch(/error: fieldSummary/);
  });

  it('PATCH /:id accepts the same aliases for edit', () => {
    expect(routeSrc).toMatch(/body\.crop != null && body\.cropType == null[\s\S]*body\.cropType = body\.crop/);
    expect(routeSrc).toMatch(/body\.plantingDate != null && body\.plantedAt == null/);
  });

  it('PATCH /:id rejects unknown size units with a specific message', () => {
    expect(routeSrc).toMatch(/Invalid size unit/);
  });

  it('PATCH /:id rejects non-positive size explicitly', () => {
    expect(routeSrc).toMatch(/Farm size must be greater than 0/);
  });
});

// ─── formatApiError — per-field summary, not generic banner ─────
describe('formatApiError', () => {
  it('summarises fetch-wrapper fieldErrors with pretty field names', () => {
    const err = Object.assign(new Error('Validation failed'), {
      status: 400,
      fieldErrors: {
        cropType: 'Crop type is required',
        size: 'Farm size must be greater than 0',
      },
    });
    const msg = formatApiError(err);
    expect(msg).toContain('Crop: Crop type is required');
    expect(msg).toContain('Farm size: Farm size must be greater than 0');
  });

  it('does NOT mis-classify a 400 as a network error', () => {
    const err = Object.assign(new Error('Validation failed'), {
      status: 400, fieldErrors: { cropType: 'Crop is required' },
    });
    expect(formatApiError(err)).not.toContain('No network connection');
  });

  it('summarises axios-shape fieldErrors too', () => {
    const err = {
      response: {
        status: 400,
        data: {
          error: 'Validation failed',
          fieldErrors: { sizeUnit: 'Invalid size unit: gallons' },
        },
      },
    };
    expect(formatApiError(err)).toContain('Size unit: Invalid size unit: gallons');
  });

  it('falls back to err.message when no fieldErrors are present', () => {
    const err = Object.assign(new Error('Some specific message'), { status: 500 });
    expect(formatApiError(err)).toBe('Some specific message');
  });

  it('returns "No network connection" only when we truly have no response + no status', () => {
    const err = new Error('Network Error');
    expect(formatApiError(err)).toMatch(/No network connection/);
  });
});

// ─── FarmForm payload shape — canonical on the wire ─────────────
describe('FarmForm — canonical payload shape', () => {
  const src = readFile('src/components/FarmForm.jsx');

  it('ships both canonical + schema field names (crop+cropType etc.)', () => {
    expect(src).toMatch(/crop:\s+cropCanon,\s*\n?\s*cropType:\s+cropCanon/);
    expect(src).toMatch(/state:\s+form\.state \|\| '',\s*\n?\s*stateCode:/);
    expect(src).toMatch(/size:\s+sizeNum,\s*\n?\s*farmSize:\s+sizeNum/);
  });

  it('translates sizeUnit to the schema\'s uppercase short code', () => {
    expect(src).toMatch(/SERVER_UNIT = \{ sqft: 'SQFT', sqm: 'SQM',[\s\S]*acres: 'ACRE', hectares: 'HECTARE' \}/);
    expect(src).toMatch(/sizeUnit:\s+unitForServer/);
  });

  it('ships both plantingDate and plantedAt for schema compatibility', () => {
    expect(src).toMatch(/plantingDate:\s+form\.plantingDate \|\| null,\s*\n?\s*plantedAt:/);
  });

  it('maps backend fieldErrors → local form field errors on submit failure', () => {
    expect(src).toMatch(/const SERVER_TO_LOCAL = \{/);
    expect(src).toMatch(/cropType:\s+'crop'/);
    expect(src).toMatch(/size:\s+'farmSize'/);
    expect(src).toMatch(/stateCode:\s+'state'/);
  });
});
