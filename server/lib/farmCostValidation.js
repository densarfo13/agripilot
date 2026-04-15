/**
 * Farm Cost Record Validation — Zod schemas for expense tracking.
 *
 * Validates:
 *   - required fields (farmId, date, category, description, amount)
 *   - non-negative amount
 *   - controlled category enum
 *   - valid date format
 *   - optional fields (currency, notes)
 *
 * Also provides economics computation (profit = revenue - costs).
 */

import { z } from 'zod';

// ─── Controlled enums ────────────────────────────────────

export const COST_CATEGORIES = [
  'seeds',
  'fertilizer',
  'pesticide',
  'herbicide',
  'labor',
  'irrigation',
  'transport',
  'storage',
  'equipment',
  'land_preparation',
  'other',
];

export const CURRENCIES = ['GHS', 'NGN', 'KES', 'TZS', 'USD', 'XOF', 'XAF', 'ZAR', 'UGX', 'RWF'];

// ─── Create schema ───────────────────────────────────────

export const createCostRecordSchema = z.object({
  farmId: z.string().min(1, 'farmId is required'),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'date must be a valid date string',
  }),
  category: z.enum(COST_CATEGORIES, {
    errorMap: () => ({ message: `category must be one of: ${COST_CATEGORIES.join(', ')}` }),
  }),
  description: z.string().min(1, 'description is required').max(500),
  amount: z.number().min(0, 'amount must be non-negative'),
  currency: z.enum(CURRENCIES, {
    errorMap: () => ({ message: `currency must be one of: ${CURRENCIES.join(', ')}` }),
  }).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ─── Update schema (all fields optional) ─────────────────

export const updateCostRecordSchema = z.object({
  date: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'date must be a valid date string',
  }).optional(),
  category: z.enum(COST_CATEGORIES).optional(),
  description: z.string().min(1).max(500).optional(),
  amount: z.number().min(0).optional(),
  currency: z.enum(CURRENCIES).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ─── Helpers ─────────────────────────────────────────────

/**
 * Validate a create payload. Returns { success, data, error }.
 */
export function validateCreate(body) {
  const result = createCostRecordSchema.safeParse(body);
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
  const result = updateCostRecordSchema.safeParse(body);
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
 * Compute cost summary from an array of cost records.
 */
export function computeCostSummary(records) {
  if (!records || records.length === 0) {
    return {
      totalRecords: 0,
      totalCosts: 0,
      categoryBreakdown: {},
    };
  }

  let totalCosts = 0;
  const categoryBreakdown = {};

  for (const rec of records) {
    const amt = rec.amount || 0;
    totalCosts += amt;
    const cat = rec.category || 'other';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
  }

  // Round values
  totalCosts = Math.round(totalCosts * 100) / 100;
  for (const cat of Object.keys(categoryBreakdown)) {
    categoryBreakdown[cat] = Math.round(categoryBreakdown[cat] * 100) / 100;
  }

  return {
    totalRecords: records.length,
    totalCosts,
    categoryBreakdown,
  };
}

/**
 * Compute farm economics from harvest records + cost records.
 * Revenue comes from harvest records (quantitySold * averageSellingPrice).
 * Costs come from cost records.
 * Profit = revenue - costs.
 *
 * @param {Array} harvestRecords
 * @param {Array} costRecords
 * @returns {{ totalRevenue: number|null, totalCosts: number, estimatedProfit: number|null, revenueIsPartial: boolean, categoryBreakdown: object }}
 */
export function computeFarmEconomics(harvestRecords, costRecords) {
  // Revenue from harvest records
  let totalRevenue = 0;
  let revenueRecords = 0;
  let harvestWithoutPrice = 0;

  for (const rec of (harvestRecords || [])) {
    if (rec.quantitySold != null && rec.averageSellingPrice != null) {
      totalRevenue += rec.quantitySold * rec.averageSellingPrice;
      revenueRecords++;
    } else if (rec.quantitySold != null && rec.quantitySold > 0) {
      harvestWithoutPrice++;
    }
  }

  totalRevenue = Math.round(totalRevenue * 100) / 100;

  const hasRevenue = revenueRecords > 0;
  const revenueIsPartial = harvestWithoutPrice > 0;

  // Costs from cost records
  const costSummary = computeCostSummary(costRecords);

  // Profit
  const estimatedProfit = hasRevenue
    ? Math.round((totalRevenue - costSummary.totalCosts) * 100) / 100
    : null;

  return {
    totalRevenue: hasRevenue ? totalRevenue : null,
    totalCosts: costSummary.totalCosts,
    estimatedProfit,
    revenueIsPartial,
    categoryBreakdown: costSummary.categoryBreakdown,
    costRecordCount: costSummary.totalRecords,
    revenueRecordCount: revenueRecords,
  };
}
