/**
 * Harvest Record Validation — Zod schemas for yield/post-harvest records.
 *
 * Validates:
 *   - required fields (farmId, cropId, cropLabel, harvestDate, quantity)
 *   - non-negative quantities
 *   - controlled quantity units
 *   - valid date format
 *   - optional fields (sold, stored, lost, price, currency, grade, notes)
 *
 * Used by the harvest-records route for create and update operations.
 */

import { z } from 'zod';

// ─── Controlled enums ────────────────────────────────────

export const QUANTITY_UNITS = ['kg', 'bags', 'tonnes', 'crates', 'bundles'];
export const CURRENCIES = ['GHS', 'NGN', 'KES', 'TZS', 'USD', 'XOF', 'XAF', 'ZAR', 'UGX', 'RWF'];
export const QUALITY_GRADES = ['A', 'B', 'C', 'poor', 'good', 'excellent'];

// ─── Create schema ───────────────────────────────────────

export const createHarvestRecordSchema = z.object({
  farmId: z.string().min(1, 'farmId is required'),
  cropId: z.string().min(1, 'cropId is required'),
  cropLabel: z.string().min(1, 'cropLabel is required').max(200),
  harvestDate: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'harvestDate must be a valid date string',
  }),
  quantityHarvested: z.number().min(0, 'quantityHarvested must be non-negative'),
  quantityUnit: z.enum(QUANTITY_UNITS, {
    errorMap: () => ({ message: `quantityUnit must be one of: ${QUANTITY_UNITS.join(', ')}` }),
  }),
  quantitySold: z.number().min(0, 'quantitySold must be non-negative').optional().nullable(),
  quantityStored: z.number().min(0, 'quantityStored must be non-negative').optional().nullable(),
  quantityLost: z.number().min(0, 'quantityLost must be non-negative').optional().nullable(),
  averageSellingPrice: z.number().min(0, 'averageSellingPrice must be non-negative').optional().nullable(),
  currency: z.enum(CURRENCIES, {
    errorMap: () => ({ message: `currency must be one of: ${CURRENCIES.join(', ')}` }),
  }).optional().nullable(),
  qualityGrade: z.enum(QUALITY_GRADES, {
    errorMap: () => ({ message: `qualityGrade must be one of: ${QUALITY_GRADES.join(', ')}` }),
  }).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ─── Update schema (all fields optional except id) ───────

export const updateHarvestRecordSchema = z.object({
  cropId: z.string().min(1).optional(),
  cropLabel: z.string().min(1).max(200).optional(),
  harvestDate: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'harvestDate must be a valid date string',
  }).optional(),
  quantityHarvested: z.number().min(0).optional(),
  quantityUnit: z.enum(QUANTITY_UNITS).optional(),
  quantitySold: z.number().min(0).optional().nullable(),
  quantityStored: z.number().min(0).optional().nullable(),
  quantityLost: z.number().min(0).optional().nullable(),
  averageSellingPrice: z.number().min(0).optional().nullable(),
  currency: z.enum(CURRENCIES).optional().nullable(),
  qualityGrade: z.enum(QUALITY_GRADES).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ─── Helpers ─────────────────────────────────────────────

/**
 * Validate a create payload. Returns { success, data, error }.
 */
export function validateCreate(body) {
  const result = createHarvestRecordSchema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data, error: null };
  }
  const fieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.');
    fieldErrors[key] = issue.message;
  }
  return { success: false, data: null, error: result.error.issues[0].message, fieldErrors };
}

/**
 * Validate an update payload. Returns { success, data, error }.
 */
export function validateUpdate(body) {
  const result = updateHarvestRecordSchema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data, error: null };
  }
  const fieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.');
    fieldErrors[key] = issue.message;
  }
  return { success: false, data: null, error: result.error.issues[0].message, fieldErrors };
}

/**
 * Compute summary from an array of harvest records.
 */
export function computeHarvestSummary(records) {
  if (!records || records.length === 0) {
    return {
      totalRecords: 0,
      totalHarvested: 0,
      totalSold: 0,
      totalStored: 0,
      totalLost: 0,
      estimatedRevenue: null,
      dominantUnit: null,
    };
  }

  let totalHarvested = 0;
  let totalSold = 0;
  let totalStored = 0;
  let totalLost = 0;
  let revenueTotal = 0;
  let revenueRecords = 0;
  const unitCounts = {};

  for (const rec of records) {
    totalHarvested += rec.quantityHarvested || 0;
    totalSold += rec.quantitySold || 0;
    totalStored += rec.quantityStored || 0;
    totalLost += rec.quantityLost || 0;

    if (rec.quantitySold != null && rec.averageSellingPrice != null) {
      revenueTotal += rec.quantitySold * rec.averageSellingPrice;
      revenueRecords++;
    }

    const unit = rec.quantityUnit || 'kg';
    unitCounts[unit] = (unitCounts[unit] || 0) + 1;
  }

  // Determine most common unit
  let dominantUnit = 'kg';
  let maxCount = 0;
  for (const [unit, count] of Object.entries(unitCounts)) {
    if (count > maxCount) {
      dominantUnit = unit;
      maxCount = count;
    }
  }

  return {
    totalRecords: records.length,
    totalHarvested: Math.round(totalHarvested * 100) / 100,
    totalSold: Math.round(totalSold * 100) / 100,
    totalStored: Math.round(totalStored * 100) / 100,
    totalLost: Math.round(totalLost * 100) / 100,
    estimatedRevenue: revenueRecords > 0 ? Math.round(revenueTotal * 100) / 100 : null,
    dominantUnit,
  };
}
